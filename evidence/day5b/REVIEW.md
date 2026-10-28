# ProofPowers Day5b — local budget settlement

Result: IMPLEMENTED AND VERIFIED OFFLINE. Live API calls0, commits0, pushes0. No key read into files, no credential action, no provider calls. HTTP transport fixtures use synthetic environment values and replace fetch entirely. Final verification runs also deny real sockets/fetch with npm update notification disabled. An initial npm-process background socket attempt was blocked by the offline guard; it was not a model request. The final rerun reports zero network attempts.

## Base
Owner-specified ZIP: proofpowers-db4503d-plus-1833.zip.
SHA-256: 56f66cfc0d6631b49621723046ed2d6ef091009c925f52cc796c6422741f8e9e.
Canonical9b2b6f3 equivalence is owner-attested; no PC ProofPowers Git repository. No parent Git used. README byte-identical. Old evidence and existing Day5 budgets were neither rewritten nor retroactively settled.

## Behavior
- Parsed HTTP4xx JSON response with absent/null usage: settle local reservation toUSD0, reason HTTP_4XX_NO_USAGE_OWNER_POLICY. This is the owner's reservation policy; it does NOT certify zero billing or zero provider tokens.
- 4xx with valid token usage: settle at owner-price usage estimate. Partial/invalid usage is not treated as absent; retain reservation.
- HTTP5xx retains the full reservation even if a usage object is present. Timeouts/unknown transport outcomes retain full reservation. Malformed/non-JSON4xx retains reservation because usage absence cannot be established.
- Each settlement appends BUDGET_SETTLED(role,reserved,settled,reason,ticket_id) in the budget journal; model:smoke hooks it into the Controller hash-chained audit. Returned smoke receipts include budget_settlement_audit on both success and failure. Audit sink failure halts future reservations.
- No relaxation to exact model identity, completed status, role routing, R08, approval or Executor gates. No auto-retry. Reservation release does not retry Wonder in a degraded run; Spark-only routing remains sticky. The next explicitly requested Wonder reservation can fit in the same shared budget.

## Fresh validation
cases12/12, PASS6/6, BLOCK6/6, PENDING0; hard-gate PASS.
demo-calls fixed4 + ignored1, unapproved0, tampered0.
model tests29/29 (19 prior +10 added), syntax all19 mjs PASS, package smoke PASS.
Added tests reproduced 5 failures against the old implementation before edits. Additional checks:404 release + next Wonder reserve;503 with/without usage retained;429 usage settlement;400 partial usage retained;timeout retained;hashed audit;dry-run with live env stays mock;malformed4xx retained;audit sink fails closed.
Source secret pattern scan21 files, findings0. Git history NOT_SCANNED.

## Offline dry-run
Command: npm run model:dry-run. Fake mock plan/draft sizes only; max_output_tokens2048, owner rate table. No prompts or bodies printed.
| Role | Model | Input upper bound | Reservation USD |
|---|---|---|---|
| wonder.plan | muse-wonder-1.0 | 4305 | 0.05818000 |
| spark.draft | muse-spark-1.3 | 4445 | 0.01426025 |
| wonder.review | muse-wonder-1.0 | 4351 | 0.05836400 |

All three reservations without settlement: $0.13080425 > $0.10, so worst-case aggregate does NOT fit. Each individual call fits. In the real sequential flow earlier successful calls settle by actual usage, so released headroom can permit subsequent reservations; completion underUSD0.10 is UNKNOWN until actual usage. Live-generated input sizes may differ. No fabricated usage estimate or guarantee; cap/max tokens unchanged.

## Changed files
- package.json
- scripts/model-dry-run.mjs
- scripts/model-smoke.mjs
- src/model/budget.mjs
- src/model/meta.mjs
- src/run/controller.mjs
- test/day5.test.mjs

## Limit / next action
Normal live PASS remains unverified. Any later live run needs its own approval. This patch does not change historical receipts, provider billing, or existing unknown reservations. SHA256SUMS hashes all other ZIP payload files (the manifest excludes itself).

## Full fresh command outputs

### npm run cases
```text

> proofpowers@0.1.0 cases
> node src/cases/run.mjs

C-01 expected=PASS/R-01 actual=PASS/R-01 correct=true
C-02 expected=PASS/R-01 actual=PASS/R-01 correct=true
C-03 expected=PASS/R-02 actual=PASS/R-02 correct=true
C-04 expected=PASS/R-06 actual=PASS/R-06 correct=true
C-05 expected=PASS/R-05 actual=PASS/R-05 correct=true
C-06 expected=PASS/R-04 actual=PASS/R-04 correct=true
C-07 expected=BLOCK/R-01 actual=BLOCK/R-01 correct=true
C-08 expected=BLOCK/R-07 actual=BLOCK/R-07 correct=true
C-09 expected=BLOCK/R-04 actual=BLOCK/R-04 correct=true
C-10 expected=BLOCK/R-03 actual=BLOCK/R-03 correct=true
C-11 expected=BLOCK/R-02 actual=BLOCK/R-02 correct=true
C-12 expected=BLOCK/R-05 actual=BLOCK/R-05 correct=true
summary: 12/12 (PASS 6/6, BLOCK 6/6, PENDING 0)
hard-gate: PASS
C-08-ignored: expected=PASS/R-07 actual=PASS/R-07 correct=true (separate; excluded from fixed 12)
demo-calls: fixed=4 ignored=1 total=5 unapproved=0 tampered=0
executor-not-called: C-01, C-04, C-07, C-08, C-09, C-10, C-11, C-12
model-calls: mock=39 live=0 (not real Meta use)
evidence: mock-only integration; no live model calls or external sends; not Day 6 official score
OFFLINE_GUARD real_network_attempts=0
OFFLINE_GUARD real_network_attempts=0

```

