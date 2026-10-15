import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,draw,transfer,endTurn} from '../engine.mjs';
import {presentationState,drawChanges} from '../turn-presentation.mjs';
const card=name=>({instance:crypto.randomUUID(),name,type_line:'Basic Land',oracle_text:'',counters:{}});
test('draw animation changes count actual successful draws, not setup, searches or ordinary transfers',()=>{
 const g=newGame(2);g.players[0].zones.library=Array.from({length:6},()=>card('Hidden draw'));let before=presentationState(g);draw(g,0,2,{opening:true});assert.deepEqual(drawChanges(before,presentationState(g)),[]);before=presentationState(g);transfer(g,g.players[0].zones.library[0].instance,'hand',0);assert.deepEqual(drawChanges(before,presentationState(g)),[]);draw(g,0,2);const after=presentationState(g);assert.deepEqual(drawChanges(before,after),[{owner:0,amount:2}]);assert.deepEqual(drawChanges(after,after),[]);draw(g,0,3);assert.deepEqual(drawChanges(after,presentationState(g)),[{owner:0,amount:1}]);
});
test('draw presentation resets correctly across turn boundaries and contains no card identity',()=>{
 const g=newGame(2);g.players[0].zones.library=[card('Private name')];draw(g,0);const before=presentationState(g);endTurn(g);g.players[1].zones.library=[card('Another secret')];draw(g,1);const after=presentationState(g);assert.deepEqual(drawChanges(before,after),[{owner:1,amount:1}]);assert.equal(after.turn,'1:1');assert.ok(!JSON.stringify(after).includes('secret'));assert.deepEqual(before.draws,[1,0]);
});

test('turn presentation starts after opening-hand readiness rather than lobby start',()=>{
 const g=newGame(2);g.lobby={status:'playing'};g.opening={status:'choosing'};assert.equal(presentationState(g).playing,false);g.opening.status='complete';assert.equal(presentationState(g).playing,true);
});
