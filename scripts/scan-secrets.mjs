import {readdirSync,readFileSync} from 'node:fs';import {resolve,join,relative} from 'node:path';
const root=resolve(process.argv[2]??'.');let scanned=0;const findings=[];
const patterns=[/LLM_[A-Za-z0-9_-]{15,}/,/sk-[A-Za-z0-9_-]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/,/(?:team[_-]?id|billing[_-]?id)["'\s:=]+[A-Za-z0-9_-]{8,}/i,/Bearer\s+[A-Za-z0-9_-]{16,}/];
function visit(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
  if(e.isSymbolicLink())continue;
  if(e.name==='.git'||e.name==='node_modules')continue;
  const p=join(dir,e.name),name=relative(root,p).replaceAll('\\','/');
  if(e.isDirectory()){visit(p);continue;}if(!e.isFile())continue;
  scanned++;if(/^\.env(?:\.|$)/.test(e.name)||/^(?:id_rsa|id_ed25519|credentials(?:\.json)?|secrets\.json)$/.test(e.name))findings.push({file:name,rule:'SENSITIVE_FILENAME'});
  const bytes=readFileSync(p);if(bytes.includes(0))continue;const s=bytes.toString('utf8');
  patterns.forEach((pattern,i)=>{if(pattern.test(s))findings.push({file:name,rule:`SECRET_PATTERN_${i+1}`});});
}}
visit(root);console.log(JSON.stringify({scanned_files:scanned,findings,match_count:findings.length,git_history:'NOT_SCANNED',note:'Pattern scan only; values never printed; Git history and provider/account verification excluded'}));process.exitCode=findings.length?1:0;
