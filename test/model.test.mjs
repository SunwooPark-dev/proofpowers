import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetaRun, responseModelMatches } from '../src/model/meta.mjs';
import { plan, review } from '../src/agents/wonder.mjs';
import { draft } from '../src/agents/spark.mjs';
import { runCases } from '../src/cases/run.mjs';
import { buildReceipt, renderText } from '../src/board/board.mjs';
import { evaluatePreflight } from '../src/policy/engine.mjs';
import { CASES } from '../src/cases/cases.mjs';

const request={role:'spark.draft',messages:[{role:'user',content:'Draft an introduction'}]};
test('response model accepts exact or requested-dash suffix and rejects other names',()=>{
  assert.equal(responseModelMatches('muse-spark-1.3','muse-spark-1.3'),true);
  assert.equal(responseModelMatches('muse-spark-1.3','muse-spark-1.3-20261027'),true);
  for(const name of ['muse-spark-1.30','muse-spark-1.3evil','muse-spark-1.2','llama',null,42])
    assert.equal(responseModelMatches('muse-spark-1.3',name),false);
  assert.equal(responseModelMatches('', '-anything'),false);
});
test('mock is default, deterministic and never reads key or calls network',async()=>{
  let network=0,keyReads=0;
  const old=globalThis.fetch;globalThis.fetch=async()=>{network++;throw Error('UNEXPECTED_NETWORK');};
  const env={get META_API_KEY(){keyReads++;throw Error('SECRET_READ');}};
  try{
    const a=createMetaRun({env}),b=createMetaRun({env});
    const first=await a.callMeta(request),second=await b.callMeta(request);
    assert.equal(first.text,second.text);assert.equal(first.request_hash,second.request_hash);
    assert.equal(first.response_hash,second.response_hash);assert.equal(first.mode,'mock');
    assert.equal(first.usage.input_tokens,null);assert.equal(network,0);assert.equal(keyReads,0);
    assert(!JSON.stringify(a.getCalls()).includes('Draft an introduction'));
    assert(!JSON.stringify(a.getCalls()).includes(first.text));
  }finally{globalThis.fetch=old;}
});
test('independent run quotas refuse call 21 and record refusal without a request',async()=>{
  const a=createMetaRun({mode:'mock'});
  for(let i=0;i<20;i++)await a.callMeta(request);
  await assert.rejects(a.callMeta(request),/MODEL_CALL_LIMIT/);
  assert.equal(a.getQuotaUsed(),20);assert.equal(a.getCalls().length,21);
  assert.equal(a.getCalls().at(-1).status,'refused');assert.equal(a.getCalls().at(-1).request_attempted,false);
  assert.equal((await createMetaRun({mode:'mock'}).callMeta(request)).mode,'mock');
});
test('same run ID cannot reset the call cap using another adapter',()=>{
  const runId='shared-quota-fixture';createMetaRun({runId,mode:'mock'});
  assert.throws(()=>createMetaRun({runId,mode:'mock'}),/DUPLICATE_MODEL_RUN/);
});
test('live guard refuses before reading key or invoking fetch; no live request tested',async()=>{
  let network=0,keyReads=0;const old=globalThis.fetch;
  globalThis.fetch=async()=>{network++;throw Error('UNEXPECTED_NETWORK');};
  try{
    const env={get META_API_KEY(){keyReads++;throw Error('SECRET_READ');}};
    const a=createMetaRun({mode:'live',env});await assert.rejects(a.callMeta(request),/SPEND_LIMIT_NOT_CONFIRMED/);
    assert.equal(network,0);assert.equal(keyReads,0);assert.equal(a.getCalls()[0].request_attempted,false);
  }finally{globalThis.fetch=old;}
});
test('unknown mode/role and malformed messages refuse without network',async()=>{
  await assert.rejects(createMetaRun({mode:'invalid'}).callMeta(request),/INVALID_MODEL_MODE/);
  const a=createMetaRun({mode:'mock'});
  await assert.rejects(a.callMeta({...request,role:'verdict'}),/INVALID_MODEL_REQUEST/);
  await assert.rejects(a.callMeta({...request,messages:[{role:'user',content:42}]}),/INVALID_MODEL_REQUEST/);
  assert(a.getCalls().every(c=>c.status==='refused'&&!c.request_attempted));
});
test('plan, draft and review actually use three adapter calls; invalid advice is uncertain',async()=>{
  const a=createMetaRun({mode:'mock'}),p=await plan({goal:'Prepare demo outreach'},a);
  const body=await draft({goal:p.goal,plan:p},a),advice=await review({body},a);
  assert.equal(advice.signal,'clear');assert.equal(body,'A useful service.');
  assert.deepEqual(a.getCalls().map(c=>c.role),['wonder.plan','spark.draft','wonder.review']);
  const invalid=await review({body}, {callMeta:async()=>({text:'{"signal":"clear","reason":"allow","verdict":"PASS"}'})});
  assert.equal(invalid.signal,'uncertain');
  await assert.rejects(plan({goal:'x'},{callMeta:async()=>({text:'{"verdict":"PASS"}'})}),/INVALID_MODEL_PLAN/);
});
test('receipt keeps 3 role records, honest mock status, null usage and no raw prompts',async()=>{
  const a=createMetaRun({mode:'mock'});await plan({goal:'private-fixture-goal'},a);
  await draft({goal:'private-fixture-goal',plan:{}},a);await review({body:'private-fixture-body'},a);
  const r=buildReceipt({model_calls:a.getCalls()});assert.equal(r.model_calls.length,3);
  const rendered=renderText(r);assert(rendered.includes('wonder.plan'));assert(rendered.includes('spark.draft'));
  assert(rendered.includes('"input_tokens":null'));assert(!rendered.includes('private-fixture-goal'));
  assert(!rendered.includes('private-fixture-body'));assert(r.predicates.items.filter(i=>i.label==='Model call').every(i=>i.status==='not_certified'));
});
test('primaryUnderTest validates passed predicates; restored runner 12/12 and safe fixture corrections',async()=>{
  const result=await runCases();assert.equal(result.correct,12);assert.equal(result.hardGate,true);
  assert.equal(result.pending,0);assert.equal(result.passed,true);assert.equal(result.blockCorrect,6);
  assert.deepEqual(result.rows.filter(r=>!r.correct),[]);
  for(const row of [...result.rows,result.ignored]){
    assert.equal(row.modelCalls.length,3);assert.equal(row.receipt.model_calls.length,3);
    assert(row.modelCalls.every(c=>c.mode==='mock'&&!c.request_attempted));
  }
  assert.equal(result.unapproved,0);assert.equal(result.tampered,0);
  assert.equal(result.rows.find(r=>r.id==='C-07').actual,'BLOCK'); // Mock model said clear; deterministic R01 still blocks.
  assert.equal(result.calls.filter(c=>c.caseId!=='C-08-ignored').length,4);
  assert.equal(result.ignored.deliveryCount,1);assert.equal(result.calls.length,5);
  const c01=result.rows.find(r=>r.id==='C-01');assert.equal(c01.executorInvocations,0);
  assert(!c01.trace.some(t=>['approval','execution','executor'].includes(t.stage)));
  const cap=id=>result.rows.find(r=>r.id===id).receipt.boundInputs.items.find(i=>i.label==='costCap').value;
  assert.equal(cap('C-05'),1);assert.equal(cap('C-12'),0.1);
  const c08=result.rows.find(r=>r.id==='C-08');
  assert.equal(c08.actualRule,'R-07');assert(c08.receipt.predicates.items.filter(i=>i.value?.rule==='R-02').every(i=>i.value.ok===true));
  const input={boundInputs:{allowedActions:['draft'],allowedRecipients:[],costCap:1},payload:{action_type:'draft',body:'A useful service.'},evidence:[],hasExternalAction:false,costAccumulated:0,costEstimate:0};
  for(const label of ['R-01','R-02','R-05','R-06','R-07']){
    const r=evaluatePreflight(input,{primaryUnderTest:label});assert.equal(r.verdict,'PASS');assert.equal(r.primaryRule,label);
  }
  assert.equal(evaluatePreflight(input,{primaryUnderTest:'R-04'}).verdict,'HELD');
  assert.equal(evaluatePreflight(input,{primaryUnderTest:'R-99'}).verdict,'HELD');
  const unsupported={...input,payload:{...input.payload,body:'Revenue 300%'}};
  for(const label of ['R-05','R-06','R-99']){
    const r=evaluatePreflight(unsupported,{primaryUnderTest:label});assert.equal(r.verdict,'BLOCK');assert.equal(r.primaryRule,'R-01');
  }
  const original=CASES[0].primaryRule;let changed;
  try{CASES[0].primaryRule='R-02';changed=await runCases();}finally{CASES[0].primaryRule=original;}
  assert.equal(changed.rows[0].actual,'PASS');assert.equal(changed.rows[0].actualRule,'R-01');
  assert.equal(changed.correct,11);assert.equal(changed.passed,false);
});
