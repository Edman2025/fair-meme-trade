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
    "POST /auth/wallet/nonce",
    "POST /auth/wallet/signature",
    "GET /tokens",
    "GET /tokens/:symbol",
    "GET /tokens/:symbol/market-series?timeframe=1m",
    "GET /tokens/:symbol/order-book",
    "POST /trades",
    "POST /chain-transactions",
    "GET /chain-transactions",
    "GET /indexer/events",
    "POST /lp-positions",
    "GET /account/balances",
    "GET /account/trades",
    "GET /account/lp-positions",
    "POST /api-keys",
    "DELETE /api-keys/:id",
    "POST /node-applications",
    "POST /withdrawals",
    "GET /admin/review-queue",
    "POST /admin/review-queue/:id/approve",
    "POST /admin/review-queue/:id/reject",
  ],
} as const;
