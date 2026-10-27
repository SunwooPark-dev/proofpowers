import { createHash } from 'node:crypto';

const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = (x) => typeof x === 'string' && x.trim().length > 0;
const digest = (x) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const money = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const strings = (x) => Array.isArray(x) && x.every(text);
const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

// RFC 8785 subset: plain JSON data only; reject values JSON.stringify would lose.
// Preserve Unicode and line endings: normalization would hide byte changes.
export function canonicalize(value) {
  const ancestors = new Set();
  function visit(x) {
    if (x === null || typeof x === 'boolean') return JSON.stringify(x);
    if (typeof x === 'string') {
      if (loneSurrogate.test(x)) throw new TypeError('Unpaired Unicode surrogate');
      return JSON.stringify(x);
    }
    if (typeof x === 'number' && Number.isFinite(x)) return JSON.stringify(x);
    if (typeof x !== 'object' || x === null || ancestors.has(x)) {
      throw new TypeError('Expected finite, acyclic JSON data');
    }
    const proto = Object.getPrototypeOf(x);
    if (!Array.isArray(x) && proto !== Object.prototype && proto !== null) {
      throw new TypeError('Expected plain JSON object');
    }
    if (Object.getOwnPropertySymbols(x).length) throw new TypeError('Symbol keys');
    const keys = Object.keys(x);
    if (Object.getOwnPropertyNames(x).length !== keys.length + (Array.isArray(x) ? 1 : 0)) {
      throw new TypeError('Non-enumerable property');
    }
    for (const key of keys) {
      if (!Object.hasOwn(Object.getOwnPropertyDescriptor(x, key), 'value')) {
        throw new TypeError('Accessors are not JSON data');
      }
    }
    ancestors.add(x);
    let result;
    if (Array.isArray(x)) {
      if (keys.length !== x.length || keys.some((k, i) => k !== String(i))) {
        throw new TypeError('Sparse array or extra array property');
      }
      result = `[${x.map(visit).join(',')}]`;
    } else {
      result = `{${keys.sort().map((k) => `${visit(k)}:${visit(x[k])}`).join(',')}}`;
    }
    ancestors.delete(x);
    return result;
  }
  return visit(value);
}

export function hashPayload(payload) {
  return createHash('sha256').update(canonicalize(payload), 'utf8').digest('hex');
}

const check = (rule, ok, reason) => ({ rule, ok, reason });

