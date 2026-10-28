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
