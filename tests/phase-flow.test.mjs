import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,advance,draw,changeStep,transfer} from '../engine.mjs';
import {autoPassEmptySteps} from '../phase-flow.mjs';
import {addCombatPhase} from '../turn-plan.mjs';
const card=(name,extra={})=>({instance:name,name,counters:{},type_line:'Artifact',oracle_text:'',...extra});
const game=()=>{const g=newGame(2);g.responseMode='auto';g.players[0].zones.library=[card('Draw1'),card('Draw2')];return g;};
test('empty untap/upkeep skip, required manual draw stops, and automatic draw happens once',()=>{
 const g=game();autoPassEmptySteps(g);assert.equal(g.step,2);assert.equal(g.players[0].zones.hand.length,0);draw(g,0);autoPassEmptySteps(g);assert.equal(g.step,3);assert.equal(g.players[0].zones.hand.length,1);
 const a=game();autoPassEmptySteps(a,{automatic:true});assert.equal(a.step,3);assert.equal(a.players[0].zones.hand.length,1);autoPassEmptySteps(a,{automatic:true});assert.equal(a.players[0].zones.hand.length,1);
});
test('manual untap actions and privacy response mode stop phase automation',()=>{
 const g=game();g.players[0].zones.battlefield=[card('Tapped',{tapped:true})];autoPassEmptySteps(g);assert.equal(g.step,0);autoPassEmptySteps(g,{automatic:true});assert.equal(g.step,3);assert.equal(g.players[0].zones.battlefield[0].tapped,false);const h=game();h.responseMode='hold';assert.equal(autoPassEmptySteps(h,{automatic:true}),0);assert.equal(h.step,0);
});
test('empty combat and main phases skip to the next required action but an eligible attacker retains declarations',()=>{
 const g=game();g.step=3;advance(g);autoPassEmptySteps(g);assert.equal(g.step,2);assert.equal(g.active,1);
 const c=game();c.step=3;c.players[0].zones.battlefield=[card('Bear',{type_line:'Creature',power:'2',toughness:'2'})];advance(c);autoPassEmptySteps(c);assert.equal(c.step,5);assert.equal(c.combat.attackersConfirmed,false);
});
test('precombat main remains a human decision after the last affordable action',()=>{
 const g=game();g.step=3;g.players[0].zones.hand=[card('Forest',{type_line:'Basic Land — Forest'})];autoPassEmptySteps(g);assert.equal(g.step,3);g.players[0].landsPlayed=1;autoPassEmptySteps(g);assert.equal(g.step,3);assert.equal(g.active,0);
 const h=game();h.step=3;h.players[0].zones.hand=[card('Bear',{type_line:'Creature',mana_cost:'{G}'})];h.players[0].zones.battlefield=[card('Forest',{type_line:'Basic Land — Forest'})];autoPassEmptySteps(h);assert.equal(h.step,3);assert.equal(h.players[0].zones.battlefield[0].tapped,undefined);
});
test('automatic handoffs give every seat a main phase even with empty hands and no affordable actions',()=>{
 for(const count of [2,3,4]){const g=newGame(count);g.responseMode='auto';g.players[0].zones.library=[card('Uncastable',{mana_cost:'{20}'})];autoPassEmptySteps(g,{automatic:true});
  for(let n=0;n<count*2;n++){assert.equal(g.active,n%count);assert.equal(g.step,3);assert.equal(g.turn,Math.floor(n/count)+1);const before=g.turn+':'+g.active;autoPassEmptySteps(g,{automatic:true});assert.equal(g.turn+':'+g.active,before);assert.equal(g.step,3);advance(g,{automatic:true});autoPassEmptySteps(g,{automatic:true});}
 }
});
test('automatic skipping does not untap a skip-next-untap permanent twice',()=>{
 const g=game(),c=card('Exerted',{tapped:true,skipNextUntap:true});g.players[0].zones.battlefield=[c];autoPassEmptySteps(g,{automatic:true});assert.equal(g.step,3);assert.equal(c.tapped,true);assert.equal(c.skipNextUntap,undefined);
});
test('many empty additional combats skip to the next player’s main without consuming that turn',()=>{
 const g=game();g.step=3;for(let n=0;n<10;n++)addCombatPhase(g);advance(g,{automatic:true});autoPassEmptySteps(g,{automatic:true});assert.equal(g.active,1);assert.equal(g.step,3);assert.equal(g.turn,1);
});
test('a sick creature cannot supply hypothetical mana for a response',()=>{
 const g=game();g.step=1;g.players[1].zones.hand=[card('Response',{type_line:'Instant',mana_cost:'{G}'})];g.players[1].zones.battlefield=[card('Sick elf',{type_line:'Creature',power:'1',toughness:'1',oracle_text:'{T}: Add {G}.',summoningSick:true})];autoPassEmptySteps(g);assert.equal(g.step,2);
});
test('manual stack placement retains a decision instead of resolving through phase automation',()=>{
 const g=game();g.step=3;const spell=card('Manual spell',{type_line:'Sorcery',mana_cost:'{1}'});g.players[0].zones.hand.push(spell);transfer(g,spell.instance,'stack',0);autoPassEmptySteps(g);assert.equal(g.stack.length,1);assert.equal(g.stack[0].card.instance,spell.instance);assert.equal(g.step,3);
});
test('real response availability stops auto passing, including untapped mana sources',()=>{
 const g=game();g.step=1;g.players[1].zones.hand=[card('Answer',{type_line:'Instant',mana_cost:'{U}'})];g.players[1].zones.battlefield=[card('Island',{type_line:'Basic Land — Island'})];autoPassEmptySteps(g);assert.equal(g.step,1);assert.equal(g.players[1].zones.battlefield[0].tapped,undefined);
});
test('upkeep and end triggers run before skipping; unknown effects preserve explicit review',()=>{
 const g=game();g.players[0].zones.battlefield=[card('Upkeep',{oracle_text:'At the beginning of your upkeep, draw a card.\nAt the beginning of your end step, perform an unsupported test action.'})];advance(g);autoPassEmptySteps(g);assert.equal(g.step,2);assert.equal(g.players[0].zones.hand.length,1);draw(g,0);autoPassEmptySteps(g);assert.equal(g.step,3);changeStep(g,10);autoPassEmptySteps(g);assert.equal(g.step,10);assert.equal(g.pendingEffect.kind,'combat-manual');
});
test('cleanup preserves discard choices and no maximum hand size permissions; empty tables never spin turns',()=>{
 const g=game();g.step=11;g.players[0].zones.hand=Array.from({length:8},(_,i)=>card('H'+i));autoPassEmptySteps(g);assert.equal(g.step,11);g.players[0].zones.battlefield=[card('Vessel',{oracle_text:'You have no maximum hand size.'})];autoPassEmptySteps(g);assert.equal(g.active,1);assert.equal(g.step,2);const empty=newGame(2);assert.equal(autoPassEmptySteps(empty,{automatic:true}),0);
});
