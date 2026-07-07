# Contract Deployment Notes

The live testnet flow uses V3 contracts and server-side indexing. Production frontend paths must read contract state through the API/indexer or submit real wallet transactions; local demo queues are development-only and disabled unless `VITE_ENABLE_DEMO_FALLBACK=true`.

Required frontend and backend environment variables:

- `VITE_FACTORY_VERSION=V3`
- `VITE_FACTORY_ADDRESS`
- `VITE_LP_VAULT_ADDRESS`
- `VITE_COMMISSION_VAULT_ADDRESS`
- `VITE_CHAIN_ID_HEX`
- `VITE_RPC_URL`
- `VITE_EXPLORER_URL`
- `ADMIN_WALLET`
- `DEPLOYER_PRIVATE_KEY`
- `DATABASE_URL`

Current BSC Testnet deployment addresses are stored in:

- `contracts/deployments.bsc-testnet.json`
- `contracts/deployments.bsc-testnet.v3.json`

Deployment and verification checklist:

1. Run `npx hardhat test`.
2. Deploy V3 contracts with `npm run deploy:v3:bsc-testnet`.
3. Confirm `.env.local` and deployment JSON files contain the same V3 addresses.
4. Run `npm run db:migrate` so API/indexer schema matches the contracts.
5. Restart API and indexer services.
6. Build and publish the frontend static release.
7. Run `npm run smoke:production`.

Runtime expectations:

- `FairMemeFactoryV3` emits project creation/review/launch events only; fake public trade/LP recording is intentionally absent.
- `LpLockVaultV3` is the source of truth for LP lock, release, and withdraw positions.
- `CommissionVault` is the source of truth for commission deposits and withdrawal request/review/pay events.
- `/api/indexer/status` should report exactly the active Factory, LP Vault, and Commission Vault addresses with `failureCount=0` and `lastError=null`.
