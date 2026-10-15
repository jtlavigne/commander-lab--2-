import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,draw,changeStep,validateSession,endTurn,resetGame} from '../engine.mjs';
import {castSpell,resolveTop,counterTop,activateMana} from '../casting.mjs';
import {addMana,activatedAbilities} from '../mana.mjs';
import {chooseTriggerTarget,triggerNeedsTarget,queueCombatTriggers,snapshotCard} from '../combat-effects.mjs';
import {resolveOracleChoice,applyOracleEffect} from '../oracle-effects.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
import {dealDamagePackets,stateBasedActions} from '../combat.mjs';
import {combatStats} from '../creature-rules.mjs';
import {gainLife} from '../resource-rules.mjs';
import {copySpell} from '../stack-effects.mjs';
import {payLife} from '../life-effects.mjs';
import {grantedAbilities} from '../ability-effects.mjs';
import {removePermanents} from '../combat.mjs';
import {oracleChoiceOptions} from '../oracle-effects.mjs';
import {spellTargetOptions,spellModes} from '../spell-effects.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/niv_mizzet_parun.json',import.meta.url))).cards;
const card=name=>{const c=records.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{}};};
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';return g;};
function enter(g,name,owner=0,attachTo){const c=card(name);g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{attachTo});return c;}
function library(g,owner,n=20){g.players[owner].zones.library=Array.from({length:n},()=>card('Island'));}
function cast(g,name,options={},owner=0){const c=card(name);g.players[owner].zones.hand.push(c);addMana(g.players[owner],{U:20,R:20,C:50});castSpell(g,c.instance,options);return c;}
const damageTarget=(g,key='player:1')=>{const trigger=triggerNeedsTarget(g);assert.ok(trigger);chooseTriggerTarget(g,trigger.id,key);};

