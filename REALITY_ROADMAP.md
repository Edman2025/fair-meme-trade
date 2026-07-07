# Fair Meme Trade Reality Status

This file tracks the current real-production boundary. It should be updated when a flow moves between categories.

## Real Now

- Wallet login uses injected wallets, `personal_sign`, HTTP-only cookie/JWT auth, nonce TTL, and nonce consumption.
- BSC Testnet V3 contracts are deployed and used by frontend, backend, smoke scripts, and indexer.
- Token creation uses `FairMemeFactoryV3.createToken`; production does not create local fake tokens first.
- Backend stores tokens, chain transactions, indexed events, review queue, API keys, LP positions, node applications, commissions, orders, and withdrawals in Postgres.
- Persistent indexer worker tracks the active V3 Factory, LP Vault, and CommissionVault contracts and exposes `/api/indexer/status`.
- Admin review and launch APIs execute server-side admin signer transactions and record submitted tx state.
- PancakeSwap quote/swap helpers use the configured BSC Testnet router/factory/WBNB addresses.
- LP launch uses Pancake `addLiquidityETH`, LP approve, Vault V3 lock, and indexer-backed LP position state.
- LP release/withdraw calls Vault V3 and records the tx for backend/indexer reconciliation.
- API keys are hashed, scoped, audited for known rejected/successful calls, and rate-limited for unknown keys.
- Login nonce and unknown API-key limits use Redis when `REDIS_URL` is configured, with in-process fallback for single-instance deployments.
- Commission ledger, node applications, withdrawals, managed orders, and API docs are served by backend endpoints.
- Holder/rich-list analytics are served from a backend chain scanner that reads ERC20 `Transfer` logs from the token creation block.
- Production frontend defaults to API/indexer/chain data; local demo fallback is gated behind development config.

## Operational Requirements

- Run API and indexer as long-lived services.
- Keep `INDEXER_WS_URL` configured when public HTTP RPC archive/history limits become unstable.
- Keep `/api/indexer/status` green before accepting a release: active V3 addresses only, `failureCount=0`, `lastError=null`, and low or zero `lagBlocks`.
- Keep Nginx `/api/*` reverse proxy pointed at the Fastify service and static frontend pointed at the current release symlink.
- Do not commit production secrets, server credentials, database URLs, or deployer/admin private keys.
- Browser release checks include a no-wallet page smoke and a controlled EIP-1193 wallet-provider smoke for the wallet connection/signature path.
- Rollbacks use `npm run deploy:rollback` to switch the current release symlink and run Nginx, systemd, and API health checks.
- Backend release checks cover auth nonce expiry, API key scopes/audit, managed orders, commission ledger, admin token review/reject, withdrawal review/pay guards, project launch, holder analytics, and active indexer status filtering.
- Configure `REDIS_URL` before scaling the API beyond one replica so rate limits are shared instead of process-local.
