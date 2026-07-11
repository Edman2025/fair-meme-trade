import { Interface, JsonRpcProvider, WebSocketProvider, formatUnits } from "ethers";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { chainTransactions, commissions, indexedEvents, indexerState, lpPositions, reviewQueue, tokens, withdrawals } from "../db/schema";
import { env } from "../env";

const FACTORY_ABI = [
  "event TokenCreated(uint256 indexed projectId,address indexed token,address indexed creator,string name,string symbol,string metadataURI,address pairToken,uint256 totalSupply,uint256 lpDeadline)",
  "event ProjectReviewed(uint256 indexed projectId,address indexed reviewer,uint8 status,string note)",
  "event ProjectLaunched(uint256 indexed projectId,address indexed reviewer)",
  "event TradeRecorded(address indexed token,address indexed trader,bool isBuy,uint256 amountIn,uint256 amountOut,uint256 feeAmount)",
  "event LpAdded(address indexed token,address indexed provider,uint256 amount,address pairToken)",
];

const VAULT_ABI = [
  "event LpLocked(uint256 indexed positionId,address indexed owner,address indexed lpToken,address projectToken,uint256 amount,uint256 unlockAt,uint8 releaseType,uint256 releaseStart,uint256 releaseEnd)",
  "event LpWithdrawn(uint256 indexed positionId,address indexed owner,address indexed lpToken,uint256 amount)",
];

const COMMISSION_ABI = [
  "event CommissionDeposited(address indexed wallet,address indexed token,uint256 amount,string source)",
  "event WithdrawalRequested(uint256 indexed withdrawalId,address indexed requester,address indexed token,uint256 amount)",
  "event WithdrawalReviewed(uint256 indexed withdrawalId,address indexed reviewer,bool approved)",
  "event WithdrawalPaid(uint256 indexed withdrawalId,address indexed requester,address indexed token,uint256 amount)",
];

const interfaces = {
  [env.factoryAddress.toLowerCase()]: new Interface(FACTORY_ABI),
  [env.lpVaultAddress.toLowerCase()]: new Interface(VAULT_ABI),
  [env.commissionVaultAddress.toLowerCase()]: new Interface(COMMISSION_ABI),
};

const provider = new JsonRpcProvider(env.rpcUrl, undefined, { batchMaxCount: 1 });
const wsProvider = env.indexerWsUrl ? new WebSocketProvider(env.indexerWsUrl) : null;
const windowSize = env.indexerWindowSize;
const publicRpcBackfillBlocks = env.indexerPublicRpcBackfillBlocks;
const receiptFallbackBlocks = env.indexerReceiptFallbackBlocks;
const indexedContractAddresses = [env.factoryAddress, env.lpVaultAddress, env.commissionVaultAddress]
  .filter(Boolean)
  .map((address) => address.toLowerCase());

type IndexerLog = {
  address: string;
  transactionHash: string;
  index: number;
  blockNumber: number;
  topics: readonly string[];
  data: string;
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error || "Unknown indexer error");

const isArchiveLimitError = (message: string) => /archive requests require|missing trie node|history has been pruned|requested block.+older than/i.test(message);

const getRecoverableStartBlock = (latestBlock: number) => Math.max(0, latestBlock - publicRpcBackfillBlocks);

const canUseReceiptFallback = (message: string) => /archive requests require|limit exceeded|too many results|query returned more than/i.test(message);

const toHexBlock = (blockNumber: number) => `0x${blockNumber.toString(16)}`;

const normalizeRawLog = (raw: {
  address: string;
  transactionHash: string;
  logIndex?: string;
  index?: string | number;
  blockNumber: string | number;
  topics: string[];
  data: string;
}): IndexerLog => ({
  address: raw.address,
  transactionHash: raw.transactionHash,
  index: typeof raw.index === "number" ? raw.index : Number(raw.index ?? raw.logIndex),
  blockNumber: typeof raw.blockNumber === "number" ? raw.blockNumber : Number(raw.blockNumber),
  topics: raw.topics,
  data: raw.data,
});

