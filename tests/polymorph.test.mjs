import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession} from '../engine.mjs';
import {activateLoyaltyAction,activateMana,castSpell,resolveTop,passPriority,prioritySeat} from '../casting.mjs';
import {chooseTriggerTarget,triggerTargetOptions,queueCombatTriggers} from '../combat-effects.mjs';
import {resolveOracleChoice} from '../oracle-effects.mjs';
import {addMana,activatedAbilities} from '../mana.mjs';
import {createTokens} from '../tokens.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/playtest-decks/jace.json',import.meta.url))).cards;
const make=name=>({...structuredClone(records.find(c=>c.name===name)),instance:crypto.randomUUID(),counters:{},face:0});
function game(){const g=newGame(2);g.step=3;g.responseMode='hold';g.players.forEach(p=>addMana(p,{W:20,U:20,R:20,C:20}));return g;}
function enter(g,name,owner=0){const card=make(name);g.players[owner].zones.hand.push(card);transfer(g,card.instance,'battlefield',owner,undefined,{deferTriggers:true});return card;}
function cast(g,name){const c=make(name);g.players[0].zones.hand.push(c);castSpell(g,c.instance);return c;}
function activate(g,card,target){const ability=activatedAbilities(g,g.players.findIndex(p=>p.zones.battlefield.includes(card)),card).find(a=>!a.output);activateMana(g,card.instance,ability.id,{targets:['card:'+target.instance]});}
const passRound=g=>{for(let i=0;i<g.players.length;i++)passPriority(g,prioritySeat(g));};

test('Jace targets another own creature or walker, reveals publicly and does not expose the rest of the library',()=>{
 const g=game(),jace=enter(g,'Jace, Multiverse Architect'),victim=enter(g,'Sun Titan'),foe=enter(g,'Sun Titan',1),library=['Island','Teferi, Master of Time','Sol Ring'].map(make);g.players[0].zones.library=library;
 activateLoyaltyAction(g,jace.instance,1);const entry=g.stack.at(-1),options=triggerTargetOptions(g,entry);assert.ok(options.some(o=>o.id===victim.instance));assert.ok(!options.some(o=>[jace.instance,foe.instance].includes(o.id)));
 chooseTriggerTarget(g,entry.id,'card:'+victim.instance);assert.ok(g.players[0].zones.battlefield.includes(victim));passRound(g);
 assert.equal(g.pendingEffect.step.op,'polymorphReveal');assert.ok(g.players[0].zones.exile.includes(victim));assert.deepEqual(g.pendingEffect.step.hits,[library[1].instance]);
 const opponent=projectGame(g,1);assert.equal(opponent.players[0].zones.library[0].name,'Island');assert.equal(opponent.players[0].zones.library[2].hidden,true);validateSession(g);
 const resumed=JSON.parse(JSON.stringify(g));validateSession(resumed);resolveOracleChoice(resumed,[]);
 assert.ok(resumed.players[0].zones.battlefield.some(c=>c.instance===library[1].instance));assert.deepEqual(resumed.players[0].zones.library.map(c=>c.name),['Sol Ring','Island']);assert.equal(resumed.pendingEffect,undefined);validateSession(resumed);
});

test('Identity Echo resolves the same reveal pipeline after paying its activation cost',()=>{
 const g=game(),echo=enter(g,'Identity Echo'),victim=enter(g,'Sun Titan');g.players[0].zones.library=['Island','Jace, the Mind Sculptor','Sol Ring'].map(make);
 activate(g,echo,victim);assert.equal(g.stack.length,1);assert.ok(g.players[0].zones.battlefield.includes(victim));resolveTop(g);assert.equal(g.pendingEffect.step.op,'polymorphReveal');resolveOracleChoice(g,[]);assert.ok(g.players[0].zones.battlefield.some(c=>c.name==='Jace, the Mind Sculptor'));assert.equal(g.pendingEffect,undefined);validateSession(g);
});

test('Proteus Staff uses the creatures controller library and lets that player order the revealed remainder',()=>{
 const g=game();g.active=1;const staff=enter(g,'Proteus Staff',1),victim=enter(g,'Archon of Cruelty');victim.ownerSeat=1;
 const library=['Island','Sol Ring','Sun Titan','Plains'].map(make);g.players[0].zones.library=library;g.players[1].zones.library=[make('Swamp')];activate(g,staff,victim);resolveTop(g);
 assert.equal(g.pendingEffect.owner,0);assert.equal(g.players[1].zones.library.at(-1).instance,victim.instance);resolveOracleChoice(g,[]);
 assert.equal(g.pendingEffect.step.op,'orderBottomLibrary');assert.equal(g.pendingEffect.owner,0);resolveOracleChoice(g,[library[1].instance,library[0].instance]);assert.deepEqual(g.players[0].zones.library.map(c=>c.name),['Plains','Sol Ring','Island']);assert.ok(g.players[0].zones.battlefield.some(c=>c.name==='Sun Titan'));validateSession(g);
});

