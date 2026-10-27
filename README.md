# ProofPowers — Block anything irreversible.

Replay any run. Prove any approval. Block anything irreversible.

Scope: this repository covers only the proof and blocking checkpoint for a solo operator's agent runs. It does not cover enterprise compliance, and it does not claim to prevent every irreversible action.

Historical Day 1 note: the initial commit was an environment skeleton. This snapshot now contains deterministic gates, demo execution, receipts, and mock-first model roles.

## Skeleton

- package.json: pure Node.js, no dependencies, no framework.
- scripts/smoke.mjs: environment smoke check only.
- src/cases, src/policy, src/run, src/envelope, src/board: local deterministic integration and receipt modules.

## Run the smoke check

```text
npm run smoke
```

## Day 3 mock-first model roles

`npm run model:smoke` defaults to mock. `npm run test:model` checks adapter/receipt guards.
The fixed case runner always uses mock and now records plan/draft/review metadata in receipts.
No mock result proves real Meta use. Wonder is an agent-role name here; the future live adapter uses the single `META_MODEL` setting for all roles.

The owner-approved primaryUnderTest contract labels which passed predicate a PASS case measures. The engine validates membership; BLOCK always reports its first failing rule. cases.mjs is unchanged. The restored mock suite reports 12/12, hard-gate PASS, exit 0, with 4 fixed demo deliveries plus 1 separate ignored-instruction variant. C-01 is internal-only; C-12 uses its own lower cap; C-08 changes no recipient.

Future live configuration (not invoked in this task): `PP_MODEL_MODE=live`, `PP_SPEND_LIMIT_CONFIRMED=1`, `META_API_BASE=https://api.meta.ai/v1`, `META_MODEL=muse-spark-1.3`, and a privately supplied `META_API_KEY`. The spend flag is a host assertion, not a billing hard-stop. Each adapter run is capped at 20 attempts; no automatic retries. No generic Llama substitution.
