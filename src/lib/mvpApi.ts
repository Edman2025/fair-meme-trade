import type {
  ApiKey,
  AdminReviewItem,
  ChainTransaction,
  IndexedEvent,
  LpPosition,
  MarketCandle,
  NodeApplication,
  OrderBookSnapshot,
  Token,
  TradeRecord,
  WalletBalance,
  WithdrawalRecord,
  WalletSignatureRecord,
} from "@/contexts/MvpContext";

export interface MvpApiSnapshot {
  tokens: Token[];
  walletBalances: WalletBalance[];
  trades: TradeRecord[];
  lpPositions: LpPosition[];
  apiKeys: ApiKey[];
  nodeApplications: NodeApplication[];
  withdrawalRecords: WithdrawalRecord[];
  walletSignatures: WalletSignatureRecord[];
  chainTransactions: ChainTransaction[];
  indexedEvents: IndexedEvent[];
  adminQueue: AdminReviewItem[];
}

export interface MarketDataAdapter {
  listTokens: () => Token[];
  getToken: (symbol: string) => Token | undefined;
  getMarketSeries: (symbol: string, timeframe: string) => MarketCandle[];
  getOrderBook: (symbol: string) => OrderBookSnapshot;
}

export interface AccountAdapter {
  getBalances: () => WalletBalance[];
  getTrades: () => TradeRecord[];
  getLpPositions: () => LpPosition[];
  getApiKeys: () => ApiKey[];
  getNodeApplications: () => NodeApplication[];
  getWithdrawalRecords: () => WithdrawalRecord[];
  getWalletSignatures: () => WalletSignatureRecord[];
  getChainTransactions: () => ChainTransaction[];
  getIndexedEvents: () => IndexedEvent[];
  getAdminQueue: () => AdminReviewItem[];
}

export const createLocalMvpApi = (
  snapshot: MvpApiSnapshot,
  market: Pick<MarketDataAdapter, "getMarketSeries" | "getOrderBook">,
): MarketDataAdapter & AccountAdapter => ({
  listTokens: () => snapshot.tokens,
  getToken: (symbol) => snapshot.tokens.find((token) => token.symbol === symbol),
  getMarketSeries: market.getMarketSeries,
  getOrderBook: market.getOrderBook,
  getBalances: () => snapshot.walletBalances,
  getTrades: () => snapshot.trades,
  getLpPositions: () => snapshot.lpPositions,
  getApiKeys: () => snapshot.apiKeys,
  getNodeApplications: () => snapshot.nodeApplications,
  getWithdrawalRecords: () => snapshot.withdrawalRecords,
  getWalletSignatures: () => snapshot.walletSignatures,
  getChainTransactions: () => snapshot.chainTransactions,
  getIndexedEvents: () => snapshot.indexedEvents,
  getAdminQueue: () => snapshot.adminQueue,
});

export const MVP_BACKEND_CONTRACT = {
  auth: "wallet-signature",
  endpoints: [
    "POST /api/auth/nonce",
    "POST /api/auth/verify",
    "GET /api/tokens",
    "GET /api/tokens/:symbol",
    "GET /api/tokens/:symbol/metrics",
    "GET /api/tokens/:symbol/market-series?timeframe=1m",
    "GET /api/tokens/:symbol/order-book",
    "GET /api/tokens/:symbol/holders?limit=10",
    "GET /api/market/bnb-usd",
    "POST /api/chain-transactions",
    "GET /api/chain-transactions",
    "GET /api/indexed-events",
    "GET /api/indexer/status",
    "GET /api/lp-positions?owner=0x...",
    "GET /api/ledger/commissions?wallet=0x...",
    "GET /api/orders?wallet=0x...",
    "POST /api/orders",
    "POST /api/api-keys",
    "DELETE /api/api-keys/:id",
    "POST /api/node-applications",
    "POST /api/withdrawals",
    "GET /api/admin/review-queue",
    "POST /api/admin/review-queue/:id/approve",
    "POST /api/admin/review-queue/:id/reject",
    "POST /api/admin/projects/:projectId/launch",
    "POST /api/admin/withdrawals/:id/pay",
  ],
} as const;
