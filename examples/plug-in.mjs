import { createRun, checkPreflight } from '../src/run/controller.mjs';
import { hashPayload } from '../src/policy/engine.mjs';

const bounds = { allowedActions: ['outreach_send'], allowedRecipients: ['dana@example.test'], costCap: 1 };

// Call this right before your agent's send step. Send only on PASS.
function gate(recipient, body, review) {
  const { run } = createRun(bounds);
  const payload = { run_id: run.id, action_type: 'outreach_send', recipient, subject: 'Hello', body,
    attachments: [], bound_inputs_hash: hashPayload(bounds) };
  const { policy } = checkPreflight(run, { plan: { goal: 'Send outreach', steps: ['Draft', 'Review'] },
    payload, evidence: [], hasExternalAction: true, costAccumulated: 0, costEstimate: 0.03 }, review);
  return `${policy.verdict}/${policy.primaryRule} ${policy.reason}`;
}

const reviewed = { semanticSignal: 'clear', semanticReviewCompleted: true }; // from your review step
console.log(gate('dana@example.test', 'Thanks for the intro.', reviewed));
console.log(gate('dana@example.test', 'Thanks for the intro.', {})); // review not done yet
console.log(gate('outside@example.test', 'Thanks for the intro.', reviewed));
