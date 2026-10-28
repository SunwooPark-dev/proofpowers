# Day5 live evidence — 2026-10-27 PT

## Result
PARTIAL: forced-error fallback proven live, final HELD/R-08. Normal smoke invoked once but refused before network by RUN_BUDGET_RESERVATION_DENIED; normal PASS NOT VERIFIED. No retries, commits, pushes, external sends, or code changes during this live batch. Scoped owner HOLD exception consumed and EXPIRED.

Two smoke invocations; only two actual API requests (invalid Wonder, successful Spark). Normal run remains DRAFT, not a policy HOLD or PASS. No fallback was manufactured for budget denial.

## Fresh mock verification
npm run cases: 12/12, PASS6/6, BLOCK6/6, PENDING0, hard-gate PASS. demo-calls fixed4 + ignored1; unapproved0, tampered0. npm run test:model: 19/19. Mock tests do not prove real model quality.

## Live calls
| Run | Role | Requested model | HTTP | Input | Output | Total | USD estimate | Request attempted |
|---|---|---|---|---|---|---|---|---|
| Forced | wonder.plan | muse-wonder-INVALID | 404 | None | None | None | None | True |
| Forced | spark.draft | muse-spark-1.3 | 200 | 79 | 1048 | 1127 | 0.00455275 | True |
| Normal | wonder.plan | muse-wonder-1.0 | not called | None | None | None | None | False |

None means not observed, never zero-cost proof. The invalid-model request returned404; its response model and usage were not observed. Spark response.model exactly muse-spark-1.3, status completed. Provider bodies, headers and key excluded. Source pricing is owner supplied, not billing reconciliation.

## Shared reservation budget
Limit $0.10. Unknown invalid-Wonder reservation retained: $0.05818. Successful Spark estimated cost: $0.00455275. Accounted reservation plus known estimate: $0.06273275; available $0.03726725. Next Wonder requires $0.05818 reservation, which exceeds remaining headroom; normal request was refused BEFORE fetch. Do not report $0.06273275 as actual spend. Actual total cost remains UNKNOWN because invalid request usage is absent. Ledger is a conservative local reservation policy, not a provider-enforced billing cap. No reservations released or limits changed to force success.

## ROUTE_FALLBACK original controller audit event (live)
```json
{
  "actor": "system",
  "cost_tick": 0,
  "detail": {
    "costs": [
      {
        "calls": 1,
        "complete": false,
        "input_tokens": null,
        "model": "muse-wonder-1.0",
        "output_tokens": null,
        "usd_estimate": null
      }
    ],
    "failed_role": "wonder.plan",
    "from_model": "muse-wonder-1.0",
    "to_model": "muse-spark-1.3"
  },
  "event": "ROUTE_FALLBACK",
  "hash": "8eccfea302796ef9258fe80ca30f8e7b43949746feb67dd650187f3b39d9e9f6",
  "payload_hash": null,
  "prev_hash": "a3d1d0185874b368f592787a46b58b26686ce39cc8bc1e792e6a9ab1e25c921b",
  "reason": "META_HTTP_ERROR",
  "rule_ids": [],
  "run_id": "399d84bf-34a8-4424-b50c-8101567088e5",
  "seq": 2,
  "state_from": "DRAFT",
  "state_to": "DRAFT",
  "ts": "2026-10-28T01:32:23.480Z"
}
```

## Full sanitized live stdout/stderr
### Forced
```text
model:smoke mode=live real_meta_use=true
wonder.plan model=muse-wonder-INVALID mode=live status=refused request_hash=3684cd9ec4a331235d26736b5da35c8cdc077f5d76ef90c99436009d8a5b40aa response_hash=null diagnostics={"http_status":404,"response":{"status":null,"model":null},"incomplete_details":{"reason":null},"usage":{"input_tokens":null,"output_tokens":null,"total_tokens":null,"source":"not_observed"},"usd_estimate":null}
spark.draft model=muse-spark-1.3 mode=live status=success request_hash=6b7184989636fd945ec9c9992e2e34c9a977caaafe4af1582149f6dc4e4b875c response_hash=b85b6dad043b55f66ca3d7a5eb9e2710e961de58e13241eb2fb86d36cedfcc22 diagnostics={"http_status":200,"response":{"status":"completed","model":"muse-spark-1.3"},"incomplete_details":{"reason":null},"usage":{"input_tokens":79,"output_tokens":1048,"total_tokens":1127,"source":"provider_reported"},"usd_estimate":0.00455275}
ROUTE_FALLBACK {"event":"ROUTE_FALLBACK","seq":2,"reason":"META_HTTP_ERROR","failed_role":"wonder.plan","from_model":"muse-wonder-1.0","to_model":"muse-spark-1.3","costs":[{"calls":1,"complete":false,"input_tokens":null,"model":"muse-wonder-1.0","output_tokens":null,"usd_estimate":null}]}
budget_accounted_usd=0.06273275 limit_usd=0.1
receipt model_calls=2 sections=4 state=HELD
network: ATTEMPTED

```
### Normal
```text
wonder.plan model=muse-wonder-1.0 mode=live status=refused request_hash=4fd89bd5df6a3323ed76ef8b44824a0cdfaa32c6490a3e1334e7823a2b35920c response_hash=null diagnostics={"http_status":null,"response":{"status":null,"model":null},"incomplete_details":{"reason":null},"usage":{"input_tokens":null,"output_tokens":null,"total_tokens":null,"source":"not_observed"},"usd_estimate":null}
model:smoke error_code=RUN_BUDGET_RESERVATION_DENIED

```

## Scope and scan
Source unchanged during this batch; current Day5 changed-file patch included for review. Base ZIP owner-attested db4503d equivalence; no PC Git history verification. README untouched. Source pattern scan20 files0 findings; Git history NOT_SCANNED. Return scan checks exact inherited key in memory and common credential patterns; no universal secret-free guarantee.

## Open question (one)
To obtain normal live PASS later, a separately authorized bounded run/budget policy is needed. This batch will not retry, reduce the retained unknown reservation, or raise the budget.
