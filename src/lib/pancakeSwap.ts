import { Interface, formatUnits, parseUnits } from "ethers";
import { bscTestnetConfig } from "@/lib/chainConfig";
import { ensureWalletChain, waitForTransactionReceipt } from "@/lib/walletAdapter";

const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn,address[] calldata path) external view returns (uint256[] memory amounts)",
  "function addLiquidityETH(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) external payable returns (uint256 amountToken,uint256 amountETH,uint256 liquidity)",
  "function swapExactETHForTokens(uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) external payable returns (uint256[] memory amounts)",
  "function swapExactTokensForETH(uint256 amountIn,uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) external returns (uint256[] memory amounts)",
];

const ERC20_ABI = [
  "function allowance(address owner,address spender) external view returns (uint256)",
  "function approve(address spender,uint256 value) external returns (bool)",
  "function balanceOf(address owner) external view returns (uint256)",
];

const FACTORY_ABI = [
  "function getPair(address tokenA,address tokenB) external view returns (address pair)",
];

const VAULT_ABI = [
  "function lock(address lpToken,address projectToken,uint256 amount,uint256 unlockAt,uint8 releaseType,uint256 releaseStart,uint256 releaseEnd) returns (uint256 positionId)",
  "function releaseAmount(uint256 positionId,uint256 amount)",
  "function withdraw(uint256 positionId)",
];

const routerInterface = new Interface(ROUTER_ABI);
const erc20Interface = new Interface(ERC20_ABI);
const factoryInterface = new Interface(FACTORY_ABI);
const vaultInterface = new Interface(VAULT_ABI);

const getProvider = () => {
  if (!window.ethereum) throw new Error("未检测到注入钱包");
  return window.ethereum;
};

const getAccount = async () => {
  const provider = getProvider();
  const accounts = await provider.request<string[]>({ method: "eth_requestAccounts" });
  if (!accounts[0]) throw new Error("钱包未连接");
  return accounts[0];
};

const ethCall = async (to: string, data: string) => {
  const provider = getProvider();
  return provider.request<string>({
    method: "eth_call",
    params: [{ to, data }, "latest"],
  });
};

const sendTransaction = async (tx: { from: string; to: string; data: string; value?: string }) => {
  const provider = getProvider();
  return provider.request<string>({
    method: "eth_sendTransaction",
    params: [tx],
  });
};

const toHexQuantity = (value: bigint) => `0x${value.toString(16)}`;

export interface PancakeQuote {
  amountIn: string;
  amountOut: string;
  minOut: string;
  path: string[];
}

export const quoteBnbToToken = async (tokenAddress: string, bnbAmount: string, slippagePercent: number): Promise<PancakeQuote> => {
  const amountIn = parseUnits(bnbAmount || "0", 18);
  if (amountIn <= 0n) throw new Error("请输入有效买入金额");
  const path = [bscTestnetConfig.wbnbAddress!, tokenAddress];
  const data = routerInterface.encodeFunctionData("getAmountsOut", [amountIn, path]);
  const raw = await ethCall(bscTestnetConfig.pancakeRouterAddress!, data);
  const [amounts] = routerInterface.decodeFunctionResult("getAmountsOut", raw) as unknown as [bigint[]];
  const amountOut = amounts[amounts.length - 1];
  const minOut = amountOut * BigInt(Math.max(0, Math.floor((100 - slippagePercent) * 100))) / 10000n;
  return {
    amountIn: formatUnits(amountIn, 18),
    amountOut: formatUnits(amountOut, 18),
    minOut: formatUnits(minOut, 18),
    path,
  };
};

export const quoteTokenToBnb = async (tokenAddress: string, tokenAmount: string, slippagePercent: number): Promise<PancakeQuote> => {
  const amountIn = parseUnits(tokenAmount || "0", 18);
  if (amountIn <= 0n) throw new Error("请输入有效卖出数量");
  const path = [tokenAddress, bscTestnetConfig.wbnbAddress!];
  const data = routerInterface.encodeFunctionData("getAmountsOut", [amountIn, path]);
  const raw = await ethCall(bscTestnetConfig.pancakeRouterAddress!, data);
  const [amounts] = routerInterface.decodeFunctionResult("getAmountsOut", raw) as unknown as [bigint[]];
  const amountOut = amounts[amounts.length - 1];
  const minOut = amountOut * BigInt(Math.max(0, Math.floor((100 - slippagePercent) * 100))) / 10000n;
  return {
    amountIn: formatUnits(amountIn, 18),
    amountOut: formatUnits(amountOut, 18),
    minOut: formatUnits(minOut, 18),
    path,
  };
};

