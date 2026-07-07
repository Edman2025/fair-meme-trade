ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS chain_withdrawal_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_chain_withdrawal_idx ON withdrawals(chain_withdrawal_id);
