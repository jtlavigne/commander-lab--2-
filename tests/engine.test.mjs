import {test} from 'node:test';import assert from 'node:assert/strict';import {newGame,advance,move,resolve,parseDeck,STEPS} from '../engine.mjs';
test('turn order, multiplayer draw, untap and round rollover',()=>{const g=newGame();g.players[0].zones.library=[{instance:'a',name:'Forest'}];advance(g);advance(g);assert.equal(g.players[0].zones.hand.length,1);g.players[1].zones.battlefield=[{tapped:true}];for(let i=2;i<STEPS.length;i++)advance(g);assert.equal(g.active,1);assert.equal(g.players[1].zones.battlefield[0].tapped,false);for(let i=0;i<36;i++)advance(g);assert.equal(g.active,0);assert.equal(g.turn,2);});
test('stack is LIFO and blocks advancing',()=>{const g=newGame();g.players[0].zones.hand=[{instance:'a',name:'A'},{instance:'b',name:'B'}];move(g,0,'a','stack');move(g,0,'b','stack');assert.throws(()=>advance(g));resolve(g,'graveyard');assert.equal(g.players[0].zones.graveyard[0].name,'B');assert.equal(g.stack[0].card.name,'A');});
test('deck import recognizes counts and export printing annotations',()=>{assert.deepEqual(parseDeck('1 Sol Ring (CMM) 396\n10x Forest\n// comment'),[{count:1,name:'Sol Ring'},{count:10,name:'Forest'}]);});
test('deck quantities accept common formats and repeated names add together',()=>{
 for(const line of ['4 Forest','4x Forest','4xForest','4 x Forest','4X Forest','4× Forest','Forest x4'])assert.deepEqual(parseDeck(line),[{count:4,name:'Forest'}]);
 assert.deepEqual(parseDeck('2 Forest\nforest\n1xForest (M21) 274\n2 Island\nIsland'),[{count:4,name:'Forest'},{count:3,name:'Island'}]);
 assert.deepEqual(parseDeck('1 1000-Year Storm\n4 Xantcha, Sleeper Agent'),[{count:1,name:'1000-Year Storm'},{count:4,name:'Xantcha, Sleeper Agent'}]);
 assert.throws(()=>parseDeck('0 Forest'),/Invalid quantity/);
});
