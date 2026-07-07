# Fair Meme Trade MVP Backend Contract

Current frontend state is local-first and persistent in `localStorage`. The next backend/indexer should replace the adapter shape in `src/lib/mvpApi.ts`.

## Auth

- Wallet connection signs a nonce.
- Backend returns a session token scoped to that wallet.
- API keys never custody private keys. They can request quote/order payloads, but final swaps need wallet/account authorization.

## Core Endpoints

- `POST /auth/wallet/nonce`
- `POST /auth/wallet/signature`
- `GET /tokens`
- `GET /tokens/:symbol`
- `GET /tokens/:symbol/market-series?timeframe=1m`
- `GET /tokens/:symbol/order-book`
- `POST /trades`
- `POST /chain-transactions`
- `GET /chain-transactions`
- `GET /indexer/events`
- `POST /lp-positions`
- `GET /account/balances`
- `GET /account/trades`
- `GET /account/lp-positions`
- `POST /api-keys`
- `DELETE /api-keys/:id`
- `POST /node-applications`
- `POST /withdrawals`
- `GET /admin/review-queue`
- `POST /admin/review-queue/:id/approve`
- `POST /admin/review-queue/:id/reject`

## MVP Rules Preserved

- Token creation starts in `building`.
- LP positions can be `launch` or `trading`.
- Following is forced for tokens with an active LP position.
- Trading and LP actions are currently simulated but recorded.
- Node applications and commission withdrawals are persisted as pending records.
- Wallet signatures, chain transactions, indexed events, and admin review items are now first-class MVP records.

## Contract/Event Boundary

- Factory emits `TokenCreated`, `ProjectReviewed`, `TradeRecorded`, and `LpAdded`.
- LP vault emits `LpLocked` and `LpWithdrawn`.
- Indexer should project those events into the same shape as `src/contexts/MvpContext.tsx` `IndexedEvent`.
- Admin queue should be the backend source of truth for token review, node approval, and withdrawal approval.
