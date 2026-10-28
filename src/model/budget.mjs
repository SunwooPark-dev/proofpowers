import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { MODEL_RATES,estimateUsd } from './costs.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
// A shared sequential-run reservation ledger. Not a provider billing limit.
export function createRunBudget({path,limitUsd=0.10,onSettled}={}) {
  if(onSettled!==undefined&&typeof onSettled!=='function')fail('INVALID_RUN_BUDGET');
  const limit=Math.round(limitUsd*1e9);
  if(!Number.isSafeInteger(limit)||limit<=0)fail('INVALID_RUN_BUDGET');
  let state={limit_nanos:limit,halted:false,requests:[],events:[]};
  if(path&&existsSync(path))state=JSON.parse(readFileSync(path,'utf8'));
  state.events??=[];
  function total(){return state.requests.reduce((n,r)=>n+r.charged_nanos,0);}
  function validate(){
    if(state.limit_nanos!==limit||!Array.isArray(state.requests)||state.requests.some(r=>!Number.isSafeInteger(r.charged_nanos)||r.charged_nanos<0))fail('INVALID_RUN_BUDGET');
  }
  validate();
  const save=()=>{if(path)writeFileSync(path,JSON.stringify(state,null,2)+'\n','utf8');};
  return Object.freeze({
    reserve({model,messages,maxOutputTokens,role=null}) {
      validate();if(state.halted)fail('RUN_BUDGET_EXCEEDED');
      const rate=Object.hasOwn(MODEL_RATES,model)?MODEL_RATES[model]:null;if(!rate||!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1)fail('INVALID_RUN_BUDGET');
      const inputUpper=Buffer.byteLength(JSON.stringify(messages),'utf8')+4096;
      const reserved=Math.ceil((inputUpper*rate.input+maxOutputTokens*rate.output)*1000);
      if(!Number.isSafeInteger(reserved)||total()+reserved>limit)fail('RUN_BUDGET_RESERVATION_DENIED');
      const id=randomUUID();state.requests.push({id,role,model,input_token_upper:inputUpper,max_output_tokens:maxOutputTokens,reserved_nanos:reserved,charged_nanos:reserved,usage:null,status:'reserved_unknown'});save();return id;
    },
    releaseUnsettled(){
      for(const r of state.requests.filter(r=>r.status==='reserved_unknown')){
        r.charged_nanos=0;r.status='kill_released';
        const entry={event:'BUDGET_SETTLED',ticket_id:r.id,role:r.role,reserved:r.reserved_nanos/1e9,settled:0,reason:'KILL_RESERVATION_RELEASED'};
        state.events.push(entry);save();
        try{onSettled?.(structuredClone(entry));}catch{state.halted=true;save();fail('RUN_BUDGET_AUDIT_FAILED');}
      }
    },
    settle(id,usage,{httpStatus=null,usageAbsent=false}={}) {
      const r=state.requests.find(r=>r.id===id);if(!r||r.status!=='reserved_unknown')fail('INVALID_RUN_BUDGET');
      const amount=estimateUsd(r.model,usage);
      let reason='USAGE_UNKNOWN_RESERVATION_RETAINED';
      if(amount!==null){r.charged_nanos=Math.ceil(amount*1e9);r.usage={input_tokens:usage.input_tokens,output_tokens:usage.output_tokens};r.status='provider_usage_estimate';reason='PROVIDER_USAGE_ESTIMATE';}
      else if(Number.isInteger(httpStatus)&&httpStatus>=400&&httpStatus<500&&usageAbsent===true){
        // Owner's local budget policy, not proof of provider billing or zero tokens.
        r.charged_nanos=0;r.status='owner_policy_4xx_released';reason='HTTP_4XX_NO_USAGE_OWNER_POLICY';
      }
      const entry={event:'BUDGET_SETTLED',ticket_id:id,role:r.role,reserved:r.reserved_nanos/1e9,settled:r.charged_nanos/1e9,reason};
      state.events.push(entry);
      if(total()>limit)state.halted=true;save();
      try{onSettled?.(structuredClone(entry));}catch{state.halted=true;save();fail('RUN_BUDGET_AUDIT_FAILED');}
      if(state.halted)fail('RUN_BUDGET_EXCEEDED');
    },
    snapshot:()=>JSON.parse(JSON.stringify({...state,accounted_usd:total()/1e9,remaining_usd:(limit-total())/1e9})),
  });
}
