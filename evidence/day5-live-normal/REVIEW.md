# ProofPowers Day5b — normal live smoke, owner19:31

Result: PASS. Exactly one smoke invocation, three actual API requests, zero retries. Role order Wonder plan -> Spark draft -> Wonder review. All responses HTTP200, completed, response.model exact match. Final receipt REPLAYABLE; policy preflight PASS/R-06. No fallback events.

## Scope and changes
Base: Day5b tree matched every source entry in codex-return-20261027-1929.zip (SHA ae74ebff08668614aa6f3f68d93784f8fb9a40e782963d26907166d01e2082ff). Only scripts/model-smoke.mjs changed before execution: fixed budget creation0.10 ->0.15 and printed limit0.1 ->0.15. Included in ZIP. No production routing/prompt/output limit changes. Source hashes unchanged during live. README unchanged. No Git repository/history claim. No commit/push, key persisted, raw provider body/header output, or outreach send. Synthetic internal draft only.

## Per-call provider metadata
| Role | Requested model | Response model | Exact | HTTP | Status | Input | Output | Total | USD estimate |
|---|---|---|---|---|---|---|---|---|---|
| wonder.plan | muse-wonder-1.0 | muse-wonder-1.0 | true | 200 | completed | 56 | 516 | 572 | 0.010544 |
| spark.draft | muse-spark-1.3 | muse-spark-1.3 | true | 200 | completed | 111 | 1376 | 1487 | 0.00598675 |
| wonder.review | muse-wonder-1.0 | muse-wonder-1.0 | true | 200 | completed | 135 | 616 | 751 | 0.01286 |

## Totals and budget verification
```json
{
  "final_verdict": "PASS",
  "receipt_state": "REPLAYABLE",
  "api_requests": 3,
  "retry_count": 0,
  "budget_limit_usd": 0.15,
  "usd_estimate_total": 0.02939075,
  "remaining_usd": 0.12060925,
  "peak_reserved_plus_settled_usd": 0.07605475,
  "input_tokens": 302,
  "output_tokens": 2508,
  "total_tokens": 2810,
  "model_ids_exact_match": true,
  "audit_event_hashes_verified": 3,
  "exception_status": "EXPIRED",
  "code_unchanged_during_live": true
}
```
Every request was reserved before fetch and settled before the next request using provider-reported tokens and the owner-supplied price table (Wonder4/20, Spark1.25/4.25 USD per million). TotalUSD0.02939075 is an estimate, not a billing statement. Maximum settled-plus-next-reservation exposureUSD0.07605475 <=USD0.15. Budget journal confirms all three reservations settled. The local token framing bound remains a reservation assumption, not a provider billing hard cap.

## BUDGET_SETTLED original Controller events
Individual event hashes3/3 verified; adjacent links between these three events verified. First prev_hash references RUN_CREATED outside this event subset.
```json
[
  {
    "actor": "system",
    "cost_tick": 0,
    "detail": {
      "reserved": 0.05818,
      "role": "wonder.plan",
      "settled": 0.010544,
      "ticket_id": "5b123e8a-9fc1-43be-8325-5d66b82bef8f"
    },
    "event": "BUDGET_SETTLED",
    "hash": "6a4db9ba42f35d44ca5dee7f38e578949d52a1d3a5a0009b66487ec49dd0f9a2",
    "payload_hash": null,
    "prev_hash": "2eb0c82dbcd83bacd5c472f2227fe8b493efec6834968cf967c5543312c8b37a",
    "reason": "PROVIDER_USAGE_ESTIMATE",
    "rule_ids": [],
    "run_id": "cbfb939e-b900-41b7-9438-d95c8a9fa242",
    "seq": 2,
    "state_from": "DRAFT",
    "state_to": "DRAFT",
    "ts": "2026-10-28T02:33:27.170Z"
  },
  {
    "actor": "system",
    "cost_tick": 0,
    "detail": {
      "reserved": 0.01452275,
      "role": "spark.draft",
      "settled": 0.00598675,
      "ticket_id": "b27ef7a2-93c2-450b-9c6d-197e9f010123"
    },
    "event": "BUDGET_SETTLED",
    "hash": "c35932700e9d75d7f52c537fc84592d96d0a41b8c356475b70a97a3e93188ad3",
    "payload_hash": null,
    "prev_hash": "6a4db9ba42f35d44ca5dee7f38e578949d52a1d3a5a0009b66487ec49dd0f9a2",
    "reason": "PROVIDER_USAGE_ESTIMATE",
    "rule_ids": [],
    "run_id": "cbfb939e-b900-41b7-9438-d95c8a9fa242",
    "seq": 3,
    "state_from": "DRAFT",
    "state_to": "DRAFT",
    "ts": "2026-10-28T02:33:32.665Z"
  },
  {
    "actor": "system",
    "cost_tick": 0,
    "detail": {
      "reserved": 0.059524,
      "role": "wonder.review",
      "settled": 0.01286,
      "ticket_id": "11a40a61-6c85-43e2-9185-4e8d1db1cf02"
    },
    "event": "BUDGET_SETTLED",
    "hash": "a663b62559764bf49430d1236c8a4c3145e8187745d58bf281d818094f5c5e27",
    "payload_hash": null,
    "prev_hash": "c35932700e9d75d7f52c537fc84592d96d0a41b8c356475b70a97a3e93188ad3",
    "reason": "PROVIDER_USAGE_ESTIMATE",
    "rule_ids": [],
    "run_id": "cbfb939e-b900-41b7-9438-d95c8a9fa242",
    "seq": 4,
    "state_from": "DRAFT",
    "state_to": "DRAFT",
    "ts": "2026-10-28T02:33:37.102Z"
  }
]
```

