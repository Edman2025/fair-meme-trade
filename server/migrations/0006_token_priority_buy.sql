ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS priority_buy_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS priority_buy_currency TEXT;

ALTER TABLE tokens
  DROP CONSTRAINT IF EXISTS tokens_priority_buy_currency_check;

ALTER TABLE tokens
  ADD CONSTRAINT tokens_priority_buy_currency_check
  CHECK (priority_buy_currency IS NULL OR priority_buy_currency IN ('USDT', 'BNB'));
