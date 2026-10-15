import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,validateSession,resetGame,changePlayerCount} from '../engine.mjs';
import {castSpell,passPriority,prioritySeat,settlePriority} from '../casting.mjs';
import {responseModeFor} from '../response-settings.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {autoPassEmptySteps} from '../phase-flow.mjs';

const spell=()=>({instance:crypto.randomUUID(),name:'Test spell',type_line:'Instant',mana_cost:'{0}',oracle_text:'You gain 1 life.',counters:{}});
const game=count=>{const g=newGame(count);g.step=3;return g;};

for(const count of [2,3,4])test(count+' seats independently hold Prompt while Auto skips unavailable responses',()=>{
 const g=game(count),card=spell(),last=count-1;g.players[last].responseMode='prompt';g.players[0].zones.hand=[card];castSpell(g,card.instance);
 assert.equal(prioritySeat(g),last);assert.equal(g.stack.length,1);assert.equal(g.priority.passes,last);passPriority(g,last);assert.equal(g.stack.length,0);assert.equal(g.players[0].life,41);
});

test('Auto still holds a legal response, regardless of another player choosing Prompt',()=>{
 const g=game(3),card=spell(),answer=spell();g.players[2].responseMode='prompt';g.players[0].zones.hand=[card];g.players[1].zones.hand=[answer];castSpell(g,card.instance);assert.equal(prioritySeat(g),1);passPriority(g,1);assert.equal(prioritySeat(g),2);assert.equal(g.stack.length,1);passPriority(g,2);assert.equal(g.stack.length,0);
});

test('changing the current priority seat to Auto advances only its unavailable window',()=>{
 const g=game(3),card=spell();g.players[0].responseMode='prompt';g.players[2].responseMode='prompt';g.players[0].zones.hand=[card];castSpell(g,card.instance);assert.equal(prioritySeat(g),0);
 const next=reduceGameAction(g,{type:'responseMode',mode:'auto'},0).game;assert.equal(prioritySeat(next),2);assert.equal(next.players[2].responseMode,'prompt');assert.equal(g.players[0].responseMode,'prompt');
 const unchanged=reduceGameAction(next,{type:'responseMode',mode:'prompt'},1).game;assert.equal(prioritySeat(unchanged),2);assert.equal(unchanged.players[0].responseMode,'auto');
});

test('legacy table settings load with player overrides and survive reset and seat-count changes',()=>{
 const g=game(4);g.responseMode='hold';g.players[1].responseMode='auto';validateSession(g);assert.deepEqual(g.players.map((_,i)=>responseModeFor(g,i)),['prompt','auto','prompt','prompt']);
 const saved=validateSession(JSON.parse(JSON.stringify(g))),reset=resetGame(saved);assert.deepEqual(reset.players.map(p=>p.responseMode),['prompt','auto','prompt','prompt']);
 const smaller=changePlayerCount(reset,2),larger=changePlayerCount(smaller,4);assert.deepEqual(larger.players.map(p=>p.responseMode),['prompt','auto','prompt','prompt']);
});

test('clients can change their own preference without host permission and cannot change another seat',()=>{
 const g=game(3);g.responseMode='hold';const next=reduceAction(g,{type:'responseMode',mode:'auto'},1).game;assert.equal(next.players[1].responseMode,'auto');assert.equal(responseModeFor(next,0),'prompt');assert.equal(responseModeFor(next,2),'prompt');
 for(const host of [false,true])assert.throws(()=>reduceAction(next,{type:'responseMode',owner:2,mode:'auto'},1,{host}),/own seat/);
 for(const mode of ['hold','all','bad',null])assert.throws(()=>reduceAction(next,{type:'responseMode',mode},1),/Invalid response mode/);
 const invalid=structuredClone(next);invalid.players[0].responseMode='hold';assert.throws(()=>validateSession(invalid),/Invalid session/);
});

test('Prompt prevents empty-phase skipping for its player and preserves opponents response windows',()=>{
 const g=game(2);g.step=0;g.players[0].zones.library=[{...spell(),type_line:'Land'}];g.players[1].responseMode='prompt';autoPassEmptySteps(g,{automatic:true});assert.equal(g.step,1);assert.equal(g.players[0].zones.hand.length,0);
 g.players[1].responseMode='auto';autoPassEmptySteps(g,{automatic:true});assert.equal(g.step,3);assert.equal(g.players[0].zones.hand.length,1);
 g.step=10;g.players[0].responseMode='prompt';autoPassEmptySteps(g,{automatic:true});assert.equal(g.step,10);
});

