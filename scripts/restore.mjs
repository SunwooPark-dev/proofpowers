import {relative} from 'node:path';
import {restore} from '../src/run/backup.mjs';
import {stateRoot} from '../src/run/state.mjs';
try{if(process.argv.length!==3)throw Error('RESTORE_FILE_REQUIRED');const result=restore(process.argv[2]);console.log(JSON.stringify({...result,file:relative(stateRoot(),result.file)},null,2));}catch{console.error('RESTORE_REFUSED');process.exitCode=1;}
