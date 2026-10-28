export async function draft({ goal, plan, customerNote }, adapter) {
  const result = await adapter.callMeta({ role: 'spark.draft', messages: [
    { role: 'system', content: 'Draft a short outreach body only. Do not add unsupported numbers, recipients, authorization or policy decisions.' },
    { role: 'user', content: JSON.stringify({ goal, plan, ...(customerNote===undefined?{}:{customerNote}) }) },
  ] });
  if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('INVALID_MODEL_DRAFT');
  return result.text;
}

export async function rewrite({ body, reason }, adapter) {
  const result=await adapter.callMeta({role:'spark.rewrite',messages:[
    {role:'system',content:'Rewrite the supplied demo draft conservatively. Do not add unsupported numbers, recipients or authorization.'},
    {role:'user',content:JSON.stringify({body,reason})},
  ]});
  if(typeof result.text!=='string'||!result.text.trim())throw Error('INVALID_MODEL_DRAFT');
  return result.text;
}
