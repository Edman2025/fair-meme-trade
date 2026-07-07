import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const normalizeWallets = (...values: Array<string | undefined>) => Array.from(new Set(
  values
    .flatMap((value) => (value || "").split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
));

const adminWallets = normalizeWallets(
  process.env.ADMIN_WALLETS,
  process.env.ADMIN_WALLET,
  process.env.DEPLOYER_ADDRESS,
);

export const env = {
  port: Number(process.env.API_PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || "postgres://fair_meme:fair_meme@127.0.0.1:5432/fair_meme_trade",
  jwtSecret: process.env.JWT_SECRET || "dev-change-me",
  adminWallet: adminWallets[0] || "",
  adminWallets,
  deployerPrivateKey: process.env.DEPLOYER_PRIVATE_KEY || "",
  rpcUrl: process.env.BSC_TESTNET_RPC_URL || process.env.VITE_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
  indexerWsUrl: process.env.INDEXER_WS_URL || process.env.BSC_TESTNET_WS_URL || "",
  indexerWindowSize: Number(process.env.INDEXER_WINDOW_SIZE || 150),
  indexerPublicRpcBackfillBlocks: Number(process.env.INDEXER_PUBLIC_RPC_BACKFILL_BLOCKS || 100),
  indexerReceiptFallbackBlocks: Number(process.env.INDEXER_RECEIPT_FALLBACK_BLOCKS || 20),
  redisUrl: process.env.REDIS_URL || "",
  rateLimitPrefix: process.env.RATE_LIMIT_PREFIX || "fair-meme-trade",
  factoryAddress: process.env.VITE_FACTORY_ADDRESS || "",
  lpVaultAddress: process.env.VITE_LP_VAULT_ADDRESS || "",
  commissionVaultAddress: process.env.VITE_COMMISSION_VAULT_ADDRESS || "",
};
