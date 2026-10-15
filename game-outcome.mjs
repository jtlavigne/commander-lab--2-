import {cardFace} from './card-state.mjs';
import {transfer,ZONES} from './engine.mjs';
export const liveSeats=g=>g.players.flatMap((p,seat)=>p.eliminated?[]:[seat]);
export function nextLivingSeat(g,seat){for(let i=1;i<=g.players.length;i++){const next=(seat+i)%g.players.length;if(!g.players[next].eliminated)return next;}return seat;}
export const turnController=g=>g.players[g.active].eliminated?nextLivingSeat(g,g.active):g.active;
export function checkPlayerLosses(g){
 if(g.result||g.pendingEffect||g.lobby?.format==='twoheaded')return false;
 const lost=g.players.flatMap((player,seat)=>{
  if(player.eliminated)return [];
  const failedDraw=player.failedDraw;delete player.failedDraw;
  const protectedPlayer=player.zones.battlefield.some(card=>!card.faceDown&&/You can't lose the game\b/i.test(cardFace(card).oracle_text||''));if(protectedPlayer)return [];
  const commanderFormat=!g.lobby||g.lobby.format==='commander';
  const reason=player.poison>=10?'Ten poison counters':player.life<=0?'Zero life':failedDraw?'Drew from an empty library':commanderFormat&&Object.values(player.commanderDamage??player.damage).some(n=>n>=21)?'Twenty-one commander damage':null;
  return reason?[{seat,reason}]:[];
 });
 if(!lost.length)return false;
 const seats=new Set(lost.map(p=>p.seat)),removed=new Set();
 for(const {seat,reason} of lost){g.players[seat].eliminated={reason};g.players[seat].mana=[];delete g.players[seat].emblems;}
 g.departedCards??=[];
 // Phasing hides permanents from ordinary effects, not from leaving the game.
 if(g.phasedOut)g.phasedOut=g.phasedOut.filter(item=>{
  const owner=item.card.ownerSeat??item.owner;
  if(seats.has(owner)){if(!item.card.token)g.departedCards.push({card:item.card,seat:owner});removed.add(item.card.instance);return false;}
  // Let the ordinary departing-controller path below perform exile cleanup.
  if(seats.has(item.owner)){g.players[item.owner].zones.battlefield.push(item.card);removed.add(item.card.instance);return false;}
  if(seats.has(item.phaseInSeat))item.phaseInSeat=nextLivingSeat(g,item.phaseInSeat);
  return true;
 });
 for(const [seat,player] of g.players.entries())for(const zone of ZONES)player.zones[zone]=player.zones[zone].filter(card=>{
  if(!seats.has(card.ownerSeat??seat))return true;
  if(!card.token)g.departedCards.push({card,seat:card.ownerSeat??seat});removed.add(card.instance);return false;
 });
 g.stack=g.stack.filter(entry=>{
  if(entry.card&&seats.has(entry.card.ownerSeat??entry.owner)){if(!entry.card.token)g.departedCards.push({card:entry.card,seat:entry.card.ownerSeat??entry.owner});removed.add(entry.card.instance);return false;}
  if(seats.has(entry.owner)){if(entry.card){const owner=entry.card.ownerSeat??entry.owner;g.players[owner].zones.exile.push(entry.card);entry.card.faceDown=false;entry.card.tapped=false;}return false;}return true;
 });
 // Objects still controlled by the departing player after control effects end
 // are exiled; ownership is retained for reset and later zone accounting.
 for(const {seat} of lost)for(const card of [...g.players[seat].zones.battlefield])transfer(g,card.instance,'exile',card.ownerSeat??seat);
 for(const player of g.players)for(const card of player.zones.battlefield){if(removed.has(card.attachedTo)){delete card.attachedTo;delete card.attachedBattlefieldId;}if(removed.has(card.loyaltyAttachment))delete card.loyaltyAttachment;}
 if(g.combat){const combat=g.combat;combat.attackers=combat.attackers.filter(a=>!removed.has(a.id)&&!seats.has(a.defender.owner));const attackers=new Set(combat.attackers.map(a=>a.id));combat.blocks=combat.blocks.filter(b=>!removed.has(b.blocker)&&attackers.has(b.attacker));combat.defenders=combat.defenders.filter(seat=>!seats.has(seat));combat.confirmedDefenders=combat.confirmedDefenders.filter(seat=>!seats.has(seat));combat.assignments={};if(combat.stage==='blockers'&&combat.defenders.every(seat=>combat.confirmedDefenders.includes(seat)))combat.stage='review';}
 if(g.priority){if(seats.has(g.priority.seat))g.priority.seat=nextLivingSeat(g,g.priority.seat);g.priority.passes=0;}
 const remaining=liveSeats(g);if(remaining.length===1)winGame(g,remaining[0],'Last player remaining');else if(!remaining.length){g.result={winners:[],draw:true,source:'All remaining players lost simultaneously'};delete g.priority;}
 return true;
}
export function winGame(g,owner,source){
 if(g.result)return;
 for(const [controller,p] of g.players.entries())for(const card of p.zones.battlefield)if(!card.faceDown){const text=cardFace(card).oracle_text||'';if(controller===owner&&/You can't win the game\b/i.test(text)||controller!==owner&&/your opponents can't win the game\b/i.test(text))return;}
 g.result={winners:[owner],source:String(source||'Card effect')};delete g.priority;
}
export function validateOutcome(g){if(g.result&&(!Array.isArray(g.result.winners)||!g.result.winners.length&&!g.result.draw||g.result.winners.length>g.players.length||new Set(g.result.winners).size!==g.result.winners.length||g.result.winners.some(n=>!Number.isInteger(n)||!g.players[n])||typeof g.result.source!=='string'||g.result.source.length>300||g.result.draw!==undefined&&g.result.draw!==true))throw Error('Invalid game result.');}