## Fresh mock verification
cases12/12, hard-gate PASS, PENDING0, demo calls fixed4 + ignored1, unapproved0 and tampered0. Model tests29/29. Mock commands ran behind offline guard with zero network attempts. Full logs: mock-results.json.

## Evidence limits
This is an internal normal-path model smoke, not real email delivery or a Day6 full-score result. The display's R08 semantic signal remains NOT CERTIFIED (no explicit semantic observation passed to the board); three verified model calls do not change that label. Executor result is NOT CERTIFIED as no executor was invoked. No extra call or retry to address display metadata. The approved one-use exception is EXPIRED.

## Full sanitized live stdout/stderr
```text

> proofpowers@0.1.0 model:smoke
> node scripts/model-smoke.mjs --budget-json ../live-budget.json --receipt-json ../live-receipt.json

model:smoke mode=live real_meta_use=true
wonder.plan model=muse-wonder-1.0 mode=live status=success request_hash=4fd89bd5df6a3323ed76ef8b44824a0cdfaa32c6490a3e1334e7823a2b35920c response_hash=22ccf173c9c10672fd4976841c33b3fa0e76caf8cdd89063f2c64bcde2a9b106 diagnostics={"http_status":200,"response":{"status":"completed","model":"muse-wonder-1.0"},"incomplete_details":{"reason":null},"usage":{"input_tokens":56,"output_tokens":516,"total_tokens":572,"source":"provider_reported"},"usd_estimate":0.010544}
spark.draft model=muse-spark-1.3 mode=live status=success request_hash=6c45d8fee95253524c0af9e13728af1fb8d2a0e4a61e64159acdb4bb50abb8d8 response_hash=33f9f0d80b896f5969638326b5d6e3927071ca2fd215a44d083c05402147326a diagnostics={"http_status":200,"response":{"status":"completed","model":"muse-spark-1.3"},"incomplete_details":{"reason":null},"usage":{"input_tokens":111,"output_tokens":1376,"total_tokens":1487,"source":"provider_reported"},"usd_estimate":0.00598675}
wonder.review model=muse-wonder-1.0 mode=live status=success request_hash=c2ffbc550f364ed01e9bdd020ccfbe2cbf5351c7d2406e80c44a69c424f6839e response_hash=f5405753403efba4124175b2b534b8b87e1303a7a45b3dfccb8df5691131c95d diagnostics={"http_status":200,"response":{"status":"completed","model":"muse-wonder-1.0"},"incomplete_details":{"reason":null},"usage":{"input_tokens":135,"output_tokens":616,"total_tokens":751,"source":"provider_reported"},"usd_estimate":0.01286}
BUDGET_SETTLED {"actor":"system","cost_tick":0,"detail":{"reserved":0.05818,"role":"wonder.plan","settled":0.010544,"ticket_id":"5b123e8a-9fc1-43be-8325-5d66b82bef8f"},"event":"BUDGET_SETTLED","hash":"6a4db9ba42f35d44ca5dee7f38e578949d52a1d3a5a0009b66487ec49dd0f9a2","payload_hash":null,"prev_hash":"2eb0c82dbcd83bacd5c472f2227fe8b493efec6834968cf967c5543312c8b37a","reason":"PROVIDER_USAGE_ESTIMATE","rule_ids":[],"run_id":"cbfb939e-b900-41b7-9438-d95c8a9fa242","seq":2,"state_from":"DRAFT","state_to":"DRAFT","ts":"2026-10-28T02:33:27.170Z"}
BUDGET_SETTLED {"actor":"system","cost_tick":0,"detail":{"reserved":0.01452275,"role":"spark.draft","settled":0.00598675,"ticket_id":"b27ef7a2-93c2-450b-9c6d-197e9f010123"},"event":"BUDGET_SETTLED","hash":"c35932700e9d75d7f52c537fc84592d96d0a41b8c356475b70a97a3e93188ad3","payload_hash":null,"prev_hash":"6a4db9ba42f35d44ca5dee7f38e578949d52a1d3a5a0009b66487ec49dd0f9a2","reason":"PROVIDER_USAGE_ESTIMATE","rule_ids":[],"run_id":"cbfb939e-b900-41b7-9438-d95c8a9fa242","seq":3,"state_from":"DRAFT","state_to":"DRAFT","ts":"2026-10-28T02:33:32.665Z"}
BUDGET_SETTLED {"actor":"system","cost_tick":0,"detail":{"reserved":0.059524,"role":"wonder.review","settled":0.01286,"ticket_id":"11a40a61-6c85-43e2-9185-4e8d1db1cf02"},"event":"BUDGET_SETTLED","hash":"a663b62559764bf49430d1236c8a4c3145e8187745d58bf281d818094f5c5e27","payload_hash":null,"prev_hash":"c35932700e9d75d7f52c537fc84592d96d0a41b8c356475b70a97a3e93188ad3","reason":"PROVIDER_USAGE_ESTIMATE","rule_ids":[],"run_id":"cbfb939e-b900-41b7-9438-d95c8a9fa242","seq":4,"state_from":"DRAFT","state_to":"DRAFT","ts":"2026-10-28T02:33:37.102Z"}
budget_accounted_usd=0.02939075 limit_usd=0.15
receipt model_calls=3 sections=4 state=REPLAYABLE
network: ATTEMPTED

```
