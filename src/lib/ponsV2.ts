import { Interface, ZeroAddress, formatUnits, parseUnits } from "ethers";
import { robinhoodMainnetConfig } from "@/lib/chainConfig";
import { ensureWalletChain, requestAccounts, sendValueTransaction, waitForTransactionReceipt } from "@/lib/walletAdapter";

const CURVE_ABI = [
  "function getReserves() view returns (uint256 quoteReserve,uint256 tokenReserve)",
  "function sellableTokens() view returns (uint256)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function buy(uint256 quoteIn,uint256 minTokensOut,address recipient) payable returns (uint256 tokensOut)",
  "function sell(uint256 tokensIn,uint256 minQuoteOut,address recipient) returns (uint256 quoteOut)",
];
const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

const curveInterface = new Interface(CURVE_ABI);
const erc20Interface = new Interface(ERC20_ABI);

const provider = () => {
  if (!window.ethereum) throw new Error("未检测到注入钱包");
  return window.ethereum;
};

const ethCall = async (to: string, data: string) => provider().request<string>({
  method: "eth_call",
  params: [{ to, data }, "latest"],
});

const readUint = async (to: string, iface: Interface, fn: string, args: unknown[] = []) => {
  const raw = await ethCall(to, iface.encodeFunctionData(fn, args));
  const decoded = iface.decodeFunctionResult(fn, raw);
  return BigInt(decoded[0]);
};

export interface PonsCurveQuote {
  side: "buy" | "sell";
  amountIn: string;
  amountOut: string;
  minOut: string;
  feeBps: number;
  creatorTaxBps: number;
  priceImpactPercent: number;
}

const applySlippage = (amount: bigint, slippagePercent: number) => {
  const keepBps = BigInt(Math.max(0, Math.min(10_000, Math.floor((100 - slippagePercent) * 100))));
  return amount * keepBps / 10_000n;
};

export const quotePonsCurve = async (params: {
  curveAddress: string;
  side: "buy" | "sell";
  amount: string;
  quoteDecimals: number;
  slippagePercent: number;
}): Promise<PonsCurveQuote> => {
  const [reservesRaw, sellableTokens, feeBpsRaw, creatorTaxBpsRaw] = await Promise.all([
    ethCall(params.curveAddress, curveInterface.encodeFunctionData("getReserves")),
    readUint(params.curveAddress, curveInterface, "sellableTokens"),
    readUint(params.curveAddress, curveInterface, "feeBps"),
    readUint(params.curveAddress, curveInterface, "creatorTaxBps"),
  ]);
  const reserves = curveInterface.decodeFunctionResult("getReserves", reservesRaw);
  const quoteReserve = BigInt(reserves[0]);
  const tokenReserve = BigInt(reserves[1]);
  const feeBps = feeBpsRaw + creatorTaxBpsRaw;
  const amountIn = parseUnits(params.amount, params.side === "buy" ? params.quoteDecimals : 18);
  if (amountIn <= 0n) throw new Error("请输入大于 0 的交易数量");

  let amountOut: bigint;
  let reserveIn: bigint;
  if (params.side === "buy") {
    const netIn = amountIn * (10_000n - feeBps) / 10_000n;
    amountOut = netIn * tokenReserve / (quoteReserve + netIn);
    if (amountOut > sellableTokens) amountOut = sellableTokens;
    reserveIn = quoteReserve;
  } else {
    const grossOut = amountIn * quoteReserve / (tokenReserve + amountIn);
    amountOut = grossOut * (10_000n - feeBps) / 10_000n;
    reserveIn = tokenReserve;
  }
  if (amountOut <= 0n) throw new Error("当前储备无法完成该笔交易");
  const priceImpactPercent = Number(amountIn * 10_000n / (reserveIn + amountIn)) / 100;
  const outputDecimals = params.side === "buy" ? 18 : params.quoteDecimals;
  return {
    side: params.side,
    amountIn: formatUnits(amountIn, params.side === "buy" ? params.quoteDecimals : 18),
    amountOut: formatUnits(amountOut, outputDecimals),
    minOut: formatUnits(applySlippage(amountOut, params.slippagePercent), outputDecimals),
    feeBps: Number(feeBpsRaw),
    creatorTaxBps: Number(creatorTaxBpsRaw),
    priceImpactPercent,
  };
};

export const getPonsAssetBalance = async (assetAddress: string, owner: string, decimals: number) => {
  if (assetAddress.toLowerCase() === ZeroAddress.toLowerCase()) {
    const raw = await provider().request<string>({ method: "eth_getBalance", params: [owner, "latest"] });
    return formatUnits(BigInt(raw), decimals);
  }
  const balance = await readUint(assetAddress, erc20Interface, "balanceOf", [owner]);
  return formatUnits(balance, decimals);
};

const ensureAllowance = async (tokenAddress: string, owner: string, spender: string, amount: bigint) => {
  const allowance = await readUint(tokenAddress, erc20Interface, "allowance", [owner, spender]);
  if (allowance >= amount) return;
  const approve = await sendValueTransaction({
    to: tokenAddress,
    data: erc20Interface.encodeFunctionData("approve", [spender, amount]),
  });
  await waitForTransactionReceipt(approve.txHash);
};

export const buyPonsCurveToken = async (params: {
  curveAddress: string;
  pairTokenAddress: string;
  amount: string;
  quoteDecimals: number;
  slippagePercent: number;
}) => {
  await ensureWalletChain(robinhoodMainnetConfig);
  const [account] = await requestAccounts();
  if (!account) throw new Error("钱包未连接");
  const quote = await quotePonsCurve({ ...params, side: "buy" });
  const amountIn = parseUnits(params.amount, params.quoteDecimals);
  const nativeQuote = params.pairTokenAddress.toLowerCase() === ZeroAddress.toLowerCase();
  if (!nativeQuote) await ensureAllowance(params.pairTokenAddress, account, params.curveAddress, amountIn);
  const transaction = await sendValueTransaction({
    to: params.curveAddress,
    valueHex: nativeQuote ? `0x${amountIn.toString(16)}` : "0x0",
    data: curveInterface.encodeFunctionData("buy", [amountIn, parseUnits(quote.minOut, 18), account]),
  });
  return { ...transaction, quote };
};

export const sellPonsCurveToken = async (params: {
  curveAddress: string;
  tokenAddress: string;
  amount: string;
  quoteDecimals: number;
  slippagePercent: number;
}) => {
  await ensureWalletChain(robinhoodMainnetConfig);
  const [account] = await requestAccounts();
  if (!account) throw new Error("钱包未连接");
  const amountIn = parseUnits(params.amount, 18);
  await ensureAllowance(params.tokenAddress, account, params.curveAddress, amountIn);
  const quote = await quotePonsCurve({ ...params, side: "sell" });
  const transaction = await sendValueTransaction({
    to: params.curveAddress,
    data: curveInterface.encodeFunctionData("sell", [amountIn, parseUnits(quote.minOut, params.quoteDecimals), account]),
  });
  return { ...transaction, quote };
};
