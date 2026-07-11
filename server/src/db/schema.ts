import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const walletSessions = pgTable("wallet_sessions", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  nonce: text("nonce").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

export const tokens = pgTable("tokens", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  tokenAddress: text("token_address").notNull(),
  creatorAddress: text("creator_address").notNull(),
  metadataUri: text("metadata_uri").notNull(),
  pairToken: text("pair_token").notNull(),
  projectId: integer("project_id").notNull(),
  priorityBuyAmount: numeric("priority_buy_amount"),
  priorityBuyCurrency: text("priority_buy_currency"),
  status: text("status").notNull().default("building"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  symbolIdx: uniqueIndex("tokens_symbol_idx").on(table.symbol),
  tokenAddressIdx: uniqueIndex("tokens_token_address_idx").on(table.tokenAddress),
}));

export const chainTransactions = pgTable("chain_transactions", {
  id: serial("id").primaryKey(),
  txHash: text("tx_hash").notNull(),
  action: text("action").notNull(),
  tokenAddress: text("token_address"),
  walletAddress: text("wallet_address"),
  status: text("status").notNull().default("submitted"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  txHashIdx: uniqueIndex("chain_transactions_tx_hash_idx").on(table.txHash),
}));

export const indexedEvents = pgTable("indexed_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull(),
  eventName: text("event_name").notNull(),
  txHash: text("tx_hash").notNull(),
  blockNumber: integer("block_number").notNull(),
  logIndex: integer("log_index").notNull(),
  tokenAddress: text("token_address"),
  walletAddress: text("wallet_address"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: uniqueIndex("indexed_events_event_id_idx").on(table.eventId),
}));

export const reviewQueue = pgTable("review_queue", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  targetId: text("target_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"),
  reviewerAddress: text("reviewer_address"),
  reviewerNote: text("reviewer_note"),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  ownerAddress: text("owner_address").notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  prefix: text("prefix").notNull(),
  scopes: text("scopes").array().notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}, (table) => ({
  keyHashIdx: uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
}));

export const lpPositions = pgTable("lp_positions", {
  id: serial("id").primaryKey(),
  positionId: integer("position_id"),
  ownerAddress: text("owner_address").notNull(),
  lpTokenAddress: text("lp_token_address").notNull(),
  tokenAddress: text("token_address"),
  amount: numeric("amount").notNull(),
  unlockAt: timestamp("unlock_at", { withTimezone: true }),
  releaseType: text("release_type").notNull().default("once"),
  releaseStart: timestamp("release_start", { withTimezone: true }),
  releaseEnd: timestamp("release_end", { withTimezone: true }),
  withdrawn: numeric("withdrawn").default("0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  positionIdx: uniqueIndex("lp_positions_position_idx").on(table.positionId),
}));

export const nodeApplications = pgTable("node_applications", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const commissions = pgTable("commissions", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  source: text("source").notNull(),
  amount: numeric("amount").notNull(),
  tokenAddress: text("token_address").notNull(),
  status: text("status").notNull().default("available"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  tokenAddress: text("token_address").notNull(),
  orderType: text("order_type").notNull(),
  side: text("side").notNull(),
  amount: numeric("amount").notNull(),
  triggerPrice: numeric("trigger_price"),
  trailingPercent: numeric("trailing_percent"),
  status: text("status").notNull().default("pending"),
  txHash: text("tx_hash"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  chainWithdrawalId: integer("chain_withdrawal_id"),
  walletAddress: text("wallet_address").notNull(),
  amount: numeric("amount").notNull(),
  tokenAddress: text("token_address").notNull(),
  status: text("status").notNull().default("pending"),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, (table) => ({
  chainWithdrawalIdx: uniqueIndex("withdrawals_chain_withdrawal_idx").on(table.chainWithdrawalId),
}));

export const indexerState = pgTable("indexer_state", {
  id: serial("id").primaryKey(),
  contractAddress: text("contract_address").notNull(),
  lastIndexedBlock: integer("last_indexed_block").notNull().default(0),
  latestSeenBlock: integer("latest_seen_block").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  contractIdx: uniqueIndex("indexer_state_contract_idx").on(table.contractAddress),
}));

export const apiAuditLogs = pgTable("api_audit_logs", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id"),
  walletAddress: text("wallet_address"),
  path: text("path").notNull(),
  method: text("method").notNull(),
  scope: text("scope").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
