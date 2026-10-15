import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lobbyGame,deckReport} from '../lobby.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
import {createGameServer} from '../multiplayer/server.mjs';
import {createRequire} from 'node:module';
import {PREMADE_DECKS} from '../premade-decks.mjs';
import {manaTotals} from '../mana.mjs';
import {resetGame,validateSession} from '../engine.mjs';
const {createGameClient}=createRequire(import.meta.url)('../multiplayer/client.cjs');
const forest=()=>({instance:crypto.randomUUID(),name:'Forest',type_line:'Basic Land — Forest',color_identity:['G'],legalities:{standard:'legal',commander:'legal'},counters:{}});
const command=()=>({instance:crypto.randomUUID(),name:'Commander',commander:true,type_line:'Legendary Creature',color_identity:['G'],legalities:{commander:'legal'},counters:{}});
const imported=(g,owner,count=100)=>reduceGameAction(g,{type:'import',owner,library:Array.from({length:count-1},forest),command:[command()]},owner).game;
async function sync(clients){for(let i=0;i<100;i++){if(clients.every(c=>c.snapshot.revision===clients[0].snapshot.revision))return;await new Promise(r=>setTimeout(r,10));}throw Error('Clients did not converge.');}
test('all 39 supplied decks have usable lists and commander names without fetching later Oracle fixtures',()=>{assert.equal(PREMADE_DECKS.length,39);assert.equal(new Set(PREMADE_DECKS.map(d=>d.id)).size,39);for(const d of PREMADE_DECKS){assert.ok(d.commanders.length);assert.ok(d.list.includes(d.commanders[0]));}});
for(const count of [2,3,4])test(count+' seats import and ready independently, preserve decks, and start at format life',()=>{
 let g=lobbyGame({count});for(let i=0;i<count;i++)g=imported(g,i);
 assert.equal(g.step,0);assert.deepEqual(g.lobby.ready,Array(count).fill(false));
 for(let i=0;i<count;i++){g=reduceGameAction(g,{type:'lobbyReady',owner:i,ready:true},0).game;assert.equal(g.lobby.ready[i],true);}
 const ids=g.players.flatMap(p=>Object.values(p.zones).flat().map(c=>c.instance)).sort();g=reduceGameAction(g,{type:'lobbyStart'},0).game;assert.equal(g.lobby.status,'playing');assert.deepEqual(g.players.map(p=>p.life),Array(count).fill(40));assert.ok(g.players.every(p=>p.zones.hand.length===7&&p.mana.length===0));assert.deepEqual(g.players.flatMap(p=>Object.values(p.zones).flat().map(c=>c.instance)).sort(),ids);
});
test('warnings block start until the host acknowledges each deck, with reimports invalidating approval and readiness',()=>{
 let g=lobbyGame({count:2});for(let i=0;i<2;i++){g=imported(g,i,5);g=reduceGameAction(g,{type:'lobbyReady',ready:true},i).game;}
 assert.throws(()=>reduceGameAction(g,{type:'lobbyStart'},0),/acknowledge/);g=reduceGameAction(g,{type:'lobbyAcknowledge',seat:0,accepted:true},0).game;assert.throws(()=>reduceGameAction(g,{type:'lobbyStart'},0),/acknowledge/);g=reduceGameAction(g,{type:'lobbyAcknowledge',seat:1,accepted:true},0).game;assert.equal(reduceGameAction(g,{type:'lobbyStart'},0).game.lobby.status,'playing');
 g=imported(g,0,5);assert.equal(g.lobby.ready[0],false);assert.equal(g.lobby.acknowledged[0],false);assert.equal(g.lobby.ready[1],true);
});
test('foreign lobby controls and play actions cannot bypass host authority or readiness',()=>{
 const g=imported(lobbyGame({count:2}),1,5),before=JSON.stringify(g);
 for(const a of [{type:'lobbyStart'},{type:'lobbySettings',format:'freeform'},{type:'lobbyAcknowledge',seat:1,accepted:true},{type:'lobbyReady',owner:0,ready:true},{type:'draw'},{type:'manaAdd',counts:{G:1}},{type:'endTurn'}])assert.throws(()=>reduceAction(g,a,1));assert.equal(JSON.stringify(g),before);
 assert.equal(reduceAction(g,{type:'lobbyReady',ready:true},1).game.lobby.ready[1],true);
});
test('format changes reset approvals and readiness and recompute reports, without exposing private card names',()=>{
 let g=imported(lobbyGame({count:2}),0);g=reduceGameAction(g,{type:'lobbyReady',ready:true},0).game;g=reduceGameAction(g,{type:'lobbySettings',format:'standard'},0).game;assert.equal(g.lobby.ready[0],false);assert.ok(g.lobby.decks[0].issues.some(s=>s.includes('command zone')));assert.ok(!JSON.stringify(projectGame(g,1).lobby).includes('Forest'));
});
test('legality reports handle basic duplicates, off-color, singleton, banned and unavailable metadata',()=>{
 let g=imported(lobbyGame({count:2}),0);assert.deepEqual(deckReport(g,0).issues,[]);const c=g.players[0].zones.library[0];c.color_identity=['U'];c.legalities.commander='banned';let issues=deckReport(g,0).issues;assert.ok(issues.some(s=>s.includes('color identity')));assert.ok(issues.some(s=>s.includes('not legal')));delete c.legalities;assert.ok(deckReport(g,0).issues.some(s=>s.includes('unavailable')));c.type_line='Artifact';g.players[0].zones.library.push({...c,instance:crypto.randomUUID()});assert.ok(deckReport(g,0).issues.some(s=>s.includes('copies')));
});
test('preset life survives reset, and malformed saved lobby metadata is rejected',()=>{
 const g=lobbyGame({count:3,format:'brawl'});g.lobby.status='playing';assert.ok(resetGame(g).players.every(p=>p.life===30));g.lobby.format='standard';assert.ok(resetGame(g).players.every(p=>p.life===20));
 for(const bad of [{ready:[true]},{format:'invalid'},{format:'constructor'},{decks:[{},null,null]},{acknowledged:['yes',false,false]}])assert.throws(()=>validateSession({...g,lobby:{...g.lobby,...bad}}),/Invalid lobby/);
});
for(const count of [2,3,4])test(count+' network seats cannot pass priority or spend mana for another player',()=>{
 const seed=lobbyGame({count,format:'freeform'});seed.lobby.status='playing';seed.step=3;seed.responseMode='hold';seed.players[0].zones.hand=[{instance:'spell',name:'Spell',type_line:'Instant',mana_cost:'{0}',oracle_text:'Draw a card.',counters:{}}];const g=reduceGameAction(seed,{type:'cast',id:'spell'},0).game;
 for(let i=1;i<count;i++){assert.throws(()=>reduceAction(g,{type:'pass'},i),/priority/i);assert.throws(()=>reduceAction(g,{type:'manaAdd',owner:0,counts:{G:1}},i),/own seat/);}
 assert.equal(reduceAction(g,{type:'pass'},0).game.priority.seat,1);assert.equal(g.priority.seat,0);
});
test('LAN host and peer enforce connected readiness, deck review and separate mana/priority over real sockets',async t=>{
 const server=await createGameServer(),room=await server.createRoom(lobbyGame({count:2,format:'freeform'})),clients=[];t.after(async()=>{clients.forEach(c=>c.close());await server.close();});
 const host=await createGameClient({url:'ws://127.0.0.1:'+server.port,code:room.code,token:room.hostToken});clients.push(host);await host.joined;
 await assert.rejects(host.send({type:'lobbyStart'}),/connected/);
 const peer=await createGameClient({url:'ws://127.0.0.1:'+server.port,code:room.code});clients.push(peer);await peer.joined;
 await assert.rejects(peer.send({type:'lobbySettings',format:'commander'}),/host/);
 for(const c of clients){await sync(clients);await c.send({type:'import',library:Array.from({length:10},forest),command:[]});await c.send({type:'lobbyReady',ready:true});}
 await sync(clients);await host.send({type:'lobbyStart'});assert.equal(host.snapshot.game.lobby.status,'playing');await assert.rejects(host.send({type:'step',step:3}),/opening hands/);for(const c of clients){await sync(clients);await c.send({type:'openingKeep',bottom:[]});await c.send({type:'openingReady'});}await sync(clients);await host.send({type:'step',step:3});await host.send({type:'manaAdd',counts:{G:2}});await sync(clients);await peer.send({type:'manaAdd',counts:{U:3}});assert.equal(manaTotals(peer.snapshot.game.players[0]).G,2);assert.equal(manaTotals(peer.snapshot.game.players[1]).U,3);await assert.rejects(peer.send({type:'manaRemove',owner:0,color:'G'}),/own seat/);
});
test('releasing a lobby seat revokes its credential and clears its private deck and readiness for the replacement',async t=>{
 const server=await createGameServer(),room=await server.createRoom(lobbyGame({count:2,format:'freeform'})),clients=[];t.after(async()=>{clients.forEach(c=>c.close());await server.close();});
 const host=await createGameClient({url:'ws://127.0.0.1:'+server.port,code:room.code,token:room.hostToken});clients.push(host);await host.joined;
 const peer=await createGameClient({url:'ws://127.0.0.1:'+server.port,code:room.code});clients.push(peer);await peer.joined;await peer.send({type:'import',library:Array.from({length:10},forest),command:[]});await peer.send({type:'lobbyReady',ready:true});await sync(clients);await host.send({type:'releaseSeat',seat:1});
 const canonical=server.rooms.get(room.code);assert.equal(canonical.game.lobby.ready[1],false);assert.equal(canonical.game.lobby.decks[1],null);assert.equal(canonical.game.players[1].zones.hand.length,0);assert.equal(canonical.game.players[1].zones.library.length,0);
 const replacement=await createGameClient({url:peer.credential.url,code:room.code});clients.push(replacement);await replacement.joined;assert.equal(replacement.snapshot.seat,1);assert.equal(replacement.snapshot.game.players[1].zones.hand.length,0);
});

