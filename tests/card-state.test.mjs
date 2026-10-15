import {test} from 'node:test';
import assert from 'node:assert/strict';
import {entryPlan,creatureStats,initializePermanent,applyEntryChoices} from '../card-state.mjs';
import {newGame,transfer,resolve,validateSession} from '../engine.mjs';
const card=(name,extra={})=>({name,instance:name,counters:{},face:0,...extra});
test('creature overlays combine printed stats, manual base values and stat counters',()=>{
 const creature=card('Bear',{type_line:'Creature — Bear',power:'2',toughness:'3',counters:{'+1/+1':2,'-1/-1':1,'+0/+1':3,charge:10}});
 assert.deepEqual(creatureStats(creature),{power:3,toughness:7,basePower:2,baseToughness:3});
 creature.battlefieldStats={face:0,power:5,toughness:6};assert.equal(creatureStats(creature).power,6);assert.equal(creatureStats(creature).toughness,10);
 creature.faceDown=true;assert.equal(creatureStats(creature),null);
});
test('printed loyalty, defense and Saga lore initialize on entry',()=>{
 for(const [type,extra,expected] of [['Legendary Planeswalker',{loyalty:'4'},{loyalty:4}],['Battle — Siege',{defense:'5'},{defense:5}],['Enchantment — Saga',{}, {lore:1}]])assert.deepEqual(entryPlan(card('Permanent',{type_line:type,...extra})).counters,expected);
 assert.equal(entryPlan(card('Saga',{type_line:'Enchantment — Saga',oracle_text:'Read ahead'})).choices[0].key,'counter:lore');
});
test('explicit self entering counters work across card types and do not invent counters',()=>{
 for(const [name,type,text,expected] of [
  ['Battery','Artifact','Battery enters with three charge counters on it.',{charge:3}],
  ['Protection','Enchantment','This enchantment enters the battlefield with eight isolation counters on it.',{isolation:8}],
  ['Hydra','Creature','Hydra enters with two +1/+1 counters on it.',{'+1/+1':2}],
  ['Many','Artifact','Many enters tapped with two charge counters and a shield counter on it.',{charge:2,shield:1}],
  ['Gift','Enchantment','Whenever another creature enters, put a +1/+1 counter on it.',{}],
  ['Ring','Artifact','{T}: Add {C}{C}.',{}],
  ['Modular','Artifact Creature','Modular 3', {'+1/+1':3}]
 ])assert.deepEqual(entryPlan(card(name,{type_line:type,oracle_text:text,power:'0',toughness:'0'})).counters,expected,name);
});
test('variable quantities and stats ask for values and apply atomically',()=>{
 const variable=card('Variable',{type_line:'Creature',power:'*',toughness:'1+*',oracle_text:'Variable enters with X +1/+1 counters on it.'});initializePermanent(variable);
 assert.deepEqual(variable.entryChoices.map(choice=>choice.key),['power','toughness','counter:+1/+1']);
 const before=structuredClone(variable);assert.throws(()=>applyEntryChoices(variable,{power:2,toughness:3,'counter:+1/+1':1.5}));assert.deepEqual(variable,before);
 applyEntryChoices(variable,{power:2,toughness:3,'counter:+1/+1':4});assert.equal(variable.entryChoices,undefined);assert.equal(creatureStats(variable).power,6);assert.equal(creatureStats(variable).toughness,7);
 const conditional=entryPlan(card('Conditional',{oracle_text:'Conditional enters with a charge counter on it for each artifact you control.'}));assert.deepEqual(conditional.counters,{});assert.equal(conditional.choices[0].key,'counter:charge');
});
test('defaults apply on resolution or direct entry, preserve control changes, and reset on reentry',()=>{
 const g=newGame(),walker=card('Walker',{type_line:'Planeswalker',loyalty:'4'});g.players[0].zones.hand=[walker];
 transfer(g,walker.instance,'stack',0);assert.deepEqual(walker.counters,{});resolve(g,'battlefield');assert.equal(walker.counters.loyalty,4);
 walker.counters.loyalty=7;transfer(g,walker.instance,'battlefield',1,{x:.5,y:.5});assert.equal(walker.counters.loyalty,7);transfer(g,walker.instance,'graveyard',1);assert.deepEqual(walker.counters,{});transfer(g,walker.instance,'battlefield',1);assert.equal(walker.counters.loyalty,4);
 walker.counters.loyalty=0;const restored=validateSession(structuredClone(g));assert.equal(restored.players[1].zones.battlefield[0].counters.loyalty,0,'Loading must not reset edited values');
 walker.battlefieldStats={face:0,power:2,toughness:3};transfer(g,walker.instance,'stack',1);assert.deepEqual(walker.counters,{});assert.equal(walker.battlefieldStats,undefined);
});
test('active face supplies starting metadata and hidden entries reveal no defaults',()=>{
 const double=card('Front // Back',{face:1,card_faces:[{type_line:'Creature',power:'1',toughness:'2'},{name:'Back',type_line:'Planeswalker',loyalty:'5'}]});assert.deepEqual(entryPlan(double).counters,{loyalty:5});
 double.faceDown=true;assert.deepEqual(entryPlan(double),{counters:{},choices:[]});
});
