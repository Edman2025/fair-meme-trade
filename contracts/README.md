# Fair Meme Trade Contracts

This directory contains the BSC Testnet contract layer used by the current real-flow deployment.

## Active V3 Contracts

- `FairMemeFactoryV3.sol`: creates token projects, reviews/rejects projects, and marks projects launched. It does not expose public fake trade or fake LP recording methods.
- `LpLockVaultV3.sol`: locks PancakeSwap LP tokens, supports one-time and linear release schedules, tracks cumulative withdrawn amounts, and emits lock/withdraw events for the indexer.
- `CommissionVault.sol`: records commission deposits, lets users request withdrawals on-chain, and lets the admin review/pay withdrawals.
- `FairMemeToken.sol`: ERC20-compatible token created by the factory for testnet fair-launch projects.

## Deployment Records

- `deployments.bsc-testnet.json`
- `deployments.bsc-testnet.v3.json`

The frontend, API, worker, smoke scripts, and deployment runbook should all resolve the same active V3 addresses from environment variables or these deployment records.

## Verification

```sh
npx hardhat test
npm run verify:bsc-testnet
```

`npm run verify:bsc-testnet` skips cleanly when `BSCSCAN_API_KEY` is not configured.

## Production Contract Boundaries

- Token creation must call `FairMemeFactoryV3.createToken`.
- Project review/launch must be submitted by the backend admin signer and confirmed by indexer events.
- LP add uses PancakeSwap Router; LP custody uses `LpLockVaultV3`.
- Commission withdrawal requests must call `CommissionVault.requestWithdrawal`; the backend must not create off-chain withdrawal records as the source of truth.
