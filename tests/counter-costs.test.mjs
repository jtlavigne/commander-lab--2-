import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession} from '../engine.mjs';
import {activatedAbilities,activationError,addMana,manaTotals} from '../mana.mjs';
import {activateMana,resolveTop,counterTop} from '../casting.mjs';
import {counterRemovalCost,counterCostOptions} from '../counter-costs.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {keywordSet} from '../creature-rules.mjs';
import {counterChoiceOptions,resolveCounterChoice} from '../oracle-effects.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards;
function enter(g,name,owner=0,extra={}){const c={...structuredClone(records.find(c=>c.name===name)||{name,type_line:'Artifact',oracle_text:''}),instance:crypto.randomUUID(),counters:{},...extra};g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);return c;}
function setup(){const g=newGame(3);g.step=3;g.responseMode='hold';const source=enter(g,'Tekuthal, Inquiry Dominus'),artifact=enter(g,'Artifact'),creature=enter(g,'Creature',0,{type_line:'Creature',power:'2',toughness:'2'});artifact.counters={charge:2};creature.counters={'+1/+1':2};addMana(g.players[0],{C:1,U:2});const ability=activatedAbilities(g,0,source).find(a=>a.counterRemoval);assert.ok(ability);return {g,source,artifact,creature,ability};}
const part=(card,kind,amount)=>({id:card.instance,battlefieldId:card.battlefieldId,kind,amount});
const pay=({g,source,artifact,creature,ability},choice={})=>activateMana(g,source.instance,ability.id,{counterPayments:[part(artifact,'charge',1),part(creature,'+1/+1',2)],...choice});

test('Tekuthal removes chosen counters as a cost, then grants indestructible only on resolution',()=>{
 const s=setup();assert.equal(s.ability.manualCost,false);assert.equal(s.ability.counterRemoval.amount,3);pay(s);assert.deepEqual(s.artifact.counters,{charge:1});assert.deepEqual(s.creature.counters,{});assert.equal(s.source.counters.indestructible,undefined);assert.equal(s.g.stack.length,1);assert.equal(s.g.players[0].life,40);assert.equal(manaTotals(s.g.players[0]).U,0);
 resolveTop(s.g);assert.equal(s.source.counters.indestructible,1);assert.ok(keywordSet(s.g,0,s.source).has('indestructible'));assert.equal(s.g.pendingEffect,undefined);
});
for(const [spend,life] of [[{C:1,U:2},0],[{C:1,U:1},2],[{C:1},4]])test('activation payment supports exactly '+life+' life with chosen mana',()=>{
 const s=setup();pay(s,{allowLife:true,spend});assert.equal(s.g.players[0].life,40-life);assert.equal(manaTotals(s.g.players[0]).U,life/2);counterTop(s.g);assert.equal(s.source.counters.indestructible,undefined);assert.equal(s.artifact.counters.charge,1,'Countering does not refund costs');
});
test('only controlled eligible other permanents contribute, including public face-down creatures',()=>{
 const s=setup(),enemy=enter(s.g,'Opponent',1),land=enter(s.g,'Forest'),enchantment=enter(s.g,'Enchantment',0,{type_line:'Enchantment'}),manifest=enter(s.g,'Secret',0,{faceDown:true,manifested:true,type_line:'Sorcery'});
 for(const c of [s.source,enemy,land,enchantment,manifest])c.counters={charge:9};
 const options=counterCostOptions(s.g,0,s.source,s.ability.counterRemoval);assert.deepEqual(new Set(options.map(o=>o.id)),new Set([s.artifact.instance,s.creature.instance,manifest.instance]));assert.equal(options.find(o=>o.id===manifest.instance).name,'Face-down creature');
 s.artifact.counters={};s.creature.counters={};manifest.counters={charge:2};assert.match(activationError(s.g,0,s.source,s.ability),/eligible counters/);
});
test('invalid counts, duplicate rows, foreign cards and stale incarnations are rejected transactionally',()=>{
 const s=setup(),valid=[part(s.artifact,'charge',1),part(s.creature,'+1/+1',2)],foreign=enter(s.g,'Foreign',1);foreign.counters={charge:3};
 for(const counterPayments of [[],[valid[0],valid[0],valid[0]],[part(s.artifact,'charge',3)],[part(foreign,'charge',3)],[{...valid[0],amount:-1},valid[1]],[{...valid[0],battlefieldId:'old'},valid[1]],[{...valid[0],amount:1.5},valid[1]]]){
  const before=structuredClone(s.g);assert.throws(()=>reduceGameAction(s.g,{type:'activate',id:s.source.instance,ability:s.ability.id,choice:{counterPayments}},0),/counters|eligible/);assert.deepEqual(s.g,before);
 }
});
test('combined fixed life and Phyrexian costs cannot overpay life, and life use is explicit',()=>{
 const s=setup();s.g.players[0].mana=[{type:'C',amount:1}];s.g.players[0].life=3;
 assert.match(activationError(s.g,0,s.source,s.ability),/mana/);assert.throws(()=>pay(s,{allowLife:true}),/mana/);
 s.g.players[0].life=6;s.source.oracle_text=s.source.oracle_text.replace('Remove three','Pay 3 life, Remove three');const ability=activatedAbilities(s.g,0,s.source).find(a=>a.counterRemoval);assert.match(activationError(s.g,0,s.source,ability),/mana/);
 s.g.players[0].life=8;assert.equal(activationError(s.g,0,s.source,ability),'');assert.throws(()=>pay({...s,ability}),/mana/);pay({...s,ability},{allowLife:true});assert.equal(s.g.players[0].life,1);
});
test('removing last loyalty kills the donor after activation while the ability remains on the stack',()=>{
 const s=setup(),walker=enter(s.g,"Elspeth, Sun's Champion");walker.counters.loyalty=3;
 pay(s,{counterPayments:[part(walker,'loyalty',3)]});assert.ok(s.g.players[0].zones.graveyard.some(c=>c.instance===walker.instance));assert.equal(s.g.stack.length,1);resolveTop(s.g);assert.equal(s.source.counters.indestructible,1);
});
test('a returned source is a different permanent and receives no counter from its old ability',()=>{
 const s=setup();pay(s);transfer(s.g,s.source.instance,'hand',0);transfer(s.g,s.source.instance,'battlefield',0);resolveTop(s.g);assert.equal(s.source.counters.indestructible,undefined);assert.equal(s.g.pendingEffect,undefined);
});
test('counter multipliers apply to the resolving reward, never to removed cost counters; replacement choice reloads',()=>{
 let s=setup();enter(s.g,'Vorinclex, Monstrous Raider');enter(s.g,'Winding Constrictor');pay(s);assert.equal(s.artifact.counters.charge,1);assert.deepEqual(s.creature.counters,{});resolveTop(s.g);assert.equal(s.g.pendingEffect.kind,'counter-choice');
 const g=validateSession(JSON.parse(JSON.stringify(s.g)));resolveCounterChoice(g,counterChoiceOptions(g).find(o=>o.operation==='add').key);assert.equal(g.players[0].zones.battlefield.find(c=>c.instance===s.source.instance).counters.indestructible,4);
});
test('the shared cost descriptor supports fixed kinds and other type unions without card-name dispatch',()=>{
 const s=setup(),cost=counterRemovalCost('Remove two +1/+1 counters from among creatures or artifacts you control');assert.equal(cost.amount,2);assert.equal(cost.kind,'+1/+1');assert.equal(cost.other,false);assert.deepEqual(cost.types,['creature','artifact']);assert.deepEqual(counterCostOptions(s.g,0,s.source,cost).map(o=>o.id),[s.creature.instance]);
});
