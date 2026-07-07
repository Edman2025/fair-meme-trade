import { readFileSync } from "node:fs";
import { Contract, JsonRpcProvider, Wallet, ZeroAddress, parseUnits, NonceManager } from "ethers";

const deployment = JSON.parse(readFileSync("contracts/deployments.local.json", "utf8"));
const factoryArtifact = JSON.parse(readFileSync("artifacts/contracts/FairMemeFactoryV3.sol/FairMemeFactoryV3.json", "utf8"));
const provider = new JsonRpcProvider(deployment.rpcUrl);
const wallet = new NonceManager(new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", provider));
const factory = new Contract(deployment.factoryAddress, factoryArtifact.abi, wallet);

const createTx = await factory.createToken(
  "SmokeLocal",
  "SML",
  parseUnits("1000000", 18),
  "ipfs://fair-meme-trade/smoke-local",
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
const reviewReceipt = await (await factory.reviewProject(projectId, true, "local smoke")).wait();
const launchReceipt = await (await factory.markLaunched(projectId)).wait();

console.log(`Create tx: ${createReceipt.hash}`);
console.log(`Review tx: ${reviewReceipt.hash}`);
console.log(`Launch tx: ${launchReceipt.hash}`);
console.log(`Factory: ${deployment.factoryAddress}`);
console.log(`Token: ${tokenCreated.args.token}`);
