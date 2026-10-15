import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {newGame,resetGame,validateSession} from '../engine.mjs';
import {genericReduction} from '../spell-costs.mjs';
import {createTokens} from '../tokens.mjs';
import {discoverTokens,tokenTemplate,matchingToken} from '../token-catalog.mjs';
import {applyOracleEffect,compileOracleEffect} from '../oracle-effects.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/token-catalog.json',import.meta.url)));
const warrior={name:'Warrior',type_line:'Token Creature — Warrior',power:'1',toughness:'1',colors:['G'],oracle_text:''};
const notebook=fixture.tokens.find(t=>t.name==="Tamiyo's Notebook");

test('Oracle scanning finds named artifacts and creature tokens, including back faces',()=>{
 const found=discoverTokens([fixture.cards[0],{card_faces:[{oracle_text:'Create two 1/1 green Warrior creature tokens.'}]}]);
 assert.ok(found.ids.includes(notebook.id));assert.ok(found.definitions.some(t=>t.name==="Tamiyo's Notebook"&&t.type_line.includes('Book')));
 assert.deepEqual(found.definitions.find(t=>t.name==='Warrior'),warrior);
});
test('same-name token matching distinguishes stats, colors and abilities',()=>{
 const green=tokenTemplate({...warrior,id:'green'}),white={...green,id:'white',colors:['W']},flying={...green,id:'flying',oracle_text:'Flying (Reminder text.)'};
 assert.equal(matchingToken([white,flying,green],warrior).id,'green');
 assert.equal(matchingToken([flying],{...warrior,oracle_text:'Flying'}).id,'flying');
 assert.equal(matchingToken([green],{...warrior,power:'2'}),null);
 assert.equal(matchingToken([green],{...warrior,localImages:['copied art']}),null);
});
test('resolved Notebook and Warrior effects create fresh copies with imported artwork',()=>{
 const g=newGame(2);g.step=3;g.responseMode='hold';g.players[0].tokenCatalog=[tokenTemplate({...notebook,localImages:['notebook art']}),tokenTemplate({...warrior,localImages:['warrior art']})];
 const text=fixture.cards[0].oracle_text.split('\n').at(-1).replace(/^.*?: /,'');
 assert.equal(compileOracleEffect(text)[0].op,'createTokens');
 assert.equal(applyOracleEffect(g,{owner:0,name:'Tamiyo',text}),true);
 assert.equal(applyOracleEffect(g,{owner:0,name:'Warriors',text:'Create two 1/1 green Warrior creature tokens.'}),true);
 const [book,a,b]=g.players[0].zones.battlefield;
 assert.equal(book.name,notebook.name);assert.deepEqual(book.localImages,['notebook art']);assert.match(book.type_line,/Book/);assert.equal(genericReduction(g,0,{type_line:'Sorcery',mana_cost:'{4}'}),2);
 assert.deepEqual(a.localImages,['warrior art']);assert.notEqual(a.instance,b.instance);a.counters.test=1;assert.deepEqual(b.counters,{});
 assert.equal(g.players[0].tokenCatalog.length,2);assert.equal(g.players[0].tokenCatalog[1].counters,undefined);
 assert.equal(projectGame(g,1).players[0].tokenCatalog,undefined);assert.equal(projectGame(g,1).players[0].zones.battlefield[0].id,notebook.id);
 const reset=resetGame(g);assert.equal(reset.players[0].zones.library.length,0);assert.equal(reset.players[0].tokenCatalog.length,2);validateSession(reset);
});
test('manual reserve creation and reimport replace templates without treating them as deck cards',()=>{
 let g=newGame(2);g.step=3;g.responseMode='hold';
 g=reduceGameAction(g,{type:'import',library:[],command:[],tokenCatalog:[tokenTemplate(warrior)]},0).game;
 g=reduceGameAction(g,{type:'token',templateIndex:0,count:2},0).game;assert.equal(g.players[0].zones.battlefield.length,2);
 assert.throws(()=>reduceGameAction(g,{type:'token',templateIndex:0,count:1},1),/reserve/);
 g=reduceGameAction(g,{type:'import',library:[],command:[],tokenCatalog:[]},0).game;assert.equal(g.players[0].tokenCatalog.length,0);
 assert.throws(()=>reduceGameAction(g,{type:'import',library:[],command:[],tokenCatalog:[{...warrior,instance:'bad'}]},0));
});

test('a token spell leaves the reserve untouched and creates copies only after responses pass',async()=>{
 const {reduceAction}=await import('../multiplayer/actions.mjs');
 let g=newGame(2);g.step=3;g.responseMode='hold';g.players[0].tokenCatalog=[tokenTemplate({...warrior,id:'green-warrior'})];
 g.players[0].zones.hand=[{instance:'warrior-spell',name:'Warrior spell',type_line:'Sorcery',mana_cost:'{0}',oracle_text:'Create two 1/1 green Warrior creature tokens.',counters:{},face:0}];
 g=reduceAction(g,{type:'cast',id:'warrior-spell'},0).game;assert.equal(g.players[0].zones.battlefield.length,0);assert.equal(g.stack.length,1);
 g=reduceAction(g,{type:'pass'},0).game;assert.equal(g.players[0].zones.battlefield.length,0);
 g=reduceAction(g,{type:'pass'},1).game;assert.equal(g.players[0].zones.battlefield.length,2);assert.ok(g.players[0].zones.battlefield.every(c=>c.id==='green-warrior'));assert.equal(g.players[0].tokenCatalog.length,1);
});