const getBlockReceiptLogs = async (blockNumber: number, cache: Map<number, Promise<IndexerLog[]>>) => {
  if (!cache.has(blockNumber)) {
    cache.set(blockNumber, (async () => {
      try {
        const receipts = await provider.send("eth_getBlockReceipts", [toHexBlock(blockNumber)]) as Array<{ logs?: Parameters<typeof normalizeRawLog>[0][] }> | null;
        if (Array.isArray(receipts)) {
          return receipts.flatMap((receipt) => (receipt.logs || []).map(normalizeRawLog));
        }
      } catch {
        // Some RPC providers do not expose eth_getBlockReceipts; use the portable path below.
      }

      const block = await provider.getBlock(blockNumber);
      if (!block) return [];
      const logs: IndexerLog[] = [];
      for (const txHash of block.transactions) {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) continue;
        for (const log of receipt.logs) {
          logs.push({
            address: log.address,
            transactionHash: log.transactionHash,
            index: log.index,
            blockNumber: log.blockNumber,
            topics: log.topics,
            data: log.data,
          });
        }
      }
      return logs;
    })());
  }
  return cache.get(blockNumber)!;
};

const indexViaReceipts = async (address: string, fromBlock: number, toBlock: number, cache: Map<number, Promise<IndexerLog[]>>) => {
  const target = address.toLowerCase();
  for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber += 1) {
    const logs = await getBlockReceiptLogs(blockNumber, cache);
    for (const log of logs) {
      if (log.address.toLowerCase() === target) {
        await handleLog(log);
      }
    }
  }
};

const getState = async (contractAddress: string, latestBlock: number) => {
  const [state] = await db.select().from(indexerState).where(eq(indexerState.contractAddress, contractAddress)).limit(1);
  if (state) return state;
  const [created] = await db.insert(indexerState).values({
    contractAddress,
    lastIndexedBlock: Math.max(0, latestBlock - 1000),
    latestSeenBlock: latestBlock,
  }).returning();
  return created;
};

const updateIndexedBlock = async (contractAddress: string, blockNumber: number, lastError: string | null = null) => {
  await getState(contractAddress, blockNumber);
  await db.update(indexerState).set({
    lastIndexedBlock: blockNumber,
    latestSeenBlock: blockNumber,
    failureCount: 0,
    lastError,
    updatedAt: new Date(),
  }).where(eq(indexerState.contractAddress, contractAddress));
};