test('Niv-Mizzet has 82 cached records representing all 100 supplied cards',()=>{assert.equal(records.length,82);assert.equal(records.reduce((n,c)=>n+c.quantity,0),100);});
for(const seats of [2,3,4])test('Niv-Mizzet queues one damage trigger for each actual drawn card without disclosing the hand in '+seats+' seats',()=>{
 const g=game(seats);enter(g,'Niv-Mizzet, Parun');library(g,0);draw(g,0,3,{turnAction:false});assert.equal(g.stack.length,3);assert.equal(g.players[0].zones.hand.length,3);assert.equal(g.players[1].life,40);for(let n=0;n<3;n++)damageTarget(g);while(g.stack.length)resolveTop(g);assert.equal(g.players[1].life,37);for(let owner=1;owner<seats;owner++)assert.ok(projectGame(g,owner).players[0].zones.hand.every(c=>c.hidden));validateSession(JSON.parse(JSON.stringify(g)));
});
test('Niv-Mizzet sees instant and sorcery casts from every player and resolves draw and damage before the underlying spell',()=>{
 const g=game();enter(g,'Niv-Mizzet, Parun');library(g,0);const spell=cast(g,'Opt',{},1);assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.stack.length,2);damageTarget(g);resolveTop(g);assert.equal(g.players[1].life,39);assert.equal(g.stack[0].card.instance,spell.instance);counterTop(g);cast(g,'Sol Ring');assert.equal(g.stack.length,1);counterTop(g);
});
test('a copied spell does not count as a cast, and a cast-trigger still draws after its original spell is countered',()=>{
 const g=game();enter(g,'Niv-Mizzet, Parun');library(g,0);const spell=cast(g,'Opt');transfer(g,spell.instance,'graveyard',0);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);damageTarget(g);resolveTop(g);const source=card('Opt');g.players[0].zones.hand.push(source);transfer(g,source.instance,'stack',0);const entry=g.stack[0];copySpell(g,{id:source.instance,zoneChangeId:source.zoneChangeId},0);assert.equal(g.stack.length,2);assert.equal(g.stack.filter(e=>e.kind==='ability').length,0);
});
test('Niv-Mizzet is uncounterable but still allows responses and its abilities can be removed independently',()=>{
 const g=game(),source=cast(g,'Niv-Mizzet, Parun');assert.throws(()=>counterTop(g),/cannot be countered/);assert.ok(g.stack.some(e=>e.card?.instance===source.instance));resolveTop(g);library(g,0);draw(g,0,1,{turnAction:false});damageTarget(g);counterTop(g);assert.equal(g.players[1].life,40);
});
for(const aura of ['Curiosity','Ophidian Eye'])test(aura+' creates an interruptible optional draw loop only for damage to an opponent',()=>{
 const g=game(),source=enter(g,'Niv-Mizzet, Parun');enter(g,aura,0,source.instance);library(g,0);draw(g,0,1,{turnAction:false});damageTarget(g);resolveTop(g);assert.equal(g.players[1].life,39);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect.step.op,'optional');validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,['yes']);assert.equal(g.stack.length,1);assert.equal(g.players[0].zones.hand.length,2);damageTarget(g);resolveTop(g);resolveTop(g);resolveOracleChoice(g,['no']);assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,0);assert.equal(g.players[1].life,38);
 const events=dealDamagePackets(g,[{source:{owner:0,card:snapshotCard(source)},target:{kind:'player',owner:0},amount:1}]);queueCombatTriggers(g,events);assert.equal(g.stack.length,0);
});
test('Curiosity follows its controller rather than the enchanted creature controller',()=>{
 const g=game(3),source=enter(g,'Niv-Mizzet, Parun',1);enter(g,'Curiosity',0,source.instance);library(g,0);const events=dealDamagePackets(g,[{source:{owner:1,card:snapshotCard(source)},target:{kind:'player',owner:2},amount:1}]);queueCombatTriggers(g,events);assert.equal(g.stack.length,1);assert.equal(g.stack[0].owner,0);resolveTop(g);resolveOracleChoice(g,['yes']);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.players[1].zones.hand.length,0);
});
test('Consecrated Sphinx observes each opposing draw and each optional pair remains separate and declineable',()=>{
 const g=game(3);enter(g,'Consecrated Sphinx');library(g,0);library(g,1);draw(g,1,2,{turnAction:false});assert.equal(g.stack.length,2);resolveTop(g);resolveOracleChoice(g,['yes']);assert.equal(g.players[0].zones.hand.length,2);resolveTop(g);resolveOracleChoice(g,['no']);assert.equal(g.players[0].zones.hand.length,2);assert.equal(g.stack.length,0);
});
test('opposing Sphinx draw triggers never resolve recursively without separate priority and optional choices',()=>{
 const g=game();enter(g,'Consecrated Sphinx');enter(g,'Consecrated Sphinx',1);library(g,0);library(g,1);draw(g,0,1,{turnAction:false});resolveTop(g);assert.equal(g.pendingEffect.owner,1);resolveOracleChoice(g,['yes']);assert.equal(g.stack.length,2);assert.ok(g.stack.every(e=>e.owner===0));resolveTop(g);resolveOracleChoice(g,['no']);resolveTop(g);resolveOracleChoice(g,['no']);assert.equal(g.stack.length,0);
});
test('Thought Reflection replaces each draw separately and stacks multiplicatively with other replacements',()=>{
 const g=game();enter(g,'Thought Reflection');enter(g,"Teferi's Ageless Insight");library(g,0);assert.equal(draw(g,0,2,{turnAction:false}),8);assert.equal(g.players[0].zones.hand.length,8);assert.equal(g.drawHistory.counts[0],8);assert.equal(projectGame(g,1).drawHistory.counts[0],8);
});
test('draw-step exceptions count the first actual card in each draw step, including descendants of replacements',()=>{
 const g=game();enter(g,'Thought Reflection');enter(g,"Teferi's Ageless Insight");library(g,0);changeStep(g,2);assert.equal(draw(g,0,1),3);assert.equal(draw(g,0,1,{turnAction:false}),4);changeStep(g,3);changeStep(g,2);assert.equal(draw(g,0,1),3);validateSession(JSON.parse(JSON.stringify(g)));
});
test('Archive and Insight do not replace the first draw-step card but replace an opponent-turn draw',()=>{
 const g=game();enter(g,"Teferi's Ageless Insight");enter(g,"Alhammarret's Archive");library(g,0);changeStep(g,2);assert.equal(draw(g,0,1),1);assert.equal(draw(g,0,1,{turnAction:false}),4);endTurn(g);g.step=2;assert.equal(draw(g,0,1,{turnAction:false}),4);assert.equal(g.drawHistory.counts[0],4);
});
test('Niv-Mizzet, Crawler and Locust God trigger for each replaced draw, with correct token characteristics and live hand size',()=>{
 const g=game(3),niv=enter(g,'Niv-Mizzet, Parun'),crawler=card('Psychosis Crawler');g.players[0].zones.hand=[crawler,card('Island')];transfer(g,crawler.instance,'battlefield',0);assert.equal(crawler.entryChoices,undefined);assert.equal(combatStats(g,0,crawler).power,1);enter(g,'The Locust God');enter(g,'Thought Reflection');library(g,0);draw(g,0,1,{turnAction:false});assert.equal(g.stack.length,6);damageTarget(g);damageTarget(g);while(g.stack.length)resolveTop(g);assert.deepEqual(g.players.map(p=>p.life),[40,36,38]);const tokens=g.players[0].zones.battlefield.filter(c=>c.token);assert.equal(tokens.length,2);for(const c of tokens){assert.equal(c.power,'1');assert.equal(c.toughness,'1');assert.deepEqual(c.colors,['U','R']);assert.match(c.oracle_text,/flying/i);assert.match(c.oracle_text,/haste/i);}assert.equal(combatStats(g,0,crawler).power,3);g.players[0].zones.hand=[];assert.equal(combatStats(g,0,crawler).toughness,0);stateBasedActions(g);assert.ok(g.players[0].zones.graveyard.includes(crawler));
});
test('Archive doubles life gain from spells and lifelink, while life loss and payments remain unchanged',()=>{
 const g=game();enter(g,"Alhammarret's Archive");gainLife(g,0,3);assert.equal(g.players[0].life,46);assert.ok(applyOracleEffect(g,{owner:0,name:'Life effect',source:{instance:'effect',name:'Life effect'},text:'Gain 2 life.'}));assert.equal(g.players[0].life,50);gainLife(g,0,-4);assert.equal(g.players[0].life,46);const creature=enter(g,'Niv-Mizzet, Parun');creature.temporaryKeywords=['lifelink'];dealDamagePackets(g,[{source:{owner:0,card:snapshotCard(creature)},target:{kind:'player',owner:1},amount:3}]);assert.equal(g.players[0].life,52);payLife(g.players[0],2);assert.equal(g.players[0].life,50);
});

