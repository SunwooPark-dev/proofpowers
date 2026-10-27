import { randomUUID } from 'node:crypto';
import { canonicalize, hashPayload, checkCost, evaluatePreflight,
  evaluateExecutionPredicates } from '../policy/engine.mjs';

const runs = new WeakMap();
const runIds = new Set();
const usedTokens = new Set();
const text = (x) => typeof x === 'string' && x.trim().length > 0;
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const finiteCost = (x) => Number.isFinite(x) && x >= 0;
const terminal = ['EXECUTED', 'FAILED_NOT_SENT', 'BLOCKED', 'REJECTED', 'REFUSED', 'FAILED'];
const edges = {
  DRAFT: ['CHECKED', 'BLOCKED', 'FAILED'],
  CHECKED: ['HELD', 'APPROVED', 'BLOCKED', 'REJECTED', 'RECEIPTED', 'FAILED'],
  HELD: ['APPROVED', 'BLOCKED', 'REJECTED', 'FAILED'],
  APPROVED: ['DISPATCHING', 'REFUSED', 'BLOCKED', 'FAILED'],
  DISPATCHING: ['EXECUTED', 'FAILED_NOT_SENT', 'OUTCOME_UNKNOWN'],
  OUTCOME_UNKNOWN: ['EXECUTED', 'FAILED_NOT_SENT'],
  ...Object.fromEntries(terminal.map(s => [s, ['RECEIPTED', ...(s === 'FAILED' ? [] : ['FAILED'])]])),
  RECEIPTED: ['REPLAYABLE'], REPLAYABLE: [],
};

function assert(ok, code, message) {
  if (!ok) { const e = new Error(message); e.code = code; throw e; }
}
const copy = (x) => JSON.parse(canonicalize(x));
function freeze(x) {
  if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); }
  return x;
}
const detached = (x) => freeze(copy(x));
function timestamp(context = {}) {
  const ms = context.nowMs ?? Date.now();
  assert(Number.isFinite(ms) && Math.abs(ms) <= 8.64e15, 'INVALID_TIME', 'Finite timestamp required');
  return new Date(ms).toISOString();
}
function stateIs(r, states) {
  assert(states.includes(r.state), 'ILLEGAL_TRANSITION', `${r.state} is not one of ${states.join(', ')}`);
}
function event(r, name, to, reason, detail, ts, rules = []) {
  const from = name === 'RUN_CREATED' ? null : r.state;
  assert((from === null && name === 'RUN_CREATED' && to === 'DRAFT')
    || from === to || edges[from]?.includes(to), 'ILLEGAL_TRANSITION', `${from} -> ${to}`);
  const item = { seq: r.events.length + 1, ts, run_id: r.id, event: name,
    actor: name.startsWith('OPERATOR_') ? 'owner' : name.startsWith('POLICY_') ? 'policy_engine' : 'system',
    state_from: from, state_to: to, rule_ids: rules, reason,
    payload_hash: r.executionHash ?? r.payloadHash ?? null,
    cost_tick: r.costAccumulated, detail, prev_hash: r.events.at(-1)?.hash ?? null };
  const entry = detached({ ...item, hash: hashPayload(item) });
  r.events.push(entry); r.state = to;
}
function response(r, extra = {}) { return { ok: true, state: r.state, ...extra }; }
function invoke(handle, fn) {
  const r = runs.get(handle);
  if (!r) return { ok: false, state: null, error: { code: 'INVALID_RUN', message: 'Unknown controller handle' } };
  try { return fn(r); }
  catch (e) { return { ok: false, state: r.state, error: { code: e.code ?? 'INVALID_INPUT', message: e.message } }; }
}
function requireContext(context) {
  assert(object(context), 'INVALID_INPUT', 'Context must be an object');
  return { context: copy(context), ts: timestamp(context) };
}
function summaryApproval(a) {
  if (!a) return null;
  const { approval_token, ...summary } = a;
  return summary;
}
function prepareInput(r, input) {
  const x = copy(input);
  assert(object(x) && object(x.payload), 'INVALID_INPUT', 'Policy input with payload required');
  if (x.boundInputs !== undefined) {
    assert(canonicalize(x.boundInputs) === canonicalize(r.boundInputs), 'BOUND_INPUTS_CHANGED', 'Run bounds cannot be replaced');
  }
  x.boundInputs = copy(r.boundInputs);
  if (x.payload.action_type === 'outreach_send') {
    assert(x.payload.run_id === r.id, 'RUN_ID_MISMATCH', 'Payload run_id must identify this run');
  }
  delete x.approval;
  return x;
}
function holdReason(policy) {
  return policy.primaryRule === 'R-08' ? 'SEMANTIC_REVIEW_REQUIRED' : 'POLICY_INPUT_REVIEW_REQUIRED';
}
function recordPolicy(r, policy, ts) {
  r.policy = detached(policy);
  const rules = policy.primaryRule ? [policy.primaryRule] : [];
  if (policy.verdict === 'BLOCK') {
    assert(/^R-0[1-7]$/.test(policy.primaryRule), 'INVALID_POLICY', 'BLOCK needs a deterministic rule');
    event(r, 'POLICY_BLOCKED', 'BLOCKED', policy.reason, { policy }, ts, rules);
  } else if (policy.verdict === 'HELD') {
    event(r, 'POLICY_HELD', 'HELD', holdReason(policy), { policy }, ts, rules);
  } else {
    event(r, 'POLICY_PASSED', r.state, policy.reason, { policy }, ts, rules);
  }
}