// Numeric tokens are conservative candidates, not a semantic claim detector.
export function extractNumericClaims(payload) {
  const body = [payload.subject ?? '', payload.body ?? ''].join('\n');
  const pattern = /(?<currency>[$€£₩])?\s*(?<value>[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?:\s*(?<unit>%|[A-Za-z가-힣]+))?/gu;
  return [...body.matchAll(pattern)].map(({ groups: g }) => ({
    value: Number(g.value.replaceAll(',', '')),
    unit: `${g.currency ?? ''}${g.unit ?? ''}`,
  }));
}

export function checkEvidence(input) {
  const claims = extractNumericClaims(input.payload);
  const declared = input.payload.claims ?? [];
  if (!Array.isArray(declared)) return check('R-01', false, 'claims must be an array');
  const used = new Set();
  for (const claim of claims) {
    const index = declared.findIndex((c, i) => !used.has(i) && object(c)
      && c.value === claim.value && c.unit === claim.unit && text(c.sourceId));
    if (index < 0) return check('R-01', false, 'Numeric token lacks a bound source/value/unit');
    used.add(index);
    const c = declared[index];
    const records = (input.evidence ?? []).filter((r) => r.sourceId === c.sourceId);
    if (!records.some((r) => r.status === 'verified' && r.value === c.value
      && r.unit === c.unit && text(r.trustLevel) && text(r.verifiedAt)
      && Number.isFinite(Date.parse(r.verifiedAt)) && digest(r.quoteHash))) {
      return check('R-01', false, 'No verified registry match for value/unit/source');
    }
  }
  if (used.size !== declared.length) return check('R-01', false, 'Unmatched declared claim');
  return check('R-01', true, claims.length ? 'All numeric claims matched' : 'No numeric claims');
}

export function checkBounds({ boundInputs: b, payload: p }) {
  if (!b.allowedActions.includes(p.action_type)) return check('R-02', false, 'Action outside bounds');
  if (p.action_type === 'outreach_send' && !b.allowedRecipients.includes(p.recipient)) {
    return check('R-02', false, 'Recipient outside bounds');
  }
  for (const [field, allowed] of [['target', 'allowedTargets'], ['scope', 'allowedScopes']]) {
    if (p[field] !== undefined && (!strings(b[allowed]) || !b[allowed].includes(p[field]))) {
      return check('R-02', false, `${field} outside bounds`);
    }
  }
  return check('R-02', true, 'Action, recipient and supplied scope within bounds');
}

export function checkCost(input) {
  const { costAccumulated: spent, costEstimate: next, boundInputs: b } = input;
  if (!money(spent) || !money(next) || !money(b.costCap)) {
    return check('R-05', false, 'Missing or invalid nonnegative cost data');
  }
  if (input.costCap !== undefined && input.costCap !== b.costCap) {
    return check('R-05', false, 'Supplied costCap differs from fixed bound');
  }
  return check('R-05', spent <= b.costCap && next <= b.costCap - spent,
    'Accumulated cost plus incremental estimate must not exceed fixed cap');
}

export function checkApproval(input, context) {
  const a = input.approval;
  const ok = object(a) && a.decision === 'approved' && text(a.approver)
    && text(a.at) && Number.isFinite(Date.parse(a.at)) && digest(a.payload_hash)
    && text(a.session_id) && text(a.approval_token) && text(a.expires_at)
    && Number.isFinite(Date.parse(a.expires_at)) && Number.isFinite(context.nowMs)
    && Date.parse(a.at) <= context.nowMs && Date.parse(a.expires_at) > context.nowMs
    && a.session_id === context.sessionId && context.tokenUnused === true;
  return check('R-03', Boolean(ok), 'Approval record, session, expiry and unused-token observation required');
}

export function checkHash(input) {
  const actual = hashPayload(input.payload);
  const approved = input.approval?.payload_hash;
  const ok = digest(approved) && actual === approved
    && (input.payloadHash === undefined || input.payloadHash === actual)
    && (input.approvalHash === undefined || input.approvalHash === approved);
  return { ...check('R-04', ok, ok ? 'Recomputed payload hash matches approval' : 'Payload hash mismatch'),
    actualHash: actual, approvedHash: approved ?? null };
}

export function checkIsolation(input) {
  const i = input.injectedInstruction;
  const attempted = i?.attempted === true;
  const ignored = i?.present === true && i.attempted === false && text(i.ignoredLog);
  return { ...check('R-07', !attempted, attempted
    ? 'Caller recorded a source-derived action/recipient change attempt'
    : ignored ? 'Source instruction ignored; no attempt recorded' : 'No source-derived attempt recorded'),
  attempted, ignored };
}

function validate(input) {
  canonicalize(input);
  if (!object(input) || !object(input.payload) || !object(input.boundInputs)) {
    throw new TypeError('payload and fixed boundInputs are required');
  }
  const { payload: p, boundInputs: b } = input;
  if (!['outreach_send', 'draft', 'read'].includes(p.action_type)) {
    throw new TypeError('Unknown action_type; classification required');
  }
  const external = p.action_type === 'outreach_send';
  if (typeof input.hasExternalAction !== 'boolean' || input.hasExternalAction !== external) {
    throw new TypeError('hasExternalAction conflicts with payload action_type');
  }
  if (!strings(b.allowedActions) || !strings(b.allowedRecipients)) {
    throw new TypeError('Fixed action/recipient allowlists are required');
  }
  if (input.evidence !== undefined && (!Array.isArray(input.evidence) || !input.evidence.every(object))) {
    throw new TypeError('evidence must be an array of registry records');
  }
  for (const key of ['subject', 'body']) {
    if (p[key] !== undefined && typeof p[key] !== 'string') throw new TypeError(`Invalid ${key}`);
  }
  if (external && (!text(p.run_id) || !text(p.recipient) || typeof p.subject !== 'string'
    || typeof p.body !== 'string' || !Array.isArray(p.attachments)
    || !p.attachments.every(digest) || !digest(p.bound_inputs_hash))) {
    throw new TypeError('Incomplete outreach payload');
  }
  if (external && p.bound_inputs_hash !== hashPayload(b)) {
    return check('R-02', false, 'Payload does not bind the supplied Bound Inputs');
  }
  const i = input.injectedInstruction;
  if (i !== undefined && (!object(i) || typeof i.present !== 'boolean'
    || typeof i.attempted !== 'boolean' || (i.attempted && !i.present)
    || (i.ignoredLog !== undefined && !text(i.ignoredLog))
    || (text(i.ignoredLog) && (!i.present || i.attempted)))) {
    throw new TypeError('Invalid source-instruction observation');
  }
  return null;
}

function evaluateAt(input, phase, context) {
  const result = (verdict, primaryRule, reason, checks = [], extra = {}) => ({
    verdict, primaryRule, auxiliaryRules: [], reason, phase, checks,
    // These observations are caller supplied, not an injection detector or execution proof.
    injectionAttempted: input?.injectedInstruction?.attempted === true,
    injectionIgnored: false, ...extra,
  });
  try {
    const invalidBound = validate(input);
    const isolation = checkIsolation(input);
    const checks = [isolation, checkEvidence(input), invalidBound ?? checkBounds(input), checkCost(input)];
    const external = input.hasExternalAction;
    if (phase === 'execution' && external) {
      checks.push(checkApproval(input, context), checkHash(input));
    }
    const failure = checks.find((c) => !c.ok);
    const extra = { injectionIgnored: isolation.ignored };
    if (failure) return result('BLOCK', failure.rule, failure.reason, checks, extra);
    const semantic = context.semanticSignal;
    if (semantic !== undefined && !['clear', 'suspect', 'uncertain'].includes(semantic)) {
      return result('HELD', null, 'Invalid semantic observation', checks, extra);
    }
    if (semantic === 'suspect' || semantic === 'uncertain') {
      return { ...result('HELD', 'R-08', 'Semantic review requires operator decision', checks, extra),
        auxiliaryRules: ['R-08'] };
    }
    const applicable = new Set(checks.map((c) => c.rule));
    if (!external) applicable.add('R-06');
    const primary = context.primaryUnderTest ?? (isolation.ignored ? 'R-07' : external
      ? phase === 'execution' ? 'R-04' : 'R-02' : 'R-06');
    if (!applicable.has(primary)) return result('HELD', null, 'primaryUnderTest not checked in this phase', checks, extra);
    return result('PASS', primary, 'All applicable deterministic predicates passed', checks, extra);
  } catch (error) {
    return result('HELD', null, `Invalid policy input: ${error.message}`);
  }
}

// Context is supplied by the controller, never by the model or case expectations.
// Execution predicates do not consume tokens, mutate state or enter an Executor.
export function evaluatePreflight(input, context = {}) {
  return evaluateAt(input, 'preflight', context);
}

export function evaluateExecutionPredicates(input, context = {}) {
  return evaluateAt(input, 'execution', context);
}

export function evaluate(input, { phase = 'preflight', ...context } = {}) {
  if (phase === 'preflight') return evaluatePreflight(input, context);
  if (phase === 'execution') return evaluateExecutionPredicates(input, context);
  return { verdict: 'HELD', primaryRule: null, auxiliaryRules: [], reason: 'Unknown evaluation phase',
    phase, checks: [], injectionAttempted: false, injectionIgnored: false };
}
