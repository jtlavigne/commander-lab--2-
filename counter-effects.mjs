import {cardFace} from './card-state.mjs';
import {activeRuleParagraphs,normalizeRules} from './ability-effects.mjs';
import {findCard} from './engine.mjs';
import {queueCombatTriggers,snapshotCard} from './combat-effects.mjs';
import {isCreature} from './creature-rules.mjs';

const whole=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999;
const clean=text=>normalizeRules(text).replace(/\s*\([^()]*\)\s*/g,' ').trim();
const hasType=(card,types)=>types.some(type=>type==='Creature'?isCreature(card):!card.faceDown&&new RegExp('\\b'+type+'\\b','i').test(cardFace(card).type_line||''));
// ---- Discover live counter replacement providers ----
// Descriptors retain source identity and paragraph identity. No card names are
// used to dispatch rules; a replacement is applied once to one counter event.
function providers(g,event,card){
 const result=[],player=event.recipient.kind==='player',owner=event.recipient.owner;
 for(const [controller,p] of g.players.entries())for(const source of p.zones.battlefield)if(!source.faceDown)for(const {text,index} of activeRuleParagraphs(source)){
  const rule=clean(text),base={key:source.instance+':'+index,name:source.name,kinds:null,effectOnly:false};
  if(!player&&controller===owner&&/^If an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead\.$/i.test(rule))result.push({...base,operation:'double',effectOnly:true});
  if(!player&&controller===owner&&hasType(card,['Creature'])&&/^If one or more \+1\/\+1 counters would be put on a creature you control, twice that many \+1\/\+1 counters are put on that creature instead\.$/i.test(rule))result.push({...base,operation:'double',kinds:['+1/+1']});
  if(controller===event.actor&&/^If you would put one or more counters on a permanent or player, put twice that many of each of those kinds of counters on that permanent or player instead\.$/i.test(rule))result.push({...base,operation:'double'});
  if(controller!==event.actor&&/^If an opponent would put one or more counters on a permanent or player, they put half that many of each of those kinds of counters on that permanent or player instead, rounded down\.$/i.test(rule))result.push({...base,operation:'half'});
  if(controller===owner&&(!player&&hasType(card,['Artifact','Creature'])&&/^If one or more counters would be put on an artifact or creature you control, that many plus one of each of those kinds of counters are put on that permanent instead\.$/i.test(rule)||player&&/^If you would get one or more counters, you get that many plus one of each of those kinds of counters instead\.$/i.test(rule)))result.push({...base,operation:'add'});
  if(controller===event.actor&&controller===owner&&(player||hasType(card,['Creature','Planeswalker']))&&/^If you would put one or more counters on a creature or planeswalker you control or on yourself, put that many plus one of each of those kinds of counters on that permanent or player instead\.$/i.test(rule))result.push({...base,operation:'add'});
 }return result;
}
// ---- Describe counter placement before changing any counts ----
// The actor places the counters; the recipient/controller chooses replacement
// order. These can be different players (for example, an opponent's poison).
export function permanentCounterEvent(g,actor,id,counters,cause='effect'){
 const found=findCard(g,id);if(found?.zone!=='battlefield')return null;
 return {actor,recipient:{kind:'card',id,owner:found.owner,battlefieldId:found.card.battlefieldId||null},counters,cause};
}
export const playerCounterEvent=(actor,owner,counters,cause='effect')=>({actor,recipient:{kind:'player',owner},counters,cause});
function initialState(g,event,enteringCard){
 if(!event||!Number.isInteger(event.actor)||!g.players[event.actor]||!Number.isInteger(event.recipient?.owner)||!g.players[event.recipient.owner]||!['card','player'].includes(event.recipient.kind)||!['effect','entry','cost','damage'].includes(event.cause)||!event.counters||typeof event.counters!=='object'||Array.isArray(event.counters)||Object.entries(event.counters).some(([kind,n])=>!kind||kind.length>100||!whole(n)))throw Error('Invalid counter event.');
 const found=event.recipient.kind==='card'?findCard(g,event.recipient.id):null,card=enteringCard||found?.card;
 if(!enteringCard&&event.recipient.kind==='card'&&(found?.zone!=='battlefield'||found.owner!==event.recipient.owner||(card.battlefieldId||null)!==event.recipient.battlefieldId))throw Error('Counter recipient is no longer that permanent.');
 let counters=Object.fromEntries(Object.entries(event.counters).filter(([,n])=>n>0));
 if(event.recipient.kind==='player')for(const kind of Object.keys(counters))if(g.players[event.recipient.owner].zones.battlefield.some(c=>!c.faceDown&&new RegExp(kind==='poison'?"You can't (?:get poison counters|get counters)\\.":"You can't get counters\\.",'i').test(cardFace(c).oracle_text||'')))delete counters[kind];
 return {...structuredClone(event),counters,effect:!['cost','damage'].includes(event.cause),providers:providers(g,event,card),applied:[],label:card?.name||g.players[event.recipient.owner].name};
}
function applies(state,rule){return !state.applied.includes(rule.key)&&(!rule.effectOnly||state.effect)&&Object.entries(state.counters).some(([kind,n])=>n>0&&(!rule.kinds||rule.kinds.includes(kind)));}
function commute(a,b,state){return a.operation===b.operation||!Object.keys(state.counters).some(kind=>(!a.kinds||a.kinds.includes(kind))&&(!b.kinds||b.kinds.includes(kind)));}
function apply(state,rule){
 for(const [kind,n] of Object.entries(state.counters))if(n>0&&(!rule.kinds||rule.kinds.includes(kind))){const next=rule.operation==='double'?n*2:rule.operation==='half'?Math.floor(n/2):rule.operation==='subtract'?Math.max(0,n-rule.amount):n+1;if(!whole(next))throw Error('Counter count is too large.');state.counters[kind]=next;}
 // CR 614.16: an effect-only replacement may become applicable after another
 // replacement places counters, even when the original placement was a cost.
 state.applied.push(rule.key);state.effect=true;
}
// ---- Resolve replacement order, then commit the simultaneous batch ----
// Plan data is serializable so a choice can survive reload or reconnect. Only
// commuting operations are automatic; other orders belong to the affected seat.
export function createCounterPlan(g,events){
 if(!Array.isArray(events)||events.length>500)throw Error('Too many counter events.');
 return {states:events.filter(Boolean).map(event=>initialState(g,event)).sort((a,b)=>(a.recipient.owner-g.active+g.players.length)%g.players.length-(b.recipient.owner-g.active+g.players.length)%g.players.length),index:0};
}
// Entry replacements are planned against the battlefield BEFORE the batch
// enters (CR 614.12). An incoming global provider cannot modify itself or
// another member of that simultaneous batch. Its intrinsic compleated
// replacement can still participate in the controller's chosen order.
export function createEntryCounterPlan(g,entries){
 if(!Array.isArray(entries)||entries.length>500)throw Error('Too many entering permanents.');
 const states=entries.map(({card,owner,compleatedLife=0})=>{
  if(!whole(compleatedLife)||compleatedLife%2)throw Error('Invalid compleated life payment.');
  const state=initialState(g,{actor:owner,recipient:{kind:'card',id:card.instance,owner,battlefieldId:card.battlefieldId||null},counters:card.counters,cause:'entry'},card);
  if(compleatedLife&&/(?:^|\n)Compleated\b/i.test(cardFace(card).oracle_text||'')&&/\bPlaneswalker\b/.test(cardFace(card).type_line||''))state.providers.push({key:card.instance+':compleated',name:card.name+' (compleated)',kinds:['loyalty'],effectOnly:false,operation:'subtract',amount:compleatedLife});
  return state;
 });
 return {states:states.sort((a,b)=>(a.recipient.owner-g.active+g.players.length)%g.players.length-(b.recipient.owner-g.active+g.players.length)%g.players.length),index:0};
}
export function advanceCounterPlan(plan,key){
 if(key!==undefined){const state=plan.states[plan.index],rule=state?.providers.find(rule=>rule.key===key&&applies(state,rule));if(!rule)throw Error('Choose an available counter replacement.');apply(state,rule);}
 while(plan.index<plan.states.length){const state=plan.states[plan.index],available=state.providers.filter(rule=>applies(state,rule));
  if(!available.length){plan.index++;continue;}
  if(available.some((a,i)=>available.slice(i+1).some(b=>!commute(a,b,state))))return {owner:state.recipient.owner,label:state.label,options:available};
  apply(state,available[0]);
 }return null;
}
export function commitCounterPlan(g,plan,{deferTriggers=false}={}){
 if(plan.index!==plan.states.length)throw Error('Finish counter replacement choices first.');
 const entries=plan.states.flatMap(state=>{const target=state.recipient,found=target.kind==='card'?findCard(g,target.id):null;if(g.players[target.owner].eliminated||target.kind==='card'&&(found?.zone!=='battlefield'||(found.card.battlefieldId||null)!==target.battlefieldId))return [];return [{state,card:found?.card,owner:target.kind==='card'?found.owner:target.owner}];});
 // Check every resulting total first so overflow cannot partially apply a batch.
 const totals=new Map();for(const {state,card,owner} of entries)for(const [kind,n] of Object.entries(state.counters)){const key=(card?.instance??'player:'+owner)+':'+kind,current=totals.get(key)??(card?card.counters?.[kind]||0:kind==='poison'?g.players[owner].poison||0:g.players[owner].counters?.[kind]||0);if(!whole(current+n))throw Error('Counter total is too large.');totals.set(key,current+n);}
 const events=[];for(const {state,card,owner} of entries){const counts=Object.fromEntries(Object.entries(state.counters).filter(([,n])=>n>0));for(const [kind,n] of Object.entries(counts)){if(card){card.counters??={};card.counters[kind]=(card.counters[kind]||0)+n;}else if(kind==='poison')g.players[owner].poison+=n;else{g.players[owner].counters??={};g.players[owner].counters[kind]=(g.players[owner].counters[kind]||0)+n;}}if(Object.keys(counts).length)events.push({kind:'counter',owner:state.actor,target:{...state.recipient},counters:counts,...(card?{card:snapshotCard(card)}:{})});}
 if(!deferTriggers)queueCombatTriggers(g,events);return events;
}
// Each proliferate replacement expands the original action once. The Oracle
// continuation marks the extra actions as expanded to avoid recursive doubling.
export function proliferateCount(g,owner){let count=1;for(const source of g.players[owner].zones.battlefield)if(!source.faceDown)for(const {text} of activeRuleParagraphs(source))if(/^If you would proliferate, proliferate twice instead\.$/i.test(clean(text)))count*=2;if(count>500)throw Error('Too many proliferate actions.');return count;}

