import { Interface, JsonRpcProvider, Log, ZeroAddress, formatUnits, isAddress, zeroPadValue } from "ethers";

export const ROBINHOOD_CHAIN_ID = 4663;
export const ROBINHOOD_RPC_URL = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_EXPLORER_URL = process.env.ROBINHOOD_EXPLORER_URL || "https://robinhoodchain.blockscout.com";
export const PONS_V1_FACTORY_ADDRESS = process.env.PONS_V1_FACTORY_ADDRESS || "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB";
export const PONS_V2_FACTORY_ADDRESS = process.env.PONS_V2_FACTORY_ADDRESS || "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";

const FACTORY_ABI = [
  "event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)",
];
const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function getTokenInfo() view returns (address tokenDeployer,string tokenLogo,string tokenDescription,(string twitter,string telegram,string discord,string website,string farcaster) tokenSocials)",
];
const CURVE_ABI = [
  "function getReserves() view returns (uint256 quoteReserve,uint256 tokenReserve)",
  "function realQuoteReserve() view returns (uint256)",
  "function graduated() view returns (bool)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
];
const ERC20_METADATA_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];
const MULTICALL3_ABI = [
  "function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] returnData)",
];
const MULTICALL3_ADDRESS = process.env.ROBINHOOD_MULTICALL3_ADDRESS || "0xcA11bde05977b3631167028862bE2a173976CA11";

const factoryInterface = new Interface(FACTORY_ABI);
const tokenInterface = new Interface(TOKEN_ABI);
const curveInterface = new Interface(CURVE_ABI);
const metadataInterface = new Interface(ERC20_METADATA_ABI);
const multicallInterface = new Interface(MULTICALL3_ABI);
const tokenLaunchedTopic = factoryInterface.getEvent("TokenLaunched")!.topicHash;
const provider = new JsonRpcProvider(ROBINHOOD_RPC_URL, ROBINHOOD_CHAIN_ID, { staticNetwork: true, batchMaxCount: 1 });

type RpcCall = {
  id: string;
  to: string;
  data: string;
};
type RpcBatchResponse = { id: string; result?: string; error?: { message?: string } };

type ParsedLaunch = {
  log: Log;
  tokenAddress: string;
  curveAddress: string;
  creatorAddress: string;
  pairToken: string;
  launchConfigId: number;
  graduationThreshold: bigint;
};

export interface PonsLaunch {
  chainId: number;
  protocol: "PONS_V2";
  tokenAddress: string;
  curveAddress: string;
  creatorAddress: string;
  pairToken: string;
  quoteSymbol: string;
  quoteDecimals: number;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  totalSupply: string;
  totalSupplyLabel: string;
  currentPrice: string | null;
  currentPriceLabel: string | null;
  marketCap: string | null;
  marketCapLabel: string | null;
  poolAmount: string;
  poolAmountLabel: string;
  graduationProgress: number;
  graduationThreshold: string;
  graduated: boolean;
  feeBps: number;
  creatorTaxBps: number;
  launchConfigId: number;
  blockNumber: number;
  txHash: string;
}

type LaunchFeed = {
  latestBlock: number;
  rows: PonsLaunch[];
  cached: boolean;
  failureCount: number;
  errors: string[];
};

let launchCache: { expiresAt: number; latestBlock: number; rows: PonsLaunch[] } | null = null;
const launchLookupBlocks = Math.max(100_000, Number(process.env.ROBINHOOD_PONS_LOOKBACK_BLOCKS || 5_000_000));

const normalizeMediaUrl = (value: string) => value.startsWith("ipfs://")
  ? `https://ipfs.io/ipfs/${value.slice("ipfs://".length)}`
  : value;

const compactNumber = (value: number, maximumFractionDigits = 6) => Number.isFinite(value)
  ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits }).format(value)
  : "";

const makeCall = (id: string, to: string, iface: Interface, fn: string): RpcCall => ({
  id,
  to,
  data: iface.encodeFunctionData(fn),
});

