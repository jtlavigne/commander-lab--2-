import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession} from '../engine.mjs';
import {availableLoyaltyAbilities,loyaltyStatus} from '../planeswalker.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
import {resolveOracleChoice,oracleChoiceOptions} from '../oracle-effects.mjs';
import {applyOracleEffect} from '../oracle-effects.mjs';
import {createTokens} from '../tokens.mjs';
import {resolveTop,activateLoyaltyAction,passPriority,resolveProliferate} from '../casting.mjs';
import {discoverTokens,matchingToken} from '../token-catalog.mjs';
const decks=['atraxa','jace'].map(name=>JSON.parse(readFileSync(new URL('./fixtures/playtest-decks/'+name+'.json',import.meta.url))));
const make=name=>{const c=decks.flatMap(d=>d.cards).find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{},face:0};};
const game=()=>{const g=newGame(2);g.step=3;g.responseMode='hold';return g;};
function enter(g,name,owner=0){const c=make(name);g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
test('both exact user lists contain 100 cards with every name resolved and fresh instance metadata',()=>{
 assert.deepEqual(decks.map(d=>d.cards.length),[95,98]);
 for(const deck of decks){assert.equal(deck.total,100);assert.equal(deck.cards.reduce((s,c)=>s+c.quantity,0),100);assert.deepEqual(deck.not_found,[]);assert.ok(deck.cards.every(c=>c.id&&c.name&&c.type_line));}
});
test('Kasmina shares loyalty actions live, Gauntlet coexists, and Oath changes their shared activation budget',()=>{
 const g=game(),kasmina=enter(g,'Kasmina, Enigma Sage'),jace=enter(g,'Jace, Multiverse Architect');enter(g,'Ichormoon Gauntlet');enter(g,'Oath of Teferi');const foe=enter(g,'Teferi, Master of Time',1);
 let actions=availableLoyaltyAbilities(g,0,jace);assert.ok(actions.some(a=>a.text==='Scry 1.'&&a.grantedBy===kasmina.name));assert.ok(actions.some(a=>/Proliferate/.test(a.text)&&a.cost==='0'));
 assert.ok(!availableLoyaltyAbilities(g,1,foe).some(a=>a.grantedBy===kasmina.name));assert.equal(loyaltyStatus(g,0,jace).limit,2);
 // Zero loyalty-cost proliferate uses the same budget as inherited/printed actions.
 const inherited=actions.find(a=>a.cost==='0');activateLoyaltyAction(g,jace.instance,inherited.key);assert.equal(loyaltyStatus(g,0,jace).used,1);assert.equal(g.stack.length,1);
 transfer(g,kasmina.instance,'graveyard',0);assert.ok(!availableLoyaltyAbilities(g,0,jace).some(a=>a.text==='Scry 1.'));
 validateSession(g);
});
test('Nicol Bolas inherits opponents and transitive loyalty grants without infinite copy loops',()=>{
 const g=game(),bolas=enter(g,'Nicol Bolas, Dragon-God'),jace=enter(g,'Jace, Multiverse Architect',1),kasmina=enter(g,'Kasmina, Enigma Sage',1),other=enter(g,'Nicol Bolas, Dragon-God',1);
 let abilities=availableLoyaltyAbilities(g,0,bolas);assert.ok(abilities.some(a=>a.text==='Scry 1.'));assert.ok(abilities.some(a=>a.text.startsWith('Draw two cards')));assert.equal(new Set(abilities.map(a=>a.cost+':'+a.text)).size,abilities.length);assert.ok(abilities.length<20);
 jace.faceDown=true;kasmina.faceDown=true;other.faceDown=true;assert.equal(availableLoyaltyAbilities(g,0,bolas).length,3);
});
test('Staff of the Storyteller receives one trigger per token-creation event, after its own Spirit enters',()=>{
 const g=game(),staff=make('Staff of the Storyteller');g.players[0].zones.hand.push(staff);transfer(g,staff.instance,'battlefield',0);
 assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,1);assert.equal(g.stack.length,1);assert.equal(staff.counters.story,undefined);validateSession(g);resolveTop(g);assert.equal(staff.counters.story,1);
 createTokens(g,0,{name:'Soldier',type_line:'Token Creature',oracle_text:'',power:'1',toughness:'1'},3);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(staff.counters.story,2);
 createTokens(g,1,{name:'Soldier',type_line:'Token Creature',oracle_text:'',power:'1',toughness:'1'},1);assert.equal(g.stack.length,0);
 createTokens(g,0,{name:'Treasure',type_line:'Token Artifact',oracle_text:''},1);assert.equal(g.stack.length,0);
});
test('Kher Keep creates the named Kobold and keeps its creature subtype distinct from its name',()=>{
 const g=game(),card=make('Kher Keep'),text=card.oracle_text.split('\n')[1].split(': ')[1];assert.equal(applyOracleEffect(g,{owner:0,source:card,text}),true);
 const token=g.players[0].zones.battlefield[0];assert.equal(token.name,'Kobolds of Kher Keep');assert.match(token.type_line,/Kobold$/);assert.equal(token.power,'0');assert.equal(token.toughness,'1');assert.deepEqual(token.colors,['R']);
 assert.equal(discoverTokens([card]).definitions[0].name,token.name);
});
test('X-sized Shark tokens use the variable token artwork without changing their resolved stats',()=>{
 const g=game();g.players[0].tokenCatalog=[{name:'Shark',type_line:'Token Creature — Shark',oracle_text:'Flying',power:'X',toughness:'X',colors:['U'],localImages:['shark art']}];
 const source=make('Shark Typhoon');assert.equal(applyOracleEffect(g,{owner:0,source,castX:4,text:'Create an X/X blue Shark creature token with flying.'}),true);
 const token=g.players[0].zones.battlefield[0];assert.equal(token.power,'4');assert.equal(token.toughness,'4');assert.deepEqual(token.localImages,['shark art']);
});

