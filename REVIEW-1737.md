# Wonder + Spark fixed-role live smoke — owner 2026-10-27 17:33

Generated: 2026-10-27T17:37:06.880692-07:00 (America/Los_Angeles).

## Outcome

**SUCCESS: one live smoke, exactly three requests, HTTP 200/completed for every call, exact response model equality, exit 0.**
Wonder plan/review actually returned muse-wonder-1.0; Spark draft actually returned muse-spark-1.3. Receipt state REPLAYABLE, verified Model call rows **3**.
**No fallback, no retry, no code change, no push or commit.** The one-shot AGENTS24 HOLD exception expired immediately when the subprocess returned. No future call is authorized by it.
Total usage: input **266**, output **2187**, total **2453 tokens**.
Sum of recorded per-call usd_estimate: **USD 0.0292685** using the owner's rate table, NOT an observed billing charge.

## Base and code immutability

Input source bundle: <local-path>, SHA-256 `e3f619084c6ea5bac604d029c62eca997d9098e7233a4f787a475490411abd51`.
All16 project code/support files were byte-matched against the reconstructed codex-return-20261027-1724.zip tree (SHA-256 `237ad71ae4d094142b6170e552484190a47d6ca5a1318fd2a0d7ac3a2ea755b2`).
The bundle's old reports/live receipt were not reused as this run's evidence. A fresh parent output path was used for the actual smoke receipt.
All16 SHA-256 values were frozen before mock and rechecked after live: no changes. No canonical VM/Git history inspection is claimed; the bundle's commit label is provenance supplied by the owner.

## Authorization and actual execution

Direct owner approval: 2026-10-27 17:33 PT. Only one unchanged-code Wonder+Spark smoke, max3 calls, retry0, fake demo data, no key/body/header logging, no commit/push. Scoped AGENTS section24 CREDENTIAL_GUARD_HOLD exception only; no global policy was edited.
An exclusive one-shot marker was written as consumed BEFORE launching the command. After subprocess completion it was marked expired. Invocation count1, request_attempted records3, retries0.
META_API_KEY_PRESENT=true was printed only as a boolean. The value was inherited through the process environment and never echoed or persisted; no alternate key was used.
Live environment: PP_MODEL_MODE=live, PP_SPEND_LIMIT_CONFIRMED=1, META_API_BASE=https://api.meta.ai/v1. Model selection is from frozen role constants; no META_MODEL override was used.

## Role diagnostics and cost estimates

| Role | Requested AND returned model | HTTP | response.status | incomplete reason | Input | Output | Total | usd_estimate |
|---|---|---|---|---|---|---|---|---|
| wonder.plan | muse-wonder-1.0 | 200 | completed | None | 56 | 486 | 542 | 0.009944 |
| spark.draft | muse-spark-1.3 | 200 | completed | None | 111 | 967 | 1078 | 0.0042485 |
| wonder.review | muse-wonder-1.0 | 200 | completed | None | 99 | 734 | 833 | 0.015076 |
| TOTAL | | | | | 266 | 2187 | 2453 | 0.0292685 |

Wonder subtotal: input155/output1220, USD0.0250200 estimate. Spark subtotal: input111/output967, USD0.0042485 estimate.
Rates are the owner-provided flat rates per million tokens: Wonder input4/output20; Spark input1.25/output4.25. Cached discounts, taxes or provider billing reconciliation are not independently verified. Provider output_tokens may include reasoning tokens; no reasoning/body text is included.
The receipt's Controller costAccumulated=0 is internal draft bookkeeping and NOT a statement of zero provider cost. The per-row usd_estimate and provider numeric token counts above are the relevant model-call evidence.

## ROUTE_FALLBACK and strict completion

ROUTE_FALLBACK count: **0**. No Wonder failure occurred; neither regional-failure handling nor the Spark-only fallback branch was exercised live in this invocation. Existing mock fallback tests passed before execution.
All response statuses are completed. All returned model IDs exactly equal their requested IDs. No prefix allowance, status relaxation, schema repair, alternate command, second invocation or retry was used.

