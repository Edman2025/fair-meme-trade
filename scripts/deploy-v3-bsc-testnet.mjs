import { existsSync, readFileSync, writeFileSync } from "node:fs";
import dotenv from "dotenv";
import { Contract, ContractFactory, JsonRpcProvider, Wallet, ZeroAddress, formatEther, parseUnits, NonceManager } from "ethers";

dotenv.config({ path: ".env.local" });

const rpcUrl = process.env.VITE_RPC_URL || process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-rpc.publicnode.com";
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const adminWallet = process.env.ADMIN_WALLET || process.env.DEPLOYER_ADDRESS;

if (!privateKey || !adminWallet) {
  throw new Error("DEPLOYER_PRIVATE_KEY and ADMIN_WALLET/DEPLOYER_ADDRESS are required");
}

const readArtifact = (name) => JSON.parse(readFileSync(`artifacts/contracts/${name}.sol/${name}.json`, "utf8"));
const provider = new JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privateKey, provider);
const deployer = new NonceManager(wallet);
const deployerAddress = await deployer.getAddress();
const balance = await provider.getBalance(deployerAddress);

console.log(`Deployer: ${deployerAddress}`);
console.log(`Balance: ${formatEther(balance)} tBNB`);

const factoryArtifact = readArtifact("FairMemeFactoryV3");
const vaultArtifact = readArtifact("LpLockVaultV3");
const commissionArtifact = readArtifact("CommissionVault");

const factory = await new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, deployer).deploy(adminWallet);
await factory.waitForDeployment();
const factoryAddress = await factory.getAddress();
console.log(`FairMemeFactoryV3: ${factoryAddress}`);

const lpVault = await new ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, deployer).deploy();
await lpVault.waitForDeployment();
const lpVaultAddress = await lpVault.getAddress();
console.log(`LpLockVaultV3: ${lpVaultAddress}`);

const commissionVault = await new ContractFactory(commissionArtifact.abi, commissionArtifact.bytecode, deployer).deploy(adminWallet);
await commissionVault.waitForDeployment();
const commissionVaultAddress = await commissionVault.getAddress();
console.log(`CommissionVault: ${commissionVaultAddress}`);

const factoryContract = new Contract(factoryAddress, factoryArtifact.abi, deployer);
const lpDeadline = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
const seedTx = await factoryContract.createToken(
  "RocketMoon",
  "ROCKET",
  parseUnits("1000000000", 18),
  "ipfs://fair-meme-trade/rocket-v3",
  ZeroAddress,
  lpDeadline,
);
const seedReceipt = await seedTx.wait();
const tokenCreated = seedReceipt.logs
  .map((log) => {
    try {
      return factoryContract.interface.parseLog(log);
    } catch {
      return null;
    }
  })
  .find((event) => event?.name === "TokenCreated");
const rocketTokenAddress = tokenCreated?.args?.token;
const rocketProjectId = tokenCreated?.args?.projectId?.toString();
console.log(`Seed ROCKET V3 token: ${rocketTokenAddress}`);

const upsert = (source, key, value) => {
  const line = `${key}=${value}`;
  return source.includes(`${key}=`)
    ? source.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${source.trim()}\n${line}`;
};

const envPath = ".env.local";
let nextEnv = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
nextEnv = upsert(nextEnv, "ADMIN_WALLET", adminWallet);
nextEnv = upsert(nextEnv, "VITE_CHAIN_ID_HEX", "0x61");
nextEnv = upsert(nextEnv, "VITE_CHAIN_NAME", "BSC Testnet");
nextEnv = upsert(nextEnv, "VITE_NATIVE_NAME", "tBNB");
nextEnv = upsert(nextEnv, "VITE_NATIVE_SYMBOL", "tBNB");
nextEnv = upsert(nextEnv, "VITE_RPC_URL", rpcUrl);
nextEnv = upsert(nextEnv, "VITE_EXPLORER_URL", "https://testnet.bscscan.com");
nextEnv = upsert(nextEnv, "VITE_FACTORY_VERSION", "V3");
nextEnv = upsert(nextEnv, "VITE_FACTORY_ADDRESS", factoryAddress);
nextEnv = upsert(nextEnv, "VITE_LP_VAULT_ADDRESS", lpVaultAddress);
nextEnv = upsert(nextEnv, "VITE_COMMISSION_VAULT_ADDRESS", commissionVaultAddress);
nextEnv = upsert(nextEnv, "VITE_ROCKET_TOKEN_ADDRESS", rocketTokenAddress);
writeFileSync(envPath, `${nextEnv.trim()}\n`);

const deployment = {
  chain: "bscTestnet",
  version: "V3",
  rpcUrl,
  deployer: deployerAddress,
  adminWallet,
  factoryAddress,
  lpVaultAddress,
  commissionVaultAddress,
  rocketTokenAddress,
  rocketProjectId,
  deployedAt: new Date().toISOString(),
};

writeFileSync("contracts/deployments.bsc-testnet.v3.json", JSON.stringify(deployment, null, 2));
writeFileSync("contracts/deployments.bsc-testnet.json", JSON.stringify(deployment, null, 2));

console.log("V3 deployment saved to .env.local and contracts/deployments.bsc-testnet*.json");
