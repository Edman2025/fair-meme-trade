import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { Interface, JsonRpcProvider, formatUnits } from "ethers";

dotenv.config({ path: ".env.local" });

const deployment = JSON.parse(readFileSync("contracts/deployments.bsc-testnet.json", "utf8"));
const factoryArtifact = JSON.parse(readFileSync("artifacts/contracts/FairMemeFactoryV3.sol/FairMemeFactoryV3.json", "utf8"));
const provider = new JsonRpcProvider(process.env.VITE_RPC_URL || process.env.BSC_TESTNET_RPC_URL || deployment.rpcUrl);
const factoryInterface = new Interface(factoryArtifact.abi);
const latestBlock = await provider.getBlockNumber();
const fromBlock = Math.max(0, latestBlock - 10000);
const knownTxs = [];
const receiptLogs = (await Promise.all(knownTxs.map(async (txHash) => {
  const receipt = await provider.getTransactionReceipt(txHash);
  return receipt?.logs || [];
}))).flat();
let logs = receiptLogs.filter((log) => log.address.toLowerCase() === deployment.factoryAddress.toLowerCase());
if (logs.length === 0) {
  for (let block = fromBlock; block <= latestBlock; block += 200) {
    const toBlock = Math.min(block + 199, latestBlock);
    const chunk = await provider.getLogs({
      address: deployment.factoryAddress,
      fromBlock: block,
      toBlock,
    });
    logs.push(...chunk);
  }
}

const events = logs.flatMap((log) => {
  try {
    const parsed = factoryInterface.parseLog(log);
    if (!parsed) return [];
    return [{
      name: parsed.name,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      args: Object.fromEntries(parsed.fragment.inputs.map((input, index) => {
        const value = parsed.args[index];
        return [input.name, typeof value === "bigint" ? value.toString() : String(value)];
      })),
    }];
  } catch {
    return [];
  }
});

console.log(JSON.stringify({
  latestBlock,
  fromBlock,
  factoryAddress: deployment.factoryAddress,
  eventCount: events.length,
  events,
}, null, 2));
