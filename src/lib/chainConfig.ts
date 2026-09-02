export type ChainKey = "bsc-testnet" | "robinhood-mainnet";
export type ChainProtocol = "fair-meme-v3" | "pons-v2";

export interface PonsContracts {
  v1FactoryAddress: string;
  v1LockerAddress: string;
  v2FactoryAddress: string;
  v2MemeHookAddress: string;
  v2FeeEscrowAddress: string;
  v2BuybackVaultAddress: string;
  v2LaunchLockerAddress: string;
  v2LaunchAndBuyAddress: string;
}

export interface ChainConfig {
  key: ChainKey;
  chainId: number;
  chainIdHex: string;
  chainName: string;
  shortName: string;
  protocol: ChainProtocol;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  supportsPlatformLaunch: boolean;
  supportsPlatformAdmin: boolean;
  factoryAddress?: string;
  factoryVersion?: "V1" | "V2" | "V3";
  lpVaultAddress?: string;
  commissionVaultAddress?: string;
  pancakeRouterAddress?: string;
  pancakeFactoryAddress?: string;
  wbnbAddress?: string;
  nativePairAddresses?: string[];
  pons?: PonsContracts;
}

const env = import.meta.env;

export const bscTestnetConfig: ChainConfig = {
  key: "bsc-testnet",
  chainId: Number.parseInt(env.VITE_CHAIN_ID_HEX || "0x61", 16),
  chainIdHex: env.VITE_CHAIN_ID_HEX || "0x61",
  chainName: env.VITE_CHAIN_NAME || "BSC Testnet",
  shortName: "BSC Testnet",
  protocol: "fair-meme-v3",
  nativeCurrency: {
    name: env.VITE_NATIVE_NAME || "tBNB",
    symbol: env.VITE_NATIVE_SYMBOL || "tBNB",
    decimals: 18,
  },
  rpcUrls: [env.VITE_RPC_URL || "https://bsc-testnet-rpc.publicnode.com"],
  blockExplorerUrls: [env.VITE_EXPLORER_URL || "https://testnet.bscscan.com"],
  supportsPlatformLaunch: true,
  supportsPlatformAdmin: true,
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

export const robinhoodMainnetConfig: ChainConfig = {
  key: "robinhood-mainnet",
  chainId: 4663,
  chainIdHex: "0x1237",
  chainName: "Robinhood Chain",
  shortName: "Robinhood",
  protocol: "pons-v2",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: [env.VITE_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"],
  blockExplorerUrls: [env.VITE_ROBINHOOD_EXPLORER_URL || "https://robinhoodchain.blockscout.com"],
  supportsPlatformLaunch: false,
  supportsPlatformAdmin: false,
  nativePairAddresses: ["0x0000000000000000000000000000000000000000"],
  pons: {
    v1FactoryAddress: env.VITE_PONS_V1_FACTORY_ADDRESS || "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB",
    v1LockerAddress: env.VITE_PONS_V1_LOCKER_ADDRESS || "0x736D76699C26D0d966744cAe304C000d471f7F35",
    v2FactoryAddress: env.VITE_PONS_V2_FACTORY_ADDRESS || "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
    v2MemeHookAddress: env.VITE_PONS_V2_MEME_HOOK_ADDRESS || "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
    v2FeeEscrowAddress: env.VITE_PONS_V2_FEE_ESCROW_ADDRESS || "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
    v2BuybackVaultAddress: env.VITE_PONS_V2_BUYBACK_VAULT_ADDRESS || "0x42df2a798f82289E177311362e8f5ccC45c1219c",
    v2LaunchLockerAddress: env.VITE_PONS_V2_LAUNCH_LOCKER_ADDRESS || "0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952",
    v2LaunchAndBuyAddress: env.VITE_PONS_V2_LAUNCH_AND_BUY_ADDRESS || "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948",
  },
};

export const supportedChains: readonly ChainConfig[] = [bscTestnetConfig, robinhoodMainnetConfig];
export const defaultChainKey: ChainKey = "bsc-testnet";

export const isChainKey = (value: string | null | undefined): value is ChainKey => supportedChains.some((chain) => chain.key === value);
export const getChainConfig = (key: ChainKey) => supportedChains.find((chain) => chain.key === key) || bscTestnetConfig;
export const getChainConfigById = (chainIdHex?: string | null) => chainIdHex
  ? supportedChains.find((chain) => chain.chainIdHex.toLowerCase() === chainIdHex.toLowerCase())
  : undefined;

export const isAddress = (value?: string) => Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
export const canUseRealChain = (config: ChainConfig = bscTestnetConfig) => (
  config.protocol === "fair-meme-v3" && isAddress(config.factoryAddress) && isAddress(config.lpVaultAddress)
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
