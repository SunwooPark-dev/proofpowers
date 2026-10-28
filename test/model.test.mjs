import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetaRun, responseModelMatches, ROLE_MODELS } from '../src/model/meta.mjs';
import { plan, review } from '../src/agents/wonder.mjs';
import { draft, rewrite } from '../src/agents/spark.mjs';
import { runCases } from '../src/cases/run.mjs';
import { buildReceipt, renderText } from '../src/board/board.mjs';
import { evaluatePreflight } from '../src/policy/engine.mjs';
import { CASES } from '../src/cases/cases.mjs';
import { estimateUsd,summarizeCosts } from '../src/model/costs.mjs';
import * as controller from '../src/run/controller.mjs';
import { hashPayload } from '../src/policy/engine.mjs';

const request={role:'spark.draft',messages:[{role:'user',content:'Draft an introduction'}]};
test('response model requires exact ID and rejects prefixes and other models',()=>{
  assert.equal(responseModelMatches('muse-spark-1.3','muse-spark-1.3'),true);
  assert.equal(responseModelMatches('muse-spark-1.3','muse-spark-1.3-20261027'),false);
  assert.equal(responseModelMatches('muse-wonder-1.0','muse-wonder-1.0'),true);
  assert.equal(responseModelMatches('muse-wonder-1.0','muse-wonder-1.0-20261027'),false);
  for(const name of ['muse-spark-1.30','muse-spark-1.3evil','muse-spark-1.2','llama',null,42])
    assert.equal(responseModelMatches('muse-spark-1.3',name),false);
  assert.equal(responseModelMatches('', '-anything'),false);
});

test('four roles use frozen model constants; META_MODEL override is never read',async()=>{
  const mapping={'wonder.plan':'muse-wonder-1.0','wonder.review':'muse-wonder-1.0','spark.draft':'muse-spark-1.3','spark.rewrite':'muse-spark-1.3'};
  assert.deepEqual(ROLE_MODELS,mapping);assert.throws(()=>{ROLE_MODELS['wonder.plan']='other';});
  let network=0,reads=0;const old=globalThis.fetch;globalThis.fetch=async()=>{network++;throw Error('NO_NETWORK');};
  try{
    const a=createMetaRun({mode:'mock',env:{get META_MODEL(){reads++;throw Error('OVERRIDE_READ');},get META_API_KEY(){throw Error('KEY_READ');}}});
    for(const [role,model] of Object.entries(mapping))assert.equal((await a.callMeta({...request,role})).model,model);
    for(const role of ['spark.plan','wonder.draft','toString','unknown'])await assert.rejects(a.callMeta({...request,role}),/INVALID_MODEL_REQUEST/);
    assert.equal(reads,0);assert.equal(network,0);assert(a.getCalls().every(c=>!c.request_attempted));
    assert.equal((await createMetaRun({mode:'mock',env:{META_MODEL:'llama-override'}}).callMeta(request)).model,'muse-spark-1.3');
  }finally{globalThis.fetch=old;}
});

test('owner rate table produces model-specific USD estimates and unknown usage stays null',()=>{
  assert.equal(estimateUsd('muse-wonder-1.0',{input_tokens:1_000_000,output_tokens:1_000_000}),24);
  assert.equal(estimateUsd('muse-spark-1.3',{input_tokens:1_000_000,output_tokens:1_000_000}),5.5);
  assert.equal(estimateUsd('muse-wonder-1.0',{input_tokens:1000,output_tokens:2000}),0.044);
  assert.equal(estimateUsd('muse-spark-1.3',{input_tokens:1000,output_tokens:2000}),0.00975);
  for(const u of [null,{input_tokens:-1,output_tokens:1},{input_tokens:'1',output_tokens:1}])assert.equal(estimateUsd('muse-spark-1.3',u),null);
  assert.equal(estimateUsd('toString',{input_tokens:1,output_tokens:1}),null);
  const calls=[{model:'muse-spark-1.3',usage:{input_tokens:1000,output_tokens:2000}},{model:'muse-spark-1.3',usage:{input_tokens:1000,output_tokens:2000}}];
  assert.equal(summarizeCosts(calls)[0].usd_estimate,0.0195);
  assert.equal(summarizeCosts([...calls,{model:'muse-spark-1.3',usage:null}])[0].usd_estimate,null);
  const r=buildReceipt({model_calls:[{role:'wonder.plan',model:'muse-wonder-1.0',mode:'mock',status:'success',usage:{input_tokens:1000,output_tokens:2000},usd_estimate:0.044}]});
  assert.equal(r.model_calls[0].usd_estimate,0.044);assert(renderText(r).includes('"usd_estimate":0.044'));
});

function fallbackFixture(external,failedRole){
  const bounds={allowedActions:['draft','outreach_send'],allowedRecipients:['demo@example.test'],costCap:1};
  const created=controller.createRun(bounds);assert(created.ok);const run=created.run;
  const adapter=createMetaRun({runId:run.id,mode:'mock',mockFailures:[failedRole],onRouteEvent:e=>{
    const r=controller.recordRouteFallback(run,e);assert.equal(r.ok,true);
  }});
  const payload=external?{run_id:run.id,action_type:'outreach_send',recipient:'demo@example.test',subject:'Demo',body:'',attachments:[],bound_inputs_hash:hashPayload(bounds)}:{action_type:'draft',body:''};
  return {run,adapter,input:{payload,evidence:[],hasExternalAction:external,costAccumulated:0,costEstimate:0}};
}

