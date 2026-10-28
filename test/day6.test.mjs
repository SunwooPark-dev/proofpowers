import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync,readFileSync,rmSync,lstatSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve,dirname,basename} from 'node:path';import {execFileSync} from 'node:child_process';
import {runCases} from '../src/cases/run.mjs';import {createMetaRun} from '../src/model/meta.mjs';import {createRunBudget} from '../src/model/budget.mjs';
import * as c from '../src/run/controller.mjs';import {killActive,REPO_ROOT} from '../src/run/kill.mjs';import {runDemo} from '../src/demo/run.mjs';
import {persistSuite,verifyState,readState} from '../src/run/state.mjs';import {backup,restore} from '../src/run/backup.mjs';import {hashPayload} from '../src/policy/engine.mjs';import {createExecutor} from '../src/envelope/executor.mjs';
const bounds={allowedActions:['outreach_send','draft'],allowedRecipients:['demo@example.test'],costCap:1};
async function withKill(value,fn){const old=process.env.PROOFPOWERS_KILL;process.env.PROOFPOWERS_KILL=value;try{return await fn();}finally{if(old===undefined)delete process.env.PROOFPOWERS_KILL;else process.env.PROOFPOWERS_KILL=old;}}
test('kill before run gives BLOCK/KILL with audit and zero model calls/deliveries',()=>withKill('1',async()=>{
 const r=await runCases();assert(r.rows.every(row=>row.actual==='BLOCK'&&row.actualRule==='KILL'&&row.modelCalls.length===0));assert.equal(r.calls.length,0);
 assert(r.rows.every(row=>row.runState.events.filter(e=>e.event==='KILL_ENGAGED').length===1));
 const demo=await runDemo('pass');assert.equal(demo.verdict,'BLOCK');assert.equal(demo.rule,'KILL');assert.equal(demo.deliveries,0);
}));
test('kill between plan and draft stops next boundary, no fallback and no deliveries',()=>withKill('0',async()=>{
 let flipped=false;const r=await runCases({onStep:stage=>{if(stage==='plan'&&!flipped){flipped=true;process.env.PROOFPOWERS_KILL='1';}}});
 assert.equal(r.rows[0].modelCalls.length,1);assert.equal(r.calls.length,0);
 assert(r.rows.every(row=>row.actual==='BLOCK'&&row.actualRule==='KILL'));
 assert(r.rows.every(row=>!row.runState.events.some(e=>e.event==='ROUTE_FALLBACK')));
}));
test('kill off preserves the twelve cases and all three demos',()=>withKill('0',async()=>{
 const r=await runCases();assert.equal(r.correct,12);assert.equal(r.hardGate,true);assert.equal(r.passed,true);
 for(const [kind,verdict] of [['pass','PASS'],['hold','HELD'],['block','BLOCK']])assert.equal((await runDemo(kind)).verdict,verdict);
}));
test('repo-root KILL file detection does not depend on environment',()=>withKill('0',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pp-kill-'));try{assert.equal(killActive(root),false);writeFileSync(join(root,'KILL'),'');assert.equal(killActive(root),true);unlinkSync(join(root,'KILL'));assert.equal(killActive(root),false);}finally{rmdirSync(root);}
}));
test('mid-run kill releases only unsettled reservations, audits zero and remains latched',()=>withKill('0',async()=>{
 const run=c.createRun(bounds).run,b=createRunBudget({onSettled:e=>assert(c.recordBudgetSettled(run,e).ok)});
 const a=createMetaRun({runId:run.id,mode:'mock',budget:b});
 const t=b.reserve({role:'spark.draft',model:'muse-spark-1.3',messages:[],maxOutputTokens:16});b.settle(t,{input_tokens:10,output_tokens:10});
 b.reserve({role:'wonder.plan',model:'muse-wonder-1.0',messages:[],maxOutputTokens:2048});
 process.env.PROOFPOWERS_KILL='1';await assert.rejects(a.callMeta({role:'wonder.plan',messages:[{role:'user',content:'Synthetic'}]}),/KILL_ENGAGED/);
 const s=b.snapshot();assert.equal(s.accounted_usd,0.000055);assert.equal(s.requests[1].charged_nanos,0);assert.equal(s.events.at(-1).settled,0);
 assert.equal(s.events.at(-1).reason,'KILL_RESERVATION_RELEASED');assert.equal(a.getCalls().length,0);
 const events=c.getRunSnapshot(run).data.events;assert(events.some(e=>e.event==='BUDGET_SETTLED'&&e.detail.settled===0));assert.equal(events.at(-1).event,'KILL_ENGAGED');
 process.env.PROOFPOWERS_KILL='0';await assert.rejects(a.callMeta({role:'spark.draft',messages:[{role:'user',content:'Synthetic'}]}),/KILL_ENGAGED/);
 assert.equal(c.getRunSnapshot(run).data.events.filter(e=>e.event==='KILL_ENGAGED').length,1);
}));
function prepared(){
 const run=c.createRun(bounds).run,payload={run_id:run.id,action_type:'outreach_send',recipient:'demo@example.test',subject:'Synthetic',body:'A useful service.',attachments:[],bound_inputs_hash:hashPayload(bounds)};
 assert(c.checkPreflight(run,{plan:{goal:'Synthetic',steps:['Review']},payload,evidence:[],hasExternalAction:true,costAccumulated:0,costEstimate:0},{semanticSignal:'clear',semanticReviewCompleted:true}).ok);
 const envelope={action_type:'outreach_send',sender:'demo-sender',recipient:payload.recipient,subject:payload.subject,body:payload.body,attachment_hashes:[],policy_version:'kill-test',approval_id:`demo:${run.id}`};
 const token=`synthetic:${run.id}`,now=Date.now();const approval={approver:'synthetic-owner',decision:'approved',at:new Date(now).toISOString(),expires_at:new Date(now+60000).toISOString(),session_id:run.sessionId,approval_token:token,payload_hash:hashPayload(payload),approval_id:envelope.approval_id,sender:envelope.sender,policy_version:envelope.policy_version,envelope_hash:hashPayload(envelope),token_hash:hashPayload(token)};
 assert(c.approve(run,approval).ok);assert(c.beginDispatch(run,{payload,costAccumulated:0,costEstimate:0}).ok);return {run,payload,envelope,approval};
}
test('kill after asynchronous credential lookup blocks delivery and records KILL',()=>withKill('0',async()=>{
 const x=prepared();let deliveries=0;const transport={deliver(){deliveries++;}};
 const executor=createExecutor({transport,credentialProvider:async()=>{process.env.PROOFPOWERS_KILL='1';return transport;},policyVersion:'kill-test'});
 const result=await executor.execute(x.envelope,{...x,costAccumulated:0,costEstimate:0});
 assert.equal(deliveries,0);assert.equal(result.error.rule,'KILL');assert.equal(result.evidence.credentialProviderAccessed,true);
 const s=c.getRunSnapshot(x.run).data;assert.equal(s.policy.primaryRule,'KILL');assert.equal(s.events.at(-1).event,'KILL_ENGAGED');
}));
test('mock suite backup -> wipe -> restore verifies 12 verdicts, delivery approval hashes and edited-copy tamper',()=>withKill('0',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pp-restore-'));
 const oldRoot=process.env.PROOFPOWERS_STATE_ROOT;process.env.PROOFPOWERS_STATE_ROOT=root;
 try{
 const r=await runCases();const original=persistSuite(r);const b=backup();
 unlinkSync(join(root,'state/state.json'));const restored=restore(b.file);const doc=readState();
 assert.equal(restored.correct,12);assert.equal(restored.hashChain,'PASS');assert.equal(restored.approvalHashes,'PASS');assert.equal(restored.verifiedDeliveries,4);
 assert.deepEqual(doc,original);assert(doc.deliveries.every(o=>o.approvedHash===o.executionHash));
 assert.equal(c.getRunSnapshot(doc.runs[0].state).ok,false); // Restored evidence cannot become an execution handle.
 const edited=structuredClone(doc);edited.runs[0].state.events[0].reason='Edited copy';assert.throws(()=>verifyState(edited),/AUDIT_CHAIN_INVALID/);
 const approval=structuredClone(doc);approval.runs.find(row=>row.state.approval).state.approval.payload_hash='0'.repeat(64);assert.throws(()=>verifyState(approval),/APPROVAL_HASH_INVALID/);
 const execution=structuredClone(doc);execution.runs.find(row=>row.caseId==='C-09').state.execution_hash='0'.repeat(64);assert.throws(()=>verifyState(execution),/EXECUTION_HASH_INVALID/);
 const bad=join(root,'edited.tar.gz'),temp=join(root,'edited');
 const {mkdirSync}=await import('node:fs');mkdirSync(temp);
 writeFileSync(join(temp,'state.json'),JSON.stringify(edited));writeFileSync(join(temp,'SHA256SUMS'),'0'.repeat(64)+'  state.json\n');
 execFileSync('tar',['-czf',bad,'-C',temp,'state.json','SHA256SUMS']);const before=readFileSync(join(root,'state/state.json'));
 assert.throws(()=>restore(bad,root),/BACKUP_HASH_INVALID/);assert.deepEqual(readFileSync(join(root,'state/state.json')),before);
 console.log('RESTORE_TEST runs=12 correct=12 hash-chain=PASS approval=execution(4/4) tamper=DETECTED failed-restore-preserves-state=PASS');
 }finally{
  if(oldRoot===undefined)delete process.env.PROOFPOWERS_STATE_ROOT;else process.env.PROOFPOWERS_STATE_ROOT=oldRoot;
  assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert(basename(root).startsWith('pp-restore-'));assert(!lstatSync(root).isSymbolicLink());
  rmSync(root,{recursive:true,force:true});
 }
}));
