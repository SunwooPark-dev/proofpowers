# ProofPowers fixed role routing — owner decision 2026-10-27 17:02

Generated: 2026-10-27T17:24:42.809118-07:00 (America/Los_Angeles).
Base: reconstructed codex-return-20261027-1406.zip tree, SHA-256 `4fb4fabdf9f18f6a6cc5284997f87c5ad4bdb2774b8ad9459bf94fce29d2c385`, over the Day4 base source tree. No parent Git repository or canonical VM was modified.

## Result

Mock cases **12/12**, PASS6/6, BLOCK6/6, PENDING0, **hard-gate PASS**. Demo deliveries fixed4+ignored1; unapproved0/tampered0.
`npm run test:model`: **14/14 PASS**. `npm run model:smoke`: mock success, network NOT_CALLED.
All14 .mjs files pass node --check. **Live inference requests 0**, no real credential use, push, commit, install, global config or external send.
The previous live exceptions have expired; no exception was reused and no new live run was attempted.

## Fixed routing and response validation

`ROLE_MODELS` is a frozen code constant:

| Logical role | Pinned model |
|---|---|
| wonder.plan | muse-wonder-1.0 |
| wonder.review | muse-wonder-1.0 |
| spark.draft | muse-spark-1.3 |
| spark.rewrite | muse-spark-1.3 |

META_MODEL is ignored, not read by the adapter. Unknown roles including inherited/prototype names are refused before network/key access. Tests use a throwing META_MODEL getter and fake override to verify this.
Returned model identity must be exactly the requested pinned model. Requested-model- suffix acceptance is removed; the prior suffix test now asserts rejection for Spark and Wonder. response.status must still equal completed. No status guard, budget guard, origin restriction, call quota or output limit was relaxed.
Mock records display the routed target model ID but mode=mock/request_attempted=false and remain NOT CERTIFIED for actual Meta use. These names are routing evidence, not a claim that Wonder was called live.

## Owner-provided cost logger

New src/model/costs.mjs records the explicitly requested USD/million-token schedule:

| Model | Input USD / 1M | Output USD / 1M |
|---|---|---|
| muse-wonder-1.0 | 4.00 | 20.00 |
| muse-spark-1.3 | 1.25 | 4.25 |

estimate = (input_tokens * input_rate + output_tokens * output_rate) / 1,000,000, rounded to 12 decimal places for stable metadata.
Every adapter call and receipt model_calls row has model and usd_estimate. Numeric provider usage uses the pinned/requested-model table, including diagnostic failure paths; a mismatch/refusal is still not actual billing proof. Missing/invalid usage or mock token counts yield **null**, never a fabricated zero charge. No raw response text/key/header is stored.
getCostSummary groups token totals and estimates by model and marks incomplete groups unknown. ROUTE_FALLBACK records its cause and model cost snapshot; later Spark costs remain in subsequent call records. Rates are the owner's specified schedule, not a newly verified provider price quote; no actual monetary billing or cached-token discount is claimed.
This does not create a provider dollar-spend hard-stop. The host's existing deterministic R-05 remains authoritative; budget-guard fallback cannot bypass it.

## Design §8 fallback

Read source: the supplied Prep architecture reference, §8, at outputs/handoff-2026-10-25-proofpowers/reference/original-meta-handoff/materials/prep-아키텍처-초안.md. Its boundaries match the current owner instruction: Spark-only generation/rewriting/internal work is allowed, but unfinished semantic review cannot lead to external execution.

- Wonder provider failure/timeout, incomplete or model-mismatched response, invalid plan/review structure, or host RUN_BUDGET_GUARD signal activates a sticky Spark-only route for that run and emits ROUTE_FALLBACK once.
- No hidden model override is used. Wonder role names never call Spark. Because the permitted roles do not include spark.plan, fallback planning is an explicitly labeled deterministic internal template; actual generation/rewrite uses spark.draft/spark.rewrite. It is not represented as a Spark planning call or completed Wonder review.
- A failed Wonder call is retained in model_calls. No automatic same-Wonder retry. Spark fallback is the explicitly designed alternative route; current validation simulated it in mock only.
- Remaining Wonder review is skipped after fallback and reported completed=false/uncertain. Malformed advisory output also never creates PASS/BLOCK.
- Standard runner and smoke callbacks forward ROUTE_FALLBACK into the Controller's actual audit events. Board route_events and visible predicates show the degraded route and cause. The adapter also exposes getRouteEvents/getCostSummary for host integrations.
- If the audit sink fails, fallback does not silently proceed. Only pre-approval DRAFT/CHECKED/HELD route-event writes are permitted.