// Handle identity is the authority boundary inside this process; snapshots are copies.
export function createRun(boundInputs, context = {}) {
  try {
    const b = copy(boundInputs);
    const { context: c, ts } = requireContext(context);
    assert(object(b) && Array.isArray(b.allowedActions) && b.allowedActions.every(text)
      && Array.isArray(b.allowedRecipients) && b.allowedRecipients.every(text)
      && finiteCost(b.costCap), 'INVALID_BOUNDS', 'Action/recipient lists and nonnegative costCap required');
    for (const key of ['allowedTargets', 'allowedScopes']) {
      assert(b[key] === undefined || (Array.isArray(b[key]) && b[key].every(text)), 'INVALID_BOUNDS', `Invalid ${key}`);
    }
    const id = c.runId ?? randomUUID(), sessionId = c.sessionId ?? randomUUID();
    assert(text(id) && text(sessionId) && !runIds.has(id), 'INVALID_RUN_ID', 'Unique runId and nonempty sessionId required');
    const r = { id, sessionId, state: 'DRAFT', boundInputs: detached(b), events: [], input: null,
      plan: null, policy: null, approval: null, payloadHash: null, executionHash: null,
      costAccumulated: 0, outcome: null, reconciliationRequired: false, receiptFailure: null };
    const run = Object.freeze({ id, sessionId, get state() { return r.state; } });
    event(r, 'RUN_CREATED', 'DRAFT', 'Bound Inputs fixed', { bound_inputs_hash: hashPayload(b) }, ts);
    runs.set(run, r); runIds.add(id);
    return response(r, { run });
  } catch (e) { return { ok: false, state: null, error: { code: e.code ?? 'INVALID_INPUT', message: e.message } }; }
}

export function checkPreflight(run, input, context = {}) {
  return invoke(run, r => {
    stateIs(r, ['DRAFT']);
    const { context: c, ts } = requireContext(context);
    const x = prepareInput(r, input), plan = x.plan;
    assert(object(plan) && text(plan.goal) && Array.isArray(plan.steps)
      && plan.steps.length > 0 && plan.steps.every(text), 'INVALID_PLAN', 'plan requires goal and nonempty string steps');
    assert(!finiteCost(x.costAccumulated) || x.costAccumulated >= r.costAccumulated,
      'COST_REGRESSION', 'Accumulated cost cannot decrease');
    const policy = evaluatePreflight(x, c);
    const payloadHash = hashPayload(x.payload);
    r.input = detached(x); r.plan = detached(plan); r.payloadHash = payloadHash;
    if (finiteCost(x.costAccumulated)) r.costAccumulated = x.costAccumulated;
    event(r, 'DRAFT_CHECKED', 'CHECKED', 'Plan JSON schema accepted; factual truth not certified', {}, ts);
    recordPolicy(r, policy, ts);
    return response(r, { policy: detached(policy) });
  });
}

export function recheckHeld(run, context = {}) {
  return invoke(run, r => {
    stateIs(r, ['HELD']);
    const { context: c, ts } = requireContext(context);
    const policy = evaluatePreflight(r.input, c);
    recordPolicy(r, policy, ts);
    return response(r, { policy: detached(policy) });
  });
}

