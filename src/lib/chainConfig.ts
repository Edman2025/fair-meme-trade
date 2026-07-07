export interface ChainConfig {
  chainIdHex: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  factoryAddress?: string;
  factoryVersion?: "V1" | "V2" | "V3";
  lpVaultAddress?: string;
  commissionVaultAddress?: string;
  pancakeRouterAddress?: string;
  pancakeFactoryAddress?: string;
  wbnbAddress?: string;
  nativePairAddresses?: string[];
}

const env = import.meta.env;

export const bscTestnetConfig: ChainConfig = {
  chainIdHex: env.VITE_CHAIN_ID_HEX || "0x61",
  chainName: env.VITE_CHAIN_NAME || "BSC Testnet",
  nativeCurrency: {
    name: env.VITE_NATIVE_NAME || "tBNB",
    symbol: env.VITE_NATIVE_SYMBOL || "tBNB",
    decimals: 18,
  },
  rpcUrls: [env.VITE_RPC_URL || "https://bsc-testnet-rpc.publicnode.com"],
  blockExplorerUrls: [env.VITE_EXPLORER_URL || "https://testnet.bscscan.com"],
  factoryAddress: env.VITE_FACTORY_ADDRESS || undefined,
  factoryVersion: env.VITE_FACTORY_VERSION || "V3",
  lpVaultAddress: env.VITE_LP_VAULT_ADDRESS || undefined,
  commissionVaultAddress: env.VITE_COMMISSION_VAULT_ADDRESS || undefined,
  pancakeRouterAddress: env.VITE_PANCAKE_ROUTER_ADDRESS || "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
  pancakeFactoryAddress: env.VITE_PANCAKE_FACTORY_ADDRESS || "0x6725F303b657a9451d8BA641348b6761A6CC7a17",
  wbnbAddress: env.VITE_WBNB_ADDRESS || "0xae13d989dac2f0debff460ac112a837c89baa7cd",
  nativePairAddresses: [
    "0x0000000000000000000000000000000000000000",
    (env.VITE_WBNB_ADDRESS || "0xae13d989dac2f0debff460ac112a837c89baa7cd").toLowerCase(),
  ],
};

export const isAddress = (value?: string) => Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));

export const canUseRealChain = (config: ChainConfig = bscTestnetConfig) => (
  isAddress(config.factoryAddress) && isAddress(config.lpVaultAddress)
);

export const getExplorerTxUrl = (txHash: string, config: ChainConfig = bscTestnetConfig) => (
  `${config.blockExplorerUrls[0].replace(/\/$/, "")}/tx/${txHash}`
);

export const getExplorerAddressUrl = (address: string, config: ChainConfig = bscTestnetConfig) => (
  `${config.blockExplorerUrls[0].replace(/\/$/, "")}/address/${address}`
);

export const isNativePairToken = (value?: string, config: ChainConfig = bscTestnetConfig) => {
  if (!value) return false;
  return (config.nativePairAddresses || []).some((address) => address.toLowerCase() === value.toLowerCase());
};
