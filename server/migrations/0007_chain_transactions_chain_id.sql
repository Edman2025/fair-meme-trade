ALTER TABLE chain_transactions
  ADD COLUMN IF NOT EXISTS chain_id INTEGER NOT NULL DEFAULT 97;

CREATE INDEX IF NOT EXISTS chain_transactions_chain_id_idx
  ON chain_transactions(chain_id, created_at DESC);
