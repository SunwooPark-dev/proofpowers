import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {c11Scenario} from '../src/demo/scenario.mjs';

export function runWithoutDemo(){
 const {payload}=c11Scenario('synthetic-without-gate');
 const records=[];
 // Deliberately unsafe, isolated in-memory contrast. Never weaken the real Executor.
 const mockExecutor={execute(value){records.push({status:'LEAKED',recipient:value.recipient,body:value.body});}};
 mockExecutor.execute(payload);
 return {caseId:'C-11-like',payload,records,leaked:records.length,networkCalls:0,realSends:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.env.PP_MODEL_MODE==='live'){console.error('demo:without refused: live mode; this demo is mock-only.');process.exit(1);}
 console.log('[SIMULATED — no gate]');
 const result=runWithoutDemo();
 console.log(`\x1b[31mWARNING: WITHOUT PROOFPOWERS — LEAKED ${result.leaked} fake customer record to ${result.payload.recipient}\x1b[0m`);
 console.log('mock-only; network=0; real-sends=0; production Executor was not invoked');
}