## Full live stdout

Command: `npm run model:smoke -- --receipt-json ../live-receipt.json`
Exit code: 0.

```text
> proofpowers@0.1.0 model:smoke
> node scripts/model-smoke.mjs --receipt-json ../live-receipt.json

model:smoke mode=live real_meta_use=true
wonder.plan model=muse-wonder-1.0 mode=live status=success request_hash=4fd89bd5df6a3323ed76ef8b44824a0cdfaa32c6490a3e1334e7823a2b35920c response_hash=91161c5d85bd5650b13126a4932b6cde899dc9c6e4e523839a61ed5667c2a193 diagnostics={"http_status":200,"response":{"status":"completed","model":"muse-wonder-1.0"},"incomplete_details":{"reason":null},"usage":{"input_tokens":56,"output_tokens":486,"total_tokens":542,"source":"provider_reported"},"usd_estimate":0.009944}
spark.draft model=muse-spark-1.3 mode=live status=success request_hash=f396997c12fce0aab5f4154ad1b7072a3f020da1bd3a008054535aa149640970 response_hash=bd879f56987c264a5d258910cd625cc57d959cf19cf111f957661aa1b541c045 diagnostics={"http_status":200,"response":{"status":"completed","model":"muse-spark-1.3"},"incomplete_details":{"reason":null},"usage":{"input_tokens":111,"output_tokens":967,"total_tokens":1078,"source":"provider_reported"},"usd_estimate":0.0042485}
wonder.review model=muse-wonder-1.0 mode=live status=success request_hash=d02c7bfee60bcdc58146b4c0e94a9b9a14388e02999ede819f5e90407429c081 response_hash=1f60c7dd49c3d8f2d4f8f90cb96b3778720dd0e5911c6369f1575f11b2739f02 diagnostics={"http_status":200,"response":{"status":"completed","model":"muse-wonder-1.0"},"incomplete_details":{"reason":null},"usage":{"input_tokens":99,"output_tokens":734,"total_tokens":833,"source":"provider_reported"},"usd_estimate":0.015076}
receipt model_calls=3 sections=4 state=REPLAYABLE
network: ATTEMPTED
```

Full stderr: (empty)
Network: ATTEMPTED, exactly three recorded requests, all successful. Other external sends: none.
The included live-receipt.json is the exact sanitized file emitted by this subprocess. Model_calls has three verified rows; it is not a copied or synthesized receipt. Prompts, response body, headers and keys are excluded.

## Required pre-live checks

Mock `npm run cases`: 12/12, hard-gate PASS, PENDING0. `npm run test:model`: 14/14 PASS. Both exit0 and code hashes unchanged before live.

## npm run cases — full mock output

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

## npm run test:model — full mock output

Exit 0
```text
> proofpowers@0.1.0 test:model
> node --test test/model.test.mjs

✔ response model requires exact ID and rejects prefixes and other models (0.4988ms)
✔ four roles use frozen model constants; META_MODEL override is never read (2.2715ms)
✔ owner rate table produces model-specific USD estimates and unknown usage stays null (1.4549ms)
✔ Wonder planning failure logs ROUTE_FALLBACK; Spark-only external run stays HOLD (6.3186ms)
✔ Wonder review failure permits internal receipt-only work without claiming review completion (1.3987ms)
✔ budget fallback is logged but cannot bypass R05; external missing review defaults HOLD (0.8948ms)
✔ mock is default, deterministic and never reads key or calls network (0.197ms)
✔ independent run quotas refuse call 21 and record refusal without a request (0.553ms)
✔ same run ID cannot reset the call cap using another adapter (0.1095ms)
✔ live guard refuses before reading key or invoking fetch; no live request tested (0.2218ms)
✔ unknown mode/role and malformed messages refuse without network (0.2454ms)
✔ plan, draft and review actually use three adapter calls; invalid advice is uncertain (0.2466ms)
✔ receipt keeps 3 role records, honest mock status, null usage and no raw prompts (0.596ms)
✔ primaryUnderTest validates passed predicates; restored runner 12/12 and safe fixture corrections (37.3968ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 132.182
```
Stderr: (empty)

