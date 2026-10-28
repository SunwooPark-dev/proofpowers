import net from 'node:net';
let attempts=0;
function deny(){attempts++;throw Error('OFFLINE_ONLY_NETWORK_DENIED');}
globalThis.fetch=async()=>deny();
net.Socket.prototype.connect=deny;
process.on('exit',()=>{console.log(`OFFLINE_GUARD real_network_attempts=${attempts}`);if(attempts)process.exitCode=1;});
