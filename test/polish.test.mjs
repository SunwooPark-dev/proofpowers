import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';import {tmpdir,homedir} from 'node:os';import {join,resolve,isAbsolute} from 'node:path';import {spawnSync} from 'node:child_process';
import {runCases} from '../src/cases/run.mjs';
import {persistSuite} from '../src/run/state.mjs';
import {REPO_ROOT} from '../src/run/kill.mjs';
const run=(script,args,env)=>spawnSync(process.execPath,[resolve(REPO_ROOT,script),...args],{encoding:'utf8',env:{...process.env,...env}});
const tempRoot=()=>mkdtempSync(join(tmpdir(),'pp-polish-'));
const cleanup=root=>rmSync(root,{recursive:true,force:true});
const evidencePath=resolve(REPO_ROOT,'evidence/gate-latency.json');
test('demo last line uses the WITH ProofPowers closing wording',()=>{
 const root=tempRoot();
 try{
  const out=run('scripts/demo.mjs',[],{PROOFPOWERS_STATE_ROOT:root});
  assert.equal(out.status,0);
  const lines=out.stdout.trim().split('\n');
  assert.equal(lines.at(-1),'without: LEAKED 1 / WITH ProofPowers: BLOCKED — 0 records sent');
 }finally{cleanup(root);}
});
test('demo:pass with kill switch prints the skip message and exits non-zero',()=>{
 const root=tempRoot();
 try{
  const out=run('src/demo/run.mjs',['pass'],{PROOFPOWERS_KILL:'1',PROOFPOWERS_STATE_ROOT:root});
  assert.notEqual(out.status,0);
  assert.ok(out.stdout.includes('DEMO PASS skipped: kill switch active (BLOCK/KILL)'));
  assert.ok(!out.stdout.includes('DEMO PASS actual='));
 }finally{cleanup(root);}
});
test('demo:pass without kill switch still reports PASS and exits zero',()=>{
 const root=tempRoot();
 try{
  const out=run('src/demo/run.mjs',['pass'],{PROOFPOWERS_KILL:'0',PROOFPOWERS_STATE_ROOT:root});
  assert.equal(out.status,0);
  assert.ok(out.stdout.includes('DEMO PASS actual=PASS'));
 }finally{cleanup(root);}
});
test('backup/restore CLIs print state-root-relative paths, never absolute paths',async()=>{
 const root=tempRoot();const old=process.env.PROOFPOWERS_STATE_ROOT;process.env.PROOFPOWERS_STATE_ROOT=root;
 try{
  const r=await runCases();persistSuite(r);
  const bout=run('scripts/backup.mjs',[],{PROOFPOWERS_STATE_ROOT:root});
  assert.equal(bout.status,0);
  const bjson=JSON.parse(bout.stdout);
  assert.equal(isAbsolute(bjson.file),false);assert.ok(bjson.file.startsWith('backups/'));
  assert.ok(!bout.stdout.includes(root));assert.ok(!bout.stdout.includes(homedir()));
  const rout=run('scripts/restore.mjs',[resolve(root,bjson.file)],{PROOFPOWERS_STATE_ROOT:root});
  assert.equal(rout.status,0);
  const rjson=JSON.parse(rout.stdout);
  assert.equal(rjson.restored,true);assert.equal(isAbsolute(rjson.file),false);assert.ok(rjson.file.startsWith('backups/'));
  assert.ok(!rout.stdout.includes(root));assert.ok(!rout.stdout.includes(homedir()));
 }finally{
  if(old===undefined)delete process.env.PROOFPOWERS_STATE_ROOT;else process.env.PROOFPOWERS_STATE_ROOT=old;
  cleanup(root);
 }
});
test('bench:gate defaults to the state root and leaves evidence untouched',()=>{
 const root=tempRoot();
 try{
  const before=readFileSync(evidencePath);
  const out=run('scripts/bench-gate.mjs',[],{PROOFPOWERS_STATE_ROOT:root});
  assert.equal(out.status,0);
  const doc=JSON.parse(readFileSync(join(root,'gate-latency.json'),'utf8'));
  assert.equal(doc.schema,'proofpowers-gate-latency-v1');assert.equal(doc.runs,1000);
  assert.deepEqual(readFileSync(evidencePath),before);
 }finally{cleanup(root);}
});
test('bench:gate --out writes only to the given path',()=>{
 const root=tempRoot();
 try{
  const target=join(root,'custom','out.json');
  const out=run('scripts/bench-gate.mjs',['--out',target],{PROOFPOWERS_STATE_ROOT:root});
  assert.equal(out.status,0);
  const doc=JSON.parse(readFileSync(target,'utf8'));
  assert.equal(doc.schema,'proofpowers-gate-latency-v1');assert.equal(doc.runs,1000);
  assert.equal(existsSync(join(root,'gate-latency.json')),false);
 }finally{cleanup(root);}
});
test('bench:gate --write-evidence overwrites evidence only',()=>{
 const root=tempRoot();const before=readFileSync(evidencePath);
 try{
  const out=run('scripts/bench-gate.mjs',['--write-evidence'],{PROOFPOWERS_STATE_ROOT:root});
  assert.equal(out.status,0);
  const doc=JSON.parse(readFileSync(evidencePath,'utf8'));
  assert.equal(doc.schema,'proofpowers-gate-latency-v1');assert.equal(doc.runs,1000);
  assert.equal(existsSync(join(root,'gate-latency.json')),false);
 }finally{writeFileSync(evidencePath,before);cleanup(root);}
});