test('Kasmina Fractal receives the chosen X counters and shared counter replacements before state-based actions',()=>{
 const g=game(),kasmina=enter(g,'Kasmina, Enigma Sage');enter(g,'Vorinclex, Monstrous Raider');
 const text=kasmina.oracle_text.split('\n')[2].replace(/^.*?: /,'');assert.equal(applyOracleEffect(g,{owner:0,source:kasmina,castX:3,text}),true);
 const fractal=g.players[0].zones.battlefield.find(c=>c.token);assert.equal(fractal.name,'Fractal');assert.equal(fractal.power,'0');assert.equal(fractal.counters['+1/+1'],6);validateSession(g);
});
test('Jace draw/bottom and Brainsurge draw/top use private choices and preserve the remaining library order',()=>{
 for(const [name,drawn,put,placement] of [['Jace, Multiverse Architect',2,1,'bottom'],['Brainsurge',4,2,'top']]){
  const g=game(),source=make(name);g.players[0].zones.library=Array.from({length:8},(_,i)=>({instance:'lib'+i,name:'Library '+i,type_line:'Land',oracle_text:'',counters:{},face:0}));
  const text=name.startsWith('Jace')?source.oracle_text.split('\n')[1].replace(/^.*?: /,''):source.oracle_text;
  assert.equal(applyOracleEffect(g,{owner:0,name:source.name,source,text}),true);assert.equal(g.players[0].zones.hand.length,drawn);assert.equal(g.pendingEffect.step.placement,placement);validateSession(g);
  assert.equal(projectGame(g,1).pendingEffect.kind,'remote-choice');assert.ok(projectGame(g,1).players[0].zones.hand.every(c=>c.hidden));
  const ids=oracleChoiceOptions(g).slice(0,put).map(o=>o.key);resolveOracleChoice(g,ids);const expected=Array.from({length:8-drawn},(_,i)=>'lib'+(drawn+i));
  assert.deepEqual(g.players[0].zones.library.map(c=>c.instance),placement==='bottom'?[...expected,...ids]:[...ids,...expected]);assert.equal(g.pendingEffect,undefined);
 }
});
test('Tezzeret draw-then-proliferate and Vraska draw/life/proliferate execute the full sequence',()=>{
 for(const [name,drawn,life] of [["Tezzeret's Gambit",2,40],["Vraska, Betrayal's Sting",1,39]]){
  const g=game(),source=make(name);g.players[0].zones.library=Array.from({length:4},(_,i)=>({instance:'lib'+i,name:'Land',type_line:'Land',oracle_text:'',counters:{},face:0}));g.players[1].poison=1;
  const text=name.startsWith('Vraska')?source.oracle_text.split('\n')[1].replace(/^.*?: /,''):source.oracle_text;
  assert.equal(applyOracleEffect(g,{owner:0,name:source.name,source,text}),true);assert.equal(g.players[0].zones.hand.length,drawn);assert.equal(g.players[0].life,life);assert.equal(g.pendingEffect.kind,'proliferate');
  resolveProliferate(g,[],[1]);assert.equal(g.players[1].poison,2);
 }
});
