import {attachPermanent} from './attachments.mjs';
import {findCard,transfer} from './engine.mjs';
import {initializePermanent,cardFace,applyEntryChoices} from './card-state.mjs';
import {payLife} from './life-effects.mjs';
import {createEntryCounterPlan,validateCounterPlan} from './counter-effects.mjs';
import {queueCombatTriggers,snapshotCard} from './combat-effects.mjs';
import {enterAttacking} from './tokens.mjs';
import {nextEntryCopy,applyEntryCopy} from './entry-copy.mjs';
import {validateCopyEffects} from './copy-state.mjs';

// Changing prospective characteristics does not change how the spell was paid.
// Entry abilities such as sunburst still read that original casting payment.
function castForEntry(g,id,zone){
 const spell=zone==='stack'?g.stack.find(e=>e.card?.instance===id):null;
 return spell&&!spell.manualPlacement?{x:spell.castX||0,phyrexianLife:spell.castPayment?.phyrexianLife||0,colors:spell.copy?[]:spell.castPayment?.colors||[]}:{x:0,phyrexianLife:0,colors:[]};
}

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
  const cast=castForEntry(g,request.id,found.zone);
  const card=structuredClone(found.card);
  if(found.zone!=='stack')card.castKicks=0;
  initializePermanent(card,g,owner,{cast,deferCompleated:true,forceTapped:!!request.entryTapped});
  for(const [kind,amount] of Object.entries(request.entryCounters||{})){
   if(!Number.isSafeInteger(amount)||amount<0)throw Error('Invalid entering counters.');
   card.counters[kind]=(card.counters[kind]||0)+amount;
  }
  const entryTap={tapped:card.tapped,...(card.entryLife?{life:structuredClone(card.entryLife)}:{}),...(card.entryCondition?{condition:card.entryCondition}:{})};
  prepared.push({...request,from:found.zone,zoneChangeId:found.card.zoneChangeId||null,entryTap});
  entries.push({card,owner,compleatedLife:cast?.phyrexianLife||0,tapState:{forced:card.entryLife?.forcedTapped??card.tapped,condition:false,life:false}});
 }
 return {requests:prepared,entries,plan:createEntryCounterPlan(g,entries)};
}
// Entry decisions are part of the entering event, not response windows. All
// members remain outside the battlefield until every controller is finished.
export function entryChoiceOptions(g,entries){
 const choices=entries.map((entry,index)=>({entry,index})).sort((a,b)=>(a.entry.owner-g.active+g.players.length)%g.players.length-(b.entry.owner-g.active+g.players.length)%g.players.length).flatMap(({entry,index})=>{
  const {card,owner}=entry;
  const kinds=nextEntryCopy(entry)?['copy']:[card.entryChoices?.length&&'values',card.entryCondition&&'condition',card.entryLife&&'life'].filter(Boolean);
  return kinds.map(kind=>({index,kind,card,owner}));
 });
 return choices.filter(choice=>choice.owner===choices[0].owner);
}
export function nextEntryChoice(g,entries,selected){
 const choices=entryChoiceOptions(g,entries);
 return selected?choices.find(c=>c.index===selected.index&&(selected.kind===undefined||c.kind===selected.kind)):choices[0];
}
export function pendingEntryChoice(g,pending=g.pendingEffect){
 return pending?.kind==='entry-choice'?nextEntryChoice(g,pending.entries,{index:pending.entryIndex,kind:pending.entryKind}):undefined;
}
export function selectEntryChoice(g,id,kind){
 const pending=g.pendingEffect;if(pending?.kind!=='entry-choice')throw Error('No pre-entry decision is pending.');
 const choice=entryChoiceOptions(g,pending.entries).find(c=>c.card.instance===id&&c.kind===kind&&c.owner===pending.owner);
 if(!choice)throw Error('Choose an available pre-entry decision for the current controller.');
 pending.entryIndex=choice.index;pending.entryKind=choice.kind;
}
export function applyPreparedEntryChoice(g,pending,kind,answer){
 const choice=pendingEntryChoice(g,pending);
 if(!choice||choice.kind!==kind||choice.card.instance!==answer.id)throw Error('Choose the pending entering permanent and its requested decision.');
 const {card,owner}=choice,entry=pending.entries[choice.index],request=pending.entryRequests.find(r=>r.id===card.instance);
 if(kind==='copy'){
  if(applyEntryCopy(g,entry,answer)){
   initializePermanent(card,g,owner,{preserveCopyEffects:true,deferCompleated:true,forceTapped:!!request.entryTapped,cast:castForEntry(g,request.id,request.from)});
   for(const counters of [request.entryCounters,entry.copyCounters])for(const [name,n] of Object.entries(counters||{}))card.counters[name]=(card.counters[name]||0)+n;
   entry.tapState={forced:card.entryLife?.forcedTapped??card.tapped,condition:false,life:false};
  }
  return;
 }
 const tap={...(entry.tapState||{forced:card.entryLife?.forcedTapped??card.tapped,condition:false,life:false})};
 if(kind==='values'){
  const keys=card.entryChoices.map(c=>c.key);
  if(!answer.values||typeof answer.values!=='object'||Array.isArray(answer.values)||Object.keys(answer.values).some(key=>!keys.includes(key)))throw Error('Enter the requested starting values.');
  applyEntryChoices(card,answer.values);
  for(const key of keys)if(key.startsWith('counter:')){const name=key.slice(8);for(const counters of [request.entryCounters,entry.copyCounters])if(counters?.[name])card.counters[name]=(card.counters[name]||0)+counters[name];}
 }else if(kind==='condition'){
  if(typeof answer.tapped!=='boolean')throw Error('Choose tapped or untapped.');
  tap.condition=answer.tapped;delete card.entryCondition;
 }else{
  if(typeof answer.pay!=='boolean')throw Error('Choose whether to pay life.');
  const {amount}=card.entryLife;
  if(answer.pay)payLife(g.players[owner],amount);
  tap.life=!answer.pay;delete card.entryLife;
 }
 entry.tapState=tap;
 if(card.entryLife)card.entryLife.forcedTapped=tap.forced||tap.condition;
 card.tapped=tap.forced||tap.condition||tap.life||!!card.entryLife;
}
export function finalizeEntryChoices(requests,entries){
 for(const {card} of entries){
  const request=requests.find(r=>r.id===card.instance);
  request.entryTap={tapped:card.tapped};request.entryConfigured=true;
  if(card.copyEffects)request.entryCopyEffects=structuredClone(card.copyEffects);
  delete request.entryStats;
  if(card.battlefieldStats)request.entryStats=structuredClone(card.battlefieldStats);
 }
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
  const source={...(request.token||findCard(g,request.id).card),...(request.entryCopyEffects?{copyEffects:request.entryCopyEffects}:{})};
  if(!source.faceDown&&/\bPlaneswalker\b/.test(cardFace(source).type_line||'')&&/^\d+$/.test(String(cardFace(source).loyalty??'')))counters.loyalty??=0;
  if(request.token)g.players[request.owner].zones.hand.push(request.token);
  const card=transfer(g,request.id,'battlefield',request.owner,request.position,{deferTriggers:true,entryTapped:!!request.entryTapped,attachTo:request.attachTo,resolvedEntryCounters:counters,entryCopyEffects:request.entryCopyEffects});
  // Transfers commit sequentially, but the rules event is simultaneous.
  // Preserve the pre-batch tapped conditions (including unresolved life or
  // reveal choices) instead of letting an earlier member affect a later one.
  if(request.entryTap){card.tapped=request.entryTap.tapped;delete card.entryLife;delete card.entryCondition;if(request.entryTap.life)card.entryLife=structuredClone(request.entryTap.life);if(request.entryTap.condition)card.entryCondition=request.entryTap.condition;}
  if(request.entryConfigured){delete card.entryChoices;if(request.entryStats)card.battlefieldStats=structuredClone(request.entryStats);}
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
 // A token enters attacking as part of entry, before entry observers run.
 // This does not declare an attack or fire attack triggers.
 for(const request of requests)if(request.attacking)enterAttacking(g,request.id,request.attacking);
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
  validateCopyEffects(r.entryCopyEffects,fail);
  if(r.attacking){const t=r.attacking;if(!['player','card'].includes(t.kind)||!Number.isInteger(t.owner)||t.owner<0||t.owner>=playerCount||t.owner===r.owner||t.kind==='player'&&t.key!=='player:'+t.owner||t.kind==='card'&&(typeof t.id!=='string'||t.key!=='card:'+t.id||t.battlefieldId!==null&&typeof t.battlefieldId!=='string'))fail();}
  if(r.reanimationAura&&(typeof r.reanimationAura.id!=='string'||typeof r.reanimationAura.battlefieldId!=='string'||!Number.isInteger(r.reanimationAura.abilityOwner)||r.reanimationAura.abilityOwner<0||r.reanimationAura.abilityOwner>=playerCount))fail();
  if(r.entryTap&&(typeof r.entryTap.tapped!=='boolean'||r.entryTap.condition!==undefined&&(typeof r.entryTap.condition!=='string'||r.entryTap.condition.length>20000)||r.entryTap.life&&(!Number.isSafeInteger(r.entryTap.life.amount)||r.entryTap.life.amount<=0||r.entryTap.life.amount>999999||typeof r.entryTap.life.forcedTapped!=='boolean')))fail();
  if(r.entryConfigured!==undefined&&typeof r.entryConfigured!=='boolean'||r.entryStats&&(!r.entryConfigured||!Number.isInteger(r.entryStats.face)||r.entryStats.face<0||r.entryStats.face>1||Object.entries(r.entryStats).some(([key,n])=>!['face','power','toughness'].includes(key)||!Number.isSafeInteger(n)||Math.abs(n)>999999)))fail();
  if(r.token){const c=r.token;if(c.instance!==r.id||c.token!==true||c.ownerSeat!==r.owner||['name','type_line','oracle_text'].some(k=>typeof c[k]!=='string'||c[k].length>20000)||c.counters&&(typeof c.counters!=='object'||Array.isArray(c.counters)||Object.keys(c.counters).length)||c.card_faces&&(!Array.isArray(c.card_faces)||c.card_faces.length>2||c.card_faces.some(f=>!f||typeof f.name!=='string'||typeof f.type_line!=='string'||f.oracle_text!==undefined&&typeof f.oracle_text!=='string')))fail();}
  if(plan&&(!['stack','hand','command','graveyard','exile','library','token'].includes(r.from)||(r.from==='token')!==!!r.token||r.zoneChangeId!==null&&typeof r.zoneChangeId!=='string'))fail();
 }
 if(plan){validateCounterPlan(plan,fail,playerCount);if(plan.states.length!==requests.length||requests.some(r=>plan.states.filter(s=>s.cause==='entry'&&s.recipient.kind==='card'&&s.recipient.id===r.id&&s.recipient.owner===r.owner).length!==1))fail();}
}
export function validatePreparedEntries(g,pending,fail){
 const {entries,entryRequests}=pending;validateEntryRequests(entryRequests,fail,g.players.length);
 if(!Array.isArray(entries)||entries.length!==entryRequests.length)fail();
 for(const entry of entries){
  const c=entry?.card,r=entryRequests.find(r=>r.id===c?.instance);
  validateCopyEffects(c?.copyEffects,fail);
  if(entry.copyDecisions&&(!Array.isArray(entry.copyDecisions)||entry.copyDecisions.length>200||new Set(entry.copyDecisions).size!==entry.copyDecisions.length||entry.copyDecisions.some(key=>typeof key!=='string'||!/^\d+:\d+$/.test(key))))fail();
  if(entry.copyCounters&&(Object.keys(entry.copyCounters).some(key=>!['+1/+1','loyalty'].includes(key))||Object.values(entry.copyCounters).some(n=>n!==1)))fail();
  if(!r||entry.owner!==r.owner||typeof c.name!=='string'||!c.counters||Array.isArray(c.counters)||Object.entries(c.counters).some(([key,n])=>!key||key.length>100||!Number.isSafeInteger(n)||n<0||n>999999)||!Number.isSafeInteger(entry.compleatedLife)||entry.compleatedLife<0||entry.compleatedLife>999999||entry.compleatedLife%2)fail();
  if(!['stack','hand','command','graveyard','exile','library','token'].includes(r.from)||(r.from==='token')!==!!r.token||r.zoneChangeId!==null&&typeof r.zoneChangeId!=='string')fail();
  const found=findCard(g,r.id);
  if(r.token?!!found:found?.zone!==r.from||(found.card.zoneChangeId||null)!==r.zoneChangeId)fail();
  if(c.entryChoices&&(!Array.isArray(c.entryChoices)||c.entryChoices.length>40||new Set(c.entryChoices.map(x=>x?.key)).size!==c.entryChoices.length||c.entryChoices.some(x=>!x||! /^(?:power|toughness|counter:.{1,80})$/.test(x.key)||typeof x.label!=='string'||x.label.length>20000||!Number.isSafeInteger(x.min)||Math.abs(x.min)>999999||x.key.startsWith('counter:')&&x.min<0||!Number.isSafeInteger(x.suggested)||Math.abs(x.suggested)>999999)))fail();
  if(typeof c.tapped!=='boolean'||c.entryCondition!==undefined&&(typeof c.entryCondition!=='string'||c.entryCondition.length>20000)||c.entryLife&&(!Number.isSafeInteger(c.entryLife.amount)||c.entryLife.amount<=0||c.entryLife.amount>999999||typeof c.entryLife.forcedTapped!=='boolean'))fail();
  if(entry.tapState){const tap=entry.tapState;if(Object.keys(tap).length!==3||['forced','condition','life'].some(k=>typeof tap[k]!=='boolean')||c.tapped!==(tap.forced||tap.condition||tap.life||!!c.entryLife)||c.entryLife&&c.entryLife.forcedTapped!==(tap.forced||tap.condition))fail();}
  if(c.battlefieldStats&&(!Number.isInteger(c.battlefieldStats.face)||c.battlefieldStats.face<0||c.battlefieldStats.face>1||Object.entries(c.battlefieldStats).some(([key,n])=>!['face','power','toughness'].includes(key)||!Number.isSafeInteger(n)||Math.abs(n)>999999)))fail();
 }
 const choice=pendingEntryChoice(g,pending);
 if(new Set(entries.map(e=>e.card.instance)).size!==entries.length||!choice||choice.owner!==pending.owner||choice.index!==pending.entryIndex)fail();
}
