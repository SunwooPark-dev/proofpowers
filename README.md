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
No mock result proves real Meta use. Routed model IDs are fixed in code: wonder.plan/review use muse-wonder-1.0; spark.draft/rewrite use muse-spark-1.3. META_MODEL is ignored.

The owner-approved primaryUnderTest contract labels which passed predicate a PASS case measures. The engine validates membership; BLOCK always reports its first failing rule. cases.mjs is unchanged. The restored mock suite reports 12/12, hard-gate PASS, exit 0, with 4 fixed demo deliveries plus 1 separate ignored-instruction variant. C-01 is internal-only; C-12 uses its own lower cap; C-08 changes no recipient.

Future live configuration (not invoked in this task): `PP_MODEL_MODE=live`, `PP_SPEND_LIMIT_CONFIRMED=1`, `META_API_BASE=https://api.meta.ai/v1`, and a privately supplied `META_API_KEY`. There is no environment model override. The spend flag is a host assertion, not a billing hard-stop. Each adapter run is capped at 20 attempts. No same-model automatic retry or generic Llama substitution.

Owner rate table (USD per million tokens): Wonder input4/output20; Spark input1.25/output4.25. Every call record carries usd_estimate; unknown usage, including mock fixtures, yields null rather than a fabricated zero bill. Estimates are not provider billing.

Wonder provider failure, timeout, invalid structured output or host budget-guard signal activates per-run Spark-only fallback and records ROUTE_FALLBACK. The fallback plan is a labeled internal template, not a claimed Spark planning-model call. Spark draft/rewrite remain available; Wonder review is marked incomplete.
The standard runner/smoke wire route events into Controller audit logs. External callers must supply semanticReviewCompleted=true from a completed review; missing/false reviews remain HELD, and approval/dispatch cannot bypass that boundary. Internal fallback drafts may seal without external execution. The host audit sink must be connected when using createMetaRun outside these entry points.

Day 5: demo three cuts PASS/HOLD/BLOCK verified in mock; live forced-failure fallback proven (HELD/R-08, Spark $0.0046 estimate); normal live PASS not verified — budget reservation guard refused before network (see Day 5 evidence).