export function approve(run, approval, context = {}) {
  return invoke(run, r => {
    stateIs(r, ['CHECKED', 'HELD']);
    const { ts } = requireContext(context), a = copy(approval), nowMs = Date.parse(ts);
    assert(r.policy?.verdict === 'PASS' || (r.policy?.primaryRule === 'R-08'
      && r.policy.checks.length > 0 && r.policy.checks.every(x => x.ok)),
    'NOT_APPROVABLE', 'Only a passed preflight or semantic-only hold can be approved');
    assert(r.input.hasExternalAction === true, 'NO_EXTERNAL_ACTION', 'Internal-only runs use seal without dispatch approval');
    assert(object(a) && text(a.approver) && a.decision === 'approved'
      && a.payload_hash === r.payloadHash && a.session_id === r.sessionId
      && text(a.approval_token) && text(a.at) && text(a.expires_at)
      && Number.isFinite(Date.parse(a.at)) && Date.parse(a.at) <= nowMs
      && Number.isFinite(Date.parse(a.expires_at)) && Date.parse(a.expires_at) > nowMs,
    'INVALID_APPROVAL', 'Complete, live approval for this exact payload/session required');
    assert(!usedTokens.has(hashPayload(a.approval_token)), 'TOKEN_USED', 'Approval token already consumed');
    r.approval = detached(a);
    event(r, 'OPERATOR_APPROVED', 'APPROVED', 'Local operator confirmation',
      { approval: summaryApproval(a), released_hold: r.state === 'HELD' }, ts);
    return response(r);
  });
}

export function reject(run, reason, context = {}) {
  return invoke(run, r => {
    stateIs(r, ['CHECKED', 'HELD']);
    const { ts } = requireContext(context);
    assert(text(reason), 'REASON_REQUIRED', 'Operator rejection needs a reason');
    event(r, 'OPERATOR_REJECTED', 'REJECTED', reason, {}, ts);
    return response(r);
  });
}

export function beginDispatch(run, executionInput, context = {}) {
  return invoke(run, r => {
    stateIs(r, ['CHECKED', 'HELD', 'APPROVED']);
    const { context: c, ts } = requireContext(context);
    if (r.state !== 'APPROVED') {
      const policy = { verdict: 'BLOCK', primaryRule: 'R-03', reason: 'No operator approval before dispatch', phase: 'execution' };
      recordPolicy(r, policy, ts);
      return { ok: false, state: r.state, policy, error: { code: 'EXECUTION_BLOCKED', message: policy.reason } };
    }
    const supplied = copy(executionInput);
    assert(object(supplied), 'INVALID_INPUT', 'Execution input must be an object');
    // Registry, provenance, classification, approval and bounds stay controller-owned.
    const allowed = ['payload', 'payloadHash', 'approvalHash', 'costAccumulated', 'costEstimate', 'costCap'];
    assert(Object.keys(supplied).every(k => allowed.includes(k)), 'EXECUTION_INPUT_OVERRIDE', 'Unexpected execution input field');
    const x = { ...copy(r.input), ...supplied, approval: copy(r.approval) };
    delete x.costAccumulated; delete x.costEstimate;
    if (Object.hasOwn(supplied, 'costAccumulated')) x.costAccumulated = supplied.costAccumulated;
    if (Object.hasOwn(supplied, 'costEstimate')) x.costEstimate = supplied.costEstimate;
    assert(object(x.payload) && x.payload.run_id === r.id, 'RUN_ID_MISMATCH', 'Execution payload must identify this run');
    assert(x.hasExternalAction === true, 'NO_EXTERNAL_ACTION', 'Internal-only runs cannot dispatch');
    assert(!finiteCost(x.costAccumulated) || x.costAccumulated >= r.costAccumulated,
      'COST_REGRESSION', 'Accumulated cost cannot decrease');
    const tokenKey = hashPayload(r.approval.approval_token);
    const policy = evaluateExecutionPredicates(x, { ...c, nowMs: Date.parse(ts),
      sessionId: c.sessionId ?? r.sessionId, tokenUnused: !usedTokens.has(tokenKey) });
    const hash = hashPayload(x.payload);
    const approvalFail = policy.checks?.find(p => p.rule === 'R-03' && !p.ok);
    const hashFail = policy.checks?.find(p => p.rule === 'R-04' && !p.ok);
    // At this checkpoint, approval/hash failures take precedence over draft checks.
    const failure = approvalFail ?? hashFail;
    const finalPolicy = failure ? { ...policy, verdict: 'BLOCK', primaryRule: failure.rule, reason: failure.reason } : policy;
    if (finalPolicy.verdict === 'HELD') {
      return { ok: false, state: r.state, policy: detached(finalPolicy),
        error: { code: 'EXECUTION_INDETERMINATE', message: finalPolicy.reason } };
    }
    r.executionHash = hash;
    if (finiteCost(x.costAccumulated)) r.costAccumulated = x.costAccumulated;
    r.policy = detached(finalPolicy);
    if (finalPolicy.verdict === 'BLOCK') {
      const to = finalPolicy.primaryRule === 'R-04' ? 'REFUSED' : 'BLOCKED';
      event(r, to === 'REFUSED' ? 'EXECUTION_REFUSED' : 'EXECUTION_BLOCKED', to,
        finalPolicy.reason, { policy: finalPolicy, approval_hash: r.approval.payload_hash,
          execution_hash: hash }, ts, [finalPolicy.primaryRule]);
      return { ok: false, state: r.state, policy: detached(finalPolicy),
        error: { code: 'EXECUTION_BLOCKED', message: finalPolicy.reason } };
    }
    usedTokens.add(tokenKey);
    event(r, 'DISPATCH_STARTED', 'DISPATCHING', 'Execution predicates passed; in-process token consumed',
      { policy: finalPolicy, approval_hash: r.approval.payload_hash, execution_hash: hash }, ts, ['R-03', 'R-04', 'R-05']);
    return response(r, { policy: detached(finalPolicy), payload: detached(x.payload) });
  });
}

