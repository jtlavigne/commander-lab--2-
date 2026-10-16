import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,endTurn,changeStep,untap,validateSession,resetGame} from '../engine.mjs';
import {activateLoyaltyAction,activateMana,resolveTop,counterTop,passPriority} from '../casting.mjs';
import {queueCombatTriggers,chooseTriggerTarget} from '../combat-effects.mjs';
import {dealDamagePackets,stateBasedActions} from '../combat.mjs';
import {loyaltyStatus,activatedLoyaltyThisTurn} from '../planeswalker.mjs';
import {effectTargetOptions} from '../effect-targets.mjs';
import {addMana,activatedAbilities} from '../mana.mjs';
import {addExtraTurns,phaseOut} from '../turn-effects.mjs';
import {applyOracleEffect} from '../oracle-effects.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards;
const card=(name,extra={})=>({instance:crypto.randomUUID(),name,type_line:'Creature',power:'3',toughness:'6',oracle_text:'',counters:{},...extra});
const real=name=>{const found=records.find(c=>c.name===name);assert.ok(found,name);return card(name,structuredClone(found));};
function game(count=2){const g=newGame(count);g.step=3;g.responseMode='hold';for(const p of g.players)p.zones.library=Array.from({length:15},(_,i)=>card('Draw '+i,{type_line:'Instant'}));return g;}
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
function targetAbility(g,source,index,targets){activateLoyaltyAction(g,source.instance,index);chooseTriggerTarget(g,g.stack.at(-1).id,targets.map(c=>typeof c==='string'?c:'card:'+c.instance));}
function damage(g,sources,{combat=true,player=1}={}){const events=dealDamagePackets(g,sources.map(card=>({source:{owner:g.players.findIndex(p=>p.zones.battlefield.includes(card)),card},target:{kind:'player',owner:player},amount:1})),combat);stateBasedActions(g,{damageEvents:events});}
function resolveAll(g){for(let guard=0;g.stack.length&&guard<20;guard++)resolveTop(g);assert.equal(g.pendingEffect,undefined);}

test('Chain Veil end-step penalty checks the activating player even after the walker leaves or changes control',()=>{
 for(const change of ['graveyard','control','none']){let g=game();enter(g,real('The Chain Veil'));const t=enter(g,real('Teferi, Master of Time'));activateLoyaltyAction(g,t.instance,0);counterTop(g);assert.equal(activatedLoyaltyThisTurn(g,0),true);if(change==='graveyard')transfer(g,t.instance,'graveyard',0);if(change==='control')transfer(g,t.instance,'battlefield',1);
 g=validateSession(JSON.parse(JSON.stringify(g)));changeStep(g,10);assert.equal(g.stack.length,0);assert.equal(g.players[0].life,40);assert.equal(activatedLoyaltyThisTurn(g,1),false);}
});

test('Chain Veil penalty triggers without activation, can be countered, and history resets for the next turn',()=>{
 const g=game();enter(g,real('The Chain Veil'));changeStep(g,10);assert.equal(g.stack.length,1);assert.equal(g.players[0].life,40);counterTop(g);assert.equal(g.players[0].life,40);endTurn(g);endTurn(g);g.step=3;changeStep(g,10);resolveTop(g);assert.equal(g.players[0].life,38);assert.equal(g.pendingEffect,undefined);
 const h=game();enter(h,real('The Chain Veil'));const t=enter(h,real('Teferi, Master of Time'));activateLoyaltyAction(h,t.instance,0);counterTop(h);endTurn(h);endTurn(h);h.step=3;assert.equal(activatedLoyaltyThisTurn(h,0),false);changeStep(h,10);resolveTop(h);assert.equal(h.players[0].life,38);
});

test('Chain Veil intervening condition rechecks an instant-speed loyalty activation made in response',()=>{
 const g=game();enter(g,real('The Chain Veil'));const t=enter(g,real('Teferi, Master of Time'));changeStep(g,10);assert.equal(g.stack.length,1);activateLoyaltyAction(g,t.instance,0);counterTop(g);resolveTop(g);assert.equal(g.players[0].life,40);assert.equal(g.pendingEffect,undefined);
});