test('Soulbond pairs on the source entry and grants each paired creature its own damage trigger',()=>{
 const g=game(),niv=enter(g,'Niv-Mizzet, Parun'),lookout=enter(g,'Tandem Lookout');library(g,0);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect.step.op,'soulbond');assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[niv.instance]);resolveOracleChoice(g,[niv.instance]);assert.equal(niv.pairedWith.id,lookout.instance);assert.equal(grantedAbilities(g,0,niv).length,1);assert.equal(grantedAbilities(g,0,lookout).length,1);validateSession(JSON.parse(JSON.stringify(g)));const events=dealDamagePackets(g,[{source:{owner:0,card:snapshotCard(niv)},target:{kind:'player',owner:1},amount:1}]);queueCombatTriggers(g,events);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.stack.length,1);damageTarget(g);counterTop(g);
});
test('Soulbond triggers for another entering creature, can be declined, and does not pair with a later entrant from the same trigger',()=>{
 const g=game(),lookout=enter(g,'Tandem Lookout');assert.equal(g.stack.length,0);const first=enter(g,'Young Pyromancer'),second=enter(g,'Archmage Emeritus');assert.equal(g.stack.length,2);resolveTop(g);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[second.instance]);resolveOracleChoice(g,[]);resolveTop(g);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[first.instance]);resolveOracleChoice(g,[first.instance]);assert.equal(lookout.pairedWith.id,first.instance);assert.equal(second.pairedWith,undefined);
});
test('a departing, changing-controller or noncreature member permanently breaks its soulbond pair',()=>{
 for(const change of ['leave','control','type']){const g=game(),lookout=enter(g,'Tandem Lookout'),partner=enter(g,'Young Pyromancer');resolveTop(g);resolveOracleChoice(g,[partner.instance]);if(change==='leave')transfer(g,partner.instance,'hand',0);else if(change==='control')transfer(g,partner.instance,'battlefield',1);else{partner.type_line='Artifact';stateBasedActions(g);partner.type_line='Creature';}assert.equal(lookout.pairedWith,undefined);assert.equal(grantedAbilities(g,0,lookout).length,0);}
});
test('a soulbond trigger rechecks both permanent identities and unpaired status when it resolves',()=>{
 const g=game(),niv=enter(g,'Niv-Mizzet, Parun'),lookout=enter(g,'Tandem Lookout');transfer(g,niv.instance,'hand',0);transfer(g,niv.instance,'battlefield',0);resolveTop(g);resolveOracleChoice(g,[niv.instance]);assert.ok(lookout.pairedWith);resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,0);
});
test('Locust God death return uses two separate triggers and returns only the same graveyard object at the next end step',()=>{
 for(const leaveGraveyard of [false,true]){const g=game(),god=enter(g,'The Locust God');removePermanents(g,[god.instance],{sacrifice:true});assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.delayedTriggers.length,1);validateSession(JSON.parse(JSON.stringify(g)));if(leaveGraveyard)transfer(g,god.instance,'exile',0);changeStep(g,10);assert.equal(g.stack.length,1);assert.equal(g.players[0].zones.hand.length,0);resolveTop(g);assert.equal(g.players[0].zones.hand.includes(god),!leaveGraveyard);assert.equal(g.delayedTriggers.length,0);}
});

