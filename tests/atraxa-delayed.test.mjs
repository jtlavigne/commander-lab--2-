import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,changeStep} from '../engine.mjs';
import {activateLoyaltyAction,resolveTop,passPriority,counterTop} from '../casting.mjs';
import {queueCombatTriggers,chooseTriggerTarget} from '../combat-effects.mjs';
import {oracleChoiceOptions,resolveOracleChoice,applyOracleEffect} from '../oracle-effects.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards;
const card=(name,extra={})=>({instance:crypto.randomUUID(),name,type_line:'Artifact',mana_cost:'{2}',oracle_text:'',counters:{},...extra});
const real=name=>card(name,structuredClone(records.find(c=>c.name===name)));
function game(){const g=newGame(2);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}

test('Teferi draws on resolution, then creates a separately respondable end-step untap choice that survives its source',()=>{
 let g=game();const t=enter(g,real('Teferi, Hero of Dominaria')),own=enter(g,real('Forest')),other=enter(g,real('Island'),1);own.tapped=other.tapped=true;g.players[0].zones.library=[card('Draw')];
 activateLoyaltyAction(g,t.instance,0);assert.equal(g.players[0].zones.hand.length,0);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.delayedTriggers.length,1);assert.equal(other.tapped,true);transfer(g,t.instance,'graveyard',0);
 g=validateSession(JSON.parse(JSON.stringify(g)));changeStep(g,10);assert.equal(g.stack.length,1);assert.equal(g.pendingEffect,undefined);assert.equal(g.delayedTriggers.length,0);resolveTop(g);
 assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[own.instance,other.instance]);assert.throws(()=>passPriority(g,0),/pending/);g=validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[other.instance]);assert.equal(g.players[0].zones.battlefield[0].tapped,true);assert.equal(g.players[1].zones.battlefield[0].tapped,false);assert.equal(g.pendingEffect,undefined);
});

test('a countered delayed trigger does not untap; a delay created during an end step waits for the next one',()=>{
 const g=game(),land=enter(g,real('Forest'));land.tapped=true;g.step=10;
 assert.equal(applyOracleEffect(g,{owner:0,source:card('Delay'),text:'At the beginning of the next end step, untap up to two lands.'}),true);assert.equal(g.stack.length,0);g.turn++;g.active=1;queueCombatTriggers(g,[{kind:'end-step',owner:1}]);assert.equal(g.stack.length,1);counterTop(g);assert.equal(land.tapped,true);assert.equal(g.delayedTriggers.length,0);
});

test('third-from-top returns stolen permanents to the owner without shuffling and handles short libraries',()=>{
 for(const length of [0,1,2,5]){const g=game(),t=enter(g,real('Teferi, Hero of Dominaria')),target=enter(g,card('Stolen',{ownerSeat:1}));const library=Array.from({length},(_,i)=>card('Existing '+i));g.players[1].zones.library=[...library];
 activateLoyaltyAction(g,t.instance,1);chooseTriggerTarget(g,g.stack.at(-1).id,['card:'+target.instance]);resolveTop(g);assert.equal(g.pendingEffect,undefined);const result=g.players[1].zones.library;assert.equal(result[Math.min(2,length)].instance,target.instance);assert.deepEqual(result.filter(c=>c!==target).map(c=>c.instance),library.map(c=>c.instance));assert.equal(g.players[0].zones.library.length,0);}
});

test('third-from-top rejects a target that left and returned after announcement',()=>{
 const g=game(),t=enter(g,real('Teferi, Hero of Dominaria')),target=enter(g,card('Target'));activateLoyaltyAction(g,t.instance,1);chooseTriggerTarget(g,g.stack.at(-1).id,['card:'+target.instance]);transfer(g,target.instance,'exile',0);transfer(g,target.instance,'battlefield',0);resolveTop(g);assert.ok(g.players[0].zones.battlefield.includes(target));
});