const executeMulticall = async (calls: RpcCall[]) => {
  const chunks: RpcCall[][] = [];
  for (let index = 0; index < calls.length; index += 100) chunks.push(calls.slice(index, index + 100));
  const responses = new Map<string, RpcBatchResponse>();
  for (const chunk of chunks) {
    const data = multicallInterface.encodeFunctionData("aggregate3", [
      chunk.map((call) => ({ target: call.to, allowFailure: true, callData: call.data })),
    ]);
    let raw = "";
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        raw = await provider.call({ to: MULTICALL3_ADDRESS, data });
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
      }
    }
    if (!raw) throw new Error(`Robinhood multicall failed: ${lastError instanceof Error ? lastError.message : "no response"}`);
    const decoded = multicallInterface.decodeFunctionResult("aggregate3", raw)[0] as readonly { success: boolean; returnData: string }[];
    decoded.forEach((result, index) => {
      responses.set(chunk[index].id, result.success
        ? { id: chunk[index].id, result: result.returnData }
        : { id: chunk[index].id, error: { message: "contract call reverted" } });
    });
  }
  return responses;
};

const decode = (responses: Map<string, RpcBatchResponse>, id: string, iface: Interface, fn: string) => {
  const response = responses.get(id);
  if (!response?.result || response.error) throw new Error(`${id}: ${response?.error?.message || "missing RPC result"}`);
  return iface.decodeFunctionResult(fn, response.result);
};

const parseLaunch = (log: Log): ParsedLaunch => {
  const parsed = factoryInterface.parseLog(log);
  if (!parsed) throw new Error(`Unable to decode PONS event ${log.transactionHash}`);
  return {
    log,
    tokenAddress: String(parsed.args.token),
    curveAddress: String(parsed.args.curve),
    creatorAddress: String(parsed.args.deployer),
    pairToken: String(parsed.args.pairToken),
    launchConfigId: Number(parsed.args.launchConfigId),
    graduationThreshold: BigInt(parsed.args.graduationThreshold),
  };
};

const buildBatchCalls = (launches: ParsedLaunch[]) => {
  const calls: RpcCall[] = [];
  const quoteTokens = new Set<string>();
  launches.forEach((launch, index) => {
    calls.push(
      makeCall(`${index}:name`, launch.tokenAddress, tokenInterface, "name"),
      makeCall(`${index}:symbol`, launch.tokenAddress, tokenInterface, "symbol"),
      makeCall(`${index}:totalSupply`, launch.tokenAddress, tokenInterface, "totalSupply"),
      makeCall(`${index}:tokenInfo`, launch.tokenAddress, tokenInterface, "getTokenInfo"),
      makeCall(`${index}:reserves`, launch.curveAddress, curveInterface, "getReserves"),
      makeCall(`${index}:realQuote`, launch.curveAddress, curveInterface, "realQuoteReserve"),
      makeCall(`${index}:graduated`, launch.curveAddress, curveInterface, "graduated"),
      makeCall(`${index}:feeBps`, launch.curveAddress, curveInterface, "feeBps"),
      makeCall(`${index}:creatorTaxBps`, launch.curveAddress, curveInterface, "creatorTaxBps"),
    );
    if (launch.pairToken.toLowerCase() !== ZeroAddress.toLowerCase()) quoteTokens.add(launch.pairToken.toLowerCase());
  });
  quoteTokens.forEach((address) => {
    calls.push(
      makeCall(`quote:${address}:symbol`, address, metadataInterface, "symbol"),
      makeCall(`quote:${address}:decimals`, address, metadataInterface, "decimals"),
    );
  });
  return calls;
};

