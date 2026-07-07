import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { bscTestnetConfig, canUseRealChain, isNativePairToken } from "@/lib/chainConfig";
import { buildFactoryCalldata } from "@/lib/contractAbi";
import { requestCommissionVaultWithdrawal } from "@/lib/commissionVault";
import { apiRequest, clearStoredAuthToken, getStoredAuthToken, requestAuthNonce, storeAuthToken, verifyAuthSignature } from "@/lib/backendApi";
import { ensureWalletChain, getConnectedAccounts, hasInjectedWallet, onWalletAccountsChanged, personalSign, requestAccounts, sendValueTransaction, signLoginMessage } from "@/lib/walletAdapter";
import { enableDemoFallback } from "@/lib/runtimeFlags";

export type TokenStatus = "launched" | "pending" | "building";
export type LpPhase = "launch" | "trading";
export type TradeSide = "buy" | "sell";

export interface Token {
  logo: string;
  name: string;
  symbol: string;
  totalSupply: string;
  lpCount: number;
  holders: number;
  change24h: number;
  currentPrice: string;
  marketCap: string;
  volume24h: string;
  poolAmount: string;
  description: string;
  contractAddress: string;
  creatorWallet: string;
  lpPairToken: "BNB" | "USDT";
  status: TokenStatus;
  category: "meme" | "usStock";
  hasDividend?: boolean;
  hasBurn?: boolean;
  hasMarketing?: boolean;
  website?: string;
  twitter?: string;
  telegram?: string;
  isFollowing?: boolean;
  smartMoneyMentions?: number;
  launchDeadline?: string;
  tradingStartTime?: string;
  lockPeriodDays?: number;
  releaseType?: "oneTime" | "linear";
  releaseLinearDays?: number;
}

export interface WalletBalance {
  token: string;
  balance: string;
  valueUSDT: string;
  change24h: number;
  status: "holding" | "cleared";
}

export interface TradeRecord {
  id: string;
  tokenSymbol: string;
  side: TradeSide;
  amount: string;
  currency: string;
  timestamp: string;
  status: "simulated" | "pending" | "confirmed";
}

export interface LpPosition {
  id: string;
  onChainPositionId?: number;
  tokenSymbol: string;
  phase: LpPhase;
  userLpAmount: string;
  userLpValue: string;
  expectedWithdraw: string;
  withdrawnAmount: string;
  roi: number;
  lockEndDate: string;
  linearReleaseEndDate?: string;
  lpTokenAddress?: string;
  tokenAddress?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed?: string;
}

