import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const forbidden = [
  "CreateTokenDialog",
  "Simulate token creation",
  "Token Created Successfully",
  "MVP 提现记录",
  "+MVP",
  "-MVP",
  ["我的", "积分"].join(""),
  ["points", "Data"].join(""),
  ["CONTRACT", "EVENT", "TOPICS"].join("_"),
  ["后端", "提现", "审核队列"].join(""),
  ["已进入", "后端", "提现"].join(""),
  "FireCoin",
  "DiamondHands",
  "MoonShot",
  "StarToken",
  "BullsEye",
  "GMGN",
  "BONUS",
];

export const scanDistPlaceholders = (dir = "dist") => {
  if (!existsSync(dir)) {
    throw new Error(`${dir} does not exist; run npm run build first`);
  }
  const hits = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(html|js|css|json|txt)$/.test(entry.name)) continue;
      const body = readFileSync(path, "utf8");
      for (const needle of forbidden) {
        if (body.includes(needle)) hits.push(`${path}: ${needle}`);
      }
    }
  };
  walk(dir);
  return hits;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const targetDir = process.argv[2] || "dist";
  const hits = scanDistPlaceholders(targetDir);
  if (hits.length > 0) {
    throw new Error(`${targetDir} contains forbidden production placeholders:\n${hits.join("\n")}`);
  }
  console.log("dist placeholder scan ok");
}
