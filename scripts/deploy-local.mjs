import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Contract, ContractFactory, JsonRpcProvider, Wallet, ZeroAddress, formatEther, parseUnits, NonceManager } from "ethers";

const rpcUrl = "http://127.0.0.1:8545";
const hardhatPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const readArtifact = (name) => JSON.parse(readFileSync(`artifacts/contracts/${name}.sol/${name}.json`, "utf8"));

const provider = new JsonRpcProvider(rpcUrl);
const wallet = new Wallet(hardhatPrivateKey, provider);
const deployer = new NonceManager(wallet);
const deployerAddress = await deployer.getAddress();
const balance = await provider.getBalance(deployerAddress);

console.log(`Local deployer: ${deployerAddress}`);
console.log(`Balance: ${formatEther(balance)} ETH`);

const factoryArtifact = readArtifact("FairMemeFactoryV3");
const vaultArtifact = readArtifact("LpLockVaultV3");
const commissionArtifact = readArtifact("CommissionVault");

const fairMemeFactory = await new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, deployer).deploy(deployerAddress);
await fairMemeFactory.waitForDeployment();
const factoryAddress = await fairMemeFactory.getAddress();
console.log(`FairMemeFactoryV3: ${factoryAddress}`);

const lpLockVault = await new ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, deployer).deploy();
await lpLockVault.waitForDeployment();
const vaultAddress = await lpLockVault.getAddress();
console.log(`LpLockVaultV3: ${vaultAddress}`);

const commissionVault = await new ContractFactory(commissionArtifact.abi, commissionArtifact.bytecode, deployer).deploy(deployerAddress);
await commissionVault.waitForDeployment();
const commissionVaultAddress = await commissionVault.getAddress();
console.log(`CommissionVault: ${commissionVaultAddress}`);

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
nextEnv = upsert(nextEnv, "VITE_CHAIN_ID_HEX", "0x7a69");
nextEnv = upsert(nextEnv, "VITE_CHAIN_NAME", "Hardhat Local");
nextEnv = upsert(nextEnv, "VITE_NATIVE_NAME", "ETH");
nextEnv = upsert(nextEnv, "VITE_NATIVE_SYMBOL", "ETH");
nextEnv = upsert(nextEnv, "VITE_RPC_URL", rpcUrl);
nextEnv = upsert(nextEnv, "VITE_EXPLORER_URL", "http://127.0.0.1:8545");
nextEnv = upsert(nextEnv, "VITE_FACTORY_VERSION", "V3");
nextEnv = upsert(nextEnv, "VITE_FACTORY_ADDRESS", factoryAddress);
nextEnv = upsert(nextEnv, "VITE_LP_VAULT_ADDRESS", vaultAddress);
nextEnv = upsert(nextEnv, "VITE_COMMISSION_VAULT_ADDRESS", commissionVaultAddress);
nextEnv = upsert(nextEnv, "VITE_ROCKET_TOKEN_ADDRESS", rocketTokenAddress);
writeFileSync(envPath, `${nextEnv.trim()}\n`);

writeFileSync("contracts/deployments.local.json", JSON.stringify({
  chain: "hardhatLocal",
  rpcUrl,
  deployer: deployerAddress,
  version: "V3",
  factoryAddress,
  lpVaultAddress: vaultAddress,
  commissionVaultAddress,
  rocketTokenAddress,
  deployedAt: new Date().toISOString(),
}, null, 2));

console.log("Local deployment saved to .env.local and contracts/deployments.local.json");
