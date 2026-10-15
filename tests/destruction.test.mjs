import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,findCard} from '../engine.mjs';
import {removePermanents,stateBasedActions,dealDamagePackets} from '../combat.mjs';
import {castSpell,resolveTop} from '../casting.mjs';
import {addMana} from '../mana.mjs';
import {combatStats} from '../creature-rules.mjs';
import {resolveDestructionChoice} from '../oracle-effects.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/arahbo_roar_of_the_world.json',import.meta.url))).cards;
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';return g;};
function cat(g,owner=0){const c={instance:crypto.randomUUID(),name:'Cat',type_line:'Creature — Cat',power:'2',toughness:'3',counters:{}};g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);return c;}
function armor(g,name,c){const a={...structuredClone(records.find(r=>r.name===name)),instance:crypto.randomUUID(),counters:{}};g.players[0].zones.hand.push(a);transfer(g,a.instance,'battlefield',0,undefined,{attachTo:c.instance});return a;}
for(const name of ['Bear Umbra','Snake Umbra'])test(name+' replaces destruction, clears all damage and destroys itself instead of its creature',()=>{
 const g=game(),c=cat(g),a=armor(g,name,c);c.markedDamage=2;removePermanents(g,[c.instance]);assert.ok(g.players[0].zones.battlefield.includes(c));assert.ok(g.players[0].zones.graveyard.includes(a));assert.equal(c.markedDamage,undefined);assert.equal(g.pendingEffect,undefined);
});
test('armor protects from lethal and deathtouch damage, but not sacrifice, zero toughness, exile or an unattached Aura',()=>{
 for(const damage of ['lethal','deathtouch']){const g=game(),c=cat(g),a=armor(g,'Bear Umbra',c);c.markedDamage=damage==='lethal'?combatStats(g,0,c).toughness:1;c.deathtouchDamage=damage==='deathtouch';stateBasedActions(g);assert.ok(g.players[0].zones.battlefield.includes(c));assert.ok(g.players[0].zones.graveyard.includes(a));assert.equal(c.deathtouchDamage,undefined);}
 for(const mode of ['sacrifice','zero','exile']){const g=game(),c=cat(g),a=armor(g,'Snake Umbra',c);if(mode==='sacrifice')removePermanents(g,[c.instance],{sacrifice:true});if(mode==='zero'){c.counters['-1/-1']=4;stateBasedActions(g);}if(mode==='exile'){transfer(g,c.instance,'exile',0);stateBasedActions(g);}stateBasedActions(g);assert.ok(!g.players[0].zones.battlefield.includes(c));assert.ok(g.players[0].zones.graveyard.includes(a));}
});
test('indestructibility prevents destruction without consuming armor; an indestructible Aura can still replace destruction',()=>{
 const g=game(),c=cat(g),a=armor(g,'Bear Umbra',c);c.temporaryKeywords=['indestructible'];removePermanents(g,[c.instance]);assert.ok(g.players[0].zones.battlefield.includes(a));delete c.temporaryKeywords;a.temporaryKeywords=['indestructible'];c.markedDamage=3;removePermanents(g,[c.instance]);assert.ok(g.players[0].zones.battlefield.includes(a));assert.ok(g.players[0].zones.battlefield.includes(c));assert.equal(c.markedDamage,undefined);
});
test('simultaneously destroying the creature and its armor still protects the creature once',()=>{
 const g=game(),c=cat(g),a=armor(g,'Bear Umbra',c);removePermanents(g,[c.instance,a.instance]);assert.ok(g.players[0].zones.battlefield.includes(c));assert.ok(g.players[0].zones.graveyard.includes(a));
});
for(const count of [2,3,4])test(count+' seats choose one of multiple armor replacements during lethal-damage state actions, preserving reload and ownership',()=>{
 let g=game(count),c=cat(g),a=armor(g,'Bear Umbra',c),b=armor(g,'Snake Umbra',c);c.markedDamage=6;stateBasedActions(g);assert.equal(g.pendingEffect.kind,'destruction-choice');assert.ok(g.players[0].zones.battlefield.includes(a));g=validateSession(JSON.parse(JSON.stringify(g)));assert.throws(()=>reduceAction(g,{type:'destructionChoice',id:b.instance},1),/choosing/);g=reduceAction(g,{type:'destructionChoice',id:b.instance},0).game;assert.equal(g.pendingEffect,undefined);assert.equal(findCard(g,b.instance).zone,'graveyard');assert.equal(findCard(g,a.instance).zone,'battlefield');assert.equal(findCard(g,c.instance).card.markedDamage,undefined);
});
test('a replacement choice pauses a compound spell before its follow-up and resumes that spell exactly once',()=>{
 let g=game(),c=cat(g),a=armor(g,'Bear Umbra',c),b=armor(g,'Snake Umbra',c),spell={...structuredClone(records.find(r=>r.name==='Beast Within')),instance:crypto.randomUUID(),counters:{}};g.players[1].zones.hand.push(spell);addMana(g.players[1],{G:1,C:2});castSpell(g,spell.instance,{targets:['card:'+c.instance]});resolveTop(g);assert.equal(g.pendingEffect.kind,'destruction-choice');assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,0);assert.equal(findCard(g,spell.instance).zone,'stack');g=validateSession(JSON.parse(JSON.stringify(g)));resolveDestructionChoice(g,b.instance);assert.equal(g.pendingEffect,undefined);assert.equal(findCard(g,spell.instance).zone,'graveyard');assert.equal(g.players[0].zones.battlefield.filter(c=>c.token&&c.name==='Beast').length,1);assert.equal(findCard(g,c.instance).zone,'battlefield');assert.equal(findCard(g,a.instance).zone,'battlefield');
});
