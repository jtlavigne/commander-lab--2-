import {nextLivingSeat} from './game-outcome.mjs';

// Extra turns are inserted immediately after this turn, newest effect first.
// Save the ordinary successor once so an extra turn cannot change table order.
export function addExtraTurns(g,owner,amount){
 if(!g.players[owner]||!Number.isInteger(amount)||amount<0||amount>100)throw Error('Invalid extra-turn amount.');
 g.extraTurns??=[];if(g.extraTurns.length+amount>1000)throw Error('Too many pending extra turns.');
 g.extraTurns.unshift(...Array(amount).fill(owner));
}
export function startNextTurn(g){
 const previous=g.active;
 g.extraTurns=(g.extraTurns||[]).filter(owner=>!g.players[owner].eliminated);
 if(g.extraTurns.length){
  g.normalTurnNext??=nextLivingSeat(g,previous);g.active=g.extraTurns.shift();g.turn++;g.extraTurn=true;
 }else if(g.normalTurnNext!==undefined){
  g.active=g.players[g.normalTurnNext].eliminated?nextLivingSeat(g,(g.normalTurnNext+g.players.length-1)%g.players.length):g.normalTurnNext;
  g.turn++;delete g.normalTurnNext;delete g.extraTurn;
 }else{g.active=nextLivingSeat(g,previous);if(g.active<=previous)g.turn++;}
 // The existing turn stamp is used by loyalty, mana and once-per-turn effects.
 // Extra turns increment its serial even if the same player acts twice.
}
export function phaseOut(g,id){
 const field=g.players.flatMap((p,owner)=>p.zones.battlefield.map(card=>({card,owner}))),root=field.find(f=>f.card.instance===id);if(!root)return;
 const ids=new Set([id]);let changed=true;
 while(changed){changed=false;for(const {card} of field)if(ids.has(card.attachedTo)&&!ids.has(card.instance)){ids.add(card.instance);changed=true;}}
 g.phasedOut??=[];
 for(const {card,owner} of field)if(ids.has(card.instance)){
  g.players[owner].zones.battlefield=g.players[owner].zones.battlefield.filter(c=>c!==card);
  g.phasedOut.push({card,owner,phaseInSeat:root.owner,root:id});
 }
 if(g.combat){g.combat.attackers=g.combat.attackers.filter(a=>!ids.has(a.id));g.combat.blocks=g.combat.blocks.filter(b=>!ids.has(b.blocker)&&!ids.has(b.attacker));g.combat.assignments={};}
}
export function phaseInForTurn(g,seat){
 // No zone changes: attachments, counters, tokens and incarnation IDs survive.
 const returning=(g.phasedOut||[]).filter(item=>item.phaseInSeat===seat);
 for(const {card,owner} of returning)if(!g.players[owner].eliminated)g.players[owner].zones.battlefield.push(card);
 if(g.phasedOut)g.phasedOut=g.phasedOut.filter(item=>item.phaseInSeat!==seat);
}
export function validateTurnEffects(g,fail,checkCard){
 const seat=n=>Number.isInteger(n)&&n>=0&&n<g.players.length;
 if(g.extraTurns!==undefined&&(!Array.isArray(g.extraTurns)||g.extraTurns.length>1000||g.extraTurns.some(n=>!seat(n))))fail();
 if(g.normalTurnNext!==undefined&&!seat(g.normalTurnNext)||g.extraTurn!==undefined&&typeof g.extraTurn!=='boolean')fail();
 if(g.phasedOut!==undefined){if(!Array.isArray(g.phasedOut)||g.phasedOut.length>10000)fail();for(const item of g.phasedOut){if(!item||!seat(item.owner)||!seat(item.phaseInSeat)||typeof item.root!=='string')fail();checkCard(item.card,'battlefield');}}
}
