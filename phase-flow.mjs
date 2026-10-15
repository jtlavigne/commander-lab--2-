import {automaticFor} from './turn-settings.mjs';
import {advance,changeStep,draw,untap,ZONES} from './engine.mjs';
import {canRespond,settlePriority} from './casting.mjs';
import {attackError} from './creature-rules.mjs';
import {cardFace} from './card-state.mjs';
import {pendingEntry} from './life-effects.mjs';
import {responseModeFor,wantsResponse} from './response-settings.mjs';

export const turnStamp=g=>g.turn+':'+g.active;
function finishEmptyCombat(g,{automatic}){
 const c=g.combat;
 // Defender history distinguishes no attacks from attackers later removed
 // from combat. Creatures put onto the battlefield attacking add defenders too.
 if(g.step<5||g.step>8||!c?.attackersConfirmed||c.turn!==turnStamp(g)||c.owner!==g.active||c.attackers.length||c.defenders.length||g.stack.length||g.pendingEffect||pendingEntry(g))return 0;
 let skipped=0;
 if(g.step!==8){changeStep(g,8);c.normalDone=true;skipped++;}
 // Enter the end-of-combat step so its effects can still interrupt progression.
 if(!g.stack.length&&!g.pendingEffect&&!pendingEntry(g)){advance(g,{automatic});skipped++;}
 return skipped;
}
// Every local player gets a precombat main-phase decision, even when the
// availability estimate finds no playable cards. Never auto-pass a whole turn.
export function autoPassEmptySteps(g,{automatic=false}={}){
 if(g.players.some(p=>p.librarySearch)||g.result||g.lobby?.status==='waiting'||g.opening?.status==='choosing')return 0;
 let skipped=finishEmptyCombat(g,{automatic});
 if(!g.players.some(p=>ZONES.some(z=>p.zones[z].length)))return skipped;
 let boundaries=0;const limit=Math.min(2024,(g.turnPlan?.steps.length||12)+12);
 for(let n=0;n<limit;n++){
  settlePriority(g);if(g.result)break;if(g.stack.length||g.pendingEffect||pendingEntry(g))break;
  const empty=finishEmptyCombat(g,{automatic});if(empty){skipped+=empty;continue;}
  const player=g.players[g.active],respond=()=>g.players.some((p,owner)=>!p.eliminated&&wantsResponse(g,owner,()=>canRespond(g,owner)));
  if(responseModeFor(g,g.active)==='prompt')break;
  if(g.step===0){if(g.turnUntapStamp!==turnStamp(g)&&player.zones.battlefield.some(c=>c.tapped)){if(!automaticFor(g,g.active,automatic))break;untap(g,g.active);}}
  else if(g.step===2){if(!player.eliminated&&g.turnDrawStamp!==turnStamp(g)){if(!automaticFor(g,g.active,automatic))break;draw(g,g.active);}if(respond())break;}
  else if(g.step===3){if(!player.eliminated)break;}
  else if(g.step===9){if(!player.eliminated&&canRespond(g,g.active,{includeMain:true})||respond())break;}
  else if(g.step===5){if(player.zones.battlefield.some(c=>!attackError(g,g.active,c))||respond())break;}
  else if([6,7].includes(g.step)){if(g.combat?.attackers.length||respond())break;}
  else if(g.step===11){if(player.zones.hand.length>7&&!player.zones.battlefield.some(c=>!c.faceDown&&/You have no maximum hand size\./i.test(cardFace(c).oracle_text||'')))break;if(boundaries)break;boundaries++;}
  else if(respond())break;
  advance(g,{automatic});skipped++;
 }
 return skipped;
}
