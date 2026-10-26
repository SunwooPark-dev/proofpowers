# ProofPowers — Block anything irreversible.

Replay any run. Prove any approval. Block anything irreversible.

Scope: this repository covers only the proof and blocking checkpoint for a solo operator's agent runs. It does not cover enterprise compliance, and it does not claim to prevent every irreversible action.

Day 1 note: this commit contains the environment skeleton only. It contains no product logic. Product work starts on Day 2, with fresh code only and no reuse of prior code.

## Skeleton

- package.json: pure Node.js, no dependencies, no framework.
- scripts/smoke.mjs: environment smoke check only.
- src/cases, src/policy, src/run, src/envelope, src/board: empty directories reserved for Day 2 work.

## Run the smoke check

```text
npm run smoke
```