test('Prismari Command announces separate damage and loot recipients, including the same player twice',()=>{
 for(const same of [true,false]){const g=game(3);library(g,1);library(g,2);cast(g,'Prismari Command',{mode:0,targets:['player:1',same?'player:1':'player:2']});resolveTop(g);assert.equal(g.players[1].life,38);const owner=same?1:2;assert.equal(g.pendingEffect.owner,owner);assert.equal(g.pendingEffect.step.op,'discard');assert.equal(g.players[owner].zones.hand.length,2);resolveOracleChoice(g,g.players[owner].zones.hand.map(c=>c.instance));assert.equal(g.pendingEffect,undefined);assert.equal(g.players[owner].zones.graveyard.length,2);}
});
test('Prismari Command preserves target roles through a saved discard, then creates treasure for the other chosen player',()=>{
 const g=game(3);library(g,1);cast(g,'Prismari Command',{mode:3,targets:['player:1','player:2']});resolveTop(g);validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,g.players[1].zones.hand.map(c=>c.instance));assert.equal(g.players[1].zones.battlefield.filter(c=>c.token).length,0);assert.equal(g.players[2].zones.battlefield.filter(c=>c.token&&c.name==='Treasure').length,1);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,0);
});
test('Prismari damage/destruction can name the same artifact creature for both modes without changing other targets',()=>{
 const g=game(),artifact=enter(g,'Psychosis Crawler',1);g.players[1].zones.hand=[card('Island'),card('Island'),card('Island')];cast(g,'Prismari Command',{mode:2,targets:['card:'+artifact.instance,'card:'+artifact.instance]});resolveTop(g);assert.ok(g.players[1].zones.graveyard.includes(artifact));assert.equal(g.pendingEffect,undefined);
});
test('Prismari treasure/destruction and damage/treasure modes each resolve only their own target roles',()=>{
 for(const mode of [1,5]){const g=game(3),artifact=enter(g,'Sol Ring',1);cast(g,'Prismari Command',{mode,targets:mode===1?['player:1','player:2']:['player:2','card:'+artifact.instance]});resolveTop(g);assert.equal(g.players[2].zones.battlefield.filter(c=>c.token&&c.name==='Treasure').length,1);assert.equal(g.players[1].life,mode===1?38:40);assert.equal(g.players[1].zones.graveyard.includes(artifact),mode===5);}
});
test('Prismari loot/destruction finishes the private discard before destroying the independently targeted artifact',()=>{
 const g=game(),artifact=enter(g,'Sol Ring',1);library(g,0);cast(g,'Prismari Command',{mode:4,targets:['player:0','card:'+artifact.instance]});resolveTop(g);assert.ok(g.players[1].zones.battlefield.includes(artifact));resolveOracleChoice(g,g.players[0].zones.hand.map(c=>c.instance));assert.ok(g.players[1].zones.graveyard.includes(artifact));
});
test('Electrolyze divides exactly two damage before casting, deals only assigned damage and draws after damage',()=>{
 const g=game(3);library(g,0);const spell=card('Electrolyze');g.players[0].zones.hand.push(spell);addMana(g.players[0],{U:1,R:1,C:1});assert.throws(()=>castSpell(g,spell.instance,{targets:['player:1'],division:{'player:1':1}}),/Divide/);castSpell(g,spell.instance,{targets:['player:1','player:2'],division:{'player:1':1,'player:2':1}});resolveTop(g);assert.deepEqual(g.players.map(p=>p.life),[40,39,39]);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.pendingEffect,undefined);
});
test('Izzet Charm supports all three modes, including an optional tax owned by the countered spell controller',()=>{
 const g=game();const original=cast(g,'Opt',{},1);g.priority={seat:0,passes:0};cast(g,'Izzet Charm',{mode:0,targets:['card:'+original.instance]});resolveTop(g);assert.equal(g.pendingEffect.owner,1);resolveOracleChoice(g,['no']);assert.ok(g.players[1].zones.graveyard.includes(original));const creature=enter(g,'Young Pyromancer',1);cast(g,'Izzet Charm',{mode:1,targets:['card:'+creature.instance]});resolveTop(g);assert.ok(g.players[1].zones.graveyard.includes(creature));library(g,0);cast(g,'Izzet Charm',{mode:2});resolveTop(g);assert.equal(g.pendingEffect.step.op,'discard');resolveOracleChoice(g,g.players[0].zones.hand.slice(0,2).map(c=>c.instance));assert.equal(g.pendingEffect,undefined);
});
for(const seats of [2,3,4])test('Wheel of Misfortune keeps numbers secret until all '+seats+' players submit and applies ties correctly',()=>{
 const g=game(seats);for(let owner=0;owner<seats;owner++){library(g,owner);g.players[owner].zones.hand=[card('Island')];}cast(g,'Wheel of Misfortune');resolveTop(g);assert.equal(g.pendingEffect.step.op,'secretNumber');const values=Array.from({length:seats},(_,i)=>i===0?0:5);for(let owner=0;owner<seats;owner++){assert.equal(g.pendingEffect.owner,owner);if(owner){assert.equal(projectGame(g,owner).pendingEffect.step.values,undefined);assert.equal(projectGame(g,owner).pendingEffect.step.submitted.length,owner);}validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[String(values[owner])]);}assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].life,40);assert.equal(g.players[0].zones.hand.length,1);for(let owner=1;owner<seats;owner++){assert.equal(g.players[owner].life,35);assert.equal(g.players[owner].zones.hand.length,7);}assert.match(g.playEvents.at(-1).text,/Player 1 chose 0/);
});
test('Wheel of Misfortune equal numbers damage everyone and wheel nobody; invalid submissions leave the choice untouched',()=>{
 const g=game(3);for(let owner=0;owner<3;owner++){library(g,owner);g.players[owner].zones.hand=[card('Island')];}cast(g,'Wheel of Misfortune');resolveTop(g);const before=JSON.stringify(g);for(const keys of [[],['-1'],['2.5'],['Infinity'],['1000000']])assert.throws(()=>resolveOracleChoice(g,keys),/whole number/);assert.equal(JSON.stringify(g),before);for(let i=0;i<3;i++)resolveOracleChoice(g,['4']);assert.deepEqual(g.players.map(p=>p.life),[36,36,36]);assert.deepEqual(g.players.map(p=>p.zones.hand.length),[1,1,1]);
});
test('Reforge the Soul discards all hands before drawing seven for each player and preserves draw-trigger priority',()=>{
 const g=game(3);enter(g,'Niv-Mizzet, Parun');for(let owner=0;owner<3;owner++){library(g,owner);g.players[owner].zones.hand=[card('Island')];}cast(g,'Reforge the Soul');resolveTop(g);damageTarget(g);resolveTop(g);resolveTop(g);assert.deepEqual(g.players.map(p=>p.zones.hand.length),[7,7,7]);assert.equal(g.stack.length,7);assert.ok(g.players[0].zones.graveyard.some(c=>c.name==='Reforge the Soul'));
});

