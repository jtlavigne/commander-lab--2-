import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession} from '../engine.mjs';
import {activateLoyaltyAction,resolveTop,castSpell,counterTop,passPriority,resolveProliferate} from '../casting.mjs';
import {queueCombatTriggers,chooseTriggerTarget} from '../combat-effects.mjs';
import {applyOracleEffect,oracleChoiceOptions,resolveOracleChoice,counterChoiceOptions,resolveCounterChoice} from '../oracle-effects.mjs';
import {effectTargetOptions} from '../effect-targets.mjs';
import {addMana} from '../mana.mjs';
import {canSearchLibrary} from '../resource-rules.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards.concat(JSON.parse(readFileSync(new URL('./fixtures/playtest-decks/atraxa.json',import.meta.url))).cards);
const card=(name,extra={})=>({instance:crypto.randomUUID(),name,type_line:'Artifact',mana_cost:'{2}',oracle_text:'',counters:{},...extra});
const real=name=>{const found=records.find(c=>c.name===name);assert.ok(found,name);return card(name,structuredClone(found));};
function game(count=2){const g=newGame(count);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
function effect(g,owner,text,targets=[]){assert.equal(applyOracleEffect(g,{owner,name:'Test effect',source:card('Test effect'),text,targets}),true);}
function gauntletTrigger(g,target){const spell=card('Spell',{type_line:'Instant',oracle_text:'You gain 1 life.'});g.players[0].zones.hand.push(spell);addMana(g.players[0],{C:2});castSpell(g,spell.instance);const entry=g.stack.at(-1);assert.equal(entry.kind,'ability');assert.ok(effectTargetOptions(g,entry).some(o=>o.id===target.instance));chooseTriggerTarget(g,entry.id,['card:'+target.instance]);return entry;}

test('Gauntlet chooses the current counter kind on resolution, independently of the source and announced spell',()=>{
 let g=game();const source=enter(g,real('Ichormoon Gauntlet')),target=enter(g,card('Counter artifact'),1);target.counters={charge:2,oil:1};gauntletTrigger(g,target);
 assert.equal(g.pendingEffect,undefined);target.counters={charge:2,stun:3};transfer(g,source.instance,'graveyard',0);resolveTop(g);
 assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),['charge','stun']);assert.equal(g.pendingEffect.owner,0);assert.equal(g.stack.length,1);assert.throws(()=>passPriority(g,0),/pending/);assert.throws(()=>resolveOracleChoice(g,['oil']));assert.throws(()=>resolveOracleChoice(g,[]));
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,['stun']);assert.deepEqual(g.players[1].zones.battlefield[0].counters,{charge:2,stun:4});assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].life,41);
});

test('Gauntlet accepts counterless targets, ignores zero counters and invalidated targets, and can be countered',()=>{
 for(const mode of ['empty','removedCounters','blink','countered']){const g=game();enter(g,real('Ichormoon Gauntlet'));const target=enter(g,card('Target'));if(mode!=='empty')target.counters={charge:1};gauntletTrigger(g,target);
 if(mode==='removedCounters')target.counters={charge:0};if(mode==='blink'){transfer(g,target.instance,'exile',0);transfer(g,target.instance,'battlefield',0);}if(mode==='countered')counterTop(g);else resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(target.counters.charge||0,mode==='countered'?1:0);}
});

test('Gauntlet uses counter replacement order and does not trigger on creature spells',()=>{
 let g=game();enter(g,real('Ichormoon Gauntlet'));const target=enter(g,card('Creature',{type_line:'Creature',power:'2',toughness:'2'}));target.counters={'+1/+1':1};enter(g,real('Vorinclex, Monstrous Raider'));enter(g,real("Lae'zel, Vlaakith's Champion"));gauntletTrigger(g,target);resolveTop(g);resolveOracleChoice(g,['+1/+1']);assert.equal(g.pendingEffect.kind,'counter-choice');g=validateSession(JSON.parse(JSON.stringify(g)));resolveCounterChoice(g,counterChoiceOptions(g).find(o=>o.operation==='add').key);assert.equal(g.players[0].zones.battlefield.find(c=>c.instance===target.instance).counters['+1/+1'],5);
 const creature=card('Cast creature',{type_line:'Creature',power:'2',toughness:'2'});g.stack=[];delete g.priority;g.players[0].zones.hand.push(creature);addMana(g.players[0],{C:2});castSpell(g,creature.instance);assert.equal(g.stack.length,1);
});

