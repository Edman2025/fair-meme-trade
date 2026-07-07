ALTER TABLE lp_positions ADD COLUMN IF NOT EXISTS release_type TEXT NOT NULL DEFAULT 'once';
ALTER TABLE lp_positions ADD COLUMN IF NOT EXISTS release_start TIMESTAMPTZ;
ALTER TABLE lp_positions ADD COLUMN IF NOT EXISTS release_end TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  order_type TEXT NOT NULL,
  side TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  trigger_price NUMERIC,
  trailing_percent NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_wallet_idx ON orders(wallet_address);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