### npm run test:model
```text

> proofpowers@0.1.0 test:model
> node --test test/model.test.mjs test/day5.test.mjs

✔ budget reserves before requests and retains unknown failure exposure (1.5258ms)
✔ known usage settles reservations; actual estimate over cap halts future requests (0.1901ms)
✔ a second sequential budget instance loads the first run reservation (1.9321ms)
✔ invalid-model injection is opt-in and affects only wonder.plan; mock has zero network (1.6469ms)
✔ fixed three-cut demos PASS/HOLD/BLOCK have correct delivery boundaries (9.4ms)
✔ HTTP 404 settlement with usage=false (10.4145ms)
✔ HTTP 503 settlement with usage=false (0.3584ms)
✔ HTTP 503 settlement with usage=true (0.3022ms)
✔ HTTP 429 settlement with usage=true (0.3071ms)
✔ HTTP 400 settlement with usage=true (0.3671ms)
✔ timeout retains reservation and logs conservative settlement (0.3061ms)
✔ budget settlement reaches hash-chained controller audit and ledger (0.8113ms)
✔ dry-run stays offline even with live env and reports conservative total honestly (2.2526ms)
✔ unparseable 4xx response does not prove usage absence and retains reservation (0.4545ms)
✔ audit sink failure halts future reservations instead of silently freeing headroom (0.1687ms)
OFFLINE_GUARD real_network_attempts=0
✔ response model requires exact ID and rejects prefixes and other models (0.4569ms)
✔ four roles use frozen model constants; META_MODEL override is never read (2.7637ms)
✔ owner rate table produces model-specific USD estimates and unknown usage stays null (1.2953ms)
✔ Wonder planning failure logs ROUTE_FALLBACK; Spark-only external run stays HOLD (5.7071ms)
✔ Wonder review failure permits internal receipt-only work without claiming review completion (1.3822ms)
✔ budget fallback is logged but cannot bypass R05; external missing review defaults HOLD (1.0117ms)
✔ mock is default, deterministic and never reads key or calls network (0.3485ms)
✔ independent run quotas refuse call 21 and record refusal without a request (0.5945ms)
✔ same run ID cannot reset the call cap using another adapter (0.1033ms)
✔ live guard refuses before reading key or invoking fetch; no live request tested (0.275ms)
✔ unknown mode/role and malformed messages refuse without network (0.3586ms)
✔ plan, draft and review actually use three adapter calls; invalid advice is uncertain (0.3076ms)
✔ receipt keeps 3 role records, honest mock status, null usage and no raw prompts (0.4854ms)
✔ primaryUnderTest validates passed predicates; restored runner 12/12 and safe fixture corrections (38.273ms)
OFFLINE_GUARD real_network_attempts=0
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 147.9825
OFFLINE_GUARD real_network_attempts=0

```

### npm run model:dry-run
```text

> proofpowers@0.1.0 model:dry-run
> node scripts/model-dry-run.mjs

{
  "mode": "dry-run-mock-inputs",
  "network_calls": 0,
  "limit_usd": 0.1,
  "calls": [
    {
      "role": "wonder.plan",
      "model": "muse-wonder-1.0",
      "input_token_upper": 4305,
      "max_output_tokens": 2048,
      "reserved_nanos": 58180000,
      "reserved_usd": 0.05818
    },
    {
      "role": "spark.draft",
      "model": "muse-spark-1.3",
      "input_token_upper": 4445,
      "max_output_tokens": 2048,
      "reserved_nanos": 14260250,
      "reserved_usd": 0.01426025
    },
    {
      "role": "wonder.review",
      "model": "muse-wonder-1.0",
      "input_token_upper": 4351,
      "max_output_tokens": 2048,
      "reserved_nanos": 58364000,
      "reserved_usd": 0.058364
    }
  ],
  "all_unsettled_reserved_usd": 0.13080425,
  "all_unsettled_within_limit": false,
  "each_call_individually_within_limit": true,
  "sequential_live_fit": "UNKNOWN_REQUIRES_ACTUAL_USAGE_SETTLEMENT",
  "note": "No usage or cost fabricated. Full output reservations may exceed the cap together; sequential settlement can free headroom. Live input lengths may differ."
}
OFFLINE_GUARD real_network_attempts=0
OFFLINE_GUARD real_network_attempts=0

```

### npm run scan:secrets
```text

> proofpowers@0.1.0 scan:secrets
> node scripts/scan-secrets.mjs

{"scanned_files":21,"findings":[],"match_count":0,"git_history":"NOT_SCANNED","note":"Pattern scan only; values never printed; Git history and provider/account verification excluded"}
OFFLINE_GUARD real_network_attempts=0
OFFLINE_GUARD real_network_attempts=0

```

### npm run smoke
```text

> proofpowers@0.1.0 smoke
> node scripts/smoke.mjs

smoke: ok, package=proofpowers, node=v24.12.0
OFFLINE_GUARD real_network_attempts=0
OFFLINE_GUARD real_network_attempts=0

```
