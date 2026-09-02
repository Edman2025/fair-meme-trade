import type { ChainConfig } from "@/lib/chainConfig";

export interface WalletSignatureResult {
  address: string;
  message: string;
  signature: string;
  signedAt: string;
  mode: "wallet" | "demo";
}

export interface ChainTransactionRequest {
  to: string;
  valueHex?: string;
  data?: string;
}

export interface ChainTxResult {
  txHash: string;
  status: "submitted" | "failed";
}

export interface WalletTransactionReceipt {
  transactionHash: string;
  blockNumber: string;
  status: string;
  logs: Array<{ address: string; topics: string[]; data: string }>;
}

interface EthereumProvider {
  request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
  on?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const getProvider = () => (typeof window !== "undefined" ? window.ethereum : undefined);

export const getWalletErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== "object") return error instanceof Error ? error.message : fallback;
  const value = error as {
    code?: number;
    message?: string;
    shortMessage?: string;
    reason?: string;
    data?: { message?: string };
    info?: { error?: { message?: string } };
  };
  if (value.code === 4001) return "用户取消了钱包交易确认。";
  return value.shortMessage
    || value.reason
    || value.data?.message
    || value.info?.error?.message
    || value.message
    || fallback;
};

export const hasInjectedWallet = () => Boolean(getProvider());

export const requestAccounts = async () => {
  const provider = getProvider();
  if (!provider) {
    throw new Error("未检测到注入钱包");
  }
  return provider.request<string[]>({ method: "eth_requestAccounts" });
};

export const getConnectedAccounts = async () => {
  const provider = getProvider();
  if (!provider) return [];
  return provider.request<string[]>({ method: "eth_accounts" });
};

export const onWalletAccountsChanged = (handler: (accounts: string[]) => void) => {
  const provider = getProvider();
  if (!provider?.on) return () => undefined;
  const listener = (accounts: unknown) => handler(Array.isArray(accounts) ? accounts.map(String) : []);
  provider.on("accountsChanged", listener);
  return () => provider.removeListener?.("accountsChanged", listener);
};

export const onWalletChainChanged = (handler: (chainId: string) => void) => {
  const provider = getProvider();
  if (!provider?.on) return () => undefined;
  const listener = (chainId: unknown) => handler(String(chainId || ""));
  provider.on("chainChanged", listener);
  return () => provider.removeListener?.("chainChanged", listener);
};

export const getCurrentChainId = async () => {
  const provider = getProvider();
  if (!provider) {
    throw new Error("未检测到注入钱包");
  }
  return provider.request<string>({ method: "eth_chainId" });
};

export const ensureWalletChain = async (config: ChainConfig) => {
  const provider = getProvider();
  if (!provider) {
    throw new Error("未检测到注入钱包");
  }

  const currentChainId = await getCurrentChainId();
  if (currentChainId.toLowerCase() === config.chainIdHex.toLowerCase()) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: config.chainIdHex }],
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number(error.code) : 0;
    if (code !== 4902) {
      throw error;
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: config.chainIdHex,
        chainName: config.chainName,
        nativeCurrency: config.nativeCurrency,
        rpcUrls: config.rpcUrls,
        blockExplorerUrls: config.blockExplorerUrls,
      }],
    });
  }
};

export const signLoginMessage = async (address: string): Promise<WalletSignatureResult> => {
  const provider = getProvider();
  if (!provider) {
    throw new Error("未检测到注入钱包");
  }

  const signedAt = new Date().toISOString();
  const message = [
    "Fair Meme Trade 登录签名",
    `钱包: ${address}`,
    `时间: ${signedAt}`,
    "用途: 证明钱包所有权，不会发起链上交易。",
  ].join("\n");

  const signature = await provider.request<string>({
    method: "personal_sign",
    params: [message, address],
  });

  return {
    address,
    message,
    signature,
    signedAt,
    mode: "wallet",
  };
};

export const personalSign = async (address: string, message: string) => {
  const provider = getProvider();
  if (!provider) {
    throw new Error("未检测到注入钱包");
  }

  return provider.request<string>({
    method: "personal_sign",
    params: [message, address],
  });
};

export const getNativeBalance = async (address: string) => {
  const provider = getProvider();
  if (!provider) {
    throw new Error("未检测到注入钱包");
  }
  return provider.request<string>({
    method: "eth_getBalance",
    params: [address, "latest"],
  });
};

export const sendValueTransaction = async (request: ChainTransactionRequest): Promise<ChainTxResult> => {
  const provider = getProvider();
  if (!provider) {
    throw new Error("未检测到注入钱包");
  }

  const accounts = await provider.request<string[]>({ method: "eth_accounts" });
  const from = accounts[0];
  if (!from) {
    throw new Error("钱包未连接");
  }

  const txHash = await provider.request<string>({
    method: "eth_sendTransaction",
    params: [{
      from,
      to: request.to,
      value: request.valueHex || "0x0",
      data: request.data || "0x",
    }],
  });

  return {
    txHash,
    status: "submitted",
  };
};

export const waitForTransactionReceipt = async (
  txHash: string,
  timeoutMs = 180_000,
  pollIntervalMs = 1_500,
): Promise<WalletTransactionReceipt> => {
  const provider = getProvider();
  if (!provider) throw new Error("未检测到注入钱包");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await provider.request<WalletTransactionReceipt | null>({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });
    if (receipt) {
      if (BigInt(receipt.status || "0x0") !== 1n) {
        throw new Error(`链上交易执行失败：${txHash}`);
      }
      return receipt;
    }
    await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`等待链上确认超时：${txHash}`);
};
