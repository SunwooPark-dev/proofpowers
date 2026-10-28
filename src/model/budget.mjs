import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { MODEL_RATES,estimateUsd } from './costs.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
// A shared sequential-run reservation ledger. Not a provider billing limit.
export function createRunBudget({path,limitUsd=0.10}={}) {
  const limit=Math.round(limitUsd*1e9);
  if(!Number.isSafeInteger(limit)||limit<=0)fail('INVALID_RUN_BUDGET');
  let state={limit_nanos:limit,halted:false,requests:[]};
  if(path&&existsSync(path))state=JSON.parse(readFileSync(path,'utf8'));
  function total(){return state.requests.reduce((n,r)=>n+r.charged_nanos,0);}
  function validate(){
    if(state.limit_nanos!==limit||!Array.isArray(state.requests)||state.requests.some(r=>!Number.isSafeInteger(r.charged_nanos)||r.charged_nanos<0))fail('INVALID_RUN_BUDGET');
  }
  validate();
  const save=()=>{if(path)writeFileSync(path,JSON.stringify(state,null,2)+'\n','utf8');};
  return Object.freeze({
    reserve({model,messages,maxOutputTokens}) {
      validate();if(state.halted)fail('RUN_BUDGET_EXCEEDED');
      const rate=Object.hasOwn(MODEL_RATES,model)?MODEL_RATES[model]:null;if(!rate||!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1)fail('INVALID_RUN_BUDGET');
      const inputUpper=Buffer.byteLength(JSON.stringify(messages),'utf8')+4096;
      const reserved=Math.ceil((inputUpper*rate.input+maxOutputTokens*rate.output)*1000);
      if(!Number.isSafeInteger(reserved)||total()+reserved>limit)fail('RUN_BUDGET_RESERVATION_DENIED');
      const id=randomUUID();state.requests.push({id,model,input_token_upper:inputUpper,max_output_tokens:maxOutputTokens,reserved_nanos:reserved,charged_nanos:reserved,usage:null,status:'reserved_unknown'});save();return id;
    },
    settle(id,usage) {
      const r=state.requests.find(r=>r.id===id);if(!r||r.status!=='reserved_unknown')fail('INVALID_RUN_BUDGET');
      const amount=estimateUsd(r.model,usage);
      if(amount!==null){r.charged_nanos=Math.ceil(amount*1e9);r.usage={input_tokens:usage.input_tokens,output_tokens:usage.output_tokens};r.status='provider_usage_estimate';}
      if(total()>limit)state.halted=true;save();if(state.halted)fail('RUN_BUDGET_EXCEEDED');
    },
    snapshot:()=>JSON.parse(JSON.stringify({...state,accounted_usd:total()/1e9,remaining_usd:(limit-total())/1e9})),
  });
}