test('Vraska adds the difference at resolution through counter replacements, never reducing existing poison',()=>{
 for(const initial of [0,4,9]){const g=game(),v=enter(g,real("Vraska, Betrayal's Sting"));v.counters.loyalty=9;g.players[1].poison=initial;activateLoyaltyAction(g,v.instance,2);chooseTriggerTarget(g,g.stack.at(-1).id,['player:1']);assert.equal(g.players[1].poison,initial);resolveTop(g);assert.equal(g.players[1].poison,9);assert.equal(g.pendingEffect,undefined);}
 const g=game(),v=enter(g,real("Vraska, Betrayal's Sting"));v.counters.loyalty=10;g.players[1].poison=3;enter(g,real('Vorinclex, Monstrous Raider'));activateLoyaltyAction(g,v.instance,2);chooseTriggerTarget(g,g.stack.at(-1).id,['player:1']);g.players[1].poison=5;resolveTop(g);assert.equal(g.players[1].poison,13);
});

test('Vraska poison addition respects a recipient who cannot receive poison counters',()=>{
 const g=game(),v=enter(g,real("Vraska, Betrayal's Sting"));v.counters.loyalty=10;enter(g,card('Protection',{oracle_text:"You can't get poison counters."}),1);activateLoyaltyAction(g,v.instance,2);chooseTriggerTarget(g,g.stack.at(-1).id,['player:1']);resolveTop(g);assert.equal(g.players[1].poison,0);
});

test('Oath excludes itself, exiles on resolution and returns under the owner with fresh entry triggers after source removal',()=>{
 let g=game();const target=enter(g,card('Visitor',{type_line:'Creature',power:'2',toughness:'2',ownerSeat:1,oracle_text:'When this creature enters, draw a card.'}));target.counters['+1/+1']=3;g.players[1].zones.library=[card('Return draw')];const oath=real('Oath of Teferi');g.players[0].zones.hand.push(oath);transfer(g,oath.instance,'battlefield',0);
 assert.throws(()=>chooseTriggerTarget(g,g.stack.at(-1).id,['card:'+oath.instance]),/legal/);chooseTriggerTarget(g,g.stack.at(-1).id,['card:'+target.instance]);resolveTop(g);assert.equal(g.players[1].zones.exile[0].instance,target.instance);assert.equal(g.delayedTriggers.length,1);transfer(g,oath.instance,'graveyard',0);
 g=validateSession(JSON.parse(JSON.stringify(g)));changeStep(g,10);g=validateSession(JSON.parse(JSON.stringify(g)));assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[1].zones.battlefield[0].instance,target.instance);assert.deepEqual(g.players[1].zones.battlefield[0].counters,{});assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[1].zones.hand[0].name,'Return draw');
});

test('delayed exile return cannot recover a token, a new exile incarnation, or a countered return',()=>{
 for(const mode of ['token','moved','countered']){const g=game(),target=enter(g,card('Target',{token:mode==='token'})),oath=real('Oath of Teferi');g.players[0].zones.hand.push(oath);transfer(g,oath.instance,'battlefield',0);chooseTriggerTarget(g,g.stack.at(-1).id,['card:'+target.instance]);resolveTop(g);
 if(mode==='moved'){transfer(g,target.instance,'graveyard',0);transfer(g,target.instance,'exile',0);}changeStep(g,10);if(g.stack.length){if(mode==='countered')counterTop(g);else resolveTop(g);}assert.ok(!g.players[0].zones.battlefield.some(c=>c.instance===target.instance));assert.equal(g.pendingEffect,undefined);}
});

test('saved delayed exile references reject malformed owners and survive valid round trips',()=>{
 const g=game(),target=enter(g,card('Target')),oath=real('Oath of Teferi');g.players[0].zones.hand.push(oath);transfer(g,oath.instance,'battlefield',0);chooseTriggerTarget(g,g.stack.at(-1).id,['card:'+target.instance]);resolveTop(g);
 const saved=JSON.parse(JSON.stringify(g));saved.delayedTriggers[0].source.delayedExile.owner=99;assert.throws(()=>validateSession(saved));validateSession(JSON.parse(JSON.stringify(g)));
});
