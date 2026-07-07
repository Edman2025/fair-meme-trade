import { ChainTransaction, IndexedEvent, Token } from "@/contexts/MvpContext";

export interface IndexerSnapshot {
  lastIndexedAt: string;
  tokenCount: number;
  transactionCount: number;
  eventCount: number;
  health: "ok" | "idle";
}

export const buildIndexerSnapshot = (
  tokens: Token[],
  chainTransactions: ChainTransaction[],
  indexedEvents: IndexedEvent[],
): IndexerSnapshot => ({
  lastIndexedAt: indexedEvents[0]?.createdAt || "尚未索引",
  tokenCount: tokens.length,
  transactionCount: chainTransactions.length,
  eventCount: indexedEvents.length,
  health: indexedEvents.length > 0 ? "ok" : "idle",
});

export const formatIndexerPayload = (event: IndexedEvent) => {
  const payload = event.payload ? JSON.stringify(event.payload) : "{}";
  return `${event.type}:${event.tokenSymbol || "platform"}:${payload}`;
};
