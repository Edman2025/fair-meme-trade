ALTER TABLE wallet_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes');

UPDATE wallet_sessions
SET expires_at = issued_at + interval '10 minutes'
WHERE expires_at <= issued_at;

CREATE INDEX IF NOT EXISTS wallet_sessions_expires_at_idx ON wallet_sessions(expires_at);