function validateOutcome(outcome, evidence, reconciliation = false) {
  assert(['EXECUTED', 'FAILED_NOT_SENT', 'OUTCOME_UNKNOWN'].includes(outcome), 'INVALID_OUTCOME', 'Unknown provider outcome');
  const e = copy(evidence);
  assert(object(e), 'EVIDENCE_REQUIRED', 'Caller supplied provider evidence required');
  if (outcome === 'EXECUTED') {
    assert(e.accepted === true && e.confirmed === true && e.sent !== false && e.rejected !== true
      && text(e.reference) && object(e.providerResponse)
      && Object.keys(e.providerResponse).length > 0, 'EVIDENCE_REQUIRED', 'Accepted and confirmed provider response required');
  } else if (outcome === 'FAILED_NOT_SENT') {
    assert(e.rejected === true && e.sent === false && e.accepted !== true && e.confirmed !== true
      && text(e.reason) && text(e.reference)
      && object(e.providerResponse) && Object.keys(e.providerResponse).length > 0,
    'EVIDENCE_REQUIRED', 'Explicit provider rejection and not-sent evidence required');
  } else assert(text(e.reason), 'EVIDENCE_REQUIRED', 'Unknown outcome needs an uncertainty reason');
  if (reconciliation) assert(text(e.method) && text(e.observedAt) && Number.isFinite(Date.parse(e.observedAt)),
    'EVIDENCE_REQUIRED', 'Reconciliation method and observation time required');
  return e;
}

export function reportOutcome(run, outcome, evidence, context = {}) {
  return invoke(run, r => {
    stateIs(r, ['DISPATCHING']);
    const { ts } = requireContext(context), e = validateOutcome(outcome, evidence);
    r.outcome = detached({ status: outcome, evidence: e });
    event(r, 'PROVIDER_OUTCOME_RECORDED', outcome, e.reason ?? 'Provider result supplied by caller', { evidence: e }, ts);
    if (outcome === 'OUTCOME_UNKNOWN') {
      r.reconciliationRequired = true;
      event(r, 'RECONCILIATION_REQUIRED', r.state, 'No automatic retry; reconcile provider/inbox evidence', {}, ts);
    }
    return response(r);
  });
}

