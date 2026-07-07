# Fair Meme Trade

Fair Meme Trade is a BSC Testnet fair-launch meme trading app with a React frontend, Fastify/Postgres backend, persistent contract indexer, and V3 smart contracts.

## Current Runtime

- Frontend: Vite, React, TypeScript, Tailwind, shadcn-ui.
- Backend: Node.js, TypeScript, Fastify, Postgres, Drizzle schema/migrations.
- Chain: BSC Testnet.
- Contracts: `FairMemeFactoryV3`, `LpLockVaultV3`, `CommissionVault`.
- DEX path: PancakeSwap v2 Testnet router/factory/WBNB from environment config.
- Production domain: `https://english.xunlian.co`.

## Local Development

```sh
npm install
npm run db:migrate
npm run dev
```

Run the API and worker separately when testing backend flows:

```sh
npm run server:dev
npm run worker:dev
```

## Environment

Create `.env.local` from `.env.example` and configure:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_WALLET`
- `ADMIN_WALLETS` optional comma-separated extra admin wallets
- `DEPLOYER_PRIVATE_KEY`
- `VITE_RPC_URL`
- `BSC_TESTNET_RPC_URL`
- `INDEXER_WS_URL`
- `REDIS_URL` when running more than one API replica
- `RATE_LIMIT_PREFIX`
- `VITE_FACTORY_VERSION`
- `VITE_FACTORY_ADDRESS`
- `VITE_LP_VAULT_ADDRESS`
- `VITE_COMMISSION_VAULT_ADDRESS`
- `VITE_EXPLORER_URL`

Never commit private keys, passwords, concrete production database URLs, or server credentials.

## Verification

```sh
npx tsc --noEmit
npm run lint
npm run build
npm run test:server
npx hardhat test
```

Optional contract verification:

```sh
npm run verify:bsc-testnet
```

If `BSCSCAN_API_KEY` is absent, verification is skipped rather than treated as a failed build.

## Production Smoke

After deploying API, worker, and static frontend:

- `GET /api/health`
- `GET /api/indexer/status`
- `GET /api/tokens/ROCKET`
- `/admin`
- `/token/ROCKET`
- `/lp-launch/ROCKET`
- `/my-lp`
- `/nodes`
- `/api-docs`

Indexer status should show only the active V3 contract addresses with `failureCount=0`, `lastError=null`, and low or zero `lagBlocks`.

For production scale-out, configure `REDIS_URL` so login nonce and unknown API-key rate limits are shared across API replicas. Without Redis the API falls back to in-process limits, which is acceptable for a single service instance.
