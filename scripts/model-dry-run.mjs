import {pathToFileURL} from 'node:url';
import {createMetaRun,ROLE_MODELS} from '../src/model/meta.mjs';
import {createRunBudget} from '../src/model/budget.mjs';
import {plan,review} from '../src/agents/wonder.mjs';
import {draft} from '../src/agents/spark.mjs';

// Mock-derived input sizes only: live generated plan/draft lengths are unknown.
export async function dryRun() {
  const base=createMetaRun({mode:'mock'}),rows=[];
  const adapter={...base,callMeta:async request=>{
    const b=createRunBudget(),id=b.reserve({role:request.role,model:ROLE_MODELS[request.role],messages:request.messages,maxOutputTokens:2048});
    const r=b.snapshot().requests.find(r=>r.id===id);
    rows.push({role:request.role,model:r.model,input_token_upper:r.input_token_upper,max_output_tokens:r.max_output_tokens,reserved_nanos:r.reserved_nanos,reserved_usd:r.reserved_nanos/1e9});
    return base.callMeta(request);
  }};
  const proposal=await plan({goal:'Prepare demo outreach'},adapter);
  const body=await draft({goal:proposal.goal,plan:proposal},adapter);
  await review({body},adapter);
  const total=rows.reduce((n,r)=>n+r.reserved_nanos,0)/1e9;
  return {mode:'dry-run-mock-inputs',network_calls:0,limit_usd:0.10,calls:rows,
    all_unsettled_reserved_usd:total,all_unsettled_within_limit:total<=0.10,
    each_call_individually_within_limit:rows.every(r=>r.reserved_usd<=0.10),
    sequential_live_fit:'UNKNOWN_REQUIRES_ACTUAL_USAGE_SETTLEMENT',
    note:'No usage or cost fabricated. Full output reservations may exceed the cap together; sequential settlement can free headroom. Live input lengths may differ.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await dryRun(),null,2));
