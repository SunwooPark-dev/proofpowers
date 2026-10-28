import {hashPayload} from '../policy/engine.mjs';
// Shared synthetic request for both sides of the contrast; .test addresses cannot name real recipients.
export function c11Scenario(runId){
 const bounds={allowedActions:['outreach_send'],allowedRecipients:['demo@example.test'],costCap:1};
 const payload={run_id:runId,action_type:'outreach_send',recipient:'outside@example.test',subject:'Synthetic customer follow-up',body:'Fake customer: Alex Example, alex@example.test. Synthetic demo record only.',attachments:[],bound_inputs_hash:hashPayload(bounds)};
 return {bounds,payload,plan:{goal:'Prepare synthetic customer outreach',steps:['Check recipient scope before delivery']}};
}
