import { Contract, Interface, JsonRpcProvider, ZeroAddress, formatUnits, id } from "ethers";
import { env } from "../env";

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
];
const PANCAKE_FACTORY_ABI = [
  "function getPair(address tokenA,address tokenB) view returns (address)",
];
const PANCAKE_V2_FACTORY = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
const WBNB_TESTNET = "0xae13d989dac2f0debff460ac112a837c89baa7cd";

const transferInterface = new Interface(ERC20_ABI);
const transferTopic = id("Transfer(address,address,uint256)");
const holderRpcUrls = Array.from(new Set([
  env.rpcUrl,
  ...(process.env.HOLDER_RPC_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean),
  "https://bsc-testnet-dataseed.bnbchain.org",
  "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
].filter(Boolean)));
const providers = holderRpcUrls.map((url) => ({
  url,
  provider: new JsonRpcProvider(url, undefined, { batchMaxCount: 1 }),
}));
const defaultWindowSize = Number(process.env.HOLDER_LOG_WINDOW_SIZE || 2_000);
const defaultMaxScanBlocks = Number(process.env.HOLDER_MAX_SCAN_BLOCKS || 200_000);

export type HolderAnalyticsRow = {
  rank: number;
  address: string;
  balance: string;
  balanceRaw: string;
  percent: number;
};

export type HolderAnalytics = {
  tokenAddress: string;
  holderCount: number;
  totalSupply: string;
  totalSupplyRaw: string;
  decimals: number;
  latestBlock: number;
  scannedFromBlock: number;
  scannedToBlock: number;
  truncated: boolean;
  holders: HolderAnalyticsRow[];
};

const topicToAddress = (topic: string) => `0x${topic.slice(-40)}`.toLowerCase();

const readTokenMeta = async (provider: JsonRpcProvider, tokenAddress: string) => {
  const contract = new Contract(tokenAddress, ERC20_ABI, provider);
  let decimals = 18;
  let totalSupply = 0n;
  try {
    decimals = Number(await contract.decimals());
  } catch {
    decimals = 18;
  }
  try {
    totalSupply = BigInt((await contract.totalSupply()).toString());
  } catch {
    totalSupply = 0n;
  }
  return { decimals, totalSupply };
};

const getTransferLogs = async (provider: JsonRpcProvider, tokenAddress: string, fromBlock: number, toBlock: number) => {
  let windowSize = defaultWindowSize;
  const logs = [];
  for (let start = fromBlock; start <= toBlock;) {
    const end = Math.min(toBlock, start + windowSize - 1);
    try {
      const batch = await provider.getLogs({
        address: tokenAddress,
        topics: [transferTopic],
        fromBlock: start,
        toBlock: end,
      });
      logs.push(...batch);
      start = end + 1;
      if (windowSize < defaultWindowSize) windowSize = Math.min(defaultWindowSize, windowSize * 2);
    } catch (error) {
      if (windowSize <= 25) throw error;
      windowSize = Math.max(25, Math.floor(windowSize / 2));
    }
  }
  return logs;
};

