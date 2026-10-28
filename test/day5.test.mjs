import test from 'node:test';import assert from 'node:assert/strict';
import {createRunBudget} from '../src/model/budget.mjs';
import {createMetaRun} from '../src/model/meta.mjs';import {plan,review} from '../src/agents/wonder.mjs';import {draft} from '../src/agents/spark.mjs';
import {runDemo} from '../src/demo/run.mjs';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {randomUUID} from 'node:crypto';import {unlinkSync} from 'node:fs';

test('budget reserves before requests and retains unknown failure exposure',()=>{
  const b=createRunBudget();const t=b.reserve({model:'muse-wonder-1.0',messages:[{role:'user',content:'Synthetic'}],maxOutputTokens:16});
  const before=b.snapshot().accounted_usd;assert(before>0);b.settle(t,null);assert.equal(b.snapshot().accounted_usd,before);
  assert.throws(()=>b.reserve({model:'muse-wonder-1.0',messages:[{role:'user',content:'x'.repeat(50000)}],maxOutputTokens:2048}),/RUN_BUDGET_RESERVATION_DENIED/);
  assert(b.snapshot().accounted_usd<=0.10);
});
test('known usage settles reservations; actual estimate over cap halts future requests',()=>{
  const b=createRunBudget();const t=b.reserve({model:'muse-spark-1.3',messages:[{role:'user',content:'Synthetic'}],maxOutputTokens:2048});
  b.settle(t,{input_tokens:100,output_tokens:100});assert.equal(b.snapshot().accounted_usd,0.00055);
  const next=b.reserve({model:'muse-wonder-1.0',messages:[],maxOutputTokens:16});
  assert.throws(()=>b.settle(next,{input_tokens:1_000_000,output_tokens:1_000_000}),/RUN_BUDGET_EXCEEDED/);
  assert.throws(()=>b.reserve({model:'muse-spark-1.3',messages:[],maxOutputTokens:1}),/RUN_BUDGET_EXCEEDED/);
});
test('a second sequential budget instance loads the first run reservation',()=>{
  const path=join(tmpdir(),`pp-day5-budget-${randomUUID()}.json`);
  try{
    const a=createRunBudget({path});const id=a.reserve({model:'muse-wonder-1.0',messages:[],maxOutputTokens:16});a.settle(id,null);
    const b=createRunBudget({path});assert.equal(b.snapshot().accounted_usd,a.snapshot().accounted_usd);
    const next=b.reserve({model:'muse-spark-1.3',messages:[],maxOutputTokens:2048});b.settle(next,{input_tokens:100,output_tokens:100});
    const c=createRunBudget({path});assert.equal(c.snapshot().requests.length,2);assert.equal(c.snapshot().accounted_usd,b.snapshot().accounted_usd);
  }finally{unlinkSync(path);}
});
test('invalid-model injection is opt-in and affects only wonder.plan; mock has zero network',async()=>{
  let network=0;const old=globalThis.fetch;globalThis.fetch=async()=>{network++;throw Error('NO_NETWORK');};
  try{
    const a=createMetaRun({mode:'mock',testInvalidWonderPlan:true});
    const p=await plan({goal:'Prepare demo outreach'},a);assert(a.isSparkOnly());
    await draft({goal:p.goal,plan:p},a);const advice=await review({body:'Synthetic'},a);assert.equal(advice.completed,false);
    const calls=a.getCalls();assert.equal(calls.length,2);assert.equal(calls[0].role,'wonder.plan');assert.equal(calls[0].model,'muse-wonder-INVALID');
    assert.equal(calls[1].model,'muse-spark-1.3');assert.equal(a.getRouteEvents().length,1);assert.equal(network,0);
    const normal=createMetaRun({mode:'mock'});await plan({goal:'Prepare demo outreach'},normal);assert.equal(normal.getCalls()[0].model,'muse-wonder-1.0');
  }finally{globalThis.fetch=old;}
});
test('fixed three-cut demos PASS/HOLD/BLOCK have correct delivery boundaries',async()=>{
  const p=await runDemo('pass'),h=await runDemo('hold'),b=await runDemo('block');
  assert.equal(p.verdict,'PASS');assert.equal(p.deliveries,1);assert.equal(p.receipt.state,'REPLAYABLE');
  assert.equal(h.verdict,'HELD');assert.equal(h.rule,'R-08');assert.equal(h.deliveries,0);assert.equal(h.receipt.route_events.length,1);
  assert.equal(b.verdict,'BLOCK');assert.equal(b.rule,'R-01');assert.equal(b.deliveries,0);
});

