import { createMetaRun } from '../src/model/meta.mjs';
import { plan, review } from '../src/agents/wonder.mjs';
import { draft } from '../src/agents/spark.mjs';
import * as c from '../src/run/controller.mjs';
import { buildReceipt, renderText } from '../src/board/board.mjs';

async function main() {
  const created=c.createRun({allowedActions:['draft'],allowedRecipients:[],costCap:1});
  if(!created.ok)throw Error('SMOKE_RUN_FAILED');
  const run=created.run,models=createMetaRun({runId:run.id});
  try {
  const proposal=await plan({goal:'Prepare demo outreach'},models);
  const body=await draft({goal:proposal.goal,plan:proposal},models);
  const advice=await review({body},models);
  const checked=c.checkPreflight(run,{plan:proposal,payload:{action_type:'draft',body},evidence:[],
    hasExternalAction:false,costAccumulated:0,costEstimate:0},{semanticSignal:advice.signal});
  if(!checked.ok||checked.policy.verdict!=='PASS'||!c.seal(run).ok)throw Error('SMOKE_POLICY_FAILED');
  const receipt=buildReceipt({snapshot:c.getRunSnapshot(run),checks:checked.policy,model_calls:models.getCalls()});
  const calls=receipt.model_calls;
  console.log(`model:smoke mode=${calls[0]?.mode} real_meta_use=${calls.some(c=>c.mode==='live'&&c.status==='success')}`);
  for(const call of calls)console.log(`${call.role} model=${call.model} mode=${call.mode} status=${call.status} request_hash=${call.request_hash} response_hash=${call.response_hash} usage=${call.usage.source}`);
  console.log(`receipt model_calls=${calls.length} sections=4 state=${receipt.state}`);
  console.log(`network: ${calls.some(c=>c.request_attempted)?'ATTEMPTED':'NOT_CALLED'}`);
  if(process.argv.includes('--receipt'))console.log(renderText(receipt));
  } catch {
    const receipt=buildReceipt({snapshot:c.getRunSnapshot(run),model_calls:models.getCalls()});
    console.error('model:smoke FAILED (failure metadata retained; no raw provider errors)');
    console.log(renderText(receipt));process.exitCode=1;
  }
}
main().catch(()=>{console.error('model:smoke FAILED (no raw provider errors logged)');process.exitCode=1;});
