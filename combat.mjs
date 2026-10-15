import {findCard,note,transfer} from './engine.mjs';
import {gainLife} from './resource-rules.mjs';
import {refreshPairs} from './soulbond.mjs';
import {cardFace} from './card-state.mjs';
import {fieldCards,isCreature,keywordSet,summoningSick,combatStats,attackError,attackTargetError,exertAbility,mustAttack,blockError,blockCapacity,protectedFrom,combatRecipient} from './creature-rules.mjs';
import {snapshotCard,queueCombatTriggers,deathDestinations,moveDeadPermanent} from './combat-effects.mjs';
import {pendingLifeEntry} from './life-effects.mjs';
import {attachmentLegal,isAura} from './attachments.mjs';
import {checkPlayerLosses} from './game-outcome.mjs';
import {addPlayerCounter} from './player-counters.mjs';
import {chooseDestructionReplacement} from './destruction.mjs';

export {summoningSick,combatStats,attackError,blockError};
const stamp=g=>g.turn+':'+g.active;
const incarnation=card=>card.battlefieldId||null;
const live=(g,id,version)=>{const found=findCard(g,id);return found?.zone==='battlefield'&&(version===undefined||incarnation(found.card)===version)?found:null;};
const ready=g=>{if(g.stack.length||g.pendingEffect||pendingLifeEntry(g))throw Error('Resolve the stack and pending effects first.');};
export function attackTargets(g){return g.players.flatMap((p,owner)=>owner===g.active||p.eliminated?[]:[{key:'player:'+owner,kind:'player',owner,label:p.name},...p.zones.battlefield.filter(c=>!c.faceDown&&/Planeswalker/.test(cardFace(c).type_line||'')).map(card=>({key:'card:'+card.instance,kind:'card',id:card.instance,battlefieldId:incarnation(card),owner,label:p.name+' · '+card.name}))]);}
export function startCombat(g){
 ready(g);g.combatsThisTurn=g.combatsThisTurn?.turn===stamp(g)?{turn:stamp(g),count:g.combatsThisTurn.count+1}:{turn:stamp(g),count:1};g.combat={id:crypto.randomUUID(),turn:stamp(g),owner:g.active,stage:'beginning',attackers:[],blocks:[],attackersConfirmed:false,defenders:[],confirmedDefenders:[],assignments:{},deathChoices:{},firstDone:false,normalDone:false};
 queueCombatTriggers(g,[{kind:'begin-combat',owner:g.active}]);note(g,'Beginning of combat.');return g.combat;
}
export function assertCombatStep(g,step){
 const c=g.combat;if(!c||c.turn!==stamp(g)||c.stage==='complete')return;
 if(step===6&&!c.attackersConfirmed&&c.stage==='attackers')throw Error('Confirm attackers before declaring blockers.');
 if(step===7&&(!c.attackersConfirmed||c.defenders.some(owner=>!c.confirmedDefenders.includes(owner))))throw Error('Every defending player must confirm blockers before damage.');
 if((step>=8||step<4)&&c.attackersConfirmed&&c.attackers.length&&!c.normalDone)throw Error('Review and apply combat damage before leaving combat.');
 if(step<=5&&c.attackersConfirmed&&g.step!==step)throw Error('Attackers are already declared. Finish this combat first.');
}
export function enterCombatStep(g,step){
 if(step===1||step===10)queueCombatTriggers(g,[{kind:step===1?'upkeep':'end-step',owner:g.active}]);
 if(step===4){if(!g.combat||g.combat.stage==='complete'||g.combat.turn!==stamp(g))startCombat(g);}
 if(step===5){if(!g.combat||g.combat.turn!==stamp(g)||g.combat.stage==='complete')startCombat(g);const c=g.combat;if(!c.attackersConfirmed){c.stage='attackers';const target=attackTargets(g)[0];for(const card of g.players[g.active].zones.battlefield)if(target&&mustAttack(g,g.active,card)&&!c.attackers.some(a=>a.id===card.instance))c.attackers.push({id:card.instance,battlefieldId:incarnation(card),defender:{...(attackTargets(g).find(t=>!attackTargetError(g,card,t))||target)},required:true,blocked:false});if(!g.players[g.active].zones.battlefield.some(card=>!attackError(g,g.active,card)))c.attackersConfirmed=true;}}
 if(step===6&&g.combat){g.combat.stage=g.combat.defenders.length?'blockers':'review';}
 if(step===7&&g.combat){const c=g.combat;c.stage='damage';c.firstStrikeIds??=[...new Set([...c.attackers.map(a=>a.id),...c.blocks.map(b=>b.blocker)])].filter(id=>{const f=live(g,id);return f&&[...keywordSet(g,f.owner,f.card)].some(k=>['first strike','double strike'].includes(k));});if(!c.attackers.length){c.normalDone=true;c.stage='complete';}}
 if(step===8&&g.combat){g.combat.stage='complete';queueCombatTriggers(g,[{kind:'end-combat',owner:g.active}]);}
}
export function setAttacker(g,id,targetKey,selected=true,{exert}={}){
 ready(g);const c=g.combat;if(g.step!==5||c?.stage!=='attackers'||c.attackersConfirmed)throw Error('Declare attackers during the attackers step.');
 const found=live(g,id);if(!found)throw Error('Creature not found.');const error=attackError(g,found.owner,found.card);if(error)throw Error(error);
 const index=c.attackers.findIndex(a=>a.id===id);if(!selected){if(mustAttack(g,found.owner,found.card))throw Error('This creature must attack if able.');if(index>=0)c.attackers.splice(index,1);return;}
 const target=attackTargets(g).find(t=>t.key===targetKey);if(!target)throw Error('Choose an opponent or an opposing planeswalker.');
 const targetError=attackTargetError(g,found.card,target);if(targetError)throw Error(targetError);
 exert??=index>=0?!!c.attackers[index].exert:false;
 if(typeof exert!=='boolean'||exert&&(!exertAbility(found.card)||found.card.exertedTurn===stamp(g)))throw Error('This creature cannot be exerted again this turn.');
 const attack={id,battlefieldId:incarnation(found.card),defender:{...target},required:mustAttack(g,found.owner,found.card),blocked:false,...(exert?{exert:true}:{})};if(index<0)c.attackers.push(attack);else c.attackers[index]=attack;
}
export function confirmAttackers(g){
 ready(g);const c=g.combat;if(g.step!==5||c?.stage!=='attackers'||c.attackersConfirmed)throw Error('Attackers are not being declared.');
 for(const card of g.players[g.active].zones.battlefield)if(mustAttack(g,g.active,card)&&!c.attackers.some(a=>a.id===card.instance))throw Error(card.name+' must attack.');
 for(const attack of c.attackers){const found=live(g,attack.id,attack.battlefieldId);if(!found||attackError(g,found.owner,found.card))throw Error('An attacker is no longer eligible.');if(!attackTargets(g).some(t=>t.key===attack.defender.key)||attackTargetError(g,found.card,attack.defender))throw Error('An attack target is no longer legal.');if(attack.exert&&(!exertAbility(found.card)||found.card.exertedTurn===stamp(g)))throw Error('This creature cannot be exerted again this turn.');}
 if(c.attackers.length){if(g.attackDeclarations?.turn!==stamp(g))g.attackDeclarations={turn:stamp(g),owners:[]};if(!g.attackDeclarations.owners.includes(g.active))g.attackDeclarations.owners.push(g.active);}
 c.attackersConfirmed=true;c.defenders=[...new Set(c.attackers.map(a=>a.defender.owner))];
 c.attackedOpponents=[...new Set(c.attackers.map(a=>a.defender.owner))];
 const events=[];for(const a of c.attackers){const {card,owner}=live(g,a.id,a.battlefieldId);if(!keywordSet(g,owner,card).has('vigilance'))card.tapped=true;card.attackHistory=card.attackHistory?.turn===stamp(g)?{...card.attackHistory,count:card.attackHistory.count+1}:{turn:stamp(g),count:1};if(a.defender.kind==='player')card.attackHistory.players=[...new Set([...(card.attackHistory.players||[]),a.defender.owner])];if(a.exert){card.exertedTurn=stamp(g);card.skipNextUntap=true;events.push({kind:'exert',card:snapshotCard(card),owner});}events.push({kind:'attack',card:snapshotCard(card),owner,defender:a.defender.owner,defenderTarget:{...a.defender},attackedOpponents:[...c.attackedOpponents]});}
 queueCombatTriggers(g,events);note(g,c.attackers.length+' attackers declared.');
}
export function setBlocker(g,owner,blockerId,attackerId,selected=true){
 ready(g);const c=g.combat;if(g.step!==6||!c?.attackersConfirmed||c.confirmedDefenders.includes(owner))throw Error('This player is not declaring blockers.');
 if(!c.defenders.includes(owner))throw Error('This player is not defending.');const index=c.blocks.findIndex(b=>b.blocker===blockerId&&b.attacker===attackerId);if(!selected){if(index>=0)c.blocks.splice(index,1);c.assignments={};return;}
 const blocker=live(g,blockerId),attack=c.attackers.find(a=>a.id===attackerId),attacker=attack&&live(g,attack.id,attack.battlefieldId);if(!blocker||!attacker)throw Error('Combat creature no longer available.');
 const error=blockError(g,owner,blocker.card,attacker.card,attack.defender.owner);if(blocker.owner!==owner||error)throw Error(error||'Use your own blockers.');
 if(index>=0)return;if(c.blocks.filter(b=>b.blocker===blockerId).length>=blockCapacity(blocker.card))throw Error('This creature is already blocking its maximum number of attackers.');
 const limit=c.blockLimits?.[owner];if(limit!==undefined&&new Set(c.blocks.filter(b=>b.owner===owner).map(b=>b.blocker)).size>=limit&&!c.blocks.some(b=>b.blocker===blockerId))throw Error('Only '+limit+' creature(s) can block for this player this combat.');
 c.blocks.push({blocker:blockerId,battlefieldId:incarnation(blocker.card),attacker:attackerId,owner});c.assignments={};
}
export function blockController(g,defender){const chosen=g.blockingRules?.turn===stamp(g)?g.blockingRules.controllers[defender]:defender;return g.players[chosen]?.eliminated?defender:chosen;}
export function controlledBlockerSeat(g,actor,id){const found=live(g,id);if(!found||blockController(g,found.owner)!==actor)throw Error('Another player chooses these blockers.');return found.owner;}
function requiredBlockError(g,owner){
 if(g.blockingRules?.turn!==stamp(g)||!g.blockingRules.must[owner])return '';
 const c=g.combat,used=new Set(c.blocks.filter(b=>b.owner===owner).map(b=>b.blocker)),limit=c.blockLimits?.[owner]??g.players[owner].zones.battlefield.length,normal=new Set(),menace=[];
 for(const attack of c.attackers.filter(a=>a.defender.owner===owner)){
  const attacker=live(g,attack.id,attack.battlefieldId);if(!attacker)continue;
  const eligible=g.players[owner].zones.battlefield.filter(card=>!blockError(g,owner,card,attacker.card,owner)).map(card=>card.instance);
  if(keywordSet(g,g.active,attacker.card).has('menace')){if(eligible.length>=2)menace.push(eligible);}else for(const id of eligible)normal.add(id);
 }
 // A declaration must satisfy as many requirements as possible, even when
 // doing so means moving a current blocker to support a menace pair.
 // Equal or contained neighborhoods need no separate search branch.
 const groups=menace.filter((ids,index)=>!menace.some((other,j)=>j!==index&&ids.every(id=>other.includes(id))&&(other.length>ids.length||j<index)));
 const feasible=selected=>{const matched=new Map(),slots=selected.flatMap(ids=>[ids,ids]);
  const assign=(slot,seen)=>{for(const id of slots[slot])if(!seen.has(id)){seen.add(id);if(!matched.has(id)||assign(matched.get(id),seen)){matched.set(id,slot);return true;}}return false;};
  return slots.length<=limit&&slots.every((_,i)=>assign(i,new Set()));
 };
 const better=(index,selected,eligible)=>{
  if(selected.length*2>limit||!feasible(selected))return false;
  if(Math.min(limit,eligible.size)>used.size)return true;
  if(Math.min(limit,new Set([...eligible,...groups.slice(index).flat()]).size)<=used.size)return false;
  for(let i=index;i<groups.length;i++)if(better(i+1,[...selected,groups[i]],new Set([...eligible,...groups[i]])))return true;
  return false;
 };
 return better(0,[],normal)?'Creatures must block this turn if able. Assign the remaining eligible blockers.':'';
}
export function confirmBlockers(g,owner){
 ready(g);const c=g.combat;if(g.step!==6||!c?.defenders.includes(owner)||c.confirmedDefenders.includes(owner))throw Error('This player is not declaring blockers.');
 for(const a of c.attackers.filter(a=>a.defender.owner===owner)){const attacker=live(g,a.id,a.battlefieldId);if(!attacker)continue;const blocks=c.blocks.filter(b=>b.attacker===a.id);for(const b of blocks){const blocker=live(g,b.blocker,b.battlefieldId);if(!blocker||blockError(g,owner,blocker.card,attacker.card,owner))throw Error('A block is no longer legal.');}
  if(blocks.length===1&&keywordSet(g,g.active,attacker.card).has('menace'))throw Error(attacker.card.name+' needs at least two blockers or no blockers.');
 }
 const required=requiredBlockError(g,owner);if(required)throw Error(required);
 c.confirmedDefenders.push(owner);if(c.defenders.every(o=>c.confirmedDefenders.includes(o))){for(const a of c.attackers)a.blocked=c.blocks.some(b=>b.attacker===a.id);c.stage='review';queueCombatTriggers(g,c.blocks.filter(b=>!b.enteredBlocking).flatMap(b=>{const f=live(g,b.blocker),a=live(g,b.attacker);return f&&a?[{kind:'block',owner:f.owner,card:snapshotCard(f.card),attacker:{id:a.card.instance,battlefieldId:a.card.battlefieldId||null}}]:[];}));}note(g,g.players[owner].name+' confirms blockers.');
}
const targetKey=target=>target.kind==='player'?'player:'+target.owner:'card:'+target.id;
const strikeIds=g=>g.combat?.firstStrikeIds??[...new Set([...(g.combat?.attackers||[]).map(a=>a.id),...(g.combat?.blocks||[]).map(b=>b.blocker)])].filter(id=>{const f=live(g,id);return f&&[...keywordSet(g,f.owner,f.card)].some(k=>k==='first strike'||k==='double strike');});
export function damagePhase(g){return strikeIds(g).length&&!g.combat?.firstDone?'first':'normal';}
export function damageSources(g,phase=damagePhase(g)){
 const c=g.combat;if(!c)return [];const result=[];
 const participates=(found)=>{const k=keywordSet(g,found.owner,found.card);return phase==='first'?k.has('first strike')||k.has('double strike'):!strikeIds(g).includes(found.card.instance)||k.has('double strike');};
 for(const attack of c.attackers){const found=live(g,attack.id,attack.battlefieldId);if(!found||found.owner!==g.active||!isCreature(found.card)||!participates(found))continue;
  const blockers=c.blocks.filter(b=>b.attacker===attack.id).map(b=>live(g,b.blocker,b.battlefieldId)).filter(f=>f&&isCreature(f.card));const keywords=keywordSet(g,found.owner,found.card),targets=blockers.map(f=>({kind:'card',id:f.card.instance,owner:f.owner,label:f.card.name}));
  if((!attack.blocked&&!c.blocks.some(b=>b.attacker===attack.id)||keywords.has('trample'))&&(attack.defender.kind==='player'||live(g,attack.defender.id,attack.defender.battlefieldId)))targets.push({...attack.defender});
  result.push({id:attack.id,owner:found.owner,card:found.card,power:combatStats(g,found.owner,found.card)?.power,targets,blockers:blockers.map(f=>f.card.instance),trample:keywords.has('trample'),deathtouch:keywords.has('deathtouch'),attacker:true});
 }
 for(const id of new Set(c.blocks.map(b=>b.blocker))){const block=c.blocks.find(b=>b.blocker===id),found=live(g,id,block.battlefieldId);if(!found||!isCreature(found.card)||!participates(found))continue;const targets=c.blocks.filter(b=>b.blocker===id).flatMap(b=>{const attack=c.attackers.find(a=>a.id===b.attacker),f=attack&&live(g,attack.id,attack.battlefieldId);return f&&isCreature(f.card)?[{kind:'card',id:f.card.instance,owner:f.owner,label:f.card.name}]:[];});result.push({id,owner:found.owner,card:found.card,power:combatStats(g,found.owner,found.card)?.power,targets,blockers:[],trample:false,deathtouch:keywordSet(g,found.owner,found.card).has('deathtouch'),attacker:false});}
 return result;
}
function lethal(g,id,deathtouch){const f=live(g,id);if(!f)return 0;const stats=combatStats(g,f.owner,f.card);return Math.max(0,deathtouch?1:(stats?.toughness||0)-(f.card.markedDamage||0));}
export function assignmentFor(g,source,phase=damagePhase(g)){
 const power=Math.max(0,source.power);if(!Number.isFinite(power))throw Error('Set power and toughness for '+source.card.name+' before damage.');
 const saved=g.combat.assignments?.[phase]?.[source.id];if(saved)return saved;
 let remaining=power;return source.targets.map((target,index)=>{let amount;if(index===source.targets.length-1)amount=remaining;else amount=Math.min(remaining,target.kind==='card'?lethal(g,target.id,source.deathtouch):remaining);remaining-=amount;return {target:targetKey(target),amount};});
}
export function setDamageAssignment(g,owner,id,amounts,phase=damagePhase(g)){
 ready(g);if(!g.combat||!['review','damage'].includes(g.combat.stage))throw Error('Confirm all blockers before assigning damage.');const source=damageSources(g,phase).find(s=>s.id===id);if(!source||source.owner!==owner)throw Error('Assign damage for a creature you control.');validateAssignment(g,source,amounts);g.combat.assignments[phase]??={};g.combat.assignments[phase][id]=structuredClone(amounts);
}
function validateAssignment(g,source,amounts){
 if(!Array.isArray(amounts)||amounts.length!==source.targets.length||amounts.some(a=>!source.targets.some(t=>targetKey(t)===a.target)||!Number.isSafeInteger(a.amount)||a.amount<0)||new Set(amounts.map(a=>a.target)).size!==amounts.length)throw Error('Use whole-number damage for each available recipient.');
 if(source.targets.length&&amounts.reduce((n,a)=>n+a.amount,0)!==Math.max(0,source.power))throw Error('Assign all of '+source.card.name+'’s power.');
 const defending=source.targets.find(t=>!source.blockers.includes(t.id));if(source.attacker&&source.trample&&defending&&(amounts.find(a=>a.target===targetKey(defending))?.amount||0)>0&&source.blockers.some(id=>(amounts.find(a=>a.target==='card:'+id)?.amount||0)<lethal(g,id,source.deathtouch)))throw Error('Assign lethal damage to every blocker before trampling over.');
}
function applyDamageBatch(g,phase){
 const packets=[];for(const source of damageSources(g,phase)){const assignment=assignmentFor(g,source,phase);validateAssignment(g,source,assignment);for(const a of assignment)if(a.amount>0){const target=source.targets.find(t=>targetKey(t)===a.target);packets.push({source,target,amount:a.amount});}}return dealDamagePackets(g,packets,true);
}
export function dealDamagePackets(g,packets,combat=false){
 const events=[];
 const unpreventable=p=>combat&&fieldCards(g).some(({card,owner})=>!card.faceDown&&owner===p.source.owner&&isCreature(p.source.card)&&/Combat damage that would be dealt by creatures you control can't be prevented\./i.test(rulesTextSafe(card)));
 packets=packets.filter(p=>{
  if(p.amount<=0||g.players[p.target.owner]?.eliminated)return false;if(unpreventable(p))return true;
  const recipient=p.target.kind==='card'&&live(g,p.target.id);if(!recipient)return true;
  if(protectedFrom(g,p.target.owner,recipient.card,p.source.card))return false;
  return !combat||!fieldCards(g).some(({card:source,owner})=>!source.faceDown&&(source.oracle_text||'').split('\n').some(text=>{const match=text.match(/^Prevent all combat damage that would be dealt to (.+?)\.$/i);return match&&combatRecipient(g,match[1],recipient.card,recipient.owner,source,owner);}));
 });
 const shielded=new Set();for(const p of packets)if(p.target.kind==='card'){const f=live(g,p.target.id);if(f?.card.counters?.shield>0)shielded.add(p.target.id);}
 for(const id of shielded){const c=live(g,id).card;c.counters.shield--;if(!c.counters.shield)delete c.counters.shield;}
 for(const packet of packets){const {source,target,amount}=packet;if(target.kind==='card'&&shielded.has(target.id)&&!unpreventable(packet))continue;const keywords=keywordSet(g,source.owner,source.card);let dealt=0;
  if(target.kind==='player'){const p=g.players[target.owner];if(keywords.has('infect'))addPlayerCounter(g,target.owner,'poison',amount);else p.life-=amount;dealt=amount;if(combat&&source.card.commander){p.damage[source.card.ownerSeat??source.owner]+=amount;p.commanderDamage??={};p.commanderDamage[source.card.instance]=(p.commanderDamage[source.card.instance]||0)+amount;}const toxic=rulesTextSafe(source.card).match(/(?:^|\n|, )Toxic (\d+)/i);if(combat&&toxic)addPlayerCounter(g,target.owner,'poison',Number(toxic[1]));}
  else{const f=live(g,target.id);if(!f)continue;const c=f.card;if(isCreature(c)){if(keywords.has('infect')||keywords.has('wither'))c.counters['-1/-1']=(c.counters['-1/-1']||0)+amount;else c.markedDamage=(c.markedDamage||0)+amount;if(keywords.has('deathtouch'))c.deathtouchDamage=true;}if(/Planeswalker/.test(cardFace(c).type_line||''))c.counters.loyalty=Math.max(0,(c.counters.loyalty||0)-amount);dealt=amount;}
  if(combat&&dealt&&target.kind==='player'){const found=live(g,source.card.instance,source.card.battlefieldId);if(found){if(found.card.combatDamageHistory?.turn!==stamp(g))found.card.combatDamageHistory={turn:stamp(g),players:[]};if(!found.card.combatDamageHistory.players.includes(target.owner))found.card.combatDamageHistory.players.push(target.owner);}}
  if(dealt){if(keywords.has('lifelink'))gainLife(g,source.owner,dealt);events.push({kind:'damage',combat,keywords:[...keywords],card:snapshotCard(source.card),owner:source.owner,target:{...target},amount:dealt});const recipient=target.kind==='card'&&live(g,target.id);if(recipient&&isCreature(recipient.card))events.push({kind:'receive-damage',combat,card:snapshotCard(recipient.card),owner:recipient.owner,amount:dealt});}
 }
 return events;
}
const rulesTextSafe=card=>(cardFace(card).oracle_text||'');
// Destruction and sacrifice share zone replacements and last-known observers.
// Sacrifice bypasses indestructible and shield; simultaneous deaths are batched.
export function removePermanents(g,ids,{sacrifice=false}={}){
 if(g.pendingEffect?.kind==='destruction-choice')return [];
 const replacements=new Map();
 if(!sacrifice)for(const id of new Set(ids)){const f=live(g,id);if(!f||keywordSet(g,f.owner,f.card).has('indestructible')||f.card.counters?.shield>0)continue;const aura=chooseDestructionReplacement(g,f,{kind:'remove',ids:[...ids]});if(g.pendingEffect?.kind==='destruction-choice')return [];if(aura)replacements.set(id,aura.instance);}
 if(replacements.size){for(const id of replacements.keys()){const f=live(g,id);delete f.card.markedDamage;delete f.card.deathtouchDamage;delete f.card.armorChoice;}ids=[...ids.filter(id=>!replacements.has(id)),...replacements.values()];}
 const observers=fieldCards(g).map(({card,owner})=>({card:snapshotCard(card),owner})),events=[],removed=[];
 for(const id of new Set(ids)){const f=live(g,id);if(!f)continue;const {card,owner}=f;
  if(!sacrifice){if(keywordSet(g,owner,card).has('indestructible'))continue;if(card.counters?.shield>0){card.counters.shield--;if(!card.counters.shield)delete card.counters.shield;continue;}}
  const snapshot=snapshotCard(card),option=deathDestinations(g,owner,card)[0],deadZoneId=moveDeadPermanent(g,owner,card,option);removed.push({card:snapshot,owner,zone:option.zone});events.push({kind:'leave',card:snapshot,owner});if(sacrifice)events.push({kind:'sacrifice',card:snapshot,owner});if(option.zone==='graveyard'){events.push({kind:'graveyard',card:snapshot,owner,deadZoneId});if(isCreature(snapshot))events.push({kind:'die',card:snapshot,owner,deadZoneId});}
  if(snapshot.token){const zone=g.players[card.ownerSeat??owner].zones[option.zone];zone.splice(zone.indexOf(card),1);}
 }
 queueCombatTriggers(g,events,observers);return removed;
}
export function stateBasedActions(g,{damageEvents=[]}={}){
 refreshPairs(g);
 if(g.pendingEffect?.context&&['oracle-choice','proliferate','counter-choice'].includes(g.pendingEffect.kind))return [];
 if(g.result)return [];if(checkPlayerLosses(g)){if(g.result)return [];damageEvents=damageEvents.filter(e=>!g.players[e.owner]?.eliminated);return stateBasedActions(g,{damageEvents});}
 if(g.pendingEffect?.kind==='destruction-choice')return [];
 for(const source of fieldCards(g))if(!isAura(source.card)&&source.card.attachedTo&&!attachmentLegal(g,source,findCard(g,source.card.attachedTo))){delete source.card.attachedTo;delete source.card.attachedBattlefieldId;}
 const observers=fieldCards(g).map(({card,owner})=>({card:snapshotCard(card),owner})),dead=[];
 for(const {card,owner} of fieldCards(g)){if(card.entryChoices?.length)continue;let reason='';const stats=combatStats(g,owner,card),keywords=keywordSet(g,owner,card);
  if(isAura(card)&&!attachmentLegal(g,{card,owner},findCard(g,card.attachedTo||card.loyaltyAttachment||card.manaSettings?.attachedTo)))reason='Illegal Aura attachment';
  if(stats&&typeof stats.toughness==='number'){if(stats.toughness<=0)reason='Zero toughness';else if(((card.markedDamage||0)>=stats.toughness||card.deathtouchDamage)&&!keywords.has('indestructible'))reason='Lethal damage';}
  if(!card.faceDown&&/Planeswalker/.test(cardFace(card).type_line||'')&&Object.hasOwn(card.counters||{},'loyalty')&&card.counters.loyalty<=0)reason='Zero loyalty';if(reason==='Lethal damage'&&card.counters?.shield>0){note(g,card.name+': shield counters cannot save a creature that still has lethal damage marked.');delete card.counters.shield;}if(reason)dead.push({card,owner,reason,options:deathDestinations(g,owner,card)});
 }
 const protectedIds=new Set(),armorIds=[];
 for(const f of dead)if(f.reason==='Lethal damage'){const aura=chooseDestructionReplacement(g,f,{kind:'sba',damageEvents});if(g.pendingEffect?.kind==='destruction-choice')return [];if(aura){protectedIds.add(f.card.instance);armorIds.push(aura.instance);}}
 for(const f of dead)if(protectedIds.has(f.card.instance)){delete f.card.markedDamage;delete f.card.deathtouchDamage;delete f.card.armorChoice;}
 for(const id of armorIds){const f=live(g,id);if(!f||dead.some(d=>d.card.instance===id)||keywordSet(g,f.owner,f.card).has('indestructible'))continue;dead.push({...f,reason:'Umbra armor replacement',options:deathDestinations(g,f.owner,f.card)});}
 const events=[],results=[];for(const {card,owner,options,reason} of dead.filter(d=>!protectedIds.has(d.card.instance))){const snapshot=snapshotCard(card),chosen=g.combat?.deathChoices?.[card.instance],option=options.find(o=>o.zone===chosen)||options[0],deadZoneId=moveDeadPermanent(g,owner,card,option);events.push({kind:'leave',card:snapshot,owner});note(g,snapshot.name+': '+reason+' → '+option.zone+'.');if(option.zone==='graveyard'){events.push({kind:'graveyard',card:snapshot,owner,deadZoneId});if(isCreature(snapshot))events.push({kind:'die',card:snapshot,owner,deadZoneId});}
  const commander=card.commander&&['graveyard','exile'].includes(option.zone);if(commander&&chosen==='command')transfer(g,card.instance,'command',card.ownerSeat??owner);
  results.push({id:card.instance,name:card.name,options:commander?[...options,{zone:'command',reason:'Commander choice'}]:options,destination:commander&&chosen==='command'?'command':option.zone});
  if(snapshot.token){const zone=g.players[card.ownerSeat??owner].zones[option.zone];zone.splice(zone.indexOf(card),1);}}
 let cancelled=false;for(const {card} of fieldCards(g)){const n=Math.min(card.counters?.['+1/+1']||0,card.counters?.['-1/-1']||0);if(n>0){for(const kind of ['+1/+1','-1/-1']){card.counters[kind]-=n;if(!card.counters[kind])delete card.counters[kind];}cancelled=true;}}
 queueCombatTriggers(g,[...damageEvents,...events],observers);if(dead.length||cancelled)results.push(...stateBasedActions(g));return results;
}
export function applyCombatDamage(g){
 ready(g);if(g.step!==7||g.combat?.stage!=='damage'||g.combat.normalDone)throw Error('Review blockers and enter the damage step first.');const phase=damagePhase(g),events=applyDamageBatch(g,phase);if(phase==='first')g.combat.firstDone=true;else{g.combat.normalDone=true;g.combat.stage='complete';}
 stateBasedActions(g,{damageEvents:events});note(g,(phase==='first'?'First-strike':'Normal')+' combat damage applied.');return phase;
}
export function previewCombat(g){
 if(!g.combat)return {creatures:[],players:[],planeswalkers:[],deaths:[],sources:[],error:''};
 const before=fieldCards(g),slim={...g,players:g.players.map(p=>({...p,zones:Object.fromEntries(Object.entries(p.zones).map(([z,cards])=>[z,cards.map(snapshotCard)]))})),log:[],stack:[]};const simulation=structuredClone(slim);simulation.pendingEffect=undefined;let deaths=[];
 const firstIds=[...new Set([...g.combat.attackers.map(a=>a.id),...g.combat.blocks.map(b=>b.blocker)])].filter(id=>{const f=live(g,id);return f&&[...keywordSet(g,f.owner,f.card)].some(k=>k==='first strike'||k==='double strike');});simulation.combat.firstStrikeIds??=firstIds;
 try{if(firstIds.length&&!simulation.combat.firstDone){applyDamageBatch(simulation,'first');deaths.push(...stateBasedActions(simulation));simulation.combat.firstDone=true;}if(!simulation.combat.normalDone){applyDamageBatch(simulation,'normal');deaths.push(...stateBasedActions(simulation));}}catch(error){return {creatures:[],players:[],planeswalkers:[],deaths:[],sources:damageSources(g),error:error.message};}
 return {creatures:before.filter(({card})=>isCreature(card)&&[...g.combat.attackers.map(a=>a.id),...g.combat.blocks.map(b=>b.blocker)].includes(card.instance)).map(({card,owner})=>{const after=live(simulation,card.instance);return {id:card.instance,name:card.name,owner,before:combatStats(g,owner,card),after:after?combatStats(simulation,after.owner,after.card):null,destination:deaths.find(d=>d.id===card.instance)?.destination,options:deaths.find(d=>d.id===card.instance)?.options||[]};}),players:g.players.map((p,owner)=>({owner,name:p.name,before:p.life,after:simulation.players[owner].life,poison:simulation.players[owner].poison-p.poison})).filter(p=>p.before!==p.after||p.poison),planeswalkers:before.filter(({card})=>!card.faceDown&&/Planeswalker/.test(cardFace(card).type_line||'')).map(({card,owner})=>({id:card.instance,owner,name:card.name,before:card.counters.loyalty||0,after:live(simulation,card.instance)?.card.counters.loyalty||0,destination:deaths.find(d=>d.id===card.instance)?.destination})).filter(p=>p.before!==p.after),deaths,sources:damageSources(g),error:''};
}
export function cleanTurnDamage(g){for(const player of g.players){player.extraLandPlays=0;for(const card of player.zones.graveyard){delete card.flashbackGrant;delete card.graveCastGrant;}}delete g.temporaryManaRules;delete g.spellCopyEffects;delete g.temporaryGraveyardRules;for(const {card} of fieldCards(g)){delete card.animatedCreature;delete card.markedDamage;delete card.deathtouchDamage;delete card.temporaryStats;delete card.temporaryKeywords;delete card.lostKeywords;}delete g.combat;delete g.blockingRules;}
export function beginControllerTurn(g){for(const {card} of fieldCards(g))if(card.goadedBy){card.goadedBy=card.goadedBy.filter(owner=>owner!==g.active);if(!card.goadedBy.length)delete card.goadedBy;}for(const card of g.players[g.active].zones.battlefield)card.summoningSick=false;}
export function validateCombat(g,fail){
 if(g.blockingRules&&(typeof g.blockingRules.turn!=='string'||!Array.isArray(g.blockingRules.controllers)||g.blockingRules.controllers.length!==g.players.length||g.blockingRules.controllers.some(n=>!Number.isInteger(n)||!g.players[n])||!Array.isArray(g.blockingRules.must)||g.blockingRules.must.length!==g.players.length||g.blockingRules.must.some(b=>typeof b!=='boolean')))fail();
 if(g.combat?.endTriggers&&(!Array.isArray(g.combat.endTriggers)||g.combat.endTriggers.length>500||g.combat.endTriggers.some(e=>!Number.isInteger(e.owner)||!g.players[e.owner]||!e.source||typeof e.source.instance!=='string'||!Array.isArray(e.tokens)||e.tokens.length>500||e.tokens.some(t=>typeof t.id!=='string'||typeof t.battlefieldId!=='string'))))fail();
 if(g.combatsThisTurn&&(!g.combatsThisTurn||typeof g.combatsThisTurn.turn!=='string'||!Number.isSafeInteger(g.combatsThisTurn.count)||g.combatsThisTurn.count<1))fail();
 const seats=list=>Array.isArray(list)&&list.length<=g.players.length&&new Set(list).size===list.length&&list.every(n=>Number.isInteger(n)&&n>=0&&n<g.players.length);
 for(const {card} of fieldCards(g)){
  if(card.goadedBy&&!seats(card.goadedBy))fail();
  if(card.attackHistory&&(typeof card.attackHistory.turn!=='string'||!Number.isSafeInteger(card.attackHistory.count)||card.attackHistory.count<1||card.attackHistory.players!==undefined&&!seats(card.attackHistory.players)))fail();
  if(card.exertedTurn!==undefined&&(typeof card.exertedTurn!=='string'||!/^\d+:[0-3]$/.test(card.exertedTurn)))fail();
  if(card.combatDamageHistory&&(typeof card.combatDamageHistory.turn!=='string'||!seats(card.combatDamageHistory.players)))fail();
  if(card.abilityUses&&(typeof card.abilityUses.turn!=='string'||!Array.isArray(card.abilityUses.ids)||card.abilityUses.ids.length>100||card.abilityUses.ids.some(id=>typeof id!=='string')))fail();
  if(card.imprintLink&&(typeof card.imprintLink.id!=='string'||typeof card.imprintLink.zoneChangeId!=='string'))fail();
  if(card.imprintProfile&&(Object.keys(card.imprintProfile).some(key=>!['power','toughness','type_line'].includes(key))||Object.values(card.imprintProfile).some(value=>typeof value!=='string'||value.length>1000)))fail();
 }
 for(const {card} of fieldCards(g)){if(card.summoningSick!==undefined&&typeof card.summoningSick!=='boolean'||card.markedDamage!==undefined&&(!Number.isSafeInteger(card.markedDamage)||card.markedDamage<0)||card.deathtouchDamage!==undefined&&typeof card.deathtouchDamage!=='boolean'||card.battlefieldId!==undefined&&typeof card.battlefieldId!=='string'||card.ownerSeat!==undefined&&(!Number.isInteger(card.ownerSeat)||card.ownerSeat<0||card.ownerSeat>3))fail();if(card.temporaryStats&&![card.temporaryStats.power,card.temporaryStats.toughness].every(Number.isSafeInteger))fail();if(card.temporaryKeywords&&(!Array.isArray(card.temporaryKeywords)||card.temporaryKeywords.some(k=>typeof k!=='string')))fail();}
 if(!g.combat)return;const c=g.combat;if(typeof c.id!=='string'||typeof c.turn!=='string'||!Number.isInteger(c.owner)||c.owner<0||c.owner>3||!['beginning','attackers','blockers','review','damage','complete'].includes(c.stage)||!Array.isArray(c.attackers)||c.attackers.length>500||!Array.isArray(c.blocks)||c.blocks.length>2500||!Array.isArray(c.defenders)||!Array.isArray(c.confirmedDefenders)||[...c.defenders,...c.confirmedDefenders].some(o=>!Number.isInteger(o)||o<0||o>3)||typeof c.attackersConfirmed!=='boolean'||typeof c.firstDone!=='boolean'||typeof c.normalDone!=='boolean'||!c.assignments||!c.deathChoices)fail();
 if(c.blockLimits!==undefined&&(!c.blockLimits||typeof c.blockLimits!=='object'||Array.isArray(c.blockLimits)||Object.entries(c.blockLimits).some(([seat,n])=>!/^\d$/.test(seat)||Number(seat)>=g.players.length||!Number.isSafeInteger(n)||n<1||n>500)))fail();
 if(c.attackedOpponents!==undefined&&!seats(c.attackedOpponents))fail();
 for(const a of c.attackers)if(!a||typeof a.id!=='string'||!a.defender||!['player','card'].includes(a.defender.kind)||!Number.isInteger(a.defender.owner)||a.defender.owner<0||a.defender.owner>=g.players.length||a.defender.owner===c.owner||a.defender.kind==='card'&&typeof a.defender.id!=='string'||a.exert!==undefined&&typeof a.exert!=='boolean'||a.enteredAttacking!==undefined&&typeof a.enteredAttacking!=='boolean')fail();
 if(new Set(c.attackers.map(a=>a.id)).size!==c.attackers.length)fail();for(const b of c.blocks)if(!b||typeof b.blocker!=='string'||typeof b.attacker!=='string'||!Number.isInteger(b.owner)||b.owner<0||b.owner>3)fail();for(const phase of Object.values(c.assignments))for(const list of Object.values(phase)){if(!Array.isArray(list)||list.some(a=>!a||typeof a.target!=='string'||!Number.isSafeInteger(a.amount)||a.amount<0))fail();}
}