// Hermetic transport fixtures: live adapter branch, synthetic env, zero real network.
for (const [status,raw,release] of [[404,{error:{code:'not_found'}},true],[503,{error:{code:'unavailable'}},false],[503,{usage:{input_tokens:4,output_tokens:2}},false],[429,{usage:{input_tokens:4,output_tokens:2}},false],[400,{usage:{input_tokens:4}},false]]) {
 test(`HTTP ${status} settlement with usage=${raw.usage!==undefined}`,async()=>{
  const events=[],b=createRunBudget({onSettled:e=>events.push(e)});
  const previous=globalThis.fetch;let fixtures=0;
  globalThis.fetch=async()=>{fixtures++;return new Response(JSON.stringify(raw),{status});};
  try {
   const a=createMetaRun({mode:'live',env:{PP_SPEND_LIMIT_CONFIRMED:'1',META_API_BASE:'https://api.meta.ai/v1',META_API_KEY:'synthetic-test-key'},budget:b});
   await assert.rejects(a.callMeta({role:'wonder.plan',messages:[{role:'user',content:'Synthetic'}]}),/META_HTTP_ERROR/);
   const s=b.snapshot(),row=s.requests[0];assert.equal(fixtures,1);
   if(release){
    assert.equal(row.charged_nanos,0);assert.equal(events[0].reason,'HTTP_4XX_NO_USAGE_OWNER_POLICY');
    assert.doesNotThrow(()=>b.reserve({role:'wonder.plan',model:'muse-wonder-1.0',messages:[],maxOutputTokens:2048}));
   }else if(status===429){assert.equal(row.charged_nanos,56000);}
   else assert.equal(row.charged_nanos,row.reserved_nanos);
   assert.equal(events.length,1);assert.equal(events[0].event,'BUDGET_SETTLED');assert.equal(events[0].role,'wonder.plan');
   assert.equal(events[0].reserved,row.reserved_nanos/1e9);assert.equal(events[0].settled,row.charged_nanos/1e9);
  }finally{globalThis.fetch=previous;}
 });
}
test('timeout retains reservation and logs conservative settlement',async()=>{
 const events=[],b=createRunBudget({onSettled:e=>events.push(e)}),previous=globalThis.fetch;
 globalThis.fetch=async()=>{throw new DOMException('fixture','TimeoutError');};
 try{
  const a=createMetaRun({mode:'live',env:{PP_SPEND_LIMIT_CONFIRMED:'1',META_API_BASE:'https://api.meta.ai/v1',META_API_KEY:'synthetic-test-key'},budget:b});
  await assert.rejects(a.callMeta({role:'wonder.plan',messages:[{role:'user',content:'Synthetic'}]}),/META_CALL_FAILED/);
  const r=b.snapshot().requests[0];assert.equal(r.charged_nanos,r.reserved_nanos);assert.equal(events[0].reason,'USAGE_UNKNOWN_RESERVATION_RETAINED');
 }finally{globalThis.fetch=previous;}
});


test('budget settlement reaches hash-chained controller audit and ledger',async()=>{
 const c=await import('../src/run/controller.mjs');
 const run=c.createRun({allowedActions:['draft'],allowedRecipients:[],costCap:1}).run;
 const b=createRunBudget({onSettled:e=>assert.equal(c.recordBudgetSettled(run,e).ok,true)});
 const id=b.reserve({role:'wonder.plan',model:'muse-wonder-1.0',messages:[],maxOutputTokens:2048});
 b.settle(id,null,{httpStatus:404,usageAbsent:true});
 const e=c.getRunSnapshot(run).data.events.at(-1);
 assert.equal(e.event,'BUDGET_SETTLED');assert.equal(e.detail.role,'wonder.plan');assert.equal(e.detail.settled,0);
 assert(e.hash&&e.prev_hash);assert.equal(b.snapshot().events[0].settled,0);
 assert.equal(c.recordBudgetSettled(run,{event:'BUDGET_SETTLED',role:'bad',reserved:0,settled:0}).ok,false);
});
test('dry-run stays offline even with live env and reports conservative total honestly',async()=>{
 const {dryRun}=await import('../scripts/model-dry-run.mjs');
 const previous=globalThis.fetch,oldMode=process.env.PP_MODEL_MODE;let calls=0;
 process.env.PP_MODEL_MODE='live';
 globalThis.fetch=async()=>{calls++;throw Error('NO_REAL_NETWORK');};
 try{
  const d=await dryRun();assert.equal(calls,0);assert.equal(d.network_calls,0);assert.equal(d.calls.length,3);
  assert.deepEqual(d.calls.map(c=>c.model),['muse-wonder-1.0','muse-spark-1.3','muse-wonder-1.0']);
  assert.equal(d.all_unsettled_reserved_usd,d.calls.reduce((n,c)=>n+c.reserved_nanos,0)/1e9);
  assert.equal(d.all_unsettled_within_limit,d.all_unsettled_reserved_usd<=0.10);
  assert.equal(d.sequential_live_fit,'UNKNOWN_REQUIRES_ACTUAL_USAGE_SETTLEMENT');
 }finally{globalThis.fetch=previous;if(oldMode===undefined)delete process.env.PP_MODEL_MODE;else process.env.PP_MODEL_MODE=oldMode;}
});


test('unparseable 4xx response does not prove usage absence and retains reservation',async()=>{
 const b=createRunBudget(),previous=globalThis.fetch;
 globalThis.fetch=async()=>new Response('synthetic non-JSON error',{status:404});
 try{
  const a=createMetaRun({mode:'live',env:{PP_SPEND_LIMIT_CONFIRMED:'1',META_API_BASE:'https://api.meta.ai/v1',META_API_KEY:'synthetic-test-key'},budget:b});
  await assert.rejects(a.callMeta({role:'wonder.plan',messages:[{role:'user',content:'Synthetic'}]}),/META_HTTP_ERROR/);
  const r=b.snapshot().requests[0];assert.equal(r.charged_nanos,r.reserved_nanos);
  assert.equal(b.snapshot().events[0].reason,'USAGE_UNKNOWN_RESERVATION_RETAINED');
 }finally{globalThis.fetch=previous;}
});
test('audit sink failure halts future reservations instead of silently freeing headroom',()=>{
 const b=createRunBudget({onSettled:()=>{throw Error('fixture');}});
 const id=b.reserve({role:'wonder.plan',model:'muse-wonder-1.0',messages:[],maxOutputTokens:2048});
 assert.throws(()=>b.settle(id,null,{httpStatus:404,usageAbsent:true}),/RUN_BUDGET_AUDIT_FAILED/);
 assert.equal(b.snapshot().halted,true);
 assert.throws(()=>b.reserve({role:'wonder.plan',model:'muse-wonder-1.0',messages:[],maxOutputTokens:2048}),/RUN_BUDGET_EXCEEDED/);
});