test('miracle asks as the first card is drawn, keeps its identity private until revealed, then finishes the original draw',()=>{
 const g=game(3),miracle=card('Reforge the Soul'),later=card('Island');g.players[0].zones.library=[miracle,later,card('Mountain')];draw(g,0,2,{turnAction:false});assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.pendingEffect.step.op,'miracleReveal');for(const owner of [1,2]){const view=projectGame(g,owner);assert.ok(!JSON.stringify(view).includes('Reforge the Soul'));assert.equal(view.pendingEffect.kind,'remote-choice');}validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,['yes']);assert.equal(g.players[0].zones.hand.length,2);assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,1);assert.equal(g.stack[0].combatTrigger.event.kind,'miracle');assert.ok(projectGame(g,1).playEvents.some(e=>e.kind==='reveal'&&e.card.name==='Reforge the Soul'));assert.equal(g.drawHistory.counts[0],2);
});
test('declining miracle reveals nothing and does not create a trigger or cheap casting permission',()=>{
 const g=game(),miracle=card('Reforge the Soul');g.players[0].zones.library=[miracle,card('Island')];draw(g,0,2,{turnAction:false});resolveOracleChoice(g,['no']);assert.equal(g.players[0].zones.hand.length,2);assert.equal(g.stack.length,0);assert.ok(!JSON.stringify(projectGame(g,1)).includes('Reforge the Soul'));g.players[0].mana=[];addMana(g.players[0],{R:1,C:1});assert.throws(()=>castSpell(g,miracle.instance),/pay/);
});
test('miracle is a respondable trigger, pays the alternative cost, and casts during an opponent turn without resolving immediately',()=>{
 const g=game(),miracle=card('Reforge the Soul');endTurn(g);g.step=3;g.players[0].zones.library=[miracle,...Array.from({length:10},()=>card('Island'))];library(g,1);draw(g,0,1,{turnAction:false});resolveOracleChoice(g,['yes']);resolveTop(g);assert.equal(g.pendingEffect.step.op,'castOffered');assert.equal(g.pendingEffect.step.cost,'{1}{R}');addMana(g.players[0],{C:1,R:1});castSpell(g,miracle.instance);assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,1);assert.equal(g.players[0].mana.length,0);assert.equal(g.stack[0].castFrom,'hand');validateSession(JSON.parse(JSON.stringify(g)));resolveTop(g);assert.equal(g.players[0].zones.hand.length,7);assert.equal(g.players[1].zones.hand.length,7);
});
test('countering or declining the miracle trigger leaves the card in hand and it cannot be cast later for that cost',()=>{
 for(const decline of [false,true]){const g=game(),miracle=card('Reforge the Soul');g.players[0].zones.library=[miracle];draw(g,0,1,{turnAction:false});resolveOracleChoice(g,['yes']);if(decline){resolveTop(g);resolveOracleChoice(g,[]);}else counterTop(g);assert.ok(g.players[0].zones.hand.includes(miracle));assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,0);addMana(g.players[0],{R:1,C:1});assert.throws(()=>castSpell(g,miracle.instance),/pay/);}
});
test('miracle triggers wait until the entire resolving spell has finished, including its discard instruction',()=>{
 const g=game(),miracle=card('Reforge the Soul');g.players[0].zones.library=[miracle,card('Island')];cast(g,'Faithless Looting');resolveTop(g);assert.equal(g.pendingEffect.step.op,'miracleReveal');resolveOracleChoice(g,['yes']);assert.equal(g.stack.filter(e=>e.kind==='ability').length,0);assert.equal(g.pendingEffect.step.op,'discard');resolveOracleChoice(g,[miracle.instance,g.players[0].zones.hand.find(c=>c!==miracle).instance]);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.ok(g.players[0].zones.graveyard.includes(miracle));
});
test('draw replacements resume their partially applied event without applying the same replacement twice',()=>{
 const g=game(),miracle=card('Reforge the Soul');enter(g,'Thought Reflection');enter(g,"Teferi's Ageless Insight");g.players[0].zones.library=[miracle,...Array.from({length:10},()=>card('Island'))];changeStep(g,2);draw(g,0,1);assert.equal(g.pendingEffect.step.op,'miracleReveal');validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,['no']);assert.equal(g.players[0].zones.hand.length,3);assert.equal(g.drawHistory.counts[0],3);assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,0);
});
test('opening hands do not trigger miracle, draw replacements or first-draw turn tracking',()=>{
 const g=game(),miracle=card('Reforge the Soul');enter(g,'Thought Reflection');g.players[0].zones.library=[miracle,...Array.from({length:10},()=>card('Island'))];draw(g,0,7,{opening:true});assert.equal(g.pendingEffect,undefined);assert.equal(g.drawHistory,undefined);assert.equal(g.players[0].zones.hand.length,7);assert.equal(g.stack.length,0);
});

