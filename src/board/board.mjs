// Display only: this module never judges policy, approves, dispatches or advances a run.
// "verified" means supported by the supplied record, not independent external certification.
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const amount = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const diagnosticId=x=>typeof x==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(x)&&!/^(LLM_|sk-)/i.test(x)?x:null;
const states = new Set(['DRAFT','CHECKED','BLOCKED','HELD','APPROVED','DISPATCHING',
  'EXECUTED','FAILED_NOT_SENT','OUTCOME_UNKNOWN','REJECTED','REFUSED','FAILED','RECEIPTED','REPLAYABLE']);
const labels = { boundInputs:'Bound Inputs', predicates:'Measured Predicates',
  nonActions:'Non-actions', nextGate:'Next Gate (STOP)' };
const statuses = new Set(['verified','failed','held','not_certified']);
const unknown = 'NOT CERTIFIED';

// Collect labeled secrets before selecting display fields, including aliases in reasons.
function sanitized(input) {
  const secrets = new Set(), seen = new Set(), seenSensitive = new Set();
  const secretKey = (key,value) => {
    const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['inputtokens','outputtokens','totaltokens'].includes(k)
      && (value === null || (Number.isSafeInteger(value) && value >= 0))) return false;
    const hash=k.endsWith('hash')&&typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
    return !hash && /token|password|secret|credential|authorization|apikey/.test(k);
  };
  function scan(x, depth = 0, sensitive = false) {
    if (typeof x === 'string' && sensitive && x) secrets.add(x);
    const visited=sensitive?seenSensitive:seen;
    if (!x || typeof x !== 'object' || visited.has(x) || depth > 40) return;
    visited.add(x);
    for (const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(x))) {
      if (d.enumerable && Object.hasOwn(d,'value')) scan(d.value,depth+1,sensitive||secretKey(k,d.value));
    }
  }
  scan(input);
  function redact(s) {
    for (const secret of [...secrets].sort((a,b)=>b.length-a.length)) s=s.split(secret).join('[REDACTED]');
    return s;
  }
  const visiting = new Set();
  function clone(x,depth=0) {
    if (x === null || typeof x === 'boolean') return x;
    if (typeof x === 'string') return redact(x);
    if (typeof x === 'number') return Number.isFinite(x) ? x : unknown;
    if (!x || typeof x !== 'object' || depth>40 || visiting.has(x)) return unknown;
    visiting.add(x);
    const out=Array.isArray(x)?[]:{};
    for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(x))) {
      if (!d.enumerable) continue;
      if (secretKey(k,d.value)) continue;
      const key=redact(k);
      // Define a data property so even an input __proto__ cannot change prototypes.
      Object.defineProperty(out,key,{value:Object.hasOwn(d,'value')?clone(d.value,depth+1):unknown,
        enumerable:true,writable:true,configurable:true});
    }
    visiting.delete(x);return out;
  }
  return clone(input);
}
function safeInput(input) { try{return sanitized(input);}catch{return {};} }
function freeze(x) {
  if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;
}
const item=(label,status,value,evidence={})=>({label,status,value,evidence});
const panel=(label,items)=>({label,items});

// Structural completeness only; this is not the future cryptographic Replay verifier.
function historyOf(s) {
  const events=s?.events;
  if(!Array.isArray(events)||events.length===0||s.eventsComplete===false) return {complete:false,states:[]};
  let previous=null;const reached=[];
  for(let i=0;i<events.length;i++) {
    const e=events[i];
    if(!object(e)||e.seq!==i+1||e.run_id!==s.run_id||e.state_from!==previous||!states.has(e.state_to)
      ||(i===0&&(e.event!=='RUN_CREATED'||e.state_to!=='DRAFT'))) return {complete:false,states:reached};
    reached.push(e.state_to);previous=e.state_to;
  }
  return {complete:previous===s.state,states:reached};
}

