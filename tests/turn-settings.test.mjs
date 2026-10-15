import {projectGame} from '../multiplayer/protocol.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,advance,endTurn,resetGame,changePlayerCount,validateSession} from '../engine.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {autoPassEmptySteps} from '../phase-flow.mjs';

const card=()=>({instance:crypto.randomUUID(),name:'Forest',type_line:'Basic Land — Forest',counters:{},tapped:true});
function game(count){const g=newGame(count);g.step=3;for(const p of g.players){p.zones.library=[card(),card()];p.zones.battlefield=[card()];}return g;}

for(const count of [2,3,4])test(count+' seats use the incoming player automatic setting across turn boundaries',()=>{
 const g=game(count);g.players.forEach((p,i)=>p.automatic=i%2===1);
 for(let i=1;i<=count;i++){
  const owner=i%count,enabled=g.players[owner].automatic;
  endTurn(g,{automatic:!enabled});autoPassEmptySteps(g,{automatic:!enabled});
  assert.equal(g.active,owner);assert.equal(g.players[owner].zones.battlefield[0].tapped,!enabled);
  assert.equal(g.players[owner].zones.hand.length,enabled?1:0);assert.equal(g.step,enabled?3:0);
 }
});

test('draw-step entry and cleanup advancement both consult the active seat',()=>{
 const g=game(2);g.players[0].automatic=false;g.players[1].automatic=true;g.step=1;
 advance(g,{automatic:true});assert.equal(g.players[0].zones.hand.length,0);
 g.step=11;advance(g,{automatic:false});assert.equal(g.active,1);assert.equal(g.players[1].zones.battlefield[0].tapped,false);
 advance(g,{automatic:false});advance(g,{automatic:false});assert.equal(g.players[1].zones.hand.length,1);
 autoPassEmptySteps(g);assert.equal(g.players[1].zones.hand.length,1,'The draw step never draws twice');
});

test('preferences are saved, reset and restored for inactive seats',()=>{
 let g=game(4);g.players.forEach((p,i)=>p.automatic=i%2===1);
 g=validateSession(JSON.parse(JSON.stringify(g)));g=resetGame(g);g=changePlayerCount(changePlayerCount(g,2),4);
 assert.deepEqual(g.players.map(p=>p.automatic),[false,true,false,true]);
 g.players[1].automatic='yes';assert.throws(()=>validateSession(g),/Invalid session/);
});

test('each client can change only its own preference without advancing another seat',()=>{
 const g=game(3);g.step=0;const before=structuredClone(g);
 const next=reduceAction(g,{type:'automatic',enabled:true},1).game;
 assert.equal(projectGame(next,1).networkOptions.automatic,true);assert.equal(projectGame(next,0).networkOptions.automatic,false);
 assert.equal(next.players[1].automatic,true);assert.equal(next.players[0].automatic,undefined);
 assert.equal(next.step,0);assert.equal(next.players[0].zones.battlefield[0].tapped,true);assert.deepEqual(g,before);
 for(const host of [false,true])assert.throws(()=>reduceAction(next,{type:'automatic',owner:0,enabled:true},1,{host}),/own seat/);
 for(const enabled of [null,'true',1])assert.throws(()=>reduceGameAction(next,{type:'automatic',enabled},1),/Invalid automatic/);
});
