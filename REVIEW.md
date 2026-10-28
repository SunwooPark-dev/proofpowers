# Day 4 live smoke — owner 13:59 revision and successful one-shot

Generated: 2026-10-27T14:06:29.622373-07:00 (America/Los_Angeles).
Base reconstructed from Day4 source ZIP (SHA-256 e7a513dc707b5da3d196042d77e2a529770ab8f6af5624e0e4587419b823b964) plus prior return codex-return-20261027-1337.zip (SHA-256 f15d41b0f82c4f86ce71c77a8ba91dda3ce029225ce0221461d45e54cf791aaf). This preserves that return's model-smoke JSON export instrumentation.

## Result

**Live SUCCESS: one smoke invocation, three model calls, all HTTP 200 and response.status=completed; exit 0.**
Provider-reported response.model=muse-spark-1.3 on all three calls. Receipt has **3 verified Model call rows**, state **REPLAYABLE**.
Total provider-reported usage: **input 252, output 2483, total 2735 tokens**. No USD cost is inferred.
Mock cases: **12/12**, hard-gate PASS, PENDING 0. test:model: **9/9 PASS** (existing 8 tests retained, 1 requested model-matching test added).
No retries, pushes or outbound demo sends. The three network calls are the explicitly authorized Meta inference requests only.
The owner 2026-10-27 13:59 exception was marked consumed before execution and expired when this one subprocess returned. No further calls are authorized by that exception.

## Scoped changes

- src/model/meta.mjs: max_output_tokens 512→2048; records safe http_status, response.status/model, incomplete_details.reason and provider numeric token usage before completion/model validation; exact-or-requested-dash model comparison helper.
- The status requirement remains STRICT completed; it was not relaxed. Other models still fail. The 20-attempt cap, live spend guard, origin restriction, no-retry policy and key env name are unchanged.
- src/board/board.mjs: minimal metadata allowlist forwarding, necessary because the previous receipt projection dropped diagnostic fields. No raw response body/header is copied.
- scripts/model-smoke.mjs: emits only diagnostic metadata and usage on both success/failure; JSON export and code-only exception output remain.
- test/model.test.mjs: one model-matching test added; the original eight test bodies are byte-identical.
Engine, Controller, Envelope, Executor, cases.mjs and runner behavior are byte-identical to the base. No dependencies added.

The diagnostic identifier filter permits bounded identifier characters only and refuses exact key strings/key-like prefixes; invalid values become null. Only nonnegative safe integer usage counts are copied. Raw prompts/response text/headers/keys are never placed in the receipt or logs; raw response bytes are represented only by a digest.

## Diagnostics and usage

| Role | HTTP | response.status | response.model | incomplete reason | Input tokens | Output tokens | Total tokens |
|---|---|---|---|---|---|---|---|
| wonder.plan | 200 | completed | muse-spark-1.3 | None | 56 | 621 | 677 |
| spark.draft | 200 | completed | muse-spark-1.3 | None | 95 | 1084 | 1179 |
| wonder.review | 200 | completed | muse-spark-1.3 | None | 101 | 778 | 879 |
| TOTAL | | | | | 252 | 2483 | 2735 |

The requested model and returned model were exactly equal on this run. The newly accepted requested-model- suffix case is unit-tested, not claimed as an observed provider alias here.
All observed output-token counts exceed the old 512 cap. This is compatible with an old limit-related failure, but the 13:33 response's status/model/usage were not retained, so its exact cause is NOT retroactively established.
Provider output_tokens may include reasoning tokens; no raw reasoning or body was logged.

## Full live stdout

Command: npm run model:smoke -- --receipt-json ../live-receipt.json
Mode live; META_API_BASE=https://api.meta.ai/v1; META_MODEL=muse-spark-1.3; spend flag 1. The key was passed only through the existing process environment.

```text
> proofpowers@0.1.0 model:smoke
> node scripts/model-smoke.mjs --receipt-json ../live-receipt.json

model:smoke mode=live real_meta_use=true
wonder.plan model=muse-spark-1.3 mode=live status=success request_hash=6159fb0dd18a3093f5755869c8b8fb82b5e31f935467f8c6f90c0acd73f2a2f9 response_hash=0ce3ddb469932e965f9a288db27acfea8d9866d7a282e3e22e7dda50df357d15 diagnostics={"http_status":200,"response":{"status":"completed","model":"muse-spark-1.3"},"incomplete_details":{"reason":null},"usage":{"input_tokens":56,"output_tokens":621,"total_tokens":677,"source":"provider_reported"}}
spark.draft model=muse-spark-1.3 mode=live status=success request_hash=07a1ae78805d0650311600fa16f65c573810fb8f242e64c7cef0d2cdd240be5f response_hash=d503bf186496ef7191c98b82399789832a2b56dfdc6be33b6db5cf6cfe7a695e diagnostics={"http_status":200,"response":{"status":"completed","model":"muse-spark-1.3"},"incomplete_details":{"reason":null},"usage":{"input_tokens":95,"output_tokens":1084,"total_tokens":1179,"source":"provider_reported"}}
wonder.review model=muse-spark-1.3 mode=live status=success request_hash=2544774b53553bad142f7da71cbbaf3f1fb579d92b93dfa5a49e0f34b4cc009f response_hash=e77c96b4c3cf897a19451aadcb7f15a4149af835621312f85d5a8973608bc37d diagnostics={"http_status":200,"response":{"status":"completed","model":"muse-spark-1.3"},"incomplete_details":{"reason":null},"usage":{"input_tokens":101,"output_tokens":778,"total_tokens":879,"source":"provider_reported"}}
receipt model_calls=3 sections=4 state=REPLAYABLE
network: ATTEMPTED
```

