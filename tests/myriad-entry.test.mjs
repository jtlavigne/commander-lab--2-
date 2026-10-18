import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,changeStep,validateSession,findCard} from '../engine.mjs';
import {setAttacker,confirmAttackers,confirmBlockers,applyCombatDamage} from '../combat.mjs';
import {resolveTop,counterTop} from '../casting.mjs';
import {resolveOracleChoice,oracleChoiceOptions,resolveCounterChoice,counterChoiceOptions} from '../oracle-effects.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards;
const card=(name,extra={})=>({instance:crypto.randomUUID(),name,type_line:'Creature',power:'2',toughness:'2',counters:{},oracle_text:'',...extra});
const real=name=>card(name,structuredClone(records.find(c=>c.name===name)));
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});c.summoningSick=false;return c;}
function setup(count=3,{double=true,add=true}={}){
 const g=newGame(count);g.step=3;g.responseMode='hold';for(const p of g.players)p.life=500;
 const source=enter(g,card('Myriad counter creature',{power:'0',toughness:'0',keywords:['Myriad'],oracle_text:'Myriad\nThis creature enters with two +1/+1 counters on it.\nWhen this creature enters, draw a card.'}));
 source.counters['+1/+1']=99;
 if(double)enter(g,real('Doubling Season'));if(add)enter(g,real("Lae'zel, Vlaakith's Champion"));
 const walker=enter(g,card('Defending walker',{type_line:'Planeswalker',loyalty:'5'}),2);
 g.players[0].zones.library=Array.from({length:10},(_,i)=>card('Private draw '+i));
 changeStep(g,5);setAttacker(g,source.instance,'player:1');confirmAttackers(g);
 return {g,source,walker};
}
function select(g,operation){const option=counterChoiceOptions(g).find(o=>o.operation===operation);assert.ok(option);resolveCounterChoice(g,option.key);}
function endCombat(g){changeStep(g,6);for(const owner of g.combat.defenders)confirmBlockers(g,owner);changeStep(g,7);applyCombatDamage(g);changeStep(g,8);}

for(const count of [3,4])test('Myriad stages a simultaneous entry batch with individual doubled defenders and counter choices in '+count+' seats',()=>{
 let {g,source,walker}=setup(count);g.stack.at(-1).text+=' Draw a card.';resolveTop(g);
 assert.equal(g.pendingEffect.step.op,'myriad');resolveOracleChoice(g,Array.from({length:count-2},(_,i)=>'player:'+(i+2)));
 const ids=g.pendingEffect.step.requests.map(r=>r.id);
 assert.equal(ids.length,2*(count-2));assert.equal(g.pendingEffect.step.op,'myriadDefenders');
 assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,0);assert.equal(g.combat.attackers.length,1);
 assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),['player:2','card:'+walker.instance]);
 assert.throws(()=>resolveOracleChoice(g,['player:1']),/available/);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,['card:'+walker.instance]);
 if(count===4){assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),['player:3']);resolveOracleChoice(g,['player:3']);}
 assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.players[0].zones.hand.length,0);
 assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,0);assert.equal(g.stack.length,0,'Entry triggers wait for the whole instruction program');
 let index=0;while(g.pendingEffect?.kind==='counter-choice'){
  const before=g.players[0].zones.battlefield.length;
  g=validateSession(JSON.parse(JSON.stringify(g)));select(g,index++%2?'double':'add');
  if(g.pendingEffect)assert.equal(g.players[0].zones.battlefield.length,before,'No partial batch enters');
 }
 const copies=g.players[0].zones.battlefield.filter(c=>c.token);
 assert.deepEqual(copies.map(c=>c.counters['+1/+1']),ids.map((_,i)=>i%2?5:6));
 assert.ok(copies.every(c=>c.tapped&&c.oracle_text===source.oracle_text));
 assert.equal(g.players[0].zones.hand.length,1,'Later draw happens once after entry');
 assert.equal(g.stack.length,copies.length,'Each entry draws once; entering attacking does not trigger Myriad');
 const attackers=g.combat.attackers.filter(a=>a.enteredAttacking);
 assert.equal(attackers.length,copies.length);assert.equal(attackers[0].defender.owner,2);assert.equal(attackers[1].defender.id,walker.instance);
 assert.equal(g.combat.endTriggers[0].tokens.length,copies.length);assert.equal(new Set(g.combat.endTriggers[0].tokens.map(t=>t.id)).size,copies.length);
 while(g.stack.length)resolveTop(g);endCombat(g);assert.equal(g.stack.length,1);counterTop(g);
 assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,copies.length,'End-combat exile is a respondable trigger');validateSession(g);
});

test('Myriad copies still enter with replacements after their source leaves and are exiled by the delayed trigger',()=>{
 let {g,source}=setup(3,{double:false,add:true});transfer(g,source.instance,'graveyard',0);resolveTop(g);resolveOracleChoice(g,['player:2']);
 const copy=g.players[0].zones.battlefield.find(c=>c.token);assert.equal(copy.counters['+1/+1'],3);assert.equal(copy.tapped,true);assert.equal(g.combat.attackers.filter(a=>a.enteredAttacking).length,1);
 while(g.stack.length)resolveTop(g);endCombat(g);resolveTop(g);assert.equal(findCard(g,copy.instance),null);assert.equal(findCard(g,source.instance).zone,'graveyard');
});

test('declining Myriad creates no tokens, choices or delayed triggers',()=>{
 const {g}=setup();resolveTop(g);resolveOracleChoice(g,[]);assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,0);assert.equal(g.combat.endTriggers,undefined);
});

test('copied animated permanents do not inherit animation or enter combat as noncreatures',()=>{
 const g=newGame(3);g.step=3;g.responseMode='hold';
 const source=enter(g,card('Myriad Vehicle',{type_line:'Artifact — Vehicle',power:'3',toughness:'3',oracle_text:'Myriad',keywords:['Myriad']}));source.animatedCreature=true;
 changeStep(g,5);setAttacker(g,source.instance,'player:1');confirmAttackers(g);resolveTop(g);resolveOracleChoice(g,['player:2']);
 const copy=g.players[0].zones.battlefield.find(c=>c.token);assert.ok(copy);assert.equal(copy.animatedCreature,undefined);assert.equal(copy.tapped,true);assert.equal(copy.type_line,'Artifact — Vehicle');
 assert.equal(g.combat.attackers.filter(a=>a.enteredAttacking).length,0);assert.equal(g.combat.endTriggers[0].tokens[0].id,copy.instance);validateSession(g);
});

test('saved Myriad entry choices reject malformed attackers, duplicate token references and invalid indices',()=>{
 const {g}=setup();resolveTop(g);resolveOracleChoice(g,['player:2']);validateSession(structuredClone(g));
 for(const corrupt of [p=>p.step.requests[0].attacking.owner=0,p=>p.step.requests[0].attacking.key='player:1',p=>p.step.choices.push(p.step.choices[0]),p=>p.step.index=999,p=>p.step.requests[0].token.ownerSeat=1]){
  const saved=structuredClone(g);corrupt(saved.pendingEffect);assert.throws(()=>validateSession(saved));
 }
});
