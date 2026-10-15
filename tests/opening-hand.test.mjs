import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lobbyGame} from '../lobby.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {newGame,validateSession} from '../engine.mjs';
import {bottomCount,freeMulligans} from '../opening-hand.mjs';
import {autoPassEmptySteps} from '../phase-flow.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
function start(count=2,mulligan={mode:'regular',extraFree:1},format='freeform'){
 let g=lobbyGame({count,format,mulligan});
 for(let owner=0;owner<count;owner++){
  g=reduceGameAction(g,{type:'import',library:Array.from({length:30},(_,i)=>({instance:owner+'-'+i,name:'Private '+owner+' '+i,type_line:'Basic Land',counters:{}})),command:[]},owner).game;
  g=reduceGameAction(g,{type:'lobbyReady',ready:true},owner).game;g=reduceGameAction(g,{type:'lobbyAcknowledge',seat:owner,accepted:true},0).game;
 }return reduceGameAction(g,{type:'lobbyStart'},0).game;
}
const act=(g,type,owner=0,extra={})=>reduceGameAction(g,{type,...extra},owner,{automatic:true}).game;
test('direct table imports open starting hands after the final seat; explicit reset reopens them',()=>{
 let g=newGame(2);
 for(let owner=0;owner<2;owner++){
  g=act(g,'import',owner,{library:Array.from({length:20},(_,i)=>({instance:owner+'-'+i,name:'Forest',type_line:'Basic Land',counters:{}})),command:[]});
  assert.equal(g.opening?.status,owner===1?'choosing':undefined);
 }
 assert.ok(g.players.every(p=>p.zones.hand.length===7));assert.equal(g.step,0);
 for(let owner=0;owner<2;owner++)g=act(g,'openingReady',owner);
 assert.equal(g.opening.status,'complete');
 g=act(g,'reset',0,{opening:true});assert.equal(g.opening.status,'choosing');
 assert.ok(g.opening.players.every(p=>!p.ready));
 assert.throws(()=>act(newGame(2),'reset',0,{opening:true}),/Import a deck/);
});
for(const count of [2,3,4])test(count+' seats wait for every keep and ready confirmation without skipping setup',()=>{
 let g=start(count);assert.equal(g.step,0);assert.equal(autoPassEmptySteps(g,{automatic:true}),0);
 for(let owner=0;owner<count;owner++){
  assert.throws(()=>act(g,'advance'),/opening hands/);assert.equal(g.opening.players[owner].ready,false);
  g=act(g,'openingKeep',owner,{bottom:[]});g=act(g,'openingReady',owner);
  assert.equal(g.opening.status,owner===count-1?'complete':'choosing');
 }assert.equal(g.step,0);assert.ok(g.players.every(p=>p.zones.hand.length===7));
 assert.throws(()=>act(g,'openingMulligan'),/finished/);assert.throws(()=>reduceAction(g,{type:'openingReady',owner:0},1),/own seat/);
});
test('London rounds wait for decisions, require ordered bottom cards and preserve every card',()=>{
 let g=start(),ids=g.players.flatMap(p=>Object.values(p.zones).flat().map(c=>c.instance)).sort(),old=g.players[0].zones.hand.map(c=>c.instance);
 g=act(g,'openingMulligan');assert.deepEqual(g.players[0].zones.hand.map(c=>c.instance),old);assert.equal(g.opening.round,0);
 g=act(g,'openingKeep',1);assert.equal(g.opening.round,1);assert.equal(bottomCount(g,0),1);
 g=act(g,'openingMulligan');assert.equal(bottomCount(g,0),2);assert.equal(g.opening.round,2);
 const chosen=g.players[0].zones.hand.slice(0,2).map(c=>c.instance),before=JSON.stringify(g);
 for(const bottom of [[],[chosen[0],chosen[0]],['foreign',chosen[0]]])assert.throws(()=>act(g,'openingKeep',0,{bottom}),/Select exactly/);
 assert.equal(JSON.stringify(g),before);g=act(g,'openingKeep',0,{bottom:chosen});assert.equal(g.players[0].zones.hand.length,5);assert.deepEqual(g.players[0].zones.library.slice(-2).map(c=>c.instance),chosen);
 assert.deepEqual(g.players.flatMap(p=>Object.values(p.zones).flat().map(c=>c.instance)).sort(),ids);assert.equal(g.drawHistory,undefined);assert.equal(g.turnDrawStamp,undefined);assert.equal(g.stack.length,0);
});
test('regular multiplayer and Brawl allowances differ from duel; Extra adds configured free redraws',()=>{
 for(const [count,format,mode,extra,free] of [[2,'freeform','regular',1,0],[3,'freeform','regular',1,1],[2,'brawl','regular',1,1],[2,'freeform','extra',2,2],[4,'freeform','extra',2,3]]){
  let g=start(count,{mode,extraFree:extra},format);assert.equal(freeMulligans(g),free);
  for(let i=1;i<count;i++)g=act(g,'openingKeep',i);
  for(let i=1;i<=free+1;i++){g=act(g,'openingMulligan');assert.equal(bottomCount(g,0),Math.max(0,i-free));}
 }
});
test('gentlemen permits unlimited free redraws; regular stops at a zero-card hand',()=>{
 for(const mode of ['gentlemen','regular']){let g=start(2,{mode,extraFree:1});g=act(g,'openingKeep',1);
  for(let i=0;i<(mode==='gentlemen'?12:7);i++)g=act(g,'openingMulligan');
  if(mode==='gentlemen')assert.equal(bottomCount(g,0),0);
  else{assert.throws(()=>act(g,'openingMulligan'),/zero-card/);g=act(g,'openingKeep',0,{bottom:g.players[0].zones.hand.map(c=>c.instance)});assert.equal(g.players[0].zones.hand.length,0);}
 }
});
test('reload, reset, validation and projected packets preserve decisions without private bottom choices',()=>{
 let g=start();g=act(g,'openingKeep',1);g=act(g,'openingMulligan');g=validateSession(JSON.parse(JSON.stringify(g)));assert.equal(bottomCount(g,0),1);
 const hidden=g.players[0].zones.hand[0];g=act(g,'openingKeep',0,{bottom:[hidden.instance]});
 const packet=JSON.stringify(projectGame(g,1));assert.ok(!packet.includes(hidden.name));assert.ok(!packet.includes('"'+hidden.instance+'"'));
 const reset=act(g,'reset');assert.equal(reset.opening.status,'choosing');assert.ok(reset.opening.players.every(p=>!p.kept&&!p.ready&&p.mulligans===0));assert.ok(reset.players.every(p=>p.zones.hand.length===7));
 for(const bad of [{status:'complete'},{players:[{ready:true}]},{round:-1}])assert.throws(()=>validateSession({...g,opening:{...g.opening,...bad}}),/opening-hand/);
 assert.throws(()=>lobbyGame({mulligan:{mode:'bad',extraFree:0}}),/mulligan/);
});
test('lobby mulligan changes invalidate readiness and a peer cannot override host rules',()=>{
 let g=lobbyGame({count:2});g.lobby.ready=[true,true];g=act(g,'lobbySettings',0,{mulligan:{mode:'extra',extraFree:3}});assert.deepEqual(g.lobby.ready,[false,false]);assert.equal(g.lobby.mulligan.extraFree,3);
 assert.throws(()=>reduceAction(g,{type:'lobbySettings',mulligan:{mode:'gentlemen',extraFree:1}},1),/host/);
});

test('Ready directly confirms the hand and validates London bottoming atomically',()=>{
 let g=start();g=act(g,'openingMulligan');g=act(g,'openingReady',1);assert.equal(g.opening.players[1].ready,true);assert.equal(g.opening.round,1);
 assert.throws(()=>act(g,'openingReady',0),/Select exactly/);assert.equal(g.opening.players[0].ready,false);
 g=act(g,'openingReady',0,{bottom:[g.players[0].zones.hand[0].instance]});assert.equal(g.opening.status,'complete');assert.equal(g.players[0].zones.hand.length,6);
});
