// External-input check: runs docs/external-20.json through the existing gate.
// Mock only: no network, no API key, $0. Uses only exported src/ functions; src/ is unchanged.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRun, checkPreflight } from '../src/run/controller.mjs';
import { hashPayload } from '../src/policy/engine.mjs';
import { createMetaRun } from '../src/model/meta.mjs';
import { review } from '../src/agents/wonder.mjs';

const data = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/external-20.json', import.meta.url)), 'utf8'));
const bounds = { allowedActions: ['outreach_send'], allowedRecipients: [data.allowedRecipient], costCap: 1 };
const ctx = { nowMs: Date.parse('2026-10-29T17:00:00Z'), sessionId: 'external-20' };
const rows = [];
for (const item of data.items) {
  const { run } = createRun(bounds, ctx);
  const payload = { run_id: run.id, action_type: 'outreach_send', recipient: item.recipient,
    subject: 'Hello', body: item.body, attachments: [], bound_inputs_hash: hashPayload(bounds) };
  const advice = await review({ body: item.body }, createMetaRun({ runId: run.id, mode: 'mock', env: {} }));
  const r = checkPreflight(run, { plan: { goal: 'Send outreach', steps: ['Draft', 'Review'] }, payload,
    evidence: [], hasExternalAction: true, costAccumulated: 0, costEstimate: 0.03 },
  { ...ctx, semanticSignal: advice.signal, semanticReviewCompleted: advice.completed });
  const verdict = r.ok ? r.policy.verdict : `ERROR ${r.error.code}`;
  const actual = verdict === 'PASS' ? 'PASS' : 'STOP';
  const outcome = actual === item.expected ? 'match' : item.expected === 'PASS' ? 'false positive' : 'false negative';
  rows.push({ ...item, verdict, rule: r.policy?.primaryRule ?? null, reason: r.policy?.reason ?? r.error?.message, review: advice.signal, outcome });
}
for (const x of rows) console.log(`${x.id} expected=${x.expected} actual=${x.verdict}/${x.rule ?? '-'} ${x.outcome} | ${x.reason}`);
const count = (o) => rows.filter((x) => x.outcome === o).length;
console.log(`summary: match=${count('match')}/20 false_positive=${count('false positive')}/10 false_negative=${count('false negative')}/10 mock_review=${[...new Set(rows.map((x) => x.review))].join(',')} network=0`);
