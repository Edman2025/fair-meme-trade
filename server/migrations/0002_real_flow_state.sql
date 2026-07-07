ALTER TABLE chain_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE review_queue ADD COLUMN IF NOT EXISTS tx_hash TEXT;
ALTER TABLE indexer_state ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS lp_positions_position_idx ON lp_positions(position_id);

CREATE TABLE IF NOT EXISTS api_audit_logs (
  id SERIAL PRIMARY KEY,
  api_key_id INTEGER,
  wallet_address TEXT,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