export function buildReceipt(input={}) {
  const clean=safeInput(input);
  const args=object(clean)?clean:{};
  const raw=args.snapshot;
  const wrapped=object(raw)&&Object.hasOwn(raw,'data');
  const s=wrapped?(object(raw.data)?raw.data:{}):(object(raw)?raw:{});
  const issues=[];
  const state=states.has(s.state)?s.state:unknown;
  if(!text(s.run_id)||state===unknown) issues.push('Run ID or recognized state missing');
  if(wrapped&&(raw.ok!==true||raw.state!==s.state)) issues.push('Snapshot wrapper and data disagree');
  if(Object.keys(args).some(k=>/expected|예상|기대/i.test(k))) issues.push('Expected-value inputs are unsupported and unused');
  const b=object(s.boundInputs)?s.boundInputs:null;
  const boundItems=[];
  for(const key of ['allowedActions','allowedRecipients','allowedTargets','allowedScopes']) {
    const value=b?.[key], valid=Array.isArray(value)&&value.every(text);
    boundItems.push(item(key,valid?'verified':'not_certified',valid?value:unknown,{source:`snapshot.boundInputs.${key}`}));
  }
  boundItems.push(item('costCap',amount(b?.costCap)?'verified':'not_certified',amount(b?.costCap)?b.costCap:unknown,
    {source:'snapshot.boundInputs.costCap',unit:text(b?.currency)?b.currency:unknown}));
  const registry=Array.isArray(s.evidence)?s.evidence:Array.isArray(b?.evidenceRegistry)?b.evidenceRegistry:null;
  if(registry===null) boundItems.push(item('Evidence Registry','not_certified',unknown,{reason:'Registry absent from supplied snapshot'}));
  else {
    boundItems.push(item('Evidence Registry records','verified',registry.length,{source:'supplied registry array; registration count only'}));
    for(const r of registry) boundItems.push(item('Registry record',object(r)&&text(r.sourceId)&&r.status==='verified'?'verified':'not_certified',
      object(r)?{sourceId:r.sourceId??unknown,status:r.status??unknown,value:r.value??unknown,
        unit:r.unit??unknown,trustLevel:r.trustLevel??unknown,verifiedAt:r.verifiedAt??unknown}:unknown,
      {source:'supplied registry record; source truth not independently checked'}));
  }

  const predicates=[],rows=new Map(),policies=[];
  const modelCalls=[];
  if(Array.isArray(args.model_calls)) for(const c of args.model_calls) {
    if(!object(c)) {predicates.push(item('Model call','not_certified',unknown,{reason:'Invalid model-call record'}));continue;}
    const call={run_id:c.run_id??unknown,role:c.role??unknown,model:c.model??unknown,mode:c.mode??unknown,
      status:c.status??unknown,request_hash:c.request_hash??null,response_hash:c.response_hash??null,
      latency_ms:amount(c.latency_ms)?c.latency_ms:null,usd_estimate:amount(c.usd_estimate)?c.usd_estimate:null,
      usage:{input_tokens:c.usage?.input_tokens??null,output_tokens:c.usage?.output_tokens??null,
        total_tokens:c.usage?.total_tokens??null,source:c.usage?.source??unknown},
      request_attempted:c.request_attempted===true};
    if(c.error_code!==undefined)call.error_code=c.error_code;
    if(Number.isInteger(c.http_status)&&c.http_status>=100&&c.http_status<=599)call.http_status=c.http_status;
    if(object(c.response))call.response={status:diagnosticId(c.response.status),model:diagnosticId(c.response.model)};
    if(object(c.incomplete_details))call.incomplete_details={reason:diagnosticId(c.incomplete_details.reason)};
    modelCalls.push(call);
    const supported=c.status==='success'&&c.mode==='live'&&c.request_attempted===true
      &&['muse-wonder-1.0','muse-spark-1.3'].includes(c.model)
      &&[c.request_hash,c.response_hash].every(h=>typeof h==='string'&&/^[a-f0-9]{64}$/.test(h));
    predicates.push(item('Model call',c.status==='refused'?'failed':supported?'verified':'not_certified',call,
      {source:'model adapter metadata',reason:c.mode==='mock'?'Mock fixture; not real Meta use':'Provider call record; model does not decide policy'}));
  }
  if(object(args.checks)) policies.push({source:'checks argument',policy:args.checks});
  if(object(s.policy)) policies.push({source:'snapshot.policy',policy:s.policy});
  if(Array.isArray(s.events)) for(const e of s.events) {
    if(object(e?.detail?.policy)) policies.push({source:`event ${e.seq}`,policy:e.detail.policy});
  }
  if(object(args.checks)&&object(s.policy)&&args.checks.phase===s.policy.phase
    &&(args.checks.verdict!==s.policy.verdict||args.checks.primaryRule!==s.policy.primaryRule
      ||JSON.stringify(args.checks.checks)!==JSON.stringify(s.policy.checks))) {
    issues.push('Supplied checks and snapshot policy disagree; both are displayed');
  }
  for(const {source,policy:p} of policies) {
    const verdictStatus=({PASS:'verified',BLOCK:'failed',HELD:'held'})[p.verdict]??'not_certified';
    const invalidSemanticBlock=p.verdict==='BLOCK'&&p.primaryRule==='R-08';
    predicates.push(item('Reported policy verdict',invalidSemanticBlock?'not_certified':verdictStatus,
      {verdict:p.verdict??unknown,primaryRule:p.primaryRule??null,phase:p.phase??unknown},
      {source,reason:invalidSemanticBlock?'R-08 cannot certify a standalone BLOCK':p.reason??unknown}));
    if(Array.isArray(p.checks)) for(const c of p.checks) {
      if(!object(c)){predicates.push(item('Malformed predicate','not_certified',unknown,{source}));continue;}
      const key=JSON.stringify([p.phase??null,c.rule??null,c.ok??null,c.reason??null]);
      if(rows.has(key)){rows.get(key).evidence.sources.push(source);continue;}
      const validRule=typeof c.rule==='string'&&/^R-0[1-7]$/.test(c.rule);
      const row=item(text(c.rule)?c.rule:'Predicate',validRule&&typeof c.ok==='boolean'?(c.ok?'verified':'failed'):'not_certified',
        {rule:c.rule??null,ok:c.ok??null}, {sources:[source],phase:p.phase??unknown,reason:c.reason??unknown});
      rows.set(key,row);predicates.push(row);
    }
    const signal=p.semanticSignal;
    if(signal!==undefined||p.primaryRule==='R-08') {
      const known=['clear','suspect','uncertain'].includes(signal);
      predicates.push(item('R-08 semantic signal',signal==='suspect'||signal==='uncertain'||p.primaryRule==='R-08'?'held':known?'verified':'not_certified',
        known?signal:unknown,{source,reason:'Auxiliary signal only; never a standalone blocking predicate'}));
    }
  }
  if(rows.size===0) predicates.push(item('Measured predicates','not_certified',unknown,{reason:'No predicate array supplied'}));
  if(!policies.some(({policy:p})=>p.semanticSignal!==undefined||p.primaryRule==='R-08')) {
    predicates.push(item('R-08 semantic signal','not_certified',unknown,{reason:'No explicit semantic observation supplied'}));
  }
  const routeEvents=[];
  if(Array.isArray(s.events))for(const e of s.events)if(e?.event==='ROUTE_FALLBACK'){
    const detail=e.detail??{};
    const route={event:'ROUTE_FALLBACK',seq:e.seq,reason:e.reason??unknown,
      failed_role:detail.failed_role??unknown,from_model:detail.from_model??unknown,to_model:detail.to_model??unknown,costs:detail.costs??[]};
    routeEvents.push(route);predicates.push(item('ROUTE_FALLBACK','held',route,{source:'controller audit event; degraded route, not completed semantic review'}));
  }
  const executor=object(args.executorResult)?args.executorResult:null;
  if(executor) {
    const e=executor.evidence;
    const valid=executor.ok===true&&object(e)&&(
      (executor.outcome==='EXECUTED'&&e.accepted===true&&e.confirmed===true&&text(e.reference)
        &&e.sent!==false&&e.rejected!==true&&object(e.providerResponse)&&Object.keys(e.providerResponse).length>0)
      ||(executor.outcome==='FAILED_NOT_SENT'&&e.rejected===true&&e.sent===false&&text(e.reason)&&text(e.reference)
        &&e.accepted!==true&&e.confirmed!==true&&object(e.providerResponse)&&Object.keys(e.providerResponse).length>0)
      ||(executor.outcome==='OUTCOME_UNKNOWN'&&text(e.reason)))
      ||(executor.ok===false&&executor.outcome==='REFUSED'&&executor.error?.code==='EXECUTION_REFUSED'
        &&text(executor.error?.reason));
    predicates.push(item('Executor result',!valid?'not_certified':executor.outcome==='EXECUTED'?'verified':executor.outcome==='OUTCOME_UNKNOWN'?'held':'failed',
      {outcome:executor.outcome??unknown,rule:executor.error?.rule??null},
      {source:'executorResult argument; reported result only',reference:executor.evidence?.reference??unknown}));
    if(!valid) issues.push('Executor result shape is inconsistent');
  } else predicates.push(item('Executor result','not_certified',unknown,{reason:'Executor result not supplied; state history still takes precedence'}));

  const history=historyOf(s);
  if(!history.complete) issues.push('Missing or structurally incomplete event history');
  // Even a broken history may contain a send: inspect every event, not only the valid prefix.
  const allStates=[state,...history.states,...(Array.isArray(s.events)?s.events.flatMap(e=>[e?.state_from,e?.state_to]):[])];
  const executed=allStates.includes('EXECUTED')||s.outcome?.status==='EXECUTED'||executor?.outcome==='EXECUTED';
  const dispatched=allStates.some(x=>['DISPATCHING','OUTCOME_UNKNOWN'].includes(x));
  const executorAttempt=executor?.evidence?.transportAttempted===true||['EXECUTED','OUTCOME_UNKNOWN','FAILED_NOT_SENT'].includes(executor?.outcome);
  if(executed&&!allStates.includes('DISPATCHING')) issues.push('Execution claim lacks dispatch lineage');
  const noDispatch=history.complete&&issues.length===0&&!executed&&!dispatched&&!executorAttempt;
  const nonActions=[
    item('외부 발송 없음 — 제공된 런 기록 범위',executed?'failed':noDispatch?'verified':'not_certified',
      executed?'Execution was reported':noDispatch?'No dispatch/executed state in the supplied complete history':unknown,
      {source:'snapshot state/events and optional executor result',historyStructurallyComplete:history.complete,
        reason:'This is an input-record assertion, not proof of all activity outside this run'}),
    item('누적 비용 관측값',amount(s.costAccumulated)?'verified':'not_certified',amount(s.costAccumulated)?s.costAccumulated:unknown,
      {source:'snapshot.costAccumulated',unit:text(b?.currency)?b.currency:unknown}),
    item('승인 외 지출 없음','not_certified',unknown,{reason:'A cumulative cost number is not a reconciled authorization/billing ledger'}),
  ];
  if(amount(s.costAccumulated)&&amount(b?.costCap)) nonActions.push(item('관측 누적 비용 ≤ 고정 상한',
    s.costAccumulated<=b.costCap?'verified':'failed',s.costAccumulated<=b.costCap,
    {costAccumulated:s.costAccumulated,costCap:b.costCap,reason:'Observed accumulated value only; future cost/billing is not certified'}));
  for(const reason of issues) predicates.push(item('Input integrity','not_certified',unknown,{reason}));
  const next={
    DRAFT:'소유자가 입력과 계획을 확인한다',CHECKED:'소유자가 심사 결과와 승인 대상을 확인한다',
    HELD:'소유자 재확인 필요',BLOCKED:'중단됨 — 수정 후 새 런에서 재심사',
    APPROVED:'소유자가 발송 전 최종 확인을 한다',DISPATCHING:'결과 확인 전 대기 — 자동 재시도 금지',
    OUTCOME_UNKNOWN:'운영자 대조 필요 — 자동 재시도 금지',REFUSED:'실행 거부 — 근거 검토 후 다음 런 여부 결정',
    REJECTED:'소유자가 거부 사유를 검토한다',FAILED:'소유자가 오류와 영수증 복구를 검토한다',
    FAILED_NOT_SENT:'소유자가 미발송 근거와 영수증을 검토한다',EXECUTED:'소유자가 결과와 영수증 봉인 여부를 검토한다',
    RECEIPTED:'소유자가 영수증과 봉인 상태를 확인한다',REPLAYABLE:'소유자가 영수증 검토 및 다음 런 여부를 결정한다',
  };
  return freeze({runId:text(s.run_id)?s.run_id:unknown,state,model_calls:modelCalls,route_events:routeEvents,
    boundInputs:panel(labels.boundInputs,boundItems),predicates:panel(labels.predicates,predicates),
    nonActions:panel(labels.nonActions,nonActions),nextGate:panel(labels.nextGate,[
      item('STOP','held',issues.length?'소유자가 불완전·불일치 입력부터 확인한다':next[state]??'소유자가 유효한 런 기록을 제공한다',
        {state,reason:'Display only; no approval or dispatch is performed by this board'}),
    ])});
}

export function renderText(receipt) {
  const r=safeInput(receipt),s=object(r)?r:{};
  // JSON string notation escapes newlines and terminal control characters in untrusted text.
  const show=x=>JSON.stringify(x??unknown);
  const out=[`Verification Receipt | run=${show(s.runId)} | state=${show(s.state)}`];
  for(const [key,label] of Object.entries(labels)) {
    out.push('',label);
    const items=Array.isArray(s[key]?.items)?s[key].items:[];
    if(!items.length) out.push(`[NOT CERTIFIED] No ${label} items supplied`);
    for(const x of items) {
      const status=statuses.has(x?.status)?x.status:'not_certified';
      out.push(`[${status==='not_certified'?'NOT CERTIFIED':status.toUpperCase()}] ${show(x?.label)}: ${show(x?.value)} | evidence=${show(x?.evidence)}`);
    }
  }
  return out.join('\n');
}
