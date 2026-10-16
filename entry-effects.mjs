import {attachPermanent} from './attachments.mjs';
import {findCard,transfer} from './engine.mjs';
import {initializePermanent,cardFace} from './card-state.mjs';
import {createEntryCounterPlan,validateCounterPlan} from './counter-effects.mjs';
import {queueCombatTriggers,snapshotCard} from './combat-effects.mjs';

// Prepare the entire batch before moving any card. Replacement choices use
// prospective characteristics while triggers observe only committed entries.
// Requests contain identities and placement options, not client-supplied rules.
export function preparePermanentEntries(g,requests){
 if(!Array.isArray(requests)||requests.length>500||new Set(requests.map(r=>r.id)).size!==requests.length)throw Error('Invalid entering batch.');
 const entries=[],prepared=[];
 for(const request of requests){
  const existing=findCard(g,request.id),found=request.token?{card:request.token,zone:'token'}:existing,owner=request.owner;
  if(request.token&&(existing||request.token.instance!==request.id||request.token.token!==true||request.token.ownerSeat!==owner))throw Error('Invalid staged token.');
  if(!found||found.zone==='battlefield'||!Number.isInteger(owner)||!g.players[owner])throw Error('Choose a permanent outside the battlefield and a valid controller.');
  const spell=found.zone==='stack'?g.stack.find(e=>e.card?.instance===request.id):null;
  const cast=spell&&!spell.manualPlacement?{x:spell.castX||0,phyrexianLife:spell.castPayment?.phyrexianLife||0,colors:spell.copy?[]:spell.castPayment?.colors||[]}:undefined;
  const card=structuredClone(found.card);
  if(found.zone!=='stack')card.castKicks=0;
  initializePermanent(card,g,owner,{cast,deferCompleated:true,forceTapped:!!request.entryTapped});
  for(const [kind,amount] of Object.entries(request.entryCounters||{})){
   if(!Number.isSafeInteger(amount)||amount<0)throw Error('Invalid entering counters.');
   card.counters[kind]=(card.counters[kind]||0)+amount;
  }
  const entryTap={tapped:card.tapped,...(card.entryLife?{life:structuredClone(card.entryLife)}:{}),...(card.entryCondition?{condition:card.entryCondition}:{})};
  prepared.push({...request,from:found.zone,zoneChangeId:found.card.zoneChangeId||null,entryTap});
  entries.push({card,owner,compleatedLife:cast?.phyrexianLife||0});
 }
 return {requests:prepared,plan:createEntryCounterPlan(g,entries)};
}
export function commitPermanentEntries(g,requests,plan){
 if(plan.index!==plan.states.length)throw Error('Finish entering replacement choices first.');
 // Validate all sources before moving any. A saved choice cannot be replayed
 // against a card which has changed zones in the meantime.
 for(const request of requests){const found=findCard(g,request.id);if(request.token?!!found:found?.zone!==request.from||(found.card.zoneChangeId||null)!==request.zoneChangeId)throw Error('An entering permanent changed zones.');}
 const entered=[];
 for(const request of requests){
  const state=plan.states.find(s=>s.recipient.id===request.id),counters=Object.fromEntries(Object.entries(state.counters).filter(([,n])=>n>0));
  // Zero starting loyalty is still a known value: state actions must remove
  // that walker after entry, without inventing a zero-counter placement event.
  const source=request.token||findCard(g,request.id).card;
  if(!source.faceDown&&/\bPlaneswalker\b/.test(cardFace(source).type_line||'')&&/^\d+$/.test(String(cardFace(source).loyalty??'')))counters.loyalty??=0;
  if(request.token)g.players[request.owner].zones.hand.push(request.token);
  const card=transfer(g,request.id,'battlefield',request.owner,request.position,{deferTriggers:true,entryTapped:!!request.entryTapped,attachTo:request.attachTo,resolvedEntryCounters:counters});
  // Transfers commit sequentially, but the rules event is simultaneous.
  // Preserve the pre-batch tapped conditions (including unresolved life or
  // reveal choices) instead of letting an earlier member affect a later one.
  if(request.entryTap){card.tapped=request.entryTap.tapped;delete card.entryLife;delete card.entryCondition;if(request.entryTap.life)card.entryLife=structuredClone(request.entryTap.life);if(request.entryTap.condition)card.entryCondition=request.entryTap.condition;}
  entered.push({card,owner:request.owner,createdToken:!!request.token,counters:Object.fromEntries(Object.entries(counters).filter(([,n])=>n>0))});
 }
 // Reanimation Auras attach as part of the same entry instruction, before
 // entry observers evaluate characteristics and before state actions run.
 for(const request of requests)if(request.reanimationAura){
  const ref=request.reanimationAura,aura=findCard(g,ref.id),target=findCard(g,request.id);
  if(aura?.zone==='battlefield'&&aura.card.battlefieldId===ref.battlefieldId&&target?.zone==='battlefield'){
   aura.card.reanimationLink={id:target.card.instance,battlefieldId:target.card.battlefieldId,abilityOwner:ref.abilityOwner};attachPermanent(g,aura.card.instance,target.card.instance);
  }
 }
 // Both counter-placement and entry observers see the final counters, and all
 // members of a batch have entered before any of these triggers are collected.
 queueCombatTriggers(g,entered.flatMap(({card,owner,counters,createdToken})=>[
  {kind:'enter',owner,card:snapshotCard(card)},
  ...(createdToken?[{kind:'create-token',owner,card:snapshotCard(card)}]:[]),
  ...(Object.keys(counters).length?[{kind:'counter',owner,card:snapshotCard(card),target:{kind:'card',id:card.instance,owner,battlefieldId:card.battlefieldId},counters}]:[])
 ]));
 return entered.map(e=>e.card);
}
export function validateEntryRequests(requests,fail,playerCount,plan){
 if(!Array.isArray(requests)||requests.length>500||new Set(requests.map(r=>r?.id)).size!==requests.length)fail();
 for(const r of requests){if(!r||typeof r.id!=='string'||!Number.isInteger(r.owner)||r.owner<0||r.owner>=playerCount||r.entryTapped!==undefined&&typeof r.entryTapped!=='boolean'||r.attachTo!==undefined&&typeof r.attachTo!=='string'||r.position&&(!Number.isFinite(r.position.x)||!Number.isFinite(r.position.y))||r.entryCounters&&(typeof r.entryCounters!=='object'||Array.isArray(r.entryCounters)||Object.entries(r.entryCounters).some(([k,n])=>!k||k.length>100||!Number.isSafeInteger(n)||n<0||n>999999)))fail();
  if(r.reanimationAura&&(typeof r.reanimationAura.id!=='string'||typeof r.reanimationAura.battlefieldId!=='string'||!Number.isInteger(r.reanimationAura.abilityOwner)||r.reanimationAura.abilityOwner<0||r.reanimationAura.abilityOwner>=playerCount))fail();
  if(r.entryTap&&(typeof r.entryTap.tapped!=='boolean'||r.entryTap.condition!==undefined&&(typeof r.entryTap.condition!=='string'||r.entryTap.condition.length>20000)||r.entryTap.life&&(!Number.isSafeInteger(r.entryTap.life.amount)||r.entryTap.life.amount<=0||r.entryTap.life.amount>999999||typeof r.entryTap.life.forcedTapped!=='boolean')))fail();
  if(r.token){const c=r.token;if(c.instance!==r.id||c.token!==true||c.ownerSeat!==r.owner||['name','type_line','oracle_text'].some(k=>typeof c[k]!=='string'||c[k].length>20000)||c.counters&&(typeof c.counters!=='object'||Array.isArray(c.counters)||Object.keys(c.counters).length)||c.card_faces&&(!Array.isArray(c.card_faces)||c.card_faces.length>2||c.card_faces.some(f=>!f||typeof f.name!=='string'||typeof f.type_line!=='string'||f.oracle_text!==undefined&&typeof f.oracle_text!=='string')))fail();}
  if(plan&&(!['stack','hand','command','graveyard','exile','library','token'].includes(r.from)||(r.from==='token')!==!!r.token||r.zoneChangeId!==null&&typeof r.zoneChangeId!=='string'))fail();
 }
 if(plan){validateCounterPlan(plan,fail,playerCount);if(plan.states.length!==requests.length||requests.some(r=>plan.states.filter(s=>s.cause==='entry'&&s.recipient.kind==='card'&&s.recipient.id===r.id&&s.recipient.owner===r.owner).length!==1))fail();}
}
