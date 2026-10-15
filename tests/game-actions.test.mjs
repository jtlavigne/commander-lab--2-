import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,transfer} from '../engine.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';

const card=(instance,extra={})=>({instance,name:instance,type_line:'Basic Land — Forest',oracle_text:'({T}: Add {G}.)',counters:{},face:0,tapped:false,...extra});
function table(){const g=newGame(2);g.step=3;g.responseMode='hold';return g;}
const act=(g,action,seat=0)=>reduceGameAction(g,action,seat).game;

test('local commands can edit another hotseat while shared commands protect assigned seats',()=>{
 const g=table();g.players[1].zones.library=[card('Draw')];
 const next=act(g,{type:'draw',owner:1});assert.equal(next.players[1].zones.hand[0].name,'Draw');assert.equal(g.players[1].zones.hand.length,0);
 assert.throws(()=>reduceAction(g,{type:'draw',owner:1},0),/own seat/);
 assert.equal(act(next,{type:'life',owner:1,delta:-2}).players[1].life,38);
});

test('manual battlefield placement and direct resolution remain available locally',()=>{
 const g=table();g.players[0].zones.hand=[card('Land')];
 const placed=act(g,{type:'move',id:'Land',to:'battlefield',owner:0});assert.equal(placed.players[0].landsPlayed,0);assert.equal(placed.players[0].zones.battlefield.length,1);
 assert.throws(()=>reduceAction(g,{type:'move',id:'Land',to:'battlefield'},0),/Play land/);
 const stack=act(g,{type:'move',id:'Land',to:'stack'});assert.equal(stack.stack.length,1);
 const resolved=act(stack,{type:'resolveTo',to:'graveyard'});assert.equal(resolved.stack.length,0);assert.equal(resolved.players[0].zones.graveyard[0].name,'Land');
 assert.throws(()=>reduceAction(stack,{type:'resolveTo',to:'graveyard'},0),/Unknown|Pass/);
});

test('casting waits for reactions and resolution draws only after both shared seats pass',()=>{
 let g=table();g.players[0].zones.hand=[card('Spell',{type_line:'Instant',mana_cost:'{U}',oracle_text:'Draw a card.'})];g.players[0].zones.library=[card('Draw')];
 g=act(g,{type:'manaAdd',counts:{U:1}});g=reduceAction(g,{type:'cast',id:'Spell'},0).game;
 assert.equal(g.players[0].zones.hand.length,0);assert.equal(g.stack.length,1);
 assert.throws(()=>reduceAction(g,{type:'pass'},1),/priority/);
 g=reduceAction(g,{type:'pass'},0).game;g=reduceAction(g,{type:'pass'},1).game;
 assert.equal(g.stack.length,0);assert.equal(g.players[0].zones.hand[0].name,'Draw');assert.equal(g.players[0].zones.graveyard[0].name,'Spell');
});

test('local resolve-now keeps its direct resolution behavior without consuming response passes',()=>{
 let g=table();g.players[0].zones.hand=[card('Spell',{type_line:'Sorcery',mana_cost:'{0}',oracle_text:'Draw a card.'})];g.players[0].zones.library=[card('Draw')];
 g=act(g,{type:'cast',id:'Spell'});g=act(g,{type:'resolveNow'});
 assert.equal(g.stack.length,0);assert.equal(g.players[0].zones.hand[0].name,'Draw');
});

test('a failed multi-card corrective untap rolls back the entire command',()=>{
 let g=table();for(const id of ['First','Second']){g.players[0].zones.hand.push(card(id));transfer(g,id,'battlefield',0);g=act(g,{type:'activate',id,ability:'basic:G'});}
 // First can untap, but Second's spent output must roll the whole action back.
 g=act(g,{type:'manaRemove',index:1});const before=structuredClone(g);
 assert.throws(()=>act(g,{type:'untap'}),/spent|cleared|unspent/i);assert.deepEqual(g,before);
});

test('library-top placement and stack-token removal use the card location rather than the selected seat',()=>{
 const g=table();g.players[1].zones.graveyard=[card('Return')];
 const next=act(g,{type:'libraryTop',id:'Return'});assert.equal(next.players[1].zones.library[0].name,'Return');assert.equal(next.players[0].zones.library.length,0);
 next.stack=[{owner:1,card:card('Token',{token:true,type_line:'Token Creature'})}];
 assert.equal(act(next,{type:'removeToken',id:'Token'}).stack.length,0);
});

test('large locally cached artwork survives import without transport-size limits',()=>{
 const g=table(),command={type:'import',owner:1,name:'New player',library:[card('Art',{localImages:['data:image/png;base64,'+'A'.repeat(2*1024*1024)]})],command:[]};
 const next=act(g,command);assert.equal(next.players[1].name,'New player');assert.equal(next.players[1].zones.hand[0].localImages[0],command.library[0].localImages[0]);
 next.players[1].zones.hand[0].localImages.push('Another image');assert.equal(command.library[0].localImages.length,1);
 assert.equal(command.library[0].ownerSeat,undefined);assert.equal(g.players[1].zones.hand.length,0);
});

test('shared seat overrides cannot bypass authorization through indirect table commands',()=>{
 const g=table(),before=structuredClone(g);
 for(const type of ['shuffle','redraw','untap','token','libraryTop','import']){
  assert.throws(()=>reduceAction(g,{type,owner:1},0),/own seat/);assert.deepEqual(g,before);
 }
});

test('shared deck imports retain quantities while leaving other seats intact',()=>{
 const g=table();g.turn=2;g.players[0].zones.hand=[card('Existing')];
 const library=Array.from({length:4},(_,i)=>card('Forest'+i,{name:'Forest'}));
 const result=reduceAction(g,{type:'import',library,command:[],name:'Guest'},1).game;
 assert.equal(result.players[1].zones.hand.length,4);assert.ok(result.players[1].zones.hand.every(c=>c.name==='Forest'));
 assert.deepEqual(result.players[0],g.players[0]);assert.equal(result.players[1].name,'Guest');
});

test('manual cast totals survive player-stat edits before a commander has been assigned',()=>{
 const g=act(table(),{type:'playerStats',name:'Player',life:37,poison:1,damage:[0,2],casts:{},totalCasts:3});
 assert.equal(g.players[0].casts,3);assert.equal(g.players[0].life,37);assert.equal(g.players[0].poison,1);
});

test('manual counter edits support piles and remove zero counts without changing artwork',()=>{
 const g=table();g.players[0].zones.exile=[card('Exiled',{localImages:['data:image/png;base64,A']})];
 const one=act(g,{type:'counterEdit',id:'Exiled',counter:'time',delta:1}),zero=act(one,{type:'counterEdit',id:'Exiled',counter:'time',delta:-1});
 assert.deepEqual(zero.players[0].zones.exile[0].counters,{});assert.deepEqual(zero.players[0].zones.exile[0].localImages,g.players[0].zones.exile[0].localImages);
 assert.throws(()=>reduceAction(g,{type:'counterEdit',id:'Exiled',counter:'time',delta:1},0),/control/);
});
