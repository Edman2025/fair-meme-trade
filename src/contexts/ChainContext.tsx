import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ChainConfig, ChainKey, defaultChainKey, getChainConfig, getChainConfigById, isChainKey, supportedChains } from "@/lib/chainConfig";
import { ensureWalletChain, getCurrentChainId, hasInjectedWallet, onWalletChainChanged } from "@/lib/walletAdapter";

const CHAIN_STORAGE_KEY = "fair-meme-trade-active-chain";

interface ChainContextValue {
  activeChainKey: ChainKey;
  activeChain: ChainConfig;
  chains: readonly ChainConfig[];
  walletChainId: string;
  isWalletOnActiveChain: boolean;
  switchChain: (key: ChainKey) => Promise<void>;
  ensureActiveWalletChain: () => Promise<void>;
}

const ChainContext = createContext<ChainContextValue | undefined>(undefined);

const readStoredChain = (): ChainKey => {
  if (typeof window === "undefined") return defaultChainKey;
  const stored = window.localStorage.getItem(CHAIN_STORAGE_KEY);
  return isChainKey(stored) ? stored : defaultChainKey;
};

export const ChainProvider = ({ children }: { children: ReactNode }) => {
  const [activeChainKey, setActiveChainKey] = useState<ChainKey>(readStoredChain);
  const [walletChainId, setWalletChainId] = useState("");
  const activeChain = getChainConfig(activeChainKey);

  useEffect(() => {
    window.localStorage.setItem(CHAIN_STORAGE_KEY, activeChainKey);
  }, [activeChainKey]);

  useEffect(() => {
    if (!hasInjectedWallet()) return;
    let cancelled = false;
    getCurrentChainId().then((chainId) => {
      if (!cancelled) setWalletChainId(chainId);
    }).catch(() => undefined);
    const removeListener = onWalletChainChanged((chainId) => {
      setWalletChainId(chainId);
      const supported = getChainConfigById(chainId);
      if (supported) setActiveChainKey(supported.key);
    });
    return () => {
      cancelled = true;
      removeListener();
    };
  }, []);

  const ensureActiveWalletChain = useCallback(async () => {
    if (!hasInjectedWallet()) return;
    await ensureWalletChain(activeChain);
    setWalletChainId(activeChain.chainIdHex);
  }, [activeChain]);

  const switchChain = useCallback(async (key: ChainKey) => {
    const nextChain = getChainConfig(key);
    if (hasInjectedWallet()) {
      await ensureWalletChain(nextChain);
      setWalletChainId(nextChain.chainIdHex);
    }
    setActiveChainKey(key);
  }, []);

  const value = useMemo<ChainContextValue>(() => ({
    activeChainKey,
    activeChain,
    chains: supportedChains,
    walletChainId,
    isWalletOnActiveChain: !walletChainId || walletChainId.toLowerCase() === activeChain.chainIdHex.toLowerCase(),
    switchChain,
    ensureActiveWalletChain,
  }), [activeChain, activeChainKey, ensureActiveWalletChain, switchChain, walletChainId]);

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
};

export const useChain = () => {
  const context = useContext(ChainContext);
  if (!context) throw new Error("useChain must be used within ChainProvider");
  return context;
};
