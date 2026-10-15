import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,endTurn,validateSession,resetGame,draw,changePlayerCount} from '../engine.mjs';
import {applyOracleEffect} from '../oracle-effects.mjs';
import {addExtraTurns,phaseOut} from '../turn-effects.mjs';
import {combatStats,keywordSet} from '../creature-rules.mjs';
import {cleanTurnDamage} from '../combat.mjs';
import {loyaltyStatus,availableLoyaltyAbilities} from '../planeswalker.mjs';
import {castingPermission} from '../spell-rules.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
import {spellPayment,addMana} from '../mana.mjs';
import {castSpell,activateLoyaltyAction,activateMana,resolveTop} from '../casting.mjs';
import {checkPlayerLosses} from '../game-outcome.mjs';
const cards=JSON.parse(readFileSync(new URL('./fixtures/playtest-decks/atraxa.json',import.meta.url))).cards;
const make=name=>({...structuredClone(cards.find(c=>c.name===name)),instance:crypto.randomUUID(),counters:{},face:0});
function enter(g,name,owner=0){const card=make(name);g.players[owner].zones.hand.push(card);transfer(g,card.instance,'battlefield',owner,undefined,{deferTriggers:true});return card;}

for(const count of [2,3,4])test(count+' seats: newest extra turns run first and preserve the ordinary successor',()=>{
 const g=newGame(count);g.active=0;g.step=9;
 addExtraTurns(g,0,2);addExtraTurns(g,1,1);
 const stamps=new Set([g.turn+':'+g.active]);
 for(const expected of [1,0,0,1]){endTurn(g);assert.equal(g.active,expected);const stamp=g.turn+':'+g.active;assert.ok(!stamps.has(stamp));stamps.add(stamp);validateSession(g);}
 assert.equal(g.normalTurnNext,undefined);
});

test('Teferi and Scepter Oracle effects queue extra turns only on resolution; loyalty resets next turn',()=>{
 const g=newGame(2);g.step=3;const teferi=enter(g,'Teferi, Master of Time');teferi.loyaltyActivations={turn:g.turn+':0',used:1};
 assert.equal(loyaltyStatus(g,0,teferi).remaining,0);
 assert.equal(applyOracleEffect(g,{owner:0,source:teferi,text:'Take two extra turns after this one.'}),true);
 assert.equal(g.active,0);assert.deepEqual(g.extraTurns,[0,0]);endTurn(g);g.step=3;
 assert.equal(loyaltyStatus(g,0,teferi).remaining,1);
 assert.equal(applyOracleEffect(g,{owner:1,source:make("Magistrate's Scepter"),text:'Take an extra turn after this one.'}),true);
 endTurn(g);assert.equal(g.active,1);endTurn(g);assert.equal(g.active,0);endTurn(g);assert.equal(g.active,1);
});

test('phasing preserves an incarnation and attachments, expires damage, and phases in before untapping',()=>{
 const g=newGame(2);g.step=3;const creature=enter(g,'Thrummingbird',1),equipment=enter(g,'Sword of Truth and Justice');
 creature.counters['+1/+1']=2;creature.markedDamage=1;creature.tapped=true;creature.temporaryStats={power:1,toughness:1};equipment.attachedTo=creature.instance;equipment.attachedBattlefieldId=creature.battlefieldId;
 const incarnation=creature.battlefieldId;
 assert.equal(applyOracleEffect(g,{owner:0,source:make('Teferi, Master of Time'),text:"Target creature you don't control phases out.",targets:[{kind:'card',id:creature.instance,owner:1,zone:'battlefield',battlefieldId:incarnation}]}),true);
 assert.equal(g.phasedOut.length,2);assert.equal(g.players[1].zones.battlefield.length,0);assert.equal(g.stack.length,0);validateSession(g);
 const saved=JSON.parse(JSON.stringify(g));validateSession(saved);cleanTurnDamage(g);assert.equal(creature.markedDamage,undefined);assert.equal(creature.temporaryStats,undefined);
 endTurn(g,{automatic:true});assert.equal(g.phasedOut.length,0);assert.equal(g.players[1].zones.battlefield[0],creature);assert.equal(creature.battlefieldId,incarnation);assert.equal(creature.counters['+1/+1'],2);assert.equal(creature.tapped,false);assert.equal(equipment.attachedTo,creature.instance);assert.equal(g.stack.length,0);
});

test('phased-out face-down information stays private, and resetting retains the physical card',()=>{
 const g=newGame(2),card=enter(g,'Thrummingbird',1);card.faceDown=true;phaseOut(g,card.instance);
 const view=projectGame(g,0);assert.equal(view.phasedOut[0].card.name,'Hidden card');assert.equal(view.phasedOut[0].card.hidden,true);
 const fresh=resetGame(g);assert.equal(fresh.players[1].zones.hand.length,1);assert.equal(fresh.players[1].zones.hand[0].name,'Thrummingbird');assert.equal(fresh.phasedOut,undefined);
});

test('Elspeth emblem remains after its planeswalker leaves and buffs only its controller',()=>{
 const g=newGame(2);const source=enter(g,"Elspeth, Sun's Champion"),own=enter(g,'Thrummingbird'),foe=enter(g,'Thrummingbird',1);
 assert.equal(applyOracleEffect(g,{owner:0,source,text:'You get an emblem with "Creatures you control get +2/+2 and have flying."'}),true);
 transfer(g,source.instance,'graveyard',0);assert.equal(combatStats(g,0,own).power,3);assert.equal(combatStats(g,1,foe).power,1);assert.ok(keywordSet(g,0,own).has('flying'));validateSession(g);
 assert.equal(resetGame(g).players[0].emblems,undefined);
});