const launchFromBatch = (launch: ParsedLaunch, index: number, responses: Map<string, RpcBatchResponse>): PonsLaunch => {
  const name = String(decode(responses, `${index}:name`, tokenInterface, "name")[0]);
  const symbol = String(decode(responses, `${index}:symbol`, tokenInterface, "symbol")[0]);
  const totalSupplyRaw = BigInt(decode(responses, `${index}:totalSupply`, tokenInterface, "totalSupply")[0]);
  const reserves = decode(responses, `${index}:reserves`, curveInterface, "getReserves");
  const realQuoteRaw = BigInt(decode(responses, `${index}:realQuote`, curveInterface, "realQuoteReserve")[0]);
  const graduated = Boolean(decode(responses, `${index}:graduated`, curveInterface, "graduated")[0]);
  const feeBps = Number(decode(responses, `${index}:feeBps`, curveInterface, "feeBps")[0]);
  const creatorTaxBps = Number(decode(responses, `${index}:creatorTaxBps`, curveInterface, "creatorTaxBps")[0]);
  let logo = "";
  let description = "";
  let twitter = "";
  let telegram = "";
  let website = "";
  try {
    const info = decode(responses, `${index}:tokenInfo`, tokenInterface, "getTokenInfo");
    logo = normalizeMediaUrl(String(info[1] || ""));
    description = String(info[2] || "");
    const socials = info[3] as readonly string[];
    twitter = String(socials?.[0] || "");
    telegram = String(socials?.[1] || "");
    website = String(socials?.[3] || "");
  } catch {
    // Metadata is optional; contract identity and reserves remain verifiable.
  }
  let quoteSymbol = "ETH";
  let quoteDecimals = 18;
  if (launch.pairToken.toLowerCase() !== ZeroAddress.toLowerCase()) {
    const quoteKey = launch.pairToken.toLowerCase();
    quoteSymbol = String(decode(responses, `quote:${quoteKey}:symbol`, metadataInterface, "symbol")[0]);
    quoteDecimals = Number(decode(responses, `quote:${quoteKey}:decimals`, metadataInterface, "decimals")[0]);
  }
  const totalSupply = Number(formatUnits(totalSupplyRaw, 18));
  const quoteReserve = Number(formatUnits(BigInt(reserves[0]), quoteDecimals));
  const tokenReserve = Number(formatUnits(BigInt(reserves[1]), 18));
  const realQuote = Number(formatUnits(realQuoteRaw, quoteDecimals));
  const threshold = Number(formatUnits(launch.graduationThreshold, quoteDecimals));
  const currentPrice = quoteReserve > 0 && tokenReserve > 0 ? quoteReserve / tokenReserve : null;
  const marketCap = currentPrice === null ? null : currentPrice * totalSupply;
  return {
    chainId: ROBINHOOD_CHAIN_ID,
    protocol: "PONS_V2",
    tokenAddress: launch.tokenAddress,
    curveAddress: launch.curveAddress,
    creatorAddress: launch.creatorAddress,
    pairToken: launch.pairToken,
    quoteSymbol,
    quoteDecimals,
    name,
    symbol,
    logo,
    description,
    twitter,
    telegram,
    website,
    totalSupply: formatUnits(totalSupplyRaw, 18),
    totalSupplyLabel: compactNumber(totalSupply, 2),
    currentPrice: currentPrice === null ? null : String(currentPrice),
    currentPriceLabel: currentPrice === null ? null : `${currentPrice.toPrecision(6)} ${quoteSymbol}`,
    marketCap: marketCap === null ? null : String(marketCap),
    marketCapLabel: marketCap === null ? null : `${compactNumber(marketCap, 4)} ${quoteSymbol}`,
    poolAmount: String(realQuote),
    poolAmountLabel: `${compactNumber(realQuote, 6)} ${quoteSymbol}`,
    graduationProgress: threshold > 0 ? Math.min(100, Number(((realQuote / threshold) * 100).toFixed(2))) : 0,
    graduationThreshold: formatUnits(launch.graduationThreshold, quoteDecimals),
    graduated,
    feeBps,
    creatorTaxBps,
    launchConfigId: launch.launchConfigId,
    blockNumber: launch.log.blockNumber,
    txHash: launch.log.transactionHash,
  };
};