test('eliminated Prompt seats neither hold priority nor prevent automatic empty phases',()=>{
 const g=game(3),card=spell();g.players[2].responseMode='prompt';g.players[2].eliminated={reason:'Left the game'};g.players[0].zones.hand=[card];castSpell(g,card.instance);settlePriority(g);assert.equal(g.stack.length,0);g.step=1;g.players[0].zones.library=[{...spell(),type_line:'Land'}];autoPassEmptySteps(g,{automatic:true});assert.equal(g.step,3);
});


for(const count of [2,3,4])test(count+' seats: Pass all ignores available answers but preserves another seat Prompt',()=>{
 const g=game(count),card=spell(),answer=spell();g.players[0].responseMode='pass-all';g.players[0].zones.hand=[card,answer];g.players[count-1].responseMode='prompt';
 castSpell(g,card.instance);assert.equal(prioritySeat(g),count-1);assert.equal(g.stack.length,1);assert.ok(g.players[0].zones.hand.includes(answer));
 passPriority(g,count-1);assert.equal(g.stack.length,0);assert.equal(g.players[0].life,41);assert.ok(g.players[0].zones.hand.includes(answer));
});

test('switching to Pass all immediately yields priority; switching back restores response detection',()=>{
 const g=game(3),card=spell();g.players[0].zones.hand=[card,spell()];g.players[1].responseMode='prompt';g.players[2].responseMode='prompt';castSpell(g,card.instance);assert.equal(prioritySeat(g),0);
 let next=reduceGameAction(g,{type:'responseMode',mode:'pass-all'},0).game;assert.equal(prioritySeat(next),1);
 next=reduceGameAction(next,{type:'responseMode',mode:'auto'},0).game;assert.equal(prioritySeat(next),1);
 const response=spell();next.players[1].zones.hand=[response];castSpell(next,response.instance);passPriority(next,1);passPriority(next,2);assert.equal(prioritySeat(next),0,'New stack object asks Auto player with a legal answer');
});

test('all seats can decline responses while required resolution choices still wait',()=>{
 const g=game(3),c={...spell(),oracle_text:'Scry 1. Draw a card.'};g.players.forEach(p=>{p.responseMode='pass-all';p.zones.hand=[spell()];});g.players[0].zones.hand.push(c);g.players[0].zones.library=[{...spell(),type_line:'Land'}];
 castSpell(g,c.instance);assert.equal(g.pendingEffect.step.op,'scry');assert.equal(g.stack.at(-1).resolving,true);assert.equal(g.players[0].zones.library.length,1);
 const before=structuredClone(g);settlePriority(g);assert.deepEqual(g,before);assert.throws(()=>passPriority(g,0),/pending/);
});

test('Pass all skips optional empty-step responses but keeps main actions and attackers',()=>{
 const g=game(2);g.players.forEach(p=>p.responseMode='pass-all');g.players[0].zones.hand=[spell()];g.players[0].zones.library=[{...spell(),type_line:'Land'}];g.step=1;
 autoPassEmptySteps(g,{automatic:true});assert.equal(g.step,3);assert.equal(g.players[0].zones.hand.length,2);
 g.step=9;autoPassEmptySteps(g,{automatic:true});assert.equal(g.step,9,'Postcombat main still offers playable cards');
 g.step=4;g.players[0].zones.battlefield=[{...spell(),type_line:'Creature',power:'2',toughness:'2',summoningSick:false}];autoPassEmptySteps(g,{automatic:true});assert.equal(g.step,5,'Declare attackers requires a decision');
});

test('Pass all is saved per seat through reset, seat resizing and shared authorization',()=>{
 let g=game(4);g.responseMode='hold';g=reduceAction(g,{type:'responseMode',mode:'pass-all'},1).game;
 assert.deepEqual(g.players.map((_,i)=>responseModeFor(g,i)),['prompt','pass-all','prompt','prompt']);
 g=changePlayerCount(changePlayerCount(resetGame(validateSession(JSON.parse(JSON.stringify(g)))),2),4);
 assert.equal(responseModeFor(g,1),'pass-all');assert.equal(responseModeFor(g,0),'prompt');
 assert.throws(()=>reduceAction(g,{type:'responseMode',owner:0,mode:'pass-all'},1),/own seat/);
});