export const swapExactBnbForTokens = async (tokenAddress: string, bnbAmount: string, slippagePercent: number) => {
  await ensureWalletChain(bscTestnetConfig);
  const account = await getAccount();
  const quote = await quoteBnbToToken(tokenAddress, bnbAmount, slippagePercent);
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
  const data = routerInterface.encodeFunctionData("swapExactETHForTokens", [
    parseUnits(quote.minOut, 18),
    quote.path,
    account,
    deadline,
  ]);
  const txHash = await sendTransaction({
    from: account,
    to: bscTestnetConfig.pancakeRouterAddress!,
    value: toHexQuantity(parseUnits(bnbAmount, 18)),
    data,
  });
  return { txHash, quote };
};

export const swapExactTokensForBnb = async (tokenAddress: string, tokenAmount: string, slippagePercent: number) => {
  await ensureWalletChain(bscTestnetConfig);
  const account = await getAccount();
  const amountIn = parseUnits(tokenAmount, 18);
  const allowanceData = erc20Interface.encodeFunctionData("allowance", [account, bscTestnetConfig.pancakeRouterAddress]);
  const allowanceRaw = await ethCall(tokenAddress, allowanceData);
  const [allowance] = erc20Interface.decodeFunctionResult("allowance", allowanceRaw) as unknown as [bigint];
  if (allowance < amountIn) {
    const approveData = erc20Interface.encodeFunctionData("approve", [bscTestnetConfig.pancakeRouterAddress, amountIn]);
    const approveTxHash = await sendTransaction({ from: account, to: tokenAddress, data: approveData });
    await waitForTransactionReceipt(approveTxHash);
  }
  const quote = await quoteTokenToBnb(tokenAddress, tokenAmount, slippagePercent);
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
  const data = routerInterface.encodeFunctionData("swapExactTokensForETH", [
    amountIn,
    parseUnits(quote.minOut, 18),
    quote.path,
    account,
    deadline,
  ]);
  const txHash = await sendTransaction({
    from: account,
    to: bscTestnetConfig.pancakeRouterAddress!,
    data,
  });
  return { txHash, quote };
};

export const getTokenBalance = async (tokenAddress: string, owner: string) => {
  const data = erc20Interface.encodeFunctionData("balanceOf", [owner]);
  const raw = await ethCall(tokenAddress, data);
  const [balance] = erc20Interface.decodeFunctionResult("balanceOf", raw) as unknown as [bigint];
  return balance;
};

export const getPancakePair = async (tokenAddress: string) => {
  const data = factoryInterface.encodeFunctionData("getPair", [tokenAddress, bscTestnetConfig.wbnbAddress]);
  const raw = await ethCall(bscTestnetConfig.pancakeFactoryAddress!, data);
  const [pair] = factoryInterface.decodeFunctionResult("getPair", raw) as unknown as [string];
  return pair;
};

export const getPendingLpBalance = async (tokenAddress: string, owner: string) => {
  const pairAddress = await getPancakePair(tokenAddress);
  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    return { pairAddress, balance: 0n };
  }
  return { pairAddress, balance: await getTokenBalance(pairAddress, owner) };
};

export const lockExistingLpPosition = async (params: {
  tokenAddress: string;
  unlockAt: number;
  releaseType?: "once" | "linear";
  releaseStart?: number;
  releaseEnd?: number;
}) => {
  await ensureWalletChain(bscTestnetConfig);
  const account = await getAccount();
  const { pairAddress, balance } = await getPendingLpBalance(params.tokenAddress, account);
  if (balance <= 0n) throw new Error("当前钱包没有待锁仓的 Pancake LP Token。");

  const allowanceData = erc20Interface.encodeFunctionData("allowance", [account, bscTestnetConfig.lpVaultAddress]);
  const allowanceRaw = await ethCall(pairAddress, allowanceData);
  const [allowance] = erc20Interface.decodeFunctionResult("allowance", allowanceRaw) as unknown as [bigint];
  if (allowance < balance) {
    const approveData = erc20Interface.encodeFunctionData("approve", [bscTestnetConfig.lpVaultAddress, balance]);
    const approveTxHash = await sendTransaction({ from: account, to: pairAddress, data: approveData });
    await waitForTransactionReceipt(approveTxHash);
  }

  const lockData = vaultInterface.encodeFunctionData("lock", [
    pairAddress,
    params.tokenAddress,
    balance,
    BigInt(params.unlockAt),
    params.releaseType === "linear" ? 1 : 0,
    BigInt(params.releaseStart || params.unlockAt),
    BigInt(params.releaseEnd || params.releaseStart || params.unlockAt),
  ]);
  const lockTxHash = await sendTransaction({ from: account, to: bscTestnetConfig.lpVaultAddress!, data: lockData });
  await waitForTransactionReceipt(lockTxHash);
  return { pairAddress, lockTxHash, lpAmount: formatUnits(balance, 18), account };
};