test('Tamiyo and Teferi emblems supply persistent casting and loyalty permissions',()=>{
 const g=newGame(2);g.active=1;g.step=3;const walker=enter(g,'Kasmina, Enigma Sage');
 for(const text of ['You may cast spells from your hand without paying their mana costs.',"You may activate loyalty abilities of planeswalkers you control on any player's turn any time you could cast an instant."]){assert.equal(applyOracleEffect(g,{owner:0,source:make('Tamiyo, Field Researcher'),text:'You get an emblem with "'+text+'"'}),true);}
 assert.equal(castingPermission(g,0,make('Deepglow Skate'),'hand').free,true);assert.equal(castingPermission(g,0,make('Deepglow Skate'),'command').free,undefined);assert.equal(castingPermission(g,1,make('Deepglow Skate'),'hand').free,undefined);
 assert.equal(loyaltyStatus(g,0,walker).instant,true);assert.equal(loyaltyStatus(g,0,walker).reason,'');validateSession(g);
});

test('Teferi Hero emblem still triggers from drawing after Teferi leaves the battlefield',()=>{
 const g=newGame(2);g.step=3;const source=enter(g,'Teferi, Hero of Dominaria');enter(g,'Sol Ring',1);g.players[0].zones.library.push(make('Forest'));
 assert.equal(applyOracleEffect(g,{owner:0,source,text:'You get an emblem with "Whenever you draw a card, exile target permanent an opponent controls."'}),true);
 transfer(g,source.instance,'graveyard',0);draw(g,0);assert.equal(g.stack.length,1);assert.match(g.stack[0].text,/exile target permanent/i);validateSession(g);
});

test('an emblem permits paying the printed cost for nonzero X instead of taking the free alternative',()=>{
 const g=newGame(2);g.step=3;g.responseMode='hold';const card=make('Everflowing Chalice');card.mana_cost='{X}{X}';g.players[0].zones.hand.push(card);
 applyOracleEffect(g,{owner:0,source:make('Tamiyo, Field Researcher'),text:'You get an emblem with "You may cast spells from your hand without paying their mana costs."'});
 addMana(g.players[0],{C:6});assert.equal(spellPayment(g,0,card,'hand',{x:3}),null);
 assert.ok(spellPayment(g,0,card,'hand',{x:3,payPrintedCost:true}));castSpell(g,card.instance,{x:3,payPrintedCost:true});assert.equal(g.stack[0].castX,3);assert.equal(g.players[0].mana.length,0);validateSession(g);
});

test('eliminated players lose their emblems and phased-out cards without death triggers',()=>{
 const g=newGame(3);const card=enter(g,'Thrummingbird',1);phaseOut(g,card.instance);
 applyOracleEffect(g,{owner:1,source:make("Elspeth, Sun's Champion"),text:'You get an emblem with "Creatures you control get +2/+2 and have flying."'});
 g.players[1].life=0;checkPlayerLosses(g);assert.equal(g.players[1].emblems,undefined);assert.equal(g.phasedOut.length,0);assert.equal(g.departedCards[0].card.instance,card.instance);assert.equal(g.stack.length,0);validateSession(g);
});

for(const name of ["Elspeth, Sun's Champion",'Tamiyo, Field Researcher','Teferi, Hero of Dominaria','Teferi, Temporal Archmage'])test(name+' ultimate resolves its complete printed instruction after the source dies paying loyalty',()=>{
 const g=newGame(2);g.step=3;g.responseMode='hold';g.players[0].zones.library=Array.from({length:5},()=>make('Forest'));const source=enter(g,name),ability=availableLoyaltyAbilities(g,0,source).find(a=>a.text.includes('You get an emblem'));
 source.counters.loyalty=-ability.delta;activateLoyaltyAction(g,source.instance,ability.key);assert.equal(g.players[0].emblems,undefined);assert.ok(g.players[0].zones.graveyard.some(c=>c.instance===source.instance));resolveTop(g);assert.equal(g.players[0].emblems.length,1);assert.equal(g.players[0].zones.hand.length,name==='Tamiyo, Field Researcher'?3:0);assert.equal(g.pendingEffect,undefined);validateSession(g);
});

test('Magistrates Scepter pays counters and taps immediately, but grants its extra turn only on resolution',()=>{
 const g=newGame(2);g.step=3;g.responseMode='hold';const source=enter(g,"Magistrate's Scepter");source.counters.charge=3;activateMana(g,source.instance,'action:1');assert.equal(source.tapped,true);assert.equal(source.counters.charge,undefined);assert.equal(g.extraTurns,undefined);resolveTop(g);assert.deepEqual(g.extraTurns,[0]);endTurn(g);assert.equal(g.active,0);endTurn(g);assert.equal(g.active,1);validateSession(g);
});

test('changing seat count retains phased-out physical cards in the saved deck for an inactive seat',()=>{
 const g=newGame(4),card=enter(g,'Thrummingbird',2);phaseOut(g,card.instance);const two=changePlayerCount(g,2);validateSession(two);const four=changePlayerCount(two,4);validateSession(four);assert.equal(four.players[2].zones.hand[0].instance,card.instance);assert.equal(four.phasedOut,undefined);
});
