import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { chainTransactions, indexedEvents, lpPositions, tokens } from "../db/schema";
import { env } from "../env";
import { getHolderAnalytics } from "./holderAnalytics";

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];

const FACTORY_ABI = [
  "function getPair(address tokenA,address tokenB) view returns (address pair)",
];

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0,uint112 reserve1,uint32 blockTimestampLast)",
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const provider = new JsonRpcProvider(env.rpcUrl, undefined, { batchMaxCount: 1 });

type TokenRow = typeof tokens.$inferSelect;

export type TokenMetrics = {
  symbol: string;
  totalSupply: string | null;
  holderCount: number | null;
  lpCount: number;
  currentPriceBnb: number | null;
  marketCapBnb: number | null;
  poolBnb: number | null;
  volume24hBnb: number | null;
  change24h: number | null;
  pairAddress: string | null;
  source: "chain";
};

export type MarketCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  txHash?: string;
};

const isAddress = (value?: string | null) => Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));

const asNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMetricAmount = (value: number | null, suffix: string) => {
  if (value === null) return null;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M ${suffix}`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(2)}K ${suffix}`;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${suffix}`;
};

export const getTokenCreationBlock = async (token: TokenRow) => {
  const [creationEvent] = await db.select().from(indexedEvents).where(and(
    eq(indexedEvents.tokenAddress, token.tokenAddress),
    eq(indexedEvents.eventName, "TokenCreated"),
  )).limit(1);
  return creationEvent?.blockNumber || Math.max(0, Number(token.projectId || 0));
};

const readPairState = async (tokenAddress: string) => {
  if (!isAddress(env.pancakeFactoryAddress) || !isAddress(env.wbnbAddress) || !isAddress(tokenAddress)) {
    return null;
  }
  const factory = new Contract(env.pancakeFactoryAddress, FACTORY_ABI, provider);
  const pairAddress = String(await factory.getPair(tokenAddress, env.wbnbAddress));
  if (!isAddress(pairAddress) || pairAddress.toLowerCase() === ZERO_ADDRESS) return null;

  const pair = new Contract(pairAddress, PAIR_ABI, provider);
  const [token0, reserves] = await Promise.all([
    pair.token0() as Promise<string>,
    pair.getReserves() as Promise<[bigint, bigint, number]>,
  ]);
  const reserve0 = BigInt(reserves[0].toString());
  const reserve1 = BigInt(reserves[1].toString());
  const tokenIs0 = token0.toLowerCase() === tokenAddress.toLowerCase();
  const tokenReserveRaw = tokenIs0 ? reserve0 : reserve1;
  const bnbReserveRaw = tokenIs0 ? reserve1 : reserve0;
  const token = new Contract(tokenAddress, ERC20_ABI, provider);
  const decimals = Number(await token.decimals().catch(() => 18));
  const tokenReserve = Number(formatUnits(tokenReserveRaw, decimals));
  const bnbReserve = Number(formatUnits(bnbReserveRaw, 18));
  return {
    pairAddress,
    tokenReserve,
    bnbReserve,
    priceBnb: tokenReserve > 0 ? bnbReserve / tokenReserve : null,
    poolBnb: bnbReserve > 0 ? bnbReserve * 2 : null,
  };
};

export const getTokenMetrics = async (token: TokenRow): Promise<TokenMetrics> => {
  const [fromBlock, pairState, positions] = await Promise.all([
    getTokenCreationBlock(token),
    readPairState(token.tokenAddress).catch(() => null),
    db.select().from(lpPositions).where(eq(lpPositions.tokenAddress, token.tokenAddress)),
  ]);
  const analytics = await getHolderAnalytics({
    tokenAddress: token.tokenAddress,
    fromBlock,
    limit: 1,
    candidateAddresses: [token.creatorAddress],
  }).catch(() => null);
  const totalSupply = asNumber(analytics?.totalSupply);
  const currentPriceBnb = pairState?.priceBnb ?? null;
  return {
    symbol: token.symbol,
    totalSupply: analytics?.totalSupply ?? null,
    holderCount: analytics?.holderCount ?? null,
    lpCount: positions.length,
    currentPriceBnb,
    marketCapBnb: totalSupply !== null && currentPriceBnb !== null ? totalSupply * currentPriceBnb : null,
    poolBnb: pairState?.poolBnb ?? null,
    volume24hBnb: null,
    change24h: null,
    pairAddress: pairState?.pairAddress ?? null,
    source: "chain",
  };
};

export const presentTokenMetrics = (metrics: TokenMetrics) => ({
  ...metrics,
  totalSupplyLabel: metrics.totalSupply,
  currentPriceLabel: metrics.currentPriceBnb === null
    ? null
    : `${metrics.currentPriceBnb.toFixed(metrics.currentPriceBnb < 0.000001 ? 12 : 8)} BNB`,
  marketCapLabel: formatMetricAmount(metrics.marketCapBnb, "BNB"),
  poolLabel: formatMetricAmount(metrics.poolBnb, "BNB"),
  volume24hLabel: metrics.volume24hBnb === null ? null : formatMetricAmount(metrics.volume24hBnb, "BNB"),
});

export const getMarketSeries = async (token: TokenRow): Promise<{ rows: MarketCandle[]; source: string }> => {
  const records = await db.select().from(chainTransactions).where(eq(chainTransactions.tokenAddress, token.tokenAddress));
  const swapRecords = records
    .filter((record) => record.action === "dexSwap" && record.status !== "failed")
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const rows = swapRecords.flatMap((record) => {
    const payload = (record.payload || {}) as Record<string, unknown>;
    const amount = asNumber(String(payload.amount || ""));
    const minOut = asNumber(String(payload.minOut || ""));
    if (amount === null || minOut === null || amount <= 0 || minOut <= 0) return [];
    const price = String(payload.side) === "sell" ? minOut / amount : amount / minOut;
    return [{
      time: new Date(record.createdAt).toISOString(),
      open: price,
      high: price,
      low: price,
      close: price,
      volume: amount,
      txHash: record.txHash,
    }];
  });
  return {
    rows,
    source: "chain_transactions",
  };
};

export const getOrderBook = async (token: TokenRow) => {
  const pairState = await readPairState(token.tokenAddress).catch(() => null);
  return {
    buys: [],
    sells: [],
    currentPrice: pairState?.priceBnb ?? null,
    change24h: null,
    pairAddress: pairState?.pairAddress ?? null,
    source: pairState ? "pancake_pair_reserves" : "no_pair",
  };
};
