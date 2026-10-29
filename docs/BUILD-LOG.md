# Build log (Day 1–7)

Moved here from the README on 2026-10-29. The text below is unchanged from README at `80295f2`, so some numbers in it are from the day they were written (for example, test counts before Day 7).

Historical Day 1 note: the initial commit was an environment skeleton. This snapshot now contains deterministic gates, demo execution, receipts, and mock-first model roles.

## Run the smoke check

```text
npm run smoke
```

## Day 3 mock-first model roles

`npm run model:smoke` defaults to mock. `npm run test:model` checks adapter/receipt guards.
The fixed case runner always uses mock and now records plan/draft/review metadata in receipts.
No mock result proves real Meta use. Routed model IDs are fixed in code: wonder.plan/review use muse-wonder-1.0; spark.draft/rewrite use muse-spark-1.3. META_MODEL is ignored.

The owner-approved primaryUnderTest contract labels which passed predicate a PASS case measures. The engine validates membership; BLOCK always reports its first failing rule. The restored mock suite reports 13/13 (PASS 6/6, BLOCK 7/7), hard-gate PASS, exit 0. It includes C-13, a prompt injection hidden in a fake customer note, which the mock test blocks (BLOCK/R-02, 0 deliveries). The suite also makes 4 fixed demo deliveries, plus 1 separate ignored-instruction variant. C-01 is internal-only; C-12 uses its own lower cap; C-08 changes no recipient.

Live configuration (owner-only; used for the Oct 27 live runs; never needed for mock): `PP_MODEL_MODE=live`, `PP_SPEND_LIMIT_CONFIRMED=1`, `META_API_BASE=https://api.meta.ai/v1`, and a privately supplied `META_API_KEY`. There is no environment model override. The spend flag is a host assertion, not a billing hard-stop. Each adapter run is capped at 20 attempts. No same-model automatic retry or generic Llama substitution.

Owner rate table (USD per million tokens): Wonder input4/output20; Spark input1.25/output4.25. Every call record carries usd_estimate; unknown usage, including mock fixtures, yields null rather than a fabricated zero bill. Estimates are not provider billing.

Wonder provider failure, timeout, invalid structured output or host budget-guard signal activates per-run Spark-only fallback and records ROUTE_FALLBACK. The fallback plan is a labeled internal template, not a claimed Spark planning-model call. Spark draft/rewrite remain available; Wonder review is marked incomplete.
The standard runner/smoke wire route events into Controller audit logs. External callers must supply semanticReviewCompleted=true from a completed review; missing/false reviews remain HELD, and approval/dispatch cannot bypass that boundary. Internal fallback drafts may seal without external execution. The host audit sink must be connected when using createMetaRun outside these entry points.

Day 5: demo three cuts PASS/HOLD/BLOCK verified in mock; live forced-failure fallback proven (HELD/R-08, Spark $0.0046 estimate); normal live PASS not verified — budget reservation guard refused before network (see Day 5 evidence).
Day 5b: 4xx no-usage reservations settle to $0 by owner policy (5xx/timeout/malformed retain); normal live PASS verified on the new tree (3/3, 2,810 tokens, $0.0294 estimate); smoke budget default is now $0.15.
Live 12/12 (Muse Wonder + Spark): full fixed-12 suite verified live, 36/36 HTTP 200, 30,007 tokens, $0.3144 estimate.
- Kill switch: `PROOFPOWERS_KILL=1` or repo-root `KILL` blocks at the next step boundary.
- Backup/restore: `npm run backup`; `npm run restore -- <file>` verifies audit state and approval hashes without re-arming execution.
Day 6b: `npm run demo` / `npm run demo:without` contrast uses fake data and in-memory delivery only; no live calls.
Set `PROOFPOWERS_STATE_ROOT` to keep state/ and backups/ outside the repo; demos do not persist, restore tests use os.tmpdir().

Day 7: fixed mock suite 13 cases includes C-13 customer-note injection (mock test: BLOCK/R-02, 0 deliveries); npm run bench:gate writes results to the configured state root, or OS tmpdir/proofpowers when unset (1000 policy decisions; model calls excluded); --write-evidence explicitly overwrites evidence/gate-latency.json and --out selects a separate output file.
