import { existsSync, readFileSync, writeFileSync } from "node:fs";
import dotenv from "dotenv";
import { Contract, ContractFactory, JsonRpcProvider, Wallet, ZeroAddress, formatEther, parseUnits, NonceManager } from "ethers";

dotenv.config({ path: ".env.local" });

const rpcUrl = process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("DEPLOYER_PRIVATE_KEY missing. Run `npm run wallet:create` and fund the wallet with testnet tBNB.");
}

const readArtifact = (name) => JSON.parse(readFileSync(`artifacts/contracts/${name}.sol/${name}.json`, "utf8"));
const provider = new JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privateKey, provider);
const deployer = new NonceManager(wallet);
const deployerAddress = await deployer.getAddress();
const balance = await provider.getBalance(deployerAddress);

console.log(`Deployer: ${deployerAddress}`);
console.log(`Balance: ${formatEther(balance)} tBNB`);

if (balance === 0n) {
  throw new Error("Deployer has no testnet tBNB. Fund this address from a BSC Testnet faucet before deploying.");
}

const factoryArtifact = readArtifact("FairMemeFactory");
const vaultArtifact = readArtifact("LpLockVault");

const factoryFactory = new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, deployer);
const vaultFactory = new ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, deployer);

console.log("Deploying FairMemeFactory...");
const fairMemeFactory = await factoryFactory.deploy();
await fairMemeFactory.waitForDeployment();
const factoryAddress = await fairMemeFactory.getAddress();
console.log(`FairMemeFactory: ${factoryAddress}`);

console.log("Deploying LpLockVault...");
const lpLockVault = await vaultFactory.deploy();
await lpLockVault.waitForDeployment();
const vaultAddress = await lpLockVault.getAddress();
console.log(`LpLockVault: ${vaultAddress}`);

const factoryContract = new Contract(factoryAddress, factoryArtifact.abi, deployer);
const lpDeadline = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
const seedTx = await factoryContract.createToken(
  "RocketMoon",
  "ROCKET",
  parseUnits("1000000000", 18),
  "ipfs://fair-meme-trade/rocket",
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
console.log(`Seed ROCKET token: ${rocketTokenAddress}`);

const envPath = ".env.local";
const currentEnv = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const upsert = (source, key, value) => {
  const line = `${key}=${value}`;
  return source.includes(`${key}=`)
    ? source.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${source.trim()}\n${line}`;
};

let nextEnv = currentEnv;
nextEnv = upsert(nextEnv, "VITE_CHAIN_ID_HEX", "0x61");
nextEnv = upsert(nextEnv, "VITE_CHAIN_NAME", "BSC Testnet");
nextEnv = upsert(nextEnv, "VITE_NATIVE_NAME", "tBNB");
nextEnv = upsert(nextEnv, "VITE_NATIVE_SYMBOL", "tBNB");
nextEnv = upsert(nextEnv, "VITE_RPC_URL", rpcUrl);
nextEnv = upsert(nextEnv, "VITE_EXPLORER_URL", "https://testnet.bscscan.com");
nextEnv = upsert(nextEnv, "VITE_FACTORY_ADDRESS", factoryAddress);
nextEnv = upsert(nextEnv, "VITE_LP_VAULT_ADDRESS", vaultAddress);
nextEnv = upsert(nextEnv, "VITE_ROCKET_TOKEN_ADDRESS", rocketTokenAddress);
writeFileSync(envPath, `${nextEnv.trim()}\n`);

writeFileSync("contracts/deployments.bsc-testnet.json", JSON.stringify({
  chain: "bscTestnet",
  rpcUrl,
  deployer: deployerAddress,
  factoryAddress,
  lpVaultAddress: vaultAddress,
  rocketTokenAddress,
  deployedAt: new Date().toISOString(),
}, null, 2));

console.log("Deployment saved to .env.local and contracts/deployments.bsc-testnet.json");
