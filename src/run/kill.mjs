import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

export const REPO_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const runs=new Map();
export function killActive(root=REPO_ROOT){return process.env.PROOFPOWERS_KILL==='1'||existsSync(resolve(root,'KILL'));}
export function registerKillRun(id,engage){runs.set(id,{engage,killed:false});}
export function bindKillBudget(id,budget){const entry=runs.get(id);if(entry)entry.budget=budget;}
export function killBoundary(id,budget){
  const entry=runs.get(id);
  if(!killActive()&&!entry?.killed)return false;
  if(entry)entry.killed=true;
  // Release local reservations only; this does not certify zero provider billing.
  try{(budget??entry?.budget)?.releaseUnsettled();}finally{entry?.engage();}
  return true;
}
export function assertNotKilled(id,budget){
  if(killBoundary(id,budget))throw Object.assign(Error('KILL_ENGAGED'),{code:'KILL_ENGAGED'});
}