test('Ashiok mills the targeted player then exiles all opponents graves atomically, including a short library',()=>{
 for(const target of [0,1]){const g=game(3),a=enter(g,real('Ashiok, Dream Render'));for(const [seat,p] of g.players.entries()){p.zones.library=Array.from({length:seat===target?2:5},(_,i)=>card('Library '+seat+' '+i));p.zones.graveyard=[card('Old grave '+seat)];}
 activateLoyaltyAction(g,a.instance,0);chooseTriggerTarget(g,g.stack.at(-1).id,['player:'+target]);assert.equal(g.players[target].zones.library.length,2);resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(g.players[target].zones.library.length,0);assert.equal(g.players[target].failedDraw,undefined);assert.equal(g.players[0].zones.graveyard.length,target===0?3:1);for(const seat of [1,2]){assert.equal(g.players[seat].zones.graveyard.length,0);assert.equal(g.players[seat].zones.exile.length,seat===target?3:1);}assert.equal(g.drawHistory,undefined);validateSession(JSON.parse(JSON.stringify(g)));}
});

test('countering Ashiok prevents both instructions, and milling observes graveyard exile replacements',()=>{
 const g=game(),a=enter(g,real('Ashiok, Dream Render'));g.players[1].zones.library=[card('Library')];g.players[1].zones.graveyard=[card('Grave')];activateLoyaltyAction(g,a.instance,0);chooseTriggerTarget(g,g.stack.at(-1).id,['player:1']);counterTop(g);assert.equal(g.players[1].zones.library.length,1);assert.equal(g.players[1].zones.graveyard.length,1);
 enter(g,card('Replacement',{type_line:'Enchantment',oracle_text:'If a card or token would be put into a graveyard from anywhere, exile it instead.'}));effect(g,0,'Target player mills four cards.',[{kind:'player',owner:1}]);assert.equal(g.players[1].zones.exile[0].name,'Library');assert.equal(g.players[1].zones.graveyard[0].name,'Grave');
});

test('Ashiok blocks the effect controller searching but not other players, looking, or manual library inspection',()=>{
 const g=game(3),a=enter(g,real('Ashiok, Dream Render'));assert.equal(canSearchLibrary(g,1,1),false);assert.equal(canSearchLibrary(g,0,0),true);assert.equal(canSearchLibrary(g,1,0),true);assert.equal(canSearchLibrary(g,1,2),true);
 g.players[1].zones.library=[real('Forest'),card('Hidden')];effect(g,1,'Search your library for a basic land card, put it onto the battlefield, then shuffle.');assert.equal(g.pendingEffect,undefined);assert.equal(g.players[1].zones.battlefield.length,0);assert.ok(g.log.some(line=>line.includes('search prohibited; library shuffled')));assert.ok(projectGame(g,1).players[1].zones.library.every(c=>c.hidden));
 effect(g,1,'Look at the top card of your library. You may reveal that card and put it into your hand. If you do, you lose life equal to its mana value.');assert.equal(g.pendingEffect.step.op,'selectLook');resolveOracleChoice(g,[]);
 a.faceDown=true;assert.equal(canSearchLibrary(g,1,1),true);a.faceDown=false;transfer(g,a.instance,'graveyard',0);assert.equal(canSearchLibrary(g,1,1),true);
});

