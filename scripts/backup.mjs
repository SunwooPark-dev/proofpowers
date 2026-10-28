import {relative} from 'node:path';
import {backup} from '../src/run/backup.mjs';
import {stateRoot} from '../src/run/state.mjs';
try{const result=backup();console.log(JSON.stringify({...result,file:relative(stateRoot(),result.file)},null,2));}catch(e){console.error(['INVALID_STATE','AUDIT_CHAIN_INVALID','APPROVAL_HASH_INVALID'].includes(e.code)?e.code:'BACKUP_FAILED');process.exitCode=1;}
