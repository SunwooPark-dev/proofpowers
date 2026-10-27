import { canonicalize, hashPayload, evaluateExecutionPredicates } from '../policy/engine.mjs';
import { getRunSnapshot } from '../run/controller.mjs';
import { validateEnvelope } from './envelope.mjs';

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const digest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const cost = x => Number.isFinite(x) && x >= 0;
const copy = x => JSON.parse(canonicalize(x));
function frozen(x) {
  if (x && typeof x === 'object') { Object.values(x).forEach(frozen); Object.freeze(x); }
  return x;
}

// Each consume is synchronous compare-and-set; share one ledger across executors.
export function createMemoryTokenLedger() {
  const used = new Set();
  return Object.freeze({
    has(key) { return used.has(key); },
    consume(key) {
      if (used.has(key)) return false;
      used.add(key); return true;
    },
  });
}
const defaultLedger = createMemoryTokenLedger();

export function createExecutor({ transport, credentialProvider, tokenLedger = defaultLedger, policyVersion } = {}) {
  if (typeof credentialProvider !== 'function' || !text(policyVersion)
    || !tokenLedger || typeof tokenLedger.has !== 'function' || typeof tokenLedger.consume !== 'function') {
    throw new TypeError('Demo credentialProvider, current policyVersion and synchronous token ledger required');
  }
  // A local reservation also stops callback reentrancy during ledger operations.
  const reserved = new Set();
  return Object.freeze({
    async execute(envelope, context = {}) {
      let approvedHash = null, actualHash = null, approvedEnvelopeHash = null, actualEnvelopeHash = null;
      const refused = (reason, rule) => frozen({ ok: false, outcome: 'REFUSED',
        error: { code: 'EXECUTION_REFUSED', reason, rule },
        evidence: { approvedHash, actualHash, approvedEnvelopeHash, actualEnvelopeHash, credentialProviderAccessed: false,
          transportAccessed: false, dispatchAttempted: false } });
      let e, keys, sensitiveToken, run, expiryMs, entryNowMs, entryTick;
      try {
        if (!object(context)) return refused('Trusted execution context required', 'R-03');
        const snapshot = getRunSnapshot(context.run);
        if (!snapshot.ok || snapshot.state !== 'DISPATCHING') {
          return refused('Controller must have entered DISPATCHING', 'R-03');
        }
        const s = snapshot.data;
        const a = copy(context.approval);
        approvedHash = digest(s.approval?.payload_hash) ? s.approval.payload_hash : null;
        const p = copy(context.payload ?? s.payload);
        actualHash = hashPayload(p);
        if (!object(a)) return refused('Original approval record required', 'R-03');
        const { approval_token, ...summary } = a;
        sensitiveToken = approval_token;
        approvedEnvelopeHash = digest(a.envelope_hash) ? a.envelope_hash : null;
        actualEnvelopeHash = hashPayload(envelope);
        if (canonicalize(summary) !== canonicalize(s.approval) || !text(approval_token)
          || !digest(a.token_hash) || a.token_hash !== hashPayload(approval_token)) {
          return refused('Approval record or token differs from controller confirmation', 'R-03');
        }
        const validation = validateEnvelope(envelope, { approvedPayload: s.payload, approval: a, policyVersion });
        if (!validation.ok) return refused(validation.reason, validation.rule);
        e = validation.envelope;
        if (!object(p) || p.run_id !== s.run_id || actualHash !== approvedHash
          || actualHash !== s.execution_hash || hashPayload(s.boundInputs) !== p.bound_inputs_hash) {
          return refused('Execution payload or fixed bounds do not match controller dispatch', 'R-04');
        }
        if (!cost(context.costAccumulated) || !cost(context.costEstimate)
          || context.costAccumulated < s.costAccumulated) {
          return refused('Fresh, nondecreasing cost observations required', 'R-05');
        }
        const nowMs = context.nowMs ?? Date.now();
        if (!Number.isFinite(nowMs)) return refused('Valid execution timestamp required', 'R-03');
        run = context.run; expiryMs = Date.parse(a.expires_at);
        entryNowMs = nowMs; entryTick = performance.now();
        // The controller owns draft checks. Executor rechecks its own mandatory entry predicates.
        const input = { boundInputs: s.boundInputs, payload: p, approval: a,
          hasExternalAction: true, costAccumulated: context.costAccumulated,
          costEstimate: context.costEstimate, ...(context.costCap === undefined ? {} : {costCap:context.costCap}) };
        const policy = evaluateExecutionPredicates(input, { nowMs,
          sessionId: context.sessionId ?? s.session_id, tokenUnused: true });
        // R01 would need the private registry again. Inspect the required R02/03/04/05 checks,
        // never use a supplied "passed" flag or treat an absent predicate as successful.
        for (const rule of ['R-03', 'R-04', 'R-02', 'R-05']) {
          const check = policy.checks?.find(c => c.rule === rule);
          if (!check || check.ok !== true) return refused('Executor entry predicate failed or was unavailable', rule);
        }
        keys = [a.token_hash,
          hashPayload({ kind: 'approval_id', value: a.approval_id }),
          hashPayload({ kind: 'run_id', value: s.run_id })];
        for (const key of keys) {
          const seen = tokenLedger.has(key);
          if (typeof seen !== 'boolean' || seen || reserved.has(key)) {
            return refused('Token, approval or run already used; no retry', 'R-03');
          }
        }
        // No await between checks and consumption. Never roll back even a partial claim.
        keys.forEach(key => reserved.add(key));
        for (const key of keys) {
          if (tokenLedger.consume(key) !== true) return refused('Atomic ledger consumption failed; no delivery', 'R-03');
        }
      } catch {
        return refused('Invalid execution input or unavailable synchronous ledger', 'R-03');
      }

      let attempted = false;
      const unknown = reason => frozen({ ok: true, outcome: 'OUTCOME_UNKNOWN',
        evidence: { reason, demo: true, transportAttempted: attempted, tokenConsumed: true } });
      try {
        // Only this closure can invoke the provider; no credential is passed into deliver.
        const inbox = await credentialProvider();
        // Provider lookup can yield. Do not deliver after the run ended or approval expired.
        const current = getRunSnapshot(run);
        if (!current.ok || current.state !== 'DISPATCHING'
          || entryNowMs + (performance.now() - entryTick) >= expiryMs) {
          return unknown('Controller state or approval changed while acquiring demo transport; no delivery attempted');
        }
        if (!object(inbox) || (transport !== undefined && inbox !== transport)) {
          return unknown('Demo transport unavailable after token consumption; no automatic retry');
        }
        const deliver = inbox.deliver;
        if (typeof deliver !== 'function') return unknown('Demo transport unavailable after token consumption; no automatic retry');
        attempted = true;
        const raw = await deliver.call(inbox, e);
        // Raw adapter errors/objects never enter receipts; expose a small demo-only response.
        const value = copy(raw);
        const reference = value?.reference;
        if (!object(value) || !text(reference) || !/^demo:[A-Za-z0-9._:-]{1,160}$/.test(reference)
          || reference.includes(sensitiveToken)) {
          return unknown('Demo transport returned no usable demo receipt; reconcile manually');
        }
        if (value.status === 'delivered' && value.accepted === true && value.confirmed === true
          && value.sent !== false && value.rejected !== true) {
          return frozen({ ok: true, outcome: 'EXECUTED', evidence: {
            accepted: true, confirmed: true, reference,
            providerResponse: { source: 'injected-demo-inbox', status: 'delivered', reference } } });
        }
        if (value.status === 'rejected' && value.sent === false && value.rejected === true
          && value.accepted !== true && value.confirmed !== true) {
          return frozen({ ok: true, outcome: 'FAILED_NOT_SENT', evidence: {
            rejected: true, sent: false, reason: 'Demo inbox explicitly rejected delivery', reference,
            providerResponse: { source: 'injected-demo-inbox', status: 'rejected', reference } } });
        }
        return unknown('Demo delivery was not conclusively confirmed or rejected; reconcile manually');
      } catch {
        return unknown('Demo transport operation failed after token consumption; reconcile manually');
      }
    },
  });
}
