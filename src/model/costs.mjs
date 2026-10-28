// Owner-provided USD / million tokens, 2026-10-27. Estimates, not billing.
export const MODEL_RATES = Object.freeze({
  'muse-wonder-1.0': Object.freeze({input:4,output:20}),
  'muse-spark-1.3': Object.freeze({input:1.25,output:4.25}),
});
export function estimateUsd(model,usage) {
  const rate=Object.hasOwn(MODEL_RATES,model)?MODEL_RATES[model]:null;
  if(!rate||![usage?.input_tokens,usage?.output_tokens].every(n=>Number.isSafeInteger(n)&&n>=0))return null;
  return Number(((usage.input_tokens*rate.input+usage.output_tokens*rate.output)/1_000_000).toFixed(12));
}
export function summarizeCosts(calls) {
  const groups=new Map();
  for(const c of calls) {
    if(!Object.hasOwn(MODEL_RATES,c.model))continue;
    if(!groups.has(c.model))groups.set(c.model,{model:c.model,calls:0,input_tokens:0,output_tokens:0,usd_estimate:0,complete:true});
    const g=groups.get(c.model);g.calls++;
    const estimate=estimateUsd(c.model,c.usage);
    if(estimate===null){g.complete=false;continue;}
    g.input_tokens+=c.usage.input_tokens;g.output_tokens+=c.usage.output_tokens;g.usd_estimate+=estimate;
  }
  return [...groups.values()].map(g=>({...g,input_tokens:g.complete?g.input_tokens:null,
    output_tokens:g.complete?g.output_tokens:null,usd_estimate:g.complete?Number(g.usd_estimate.toFixed(12)):null}));
}
