import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,changeStep,advance,endTurn,validateSession} from '../engine.mjs';
import {castSpell,resolveTop,counterTop,activateMana} from '../casting.mjs';
import {setAttacker,confirmAttackers,confirmBlockers,applyCombatDamage,combatStats} from '../combat.mjs';
import {addMana,activatedAbilities,manaTotals} from '../mana.mjs';
import {addCombatPhase} from '../turn-plan.mjs';
import {keywordSet,attackError} from '../creature-rules.mjs';
const cards=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/aurelia_the_warleader.json',import.meta.url))).cards;
const card=name=>({...structuredClone(cards.find(c=>c.name===name)),instance:crypto.randomUUID(),counters:{},face:0});
const game=()=>{const g=newGame(2);g.step=3;g.responseMode='hold';return g;};
const enter=(g,name)=>{const c=card(name);g.players[0].zones.hand.push(c);transfer(g,c.instance,'battlefield',0);c.summoningSick=false;return c;};
const begin=g=>{changeStep(g,4);advance(g,{automatic:false});};
const attack=(g,ids)=>{for(const id of ids)setAttacker(g,id,'player:1');confirmAttackers(g);};
function finish(g){advance(g,{automatic:false});confirmBlockers(g,1);advance(g,{automatic:false});while(!g.combat.normalDone)applyCombatDamage(g);advance(g,{automatic:false});}
test('Aurelia’s printed haste permits attacking on entry, vigilance leaves it untapped, and flying is active',()=>{
 const g=game(),a=enter(g,'Aurelia, the Warleader');a.summoningSick=true;assert.equal(attackError(g,0,a),'');for(const keyword of ['haste','vigilance','flying'])assert.ok(keywordSet(g,0,a).has(keyword));begin(g);attack(g,[a.instance]);assert.equal(a.tapped,false);
});
test('Aurelia’s first attack untaps on trigger resolution and inserts a fresh combat before the normal main phase',()=>{
 const g=game(),a=enter(g,'Aurelia, the Warleader'),ally=enter(g,'Combat Celebrant');ally.oracle_text='';a.markedDamage=1;begin(g);attack(g,[a.instance,ally.instance]);assert.equal(g.stack.length,1);assert.equal(ally.tapped,true);assert.equal(g.turnPlan,undefined);resolveTop(g);assert.equal(ally.tapped,false);assert.equal(g.turnPlan.steps.length,17);assert.equal(a.attackHistory.count,1);finish(g);assert.equal(g.step,8);advance(g,{automatic:false});assert.equal(g.step,4);assert.equal(g.active,0);assert.equal(g.combat.attackers.length,0);assert.equal(g.combat.blocks.length,0);assert.equal(a.markedDamage,1);advance(g,{automatic:false});attack(g,[a.instance,ally.instance]);assert.equal(g.stack.length,0,'Second attack cannot trigger Aurelia again');assert.equal(a.attackHistory.count,2);finish(g);advance(g,{automatic:false});assert.equal(g.step,9);assert.equal(a.markedDamage,1);changeStep(g,11);assert.equal(a.markedDamage,undefined);
});
test('countering the extra-combat trigger prevents its untap and extra phase',()=>{
 const g=game(),a=enter(g,'Aurelia, the Warleader'),ally=enter(g,'Combat Celebrant');ally.oracle_text='';begin(g);attack(g,[a.instance,ally.instance]);counterTop(g);assert.equal(ally.tapped,true);assert.equal(g.turnPlan,undefined);finish(g);advance(g,{automatic:false});assert.equal(g.step,9);
});
test('once-per-turn attack memory survives control changes and reload, but reentry is a fresh permanent',()=>{
 const g=game(),a=enter(g,'Aurelia, the Warleader');begin(g);attack(g,[a.instance]);resolveTop(g);let restored=validateSession(structuredClone(g));const c=restored.players[0].zones.battlefield[0];assert.equal(c.attackHistory.count,1);transfer(restored,c.instance,'battlefield',1);transfer(restored,c.instance,'battlefield',0);assert.equal(c.attackHistory.count,1);transfer(restored,c.instance,'exile',0);transfer(restored,c.instance,'battlefield',0);assert.equal(c.attackHistory,undefined);
});
test('Relentless Assault inserts combat plus main without replacing the normally scheduled combat',()=>{
 const g=game(),a=enter(g,'Aurelia, the Warleader');a.oracle_text='';a.tapped=true;a.attackHistory={turn:'1:0',count:1};const spell=card('Relentless Assault');g.players[0].zones.hand.push(spell);addMana(g.players[0],{R:2,C:2});castSpell(g,spell.instance);assert.equal(g.turnPlan,undefined);resolveTop(g);assert.equal(a.tapped,false);assert.equal(g.turnPlan.steps.length,18);assert.doesNotThrow(()=>validateSession(structuredClone(g)));advance(g,{automatic:false});assert.equal(g.step,4);advance(g,{automatic:false});attack(g,[a.instance]);finish(g);advance(g,{automatic:false});assert.equal(g.step,9);advance(g,{automatic:false});assert.equal(g.step,4,'The ordinary combat is still scheduled');assert.equal(g.players[0].zones.graveyard[0].name,'Relentless Assault');
});
test('multiple insertions after the same phase use newest-first ordering and survive a saved session',()=>{
 const g=game();addCombatPhase(g,{mainAfter:true,source:'First'});addCombatPhase(g,{source:'Second'});assert.deepEqual(g.turnPlan.steps.filter(e=>e.step===4).map(e=>e.source||'ordinary'),['Second','First','ordinary']);const loaded=validateSession(structuredClone(g));assert.deepEqual(loaded.turnPlan,g.turnPlan);endTurn(loaded);assert.equal(loaded.turnPlan,undefined);assert.equal(loaded.active,1);
});
test('Karlach’s first-combat trigger untaps attackers, grants first strike, and cannot repeat in the extra combat',()=>{
 const g=game(),k=enter(g,'Karlach, Fury of Avernus');begin(g);attack(g,[k.instance]);assert.equal(k.tapped,true);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(k.tapped,false);assert.ok(k.temporaryKeywords.includes('first strike'));assert.equal(g.combatsThisTurn.count,1);finish(g);advance(g,{automatic:false});advance(g,{automatic:false});attack(g,[k.instance]);assert.equal(g.combatsThisTurn.count,2);assert.equal(g.stack.length,0);
});
test('Aggravated Assault pays for a stack ability, then untaps and adds combat plus main',()=>{
 const g=game(),source=enter(g,'Aggravated Assault'),a=enter(g,'Combat Celebrant');a.oracle_text='';a.tapped=true;addMana(g.players[0],{C:3,R:2});activateMana(g,source.instance,activatedAbilities(g,0,source)[0].id);assert.equal(a.tapped,true);assert.equal(g.turnPlan,undefined);resolveTop(g);assert.equal(a.tapped,false);assert.equal(g.turnPlan.steps.length,18);
});
test('extra phases do not reset land plays, summoning sickness, damage or the active player',()=>{
 const g=game(),a=enter(g,'Aurelia, the Warleader');a.summoningSick=true;a.markedDamage=1;g.players[0].landsPlayed=1;addCombatPhase(g);advance(g,{automatic:false});assert.equal(g.active,0);assert.equal(g.players[0].landsPlayed,1);assert.equal(a.summoningSick,true);assert.equal(a.markedDamage,1);assert.ok(combatStats(g,0,a));
});
test('manual navigation into an extra combat preserves mana explicitly retained until end of turn',()=>{
 const g=game();addCombatPhase(g);addMana(g.players[0],{G:2},{retain:'turn'});addMana(g.players[0],{R:1});changeStep(g,4);assert.equal(manaTotals(g.players[0]).G,2);assert.equal(manaTotals(g.players[0]).R,0);endTurn(g);assert.equal(manaTotals(g.players[0]).G,0);
});
