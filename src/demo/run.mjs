import {createRun,checkPreflight,approve,beginDispatch,reportOutcome,seal,getRunSnapshot,recordRouteFallback} from '../run/controller.mjs';
import {createMetaRun} from '../model/meta.mjs';
import {plan,review} from '../agents/wonder.mjs';
import {draft} from '../agents/spark.mjs';
import {createExecutor} from '../envelope/executor.mjs';
import {hashPayload} from '../policy/engine.mjs';
import {buildReceipt,renderText} from '../board/board.mjs';
import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';

const ok=r=>{if(!r.ok)throw Error('DEMO_STEP_FAILED');return r;};
export async function runDemo(kind){
  if(!['pass','hold','block'].includes(kind))throw Error('INVALID_DEMO');
  const bounds={allowedActions:['outreach_send'],allowedRecipients:['demo@example.test'],costCap:1};
  const run=ok(createRun(bounds)).run;let deliveries=0;
  const models=createMetaRun({runId:run.id,mode:'mock',mockFailures:kind==='hold'?['wonder.plan']:[],onRouteEvent:e=>ok(recordRouteFallback(run,e))});
  const proposal=await plan({goal:'Prepare demo outreach'},models);
  let body=await draft({goal:proposal.goal,plan:proposal},models);if(kind==='block')body+=' Revenue increased 300%.';
  const advice=await review({body},models);
  const payload={run_id:run.id,action_type:'outreach_send',recipient:'demo@example.test',subject:'Synthetic demo',body,attachments:[],bound_inputs_hash:hashPayload(bounds)};
  const checked=ok(checkPreflight(run,{plan:proposal,payload,evidence:[],hasExternalAction:true,costAccumulated:0,costEstimate:0},{semanticSignal:advice.signal,semanticReviewCompleted:advice.completed}));
  let outcome;
  if(checked.policy.verdict==='PASS'){
    const envelope={action_type:'outreach_send',sender:'demo-sender',recipient:payload.recipient,subject:payload.subject,body,attachment_hashes:[],policy_version:'demo-fixed',approval_id:`demo:${run.id}`};
    const token=`demo-fixture:${run.id}`,now=Date.now();
    const approval={approver:'synthetic-demo-operator',decision:'approved',at:new Date(now).toISOString(),expires_at:new Date(now+3600000).toISOString(),session_id:run.sessionId,approval_token:token,payload_hash:hashPayload(payload),approval_id:envelope.approval_id,sender:envelope.sender,policy_version:envelope.policy_version,envelope_hash:hashPayload(envelope),token_hash:hashPayload(token)};
    ok(approve(run,approval));ok(beginDispatch(run,{costAccumulated:0,costEstimate:0}));
    const transport={deliver(){deliveries++;return{status:'delivered',accepted:true,confirmed:true,reference:`demo:${run.id}`};}};
    const executor=createExecutor({transport,credentialProvider:()=>transport,policyVersion:'demo-fixed'});
    outcome=await executor.execute(envelope,{run,approval,payload,costAccumulated:0,costEstimate:0});ok(reportOutcome(run,outcome.outcome,outcome.evidence));
  }
  if(checked.policy.verdict!=='HELD')ok(seal(run));
  const receipt=buildReceipt({snapshot:getRunSnapshot(run),checks:checked.policy,model_calls:models.getCalls(),...(outcome?{executorResult:outcome}:{})});
  return{kind,verdict:checked.policy.verdict,rule:checked.policy.primaryRule,deliveries,receipt};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  runDemo(process.argv[2]).then(r=>{
    const expected={pass:'PASS',hold:'HELD',block:'BLOCK'}[r.kind];
    console.log(`DEMO ${r.kind.toUpperCase()} actual=${r.verdict}/${r.rule} demo-deliveries=${r.deliveries} mode=mock`);
    console.log(renderText(r.receipt));if(r.verdict!==expected)process.exitCode=1;
  }).catch(()=>{console.error('DEMO_FAILED');process.exitCode=1;});
}
