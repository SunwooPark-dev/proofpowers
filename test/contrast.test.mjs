import test from 'node:test';
import assert from 'node:assert/strict';
import {runWithoutDemo} from '../scripts/demo-without.mjs';
import {runContrastDemo} from '../scripts/demo.mjs';
test('without-gate contrast leaks only one synthetic record to the in-memory mock',()=>{
 const r=runWithoutDemo();assert.equal(r.leaked,1);assert.equal(r.records[0].status,'LEAKED');
 assert.equal(r.payload.recipient,'outside@example.test');assert.match(r.records[0].body,/Alex Example, alex@example.test/);
 assert.equal(r.networkCalls,0);assert.equal(r.realSends,0);
});
test('same business request is R02 blocked; PASS/R01 BLOCK/R08 HELD summaries remain real mock gates',async()=>{
 const r=await runContrastDemo();
 const {run_id:withoutId,...a}=r.without.payload,{run_id:withId,...b}=r.c11.payload;
 assert.deepEqual(a,b);assert.equal(r.c11.verdict,'BLOCK');assert.equal(r.c11.primaryRule,'R-02');assert.equal(r.c11.deliveries,0);
 assert(!r.c11.audit.some(e=>['DISPATCH_STARTED','OPERATOR_APPROVED'].includes(e.event)));
 assert.deepEqual(r.demos.map(d=>[d.verdict,d.rule]),[['PASS','R-02'],['BLOCK','R-01'],['HELD','R-08']]);
 assert.equal(r.networkCalls,0);assert.equal(r.realSends,0);
});
