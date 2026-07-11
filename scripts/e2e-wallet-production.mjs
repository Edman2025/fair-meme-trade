import { chromium } from "playwright";

const baseUrl = (process.env.PROD_BASE_URL || "https://english.xunlian.co").replace(/\/$/, "");
const walletAddress = process.env.E2E_WALLET_ADDRESS || "0x5A3a9252f4C841214210e525f3B1d01974E96682";
const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

await page.addInitScript(({ address }) => {
  const requests = [];
  const txHash = "0x" + "1".repeat(64);
  let connected = false;
  window.__fairMemeWalletRequests = requests;
  window.ethereum = {
    request: async ({ method, params }) => {
      requests.push({ method, params });
      if (method === "eth_requestAccounts") {
        connected = true;
        return [address];
      }
      if (method === "eth_accounts") return connected ? [address] : [];
      if (method === "eth_chainId") return "0x61";
      if (method === "personal_sign") return "0x" + "2".repeat(130);
      if (method === "eth_sendTransaction") return txHash;
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "eth_getBalance") return "0x0";
      throw new Error(`Unhandled wallet method: ${method}`);
    },
  };
}, { address: walletAddress });

try {
  const authRequests = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/auth/nonce") || url.includes("/api/auth/verify")) {
      authRequests.push({ method: request.method(), url });
    }
  });

  const response = await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  assert(response?.ok(), `/ expected 2xx, got ${response?.status()}`);

  const connectButton = page.getByRole("button", { name: /connect|连接/i }).first();
  await connectButton.waitFor({ timeout: 10_000 });
  await connectButton.click();
  const connectedButton = page.getByRole("button", { name: new RegExp(shortAddress.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first();
  await connectedButton.waitFor({ timeout: 10_000 });

  const walletRequests = await page.evaluate(() => window.__fairMemeWalletRequests || []);
  assert(walletRequests.some((request) => request.method === "eth_requestAccounts"), "wallet connect did not request accounts");
  assert(walletRequests.some((request) => request.method === "personal_sign"), "wallet connect did not request personal_sign");
  assert(authRequests.some((request) => request.url.includes("/api/auth/nonce")), "wallet connect did not call auth nonce API");
  assert(authRequests.some((request) => request.url.includes("/api/auth/verify")), "wallet connect did not call auth verify API");

  await connectedButton.click();
  await page.getByRole("tab", { name: "我的收益" }).click();
  await page.getByText("这里读取后端真实佣金账本", { exact: false }).waitFor({ timeout: 10_000 });
  const body = await page.locator("body").innerText();
  assert(/真实佣金账本|暂无链上收益|账本读取失败/.test(body), "wallet earnings tab did not render ledger status");
  assert(!body.includes(["我的", "积分"].join("")), "wallet profile still contains legacy points tab text");
  assert(!body.includes(["points", "Data"].join("")), "wallet profile leaked legacy points data text");

  console.log("wallet production browser ok");
} finally {
  await browser.close();
}
