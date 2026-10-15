import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,changeStep,advance,validateSession} from '../engine.mjs';
import {confirmAttackers,setAttacker} from '../combat.mjs';
import {autoPassEmptySteps} from '../phase-flow.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {addCombatPhase} from '../turn-plan.mjs';
import {castSpell} from '../casting.mjs';
const creature={instance:'Bear',name:'Bear',type_line:'Creature',power:'2',toughness:'3',oracle_text:'',counters:{},markedDamage:1};
const spell=(id,text='Draw a card.')=>({instance:id,name:id,type_line:'Sorcery',mana_cost:'{0}',oracle_text:text,counters:{}});
function table(count=2,mode='hold'){
 const g=newGame(count);g.step=3;g.responseMode=mode;g.players[0].zones.battlefield=[structuredClone(creature)];g.players[0].zones.hand=[spell('Postcombat play')];changeStep(g,4);advance(g,{automatic:false});return g;
}
for(const count of [2,3,4])for(const mode of ['auto','hold'])test(count+' seats, '+mode+': confirming zero attackers skips blockers and damage in local and shared play',()=>{
 const g=table(count,mode);g.players[0].mana=[{type:'R',amount:1}];const original=JSON.stringify(g);
 const local=reduceGameAction(g,{type:'confirmAttackers'},0).game,shared=reduceAction(g,{type:'confirmAttackers'},0).game;
 for(const next of [local,shared]){assert.equal(next.step,9);assert.equal(next.active,0);assert.equal(next.turn,1);assert.equal(next.combat.stage,'complete');assert.equal(next.combat.normalDone,true);assert.deepEqual(next.players.map(p=>p.life),Array(count).fill(40));assert.equal(next.players[0].zones.battlefield[0].markedDamage,1);assert.deepEqual(next.players[0].mana,[]);assert.equal(next.log.some(line=>/Declare blockers|Combat damage/.test(line)),false);validateSession(next);}
 assert.equal(JSON.stringify(g),original);
});
test('unconfirmed attackers remain a decision and required attackers cannot be declined',()=>{
 const g=table(2,'auto');autoPassEmptySteps(g);assert.equal(g.step,5);assert.equal(g.combat.attackersConfirmed,false);
 g.players[0].zones.battlefield[0].oracle_text='Bear attacks each combat if able.';assert.throws(()=>reduceGameAction(g,{type:'confirmAttackers'},0),/must attack/);assert.equal(g.step,5);
});
test('an automatically empty declaration with no eligible creatures also skips the remaining combat',()=>{
 for(const mode of ['auto','hold']){const g=table(2,mode);g.combat.attackersConfirmed=false;g.players[0].zones.battlefield[0].summoningSick=true;g.combat=null;changeStep(g,4);const next=reduceGameAction(g,{type:'advance'},0).game;assert.equal(next.step,9);assert.equal(next.players[0].zones.battlefield[0].summoningSick,true);}
});
test('a spell already on the stack finishes before empty combat advances',()=>{
 const g=table();confirmAttackers(g);g.players[0].zones.hand.push({...spell('Response'),type_line:'Instant'});g.players[0].zones.library=[spell('Draw')];castSpell(g,'Response');autoPassEmptySteps(g);assert.equal(g.step,5);assert.equal(g.stack.length,1);
 const passed=reduceGameAction(g,{type:'pass'},0).game,next=reduceGameAction(passed,{type:'pass'},1).game;assert.equal(next.stack.length,0);assert.equal(next.step,9);assert.ok(next.players[0].zones.hand.some(c=>c.instance==='Draw'));
});
test('declaring an attack then removing it from combat does not become a zero-attacker declaration',()=>{
 const g=table();setAttacker(g,'Bear','player:1');confirmAttackers(g);g.combat.attackers=[];autoPassEmptySteps(g);assert.equal(g.step,5);advance(g,{automatic:false});autoPassEmptySteps(g);assert.equal(g.step,6);assert.deepEqual(g.combat.defenders,[1]);
});
test('skipping an empty combat retains the next extra combat and its beginning effects',()=>{
 const g=table();g.players[0].zones.library=[spell('Extra draw')];addCombatPhase(g,{source:'Extra combat',beginEffect:{owner:0,source:creature,text:'Draw a card.'}});
 let next=reduceGameAction(g,{type:'confirmAttackers'},0).game;assert.equal(next.step,4);assert.equal(next.turnPlan.steps[next.turnPlan.index].extra,true);assert.equal(next.combatsThisTurn.count,2);assert.equal(next.stack.length,1);
 next=reduceGameAction(next,{type:'pass'},0).game;next=reduceGameAction(next,{type:'pass'},1).game;assert.ok(next.players[0].zones.hand.some(c=>c.instance==='Extra draw'));next=reduceGameAction(next,{type:'advance'},0).game;assert.equal(next.step,5);next=reduceGameAction(next,{type:'confirmAttackers'},0).game;assert.equal(next.step,9);assert.equal(next.players[0].zones.battlefield[0].markedDamage,1);validateSession(next);
});