// ---- Saved-choice validation ----
export function validateCounterPlan(plan,fail,playerCount){
 const seat=n=>Number.isInteger(n)&&n>=0&&n<playerCount,string=s=>typeof s==='string'&&s.length<=3000;
 if(!plan||!Array.isArray(plan.states)||plan.states.length>500||!Number.isInteger(plan.index)||plan.index<0||plan.index>plan.states.length)fail();
 for(const state of plan.states){if(!seat(state.actor)||!seat(state.recipient?.owner)||!['card','player'].includes(state.recipient.kind)||state.recipient.kind==='card'&&(!string(state.recipient.id)||state.recipient.battlefieldId!==null&&!string(state.recipient.battlefieldId))||!['effect','entry','cost','damage'].includes(state.cause)||typeof state.effect!=='boolean'||!string(state.label)||!state.counters||Array.isArray(state.counters)||Object.entries(state.counters).some(([kind,n])=>!kind||kind.length>100||!whole(n))||!Array.isArray(state.providers)||state.providers.length>1000||!Array.isArray(state.applied)||state.applied.length>1000||new Set(state.applied).size!==state.applied.length)fail();for(const rule of state.providers)if(!rule||!string(rule.key)||!string(rule.name)||!['double','half','add','subtract'].includes(rule.operation)||rule.operation==='subtract'&&(state.cause!=='entry'||!whole(rule.amount)||rule.amount===0)||typeof rule.effectOnly!=='boolean'||rule.kinds!==null&&(!Array.isArray(rule.kinds)||rule.kinds.some(k=>!string(k))))fail();if(state.applied.some(key=>!state.providers.some(rule=>rule.key===key)))fail();}
}