const handleLog = async (log: IndexerLog) => {
  const parser = interfaces[log.address.toLowerCase()];
  if (!parser) return;
  const parsed = parser.parseLog(log);
  if (!parsed) return;

  const eventId = `${log.transactionHash}-${log.index}`;
  const payload = Object.fromEntries(parsed.fragment.inputs.map((input, index) => {
    const value = parsed.args[index];
    return [input.name, typeof value === "bigint" ? value.toString() : String(value)];
  }));

  const [insertedEvent] = await db.insert(indexedEvents).values({
    eventId,
    eventName: parsed.name,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.index,
    tokenAddress: "token" in payload ? String(payload.token) : "projectToken" in payload ? String(payload.projectToken) : "lpToken" in payload ? String(payload.lpToken) : undefined,
    walletAddress: "creator" in payload ? String(payload.creator).toLowerCase() : "reviewer" in payload ? String(payload.reviewer).toLowerCase() : "trader" in payload ? String(payload.trader).toLowerCase() : "owner" in payload ? String(payload.owner).toLowerCase() : undefined,
    payload,
  }).onConflictDoNothing().returning();

  await db.update(chainTransactions).set({
    status: "confirmed",
    updatedAt: new Date(),
  }).where(eq(chainTransactions.txHash, log.transactionHash));

  if (!insertedEvent) return;

  if (parsed.name === "TokenCreated") {
    const projectId = Number(payload.projectId);
    const symbol = String(payload.symbol).toUpperCase();
    let priorityBuy: { amount?: string; currency?: string } = {};
    try {
      const metadata = JSON.parse(String(payload.metadataURI)) as { priorityBuy?: { amount?: string; currency?: string } };
      priorityBuy = metadata.priorityBuy || {};
    } catch {
      // Legacy metadata can be an IPFS URI and has no embedded priority-buy setting.
    }
    const priorityBuyAmount = priorityBuy.amount && Number(priorityBuy.amount) > 0 ? priorityBuy.amount : null;
    const priorityBuyCurrency = priorityBuyAmount && ["USDT", "BNB"].includes(priorityBuy.currency || "") ? priorityBuy.currency : null;
    await db.insert(tokens).values({
      symbol,
      name: String(payload.name),
      tokenAddress: String(payload.token),
      creatorAddress: String(payload.creator).toLowerCase(),
      metadataUri: String(payload.metadataURI),
      pairToken: String(payload.pairToken),
      projectId,
      priorityBuyAmount,
      priorityBuyCurrency,
      status: "launched",
    }).onConflictDoUpdate({
      target: tokens.symbol,
      set: {
        name: String(payload.name),
        tokenAddress: String(payload.token),
        creatorAddress: String(payload.creator).toLowerCase(),
        metadataUri: String(payload.metadataURI),
        pairToken: String(payload.pairToken),
        projectId,
        priorityBuyAmount,
        priorityBuyCurrency,
        status: "launched",
      },
    });
  }

  if (parsed.name === "ProjectReviewed") {
    const status = Number(payload.status) === 1 ? "pending" : "rejected";
    await db.update(tokens).set({ status }).where(eq(tokens.projectId, Number(payload.projectId)));
    await db.update(reviewQueue).set({ status: status === "pending" ? "approved" : "rejected" }).where(eq(reviewQueue.txHash, log.transactionHash));
  }

  if (parsed.name === "ProjectLaunched") {
    await db.update(tokens).set({ status: "launched" }).where(eq(tokens.projectId, Number(payload.projectId)));
  }

  if (parsed.name === "LpLocked") {
    await db.insert(lpPositions).values({
      positionId: Number(payload.positionId),
      ownerAddress: String(payload.owner).toLowerCase(),
      lpTokenAddress: String(payload.lpToken),
      tokenAddress: String(payload.projectToken),
      amount: formatUnits(BigInt(String(payload.amount)), 18),
      unlockAt: new Date(Number(payload.unlockAt) * 1000),
      releaseType: Number(payload.releaseType || 0) === 1 ? "linear" : "once",
      releaseStart: payload.releaseStart ? new Date(Number(payload.releaseStart) * 1000) : undefined,
      releaseEnd: payload.releaseEnd ? new Date(Number(payload.releaseEnd) * 1000) : undefined,
    }).onConflictDoUpdate({
      target: lpPositions.positionId,
      set: {
        ownerAddress: String(payload.owner).toLowerCase(),
        lpTokenAddress: String(payload.lpToken),
        tokenAddress: String(payload.projectToken),
        amount: formatUnits(BigInt(String(payload.amount)), 18),
        unlockAt: new Date(Number(payload.unlockAt) * 1000),
        releaseType: Number(payload.releaseType || 0) === 1 ? "linear" : "once",
        releaseStart: payload.releaseStart ? new Date(Number(payload.releaseStart) * 1000) : undefined,
        releaseEnd: payload.releaseEnd ? new Date(Number(payload.releaseEnd) * 1000) : undefined,
      },
    });
  }

  if (parsed.name === "LpWithdrawn") {
    await db.update(lpPositions).set({
      withdrawn: sql`${lpPositions.withdrawn} + ${formatUnits(BigInt(String(payload.amount)), 18)}`,
    }).where(eq(lpPositions.positionId, Number(payload.positionId)));
  }

  if (parsed.name === "CommissionDeposited") {
    await db.insert(commissions).values({
      walletAddress: String(payload.wallet).toLowerCase(),
      tokenAddress: String(payload.token),
      amount: formatUnits(BigInt(String(payload.amount)), 18),
      source: String(payload.source),
    });
  }

  if (parsed.name === "WithdrawalRequested") {
    const [withdrawal] = await db.insert(withdrawals).values({
      chainWithdrawalId: Number(payload.withdrawalId),
      walletAddress: String(payload.requester).toLowerCase(),
      tokenAddress: String(payload.token),
      amount: formatUnits(BigInt(String(payload.amount)), 18),
      status: "pending",
    }).onConflictDoUpdate({
      target: withdrawals.chainWithdrawalId,
      set: {
        walletAddress: String(payload.requester).toLowerCase(),
        tokenAddress: String(payload.token),
        amount: formatUnits(BigInt(String(payload.amount)), 18),
        status: "pending",
      },
    }).returning();
    if (withdrawal) {
      await db.insert(reviewQueue).values({
        type: "withdrawal",
        targetId: String(withdrawal.id),
        title: `提现申请: ${formatUnits(BigInt(String(payload.amount)), 18)}`,
      });
    }
  }

  if (parsed.name === "WithdrawalReviewed") {
    const status = String(payload.approved) === "true" ? "approved" : "rejected";
    await db.update(withdrawals).set({ status, reviewedAt: new Date() }).where(eq(withdrawals.chainWithdrawalId, Number(payload.withdrawalId)));
    await db.update(reviewQueue).set({ status }).where(eq(reviewQueue.txHash, log.transactionHash));
  }

  if (parsed.name === "WithdrawalPaid") {
    await db.update(withdrawals).set({
      status: "completed",
      txHash: log.transactionHash,
    }).where(eq(withdrawals.chainWithdrawalId, Number(payload.withdrawalId)));
  }
};

