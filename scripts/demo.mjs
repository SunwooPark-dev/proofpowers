import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import * as controller from '../src/run/controller.mjs';
import {c11Scenario} from '../src/demo/scenario.mjs';
import {runDemo} from '../src/demo/run.mjs';
import {runWithoutDemo} from './demo-without.mjs';

export async function runContrastDemo(){
 const without=runWithoutDemo();
 const initial=c11Scenario('pending');
 const created=controller.createRun(initial.bounds);
 if(!created.ok)throw Error('DEMO_CREATE_FAILED');
 const {run}=created,{payload,plan}=c11Scenario(run.id);
 const checked=controller.checkPreflight(run,{plan,payload,evidence:[],hasExternalAction:true,costAccumulated:0,costEstimate:0.03},
  {primaryUnderTest:'R-02',semanticSignal:'clear',semanticReviewCompleted:true});
 if(!checked.ok)throw Error(checked.error?.code??'DEMO_CHECK_FAILED');
 const c11={payload,verdict:checked.policy.verdict,primaryRule:checked.policy.primaryRule,deliveries:0,
  costEstimateUsd:0.03,costSource:'illustrative_mock_estimate_not_measured',audit:controller.getReceiptData(run).data.events};
 // A blocked C-11 never reaches approval, dispatch, or Executor.
 if(c11.verdict!=='BLOCK'||c11.primaryRule!=='R-02')throw Error('DEMO_SCOPE_GATE_FAILED');
 const demos=[];
 for(const kind of ['pass','block','hold'])demos.push(await runDemo(kind));
 return {without,c11,demos,networkCalls:0,realSends:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const result=await runContrastDemo();
  console.log(`WITH PROOFPOWERS C-11: ${result.c11.verdict}/${result.c11.primaryRule} deliveries=${result.c11.deliveries}`);
  console.log('Cost estimate: ~$0.03 (illustrative mock estimate; no API usage measured)');
  for(const demo of result.demos)console.log(`${demo.verdict}/${demo.rule} demo-deliveries=${demo.deliveries}`);
  console.log('mock-only; network=0; real-sends=0; no state files written');
  console.log(`without: LEAKED ${result.without.leaked} / with: BLOCKED ${result.c11.deliveries} sent`);
 }catch(error){console.error(error.message==='KILL_ENGAGED'?'BLOCK/KILL':'DEMO_FAILED');process.exitCode=1;}
}