External preflight now requires explicit host semanticReviewCompleted=true. Missing/false completion forces R-08 HELD unless an existing deterministic hard failure correctly takes precedence as BLOCK. A clear-looking signal cannot override completed=false. approve and beginDispatch refuse incomplete external review; recheck without a new completion observation does not clear it. A real later completed review plus explicit operator approval is still required.
Internal-only drafts can seal without external execution when review is unavailable. This deliberately strengthens Controller handling; callers outside the standard runner/smoke must now supply the completion flag and connect the audit sink. No extra APPROVED→HELD transition or approval waiver was introduced.

## Changed files and integration

- src/model/meta.mjs: frozen role map, exact response identity, fourth rewrite role, per-call cost, sticky fallback routing/event ledger and controlled mock fault injection.
- src/model/costs.mjs (new): owner rate constants, per-call estimate and model-group summary.
- src/agents/wonder.mjs: explicit fallback plan template/incomplete review handling.
- src/agents/spark.mjs: rewrite role entry point.
- src/run/controller.mjs: route audit entry point and incomplete-R08 external approval/dispatch protection; completion metadata retained.
- src/cases/run.mjs and scripts/model-smoke.mjs: connect route audit callbacks and completion signals; smoke prints usd_estimate.
- src/board/board.mjs: per-row usd_estimate, Wonder/Spark model identifiers, visible fallback events.
- test/model.test.mjs: exact-match update, fixed-role/env-override tests, cost/unknown-usage tests, external/internal fallback tests and budget/no-bypass checks.
- README.md: current routes, estimates and caller completion/audit requirements.

Policy engine, cases.mjs expected values, Envelope/Executor, package.json and base smoke script are byte-identical to the base. No dependencies added. Changed files only are included under proofpowers-build/; apply onto the stated 14:06 base tree.

## Verification detail

The 14 tests cover exact model acceptance/prefix rejection; all four frozen role targets; environment override ignored; unknown-role/no-key/no-network guard; owner cost arithmetic and null unknown usage; per-run call quota; plan/draft/review integration; primaryUnderTest contract; receipt role/cost/fallback visibility; mock Wonder plan failure followed by Spark draft/rewrite and mandatory external HOLD; mock Wonder review failure allowing only internal receipt work; and budget fallback still yielding R-05 BLOCK.
They additionally confirm that an operator approval attempt and dispatch attempt cannot bypass unfinished R-08, and recheck(clear) without completion leaves HOLD. Unit tests replace fetch with throwing spies where applicable and use synthetic mock failures; no real availability failure, key or network was exercised.
The prior negative live-guard unit test only validates a pre-key guard; it does not perform live inference. All actual commands used PP_MODEL_MODE=mock.

## npm run cases — full output

PP_MODEL_MODE=mock; exit 0
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
```
Stderr: (empty)

## npm run test:model — full output

PP_MODEL_MODE=mock; exit 0
```text
> proofpowers@0.1.0 test:model
> node --test test/model.test.mjs

