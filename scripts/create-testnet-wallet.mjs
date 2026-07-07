import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Wallet } from "ethers";

const envPath = ".env.local";
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

if (existing.includes("DEPLOYER_PRIVATE_KEY=")) {
  const address = existing.match(/DEPLOYER_ADDRESS=(.+)/)?.[1]?.trim();
  console.log(`Existing deployer wallet found${address ? `: ${address}` : ""}`);
  process.exit(0);
}

const wallet = Wallet.createRandom();
const nextEnv = [
  existing.trim(),
  "",
  `DEPLOYER_PRIVATE_KEY=${wallet.privateKey}`,
  `DEPLOYER_ADDRESS=${wallet.address}`,
  "VITE_CHAIN_ID_HEX=0x61",
  "VITE_CHAIN_NAME=BSC Testnet",
  "VITE_NATIVE_NAME=tBNB",
  "VITE_NATIVE_SYMBOL=tBNB",
  "VITE_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545",
  "VITE_EXPLORER_URL=https://testnet.bscscan.com",
  "VITE_FACTORY_ADDRESS=",
  "VITE_LP_VAULT_ADDRESS=",
  "",
].filter(Boolean).join("\n");

writeFileSync(envPath, `${nextEnv}\n`);

console.log("Created testnet deployer wallet.");
console.log(`Address: ${wallet.address}`);
console.log("Private key was written to .env.local, which is gitignored.");
