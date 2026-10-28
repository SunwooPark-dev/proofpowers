import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hashPayload} from '../policy/engine.mjs';
import {CASES} from '../cases/cases.mjs';
import {REPO_ROOT} from './kill.mjs';
export const stateRoot=()=>resolve(process.env.PROOFPOWERS_STATE_ROOT??REPO_ROOT);
const fail=code=>{throw Object.assign(Error(code),{code});};
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function verifyState(doc){
 if(doc?.schema!=='proofpowers-state-v1'||!Array.isArray(doc.runs)||doc.runs.length!==CASES.length||!Array.isArray(doc.deliveries))fail('INVALID_STATE');
 if(/"approval_token"\s*:|LLM_[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9_-]{20,}|"(?:team_id|billing_id)"\s*:/.test(JSON.stringify(doc)))fail('FORBIDDEN_STATE_DATA');
 const ids=new Set(),runIds=new Set();let approvals=0,events=0;
 for(const row of doc.runs){
  if(!CASES.some(c=>c.id===row.caseId)||ids.has(row.caseId))fail('INVALID_CASE_SET');ids.add(row.caseId);
  const s=row.state;if(!s||runIds.has(s.run_id)||!Array.isArray(s.events)||!s.events.length)fail('INVALID_RUN_STATE');runIds.add(s.run_id);
  let previous=null,stage=null;
  for(const [index,e] of s.events.entries()){
   const {hash,...body}=e;
   if(e.seq!==index+1||e.run_id!==s.run_id||e.prev_hash!==previous||e.state_from!==stage||hashPayload(body)!==hash)fail('AUDIT_CHAIN_INVALID');
   previous=hash;stage=e.state_to;events++;
  }
  if(s.events[0].event!=='RUN_CREATED'||s.state!==stage||s.final_event_hash!==previous)fail('RUN_HEAD_INVALID');
  if(s.bound_inputs_hash!==s.events[0].detail.bound_inputs_hash)fail('BOUND_INPUTS_HASH_INVALID');
  const execution=s.events.filter(e=>e.detail?.execution_hash!==undefined).at(-1)?.detail.execution_hash??null;
  if(s.execution_hash!==execution)fail('EXECUTION_HASH_INVALID');
  const policies=s.events.map(e=>e.detail?.policy).filter(Boolean);
  if(!policies.some(p=>p.verdict===row.verdict&&p.primaryRule===row.primaryRule))fail('VERDICT_NOT_BOUND_TO_AUDIT');
  if(s.policy&&!policies.some(p=>hashPayload(p)===hashPayload(s.policy)))fail('POLICY_NOT_BOUND_TO_AUDIT');
  const a=s.events.find(e=>e.event==='OPERATOR_APPROVED')?.detail.approval??null;
  if(hashPayload(a)!==hashPayload(s.approval))fail('APPROVAL_HASH_INVALID');
  if(a){
   approvals++;
   if(a.payload_hash!==s.payload_hash||![a.payload_hash,a.envelope_hash,a.token_hash].every(digest))fail('APPROVAL_HASH_INVALID');
  }
  const checked=s.events.find(e=>e.event==='DRAFT_CHECKED');
  if(checked&&checked.payload_hash!==s.payload_hash)fail('PAYLOAD_HASH_INVALID');
 }
 const observed=new Set();
 for(const o of doc.deliveries){
  const s=doc.runs.find(r=>r.state.run_id===o.runId)?.state;
  if(!s||observed.has(o.runId)||o.approvalValid!==true||o.controllerState!=='DISPATCHING'||!digest(o.approvedHash)||o.approvedHash!==o.executionHash
    ||s.approval?.payload_hash!==o.approvedHash||s.execution_hash!==o.executionHash
    ||!s.events.some(e=>e.event==='DISPATCH_STARTED'&&e.detail.approval_hash===o.approvedHash&&e.detail.execution_hash===o.executionHash)
    ||!s.events.some(e=>e.event==='PROVIDER_OUTCOME_RECORDED'&&e.state_to==='EXECUTED'))fail('DELIVERY_APPROVAL_HASH_INVALID');
  observed.add(o.runId);
 }
 const correct=doc.runs.filter(r=>CASES.some(c=>c.id===r.caseId&&c.expected===r.verdict&&c.primaryRule===r.primaryRule)).length;
 return {runs:doc.runs.length,correct,events,approvals,verifiedDeliveries:doc.deliveries.length,hashChain:'PASS',approvalHashes:'PASS'};
}
export function writeState(doc,root=stateRoot()){
 verifyState(doc);const directory=resolve(root,'state');
 if(existsSync(directory)&&lstatSync(directory).isSymbolicLink())fail('STATE_SYMLINK_REFUSED');
 mkdirSync(directory,{recursive:true});const target=resolve(directory,'state.json');
 if(existsSync(target)&&lstatSync(target).isSymbolicLink())fail('STATE_SYMLINK_REFUSED');
 const pending=resolve(directory,`state-${randomUUID()}.tmp`);
 writeFileSync(pending,JSON.stringify(doc,null,2)+'\n',{flag:'wx'});renameSync(pending,target);
 return verifyState(doc);
}
export function persistSuite(result,root=stateRoot()){
 const doc={schema:'proofpowers-state-v1',runs:result.rows.map(r=>({caseId:r.id,verdict:r.actual,primaryRule:r.actualRule,state:r.runState})),deliveries:result.calls.filter(c=>c.caseId!=='C-08-ignored')};
 writeState(doc,root);return doc;
}
export function readState(root=stateRoot()){const doc=JSON.parse(readFileSync(resolve(root,'state/state.json'),'utf8'));verifyState(doc);return doc;}