test('a failed draw loses the player after resolution and reset restores their retained cards without a miracle opening-hand prompt',()=>{
 const g=game(3),spell=cast(g,'Blue Sun\'s Zenith',{x:2,targets:['player:1']});g.players[1].zones.library=[card('Reforge the Soul')];resolveTop(g);assert.equal(g.pendingEffect.step.op,'miracleReveal');resolveOracleChoice(g,['no']);assert.equal(g.players[1].eliminated.reason,'Drew from an empty library');assert.ok(!g.result);assert.ok(g.departedCards.some(e=>e.card.name==='Reforge the Soul'));const fresh=resetGame(g);assert.equal(fresh.players[1].eliminated,undefined);assert.equal(fresh.players[1].failedDraw,undefined);assert.equal(fresh.pendingEffect,undefined);assert.equal(fresh.drawHistory,undefined);assert.equal(fresh.players[1].zones.hand[0].name,'Reforge the Soul');validateSession(fresh);
});

test('failed draw is checked after all spell instructions, rather than immediately when a library becomes empty',()=>{
 const g=game(3);g.players[1].zones.library=[];assert.ok(applyOracleEffect(g,{owner:0,name:'Ordered draw',source:{instance:'ordered',name:'Ordered draw'},text:'Target player draws two cards, then discards two cards.',targets:[{key:'player:1',kind:'player',owner:1}]}));assert.equal(g.pendingEffect.step.op,'discard');assert.equal(g.players[1].eliminated,undefined);resolveOracleChoice(g,[]);assert.equal(g.players[1].eliminated.reason,'Drew from an empty library');
});

