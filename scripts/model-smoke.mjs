import { createMetaRun } from '../src/model/meta.mjs';
import { plan, review } from '../src/agents/wonder.mjs';
import { draft } from '../src/agents/spark.mjs';
import * as c from '../src/run/controller.mjs';
import { buildReceipt, renderText } from '../src/board/board.mjs';
import { writeFileSync } from 'node:fs';

function saveReceipt(receipt) {
  const index=process.argv.indexOf('--receipt-json');
  if(index<0)return;
  const path=process.argv[index+1];
  if(!path)throw Error('RECEIPT_PATH_REQUIRED');
  writeFileSync(path,JSON.stringify(receipt,null,2)+'\n',{encoding:'utf8',flag:'wx'});
}
function printCall(call) {
  const diagnostics={http_status:call.http_status??null,response:call.response??{status:null,model:null},
    incomplete_details:call.incomplete_details??{reason:null},usage:call.usage,usd_estimate:call.usd_estimate};
  console.log(`${call.role} model=${call.model} mode=${call.mode} status=${call.status} request_hash=${call.request_hash} response_hash=${call.response_hash} diagnostics=${JSON.stringify(diagnostics)}`);
}

async function main() {
  const created=c.createRun({allowedActions:['draft'],allowedRecipients:[],costCap:1});
  if(!created.ok)throw Error('SMOKE_RUN_FAILED');
  const run=created.run,models=createMetaRun({runId:run.id,onRouteEvent:e=>{
    if(!c.recordRouteFallback(run,e).ok)throw Error('ROUTE_EVENT_RECORD_FAILED');
  }});
  try {
  const proposal=await plan({goal:'Prepare demo outreach'},models);
  const body=await draft({goal:proposal.goal,plan:proposal},models);
  const advice=await review({body},models);
  const checked=c.checkPreflight(run,{plan:proposal,payload:{action_type:'draft',body},evidence:[],
    hasExternalAction:false,costAccumulated:0,costEstimate:0},{semanticReviewCompleted:advice.completed,
      ...(advice.completed===false?{}:{semanticSignal:advice.signal})});
  if(!checked.ok||checked.policy.verdict!=='PASS'||!c.seal(run).ok)throw Error('SMOKE_POLICY_FAILED');
  const receipt=buildReceipt({snapshot:c.getRunSnapshot(run),checks:checked.policy,model_calls:models.getCalls()});
  saveReceipt(receipt);
  const calls=receipt.model_calls;
  console.log(`model:smoke mode=${calls[0]?.mode} real_meta_use=${calls.some(c=>c.mode==='live'&&c.status==='success')}`);
  for(const call of calls)printCall(call);
  console.log(`receipt model_calls=${calls.length} sections=4 state=${receipt.state}`);
  console.log(`network: ${calls.some(c=>c.request_attempted)?'ATTEMPTED':'NOT_CALLED'}`);
  if(process.argv.includes('--receipt'))console.log(renderText(receipt));
  } catch(error) {
    const receipt=buildReceipt({snapshot:c.getRunSnapshot(run),model_calls:models.getCalls()});
    const known=new Set(['INVALID_MODEL_PLAN','INVALID_MODEL_DRAFT','SMOKE_POLICY_FAILED','RECEIPT_PATH_REQUIRED']);
    const code=models.getCalls().at(-1)?.error_code??(known.has(error.message)?error.message:'SMOKE_FAILED');
    try{saveReceipt(receipt);}catch{/* Do not overwrite an existing receipt or expose raw errors. */}
    for(const call of receipt.model_calls)printCall(call);
    console.error(`model:smoke error_code=${code}`);process.exitCode=1;
  }
}
main().catch(()=>{console.error('model:smoke FAILED (no raw provider errors logged)');process.exitCode=1;});
