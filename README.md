# Fair Meme Trade

Fair Meme Trade is a multi-chain meme launch and trading app. BSC Testnet keeps the platform's Fair Meme V3 contracts and PancakeSwap flow; Robinhood Chain is available as a second network through the live PONS V2 protocol.

## Current Runtime

- Frontend: Vite, React, TypeScript, Tailwind, shadcn-ui.
- Backend: Node.js, TypeScript, Fastify, Postgres, Drizzle schema/migrations.
- Chains: BSC Testnet (chain ID 97) and Robinhood Chain mainnet (chain ID 4663).
- Contracts: `FairMemeFactoryV3`, `LpLockVaultV3`, `CommissionVault`.
- Protocol paths: PancakeSwap v2 on BSC; PONS V2 bonding curves and graduated Uniswap V4 pools on Robinhood Chain.
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
- `VITE_ROBINHOOD_RPC_URL`
- `VITE_ROBINHOOD_EXPLORER_URL`
- `VITE_PONS_V1_FACTORY_ADDRESS`
- `VITE_PONS_V2_FACTORY_ADDRESS`
- `ROBINHOOD_RPC_URL` for server-side PONS discovery

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
- `GET /api/chains`
- `GET /api/chains/robinhood-mainnet/status`
- `GET /api/chains/robinhood-mainnet/pons/launches?limit=6`
- `GET /api/chains/robinhood-mainnet/pons/launches/:tokenAddress`
- `GET /api/tokens/ROCKET`
- `/admin`
- `/token/ROCKET`
- `/lp-launch/ROCKET`
- `/my-lp`
- `/nodes`
- `/api-docs`

Indexer status should show only the active V3 contract addresses with `failureCount=0`, `lastError=null`, and low or zero `lagBlocks`.

Robinhood launches are discovered from the PONS V2 Factory `TokenLaunched` events. Token metadata, quote asset, curve reserves, fees, price, and graduation progress are read from the deployed contracts; Robinhood rows are not copied from the BSC database.

The public Robinhood RPC is suitable for local verification but is rate-limited. Production should set `ROBINHOOD_RPC_URL` and `VITE_ROBINHOOD_RPC_URL` to a dedicated Robinhood endpoint. Contract reads are coalesced through Multicall3, and direct token-address routes can resolve launches outside the latest feed window.

For production scale-out, configure `REDIS_URL` so login nonce and unknown API-key rate limits are shared across API replicas. Without Redis the API falls back to in-process limits, which is acceptable for a single service instance.