export function reconcile(run, finalOutcome, evidence, context = {}) {
  return invoke(run, r => {
    stateIs(r, ['OUTCOME_UNKNOWN']);
    assert(['EXECUTED', 'FAILED_NOT_SENT'].includes(finalOutcome), 'INVALID_OUTCOME', 'Reconciliation needs a final outcome');
    const { ts } = requireContext(context), e = validateOutcome(finalOutcome, evidence, true);
    r.outcome = detached({ status: finalOutcome, evidence: e, reconciled: true });
    r.reconciliationRequired = false;
    event(r, 'OUTCOME_RECONCILED', finalOutcome, 'Caller supplied reconciliation evidence', { evidence: e }, ts);
    return response(r);
  });
}

export function updateCost(run, costs, context = {}) {
  return invoke(run, r => {
    stateIs(r, ['DRAFT', 'CHECKED', 'HELD', 'APPROVED']);
    const { ts } = requireContext(context), c = copy(costs);
    assert(object(c), 'INVALID_INPUT', 'Cost observation required');
    assert(!finiteCost(c.costAccumulated) || c.costAccumulated >= r.costAccumulated,
      'COST_REGRESSION', 'Accumulated cost cannot decrease');
    const check = checkCost({ ...c, boundInputs: r.boundInputs });
    if (finiteCost(c.costAccumulated)) r.costAccumulated = c.costAccumulated;
    if (check.ok) event(r, 'COST_RECORDED', r.state, check.reason, { costEstimate: c.costEstimate }, ts, ['R-05']);
    else {
      r.policy = detached({ verdict: 'BLOCK', primaryRule: 'R-05', reason: check.reason });
      event(r, 'COST_BLOCKED', 'BLOCKED', check.reason, { check }, ts, ['R-05']);
    }
    return response(r, { withinCap: check.ok });
  });
}

export function failRun(run, reason, context = {}) {
  return invoke(run, r => {
    stateIs(r, ['DRAFT', 'CHECKED', 'HELD', 'APPROVED']);
    const { ts } = requireContext(context);
    assert(text(reason), 'REASON_REQUIRED', 'Failure needs a reason');
    event(r, 'RUN_FAILED', 'FAILED', reason, {}, ts);
    return response(r);
  });
}

export function reportReceiptFailure(run, reason, context = {}) {
  return invoke(run, r => {
    stateIs(r, terminal);
    const { ts } = requireContext(context);
    assert(text(reason), 'REASON_REQUIRED', 'Receipt failure needs a reason');
    r.receiptFailure = reason;
    event(r, 'RECEIPT_FAILED', 'FAILED', reason, { prior_outcome: r.outcome }, ts);
    return response(r);
  });
}

function receiptData(r) {
  return { run_id: r.id, session_id: r.sessionId, state: r.state,
    bound_inputs_hash: hashPayload(r.boundInputs), plan: r.plan,
    policy: r.policy, approval: summaryApproval(r.approval),
    payload_hash: r.payloadHash, execution_hash: r.executionHash,
    costAccumulated: r.costAccumulated, outcome: r.outcome,
    reconciliationRequired: r.reconciliationRequired, receiptFailure: r.receiptFailure,
    events: r.events, final_event_hash: r.events.at(-1)?.hash ?? null,
    evidence_boundary: 'In-memory controller record; provider evidence supplied by caller; no external execution performed here' };
}

export function getReceiptData(run) {
  return invoke(run, r => response(r, { data: detached(receiptData(r)) }));
}

export function getRunSnapshot(run) {
  return invoke(run, r => response(r, { data: detached({ ...receiptData(r),
    boundInputs: r.boundInputs, payload: r.input?.payload ?? null }) }));
}

export function seal(run, context = {}) {
  return invoke(run, r => {
    const internal = r.state === 'CHECKED' && r.input?.hasExternalAction === false && r.policy?.verdict === 'PASS';
    assert(terminal.includes(r.state) || internal, 'ILLEGAL_TRANSITION', `Cannot seal ${r.state}`);
    const { ts } = requireContext(context);
    event(r, 'RECEIPT_CREATED', 'RECEIPTED', 'In-memory receipt data produced',
      { external_action: r.input?.hasExternalAction ?? false, internal_only: internal }, ts);
    event(r, 'LOG_SEALED', 'REPLAYABLE', 'In-memory event chain closed; no file or signature generated', {}, ts);
    return response(r, { data: detached(receiptData(r)) });
  });
}