export const getRobinhoodStatus = async () => {
  const [blockNumber, factoryCode] = await Promise.all([provider.getBlockNumber(), provider.getCode(PONS_V2_FACTORY_ADDRESS)]);
  return {
    key: "robinhood-mainnet",
    chainId: ROBINHOOD_CHAIN_ID,
    rpcUrl: ROBINHOOD_RPC_URL,
    explorerUrl: ROBINHOOD_EXPLORER_URL,
    latestBlock: blockNumber,
    ponsV1FactoryAddress: PONS_V1_FACTORY_ADDRESS,
    ponsV2FactoryAddress: PONS_V2_FACTORY_ADDRESS,
    ponsV2FactoryAvailable: factoryCode !== "0x",
  };
};

export const getRobinhoodPonsLaunches = async (requestedLimit = 18): Promise<LaunchFeed> => {
  const limit = Math.max(1, Math.min(30, Math.floor(requestedLimit)));
  const now = Date.now();
  if (launchCache && launchCache.expiresAt > now && launchCache.rows.length >= limit) {
    return { latestBlock: launchCache.latestBlock, rows: launchCache.rows.slice(0, limit), cached: true, failureCount: 0, errors: [] };
  }
  try {
    const latestBlock = await provider.getBlockNumber();
    const logs = await provider.getLogs({
      address: PONS_V2_FACTORY_ADDRESS,
      topics: [tokenLaunchedTopic],
      fromBlock: Math.max(0, latestBlock - 1_000),
      toBlock: latestBlock,
    });
    const launches = logs
      .sort((left, right) => right.blockNumber - left.blockNumber || right.index - left.index)
      .slice(0, limit)
      .map(parseLaunch);
    const responses = await executeMulticall(buildBatchCalls(launches));
    const rows: PonsLaunch[] = [];
    const errors: string[] = [];
    launches.forEach((launch, index) => {
      try {
        rows.push(launchFromBatch(launch, index, responses));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    });
    const retainedRows = launchCache?.rows || [];
    const rowsByAddress = new Map(retainedRows.map((row) => [row.tokenAddress.toLowerCase(), row]));
    rows.forEach((row) => rowsByAddress.set(row.tokenAddress.toLowerCase(), row));
    const cachedRows = Array.from(rowsByAddress.values())
      .sort((left, right) => right.blockNumber - left.blockNumber)
      .slice(0, 500);
    launchCache = { expiresAt: now + 60_000, latestBlock, rows: cachedRows };
    return { latestBlock, rows, cached: false, failureCount: launches.length - rows.length, errors: errors.slice(0, 3) };
  } catch (error) {
    if (launchCache?.rows.length) {
      return {
        latestBlock: launchCache.latestBlock,
        rows: launchCache.rows.slice(0, limit),
        cached: true,
        failureCount: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
    throw error;
  }
};

export const getRobinhoodPonsLaunch = async (tokenAddress: string): Promise<PonsLaunch | null> => {
  if (!isAddress(tokenAddress)) return null;
  const normalized = tokenAddress.toLowerCase();
  const cached = launchCache?.rows.find((row) => row.tokenAddress.toLowerCase() === normalized);
  if (cached && launchCache && launchCache.expiresAt > Date.now()) return cached;

  const latestBlock = await provider.getBlockNumber();
  const logs = await provider.getLogs({
    address: PONS_V2_FACTORY_ADDRESS,
    topics: [tokenLaunchedTopic, zeroPadValue(tokenAddress, 32)],
    fromBlock: Math.max(0, latestBlock - launchLookupBlocks),
    toBlock: latestBlock,
  });
  const launchLog = logs.sort((left, right) => right.blockNumber - left.blockNumber || right.index - left.index)[0];
  if (!launchLog) return null;

  const launch = parseLaunch(launchLog);
  const responses = await executeMulticall(buildBatchCalls([launch]));
  const row = launchFromBatch(launch, 0, responses);
  const retainedRows = launchCache?.rows || [];
  launchCache = {
    expiresAt: Math.max(launchCache?.expiresAt || 0, Date.now() + 60_000),
    latestBlock,
    rows: [row, ...retainedRows.filter((item) => item.tokenAddress.toLowerCase() !== normalized)]
      .sort((left, right) => right.blockNumber - left.blockNumber)
      .slice(0, 500),
  };
  return row;
};
