import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,resetGame} from '../engine.mjs';
import {createTokenCopies,tokenCopyDefinition} from '../tokens.mjs';
import {cardFace,manaValue} from '../card-state.mjs';
import {combatStats,keywordSet} from '../creature-rules.mjs';
import {activateMana,activateLoyaltyAction,castSpell,resolveTop,counterTop} from '../casting.mjs';
import {activatedAbilities,addMana} from '../mana.mjs';
import {queueCombatTriggers,chooseTriggerTarget} from '../combat-effects.mjs';
import {effectTargetOptions} from '../effect-targets.mjs';
import {compileOracleEffect} from '../oracle-effects.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const records=['jace','atraxa'].flatMap(name=>JSON.parse(readFileSync(new URL('./fixtures/playtest-decks/'+name+'.json',import.meta.url))).cards);
const card=(name,extra={})=>({instance:crypto.randomUUID(),name,type_line:'Creature',power:'2',toughness:'2',mana_cost:'{2}',oracle_text:'',counters:{},...extra});
const real=name=>card(name,structuredClone(records.find(c=>c.name===name)));
const manaTotal=player=>(player.mana||[]).reduce((sum,m)=>sum+m.amount,0);
function game(){const g=newGame(2);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}

test('copies carry independent copiable values and fresh abilities, not runtime counters or grants',()=>{
 const g=game(),source=enter(g,card('Mana creature',{oracle_text:'{T}: Add {G}.',localImages:['original-art']}));
 Object.assign(source,{commander:true,tapped:true,markedDamage:1,monstrous:true,temporaryKeywords:['flying'],counters:{'+1/+1':4},imprintProfile:{power:'9',toughness:'9'}});
 const [a,b]=createTokenCopies(g,0,source,2);assert.notEqual(a.instance,b.instance);assert.equal(a.oracle_text,source.oracle_text);assert.deepEqual(a.localImages,['original-art']);assert.equal(a.commander,undefined);assert.equal(a.monstrous,undefined);assert.equal(a.markedDamage,undefined);assert.deepEqual(a.counters,{});assert.equal(a.tapped,false);assert.equal(combatStats(g,0,a).power,2);assert.equal(keywordSet(g,0,a).has('flying'),false);
 const ability=activatedAbilities(g,0,a)[0];assert.throws(()=>activateMana(g,a.instance,ability.id),/sick|summon/i);a.summoningSick=false;activateMana(g,a.instance,ability.id);assert.equal(manaTotal(g.players[0]),1);assert.equal(b.tapped,false);assert.equal(manaValue(a),2);
 source.oracle_text='';transfer(g,source.instance,'graveyard',0);assert.equal(activatedAbilities(g,0,b).length,1);validateSession(JSON.parse(JSON.stringify(g)));
});

test('real Quantum Misalignment resolves a nonlegendary Memnarch with working entry and attack triggers',()=>{
 const g=game(),source=enter(g,real('Memnarch, the Warden')),spell=real('Quantum Misalignment');g.players[0].zones.hand.push(spell);addMana(g.players[0],{U:5});
 g.players[0].zones.library=Array.from({length:8},(_,i)=>card('Draw '+i));castSpell(g,spell.instance,{targets:['card:'+source.instance]});assert.equal(g.players[0].zones.battlefield.length,1);
 resolveTop(g);const copy=g.players[0].zones.battlefield.find(c=>c.token&&c.name===source.name);assert.ok(copy);assert.ok(!copy.type_line.includes('Legendary'));assert.ok(keywordSet(g,0,copy).has('indestructible'));assert.equal(g.players[0].zones.exile[0].instance,spell.instance);assert.equal(g.stack.length,1);
 resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.name==='Myr').length,2);
 queueCombatTriggers(g,[{kind:'attack',owner:0,card:copy,defender:1,defenderTarget:{kind:'player',owner:1}}]);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].zones.hand.length,4);assert.equal(g.pendingEffect,undefined);
 const [second]=createTokenCopies(g,0,copy);assert.ok(!second.type_line.includes('Legendary'));assert.equal(second.oracle_text,copy.oracle_text);
});

test('countered copy spells and targets that left and returned produce no token',()=>{
 for(const countered of [false,true]){const g=game(),source=enter(g,card('Source')),spell=real('Quantum Misalignment');g.players[0].zones.hand.push(spell);addMana(g.players[0],{U:5});castSpell(g,spell.instance,{targets:['card:'+source.instance]});
 if(countered)counterTop(g);else{transfer(g,source.instance,'exile',0);transfer(g,source.instance,'battlefield',0);resolveTop(g);}assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,0);assert.equal(g.players[0].zones.graveyard[0].instance,spell.instance);}
});

test('Tamiyo exiles the exact-mana-value permanent and makes a functioning copy after resolving',()=>{
 const g=game(),tamiyo=enter(g,real('Tamiyo, Compleated Sage')),source=card('Grave mana rock',{type_line:'Artifact',mana_cost:'{2}',oracle_text:'{T}: Add {C}{C}.'});g.players[0].zones.graveyard=[source,card('Wrong cost',{mana_cost:'{1}'}),card('Land',{type_line:'Land',mana_cost:''})];
 activateLoyaltyAction(g,tamiyo.instance,1,2);const entry=g.stack.at(-1);assert.deepEqual(effectTargetOptions(g,entry).map(o=>o.id),[source.instance]);chooseTriggerTarget(g,entry.id,['card:'+source.instance]);assert.equal(g.players[0].zones.graveyard.length,3);resolveTop(g);
 assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].zones.exile[0].instance,source.instance);const copy=g.players[0].zones.battlefield.find(c=>c.token);assert.equal(copy.oracle_text,source.oracle_text);activateMana(g,copy.instance,activatedAbilities(g,0,copy)[0].id);assert.equal(manaTotal(g.players[0]),2);
});