// Reconnect uses the same seat credential while private mulligan state persists.
test('opening decisions survive a real reconnect and only their seat can keep or ready',async t=>{
 const server=await createGameServer(),room=await server.createRoom(lobbyGame({count:2,format:'freeform'})),clients=[];
 t.after(async()=>{clients.forEach(c=>c.close());await server.close();});
 const host=await createGameClient({url:'ws://127.0.0.1:'+server.port,code:room.code,token:room.hostToken});clients.push(host);await host.joined;
 let peer=await createGameClient({url:'ws://127.0.0.1:'+server.port,code:room.code});clients.push(peer);await peer.joined;
 for(const c of clients){await sync(clients);await c.send({type:'import',library:Array.from({length:20},forest),command:[]});await c.send({type:'lobbyReady',ready:true});}
 await sync(clients);await host.send({type:'lobbyStart'});await sync(clients);await peer.send({type:'openingMulligan'});await sync(clients);await host.send({type:'openingKeep',bottom:[]});await sync(clients);
 const credential=peer.credential;peer.close();peer=await createGameClient(credential);clients[1]=peer;await peer.joined;await sync(clients);
 assert.equal(peer.snapshot.game.opening.players[1].mulligans,1);assert.equal(peer.snapshot.game.opening.round,1);
 await assert.rejects(peer.send({type:'openingKeep',owner:0,bottom:[]}),/own seat/);
 await assert.rejects(peer.send({type:'undo'}),/cannot be undone/);
 const chosen=peer.snapshot.game.players[1].zones.hand[0].instance;await peer.send({type:'openingKeep',bottom:[chosen]});await sync(clients);
 assert.equal(peer.snapshot.game.players[1].zones.hand.length,6);assert.ok(!JSON.stringify(host.snapshot.game).includes(chosen));
 await host.send({type:'openingReady'});await sync(clients);await peer.send({type:'openingReady'});await sync(clients);assert.ok(clients.every(c=>c.snapshot.game.opening.status==='complete'));
});
