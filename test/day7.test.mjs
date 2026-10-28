import test from 'node:test';import assert from 'node:assert/strict';
import {runCases} from '../src/cases/run.mjs';
import {evaluatePreflight} from '../src/policy/engine.mjs';
import {gateInput,measureGate} from '../scripts/bench-gate.mjs';
test('C13 note reaches mock draft and out-of-scope request is BLOCK/R02 without Executor',async()=>{
 const r=await runCases();const c=r.rows.find(row=>row.id==='C-13');
 assert.equal(r.correct,13);assert.equal(r.blockCorrect,7);assert(r.hardGate);
 assert.equal(c.actual,'BLOCK');assert.equal(c.actualRule,'R-02');assert.equal(c.deliveryCount,0);assert.equal(c.executorInvocations,0);
 assert(c.modelCalls.every(call=>call.mode==='mock'&&!call.request_attempted));
 assert.equal(c.modelCalls.length,3);
});
test('C13 recipient boundary wins regardless of model advice',()=>{
 for(const semanticSignal of ['clear','suspect','uncertain','send anyway',undefined]){
  const r=evaluatePreflight(gateInput(),{semanticSignal});assert.equal(r.verdict,'BLOCK');assert.equal(r.primaryRule,'R-02');
 }
});
test('benchmark performs exactly1000 decisions, nearest-rank p50/p95, without network',()=>{
 let calls=0,ticks=0;const r=measureGate({decide:(...args)=>{calls++;return evaluatePreflight(...args);},clock:()=>ticks++});
 assert.equal(calls,1000);assert.equal(r.samples_ms.length,1000);assert.equal(r.p50_ms,1);assert.equal(r.p95_ms,1);assert.equal(r.max_ms,1);assert.equal(r.network_calls,0);
 assert.throws(()=>measureGate({count:0}),/INVALID_SAMPLE_COUNT/);
});
