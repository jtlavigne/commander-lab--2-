import {findCard} from './engine.mjs';
import {cardFace} from './card-state.mjs';
import {fieldCards,isCreature,keywordSet,keywordTotal,protectedFrom,combatRecipient} from './creature-rules.mjs';
import {snapshotCard} from './combat-effects.mjs';
import {gainLife} from './resource-rules.mjs';
import {createCounterPlan,advanceCounterPlan,commitCounterPlan,permanentCounterEvent,playerCounterEvent} from './counter-effects.mjs';

const live=(g,target)=>{const f=findCard(g,target.id);return f?.zone==='battlefield'&&(target.battlefieldId===undefined||(f.card.battlefieldId||null)===target.battlefieldId)?f:null;};
const text=card=>cardFace(card).oracle_text||'';

// Damage is converted into its complete results before any of those results
// are committed (CR 120.4). Counter choices cannot expose a half-damaged table.
function prepareDamage(g,packets,combat,afterDamage){
 if(!Array.isArray(packets)||packets.length>500)throw Error('Too many damage packets.');
 const records=[],shields=new Set(),events=[];
 for(const packet of packets){
  const {source,target,amount}=packet;
  if(!Number.isSafeInteger(amount)||amount<0||amount>999999||!g.players[source?.owner]||!g.players[target?.owner])throw Error('Invalid damage packet.');
  if(!amount||g.players[target.owner].eliminated)continue;
  const recipient=target.kind==='card'?live(g,target):null;
  if(target.kind==='card'&&!recipient)continue;
  const unpreventable=combat&&fieldCards(g).some(({card,owner})=>!card.faceDown&&owner===source.owner&&isCreature(source.card)&&/Combat damage that would be dealt by creatures you control can't be prevented\./i.test(text(card)));
  if(recipient&&!unpreventable){
   if(protectedFrom(g,recipient.owner,recipient.card,source.card))continue;
   if(combat&&fieldCards(g).some(({card,owner})=>!card.faceDown&&text(card).split('\n').some(line=>{const m=line.match(/^Prevent all combat damage that would be dealt to (.+?)\.$/i);return m&&combatRecipient(g,m[1],recipient.card,recipient.owner,card,owner);})))continue;
  }
  if(recipient?.card.counters?.shield>0){shields.add(recipient.card.instance);if(!unpreventable)continue;}
  const keywords=keywordSet(g,source.owner,source.card),card=recipient?.card,type=card?cardFace(card).type_line||'':'';
  const record={source:{owner:source.owner,card:snapshotCard(source.card)},target:{...target,...(recipient?{owner:recipient.owner,battlefieldId:card.battlefieldId||null}:{})},amount,keywords:[...keywords],creature:!!card&&isCreature(card),walker:/\bPlaneswalker\b/.test(type),battle:/\bBattle\b/.test(type)};
  records.push(record);
  // Each damage source has a distinct placement event. In particular, two
  // toxic-1 attackers are halved separately by an opponent's Vorinclex.
  const cause=combat?'damage':'effect';
  if(target.kind==='player'){
   const poison=(keywords.has('infect')?amount:0)+(combat&&isCreature(source.card)?keywordTotal(g,source.owner,source.card,'toxic'):0);
   if(poison)events.push(playerCounterEvent(source.owner,target.owner,{poison},cause));
  }else if(record.creature&&(keywords.has('infect')||keywords.has('wither')))events.push(permanentCounterEvent(g,source.owner,card.instance,{'-1/-1':amount},cause));
 }
 return {batch:{records,shields:[...shields],combat,afterDamage},plan:createCounterPlan(g,events)};
}

export function commitDamageBatch(g,batch,plan){
 if(plan.index!==plan.states.length)throw Error('Finish damage counter replacements first.');
 for(const id of batch.shields){const f=findCard(g,id);if(f?.zone==='battlefield'&&f.card.counters?.shield>0){f.card.counters.shield--;if(!f.card.counters.shield)delete f.card.counters.shield;}}
 const events=[];
 // Apply every non-counter result, then every counter result. No state action
 // or trigger is processed between them; observers see the complete event.
 for(const record of batch.records){
  const {source,target,amount,keywords}=record,recipient=target.kind==='card'?live(g,target):null;
  if(g.players[target.owner].eliminated||target.kind==='card'&&!recipient)continue;
  if(target.kind==='player'){
   const player=g.players[target.owner];if(!keywords.includes('infect'))player.life-=amount;
   if(batch.combat&&source.card.commander){player.damage[source.card.ownerSeat??source.owner]+=amount;player.commanderDamage??={};player.commanderDamage[source.card.instance]=(player.commanderDamage[source.card.instance]||0)+amount;}
  }else{
   const card=recipient.card;
   if(record.creature){if(!keywords.includes('infect')&&!keywords.includes('wither'))card.markedDamage=(card.markedDamage||0)+amount;if(keywords.includes('deathtouch'))card.deathtouchDamage=true;}
   if(record.walker)card.counters.loyalty=Math.max(0,(card.counters.loyalty||0)-amount);
   if(record.battle)card.counters.defense=Math.max(0,(card.counters.defense||0)-amount);
  }
  if(batch.combat&&target.kind==='player'){
   const f=live(g,{id:source.card.instance,battlefieldId:source.card.battlefieldId||null});
   if(f){const stamp=g.turn+':'+g.active;if(f.card.combatDamageHistory?.turn!==stamp)f.card.combatDamageHistory={turn:stamp,players:[]};if(!f.card.combatDamageHistory.players.includes(target.owner))f.card.combatDamageHistory.players.push(target.owner);}
  }
  if(keywords.includes('lifelink'))gainLife(g,source.owner,amount);
  events.push({kind:'damage',combat:batch.combat,keywords,card:source.card,owner:source.owner,target:{...target},amount});
  if(batch.afterDamage.restrictNoncreature&&target.kind==='player')g.players[target.owner].noncreatureLock=g.turn+':'+g.active;
  if(batch.afterDamage.tapCreatures&&recipient&&record.creature)recipient.card.tapped=true;
 }
 const counters=commitCounterPlan(g,plan,{deferTriggers:true});
 for(const record of batch.records){const recipient=record.target.kind==='card'&&live(g,record.target);if(recipient&&record.creature)events.push({kind:'receive-damage',combat:batch.combat,card:snapshotCard(recipient.card),owner:recipient.owner,amount:record.amount});}
 return [...counters,...events];
}

export function dealDamagePackets(g,packets,combat=false,afterDamage={}){
 const {batch,plan}=prepareDamage(g,packets,combat,afterDamage),choice=advanceCounterPlan(plan);
 if(!choice)return commitDamageBatch(g,batch,plan);
 if(g.pendingEffect)throw Error('Finish the pending choice before dealing another damage batch.');
 const first=batch.records[0].source;
 g.resolutionInProgress=true;
 g.pendingEffect={kind:'counter-choice',owner:choice.owner,name:'Damage counter replacements',context:{owner:first.owner,name:'Damage',source:first.card},remaining:[],plan,damageBatch:batch};
 return [];
}

export function validateDamageBatch(batch,fail,playerCount){
 const seat=n=>Number.isInteger(n)&&n>=0&&n<playerCount;
 if(!batch||typeof batch.combat!=='boolean'||!Array.isArray(batch.records)||batch.records.length>500||!Array.isArray(batch.shields)||batch.shields.length>500||new Set(batch.shields).size!==batch.shields.length||batch.shields.some(id=>typeof id!=='string')||!batch.afterDamage||Object.keys(batch.afterDamage).some(key=>!['restrictNoncreature','tapCreatures'].includes(key)||typeof batch.afterDamage[key]!=='boolean'))fail();
 for(const r of batch.records){if(!r||!seat(r.source?.owner)||!r.source.card||typeof r.source.card.instance!=='string'||typeof r.source.card.name!=='string'||!seat(r.target?.owner)||!['player','card'].includes(r.target.kind)||r.target.kind==='card'&&(typeof r.target.id!=='string'||r.target.battlefieldId!==null&&typeof r.target.battlefieldId!=='string')||!Number.isSafeInteger(r.amount)||r.amount<1||r.amount>999999||!Array.isArray(r.keywords)||r.keywords.length>100||r.keywords.some(k=>typeof k!=='string'||k.length>200)||['creature','walker','battle'].some(k=>typeof r[k]!=='boolean'))fail();}
 if(batch.combatState&&(!batch.combat||typeof batch.combatState.id!=='string'||!['first','normal'].includes(batch.combatState.phase)))fail();
}
