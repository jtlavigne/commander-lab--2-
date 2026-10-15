import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,advance,endTurn,findCard,transfer,resolve,validateSession} from '../engine.mjs';
import {practiceGame} from '../practice.mjs';
const card=(id,extra={})=>({instance:id,name:id,counters:{},tapped:false,...extra});
test('manual step and turn controls do not draw or untap; automation is opt-in',()=>{
 const g=newGame();g.players[0].zones.library=[card('draw')];g.players[1].zones.battlefield=[card('tapped',{tapped:true})];
 advance(g,{automatic:false});advance(g,{automatic:false});assert.equal(g.players[0].zones.hand.length,0);
 endTurn(g);assert.equal(g.active,1);assert.equal(g.step,0);assert.equal(g.players[1].zones.battlefield[0].tapped,true);
 advance(g,{automatic:true});g.players[1].zones.library=[card('next')];advance(g,{automatic:true});assert.equal(g.players[1].zones.hand.length,1);
 g.stack.push({card:card('spell'),owner:1});assert.throws(()=>endTurn(g),/stack/);
});
test('cross-seat drag preserves a card and position; leaving the battlefield clears transient state',()=>{
 const g=newGame(),c=card('permanent',{tapped:true,counters:{charge:3}});g.players[0].zones.battlefield.push(c);
 transfer(g,c.instance,'battlefield',2,{x:.7,y:.4});assert.equal(findCard(g,c.instance).owner,2);assert.deepEqual(c.tablePosition,{x:.7,y:.4,normalized:true});assert.equal(c.tapped,true);assert.equal(c.counters.charge,3);
 transfer(g,c.instance,'hand',1);assert.equal(c.tapped,false);assert.deepEqual(c.counters,{});assert.equal(c.tablePosition,undefined);assert.equal(findCard(g,c.instance).zone,'hand');
 assert.equal(g.players.flatMap(p=>Object.values(p.zones).flat()).length,1);
});
test('cards can move off the stack and commander tax counts casts from command only',()=>{
 const g=newGame(),c=card('commander',{commander:true});g.players[0].zones.command=[c];transfer(g,c.instance,'stack',0);assert.equal(g.players[0].casts,1);
 transfer(g,c.instance,'hand',0);assert.equal(g.stack.length,0);transfer(g,c.instance,'stack',0);assert.equal(g.players[0].casts,1);resolve(g,'battlefield');assert.equal(findCard(g,c.instance).zone,'battlefield');
});
test('partners retain separate command slots and cast counts when cast and returned',()=>{
 const g=newGame(),first=card('first',{commander:true,commandSlot:0,commandCasts:0}),second=card('second',{commander:true,commandSlot:1,commandCasts:0});g.players[0].zones.command=[first,second];
 transfer(g,first.instance,'stack',0);resolve(g,'battlefield');transfer(g,first.instance,'command',0);
 transfer(g,first.instance,'stack',0);resolve(g,'battlefield');transfer(g,second.instance,'stack',0);resolve(g,'battlefield');transfer(g,second.instance,'command',0);
 assert.equal(first.commandCasts,2);assert.equal(second.commandCasts,1);assert.equal(first.commandSlot,0);assert.equal(second.commandSlot,1);
 const restored=validateSession(structuredClone(g));assert.equal(findCard(restored,first.instance).card.commandCasts,2);assert.equal(findCard(restored,second.instance).card.commandCasts,1);
});
test('commanders stay face up and older sessions receive stable command slots',()=>{
 const g=newGame();g.players[0].casts=2;g.players[0].zones.command=[card('first',{faceDown:true,face:1}),card('second',{commander:true,faceDown:true})];
 const restored=validateSession(g),[first,second]=restored.players[0].zones.command;
 assert.equal(first.commander,true);assert.equal(first.faceDown,false);assert.equal(first.face,0);assert.equal(first.commandSlot,0);assert.equal(first.commandCasts,2);assert.equal(second.commandSlot,1);assert.equal(second.commandCasts,0);
 first.faceDown=true;first.face=1;transfer(g,first.instance,'battlefield',0);assert.equal(first.faceDown,false);assert.equal(first.face,0);
});
test('cards outside the battlefield are untapped when moved or restored from old sessions',()=>{
 const zones=['hand','command','graveyard','exile','library','stack'];
 for(const zone of zones){
  const g=newGame(),c=card('tapped',{tapped:true});g.players[0].zones.battlefield=[c];
  transfer(g,c.instance,zone,0);assert.equal(c.tapped,false,zone+' transfer');
  c.tapped=true;g.players[0].zones.battlefield=[card('permanent',{tapped:true})];
  const restored=validateSession(structuredClone(g));
  assert.equal(findCard(restored,c.instance).card.tapped,false,zone+' restore');
  assert.equal(restored.players[0].zones.battlefield[0].tapped,true,'Battlefield tap state must be preserved');
 }
});
test('free placement clamps to the mat and invalid destinations cannot remove a card',()=>{
 const g=newGame(),c=card('piece');g.players[0].zones.hand=[c];assert.throws(()=>transfer(g,c.instance,'battlefield',6));assert.equal(g.players[0].zones.hand[0],c);
 transfer(g,c.instance,'battlefield',0,{x:9,y:-4});assert.deepEqual(c.tablePosition,{x:1,y:0,normalized:true});
 assert.throws(()=>transfer(g,c.instance,'exile',0,{x:NaN,y:0}));assert.equal(findCard(g,c.instance).zone,'battlefield');
});
test('graveyard and exile cards are always face up without becoming tapped',()=>{
 for(const zone of ['graveyard','exile']){
  const g=newGame(),c=card('hidden',{faceDown:true,tapped:true});g.players[0].zones.battlefield=[c];
  transfer(g,c.instance,zone,0);assert.equal(c.faceDown,false);assert.equal(c.tapped,false);
  c.faceDown=true;c.tapped=true;const restored=validateSession(structuredClone(g));
  assert.equal(restored.players[0].zones[zone][0].faceDown,false,'Older sessions must reveal public piles');
  assert.equal(restored.players[0].zones[zone][0].tapped,false);
 }
});
test('sessions reject invalid stats, duplicate cards, and unusable positions',()=>{
 const g=newGame();g.players[0].zones.hand=[card('a')];assert.equal(validateSession(structuredClone(g)).version,1);
 const duplicate=structuredClone(g);duplicate.players[1].zones.hand=[card('a')];assert.throws(()=>validateSession(duplicate));
 const stats=structuredClone(g);stats.players[0].life='forty';assert.throws(()=>validateSession(stats));
 const pos=structuredClone(g);pos.players[0].zones.hand[0].tablePosition={x:Infinity,y:0};assert.throws(()=>validateSession(pos));
});
test('offline practice table has four visible hands and unique serializable pieces',()=>{
 const g=practiceGame();validateSession(g);for(const p of g.players){assert.equal(p.zones.hand.length,7);assert.equal(p.zones.command.length,1);assert.equal(Object.values(p.zones).flat().length,100);}
 const restored=validateSession(JSON.parse(JSON.stringify(g)));assert.equal(restored.players[0].zones.battlefield.length,5);
});