test('Locust God activated loot pays its printed cost, uses the stack and defers its draw-created token until after discarding',()=>{
 const g=game(),god=enter(g,'The Locust God');library(g,0);addMana(g.players[0],{C:2,U:1,R:1});activateMana(g,god.instance,activatedAbilities(g,0,god)[0].id);assert.equal(g.players[0].zones.hand.length,0);resolveTop(g);assert.equal(g.pendingEffect.step.op,'discard');assert.equal(g.stack.length,0);resolveOracleChoice(g,[g.players[0].zones.hand[0].instance]);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token&&c.name==='Insect').length,1);
});

test('a later miracle card does not offer miracle after another card was already drawn this turn',()=>{
 const g=game(),miracle=card('Reforge the Soul');g.players[0].zones.library=[card('Island'),miracle];draw(g,0,2,{turnAction:false});assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].zones.hand.length,2);assert.equal(g.drawHistory.counts[0],2);assert.equal(g.stack.length,0);
});

test('Niv-Mizzet shared utility evidence requires identical Oracle text and every earlier paragraph checked',()=>{
 const base=new URL('./fixtures/commander/',import.meta.url),progress=JSON.parse(readFileSync(new URL('checklist-progress.json',base))),ids=['goreclaw_terror_of_qal_sisma','aurelia_the_warleader','arahbo_roar_of_the_world','isshin_two_heavens_as_one','fynn_the_fangbearer','talrand_sky_summoner','mizzix_of_the_izmagnus','kalamax_the_stormsire'];let reused=0;const prior=ids.map(id=>({id,cards:JSON.parse(readFileSync(new URL('oracle/'+id+'.json',base))).cards}));for(const c of records){const source=prior.find(p=>p.cards.some(old=>old.name===c.name&&old.oracle_text===c.oracle_text));if(!source)continue;for(let i=0;i<(c.card_faces||[c]).flatMap(f=>(f.oracle_text||'').split('\n').filter(Boolean)).length;i++)assert.ok(progress[source.id].verified_paragraphs[c.name]?.includes(i),c.name+' '+i);reused++;}assert.ok(reused>=65);
});

test('a prevented empty-library loss does not linger after that state-based check when its protection later leaves',()=>{
 const g=game(3),protection={instance:'protection',name:'Loss protection',type_line:'Artifact',oracle_text:"You can't lose the game.",counters:{}};g.players[0].zones.hand.push(protection);transfer(g,protection.instance,'battlefield',0);draw(g,0,1,{turnAction:false});stateBasedActions(g);assert.equal(g.players[0].eliminated,undefined);assert.equal(g.players[0].failedDraw,undefined);transfer(g,protection.instance,'graveyard',0);stateBasedActions(g);assert.equal(g.players[0].eliminated,undefined);draw(g,0,1,{turnAction:false});stateBasedActions(g);assert.equal(g.players[0].eliminated.reason,'Drew from an empty library');
});
