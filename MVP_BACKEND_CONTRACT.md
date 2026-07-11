# Fair Meme Trade MVP Backend Contract

Production state is sourced from the Fastify API, Postgres, the long-running indexer, and BSC Testnet contracts. `localStorage` is only used for wallet/session convenience and development fallback state when explicitly enabled.

## Auth

- Wallet connection signs a nonce.
- Backend returns a session token scoped to that wallet.
- API keys never custody private keys. They can request quote/order payloads, but final swaps need wallet/account authorization.

## Core Endpoints

- `POST /api/auth/nonce`
- `POST /api/auth/verify`
- `GET /api/tokens`
- `GET /api/tokens/:symbol`
- `GET /api/tokens/:symbol/metrics`
- `GET /api/tokens/:symbol/market-series?timeframe=1m`
- `GET /api/tokens/:symbol/order-book`
- `GET /api/tokens/:symbol/holders?limit=10`
- `POST /api/chain-transactions`
- `GET /api/chain-transactions`
- `GET /api/indexed-events`
- `GET /api/indexer/status`
- `GET /api/lp-positions?owner=0x...`
- `GET /api/ledger/commissions?wallet=0x...`
- `GET /api/orders?wallet=0x...`
- `POST /api/orders`
- `POST /api/api-keys`
- `DELETE /api/api-keys/:id`
- `POST /api/node-applications`
- `POST /api/withdrawals` rejects off-chain creation; users submit `CommissionVault.requestWithdrawal` on-chain.
- `GET /api/admin/review-queue`
- `POST /api/admin/review-queue/:id/approve`
- `POST /api/admin/review-queue/:id/reject`
- `POST /api/admin/projects/:projectId/launch`
- `POST /api/admin/withdrawals/:id/pay`

## MVP Rules Preserved

- Token creation starts in `building`.
- LP positions can be `launch` or `trading`.
- Following is forced for tokens with an active LP position.
- Production trading uses PancakeSwap wallet transactions. Managed limit/risk orders are backend records until an executor submits a real swap transaction.
- LP add/lock/release/withdraw uses PancakeSwap and Vault transactions. Submitted tx hashes are recorded for backend/indexer reconciliation.
- Node applications, commission ledger, withdrawals, wallet signatures, chain transactions, indexed events, and admin review items are first-class backend records.

## Contract/Event Boundary

- Factory V3 emits `TokenCreated`, `ProjectReviewed`, and `ProjectLaunched`. Public fake trade/LP event methods are not part of the production flow.
- LP vault emits `LpLocked` and `LpWithdrawn`.
- Indexer should project those events into the same shape as `src/contexts/MvpContext.tsx` `IndexedEvent`.
- Admin queue should be the backend source of truth for token review, node approval, and withdrawal approval.