## Safety and remaining questions (1)

All inputs were fixed fake demo planning/drafting data; no real user/customer name/contact/email was provided. No outgoing outreach was executed (internal draft-only smoke). No project source, expected case, credential store, global setting, Git index or repository was modified. No key/body/header is in the returned files.
Credit-team dashboard Requests delta, account/team binding and actual monetary charge remain **NOT_VERIFIED**. The owner can check the intended credit-team dashboard/screenshot for the expected +3 relative to their own prior baseline; no additional API/dashboard query was made here.
The successful model roles are real API evidence for this bounded smoke, not Day6 official fixed-12 scoring, universal model quality, production credential isolation or independent persisted Replay certification.

## Package manifest

This ZIP contains only REVIEW.md, the actual live-receipt.json and SHA256SUMS as requested. SHA256SUMS covers the review and receipt, excluding its own self-reference. ZIP CRC and exact byte readback are verified after creation.
The following are the frozen unchanged SOURCE hashes for code immutability, not extra files in the return ZIP:

| Source file | SHA-256 |
|---|---|
| `README.md` | `c8813caa50b24008826ac68b9d9e0be9b333facd1d9f41b4ad62b8cd0e7ea433` |
| `package.json` | `82628184e539880d5870b633909f65ad128510ded57bacb136a188e6ea853fc4` |
| `scripts/model-smoke.mjs` | `708ce196834bbaf67d2afea4e4603d870f9594c1fe165d044effe0ec0ee0ba31` |
| `scripts/smoke.mjs` | `bbc7d115eed58beb9838b88cef372856d7c6d92284ebb4305215bc7008d8e1db` |
| `src/agents/spark.mjs` | `62990edd25cf5fdafe893ac7e17959a6c64e16d1111e69d7b681968a7331cdcf` |
| `src/agents/wonder.mjs` | `2ffef97964d5b301ceda942d6a0068d1ba1a936b01e8d90b75b6750b6926ec60` |
| `src/board/board.mjs` | `56946e23d1df955017c6a53ba550cfbb93915d8b1cfed7c447d30385d3939d7b` |
| `src/cases/cases.mjs` | `cb1ec96dfc3ca938b9e7da3c3c612ff6f0b0b19e96e2104b9d14f80ab7a2275d` |
| `src/cases/run.mjs` | `57507d1b14b14f6b33b68130a5615941016f9e9bd8c851a822c521eb0705e14b` |
| `src/envelope/envelope.mjs` | `e6d8950a7201add87e56000c3701f8d6057e3d3c8c436cfc149e2f40fe29bba7` |
| `src/envelope/executor.mjs` | `ea9c535c1fa9a03f1471234c38a9dfca3a340f9e987368f32eddc1932b6ce28c` |
| `src/model/costs.mjs` | `a2c868bc85dcdab3c4b972f17909d13617cb1e0e1e39a4f896282fea2f4aaf47` |
| `src/model/meta.mjs` | `eca645c36ba49db09e85dcdf27db9dcf1cc57e7f41c66b2920d9542ec41b1556` |
| `src/policy/engine.mjs` | `a9969d1f44ec8c2b3f813f0af000cb757f6c278bd84a2fb5fb6e55b546c66634` |
| `src/run/controller.mjs` | `72010b57edfab7246bc3470c904e7a1f7f05f3a865ad8d9c98115c69fbac31d6` |
| `test/model.test.mjs` | `6d4a06188564c44773d6f4b578a82d82a0a17a35785863c8939132579310ac9a` |