export const addLiquidityEthAndLock = async (params: {
  tokenAddress: string;
  tokenAmount: string;
  bnbAmount: string;
  slippagePercent: number;
  unlockAt: number;
  releaseType?: "once" | "linear";
  releaseStart?: number;
  releaseEnd?: number;
  onStep?: (step: "approveToken" | "addLiquidity" | "approveLp" | "lockLp", txHash?: string) => void;
}) => {
  await ensureWalletChain(bscTestnetConfig);
  const account = await getAccount();
  const tokenAmount = parseUnits(params.tokenAmount, 18);
  const bnbAmount = parseUnits(params.bnbAmount, 18);
  const slippageBps = BigInt(Math.max(0, Math.floor((100 - params.slippagePercent) * 100)));
  const tokenMin = tokenAmount * slippageBps / 10000n;
  const bnbMin = bnbAmount * slippageBps / 10000n;

  const tokenAllowanceData = erc20Interface.encodeFunctionData("allowance", [account, bscTestnetConfig.pancakeRouterAddress]);
  const tokenAllowanceRaw = await ethCall(params.tokenAddress, tokenAllowanceData);
  const [tokenAllowance] = erc20Interface.decodeFunctionResult("allowance", tokenAllowanceRaw) as unknown as [bigint];
  if (tokenAllowance < tokenAmount) {
    params.onStep?.("approveToken");
    const approveData = erc20Interface.encodeFunctionData("approve", [bscTestnetConfig.pancakeRouterAddress, tokenAmount]);
    const tokenApproveTxHash = await sendTransaction({ from: account, to: params.tokenAddress, data: approveData });
    params.onStep?.("approveToken", tokenApproveTxHash);
    await waitForTransactionReceipt(tokenApproveTxHash);
  }

  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
  const addData = routerInterface.encodeFunctionData("addLiquidityETH", [
    params.tokenAddress,
    tokenAmount,
    tokenMin,
    bnbMin,
    account,
    deadline,
  ]);
  params.onStep?.("addLiquidity");
  const addLiquidityTxHash = await sendTransaction({
    from: account,
    to: bscTestnetConfig.pancakeRouterAddress!,
    value: toHexQuantity(bnbAmount),
    data: addData,
  });
  params.onStep?.("addLiquidity", addLiquidityTxHash);
  await waitForTransactionReceipt(addLiquidityTxHash);

  const pairAddress = await getPancakePair(params.tokenAddress);
  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Pancake pair 尚未创建，请等待 add liquidity 交易确认后重试锁仓");
  }

  const lpBalance = await getTokenBalance(pairAddress, account);
  if (lpBalance <= 0n) {
    return {
      addLiquidityTxHash,
      pairAddress,
      lockTxHash: "",
      message: "流动性交易已提交，请确认后再次点击锁仓",
    };
  }

  const lpAllowanceData = erc20Interface.encodeFunctionData("allowance", [account, bscTestnetConfig.lpVaultAddress]);
  const lpAllowanceRaw = await ethCall(pairAddress, lpAllowanceData);
  const [lpAllowance] = erc20Interface.decodeFunctionResult("allowance", lpAllowanceRaw) as unknown as [bigint];
  if (lpAllowance < lpBalance) {
    params.onStep?.("approveLp");
    const approveLpData = erc20Interface.encodeFunctionData("approve", [bscTestnetConfig.lpVaultAddress, lpBalance]);
    const lpApproveTxHash = await sendTransaction({ from: account, to: pairAddress, data: approveLpData });
    params.onStep?.("approveLp", lpApproveTxHash);
    await waitForTransactionReceipt(lpApproveTxHash);
  }

  const lockData = vaultInterface.encodeFunctionData("lock", [
    pairAddress,
    params.tokenAddress,
    lpBalance,
    BigInt(params.unlockAt),
    params.releaseType === "linear" ? 1 : 0,
    BigInt(params.releaseStart || params.unlockAt),
    BigInt(params.releaseEnd || params.releaseStart || params.unlockAt),
  ]);
  params.onStep?.("lockLp");
  const lockTxHash = await sendTransaction({
    from: account,
    to: bscTestnetConfig.lpVaultAddress!,
    data: lockData,
  });
  params.onStep?.("lockLp", lockTxHash);
  await waitForTransactionReceipt(lockTxHash);

  return {
    addLiquidityTxHash,
    pairAddress,
    lockTxHash,
    lpAmount: formatUnits(lpBalance, 18),
  };
};

export const withdrawVaultPosition = async (positionId: number) => {
  await ensureWalletChain(bscTestnetConfig);
  const account = await getAccount();
  const data = vaultInterface.encodeFunctionData("withdraw", [positionId]);
  const txHash = await sendTransaction({
    from: account,
    to: bscTestnetConfig.lpVaultAddress!,
    data,
  });
  return { txHash, account };
};

export const releaseVaultPositionAmount = async (positionId: number, amount: string) => {
  await ensureWalletChain(bscTestnetConfig);
  const account = await getAccount();
  const data = vaultInterface.encodeFunctionData("releaseAmount", [positionId, parseUnits(amount, 18)]);
  const txHash = await sendTransaction({
    from: account,
    to: bscTestnetConfig.lpVaultAddress!,
    data,
  });
  return { txHash, account };
};
