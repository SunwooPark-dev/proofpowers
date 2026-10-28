import { randomUUID } from 'node:crypto';
import { hashPayload } from '../policy/engine.mjs';

const replies = Object.freeze({
  'wonder.plan': JSON.stringify({ goal: 'Prepare demo outreach', steps: ['Draft outreach within fixed bounds', 'Review claims before operator approval'] }),
  'spark.draft': 'A useful service.',
  'wonder.review': JSON.stringify({ signal: 'clear', reason: 'Synthetic mock review; not a real model judgment' }),
});
const liveModels = new Set(['muse-spark-1.3', 'muse-spark-1.2', 'muse-spark-1.1']);
const runIds = new Set();
const frozen = x => { if (x && typeof x === 'object') { Object.values(x).forEach(frozen); Object.freeze(x); } return x; };
const fail = code => { const e = new Error(code); e.code = code; throw e; };
const usage = (raw, source) => ({
  input_tokens: Number.isSafeInteger(raw?.input_tokens) && raw.input_tokens >= 0 ? raw.input_tokens : null,
  output_tokens: Number.isSafeInteger(raw?.output_tokens) && raw.output_tokens >= 0 ? raw.output_tokens : null,
  total_tokens: Number.isSafeInteger(raw?.total_tokens) && raw.total_tokens >= 0 ? raw.total_tokens : null,
  source,
});
export function responseModelMatches(requested, returned) {
  return typeof requested === 'string' && requested.length > 0 && typeof returned === 'string'
    && (returned === requested || returned.startsWith(`${requested}-`));
}
const diagnosticId = (value,key) => typeof value==='string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value)
  && !value.includes(key) && !/^(LLM_|sk-)/i.test(value) ? value : null;

// One instance per controller run. No retry, no prompt/response/key stored in the ledger.
export function createMetaRun({ runId = randomUUID(), mode, env = process.env } = {}) {
  const calls = []; let used = 0;
  const selectedMode = mode ?? env.PP_MODEL_MODE ?? 'mock';
  if (typeof runId !== 'string' || !runId) fail('INVALID_RUN_ID');
  if (runIds.has(runId)) fail('DUPLICATE_MODEL_RUN');
  runIds.add(runId);
  async function callMeta({ role, messages } = {}) {
    const started = performance.now();
    const record = { run_id: runId, role: Object.hasOwn(replies, role) ? role : 'invalid',
      mode: ['mock', 'live'].includes(selectedMode) ? selectedMode : 'invalid', model: selectedMode === 'mock' ? 'mock-meta-fixture' : null,
      request_hash: null, response_hash: null, latency_ms: 0, usage: usage(null, selectedMode === 'mock' ? 'not_measured_mock' : 'not_observed'),
      status: 'refused', request_attempted: false };
    try {
      if (!['mock', 'live'].includes(selectedMode)) fail('INVALID_MODEL_MODE');
      if (!Object.hasOwn(replies, role) || !Array.isArray(messages) || messages.length === 0
        || messages.length > 16 || messages.some(m => !m || !['system', 'user', 'assistant'].includes(m.role)
          || typeof m.content !== 'string' || m.content.length > 32000)) fail('INVALID_MODEL_REQUEST');
      const input = messages.map(m => ({ role: m.role, content: m.content }));
      if (used >= 20) fail('MODEL_CALL_LIMIT');
      used++;
      let text, reportedUsage;
      if (selectedMode === 'mock') {
        record.request_hash = hashPayload({ role, model: record.model, input });
        text = replies[role]; reportedUsage = usage(null, 'not_measured_mock');
        record.response_hash = hashPayload({ text, model: record.model, usage: reportedUsage });
      } else {
        record.model = null; record.usage = usage(null, 'not_observed');
        // Check owner-declared spend gate before even reading the key.
        if (env.PP_SPEND_LIMIT_CONFIRMED !== '1') fail('SPEND_LIMIT_NOT_CONFIRMED');
        const base = new URL(env.META_API_BASE ?? '');
        if (base.origin !== 'https://api.meta.ai' || !['/v1', '/v1/'].includes(base.pathname)
          || base.username || base.password || base.search || base.hash) fail('INVALID_META_API_BASE');
        if (!liveModels.has(env.META_MODEL)) fail('INVALID_META_MODEL');
        const key = env.META_API_KEY;
        if (typeof key !== 'string' || !key.trim()) fail('META_API_KEY_REQUIRED');
        record.model = env.META_MODEL;
        const body = { model: record.model, input, max_output_tokens: 2048, store: false, stream: false };
        record.request_hash = hashPayload({ role, body });
        record.request_attempted = true;
        const response = await fetch(`${base.origin}/v1/responses`, { method: 'POST', redirect: 'error',
          signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body) });
        record.http_status = response.status;
        if (!response.ok) fail('META_HTTP_ERROR');
        const data = await response.json();
        // Whitelisted metadata is retained even when the strict completion/model check fails.
        record.response = {status:diagnosticId(data?.status,key),model:diagnosticId(data?.model,key)};
        record.incomplete_details = {reason:diagnosticId(data?.incomplete_details?.reason,key)};
        reportedUsage = usage(data?.usage, 'provider_reported');
        record.usage = reportedUsage;
        record.response_hash = hashPayload(data);
        if (data?.status !== 'completed' || !responseModelMatches(record.model,data?.model)) fail('META_RESPONSE_NOT_COMPLETE');
        text = (data.output ?? []).filter(x => x.type === 'message' && x.role === 'assistant')
          .flatMap(x => x.content ?? []).filter(x => x.type === 'output_text' && typeof x.text === 'string')
          .map(x => x.text).join('\n');
        if (!text || text.includes(key)) fail('META_RESPONSE_REJECTED');
      }
      record.status = 'success'; record.usage = reportedUsage;
      record.latency_ms = Number((performance.now() - started).toFixed(3));
      calls.push(frozen(record));
      return frozen({ text, model: record.model, mode: record.mode, role,
        request_hash: record.request_hash, response_hash: record.response_hash,
        latency_ms: record.latency_ms, usage: record.usage });
    } catch (error) {
      record.latency_ms = Number((performance.now() - started).toFixed(3));
      const allowed = new Set(['INVALID_MODEL_MODE','INVALID_MODEL_REQUEST','MODEL_CALL_LIMIT',
        'SPEND_LIMIT_NOT_CONFIRMED','INVALID_META_API_BASE','INVALID_META_MODEL','META_API_KEY_REQUIRED',
        'META_HTTP_ERROR','META_RESPONSE_NOT_COMPLETE','META_RESPONSE_REJECTED']);
      const code = allowed.has(error.code) ? error.code : 'META_CALL_FAILED';
      record.error_code = code; calls.push(frozen(record));
      fail(code);
    }
  }
  return Object.freeze({ callMeta, getCalls: () => frozen(calls.map(c => structuredClone(c))),
    getQuotaUsed: () => used });
}

const singleRun = createMetaRun({ runId: 'standalone-process-run' });
export const callMeta = request => singleRun.callMeta(request);