export const runIndexerOnce = async () => {
  const latestBlock = await provider.getBlockNumber();
  const addresses = indexedContractAddresses;
  const receiptLogCache = new Map<number, Promise<IndexerLog[]>>();
  for (const address of addresses) {
    const state = await getState(address, latestBlock);
    const fromBlock = Math.min(state.lastIndexedBlock + 1, latestBlock);
    const toBlock = Math.min(fromBlock + windowSize, latestBlock);
    try {
      const logs = await provider.getLogs({ address, fromBlock, toBlock });
      for (const log of logs) {
        await handleLog(log);
      }
      await db.update(indexerState).set({
        lastIndexedBlock: toBlock,
        latestSeenBlock: latestBlock,
        failureCount: 0,
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(indexerState.contractAddress, address));
    } catch (error) {
      const message = getErrorMessage(error);
      const recoverableStartBlock = getRecoverableStartBlock(latestBlock);
      if (isArchiveLimitError(message) && latestBlock - state.lastIndexedBlock > publicRpcBackfillBlocks * 2) {
        await db.update(indexerState).set({
          lastIndexedBlock: recoverableStartBlock,
          latestSeenBlock: latestBlock,
          failureCount: 0,
          lastError: `Recovered from non-archive RPC limit: skipped to block ${recoverableStartBlock}. Previous error: ${message.slice(0, 800)}`,
          updatedAt: new Date(),
        }).where(eq(indexerState.contractAddress, address));
        continue;
      }
      if (canUseReceiptFallback(message)) {
        try {
          const fallbackToBlock = Math.min(fromBlock + receiptFallbackBlocks - 1, latestBlock);
          await indexViaReceipts(address, fromBlock, fallbackToBlock, receiptLogCache);
          await db.update(indexerState).set({
            lastIndexedBlock: fallbackToBlock,
            latestSeenBlock: latestBlock,
            failureCount: 0,
            lastError: `eth_getLogs unavailable; indexed blocks ${fromBlock}-${fallbackToBlock} via transaction receipts. Previous error: ${message.slice(0, 700)}`,
            updatedAt: new Date(),
          }).where(eq(indexerState.contractAddress, address));
          continue;
        } catch (fallbackError) {
          await db.update(indexerState).set({
            latestSeenBlock: latestBlock,
            failureCount: state.failureCount + 1,
            lastError: `Receipt fallback failed: ${getErrorMessage(fallbackError).slice(0, 800)}. Original error: ${message.slice(0, 160)}`,
            updatedAt: new Date(),
          }).where(eq(indexerState.contractAddress, address));
          continue;
        }
      }
      await db.update(indexerState).set({
        latestSeenBlock: latestBlock,
        failureCount: state.failureCount + 1,
        lastError: message.slice(0, 1000),
        updatedAt: new Date(),
      }).where(eq(indexerState.contractAddress, address));
    }
  }
};

export const runWebsocketIndexer = async () => {
  if (!wsProvider) throw new Error("INDEXER_WS_URL is not configured");
  const latestBlock = await wsProvider.getBlockNumber();
  const addresses = indexedContractAddresses;

  await Promise.all(addresses.map((address) => updateIndexedBlock(address, latestBlock, "WebSocket realtime indexer initialized")));

  for (const address of addresses) {
    await wsProvider.on({ address }, async (log) => {
      try {
        await handleLog({
          address: log.address,
          transactionHash: log.transactionHash,
          index: log.index,
          blockNumber: log.blockNumber,
          topics: log.topics,
          data: log.data,
        });
        await updateIndexedBlock(address, log.blockNumber);
      } catch (error) {
        await db.update(indexerState).set({
          failureCount: sql`${indexerState.failureCount} + 1`,
          lastError: getErrorMessage(error).slice(0, 1000),
          updatedAt: new Date(),
        }).where(eq(indexerState.contractAddress, address));
      }
    });
  }

  await wsProvider.on("block", async (blockNumber) => {
    await Promise.all(addresses.map((address) => updateIndexedBlock(address, blockNumber)));
  });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  if (env.indexerWsUrl) {
    await runWebsocketIndexer();
    await new Promise(() => undefined);
  } else {
    const loop = async () => {
      try {
        await runIndexerOnce();
      } catch (error) {
        console.error("indexer loop failed", error);
      }
      setTimeout(loop, 8000);
    };
    await loop();
  }
}
