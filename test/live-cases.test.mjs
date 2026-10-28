import test from 'node:test';
import assert from 'node:assert/strict';
import {runCases} from '../src/cases/run.mjs';
import {createRunBudget} from '../src/model/budget.mjs';
import {recordBudgetSettled} from '../src/run/controller.mjs';
const env={PP_SPEND_LIMIT_CONFIRMED:'1',META_API_BASE:'https://api.meta.ai/v1',META_API_KEY:'synthetic-test-key'};
test('explicit live suite uses fake transport for 12 only and preserves mock executor and scoring',async()=>{
 const previous=globalThis.fetch;let fetches=0,activeRun;
 globalThis.fetch=async(_url,options)=>{
  fetches++;const body=JSON.parse(options.body),system=body.input[0].content;
  const text=body.model==='muse-spark-1.3'?'A useful service.':system.includes('goal:string')?JSON.stringify({goal:'Prepare demo outreach',steps:['Draft and review']}):JSON.stringify({signal:'clear',reason:'Synthetic fixture'});
  return new Response(JSON.stringify({status:'completed',model:body.model,usage:{input_tokens:10,output_tokens:10,total_tokens:20},output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}]}),{status:200});
 };
 try{
  const budget=createRunBudget({limitUsd:0.60,onSettled:e=>assert(recordBudgetSettled(activeRun,e).ok)});
  const r=await runCases({modelMode:'live',modelEnv:env,budget,includeIgnored:false,onRun:run=>{activeRun=run;}});
  assert.equal(r.correct,12);assert.equal(r.hardGate,true);assert.equal(r.passed,true);
  assert.equal(r.rows.length,12);assert.equal(r.ignored,null);assert.equal(fetches,36);
  assert.equal(r.calls.length,4);assert.equal(r.unapproved,0);assert.equal(r.tampered,0);
  assert(r.rows.every(row=>row.auditEvents.filter(e=>e.event==='BUDGET_SETTLED').length===3));
  assert.equal(budget.snapshot().requests.length,36);
 }finally{globalThis.fetch=previous;}
});
test('live suite stops before transport if the shared cap cannot reserve first call',async()=>{
 const previous=globalThis.fetch;let fetches=0;
 globalThis.fetch=async()=>{fetches++;throw Error('FORBIDDEN');};
 try{
  const r=await runCases({modelMode:'live',modelEnv:env,budget:createRunBudget({limitUsd:0.01}),includeIgnored:false});
  assert.equal(fetches,0);assert.equal(r.stopped,true);assert.equal(r.hardGate,false);
  assert.equal(r.rows[0].errorCode,'RUN_BUDGET_RESERVATION_DENIED');
  assert.equal(r.rows.filter(row=>row.actual==='NOT_RUN').length,11);assert.equal(r.ignored,null);
 }finally{globalThis.fetch=previous;}
});