✔ response model requires exact ID and rejects prefixes and other models (0.4884ms)
✔ four roles use frozen model constants; META_MODEL override is never read (2.8078ms)
✔ owner rate table produces model-specific USD estimates and unknown usage stays null (1.5963ms)
✔ Wonder planning failure logs ROUTE_FALLBACK; Spark-only external run stays HOLD (6.8829ms)
✔ Wonder review failure permits internal receipt-only work without claiming review completion (1.835ms)
✔ budget fallback is logged but cannot bypass R05; external missing review defaults HOLD (0.9412ms)
✔ mock is default, deterministic and never reads key or calls network (0.1982ms)
✔ independent run quotas refuse call 21 and record refusal without a request (0.6467ms)
✔ same run ID cannot reset the call cap using another adapter (0.1076ms)
✔ live guard refuses before reading key or invoking fetch; no live request tested (0.1952ms)
✔ unknown mode/role and malformed messages refuse without network (0.2057ms)
✔ plan, draft and review actually use three adapter calls; invalid advice is uncertain (0.2506ms)
✔ receipt keeps 3 role records, honest mock status, null usage and no raw prompts (0.4898ms)
✔ primaryUnderTest validates passed predicates; restored runner 12/12 and safe fixture corrections (40.9785ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 136.0478
```
Stderr: (empty)

## npm run model:smoke — full output

PP_MODEL_MODE=mock; exit 0
```text
> proofpowers@0.1.0 model:smoke
> node scripts/model-smoke.mjs

model:smoke mode=mock real_meta_use=false
wonder.plan model=muse-wonder-1.0 mode=mock status=success request_hash=2f4a0ccbc19f56f56c0ae72f941fd3c986d09d537c2579aa5f5eeb4fbbb4f0fc response_hash=161fe02e0e4327d0e3bc082b06dd33d73f8284d225a07b79c16fdcef706e886c diagnostics={"http_status":null,"response":{"status":null,"model":null},"incomplete_details":{"reason":null},"usage":{"input_tokens":null,"output_tokens":null,"total_tokens":null,"source":"not_measured_mock"},"usd_estimate":null}
spark.draft model=muse-spark-1.3 mode=mock status=success request_hash=c4f54e712dd92d47089d45fbc43bd0ed10e47f4ed840536c9078e735a187eefe response_hash=a83fcda86b0185493ba5dd4c06f1d479bab1322cf178673a62a2a41439d6dc45 diagnostics={"http_status":null,"response":{"status":null,"model":null},"incomplete_details":{"reason":null},"usage":{"input_tokens":null,"output_tokens":null,"total_tokens":null,"source":"not_measured_mock"},"usd_estimate":null}
wonder.review model=muse-wonder-1.0 mode=mock status=success request_hash=2301f4e229814a589e26ed34bebf93058b40c5b4230237e0b19b0d393f94467f response_hash=ddda871334521205057e7364ef6a4eab67afea9eb465e4d3a21854830708da4d diagnostics={"http_status":null,"response":{"status":null,"model":null},"incomplete_details":{"reason":null},"usage":{"input_tokens":null,"output_tokens":null,"total_tokens":null,"source":"not_measured_mock"},"usd_estimate":null}
receipt model_calls=3 sections=4 state=REPLAYABLE
network: NOT_CALLED
```
Stderr: (empty)

## Remaining limits / open questions

- No live Wonder availability/region behavior or real Spark fallback quality was validated. The older 14:06 live run used Spark for all roles and is not evidence of this new Wonder routing.
- Cost values remain estimates from owner rates; mock values remain null. Persistent billing/cost reconciliation, production credential isolation, multi-worker ledger and independent Replay limitations remain unchanged.
- Host integrations must provide truthful review-completion observations and route-event callbacks; a compromised host can forge its own input records. This is not a new process-security boundary.
- Open questions: 없음. The fallback template interpretation is stated explicitly because only the four owner-permitted role names are accepted.

## SHA-256

SHA256SUMS contains every changed file and REVIEW.md, excluding its own self-reference. Archive CRC and member-byte round trip are checked after creation. No credentials, .env or prior live receipt are included.

| Changed file | SHA-256 |
|---|---|
| `proofpowers-build/README.md` | `c8813caa50b24008826ac68b9d9e0be9b333facd1d9f41b4ad62b8cd0e7ea433` |
| `proofpowers-build/scripts/model-smoke.mjs` | `708ce196834bbaf67d2afea4e4603d870f9594c1fe165d044effe0ec0ee0ba31` |
| `proofpowers-build/src/agents/spark.mjs` | `62990edd25cf5fdafe893ac7e17959a6c64e16d1111e69d7b681968a7331cdcf` |
| `proofpowers-build/src/agents/wonder.mjs` | `2ffef97964d5b301ceda942d6a0068d1ba1a936b01e8d90b75b6750b6926ec60` |
| `proofpowers-build/src/board/board.mjs` | `56946e23d1df955017c6a53ba550cfbb93915d8b1cfed7c447d30385d3939d7b` |
| `proofpowers-build/src/cases/run.mjs` | `57507d1b14b14f6b33b68130a5615941016f9e9bd8c851a822c521eb0705e14b` |
| `proofpowers-build/src/model/costs.mjs` | `a2c868bc85dcdab3c4b972f17909d13617cb1e0e1e39a4f896282fea2f4aaf47` |
| `proofpowers-build/src/model/meta.mjs` | `eca645c36ba49db09e85dcdf27db9dcf1cc57e7f41c66b2920d9542ec41b1556` |
| `proofpowers-build/src/run/controller.mjs` | `72010b57edfab7246bc3470c904e7a1f7f05f3a865ad8d9c98115c69fbac31d6` |
| `proofpowers-build/test/model.test.mjs` | `6d4a06188564c44773d6f4b578a82d82a0a17a35785863c8939132579310ac9a` |
