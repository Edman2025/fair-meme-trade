import { Interface, JsonRpcProvider, formatUnits } from "ethers";
import { IndexedEvent } from "@/contexts/MvpContext";
import { BSC_KNOWN_FACTORY_TXS } from "@/lib/bscKnownTransactions";
import { bscTestnetConfig } from "@/lib/chainConfig";
import { getFactoryAbi } from "@/lib/contractAbi";

export interface ChainIndexerResult {
  events: IndexedEvent[];
  latestBlock: number;
  source: "chain";
}

const factoryInterface = new Interface(getFactoryAbi(bscTestnetConfig.factoryVersion));

const toNumber = (value: bigint) => Number(value.toString());

export const fetchFactoryIndexedEvents = async (fromBlock?: number): Promise<ChainIndexerResult> => {
  if (!bscTestnetConfig.factoryAddress) {
    throw new Error("Factory address is not configured");
  }

  const provider = new JsonRpcProvider(bscTestnetConfig.rpcUrls[0]);
  const latestBlock = await provider.getBlockNumber();
  const startBlock = fromBlock ?? Math.max(0, latestBlock - 10000);
  const receiptLogs = (await Promise.all(BSC_KNOWN_FACTORY_TXS.map(async (txHash) => {
    const receipt = await provider.getTransactionReceipt(txHash);
    return receipt?.logs || [];
  }))).flat();

  let logs = receiptLogs.filter((log) => log.address.toLowerCase() === bscTestnetConfig.factoryAddress!.toLowerCase());
  if (logs.length === 0) {
    for (let block = startBlock; block <= latestBlock; block += 200) {
      const toBlock = Math.min(block + 199, latestBlock);
      const chunk = await provider.getLogs({
        address: bscTestnetConfig.factoryAddress,
        fromBlock: block,
        toBlock,
      });
      logs = [...logs, ...chunk];
    }
  }

  const events = logs.flatMap<IndexedEvent>((log) => {
    try {
      const parsed = factoryInterface.parseLog(log);
      if (!parsed) return [];

      const createdAt = `Block ${log.blockNumber}`;
      const base = {
        id: `chain-${log.transactionHash}-${log.index}`,
        txHash: log.transactionHash,
        createdAt,
      };

      if (parsed.name === "TokenCreated") {
        return [{
          ...base,
          type: "TokenCreated",
          tokenSymbol: String(parsed.args.symbol),
          walletAddress: String(parsed.args.creator),
          payload: {
            projectId: toNumber(parsed.args.projectId),
            token: String(parsed.args.token),
          name: String(parsed.args.name),
          metadataURI: String(parsed.args.metadataURI),
          totalSupply: String(parsed.args.totalSupply),
          lpDeadline: Number(parsed.args.lpDeadline),
          blockNumber: log.blockNumber,
          },
        }];
      }

      if (parsed.name === "TradeRecorded") {
        return [{
          ...base,
          type: "TradeRecorded",
          tokenSymbol: String(parsed.args.token),
          walletAddress: String(parsed.args.trader),
          payload: {
            side: parsed.args.isBuy ? "buy" : "sell",
            amountIn: formatUnits(parsed.args.amountIn, 18),
            amountOut: formatUnits(parsed.args.amountOut, 18),
            blockNumber: log.blockNumber,
          },
        }];
      }

      if (parsed.name === "LpAdded") {
        return [{
          ...base,
          type: "LpAdded",
          tokenSymbol: String(parsed.args.token),
          walletAddress: String(parsed.args.provider),
          payload: {
            amount: formatUnits(parsed.args.amount, 18),
            pairToken: String(parsed.args.pairToken),
            blockNumber: log.blockNumber,
          },
        }];
      }

      if (parsed.name === "ProjectReviewed") {
        return [{
          ...base,
          type: "ProjectReviewed",
          walletAddress: String(parsed.args.reviewer),
          payload: {
            projectId: toNumber(parsed.args.projectId),
            status: toNumber(parsed.args.status),
            note: String(parsed.args.note || ""),
            blockNumber: log.blockNumber,
          },
        }];
      }

      return [];
    } catch {
      return [];
    }
  });

  return {
    events,
    latestBlock,
    source: "chain",
  };
};