test('blocked optional searches cannot be accepted and preserve library order without shuffling',()=>{
 for(const text of ['You may search your library for a basic land card, put it onto the battlefield, then shuffle.','You may search your library for a card named Forest, reveal it, put it into your hand, then shuffle.']){let g=game();enter(g,real('Ashiok, Dream Render'));g.players[1].zones.library=[real('Forest'),card('Second'),card('Third')];const before=g.players[1].zones.library.map(c=>c.instance);effect(g,1,text);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),['no']);assert.throws(()=>resolveOracleChoice(g,['yes']));g=validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,['no']);assert.deepEqual(g.players[1].zones.library.map(c=>c.instance),before);assert.ok(!g.log.some(line=>line.includes('shuffled')));}
});

test('Path to Exile permits the opponent search when controlled by Ashiok controller, but not self-search by an opponent',()=>{
 for(const controller of [0,1]){const g=game();enter(g,real('Ashiok, Dream Render'));const target=enter(g,card('Creature',{type_line:'Creature',power:'2',toughness:'2'}),1);g.players[1].zones.library=[real('Forest')];effect(g,controller,real('Path to Exile').oracle_text,[{kind:'card',id:target.instance,owner:1,battlefieldId:target.battlefieldId}]);assert.equal(g.players[1].zones.exile[0].instance,target.instance);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),controller===0?['yes','no']:['no']);if(controller===0){resolveOracleChoice(g,['yes']);resolveOracleChoice(g,[g.players[1].zones.library[0].instance]);assert.equal(g.players[1].zones.battlefield[0].tapped,true);}else resolveOracleChoice(g,['no']);}
});

test('Sword damage trigger chooses a creature without targeting then proliferates after that counter',()=>{
 let g=game();const sword=enter(g,real('Sword of Truth and Justice')),bear=enter(g,card('Bearer',{type_line:'Creature',power:'2',toughness:'2'}));sword.attachedTo=bear.instance;sword.attachedBattlefieldId=bear.battlefieldId;
 queueCombatTriggers(g,[{kind:'damage',owner:0,card:bear,target:{kind:'player',owner:1},amount:2,combat:true}]);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect.step.op,'chooseCounters');g=validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[bear.instance]);assert.equal(g.pendingEffect.kind,'proliferate');assert.equal(g.players[0].zones.battlefield.find(c=>c.instance===bear.instance).counters['+1/+1'],1);resolveProliferate(g,[bear.instance]);assert.equal(g.players[0].zones.battlefield.find(c=>c.instance===bear.instance).counters['+1/+1'],2);assert.equal(g.pendingEffect,undefined);
});

test('Sword still proliferates if no friendly creature remains when its trigger resolves',()=>{
 const g=game(),sword=enter(g,real('Sword of Truth and Justice')),bear=enter(g,card('Bearer',{type_line:'Creature',power:'2',toughness:'2'}));sword.attachedTo=bear.instance;sword.counters={charge:1};queueCombatTriggers(g,[{kind:'damage',owner:0,card:bear,target:{kind:'player',owner:1},amount:2,combat:true}]);transfer(g,bear.instance,'graveyard',0);resolveTop(g);assert.equal(g.pendingEffect.kind,'proliferate');resolveProliferate(g,[sword.instance]);assert.equal(sword.counters.charge,2);
});

test('multi-player searches retain the original effect controller when a different seat chooses first',()=>{
 const g=game(3);enter(g,real('Ashiok, Dream Render'));const land=enter(g,card('Nonbasic',{type_line:'Land'}),0);for(const p of g.players)p.zones.library=[real('Forest')];
 effect(g,1,'Destroy target nonbasic land an opponent controls. Each player searches their library for a basic land card, puts it onto the battlefield, then shuffles.',[{kind:'card',id:land.instance,owner:0,battlefieldId:land.battlefieldId}]);
 assert.equal(g.pendingEffect.owner,0);resolveOracleChoice(g,[g.players[0].zones.library[0].instance]);assert.equal(g.pendingEffect.owner,2);resolveOracleChoice(g,[g.players[2].zones.library[0].instance]);assert.equal(g.pendingEffect,undefined);assert.equal(g.players[1].zones.library.length,1);assert.ok(g.players[0].zones.battlefield.some(c=>c.name==='Forest'));assert.equal(g.players[2].zones.battlefield[0].name,'Forest');
});
