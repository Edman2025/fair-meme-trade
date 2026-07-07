import { existsSync } from "node:fs";
import { scanDistPlaceholders } from "./scan-dist-placeholders.mjs";

const baseUrl = (process.env.PROD_BASE_URL || "https://english.xunlian.co").replace(/\/$/, "");
const adminWallet = process.env.ADMIN_WALLET || "0x5A3a9252f4C841214210e525f3B1d01974E96682";
const distDir = process.env.PROD_DIST_DIR
  || (existsSync("dist") ? "dist" : "/var/www/fair-meme-trade/current");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return { response, text };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkStatus = async (path, expected = 200) => {
  let lastResult;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    lastResult = await request(path);
    if (lastResult.response.status === expected) {
      console.log(`${path} ${lastResult.response.status}`);
      return;
    }
    if (![502, 503, 504].includes(lastResult.response.status)) break;
    await sleep(750 * (attempt + 1));
  }
  assert(
    lastResult?.response.status === expected,
    `${path} expected ${expected}, got ${lastResult?.response.status}: ${lastResult?.text.slice(0, 200)}`,
  );
};

{
  const hits = scanDistPlaceholders(distDir);
  assert(hits.length === 0, `${distDir} contains forbidden production placeholders:\n${hits.join("\n")}`);
  console.log("dist placeholder scan ok");
}

for (const path of [
  "/",
  "/admin",
  "/token/ROCKET",
  "/lp-launch/ROCKET",
  "/my-lp",
  "/nodes",
  "/api-docs",
  "/api/health",
  "/api/tokens/ROCKET",
  "/api/tokens/ROCKET/holders?limit=5",
  `/api/ledger/commissions?wallet=${adminWallet}`,
]) {
  await checkStatus(path);
}

{
  const { response, text } = await request("/api/tokens/ROCKET");
  assert(response.status === 200, `/api/tokens/ROCKET expected 200, got ${response.status}`);
  const token = JSON.parse(text);
  assert(token.status === "launched", `ROCKET status expected launched, got ${token.status}`);
  assert(/^0x[a-fA-F0-9]{40}$/.test(token.tokenAddress || ""), `ROCKET tokenAddress invalid: ${token.tokenAddress}`);
  console.log("rocket token api launched ok");
}

{
  const { response, text } = await request(`/api/lp-positions?owner=${adminWallet}`);
  assert(response.status === 200, `/api/lp-positions expected 200, got ${response.status}`);
  const positions = JSON.parse(text);
  assert(Array.isArray(positions), "lp positions should be an array");
  assert(positions.length > 0, "admin wallet should have at least one indexed LP vault position");
  assert(positions.some((position) => Number(position.positionId || 0) > 0), "LP positions should include an on-chain positionId");
  console.log("lp positions api ok");
}

{
  const { response, text } = await request("/api/tokens/ROCKET/holders?limit=5");
  assert(response.status === 200, `/api/tokens/ROCKET/holders expected 200, got ${response.status}`);
  const analytics = JSON.parse(text);
  assert(Array.isArray(analytics.holders), "holder analytics should include holders array");
  assert(Number(analytics.latestBlock || 0) > 0, "holder analytics should include latestBlock");
  assert(/^0x[a-fA-F0-9]{40}$/.test(analytics.tokenAddress || ""), `holder analytics tokenAddress invalid: ${analytics.tokenAddress}`);
  console.log("holder analytics api ok");
}

{
  const { response } = await request("/api/tokens", {
    headers: { Authorization: "Bearer ey.fake.jwt" },
  });
  assert(response.status === 200, `JWT-like bearer public read expected 200, got ${response.status}`);
  console.log("security jwt-like public read 200");
}

{
  const { response } = await request("/api/tokens", {
    headers: { Authorization: "Bearer fmt_unknown" },
  });
  assert(response.status === 401, `unknown API key expected 401, got ${response.status}`);
  console.log("security unknown api key 401");
}

{
  const { response } = await request("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: "0xabc",
      tokenAddress: "0xtoken",
      orderType: "limit",
      side: "buy",
      amount: "1",
    }),
  });
  assert(response.status === 401, `anonymous order write expected 401, got ${response.status}`);
  console.log("security anonymous order write 401");
}

{
  const { response } = await request("/api/withdrawals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: "0xabc",
      tokenAddress: "0xtoken",
      amount: "1",
    }),
  });
  assert(response.status === 401, `anonymous withdrawal write expected 401, got ${response.status}`);
  console.log("security anonymous withdrawal write 401");
}

{
  const { response } = await request("/api/admin/projects/1/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: "smoke" }),
  });
  assert(response.status === 401, `anonymous admin launch expected 401, got ${response.status}`);
  console.log("security anonymous admin launch 401");
}

{
  const { response, text } = await request("/api/indexer/status");
  assert(response.status === 200, `/api/indexer/status expected 200, got ${response.status}`);
  const states = JSON.parse(text);
  assert(Array.isArray(states), "indexer status should be an array");
  assert(states.length === 3, `indexer status should include exactly 3 active V3 contracts, got ${states.length}`);
  for (const state of states) {
    assert(state.failureCount === 0, `${state.contractAddress} failureCount expected 0, got ${state.failureCount}`);
    assert(state.lastError === null || state.lastError === undefined, `${state.contractAddress} lastError expected null`);
    assert(Number(state.lagBlocks) <= 2, `${state.contractAddress} lagBlocks expected <= 2, got ${state.lagBlocks}`);
  }
  console.log("indexer status ok");
}