test('Chain Veil repeated resolutions extend later planeswalkers and stack with Oath permission until turn ends',()=>{
 let g=game();const veil=enter(g,real('The Chain Veil')),oath=enter(g,real('Oath of Teferi'));addMana(g.players[0],{C:8});const ability=activatedAbilities(g,0,veil).find(a=>a.text.startsWith('For each planeswalker'));
 for(let i=0;i<2;i++){veil.tapped=false;activateMana(g,veil.instance,ability.id);assert.equal(g.loyaltyEffects?.[0]?.extra||0,i);resolveTop(g);}
 transfer(g,veil.instance,'graveyard',0);const later=enter(g,real('Tamiyo, Field Researcher'));assert.equal(loyaltyStatus(g,0,later).limit,4);g=validateSession(JSON.parse(JSON.stringify(g)));for(let i=0;i<4;i++){const live=g.players[0].zones.battlefield.find(c=>c.instance===later.instance);targetAbility(g,live,0,[]);resolveTop(g);}assert.throws(()=>activateLoyaltyAction(g,later.instance,0),/limit/);assert.equal(g.loyaltyHistory.counts[0],4);transfer(g,oath.instance,'graveyard',0);assert.equal(loyaltyStatus(g,0,g.players[0].zones.battlefield[0]).limit,3);endTurn(g);assert.equal(loyaltyStatus(g,0,g.players[0].zones.battlefield[0]).limit,1);
});

test('Tamiyo watches both controllers creatures and draws for the ability controller after Tamiyo leaves',()=>{
 let g=game();const t=enter(g,real('Tamiyo, Field Researcher')),a=enter(g,card('Own')),b=enter(g,card('Opponent'),1);targetAbility(g,t,0,[a,b]);assert.equal(g.delayedTriggers,undefined);resolveTop(g);transfer(g,t.instance,'graveyard',0);g=validateSession(JSON.parse(JSON.stringify(g)));const [own]=g.players[0].zones.battlefield,[other]=g.players[1].zones.battlefield;damage(g,[own,other]);assert.equal(g.stack.length,2);assert.equal(g.players[0].zones.hand.length,0);assert.ok(g.stack.every(e=>e.owner===0));resolveAll(g);assert.equal(g.players[0].zones.hand.length,2);assert.equal(g.players[1].zones.hand.length,0);assert.equal(g.delayedTriggers.length,1);
});

test('Tamiyo triggers once for a creature dealing simultaneous damage to several recipients, again for another strike',()=>{
 const g=game(),t=enter(g,real('Tamiyo, Field Researcher')),a=enter(g,card('Trampler')),blocker=enter(g,card('Blocker'),1);targetAbility(g,t,0,[a]);resolveTop(g);const events=dealDamagePackets(g,[{source:{owner:0,card:a},target:{kind:'card',owner:1,id:blocker.instance},amount:1},{source:{owner:0,card:a},target:{kind:'player',owner:1},amount:1}],true);stateBasedActions(g,{damageEvents:events});assert.equal(g.stack.length,1);resolveAll(g);damage(g,[a]);assert.equal(g.stack.length,1);resolveAll(g);assert.equal(g.players[0].zones.hand.length,2);damage(g,[a],{combat:false});assert.equal(g.stack.length,0);
});

test('Tamiyo draw watches expire at the next turn of the ability controller, including an extra turn',()=>{
 for(const extra of [false,true]){const g=game(3),t=enter(g,real('Tamiyo, Field Researcher')),a=enter(g,card('Watched'));targetAbility(g,t,0,[a]);resolveTop(g);if(extra)addExtraTurns(g,0,1);else{endTurn(g);assert.equal(g.delayedTriggers.length,1);damage(g,[a],{player:2});resolveAll(g);endTurn(g);assert.equal(g.delayedTriggers.length,1);}endTurn(g);assert.equal(g.active,0);assert.equal(g.delayedTriggers.length,0);damage(g,[a]);assert.equal(g.stack.length,0);}
});

test('Tamiyo distinguishes leaving and returning from phasing, and keeps triggers after a watched creature dies',()=>{
 const g=game(),t=enter(g,real('Tamiyo, Field Researcher')),a=enter(g,card('Watched'));targetAbility(g,t,0,[a]);resolveTop(g);phaseOut(g,a.instance);assert.equal(g.delayedTriggers.length,1);const phased=g.phasedOut.pop();g.players[0].zones.battlefield.push(phased.card);damage(g,[a]);transfer(g,a.instance,'graveyard',0);assert.equal(g.stack.length,1);resolveAll(g);assert.equal(g.players[0].zones.hand.length,1);transfer(g,a.instance,'battlefield',0);damage(g,[a]);assert.equal(g.stack.length,0);
});

