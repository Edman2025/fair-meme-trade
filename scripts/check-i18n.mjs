import { readFileSync } from "node:fs";

const source = readFileSync("src/contexts/LanguageContext.tsx", "utf8");
const usedKeys = new Set(
  Array.from(readFileSync("src/contexts/LanguageContext.tsx", "utf8").matchAll(/(?<![A-Za-z0-9_$])t\(["']([^"']+)["']\)/g), (match) => match[1]),
);

const collectUsedKeys = (path) => {
  const body = readFileSync(path, "utf8");
  for (const match of body.matchAll(/(?<![A-Za-z0-9_$])t\(["']([^"']+)["']\)/g)) {
    usedKeys.add(match[1]);
  }
};

const walk = async (dir) => {
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      await walk(path);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) collectUsedKeys(path);
  }
};

const objectBlock = (label) => {
  const start = source.indexOf(label);
  if (start < 0) throw new Error(`Missing translation block ${label}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Unclosed translation block ${label}`);
};

const keysFor = (label) => new Set(
  Array.from(objectBlock(label).matchAll(/^\s*([A-Za-z0-9_]+):/gm), (match) => match[1]),
);

await walk("src");

const languages = {
  EN: keysFor("EN:"),
  "zh-CN": keysFor('"zh-CN":'),
  "繁体": keysFor("繁体:"),
  "日本語": keysFor("日本語:"),
};

const errors = [];
for (const key of usedKeys) {
  if (!languages.EN.has(key)) errors.push(`EN is missing used key: ${key}`);
}

for (const [language, keys] of Object.entries(languages)) {
  if (language === "EN") continue;
  for (const key of languages.EN) {
    if (!keys.has(key)) errors.push(`${language} is missing key: ${key}`);
  }
  for (const key of keys) {
    if (!languages.EN.has(key)) errors.push(`${language} has extra key not in EN: ${key}`);
  }
}

if (errors.length > 0) {
  throw new Error(`i18n check failed:\n${errors.join("\n")}`);
}

console.log(`i18n check ok (${languages.EN.size} keys, ${usedKeys.size} used keys)`);
