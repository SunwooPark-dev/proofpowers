import {restore} from '../src/run/backup.mjs';
try{if(process.argv.length!==3)throw Error('RESTORE_FILE_REQUIRED');console.log(JSON.stringify(restore(process.argv[2]),null,2));}catch{console.error('RESTORE_REFUSED');process.exitCode=1;}