export interface NodeApplication {
  id: string;
  walletAddress: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface WithdrawalRecord {
  id: string;
  chainWithdrawalId?: number;
  amount: number;
  status: "processing" | "completed" | "failed";
  time: string;
  txHash?: string;
  tokenAddress?: string;
}

export interface MarketCandle {
  time: string;
  price: number;
  volume: number;
}

export interface OrderBookRow {
  price: number;
  amount: number;
  total: number;
}

export interface OrderBookSnapshot {
  buys: OrderBookRow[];
  sells: OrderBookRow[];
  currentPrice: number;
  change24h: number;
}

export interface WalletSignatureRecord {
  address: string;
  message: string;
  signature: string;
  signedAt: string;
  mode: "wallet" | "demo";
}

export type ChainAction = "trade" | "addLp" | "withdrawLp" | "createToken" | "limitOrder" | "riskOrder" | "requestWithdrawal";

export interface ChainTransaction {
  id: string;
  action: ChainAction;
  tokenSymbol?: string;
  txHash: string;
  status: "queued" | "submitted" | "confirmed" | "failed" | "demo";
  createdAt: string;
  mode: "wallet" | "demo";
  payload?: string;
}

export interface IndexedEvent {
  id: string;
  type: "TokenCreated" | "ProjectReviewed" | "ProjectLaunched" | "TradeRecorded" | "LpAdded" | "LpLocked" | "LpWithdrawn" | "CommissionDeposited" | "NodeApplicationSubmitted" | "WithdrawalRequested" | "WithdrawalReviewed" | "WithdrawalPaid";
  txHash?: string;
  tokenSymbol?: string;
  walletAddress?: string;
  createdAt: string;
  payload?: Record<string, string | number | boolean>;
}

export interface AdminReviewItem {
  id: string;
  type: "token" | "node" | "withdrawal";
  targetId: string;
  title: string;
  status: "pending" | "submitted" | "approved" | "rejected" | "failed";
  createdAt: string;
  reviewerNote?: string;
}

interface MvpContextType {
  tokens: Token[];
  walletAddress: string;
  isConnected: boolean;
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
  connectWallet: () => void;
  connectInjectedWallet: () => Promise<WalletSignatureRecord>;
  disconnectWallet: () => void;
  getTokenBySymbol: (symbol?: string) => Token | undefined;
  createToken: (token: CreateTokenInput) => Token;
  toggleFollow: (symbol: string) => void;
  recordTrade: (trade: Omit<TradeRecord, "id" | "timestamp" | "status">, chainTx?: ChainTransaction) => TradeRecord;
  addLpPosition: (symbol: string, amount: string, currency: string, phase?: LpPhase, chainTx?: ChainTransaction) => LpPosition;
  withdrawLp: (positionId: string) => void;
  generateApiKey: (name: string) => Promise<ApiKey>;
  deleteApiKey: (id: string) => Promise<void>;
  submitNodeApplication: (walletAddress: string) => Promise<NodeApplication>;
  requestCommissionWithdrawal: (amount: number, tokenAddress: string) => Promise<WithdrawalRecord>;
  submitChainTransaction: (action: ChainAction, tokenSymbol?: string, payload?: string) => Promise<ChainTransaction>;
  approveAdminItem: (id: string, note?: string) => Promise<void>;
  rejectAdminItem: (id: string, note?: string) => Promise<void>;
  getMarketSeries: (symbol: string, timeframe: string) => MarketCandle[];
  getOrderBook: (symbol: string) => OrderBookSnapshot;
}

export interface CreateTokenInput {
  logo?: string;
  name: string;
  symbol: string;
  description: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  initialMarketCap: string;
  totalLpShares: string;
  lpCurrency: "BNB" | "USDT";
  teamLpShares: string;
  lpEndTime: Date;
  hasMarketing: boolean;
  releaseType: "oneTime" | "linear";
  releaseLinearDays?: string;
}

const DEMO_WALLET_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

const initialTokens: Token[] = [];
const initialBalances: WalletBalance[] = [];
const initialLpPositions: LpPosition[] = [];
const initialNodeApplications: NodeApplication[] = [];
const initialWithdrawalRecords: WithdrawalRecord[] = [];
const initialIndexedEvents: IndexedEvent[] = [];
const initialAdminQueue: AdminReviewItem[] = [];

const MvpContext = createContext<MvpContextType | undefined>(undefined);
const STORAGE_KEY = "fair-meme-trade-mvp-state";
const WALLET_STORAGE_KEY = "fair-meme-trade-wallet-address";

const formatAddressSeed = (symbol: string) => {
  const seed = symbol.toLowerCase().padEnd(40, "0").slice(0, 40);
  return `0x${seed}`;
};

const parseTokenPrice = (price: string) => Number(price.replace(/[^0-9.]/g, "")) || 0.004;

const seededUnit = (seed: string) => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const makeHash = (seed: string) => {
  const source = `${seed}-${Date.now()}-${Math.random()}`;
  let hash = "";
  for (let index = 0; index < 64; index += 1) {
    const charCode = source.charCodeAt(index % source.length);
    hash += ((charCode + index * 17) % 16).toString(16);
  }
  return `0x${hash}`;
};

const makeChainTransaction = (
  action: ChainAction,
  tokenSymbol: string | undefined,
  payload: string | undefined,
  mode: "wallet" | "demo",
  txHash?: string,
  status?: ChainTransaction["status"],
): ChainTransaction => ({
  id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  action,
  tokenSymbol,
  txHash: txHash || makeHash(`${action}-${tokenSymbol || "platform"}`),
  status: status || (mode === "wallet" ? "submitted" : "demo"),
  createdAt: new Date().toLocaleString(),
  mode,
  payload,
});

const makeIndexedEvent = (
  type: IndexedEvent["type"],
  options: Omit<IndexedEvent, "id" | "type" | "createdAt">,
): IndexedEvent => ({
  id: `idx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type,
  createdAt: new Date().toLocaleString(),
  ...options,
});

const buildMarketSeries = (token: Token, timeframe: string, trades: TradeRecord[]): MarketCandle[] => {
  const base = parseTokenPrice(token.currentPrice);
  const tradeImpact = trades
    .filter((trade) => trade.tokenSymbol === token.symbol)
    .reduce((sum, trade) => sum + (trade.side === "buy" ? 1 : -1) * (Number(trade.amount) || 0) * 0.00001, 0);
  const candleCount = 50;
  const labels: Record<string, string> = {
    "1分": "m",
    "5分": "5m",
    "15分": "15m",
    "1小时": "h",
    "4小时": "4h",
    "天": "d",
    "1H": "m",
  };
  return Array.from({ length: candleCount }, (_, index) => {
    const wave = Math.sin(index / 5 + seededUnit(token.symbol) * 6) * 0.07;
    const drift = ((index - candleCount / 2) / candleCount) * (token.change24h / 100) * 0.18;
    const noise = (seededUnit(`${token.symbol}-${timeframe}-${index}`) - 0.5) * 0.035;
    const price = Math.max(base * (1 + wave + drift + noise + tradeImpact), 0.0000001);
    const volumeBase = Math.max(parseTokenPrice(token.volume24h) || 80000, 20000);
    const volume = volumeBase * (0.35 + seededUnit(`${timeframe}-${token.symbol}-volume-${index}`));
    return {
      time: `${index * 2}${labels[timeframe] || "m"}`,
      price,
      volume,
    };
  });
};

const buildOrderBook = (token: Token, trades: TradeRecord[]): OrderBookSnapshot => {
  const currentPrice = parseTokenPrice(token.currentPrice);
  const netTradeAmount = trades
    .filter((trade) => trade.tokenSymbol === token.symbol)
    .reduce((sum, trade) => sum + (trade.side === "buy" ? 1 : -1) * (Number(trade.amount) || 0), 0);
  const adjustedPrice = Math.max(currentPrice * (1 + netTradeAmount * 0.00001), 0.0000001);
  const makeRows = (type: "buy" | "sell"): OrderBookRow[] => Array.from({ length: 10 }, (_, index) => {
    const spread = adjustedPrice * (0.0025 + index * 0.002);
    const price = type === "buy" ? adjustedPrice - spread : adjustedPrice + spread;
    const amount = 15000 + seededUnit(`${token.symbol}-${type}-${index}`) * 90000;
    return {
      price,
      amount,
      total: price * amount,
    };
  });
  return {
    buys: makeRows("buy"),
    sells: makeRows("sell"),
    currentPrice: adjustedPrice,
    change24h: token.change24h,
  };
};

const hydrateTokenContracts = (tokens: Token[]) => tokens.map((token) => (
  token.symbol === "ROCKET" && import.meta.env.VITE_ROCKET_TOKEN_ADDRESS
    ? { ...token, contractAddress: import.meta.env.VITE_ROCKET_TOKEN_ADDRESS }
    : token
));

type ServerToken = {
  symbol: string;
  name: string;
  tokenAddress: string;
  creatorAddress: string;
  metadataUri: string;
  pairToken: string;
  status: TokenStatus;
};

type ServerIndexedEvent = {
  id: number;
  eventName: IndexedEvent["type"];
  txHash: string;
  tokenAddress?: string;
  walletAddress?: string;
  payload?: Record<string, string | number | boolean>;
  createdAt: string;
};

type ServerReviewItem = {
  id: number;
  type: AdminReviewItem["type"];
  targetId: string;
  title: string;
  status: AdminReviewItem["status"];
  reviewerNote?: string;
  createdAt: string;
};

type ServerLpPosition = {
  id: number;
  positionId: number | null;
  ownerAddress: string;
  lpTokenAddress: string;
  tokenAddress?: string;
  amount: string;
  withdrawn: string;
  unlockAt?: string;
  releaseType?: "once" | "linear";
  releaseStart?: string;
  releaseEnd?: string;
  createdAt: string;
};

type ServerWithdrawal = {
  id: number;
  chainWithdrawalId?: number;
  amount: string;
  status: string;
  tokenAddress: string;
  txHash?: string;
  createdAt: string;
};

type ServerNodeApplication = {
  id: number;
  walletAddress: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

const tokenFromServer = (token: ServerToken): Token => ({
  logo: token.symbol.slice(0, 2).toUpperCase(),
  name: token.name,
  symbol: token.symbol.toUpperCase(),
  totalSupply: "1B",
  lpCount: 0,
  holders: 1,
  change24h: 0,
  currentPrice: "$0.0000",
  marketCap: "$0",
  volume24h: "$0",
  poolAmount: "0 BNB",
  description: token.metadataUri,
  contractAddress: token.tokenAddress,
  creatorWallet: token.creatorAddress,
  lpPairToken: isNativePairToken(token.pairToken) ? "BNB" : "USDT",
  status: token.status,
  category: "meme",
  isFollowing: true,
});

const eventFromServer = (event: ServerIndexedEvent): IndexedEvent => ({
  id: String(event.id),
  type: event.eventName,
  txHash: event.txHash,
  walletAddress: event.walletAddress,
  tokenSymbol: typeof event.payload?.symbol === "string" ? event.payload.symbol : undefined,
  createdAt: new Date(event.createdAt).toLocaleString(),
  payload: event.payload,
});

const reviewItemFromServer = (item: ServerReviewItem): AdminReviewItem => ({
  id: String(item.id),
  type: item.type,
  targetId: item.targetId,
  title: item.title,
  status: item.status,
  reviewerNote: item.reviewerNote,
  createdAt: new Date(item.createdAt).toLocaleString(),
});

const lpPositionFromServer = (position: ServerLpPosition, tokenList: Token[]): LpPosition => {
  const token = tokenList.find((item) => item.contractAddress.toLowerCase() === position.tokenAddress?.toLowerCase());
  const fallbackSymbol = position.tokenAddress
    ? `${position.tokenAddress.slice(0, 6)}...${position.tokenAddress.slice(-4)}`
    : "UNKNOWN";
  const amount = Number(position.amount || 0);
  const withdrawn = Number(position.withdrawn || 0);
  return {
    id: String(position.positionId || position.id),
    onChainPositionId: position.positionId || undefined,
    tokenSymbol: token?.symbol || fallbackSymbol,
    phase: "trading",
    userLpAmount: amount.toLocaleString(),
    userLpValue: `${amount.toLocaleString()} LP`,
    expectedWithdraw: `${Math.max(amount - withdrawn, 0).toLocaleString()} LP`,
    withdrawnAmount: `${withdrawn.toLocaleString()} LP`,
    roi: 0,
    lockEndDate: position.unlockAt ? new Date(position.unlockAt).toISOString().slice(0, 10) : "—",
    linearReleaseEndDate: position.releaseEnd ? new Date(position.releaseEnd).toISOString().slice(0, 10) : undefined,
    lpTokenAddress: position.lpTokenAddress,
    tokenAddress: position.tokenAddress,
  };
};

export const MvpProvider = ({ children }: { children: ReactNode }) => {
  const savedState = (() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as Partial<{
        tokens: Token[];
        walletAddress: string;
        isConnected: boolean;
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
      }> : null;
    } catch {
      return null;
    }
  })();
  const localState = enableDemoFallback ? savedState : null;
  const persistedWalletAddress = typeof window !== "undefined"
    ? window.localStorage.getItem(WALLET_STORAGE_KEY) || ""
    : "";
  const [tokens, setTokens] = useState<Token[]>(hydrateTokenContracts(localState?.tokens || (enableDemoFallback ? initialTokens : [])));
  const [currentWalletAddress, setCurrentWalletAddress] = useState(localState?.walletAddress || persistedWalletAddress);
  const [isConnected, setIsConnected] = useState(Boolean(localState?.isConnected || persistedWalletAddress));
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>(localState?.walletBalances || (enableDemoFallback ? initialBalances : []));
  const [trades, setTrades] = useState<TradeRecord[]>(localState?.trades || []);
  const [lpPositions, setLpPositions] = useState<LpPosition[]>(localState?.lpPositions || (enableDemoFallback ? initialLpPositions : []));
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(localState?.apiKeys || []);
  const [nodeApplications, setNodeApplications] = useState<NodeApplication[]>(localState?.nodeApplications || (enableDemoFallback ? initialNodeApplications : []));
  const [withdrawalRecords, setWithdrawalRecords] = useState<WithdrawalRecord[]>(localState?.withdrawalRecords || (enableDemoFallback ? initialWithdrawalRecords : []));
  const [walletSignatures, setWalletSignatures] = useState<WalletSignatureRecord[]>(localState?.walletSignatures || []);
  const [chainTransactions, setChainTransactions] = useState<ChainTransaction[]>(localState?.chainTransactions || []);
  const [indexedEvents, setIndexedEvents] = useState<IndexedEvent[]>(localState?.indexedEvents || (enableDemoFallback ? initialIndexedEvents : []));
  const [adminQueue, setAdminQueue] = useState<AdminReviewItem[]>(localState?.adminQueue || (enableDemoFallback ? initialAdminQueue : []));
  const [authToken, setAuthToken] = useState(getStoredAuthToken());

  useEffect(() => {
    if (!enableDemoFallback) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tokens,
      walletAddress: currentWalletAddress,
      isConnected,
      walletBalances,
      trades,
      lpPositions,
      apiKeys,
      nodeApplications,
      withdrawalRecords,
      walletSignatures,
      chainTransactions,
      indexedEvents,
      adminQueue,
    }));
  }, [
    adminQueue,
    apiKeys,
    authToken,
    chainTransactions,
    currentWalletAddress,
    indexedEvents,
    isConnected,
    lpPositions,
    nodeApplications,
    tokens,
    trades,
    walletBalances,
    walletSignatures,
    withdrawalRecords,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || enableDemoFallback) return;
    if (isConnected && currentWalletAddress) {
      window.localStorage.setItem(WALLET_STORAGE_KEY, currentWalletAddress);
    } else {
      window.localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }, [currentWalletAddress, isConnected]);

  useEffect(() => {
    if (enableDemoFallback || !hasInjectedWallet()) return;
    let cancelled = false;

    const syncConnectedAccount = async () => {
      const accounts = await getConnectedAccounts();
      if (cancelled) return;
      const account = accounts[0]?.toLowerCase() || "";
      if (!account) {
        setIsConnected(false);
        setCurrentWalletAddress("");
        return;
      }
      setCurrentWalletAddress(account);
      setIsConnected(true);
    };

    syncConnectedAccount().catch(() => {
      if (!cancelled) {
        setIsConnected(false);
        setCurrentWalletAddress("");
      }
    });

    const removeListener = onWalletAccountsChanged((accounts) => {
      const account = accounts[0]?.toLowerCase() || "";
      if (!account) {
        setIsConnected(false);
        setCurrentWalletAddress("");
        clearStoredAuthToken();
        setAuthToken("");
        return;
      }
      setCurrentWalletAddress(account);
      setIsConnected(true);
    });

    return () => {
      cancelled = true;
      removeListener();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadServerState = async () => {
      try {
        const serverTokens = await apiRequest<ServerToken[]>("/api/tokens");
        if (!cancelled && serverTokens.length) {
          const mappedTokens = serverTokens.map(tokenFromServer);
          if (!enableDemoFallback) {
            setTokens(mappedTokens);
            return;
          }
          setTokens((current) => {
            const bySymbol = new Map(current.map((token) => [token.symbol, token]));
            for (const token of mappedTokens) {
              bySymbol.set(token.symbol, { ...bySymbol.get(token.symbol), ...token });
            }
            return Array.from(bySymbol.values());
          });
        }
      } catch {
        // Local fallback remains the source while the API is unavailable.
      }

      try {
        const events = await apiRequest<ServerIndexedEvent[]>("/api/indexed-events");
        if (!cancelled) {
          const mappedEvents = events.map(eventFromServer);
          if (!enableDemoFallback) {
            setIndexedEvents(mappedEvents);
            return;
          }
          setIndexedEvents((current) => {
            const byId = new Map(current.map((event) => [event.id, event]));
            for (const event of mappedEvents) {
              byId.set(event.id, event);
            }
            return Array.from(byId.values());
          });
        }
      } catch {
        // Local fallback remains the source while the API is unavailable.
      }

      if (!authToken) return;
      try {
        const queue = await apiRequest<ServerReviewItem[]>("/api/admin/review-queue", { token: authToken });
        if (!cancelled) {
          const mappedQueue = queue.map(reviewItemFromServer);
          if (!enableDemoFallback) {
            setAdminQueue(mappedQueue);
            return;
          }
          setAdminQueue((current) => {
            const byId = new Map(current.map((item) => [item.id, item]));
            for (const item of mappedQueue) {
              byId.set(item.id, item);
            }
            return Array.from(byId.values());
          });
        }
      } catch {
        // Admin queue requires a verified admin wallet; keep existing local queue otherwise.
      }
    };

    loadServerState();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    const loadAccountState = async () => {
      if (!currentWalletAddress || currentWalletAddress === DEMO_WALLET_ADDRESS) return;
      try {
        const positions = await apiRequest<ServerLpPosition[]>(`/api/lp-positions?owner=${currentWalletAddress}`);
        if (!cancelled) {
          const mappedPositions = positions.map((item) => lpPositionFromServer(item, tokens));
          if (!enableDemoFallback) {
            setLpPositions(mappedPositions);
            return;
          }
          setLpPositions((current) => {
            const byId = new Map(current.map((position) => [position.id, position]));
            for (const position of mappedPositions) {
              byId.set(position.id, position);
            }
            return Array.from(byId.values());
          });
        }
      } catch {
        // Local LP fallback remains available while account API is unavailable.
      }
      try {
        const withdrawals = await apiRequest<ServerWithdrawal[]>(`/api/withdrawals?wallet=${currentWalletAddress}`);
        if (!cancelled) {
          setWithdrawalRecords(withdrawals.map((withdrawal) => ({
            id: String(withdrawal.id),
            chainWithdrawalId: withdrawal.chainWithdrawalId,
            amount: Number(withdrawal.amount),
            status: withdrawal.status === "completed" ? "completed" : withdrawal.status === "rejected" || withdrawal.status === "failed" ? "failed" : "processing",
            time: new Date(withdrawal.createdAt).toLocaleString(),
            txHash: withdrawal.txHash,
            tokenAddress: withdrawal.tokenAddress,
          })));
        }
      } catch {
        // Local withdrawal fallback remains available while account API is unavailable.
      }
      try {
        const applications = await apiRequest<ServerNodeApplication[]>(`/api/node-applications?wallet=${currentWalletAddress}`);
        if (!cancelled && (applications.length || !enableDemoFallback)) {
          setNodeApplications(applications.map((application) => ({
            id: String(application.id),
            walletAddress: application.walletAddress,
            status: application.status,
            createdAt: new Date(application.createdAt).toLocaleString(),
          })));
        }
      } catch {
        // Local node fallback remains available while account API is unavailable.
      }
    };

    loadAccountState();
    return () => {
      cancelled = true;
    };
  }, [currentWalletAddress, tokens]);

  const value = useMemo<MvpContextType>(() => ({
    tokens,
    walletAddress: currentWalletAddress,
    isConnected,
    walletBalances,
    trades,
    lpPositions,
    apiKeys,
    nodeApplications,
    withdrawalRecords,
    walletSignatures,
    chainTransactions,
    indexedEvents,
    adminQueue,
    connectWallet: () => {
      if (!enableDemoFallback) {
        throw new Error("未检测到真实钱包，线上环境不启用演示钱包。");
      }
      setCurrentWalletAddress(DEMO_WALLET_ADDRESS);
      setIsConnected(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(WALLET_STORAGE_KEY, DEMO_WALLET_ADDRESS);
      }
    },
    connectInjectedWallet: async () => {
      if (!hasInjectedWallet()) {
        if (!enableDemoFallback) {
          throw new Error("未检测到注入钱包，请安装或解锁钱包后重试。");
        }
        const demoSignature: WalletSignatureRecord = {
          address: DEMO_WALLET_ADDRESS,
          message: "Fair Meme Trade MVP 演示钱包签名",
          signature: makeHash("demo-signature"),
          signedAt: new Date().toISOString(),
          mode: "demo",
        };
        setCurrentWalletAddress(DEMO_WALLET_ADDRESS);
        setIsConnected(true);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(WALLET_STORAGE_KEY, DEMO_WALLET_ADDRESS);
        }
        setWalletSignatures((current) => [demoSignature, ...current]);
        return demoSignature;
      }

      const accounts = await requestAccounts();
      const signature = await signLoginMessage(accounts[0]);
      try {
        const nonce = await requestAuthNonce(accounts[0]);
        const serverSignature = await personalSign(accounts[0], nonce.message);
        const verified = await verifyAuthSignature(nonce.sessionId, serverSignature);
        storeAuthToken(verified.token);
        setAuthToken(verified.token);
      } catch {
        clearStoredAuthToken();
        setAuthToken("");
      }
      setCurrentWalletAddress(signature.address);
      setIsConnected(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(WALLET_STORAGE_KEY, signature.address);
      }
      setWalletSignatures((current) => [signature, ...current]);
      return signature;
    },
    disconnectWallet: () => {
      setIsConnected(false);
      setCurrentWalletAddress("");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(WALLET_STORAGE_KEY);
      }
      clearStoredAuthToken();
      setAuthToken("");
    },
    getTokenBySymbol: (symbol) => {
      const normalized = (symbol || "ROCKET").toUpperCase();
      return tokens.find((token) => token.symbol.toUpperCase() === normalized) || tokens[0];
    },
    createToken: (input) => {
      if (!enableDemoFallback) {
        throw new Error("线上环境不允许本地创建代币，请等待链上交易和 indexer 同步。");
      }
      const symbol = input.symbol.toUpperCase();
      const launchTime = new Date(input.lpEndTime.getTime() + 10 * 60 * 1000);
      const token: Token = {
        logo: input.logo?.trim() || symbol.slice(0, 2),
        name: input.name,
        symbol,
        totalSupply: "1B",
        lpCount: 1,
        holders: 1,
        change24h: 0,
        currentPrice: "$0.0000",
        marketCap: `$${Number(input.initialMarketCap || 0).toLocaleString()}`,
        volume24h: "$0",
        poolAmount: `${input.teamLpShares} ${input.lpCurrency}`,
        description: input.description,
        hasMarketing: input.hasMarketing,
        contractAddress: formatAddressSeed(symbol),
        creatorWallet: currentWalletAddress,
        lpPairToken: input.lpCurrency,
        status: "building",
        category: "meme",
        website: input.website,
        twitter: input.twitter,
        telegram: input.telegram,
        launchDeadline: input.lpEndTime.toISOString(),
        tradingStartTime: launchTime.toISOString(),
        lockPeriodDays: 30,
        releaseType: input.releaseType,
        releaseLinearDays: input.releaseLinearDays ? Number(input.releaseLinearDays) : undefined,
        isFollowing: true,
      };
      setTokens((current) => [token, ...current.filter((item) => item.symbol !== symbol)]);
      const position: LpPosition = {
        id: `lp-${symbol.toLowerCase()}-${Date.now()}`,
        tokenSymbol: symbol,
        phase: "launch",
        userLpAmount: input.teamLpShares,
        userLpValue: `${input.teamLpShares} ${input.lpCurrency}`,
        expectedWithdraw: `${input.teamLpShares} ${input.lpCurrency}`,
        withdrawnAmount: `0 ${input.lpCurrency}`,
        roi: 0,
        lockEndDate: new Date(input.lpEndTime.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      };
      setLpPositions((current) => [position, ...current]);
      const chainTx = makeChainTransaction("createToken", symbol, JSON.stringify({ name: input.name, lpCurrency: input.lpCurrency }), "demo");
      setChainTransactions((current) => [chainTx, ...current]);
      setIndexedEvents((current) => [makeIndexedEvent("TokenCreated", {
        txHash: chainTx.txHash,
        tokenSymbol: symbol,
        walletAddress: currentWalletAddress,
        payload: { name: input.name, lpCurrency: input.lpCurrency, status: token.status },
      }), ...current]);
      setAdminQueue((current) => [ {
        id: `review-token-${symbol.toLowerCase()}-${Date.now()}`,
        type: "token",
        targetId: symbol,
        title: `代币审核: ${input.name} (${symbol})`,
        status: "pending",
        createdAt: new Date().toLocaleString(),
      }, ...current]);
      return token;
    },
    toggleFollow: (symbol) => {
      setTokens((current) => current.map((token) => (
        token.symbol === symbol ? { ...token, isFollowing: !token.isFollowing } : token
      )));
    },
    recordTrade: (trade, submittedTx) => {
      if (!submittedTx && !enableDemoFallback) {
        throw new Error("线上环境不允许创建本地交易记录，请先提交真实 swap 交易。");
      }
      const record: TradeRecord = {
        ...trade,
        id: `trade-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        status: "simulated",
      };
      setTrades((current) => [record, ...current]);
      const chainTx = submittedTx || makeChainTransaction("trade", trade.tokenSymbol, JSON.stringify({
        side: trade.side,
        amount: trade.amount,
        currency: trade.currency,
      }), "demo");
      if (!submittedTx) {
        setChainTransactions((current) => [chainTx, ...current]);
      }
      setIndexedEvents((current) => [makeIndexedEvent("TradeRecorded", {
        txHash: chainTx.txHash,
        tokenSymbol: trade.tokenSymbol,
        walletAddress: currentWalletAddress,
        payload: { side: trade.side, amount: trade.amount, currency: trade.currency },
      }), ...current]);
      setTokens((current) => current.map((token) => (
        token.symbol === trade.tokenSymbol
          ? { ...token, volume24h: "Updated", holders: token.holders + (trade.side === "buy" ? 1 : 0) }
          : token
      )));
      return record;
    },
    addLpPosition: (symbol, amount, currency, phase = "trading", submittedTx) => {
      if (!submittedTx && !enableDemoFallback) {
        throw new Error("线上环境不允许创建本地 LP 仓位，请等待 Vault/indexer 同步。");
      }
      const position: LpPosition = {
        id: `lp-${symbol.toLowerCase()}-${Date.now()}`,
        tokenSymbol: symbol,
        phase,
        userLpAmount: amount,
        userLpValue: `${amount} ${currency}`,
        expectedWithdraw: `${amount} ${currency}`,
        withdrawnAmount: `0 ${currency}`,
        roi: 0,
        lockEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      };
      setLpPositions((current) => [position, ...current]);
      const chainTx = submittedTx || makeChainTransaction("addLp", symbol, JSON.stringify({ amount, currency, phase }), "demo");
      if (!submittedTx) {
        setChainTransactions((current) => [chainTx, ...current]);
      }
      setIndexedEvents((current) => [makeIndexedEvent("LpAdded", {
        txHash: chainTx.txHash,
        tokenSymbol: symbol,
        walletAddress: currentWalletAddress,
        payload: { amount, currency, phase },
      }), ...current]);
      setTokens((current) => current.map((token) => (
        token.symbol === symbol ? { ...token, lpCount: token.lpCount + 1, isFollowing: true } : token
      )));
      return position;
    },
    withdrawLp: (positionId) => {
      if (!enableDemoFallback) {
        throw new Error("线上环境不允许本地提取 LP，请使用 Vault 链上提取。");
      }
      const position = lpPositions.find((item) => item.id === positionId);
      setLpPositions((current) => current.map((position) => (
        position.id === positionId
          ? { ...position, withdrawnAmount: position.userLpAmount, expectedWithdraw: "0 LP" }
          : position
      )));
      const chainTx = makeChainTransaction("withdrawLp", position?.tokenSymbol, JSON.stringify({ positionId }), "demo");
      setChainTransactions((current) => [chainTx, ...current]);
      setIndexedEvents((current) => [makeIndexedEvent("LpWithdrawn", {
        txHash: chainTx.txHash,
        tokenSymbol: position?.tokenSymbol,
        walletAddress: currentWalletAddress,
        payload: { positionId },
      }), ...current]);
    },
    generateApiKey: async (name) => {
      try {
        const record = await apiRequest<{ id: number; name: string; key: string; createdAt: string }>("/api/api-keys", {
          method: "POST",
          token: authToken,
          body: JSON.stringify({ name, scopes: ["read", "trade"] }),
        });
        const serverKey: ApiKey = {
          id: String(record.id),
          name: record.name,
          key: record.key,
          createdAt: new Date(record.createdAt).toLocaleString(),
        };
        setApiKeys((current) => [serverKey, ...current.filter((item) => item.id !== serverKey.id)]);
        return serverKey;
      } catch {
        if (authToken) {
          clearStoredAuthToken();
          setAuthToken("");
        }
        if (!enableDemoFallback) {
          throw new Error("API key 创建失败，请先完成真实钱包登录。");
        }
      }
      const key: ApiKey = {
        id: `key-${Date.now()}`,
        name,
        key: `sk_mvp_${Math.random().toString(36).slice(2, 14)}_${Math.random().toString(36).slice(2, 10)}`,
        createdAt: new Date().toLocaleString(),
      };
      setApiKeys((current) => [key, ...current]);
      return key;
    },
    deleteApiKey: async (id) => {
      try {
        await apiRequest(`/api/api-keys/${id}`, {
          method: "DELETE",
          token: authToken,
        });
      } catch {
        if (!enableDemoFallback) throw new Error("API key 删除失败，请重新完成钱包登录后再试。");
      }
      setApiKeys((current) => current.filter((key) => key.id !== id));
    },
    submitNodeApplication: async (address) => {
      const application: NodeApplication = {
        id: `node-${Date.now()}`,
        walletAddress: address,
        status: "pending",
        createdAt: new Date().toLocaleString(),
      };
      try {
        const record = await apiRequest<{ id: number; walletAddress: string; status: "pending" | "approved" | "rejected"; createdAt: string }>("/api/node-applications", {
          method: "POST",
          body: JSON.stringify({ walletAddress: address }),
        });
        application.id = String(record.id);
        application.walletAddress = record.walletAddress;
        application.status = record.status;
        application.createdAt = new Date(record.createdAt).toLocaleString();
      } catch (error) {
        if (!enableDemoFallback) {
          throw error instanceof Error ? error : new Error("节点申请提交失败");
        }
      }
      setNodeApplications((current) => [application, ...current]);
      setIndexedEvents((current) => [makeIndexedEvent("NodeApplicationSubmitted", {
        walletAddress: address,
        payload: { status: "pending" },
      }), ...current]);
      setAdminQueue((current) => [{
        id: `review-node-${application.id}`,
        type: "node",
        targetId: application.id,
        title: `节点申请: ${address.slice(0, 6)}...${address.slice(-4)}`,
        status: "pending",
        createdAt: application.createdAt,
      }, ...current]);
      return application;
    },
    requestCommissionWithdrawal: async (amount, tokenAddress) => {
      const record: WithdrawalRecord = {
        id: `chain-withdrawal-${Date.now()}`,
        amount,
        status: "processing",
        time: new Date().toLocaleString(),
        tokenAddress,
      };
      try {
        if (!currentWalletAddress) {
          throw new Error("请先连接钱包");
        }
        const result = await requestCommissionVaultWithdrawal(tokenAddress, String(amount));
        record.txHash = result.txHash;
        record.status = result.status === "failed" ? "failed" : "processing";
        await apiRequest("/api/chain-transactions", {
          method: "POST",
          body: JSON.stringify({
            txHash: result.txHash,
            action: "requestWithdrawal",
            walletAddress: currentWalletAddress,
            tokenAddress,
            status: result.status,
            payload: { amount: String(amount), tokenAddress },
          }),
        });
      } catch (error) {
        if (!enableDemoFallback) {
          throw error instanceof Error ? error : new Error("提现申请提交失败");
        }
        record.txHash = makeHash(`withdrawal-${amount}-${tokenAddress}`);
      }
      setWithdrawalRecords((current) => [record, ...current]);
      setIndexedEvents((current) => [makeIndexedEvent("WithdrawalRequested", {
        walletAddress: currentWalletAddress,
        txHash: record.txHash,
        payload: { amount, tokenAddress, status: "processing" },
      }), ...current]);
      return record;
    },
    submitChainTransaction: async (action, tokenSymbol, payload) => {
      try {
        if (hasInjectedWallet() && canUseRealChain()) {
          const tokenAddress = tokenSymbol ? tokens.find((token) => token.symbol === tokenSymbol)?.contractAddress : undefined;
          const data = buildFactoryCalldata(action, tokenAddress, payload);
          if (!data) {
            if (!enableDemoFallback) {
              throw new Error("该操作没有可用的链上 calldata，线上环境不会生成演示交易。");
            }
            const tx = makeChainTransaction(action, tokenSymbol, payload, "demo");
            setChainTransactions((current) => [tx, ...current]);
            return tx;
          }
          await ensureWalletChain(bscTestnetConfig);
          const result = await sendValueTransaction({
            to: bscTestnetConfig.factoryAddress!,
            valueHex: "0x0",
            data,
          });
          const tx = makeChainTransaction(action, tokenSymbol, payload, "wallet", result.txHash, result.status);
          setChainTransactions((current) => [tx, ...current]);
          return tx;
        }
      } catch {
        const tx = makeChainTransaction(action, tokenSymbol, payload, "wallet", undefined, "failed");
        setChainTransactions((current) => [tx, ...current]);
        return tx;
      }

      if (!enableDemoFallback) {
        throw new Error("未连接真实钱包或链上配置不可用，线上环境不会生成演示交易。");
      }
      const tx = makeChainTransaction(action, tokenSymbol, payload, "demo");
      setChainTransactions((current) => [tx, ...current]);
      return tx;
    },
    approveAdminItem: async (id, note) => {
      const item = adminQueue.find((entry) => entry.id === id);
      try {
        const updated = await apiRequest<ServerReviewItem>(`/api/admin/review-queue/${id}/approve`, {
          method: "POST",
          token: authToken,
          body: JSON.stringify({ note }),
        });
        setAdminQueue((current) => current.map((entry) => (
          entry.id === id ? reviewItemFromServer(updated) : entry
        )));
      } catch {
        if (!enableDemoFallback) {
          throw new Error("审核提交失败，请确认管理员钱包签名和链上执行状态。");
        }
        // Local fallback mirrors the approved state if API auth is not available.
        setAdminQueue((current) => current.map((entry) => (
          entry.id === id ? { ...entry, status: "approved", reviewerNote: note } : entry
        )));
        if (item?.type === "node") {
          setNodeApplications((current) => current.map((application) => (
            application.id === item.targetId ? { ...application, status: "approved" } : application
          )));
        }
        if (item?.type === "withdrawal") {
          setWithdrawalRecords((current) => current.map((record) => (
            record.id === item.targetId ? { ...record, status: "completed", txHash: makeHash(item.targetId) } : record
          )));
        }
        if (item?.type === "token") {
          setTokens((current) => current.map((token) => (
            token.symbol === item.targetId ? { ...token, status: "launched" } : token
          )));
        }
      }
    },
    rejectAdminItem: async (id, note) => {
      const item = adminQueue.find((entry) => entry.id === id);
      try {
        const updated = await apiRequest<ServerReviewItem>(`/api/admin/review-queue/${id}/reject`, {
          method: "POST",
          token: authToken,
          body: JSON.stringify({ note }),
        });
        setAdminQueue((current) => current.map((entry) => (
          entry.id === id ? reviewItemFromServer(updated) : entry
        )));
      } catch {
        if (!enableDemoFallback) {
          throw new Error("拒绝提交失败，请确认管理员钱包签名和链上执行状态。");
        }
        // Local fallback mirrors the rejected state if API auth is not available.
        setAdminQueue((current) => current.map((entry) => (
          entry.id === id ? { ...entry, status: "rejected", reviewerNote: note } : entry
        )));
        if (item?.type === "node") {
          setNodeApplications((current) => current.map((application) => (
            application.id === item.targetId ? { ...application, status: "rejected" } : application
          )));
        }
        if (item?.type === "withdrawal") {
          setWithdrawalRecords((current) => current.map((record) => (
            record.id === item.targetId ? { ...record, status: "failed" } : record
          )));
        }
      }
    },
    getMarketSeries: (symbol, timeframe) => {
      const token = tokens.find((item) => item.symbol === symbol) || tokens[0];
      return buildMarketSeries(token, timeframe, trades);
    },
    getOrderBook: (symbol) => {
      const token = tokens.find((item) => item.symbol === symbol) || tokens[0];
      return buildOrderBook(token, trades);
    },
  }), [
    adminQueue,
    apiKeys,
    authToken,
    chainTransactions,
    currentWalletAddress,
    indexedEvents,
    isConnected,
    lpPositions,
    nodeApplications,
    tokens,
    trades,
    walletBalances,
    walletSignatures,
    withdrawalRecords,
  ]);

  return <MvpContext.Provider value={value}>{children}</MvpContext.Provider>;
};

export const useMvp = () => {
  const context = useContext(MvpContext);
  if (!context) {
    throw new Error("useMvp must be used within MvpProvider");
  }
  return context;
};
