# Fair Meme Trade Server Deployment

This document intentionally omits public IPs, passwords, private keys, and concrete database names. Keep those values in the deployment runbook or the target server's environment only.

Required runtime:

- Static frontend served by Nginx from `${FRONTEND_RELEASE_ROOT}/current`
- API systemd service `${FAIR_MEME_API_SERVICE}` bound to `127.0.0.1:${API_PORT}`
- Indexer systemd service `${FAIR_MEME_INDEXER_SERVICE}`
- Postgres database configured by `${DATABASE_URL}`
- Redis configured by `${REDIS_URL}` when running more than one API replica

Required environment:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_WALLET`
- `ADMIN_WALLETS` optional comma-separated extra admin wallets
- `DEPLOYER_PRIVATE_KEY`
- `VITE_RPC_URL`
- `VITE_FACTORY_VERSION`
- `VITE_FACTORY_ADDRESS`
- `VITE_LP_VAULT_ADDRESS`
- `VITE_COMMISSION_VAULT_ADDRESS`
- `REDIS_URL` for shared auth/API-key rate limiting in multi-replica API deployments
- `RATE_LIMIT_PREFIX` optional namespace for Redis rate-limit keys
- `BSCSCAN_API_KEY` for optional contract verification
- `ROBINHOOD_RPC_URL` for PONS V2 event and reserve reads
- `ROBINHOOD_EXPLORER_URL`
- `ROBINHOOD_MULTICALL3_ADDRESS` (defaults to the canonical Multicall3 deployment)
- `ROBINHOOD_PONS_LOOKBACK_BLOCKS` for direct token-address lookups
- `PONS_V1_FACTORY_ADDRESS`
- `PONS_V2_FACTORY_ADDRESS`

Deployment commands:

- `npm install --ignore-scripts --no-audit --no-fund`
- `npm run db:migrate`
- `npm run build`
- `npm run test:server`
- `npx hardhat test`
- `npm run verify:bsc-testnet` when `BSCSCAN_API_KEY` is present
- `systemctl restart ${FAIR_MEME_API_SERVICE} ${FAIR_MEME_INDEXER_SERVICE}`
- `nginx -t && systemctl reload nginx`

Smoke checks:

- `/api/health`
- `/api/indexer/status`
- `/api/tokens/ROCKET`
- `/api/chains/robinhood-mainnet/status`
- `/api/chains/robinhood-mainnet/pons/launches?limit=6`
- `/admin`
- `/token/ROCKET`
- `/lp-launch/ROCKET`
- `/my-lp`

Chain smoke:

- `npm run smoke:chain:v3`

The chain smoke connects directly to BSC Testnet RPC, checks deployed V3 contract bytecode, validates Factory admin/project state, validates the ROCKET ERC20 metadata, and confirms Vault/Commission counters are readable.

Browser smoke:

- `npx playwright install chromium` on the runner when Chromium is not installed
- `npm run e2e:production`
- `npm run e2e:wallet:production`

The browser smoke opens the production pages, verifies key text, checks the API docs zh-CN language switch, and fails if legacy mock/placeholder text appears in the rendered UI. The wallet smoke injects a controlled EIP-1193 provider and verifies the production wallet connect/signature/auth path.

Rollback:

- Preview the previous-release rollback: `npm run deploy:rollback -- --dry-run`
- Roll back to the previous release: `npm run deploy:rollback`
- Roll back to a specific release: `npm run deploy:rollback -- --target=${RELEASE_NAME}`

The rollback script switches `${FRONTEND_RELEASE_ROOT}/current`, validates Nginx config, reloads Nginx, checks `${FAIR_MEME_API_SERVICE}` and `${FAIR_MEME_INDEXER_SERVICE}`, and verifies `${PROD_HEALTH_URL}`. Set `SKIP_SERVICE_CHECKS=1` only for local dry-runs or non-systemd test environments.