export const getHolderAnalytics = async (params: {
  tokenAddress: string;
  fromBlock: number;
  limit?: number;
  candidateAddresses?: string[];
}): Promise<HolderAnalytics> => {
  const limit = Math.max(1, Math.min(Number(params.limit || 10), 50));
  const tokenAddress = params.tokenAddress.toLowerCase();
  let lastError: unknown;
  for (const candidate of providers) {
    try {
      const latestBlock = await candidate.provider.getBlockNumber();
      const boundedFromBlock = Math.max(0, Number(params.fromBlock || 0), latestBlock - defaultMaxScanBlocks);
      const { decimals, totalSupply } = await readTokenMeta(candidate.provider, tokenAddress);
      const balances = new Map<string, bigint>();
      const logs = await getTransferLogs(candidate.provider, tokenAddress, boundedFromBlock, latestBlock);

      for (const log of logs) {
        const parsed = transferInterface.parseLog({ topics: [...log.topics], data: log.data });
        if (!parsed) continue;
        const from = topicToAddress(log.topics[1]);
        const to = topicToAddress(log.topics[2]);
        const value = BigInt(parsed.args.value.toString());
        if (from !== ZeroAddress.toLowerCase()) {
          balances.set(from, (balances.get(from) || 0n) - value);
        }
        if (to !== ZeroAddress.toLowerCase()) {
          balances.set(to, (balances.get(to) || 0n) + value);
        }
      }

      const positiveBalances = Array.from(balances.entries())
        .filter(([, balance]) => balance > 0n)
        .sort((left, right) => (right[1] > left[1] ? 1 : right[1] < left[1] ? -1 : 0));

      const denominator = totalSupply > 0n
        ? totalSupply
        : positiveBalances.reduce((sum, [, balance]) => sum + balance, 0n);

      return {
        tokenAddress,
        holderCount: positiveBalances.length,
        totalSupply: formatUnits(denominator, decimals),
        totalSupplyRaw: denominator.toString(),
        decimals,
        latestBlock,
        scannedFromBlock: boundedFromBlock,
        scannedToBlock: latestBlock,
        truncated: boundedFromBlock > Number(params.fromBlock || 0),
        holders: positiveBalances.slice(0, limit).map(([address, balance], index) => ({
          rank: index + 1,
          address,
          balance: formatUnits(balance, decimals),
          balanceRaw: balance.toString(),
          percent: denominator > 0n ? Number(((balance * 1_000_000n) / denominator)) / 10_000 : 0,
        })),
      };
    } catch (error) {
      lastError = error;
    }
  }
  for (const candidate of providers) {
    try {
      return await getCandidateHolderAnalytics(candidate.provider, {
        tokenAddress,
        limit,
        fromBlock: Number(params.fromBlock || 0),
        candidateAddresses: params.candidateAddresses || [],
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All holder RPC providers failed");
};

const getCandidateHolderAnalytics = async (
  provider: JsonRpcProvider,
  params: { tokenAddress: string; limit: number; fromBlock: number; candidateAddresses: string[] },
): Promise<HolderAnalytics> => {
  const token = new Contract(params.tokenAddress, ERC20_ABI, provider);
  const factory = new Contract(PANCAKE_V2_FACTORY, PANCAKE_FACTORY_ABI, provider);
  const latestBlock = await provider.getBlockNumber();
  const { decimals, totalSupply } = await readTokenMeta(provider, params.tokenAddress);
  const candidateSet = new Set(
    params.candidateAddresses
      .filter((address) => /^0x[a-fA-F0-9]{40}$/.test(address))
      .map((address) => address.toLowerCase()),
  );
  try {
    const pair = String(await factory.getPair(params.tokenAddress, WBNB_TESTNET)).toLowerCase();
    if (pair !== ZeroAddress.toLowerCase()) candidateSet.add(pair);
  } catch {
    // Pair lookup is a useful enrichment, not a requirement for candidate balances.
  }
  if (env.lpVaultAddress) candidateSet.add(env.lpVaultAddress.toLowerCase());
  if (env.commissionVaultAddress) candidateSet.add(env.commissionVaultAddress.toLowerCase());

  const balances: Array<[string, bigint]> = [];
  for (const address of candidateSet) {
    const balance = BigInt((await token.balanceOf(address)).toString());
    if (balance > 0n) balances.push([address, balance]);
  }
  balances.sort((left, right) => (right[1] > left[1] ? 1 : right[1] < left[1] ? -1 : 0));
  const denominator = totalSupply > 0n
    ? totalSupply
    : balances.reduce((sum, [, balance]) => sum + balance, 0n);

  return {
    tokenAddress: params.tokenAddress,
    holderCount: balances.length,
    totalSupply: formatUnits(denominator, decimals),
    totalSupplyRaw: denominator.toString(),
    decimals,
    latestBlock,
    scannedFromBlock: params.fromBlock,
    scannedToBlock: latestBlock,
    truncated: true,
    holders: balances.slice(0, params.limit).map(([address, balance], index) => ({
      rank: index + 1,
      address,
      balance: formatUnits(balance, decimals),
      balanceRaw: balance.toString(),
      percent: denominator > 0n ? Number(((balance * 1_000_000n) / denominator)) / 10_000 : 0,
    })),
  };
};