test('manual copies can use an opponent public permanent but reject private cards and foreign destinations',()=>{
 let g=game();const source=enter(g,card('Opponent source'),1),secret=card('Secret');g.players[1].zones.hand.push(secret);
 assert.throws(()=>reduceAction(g,{type:'copyToken',id:secret.instance,count:1},0),/eligible/);assert.throws(()=>reduceAction(g,{type:'copyToken',id:source.instance,count:1,owner:1},0),/own seat/);
 assert.throws(()=>reduceAction(g,{type:'copyToken',id:source.instance,count:1,battlefieldId:'old'},0),/changed zones/);
 g=reduceAction(g,{type:'copyToken',id:source.instance,count:2},0).game;assert.equal(g.players[0].zones.battlefield.length,2);assert.ok(g.players[0].zones.battlefield.every(c=>c.token&&c.ownerSeat===0));assert.equal(g.players[1].zones.battlefield.length,1);assert.equal(projectGame(g,0).players[1].zones.hand[0].hidden,true);
 assert.equal(resetGame(g).players[0].zones.library.length,0);
});

test('copying face-down permanents never exposes their printed characteristics',()=>{
 const g=game(),source=enter(g,card('Secret dragon',{power:'9',oracle_text:'Flying',id:'secret-id',localImages:['secret-art']}));source.faceDown=true;source.manifested=true;
 const [copy]=createTokenCopies(g,1,source);assert.equal(copy.power,'2');assert.equal(copy.oracle_text,'');assert.equal(copy.id,undefined);assert.equal(copy.localImages,undefined);assert.equal(copy.faceDown,undefined);assert.equal(copy.manifested,undefined);assert.ok(!JSON.stringify(copy).includes('Secret dragon'));assert.equal(copy.card_faces,undefined);
});

test('double-faced copies retain both faces and enter on the copied face without inheriting state',()=>{
 const g=game(),source=enter(g,card('Front // Back',{layout:'transform',card_faces:[{name:'Front',type_line:'Creature',power:'2',toughness:'2',oracle_text:'{T}: Add {G}.'},{name:'Back',type_line:'Creature',power:'4',toughness:'4',oracle_text:'Flying'}]}));source.face=1;source.counters['+1/+1']=2;
 const [copy]=createTokenCopies(g,0,source);assert.equal(copy.face,1);assert.equal(cardFace(copy).name,'Back');assert.equal(combatStats(g,0,copy).power,4);copy.face=0;assert.equal(activatedAbilities(g,0,copy).length,1);assert.equal(source.face,1);validateSession(JSON.parse(JSON.stringify(g)));
});

test('permanent and token copies keep printed abilities without copying animation or changing the reserve',()=>{
 const g=game(),vehicle=enter(g,card('Vehicle',{type_line:'Artifact — Vehicle',oracle_text:'Crew 2',power:'4',toughness:'4'}));vehicle.animatedCreature={turn:'1:0'};
 g.players[0].tokenCatalog=[{tokenTemplate:true,name:'Copy',type_line:'Token',oracle_text:'This token represents a copy.'}];const [copy]=createTokenCopies(g,0,vehicle);assert.equal(copy.type_line,'Artifact — Vehicle');assert.equal(copy.animatedCreature,undefined);assert.equal(g.players[0].tokenCatalog.length,1);
 assert.equal(compileOracleEffect("Create a token that's a copy of target creature, except it has an unsupported exception."),null);assert.equal(tokenCopyDefinition(vehicle).oracle_text,'Crew 2');
});

test('blank Copy markers cannot create inert substitutes for copied permanents',()=>{
 const g=game();g.players[0].tokenCatalog=[{tokenTemplate:true,name:'Copy',type_line:'Token',oracle_text:"(This token can be used to represent a token that's a copy of a permanent.)"}];
 assert.throws(()=>reduceAction(g,{type:'token',templateIndex:0,count:1},0),/battlefield permanent to copy/);assert.equal(g.players[0].zones.battlefield.length,0);
});

test('multiple copied Nyxbloom static abilities apply independently and survive removal of the original',()=>{
 const g=game(),source=enter(g,real('Nyxbloom Ancient'));
 const copies=createTokenCopies(g,0,source,2);
 const forest=enter(g,real('Forest'));
 activateMana(g,forest.instance,'basic:G');
 assert.equal(manaTotal(g.players[0]),27);
 // Each surviving token remains a live rules provider, including after save.
 transfer(g,source.instance,'graveyard',0);
 const restored=validateSession(JSON.parse(JSON.stringify(g)));
 restored.players[0].mana=[];
 const secondForest=enter(restored,real('Forest'));
 activateMana(restored,secondForest.instance,'basic:G');
 assert.equal(manaTotal(restored.players[0]),9);
 assert.ok(copies.every(copy=>restored.players[0].zones.battlefield.some(c=>c.instance===copy.instance)));
});
