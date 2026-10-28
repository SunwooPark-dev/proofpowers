import {backup} from '../src/run/backup.mjs';
try{console.log(JSON.stringify(backup(),null,2));}catch(e){console.error(['INVALID_STATE','AUDIT_CHAIN_INVALID','APPROVAL_HASH_INVALID'].includes(e.code)?e.code:'BACKUP_FAILED');process.exitCode=1;}
