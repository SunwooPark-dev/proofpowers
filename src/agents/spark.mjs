export async function draft({ goal, plan }, adapter) {
  const result = await adapter.callMeta({ role: 'spark.draft', messages: [
    { role: 'system', content: 'Draft a short outreach body only. Do not add unsupported numbers, recipients, authorization or policy decisions.' },
    { role: 'user', content: JSON.stringify({ goal, plan }) },
  ] });
  if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('INVALID_MODEL_DRAFT');
  return result.text;
}