test('Tamiyo allows zero targets, rejects a third target, and tracks only surviving announced targets',()=>{
 for(const mode of ['zero','partial','all','countered']){const g=game(),t=enter(g,real('Tamiyo, Field Researcher')),a=enter(g,card('A')),b=enter(g,card('B')),c=enter(g,card('C'));activateLoyaltyAction(g,t.instance,0);assert.throws(()=>chooseTriggerTarget(g,g.stack.at(-1).id,[a,b,c].map(c=>'card:'+c.instance)),/target/i);chooseTriggerTarget(g,g.stack.at(-1).id,mode==='zero'?[]:[a,b].map(c=>'card:'+c.instance));if(['partial','all'].includes(mode))transfer(g,a.instance,'graveyard',0);if(mode==='all')transfer(g,b.instance,'graveyard',0);if(mode==='countered')counterTop(g);else resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(g.delayedTriggers?.length||0,mode==='partial'?1:mode==='zero'||mode==='all'||mode==='countered'?0:1);if(mode==='partial')assert.deepEqual(g.delayedTriggers[0].targets.map(t=>t.id),[b.instance]);}
});

test('Tamiyo freeze accepts two nonlands, survives source removal and skips only one untap after other untap effects',()=>{
 const g=game(),t=enter(g,real('Tamiyo, Field Researcher')),a=enter(g,card('Own')),b=enter(g,card('Other',{type_line:'Artifact'}),1),land=enter(g,real('Forest'),1);activateLoyaltyAction(g,t.instance,1);assert.ok(!effectTargetOptions(g,g.stack.at(-1)).some(o=>o.id===land.instance));chooseTriggerTarget(g,g.stack.at(-1).id,[a,b].map(c=>'card:'+c.instance));resolveTop(g);assert.ok(a.tapped&&b.tapped&&a.skipNextUntap&&b.skipNextUntap);transfer(g,t.instance,'graveyard',0);
 applyOracleEffect(g,{owner:0,name:'Untap',source:card('Untapper'),text:'Untap another target creature or land you control.',targets:[{kind:'card',id:a.instance,owner:0,battlefieldId:a.battlefieldId}]});assert.equal(a.tapped,false);assert.equal(a.skipNextUntap,true);a.tapped=true;endTurn(g,{automatic:true});assert.equal(b.tapped,true);assert.equal(b.skipNextUntap,undefined);endTurn(g,{automatic:true});assert.equal(a.tapped,true);assert.equal(a.skipNextUntap,undefined);endTurn(g,{automatic:true});assert.equal(b.tapped,false);endTurn(g,{automatic:true});assert.equal(a.tapped,false);
});

test('new loyalty history and damage watches validate, reset cleanly and reject malformed saved state',()=>{
 const g=game(),t=enter(g,real('Tamiyo, Field Researcher')),a=enter(g,card('Watched'));assert.throws(()=>activateLoyaltyAction(g,t.instance,2),/loyalty/i);assert.equal(g.loyaltyHistory,undefined);targetAbility(g,t,0,[a]);resolveTop(g);validateSession(JSON.parse(JSON.stringify(g)));for(const mutate of [h=>h.loyaltyHistory.counts[0]=-1,h=>h.delayedTriggers[0].targets[0].battlefieldId=42,h=>h.delayedTriggers[0].untilNextTurn=false]){const h=structuredClone(g);mutate(h);assert.throws(()=>validateSession(h));}const clean=resetGame(g);assert.equal(clean.loyaltyHistory,undefined);assert.equal(clean.delayedTriggers,undefined);
});

test('shortened legendary self-references grant timing only to that permanent',()=>{
 const g=game(),t=enter(g,real('Teferi, Master of Time')),other=enter(g,real('Teferi, Hero of Dominaria'));g.active=1;g.step=10;
 assert.equal(loyaltyStatus(g,0,t).instant,true);assert.equal(loyaltyStatus(g,0,other).instant,false);activateLoyaltyAction(g,t.instance,0);assert.equal(g.loyaltyHistory.counts[0],1);counterTop(g);assert.throws(()=>activateLoyaltyAction(g,t.instance,0),/limit/);transfer(g,t.instance,'battlefield',1);assert.equal(loyaltyStatus(g,1,t).used,1);assert.equal(activatedLoyaltyThisTurn(g,1),false);
});