test('Wonder planning failure logs ROUTE_FALLBACK; Spark-only external run stays HOLD',async()=>{
  const x=fallbackFixture(true,'wonder.plan');
  x.input.plan=await plan({goal:'Prepare demo outreach'},x.adapter);
  x.input.payload.body=await draft({goal:x.input.plan.goal,plan:x.input.plan},x.adapter);
  assert.equal(await rewrite({body:x.input.payload.body,reason:'Conservative draft'},x.adapter),'A useful service.');
  const advice=await review({body:x.input.payload.body},x.adapter);assert.equal(advice.completed,false);
  assert.equal(x.adapter.isSparkOnly(),true);assert.equal(x.adapter.getRouteEvents().length,1);
  assert.deepEqual(x.adapter.getCalls().map(c=>c.role),['wonder.plan','spark.draft','spark.rewrite']);
  const checked=controller.checkPreflight(x.run,x.input,{semanticReviewCompleted:false,semanticSignal:'clear'});
  assert.equal(checked.state,'HELD');assert.equal(checked.policy.primaryRule,'R-08');
  assert.equal(controller.approve(x.run,{}).error.code,'R08_REVIEW_INCOMPLETE');
  assert.equal(controller.beginDispatch(x.run,{}).error.code,'R08_REVIEW_INCOMPLETE');assert.equal(x.run.state,'HELD');
  assert.equal(controller.recheckHeld(x.run,{semanticSignal:'clear'}).state,'HELD');
  assert.equal(controller.approve(x.run,{}).error.code,'R08_REVIEW_INCOMPLETE');
  const snapshot=controller.getRunSnapshot(x.run);assert(snapshot.data.events.some(e=>e.event==='ROUTE_FALLBACK'));
  const r=buildReceipt({snapshot,checks:checked.policy,model_calls:x.adapter.getCalls()});
  assert.equal(r.route_events.length,1);assert(renderText(r).includes('ROUTE_FALLBACK'));
  assert(r.model_calls.every(c=>Object.hasOwn(c,'usd_estimate')&&c.usd_estimate===null));
  assert.equal(r.model_calls[0].model,'muse-wonder-1.0');assert.equal(r.model_calls[1].model,'muse-spark-1.3');
  assert.equal(x.adapter.getRouteEvents()[0].costs[0].model,'muse-wonder-1.0');
  await assert.rejects(x.adapter.callMeta({role:'wonder.review',messages:request.messages}),/WONDER_ROUTE_DISABLED/);
  assert.equal(x.adapter.getRouteEvents().length,1);
});

test('Wonder review failure permits internal receipt-only work without claiming review completion',async()=>{
  const x=fallbackFixture(false,'wonder.review');x.input.plan=await plan({goal:'Prepare demo outreach'},x.adapter);
  x.input.payload.body=await draft({goal:x.input.plan.goal,plan:x.input.plan},x.adapter);
  const advice=await review({body:x.input.payload.body},x.adapter);assert.equal(advice.completed,false);
  const r=controller.checkPreflight(x.run,x.input,{semanticReviewCompleted:false});assert.equal(r.policy.verdict,'PASS');
  assert.equal(controller.seal(x.run).state,'REPLAYABLE');
  const s=controller.getRunSnapshot(x.run);assert.equal(s.data.semantic_review_completed,false);
  assert(s.data.events.some(e=>e.event==='ROUTE_FALLBACK'&&e.detail.failed_role==='wonder.review'));
});

test('budget fallback is logged but cannot bypass R05; external missing review defaults HOLD',async()=>{
  const x=fallbackFixture(false,'wonder.plan');x.adapter.activateFallback('wonder.plan','RUN_BUDGET_GUARD');
  x.input.plan=await plan({goal:'Prepare demo outreach'},x.adapter);x.input.payload.body=await draft({goal:x.input.plan.goal,plan:x.input.plan},x.adapter);
  x.input.costAccumulated=2;const r=controller.checkPreflight(x.run,x.input,{semanticReviewCompleted:false});
  assert.equal(r.policy.verdict,'BLOCK');assert.equal(r.policy.primaryRule,'R-05');assert.equal(x.adapter.getRouteEvents()[0].reason,'RUN_BUDGET_GUARD');
  assert(!x.adapter.getCalls().some(c=>c.role.startsWith('wonder.')));
  const y=fallbackFixture(true,'wonder.plan');y.input.plan={goal:'Demo',steps:['Draft']};y.input.payload.body='A useful service.';
  assert.equal(controller.checkPreflight(y.run,y.input).state,'HELD');
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
test('primaryUnderTest validates passed predicates; restored runner 13/13 and safe fixture corrections',async()=>{
  const result=await runCases();assert.equal(result.correct,13);assert.equal(result.hardGate,true);
  assert.equal(result.pending,0);assert.equal(result.passed,true);assert.equal(result.blockCorrect,7);
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
  assert.equal(changed.correct,12);assert.equal(changed.passed,false);
});
