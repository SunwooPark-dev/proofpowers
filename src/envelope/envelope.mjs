import { canonicalize, hashPayload } from '../policy/engine.mjs';

const fields = ['action_type', 'sender', 'recipient', 'subject', 'body',
  'attachment_hashes', 'policy_version', 'approval_id'];
const text = x => typeof x === 'string' && x.trim().length > 0;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const digest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);

// Same strings and array order as approval; no trimming or Unicode normalization.
export function validateEnvelope(envelope, options = {}) {
  const refused = (reason, rule) => ({ ok: false, reason, rule });
  try {
    if (!object(options)) return refused('Approval context required', 'R-03');
    const { approvedPayload, approval, policyVersion } = options;
    const e = JSON.parse(canonicalize(envelope));
    if (!object(e) || Object.keys(e).length !== fields.length
      || !fields.every(k => Object.hasOwn(e, k))) {
      return refused('Envelope must contain exactly the eight approved fields', 'R-04');
    }
    if (e.action_type !== 'outreach_send') return refused('Unknown or unsupported action', 'R-02');
    if (!text(e.sender) || !text(e.recipient) || typeof e.subject !== 'string'
      || typeof e.body !== 'string' || !text(e.policy_version) || !text(e.approval_id)
      || !Array.isArray(e.attachment_hashes) || !e.attachment_hashes.every(digest)) {
      return refused('Invalid Envelope field type', 'R-04');
    }
    if (!object(approvedPayload) || !object(approval)) return refused('Approved payload and record required', 'R-03');
    if (e.approval_id !== approval.approval_id || !text(approval.approval_id)) {
      return refused('Envelope approval_id does not identify the approved record', 'R-03');
    }
    if (!text(policyVersion) || e.policy_version !== policyVersion
      || approval.policy_version !== policyVersion || e.sender !== approval.sender) {
      return refused('Sender or policy version outside the approved configuration', 'R-02');
    }
    if (approvedPayload.action_type !== e.action_type
      || approvedPayload.recipient !== e.recipient || approvedPayload.subject !== e.subject
      || approvedPayload.body !== e.body
      || canonicalize(approvedPayload.attachments) !== canonicalize(e.attachment_hashes)) {
      return refused('Envelope content differs from the approved payload', 'R-04');
    }
    if (!digest(approval.payload_hash) || hashPayload(approvedPayload) !== approval.payload_hash
      || !digest(approval.envelope_hash) || hashPayload(e) !== approval.envelope_hash) {
      return refused('Payload or Envelope approval hash mismatch', 'R-04');
    }
    Object.freeze(e.attachment_hashes);
    return { ok: true, envelope: Object.freeze(e) };
  } catch {
    return refused('Envelope must be plain, finite JSON data', 'R-04');
  }
}
