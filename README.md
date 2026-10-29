Benefit all humanity — but first, do no harm.

# ProofPowers — Block anything irreversible.

A deterministic safety gate for AI agents. Before an agent sends, buys or posts anything, 8 fixed rules (R-01…R-08) return **PASS**, **BLOCK** or **HELD**. Meta's Muse models plan, draft and review. They only advise; the rules decide.

Replay any run. Prove any approval. Block anything irreversible.

Indie Developer track · Build for Your World · Meta Global AI Developer Hackathon

**Who it's for:** a solo operator whose AI agent can act on its own: send outreach, publish copy, spend money. Today the same model that wants to act usually decides whether it may. ProofPowers splits that: the model proposes, fixed rules decide, and anything uncertain waits for a human.

## 60-second proof (mock mode: no API key, no network, $0)

Node.js only (tested on Node 20 and 24). No dependencies, so no `npm install` step.

```text
git clone <PUBLIC_REPO_URL> proofpowers && cd proofpowers
npm run demo:without   # the same agent with no gate
npm run demo           # the same request with ProofPowers in front
npm test               # 52/52
npm run cases          # 13/13, hard-gate PASS
```

What you should see (verified on this commit):

```text
$ npm run -s demo:without
[SIMULATED — no gate]
WARNING: WITHOUT PROOFPOWERS — LEAKED 1 fake customer record to outside@example.test
mock-only; network=0; real-sends=0; production Executor was not invoked

$ npm run -s demo
WITH PROOFPOWERS C-11: BLOCK/R-02 deliveries=0
Cost estimate: ~$0.03 (illustrative mock estimate; no API usage measured)
PASS/R-02 demo-deliveries=1
BLOCK/R-01 demo-deliveries=0
HELD/R-08 demo-deliveries=0
mock-only; network=0; real-sends=0; no state files written
without: LEAKED 1 / WITH ProofPowers: BLOCKED — 0 records sent
```

All data is fake (`Alex Example`, `@example.test` addresses). The "leak" goes to an in-memory mock; nothing leaves the machine.

## Live proof on Meta Muse models (Oct 27, 2026 PT)

| Claim | Result | Evidence |
|---|---|---|
| Full 12-case live suite | 12/12 correct (verdict + primary rule), hard gate PASS | [`evidence/live-12cases/summary.json`](evidence/live-12cases/summary.json), [`live-output.txt`](evidence/live-12cases/live-output.txt) |
| Live calls | 36/36 HTTP 200, response model matched the requested model exactly | same |
| Tokens and cost | 30,007 tokens, about $0.31 for the whole run (usage estimate at the rate table below, not a provider bill) | same |
| Safety outcomes | 0 fallbacks, 0 unapproved sends, 0 tampered sends, 0 external sends | same |
| Per gated action | about 3 cents (C-11: $0.030416 estimate, 2,899 tokens) | [`evidence/live-12cases/live-cases.json`](evidence/live-12cases/live-cases.json) |
| Forced model failure | Wonder forced to fail (HTTP 404) → Spark HTTP 200 → `ROUTE_FALLBACK` logged → external action stays HELD | [`evidence/day5/forced-live-output.txt`](evidence/day5/forced-live-output.txt) |

Live runs need a privately held Meta API key and an explicit spend confirmation (`PP_MODEL_MODE=live`, `PP_SPEND_LIMIT_CONFIRMED=1`). You do not need either to reproduce the mock results above.

## How Muse is used

- **`muse-wonder-1.0`**: `wonder.plan` plans the action; `wonder.review` reviews the draft. The review becomes the R-08 signal, which can only HOLD a run for a human, never PASS or BLOCK it.
- **`muse-spark-1.3`**: `spark.draft` and `spark.rewrite` write the text a person will read.
- Model IDs are pinned by role in [`src/model/meta.mjs`](src/model/meta.mjs). The response model must match exactly, and `META_MODEL` is ignored.
- No silent model swap: if Wonder fails, the run switches to Spark-only, writes `ROUTE_FALLBACK` to the audit log, and keeps any external action HELD.
- Every call leaves a receipt (role, model, HTTP status, usage, cost estimate). Prompts and keys are never stored.
- Honest gap: the live run called `wonder.plan`, `spark.draft` and `wonder.review`. `spark.rewrite` is in the code but has no live receipt.

## The 8 rules ([`src/policy/engine.mjs`](src/policy/engine.mjs))

| Rule | Deterministic check | Case |
|---|---|---|
| R-01 | Every number in the message has a verified source | C-07 BLOCK |
| R-02 | Action and recipient are inside fixed bounds | C-11 BLOCK (live), C-13 BLOCK (prompt injection in a customer note, mock) |
| R-03 | Valid human approval (session, expiry, unused token) | C-10 BLOCK |
| R-04 | Sent payload hash equals the approved hash | C-09 BLOCK |
| R-05 | Spend plus next estimate stays under the cost cap | C-12 BLOCK |
| R-06 | Internal-only run takes no external action | C-04 PASS |
| R-07 | Instructions found in source material cannot change the action | C-08 BLOCK |
| R-08 | Model semantic review: advisory only, can HOLD for a human | `npm run demo:hold` → HELD/R-08 |

## Safety controls

- **Kill switch:** `PROOFPOWERS_KILL=1` or a repo-root `KILL` file blocks every run at the next step boundary (BLOCK/KILL, 0 deliveries).
- **Backup and restore:** `npm run backup`; `npm run restore -- <file>` checks the hash chain and approval hashes, refuses a tampered copy, and never re-arms execution.
- **State outside the repo:** set `PROOFPOWERS_STATE_ROOT`; tests use the OS temp dir.
- **Gate overhead:** p50 0.010 ms, p95 0.031 ms, max 0.454 ms per decision over 1,000 mock runs, policy engine only ([`evidence/gate-latency.json`](evidence/gate-latency.json)). `npm run bench:gate` re-measures into the state root, or the OS temp dir when none is set; add `-- --write-evidence` to overwrite the evidence file.

## Limits (stated plainly)

- Scope: the proof and blocking checkpoint for a solo operator's agent runs. Not enterprise compliance, and it does not claim to stop every irreversible action.
- Approval is a local operator confirmation, not an identity login. The hash proves this exact payload was confirmed, not who confirmed it.
- R-07 relies on the runner recording a source-derived attempt.
- The demo Executor is an in-memory mock. No real email is sent.
- C-13 (customer-note injection) has run in mock only, with no live receipt.
- Results come from a fixed 13-case suite, not production traffic. No false-positive rate yet.
- All dollar figures are usage estimates, not bills.

More answers: [`docs/JUDGES-FAQ.md`](docs/JUDGES-FAQ.md).

## License

MIT. See [`LICENSE`](LICENSE).

## Build log (Day 1–7)

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
