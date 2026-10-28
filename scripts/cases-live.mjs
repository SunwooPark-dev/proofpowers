import {writeFileSync} from 'node:fs';
import {runCases} from '../src/cases/run.mjs';
import {createRunBudget} from '../src/model/budget.mjs';
import {recordBudgetSettled} from '../src/run/controller.mjs';

const args=process.argv.slice(2);
if(args.length!==4||args[0]!=='--budget-json'||args[2]!=='--receipt-json')throw Error('EXPLICIT_OUTPUT_PATHS_REQUIRED');
if(process.env.PP_MODEL_MODE!=='live')throw Error('EXPLICIT_LIVE_MODE_REQUIRED');
let activeRun;
const budget=createRunBudget({path:args[1],limitUsd:0.60,onSettled:event=>{
  if(!recordBudgetSettled(activeRun,event).ok)throw Error('BUDGET_AUDIT_FAILED');
}});
const result=await runCases({modelMode:'live',budget,includeIgnored:false,
  onRun:run=>{activeRun=run;},onCase:row=>{
    console.log(`${row.id} actual=${row.actual}/${row.actualRule??'-'} model_calls=${row.modelCalls.length} budget_usd=${budget.snapshot().accounted_usd}`);
  }});
const receipt={...result,budget:budget.snapshot(),executor_mode:'mock-in-memory',external_sends:0,
  evidence_boundary:'Live model generation/review with synthetic case attacks and deterministic fixtures. No real external transport. Ignored variant not executed.'};
writeFileSync(args[3],JSON.stringify(receipt,null,2)+'\n',{encoding:'utf8',flag:'wx'});
for(const row of result.rows)console.log(`${row.id} expected=${row.expected}/${row.expectedRule} actual=${row.actual}/${row.actualRule??'-'} correct=${row.correct}`);
console.log(`summary: ${result.correct}/12 hard-gate=${result.hardGate?'PASS':'FAIL'} stopped=${result.stopped} usd_estimate_accounted=${budget.snapshot().accounted_usd} limit=0.60`);
process.exitCode=result.passed?0:1;
