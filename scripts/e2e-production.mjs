import { chromium } from "playwright";

const baseUrl = (process.env.PROD_BASE_URL || "https://english.xunlian.co").replace(/\/$/, "");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const forbiddenText = [
  "CreateTokenDialog",
  "Simulate token creation",
  "Token Created Successfully",
  ["我的", "积分"].join(""),
  ["后端", "提现", "审核队列"].join(""),
  "FireCoin",
  "DiamondHands",
  "MoonShot",
  "StarToken",
  "BullsEye",
  "GMGN",
  "BONUS",
];

const requiredPages = [
  { path: "/", text: "MemeLaunch" },
  { path: "/admin", text: "后台" },
  { path: "/token/ROCKET", text: "ROCKET" },
  { path: "/lp-launch/ROCKET", text: "ROCKET" },
  { path: "/my-lp", text: "LP" },
  { path: "/nodes", text: "节点" },
  { path: "/api-docs", text: "API" },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

try {
  for (const { path, text } of requiredPages) {
    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    assert(response?.ok(), `${path} expected 2xx, got ${response?.status()}`);
    await page.locator("body").waitFor({ state: "visible", timeout: 10_000 });
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 20_000 });
    const body = await page.locator("body").innerText();
    assert(body.includes(text), `${path} missing expected text: ${text}`);
    for (const forbidden of forbiddenText) {
      assert(!body.includes(forbidden), `${path} contains forbidden placeholder text: ${forbidden}`);
    }
    console.log(`${path} browser ok`);
  }

  await page.goto(`${baseUrl}/api-docs`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: /EN|zh-CN|繁体|日本語/ }).click();
  await page.getByRole("menuitem", { name: "简体中文" }).click();
  await page.getByRole("tab", { name: "接口文档" }).click();
  await page.getByRole("heading", { name: "API 接口文档" }).waitFor({ timeout: 10_000 });
  await page.getByText("真实 API 端点", { exact: false }).waitFor({ timeout: 10_000 });
  console.log("api docs zh-CN browser ok");
} finally {
  await browser.close();
}
