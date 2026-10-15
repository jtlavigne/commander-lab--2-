import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,changeStep,untap,validateSession} from '../engine.mjs';
import {activateMana,resolveTop} from '../casting.mjs';
import {activatedAbilities,addMana} from '../mana.mjs';
import {combatStats,keywordSet,blockError} from '../creature-rules.mjs';
import {setAttacker,confirmAttackers,setBlocker,confirmBlockers,dealDamagePackets,stateBasedActions} from '../combat.mjs';
import {queueCombatTriggers,chooseTriggerTarget,triggerTargetOptions} from '../combat-effects.mjs';
import {resolveOracleChoice} from '../oracle-effects.mjs';
import {attachPermanent} from '../attachments.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {autoPassEmptySteps} from '../phase-flow.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/arahbo_roar_of_the_world.json',import.meta.url))).cards;
const card=name=>{const c=records.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{}};};
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';return g;};
function enter(g,c,owner=0){if(typeof c==='string')c=card(c);g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);c.summoningSick=false;return c;}
const cat=(g,owner=0)=>enter(g,{instance:crypto.randomUUID(),name:'Test Cat',type_line:'Creature — Cat',power:'2',toughness:'3',counters:{}},owner);
function attack(g,c,defender=1){changeStep(g,5);setAttacker(g,c.instance,'player:'+defender);confirmAttackers(g);}
for(const [name,keyword] of [['Brimaz, King of Oreskos','vigilance'],['Mirri, Weatherlight Duelist','first strike'],['Jazal Goldmane','first strike'],['Kaheera, the Orphanguard','vigilance'],['Qasali Slingers','reach']])test(name+' preserves its printed combat keyword',()=>{const g=game(),c=enter(g,name);assert.ok(keywordSet(g,0,c).has(keyword));});
test('Regal Caracal enters with two Cat tokens; its static boost and lifelink apply to other Cats only',()=>{
 const g=game(),lord=enter(g,'Regal Caracal');assert.equal(g.players[0].zones.battlefield.length,1);resolveTop(g);const tokens=g.players[0].zones.battlefield.filter(c=>c.token);assert.equal(tokens.length,2);for(const c of tokens){assert.equal(combatStats(g,0,c).power,2);assert.ok(keywordSet(g,0,c).has('lifelink'));assert.equal(c.summoningSick,true);}assert.equal(combatStats(g,0,lord).power,3);
});
test('Exalted triggers for one declared attacker, resolves independently of its provider, and expires at cleanup',()=>{
 const g=game(),a=enter(g,'Qasali Pridemage'),b=enter(g,'Qasali Pridemage'),attacker=cat(g);attack(g,attacker);assert.equal(g.stack.length,2);transfer(g,a.instance,'exile',0);resolveTop(g);resolveTop(g);assert.equal(combatStats(g,0,attacker).power,4);g.combat.attackers=[];changeStep(g,11);assert.equal(combatStats(g,0,attacker).power,2);
 const h=game(),x=enter(h,'Qasali Pridemage'),y=cat(h);changeStep(h,5);setAttacker(h,x.instance,'player:1');setAttacker(h,y.instance,'player:1');confirmAttackers(h);assert.equal(h.stack.length,0);
});
test('Brimaz attack creates an untapped vigilant token already attacking, without declaring another attack',()=>{
 const g=game(),brimaz=enter(g,'Brimaz, King of Oreskos');attack(g,brimaz);assert.equal(brimaz.tapped,false);resolveTop(g);assert.equal(g.pendingEffect?.step.op,'tokenDefenders');resolveOracleChoice(g,['player:1']);const token=g.players[0].zones.battlefield.find(c=>c.token);assert.ok(token);assert.equal(token.tapped,false);assert.ok(keywordSet(g,0,token).has('vigilance'));assert.equal(g.combat.attackers.find(a=>a.id===token.instance).enteredAttacking,true);assert.equal(g.stack.length,0);
});
test('Brimaz blocking creates a token blocking the same attacker and no new declared-block trigger',()=>{
 const g=game(),attacker=cat(g),brimaz=enter(g,'Brimaz, King of Oreskos',1);attack(g,attacker);changeStep(g,6);setBlocker(g,1,brimaz.instance,attacker.instance);confirmBlockers(g,1);assert.equal(g.stack.length,1);resolveTop(g);const token=g.players[1].zones.battlefield.find(c=>c.token);assert.ok(token);assert.equal(token.tapped,false);assert.equal(g.combat.blocks.find(b=>b.blocker===token.instance).attacker,attacker.instance);assert.equal(g.combat.blocks.find(b=>b.blocker===token.instance).enteredBlocking,true);assert.equal(g.stack.length,0);assert.equal(g.pendingEffect,undefined);validateSession(JSON.parse(JSON.stringify(g)));
});
test('Leonin Warleader creates two tapped lifelink Cats and chooses a defender for each',()=>{
 const g=game(3),leader=enter(g,'Leonin Warleader');attack(g,leader);resolveTop(g);assert.equal(g.pendingEffect?.step.tokens.length,2);resolveOracleChoice(g,['player:1']);resolveOracleChoice(g,['player:2']);const tokens=g.players[0].zones.battlefield.filter(c=>c.token);assert.equal(tokens.length,2);for(const c of tokens){assert.ok(c.tapped);assert.ok(keywordSet(g,0,c).has('lifelink'));}assert.deepEqual(g.combat.attackers.filter(a=>a.enteredAttacking).map(a=>a.defender.owner),[1,2]);
});
test('Jedit uses its abbreviated Oracle name and creates a normal Forestwalk Cat on attacking or blocking',()=>{
 const g=game(),jedit=enter(g,'Jedit Ojanen of Efrava');attack(g,jedit);assert.equal(g.stack.length,1);resolveTop(g);const token=g.players[0].zones.battlefield.find(c=>c.token);assert.ok(token);assert.equal(g.combat.attackers.length,1);assert.match(token.oracle_text,/forestwalk/i);const forest=enter(g,'Forest',1),blocker=cat(g,1);assert.match(blockError(g,1,blocker,jedit,1),/Landwalk/);
});
test('Kemba Regent counts Equipment still attached at trigger resolution, including zero after detaching',()=>{
 const g=game(),kemba=enter(g,'Kemba, Kha Regent'),a=enter(g,'Swiftfoot Boots'),b=enter(g,'Sword of the Animist');attachPermanent(g,a.instance,kemba.instance);attachPermanent(g,b.instance,kemba.instance);queueCombatTriggers(g,[{kind:'upkeep',owner:0}]);transfer(g,a.instance,'graveyard',0);resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,1);assert.equal(g.pendingEffect,undefined);
 queueCombatTriggers(g,[{kind:'upkeep',owner:0}]);transfer(g,b.instance,'hand',0);resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,1);
});
test('Pride Sovereign pays mana, tap and exert costs atomically and skips exactly its next untap',()=>{
 const g=game(),pride=enter(g,'Pride Sovereign');addMana(g.players[0],{W:1});const ability=activatedAbilities(g,0,pride).find(a=>a.id==='action:1');assert.equal(ability.manualCost,false);activateMana(g,pride.instance,ability.id);assert.ok(pride.tapped);assert.equal(pride.skipNextUntap,true);resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,2);untap(g,0);assert.ok(pride.tapped);assert.equal(pride.skipNextUntap,undefined);untap(g,0);assert.equal(pride.tapped,false);
});
test('Mirri’s attack trigger limits distinct blocking creatures separately for each opponent',()=>{
 const g=game(3),mirri=enter(g,'Mirri, Weatherlight Duelist'),second=cat(g),third=cat(g),b1=cat(g,1),b2=cat(g,1),b3=cat(g,2);changeStep(g,5);setAttacker(g,mirri.instance,'player:1');setAttacker(g,second.instance,'player:1');setAttacker(g,third.instance,'player:2');confirmAttackers(g);assert.equal(g.stack.length,1);resolveTop(g);changeStep(g,6);setBlocker(g,1,b1.instance,mirri.instance);assert.throws(()=>setBlocker(g,1,b2.instance,second.instance),/Only 1/);setBlocker(g,2,b3.instance,third.instance);validateSession(JSON.parse(JSON.stringify(g)));
});
test('tapped Mirri limits creatures attacking its controller; other opponents and planeswalkers remain eligible',()=>{
 const g=game(3),mirri=enter(g,'Mirri, Weatherlight Duelist',1),a=cat(g),b=cat(g);mirri.tapped=true;changeStep(g,5);setAttacker(g,a.instance,'player:1');assert.throws(()=>setAttacker(g,b.instance,'player:1'),/Only 1/);setAttacker(g,b.instance,'player:2');mirri.tapped=false;setAttacker(g,b.instance,'player:1');assert.equal(g.combat.attackers.length,2);
});
test('Jazal uses the number of creatures still attacking on resolution, rather than activation time',()=>{
 const g=game(),jazal=enter(g,'Jazal Goldmane'),a=cat(g);changeStep(g,5);setAttacker(g,jazal.instance,'player:1');setAttacker(g,a.instance,'player:1');confirmAttackers(g);addMana(g.players[0],{W:2,C:3});activateMana(g,jazal.instance,'action:1');transfer(g,a.instance,'hand',0);resolveTop(g);assert.equal(combatStats(g,0,jazal).power,5);assert.equal(g.pendingEffect,undefined);
});
test('Feline Sovereign groups combat damage per damaged player and restricts destruction to that player’s permanents',()=>{
 const g=game(3),lord=enter(g,'Feline Sovereign'),a=cat(g),b=cat(g),r1=enter(g,'Sol Ring',1),r2=enter(g,'Sol Ring',2);const events=dealDamagePackets(g,[{source:{owner:0,card:a},target:{kind:'player',owner:1},amount:1,combat:true},{source:{owner:0,card:b},target:{kind:'player',owner:1},amount:1,combat:true},{source:{owner:0,card:a},target:{kind:'player',owner:2},amount:1,combat:true}],true);stateBasedActions(g,{damageEvents:events});assert.equal(g.stack.length,2);for(const e of [...g.stack]){const expected=e.combatTrigger.event.target.owner;assert.deepEqual(triggerTargetOptions(g,e).map(t=>t.owner),[expected]);chooseTriggerTarget(g,e.id,'card:'+(expected===1?r1.instance:r2.instance));}resolveTop(g);resolveTop(g);assert.ok(g.players[1].zones.graveyard.includes(r1));assert.ok(g.players[2].zones.graveyard.includes(r2));
});
test('Felidar’s intervening life condition is checked at upkeep and resolution, with responses before winning',()=>{
 const g=game(),felidar=enter(g,'Felidar Sovereign');assert.ok(keywordSet(g,0,felidar).has('vigilance'));assert.ok(keywordSet(g,0,felidar).has('lifelink'));g.players[0].life=39;queueCombatTriggers(g,[{kind:'upkeep',owner:0}]);assert.equal(g.stack.length,0);g.players[0].life=40;queueCombatTriggers(g,[{kind:'upkeep',owner:0}]);assert.equal(g.result,undefined);g.players[0].life=39;resolveTop(g);assert.equal(g.result,undefined);g.players[0].life=40;queueCombatTriggers(g,[{kind:'upkeep',owner:0}]);resolveTop(g);assert.deepEqual(g.result.winners,[0]);const before=g.step;autoPassEmptySteps(g,{automatic:true});assert.equal(g.step,before);validateSession(JSON.parse(JSON.stringify(g)));assert.throws(()=>reduceGameAction(g,{type:'advance'},0),/ended/);assert.equal(reduceGameAction(g,{type:'reset'},0).game.result,undefined);
});
test('a winning trigger survives its source leaving, while a live cannot-win permission stops the win',()=>{
 const g=game(),felidar=enter(g,'Felidar Sovereign');queueCombatTriggers(g,[{kind:'upkeep',owner:0}]);transfer(g,felidar.instance,'exile',0);const blocker=enter(g,{instance:'cannot-win',name:'Cannot win provider',type_line:'Artifact',oracle_text:"You can't lose the game and your opponents can't win the game.",counters:{}},1);resolveTop(g);assert.equal(g.result,undefined);transfer(g,blocker.instance,'exile',1);g.players[0].zones.hand.push(felidar);g.players[0].zones.exile=[];transfer(g,felidar.instance,'battlefield',0);queueCombatTriggers(g,[{kind:'upkeep',owner:0}]);transfer(g,felidar.instance,'hand',0);resolveTop(g);assert.deepEqual(g.result.winners,[0]);
});
test('Qasali Slingers triggers on its own or another controlled Cat’s entry, offers optional destruction and ignores opposing Cats',()=>{
 const g=game(),ring=enter(g,'Sol Ring',1),slingers=enter(g,'Qasali Slingers');assert.ok(keywordSet(g,0,slingers).has('reach'));chooseTriggerTarget(g,g.stack[0].id,'card:'+ring.instance);resolveTop(g);resolveOracleChoice(g,['no']);assert.ok(g.players[1].zones.battlefield.includes(ring));cat(g,1);assert.equal(g.stack.length,0);cat(g);chooseTriggerTarget(g,g.stack[0].id,'card:'+ring.instance);resolveTop(g);resolveOracleChoice(g,['yes']);assert.ok(g.players[1].zones.graveyard.includes(ring));
});
test('Qasali Pridemage sacrifices itself and pays one mana before its targeted removal resolves',()=>{
 const g=game(),source=enter(g,'Qasali Pridemage'),ring=enter(g,'Sol Ring',1);addMana(g.players[0],{C:1});activateMana(g,source.instance,'action:1');assert.ok(g.players[0].zones.graveyard.includes(source));assert.ok(g.players[1].zones.battlefield.includes(ring));chooseTriggerTarget(g,g.stack[0].id,'card:'+ring.instance);resolveTop(g);assert.ok(g.players[1].zones.graveyard.includes(ring));
});
test('Jedit also creates its token when declared blocking, and landwalk checks the defending player’s live land types',()=>{
 const g=game(),attacker=cat(g),jedit=enter(g,'Jedit Ojanen of Efrava',1);attack(g,attacker);changeStep(g,6);setBlocker(g,1,jedit.instance,attacker.instance);confirmBlockers(g,1);resolveTop(g);assert.equal(g.players[1].zones.battlefield.filter(c=>c.token).length,1);assert.equal(g.combat.blocks.length,1);
});
test('a Brimaz permitted to block two creatures creates one blocking token for each creature it blocks',()=>{
 const g=game(),a=cat(g),b=cat(g),brimaz=enter(g,'Brimaz, King of Oreskos',1);brimaz.oracle_text+='\nThis creature can block an additional creature each combat.';changeStep(g,5);setAttacker(g,a.instance,'player:1');setAttacker(g,b.instance,'player:1');confirmAttackers(g);changeStep(g,6);setBlocker(g,1,brimaz.instance,a.instance);setBlocker(g,1,brimaz.instance,b.instance);confirmBlockers(g,1);assert.equal(g.stack.length,2);resolveTop(g);resolveTop(g);assert.equal(g.players[1].zones.battlefield.filter(c=>c.token).length,2);assert.equal(g.combat.blocks.filter(b=>b.enteredBlocking).length,2);
});
