import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

if (!process.env.BSCSCAN_API_KEY) {
  console.log("BSCSCAN_API_KEY is not set; skipping BscScan verification.");
  process.exit(0);
}

const path = "contracts/deployments.bsc-testnet.json";
if (!existsSync(path)) {
  throw new Error(`${path} not found`);
}

const deployment = JSON.parse(readFileSync(path, "utf8"));
const contracts = [
  ["contracts/FairMemeFactoryV3.sol:FairMemeFactoryV3", deployment.factoryAddress, deployment.adminWallet],
  ["contracts/LpLockVaultV3.sol:LpLockVaultV3", deployment.lpVaultAddress],
  ["contracts/CommissionVault.sol:CommissionVault", deployment.commissionVaultAddress, deployment.adminWallet],
];

for (const [contract, address, ...args] of contracts) {
  if (!address) continue;
  const result = spawnSync("npx", [
    "hardhat",
    "verify",
    "--network",
    "bscTestnet",
    "--contract",
    contract,
    address,
    ...args,
  ], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