Full stderr: (empty)
Network status: ATTEMPTED, exactly three request_attempted=true records, each validated successful. Retries: 0.
The included live-receipt.json is the exact sanitized file emitted by this smoke, not a constructed success summary.
The receipt's verified rows mean metadata supported by this adapter's provider responses; they do not certify model output truth, universal safety or independent cryptographic Replay.
Controller costAccumulated remains draft bookkeeping and is not provider billing. Real token usage is the separate numeric provider_usage evidence above.

## Validation before live

The added model-prefix test first failed under exact-only comparison while the original eight tests passed. After the requested implementation all nine passed.
The test covers exact ID and requested-dash suffix acceptance, near-miss/other-family/nonstring rejection and empty requested model rejection.
Mock cases12/12 and test:model9/9 both exited 0 before the live invocation. All13 .mjs modules passed node --check.
A separate synthetic board allowlist assertion verified that http_status/response identifiers/incomplete reason/usage survive receipt projection while body/header fields are dropped; no network was used for that assertion.

## npm run cases (mock)

Exit 0
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

## npm run test:model (mock)

Exit 0
```text
> proofpowers@0.1.0 test:model
> node --test test/model.test.mjs

✔ response model accepts exact or requested-dash suffix and rejects other names (0.455ms)
✔ mock is default, deterministic and never reads key or calls network (1.3553ms)
✔ independent run quotas refuse call 21 and record refusal without a request (1.0971ms)
✔ same run ID cannot reset the call cap using another adapter (0.1277ms)
✔ live guard refuses before reading key or invoking fetch; no live request tested (0.2191ms)
✔ unknown mode/role and malformed messages refuse without network (0.2316ms)
✔ plan, draft and review actually use three adapter calls; invalid advice is uncertain (0.8008ms)
✔ receipt keeps 3 role records, honest mock status, null usage and no raw prompts (1.4897ms)
✔ primaryUnderTest validates passed predicates; restored runner 12/12 and safe fixture corrections (40.8969ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 122.9996
```
Stderr: (empty)

## Authority and safety

The direct owner approval covers the modified code followed by exactly one live smoke/max3 calls, retry0, synthetic data and the scoped AGENTS section24 HOLD exception. No global policy/config was altered. This 13:59 authorization is distinct from the exhausted 13:33 run.
The only submitted prompts were fixed synthetic demo goals and their generated demo plan/draft. No real user name/contact/email was supplied. Local proof: run marker consumed before subprocess, result records invocation1/retry0/exception_expired=true; adapter ledger has three calls. No key file, credential-store edit, commit, push or external message send occurred.
The environment variable name META_API_KEY is unchanged; no value is in this package. Keys were checked only in memory for exact-value leak detection before archive creation.

## Remaining limits / open question (1)

Credit-team dashboard Requests delta, team binding and monetary credit usage remain NOT_VERIFIED. The owner can confirm the expected +3-or-less delta with the credit-team dashboard screenshot. No extra API/account query was made.
This is real Meta Model API call evidence through Muse Spark1.3 for the three logical agent roles; it is NOT a Muse Wonder model invocation, Day6 official score, production credential-isolation proof or independent Replay certificate. Existing demo token ledger/Executor limitations are unchanged.

## Files and hashes

Changed files only are packaged under proofpowers-build/, with REVIEW.md, live-receipt.json and SHA256SUMS. Apply on the stated base; unchanged files are omitted.
SHA256SUMS includes every payload/review/receipt file and excludes itself to avoid circular hashing. CRC and exact member-byte readback are checked after packaging.

| Changed file | SHA-256 |
|---|---|
| `proofpowers-build/scripts/model-smoke.mjs` | `f222036903c0eb71eddaef8eafd02d08498fc6e48a6511f1950d5f0d6caadb5a` |
| `proofpowers-build/src/board/board.mjs` | `d7ec0c8b9201292eec91238f79380a1ed5ce4f58f709b9fa5af0877ba06885fc` |
| `proofpowers-build/src/model/meta.mjs` | `996e6497321fc40978e0a211803f69fd3dfd71cc1882302b33ffacde7feae01b` |
| `proofpowers-build/test/model.test.mjs` | `1495818847b7bb04cdf99414a8a69fcc6118ebaeff44e655367118779fe8c79f` |
