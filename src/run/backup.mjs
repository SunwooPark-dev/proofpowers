import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,unlinkSync,rmdirSync,existsSync,lstatSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';import {tmpdir} from 'node:os';import {createHash,randomUUID} from 'node:crypto';
import {readState,verifyState,writeState,stateRoot} from './state.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const tar=args=>execFileSync('tar',args,{maxBuffer:20*1024*1024,stdio:['ignore','pipe','pipe']});
export function backup(root=stateRoot()){
 const doc=readState(root),bytes=Buffer.from(JSON.stringify(doc,null,2)+'\n');
 const backups=resolve(root,'backups');
 if(existsSync(backups)&&lstatSync(backups).isSymbolicLink())throw Error('BACKUP_SYMLINK_REFUSED');
 const directory=resolve(backups,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));mkdirSync(directory,{recursive:true});
 const temp=mkdtempSync(join(tmpdir(),'proofpowers-backup-'));
 const file=resolve(directory,'proofpowers-state.tar.gz');
 try{
  writeFileSync(join(temp,'state.json'),bytes);writeFileSync(join(temp,'SHA256SUMS'),sha(bytes)+'  state.json\n');
  tar(['-czf',file,'-C',temp,'state.json','SHA256SUMS']);
 }finally{for(const n of ['state.json','SHA256SUMS'])if(existsSync(join(temp,n)))unlinkSync(join(temp,n));rmdirSync(temp);}
 return {file,sha256:sha(readFileSync(file)),...verifyState(doc)};
}
export function restore(file,root=stateRoot()){
 const source=resolve(file);if(statSync(source).size>20*1024*1024)throw Error('BACKUP_TOO_LARGE');
 const names=tar(['-tzf',source]).toString('utf8').trim().split(/\r?\n/).sort();
 if(JSON.stringify(names)!==JSON.stringify(['SHA256SUMS','state.json']))throw Error('BACKUP_MEMBERS_INVALID');
 const verbose=tar(['-tvzf',source]).toString('utf8').trim().split(/\r?\n/);
 if(verbose.length!==2||verbose.some(line=>!line.startsWith('-')))throw Error('BACKUP_TYPE_INVALID');
 const bytes=tar(['-xOzf',source,'state.json']);const manifest=tar(['-xOzf',source,'SHA256SUMS']).toString('utf8').trim();
 if(manifest!==sha(bytes)+'  state.json')throw Error('BACKUP_HASH_INVALID');
 const doc=JSON.parse(bytes.toString('utf8'));const result=verifyState(doc);
 // Validate completely before replacing durable data; never re-arm execution handles/tokens.
 writeState(doc,root);return {file:source,restored:true,...result};
}