test('Mass Polymorph counts exiled tokens, skips walkers and batches enters triggers after the reveal',()=>{
 const g=game();createTokens(g,0,{name:'Soldier',type_line:'Token Creature',power:'1',toughness:'1',oracle_text:''},2);const library=['Island','Jace, the Mind Sculptor','Sun Titan','Plains','Archon of Cruelty','Swamp'].map(make);g.players[0].zones.library=library;
 cast(g,'Mass Polymorph');assert.equal(g.players[0].zones.battlefield.length,2);resolveTop(g);assert.equal(g.players[0].zones.battlefield.length,0);assert.equal(g.players[0].zones.exile.length,0);assert.deepEqual(g.pendingEffect.step.hits,[library[2].instance,library[4].instance]);assert.equal(g.stack.filter(e=>e.combatTrigger).length,0);
 resolveOracleChoice(g,[]);assert.equal(g.players[0].zones.battlefield.length,2);assert.equal(g.players[0].zones.library.length,4);assert.ok(g.players[0].zones.library.some(c=>c.name==='Jace, the Mind Sculptor'));assert.ok(g.stack.some(e=>e.name.includes('Archon')));validateSession(g);
});

test('Synthetic Destiny stores the number exiled, waits for the next end step and its trigger can be answered',()=>{
 const g=game();createTokens(g,0,{name:'Soldier',type_line:'Token Creature',power:'1',toughness:'1',oracle_text:''},2);g.players[0].zones.library=['Sun Titan','Archon of Cruelty','Island'].map(make);cast(g,'Synthetic Destiny');resolveTop(g);
 assert.equal(g.pendingEffect,undefined);assert.equal(g.delayedTriggers.length,1);assert.equal(g.players[0].zones.library.length,3);enter(g,'Ovika, Enigma Goliath');
 g.step=10;queueCombatTriggers(g,[{kind:'end-step',owner:0}]);assert.equal(g.stack.length,1);assert.equal(g.delayedTriggers.length,0);assert.equal(g.players[0].zones.library.length,3);resolveTop(g);
 assert.equal(g.pendingEffect.step.hits.length,2);resolveOracleChoice(g,[]);assert.equal(g.players[0].zones.battlefield.length,3);assert.equal(g.players[0].zones.library.length,1);validateSession(g);
});

test('Jace ability fizzles without revealing when its only target leaves before resolution',()=>{
 const g=game(),jace=enter(g,'Jace, Multiverse Architect'),victim=enter(g,'Sun Titan');g.players[0].zones.library=[make('Island'),make('Sun Titan')];activateLoyaltyAction(g,jace.instance,1);chooseTriggerTarget(g,g.stack.at(-1).id,'card:'+victim.instance);transfer(g,victim.instance,'graveyard',0);resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].zones.library.length,2);assert.ok(g.players[0].zones.graveyard.includes(victim));
});

test('Primevals requires a legendary creature or walker and returns only legendary permanent cards',()=>{
 const g=game(),rebirth=make("Primevals' Glorious Rebirth");addMana(g.players[0],{B:10});g.players[0].zones.hand.push(rebirth);assert.throws(()=>castSpell(g,rebirth.instance),/legendary sorcery/);
 const commander=enter(g,'Jace, Multiverse Architect');g.players[0].zones.graveyard=['Teferi, Master of Time','Elesh Norn, Mother of Machines','Sol Ring','Island',"Primevals' Glorious Rebirth"].map(make);
 castSpell(g,rebirth.instance);transfer(g,commander.instance,'exile',0);resolveTop(g);assert.deepEqual(g.players[0].zones.battlefield.map(c=>c.name).sort(),['Elesh Norn, Mother of Machines','Teferi, Master of Time']);assert.ok(g.players[0].zones.graveyard.some(c=>c.name==='Sol Ring'));assert.ok(g.players[0].zones.graveyard.some(c=>c.name==='Island'));assert.equal(g.pendingEffect,undefined);validateSession(g);
});

test('Proteus Staff on a token never finds that token in the library; an empty reveal can finish',()=>{
 const g=game(),staff=enter(g,'Proteus Staff');const [victim]=createTokens(g,0,{name:'Soldier',type_line:'Token Creature',power:'1',toughness:'1',oracle_text:''},1);g.players[0].zones.library=[make('Island')];activate(g,staff,victim);resolveTop(g);assert.equal(g.pendingEffect.step.hits.length,0);assert.equal(g.pendingEffect.step.ids.length,1);resolveOracleChoice(g,[]);resolveOracleChoice(g,g.pendingEffect.step.ids);assert.deepEqual(g.players[0].zones.library.map(c=>c.name),['Island']);assert.equal(g.pendingEffect,undefined);validateSession(g);
});
