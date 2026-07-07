import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { Contract, JsonRpcProvider, Wallet, ZeroAddress, parseUnits, NonceManager } from "ethers";

dotenv.config({ path: ".env.local" });

const deployment = JSON.parse(readFileSync("contracts/deployments.bsc-testnet.json", "utf8"));
const factoryArtifact = JSON.parse(readFileSync("artifacts/contracts/FairMemeFactoryV3.sol/FairMemeFactoryV3.json", "utf8"));
const rpcUrl = process.env.VITE_RPC_URL || process.env.BSC_TESTNET_RPC_URL || deployment.rpcUrl;
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("DEPLOYER_PRIVATE_KEY missing");
}

const provider = new JsonRpcProvider(rpcUrl);
const signer = new NonceManager(new Wallet(privateKey, provider));
const factory = new Contract(deployment.factoryAddress, factoryArtifact.abi, signer);

const suffix = Date.now().toString().slice(-5);
const createTx = await factory.createToken(
  `SmokeToken${suffix}`,
  `SMK${suffix}`,
  parseUnits("1000000", 18),
  `ipfs://fair-meme-trade/smoke-${suffix}`,
  ZeroAddress,
  Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
);
const createReceipt = await createTx.wait();
const tokenCreated = createReceipt.logs
  .map((log) => {
    try {
      return factory.interface.parseLog(log);
    } catch {
      return null;
    }
  })
  .find((event) => event?.name === "TokenCreated");

const projectId = tokenCreated.args.projectId;
const reviewReceipt = await (await factory.reviewProject(projectId, true, "smoke")).wait();
const launchReceipt = await (await factory.markLaunched(projectId)).wait();

console.log(`BSC Testnet create tx: ${createReceipt.hash}`);
console.log(`BSC Testnet review tx: ${reviewReceipt.hash}`);
console.log(`BSC Testnet launch tx: ${launchReceipt.hash}`);
console.log(`Factory: ${deployment.factoryAddress}`);
console.log(`Token: ${tokenCreated.args.token}`);
