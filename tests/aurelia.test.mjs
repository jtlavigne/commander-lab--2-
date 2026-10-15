import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,untap} from '../engine.mjs';
import {activateMana,resolveTop} from '../casting.mjs';
import {manaAbilities,manaTotals} from '../mana.mjs';
import {oracleChoiceOptions,resolveOracleChoice} from '../oracle-effects.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/aurelia_the_warleader.json',import.meta.url)));
const card=name=>{const data=fixture.cards.find(c=>c.name===name);assert.ok(data,name+' is cached');return {...structuredClone(data),instance:crypto.randomUUID(),counters:{},face:0};};
const game=()=>{const g=newGame(2);g.step=3;g.responseMode='hold';g.players[0].zones.command=[{...card('Aurelia, the Warleader'),commander:true}];return g;};
const enter=(g,name,owner=0)=>{const c=card(name);g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);return c;};
for(const name of ['Worn Powerstone','Path of Ancestry','Myriad Landscape','Boros Garrison','Wind-Scarred Crag','Boros Guildgate'])test('Aurelia entry audit: '+name+' enters tapped and cannot immediately produce mana',()=>{
 const g=game(),c=enter(g,name);assert.equal(c.tapped,true);assert.equal(c.entryCondition,undefined);const ability=manaAbilities(g,0,c)[0];assert.ok(ability);assert.throws(()=>activateMana(g,c.instance,ability.id),/tapped/);assert.equal(manaTotals(g.players[0]).C,0);
});
test('Aurelia: Boros Garrison’s entry trigger offers only controlled lands, including itself',()=>{
 const g=game(),mountain=enter(g,'Mountain'),foreign=enter(g,'Plains',1);enter(g,'Sol Ring');const garrison=enter(g,'Boros Garrison');assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect.step.op,'selectMove');assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[mountain.instance,garrison.instance]);assert.throws(()=>resolveOracleChoice(g,[]),/at least/);assert.throws(()=>resolveOracleChoice(g,[foreign.instance]),/available/);assert.doesNotThrow(()=>validateSession(structuredClone(g)));resolveOracleChoice(g,[mountain.instance]);assert.equal(g.players[0].zones.hand[0].instance,mountain.instance);assert.equal(garrison.tapped,true);untap(g,0);activateMana(g,garrison.instance,manaAbilities(g,0,garrison)[0].id);assert.equal(manaTotals(g.players[0]).W,1);assert.equal(manaTotals(g.players[0]).R,1);
});
test('Aurelia: a lone bounce land returns itself and a stolen land returns to its owner',()=>{
 const g=game(),c=enter(g,'Boros Garrison');resolveTop(g);resolveOracleChoice(g,[c.instance]);assert.equal(g.players[0].zones.battlefield.length,0);assert.equal(g.players[0].zones.hand[0].instance,c.instance);
 const h=game(),foreign=enter(h,'Plains',1);transfer(h,foreign.instance,'battlefield',0);enter(h,'Boros Garrison');resolveTop(h);resolveOracleChoice(h,[foreign.instance]);assert.ok(h.players[1].zones.hand.includes(foreign));assert.equal(h.players[0].zones.hand.length,0);
});
test('Aurelia: Wind-Scarred Crag gains life through its entry trigger, without changing its tapped state',()=>{
 const g=game(),c=enter(g,'Wind-Scarred Crag',1);assert.equal(g.players[1].life,40);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[1].life,41);assert.equal(g.players[0].life,40);assert.equal(c.tapped,true);transfer(g,c.instance,'battlefield',0);assert.equal(g.stack.length,0);transfer(g,c.instance,'hand',0);transfer(g,c.instance,'battlefield',0);resolveTop(g);assert.equal(g.players[0].life,41);
});
test('Aurelia: its basic lands enter untapped and produce the expected color',()=>{
 for(const [name,color] of [['Plains','W'],['Mountain','R']]){const g=game(),c=enter(g,name);assert.equal(c.tapped,false);activateMana(g,c.instance,manaAbilities(g,0,c)[0].id);assert.equal(manaTotals(g.players[0])[color],1);}
});
