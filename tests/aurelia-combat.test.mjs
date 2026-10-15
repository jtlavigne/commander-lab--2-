import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,changeStep,advance,untap,validateSession,endTurn} from '../engine.mjs';
import {setAttacker,confirmAttackers,confirmBlockers,applyCombatDamage,dealDamagePackets} from '../combat.mjs';
import {resolveTop,counterTop,activateMana,castSpell,castingTiming,canRespond,playLand,settlePriority,passPriority} from '../casting.mjs';
import {activatedAbilities,activationError,addMana} from '../mana.mjs';
import {spellModes,spellTargetOptions} from '../spell-effects.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
import {castingPermission} from '../spell-rules.mjs';
import {chooseTriggerTarget,triggerTargetOptions,orderTriggers,triggerOrderGroup} from '../combat-effects.mjs';
import {combatStats,keywordSet,attackError,attackTargetError} from '../creature-rules.mjs';
import {resolveOracleChoice,oracleChoiceOptions,compileOracleEffect} from '../oracle-effects.mjs';
const cards=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/aurelia_the_warleader.json',import.meta.url))).cards;
const card=name=>{const data=cards.find(c=>c.name===name);assert.ok(data,name);return {...structuredClone(data),instance:crypto.randomUUID(),counters:{},face:0};};
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';return g;};
function enter(g,name,owner=0,extra={}){const c={...card(name),...extra};g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);c.summoningSick=false;return c;}
function creature(g,name='Ally',power=1,toughness=3){const c={instance:crypto.randomUUID(),name,type_line:'Creature',power:String(power),toughness:String(toughness),oracle_text:'',counters:{}};g.players[0].zones.hand.push(c);transfer(g,c.instance,'battlefield',0);c.summoningSick=false;return c;}
function begin(g){changeStep(g,4);if(g.stack.at(-1)?.text.startsWith('choose up to one target')){chooseTriggerTarget(g,g.stack.at(-1).id,[]);resolveTop(g);}assert.equal(g.stack.length,0);advance(g,{automatic:false});}
function finish(g){advance(g,{automatic:false});for(const owner of g.combat.defenders)confirmBlockers(g,owner);advance(g,{automatic:false});while(!g.combat.normalDone)applyCombatDamage(g);advance(g,{automatic:false});}

test('Aurelia: exert is optional, pays the next-untap restriction and uses a counterable reflexive trigger',()=>{
 const g=game(),celebrant=enter(g,'Combat Celebrant'),ally=creature(g);begin(g);setAttacker(g,celebrant.instance,'player:1',true,{exert:true});setAttacker(g,ally.instance,'player:1');confirmAttackers(g);
 assert.equal(celebrant.exertedTurn,'1:0');assert.equal(celebrant.skipNextUntap,true);assert.equal(ally.tapped,true);assert.equal(g.stack.length,1);assert.equal(g.turnPlan,undefined);
 resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(ally.tapped,false);assert.equal(celebrant.tapped,true);assert.equal(g.turnPlan.steps.length,17);
 assert.doesNotThrow(()=>validateSession(structuredClone(g)));finish(g);advance(g,{automatic:false});advance(g,{automatic:false});celebrant.tapped=false;
 assert.throws(()=>setAttacker(g,celebrant.instance,'player:1',true,{exert:true}),/exerted/);setAttacker(g,celebrant.instance,'player:1');confirmAttackers(g);assert.equal(g.stack.length,0);
 celebrant.tapped=true;untap(g,0);assert.equal(celebrant.tapped,true);untap(g,0);assert.equal(celebrant.tapped,false);
});

test('Aurelia: countering an exert trigger does not refund exert or untap the army',()=>{
 const g=game(),c=enter(g,'Combat Celebrant'),ally=creature(g);begin(g);setAttacker(g,c.instance,'player:1',true,{exert:true});setAttacker(g,ally.instance,'player:1');confirmAttackers(g);counterTop(g);assert.equal(ally.tapped,true);assert.equal(c.skipNextUntap,true);assert.equal(g.turnPlan,undefined);
});

test('Aurelia: Moraug schedules an untap at the new combat, and it survives removing Moraug and reloading',()=>{
 const g=game(),m=enter(g,'Moraug, Fury of Akoum'),ally=creature(g);ally.tapped=true;enter(g,'Mountain');assert.equal(g.stack.length,1);resolveTop(g);assert.equal(ally.tapped,true);transfer(g,m.instance,'exile',0);
 const loaded=validateSession(structuredClone(g));advance(loaded,{automatic:false});assert.equal(loaded.step,4);assert.equal(loaded.stack.length,1);assert.equal(loaded.players[0].zones.battlefield.find(c=>c.instance===ally.instance).tapped,true);resolveTop(loaded);assert.equal(loaded.players[0].zones.battlefield.find(c=>c.instance===ally.instance).tapped,false);
});

test('Aurelia: Moraug checks main-phase conditions at trigger and resolution, and its stat bonus follows attack history',()=>{
 const g=game(),m=enter(g,'Moraug, Fury of Akoum'),ally=creature(g);begin(g);setAttacker(g,ally.instance,'player:1');confirmAttackers(g);assert.equal(combatStats(g,0,ally).power,2);enter(g,'Mountain');assert.equal(g.stack.length,0);transfer(g,m.instance,'exile',0);assert.equal(combatStats(g,0,ally).power,1);
 const h=game();enter(h,'Moraug, Fury of Akoum');enter(h,'Mountain');h.step=4;resolveTop(h);assert.equal(h.turnPlan,undefined);
});

test('Aurelia: mentor rechecks lesser power and uses the source’s last known power after it leaves',()=>{
 const g=game(),a=enter(g,'Aurelia, Exemplar of Justice'),ally=creature(g,'Ally',1,4);begin(g);setAttacker(g,a.instance,'player:1');setAttacker(g,ally.instance,'player:1');confirmAttackers(g);
 const trigger=g.stack.find(e=>e.combatTrigger?.keyword==='mentor');assert.ok(trigger);assert.deepEqual(triggerTargetOptions(g,trigger).map(o=>o.id),[ally.instance]);chooseTriggerTarget(g,trigger.id,'card:'+ally.instance);
 a.temporaryStats={power:2,toughness:0};transfer(g,a.instance,'exile',0);resolveTop(g);assert.equal(ally.counters['+1/+1'],1);
});

test('Aurelia: a mentor target that grows to equal power receives no counter',()=>{
 const g=game(),a=enter(g,'Aurelia, Exemplar of Justice'),ally=creature(g,'Ally',1,4);begin(g);setAttacker(g,a.instance,'player:1');setAttacker(g,ally.instance,'player:1');confirmAttackers(g);const trigger=g.stack.at(-1);chooseTriggerTarget(g,trigger.id,'card:'+ally.instance);ally.temporaryStats={power:1,toughness:0};resolveTop(g);assert.equal(ally.counters['+1/+1'],undefined);
});

test('Aurelia: printed and granted melee trigger independently and count opponents attacked this combat',()=>{
 const g=game(4),a=enter(g,'Adriana, Captain of the Guard'),ally=creature(g),other=creature(g);begin(g);setAttacker(g,a.instance,'player:1');setAttacker(g,ally.instance,'player:2');setAttacker(g,other.instance,'player:1');confirmAttackers(g);assert.equal(g.stack.length,3);
 while(g.stack.length)resolveTop(g);assert.equal(combatStats(g,0,a).power,6);assert.equal(combatStats(g,0,ally).power,3);assert.equal(combatStats(g,0,other).toughness,5);
});

test('Aurelia: Hero creates two tapped attacking Soldiers without attack events, then battle cry can pump them',()=>{
 const g=game(3),hero=enter(g,'Hero of Bladehold');begin(g);setAttacker(g,hero.instance,'player:1');confirmAttackers(g);assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.pendingEffect?.step.op,'tokenDefenders');assert.doesNotThrow(()=>validateSession(structuredClone(g)));
 resolveOracleChoice(g,['player:1']);resolveOracleChoice(g,['player:2']);const tokens=g.players[0].zones.battlefield.filter(c=>c.token);assert.equal(tokens.length,2);assert.ok(tokens.every(c=>c.tapped&&c.summoningSick&&!c.attackHistory));assert.equal(g.combat.attackers.length,3);assert.deepEqual(g.combat.defenders,[1,2]);assert.equal(g.stack.length,1);resolveTop(g);assert.ok(tokens.every(c=>combatStats(g,0,c).power===2));assert.equal(combatStats(g,0,hero).power,3);
});

test('Aurelia: Adeline’s power is live and its tokens choose a defender separately for every opponent',()=>{
 const g=game(3),a=enter(g,'Adeline, Resplendent Cathar'),ally=creature(g);assert.equal(a.entryChoices,undefined);assert.equal(combatStats(g,0,a).power,2);begin(g);setAttacker(g,ally.instance,'player:1');confirmAttackers(g);assert.equal(g.stack.length,1);resolveTop(g);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),['player:1']);resolveOracleChoice(g,['player:1']);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),['player:2']);resolveOracleChoice(g,['player:2']);assert.equal(combatStats(g,0,a).power,4);assert.equal(g.combat.attackers.length,3);
});

test('Aurelia: Myrel counts Soldiers at resolution, creates artifact Soldiers and no attack declarations for them',()=>{
 const g=game(),m=enter(g,'Myrel, Shield of Argive');begin(g);setAttacker(g,m.instance,'player:1');confirmAttackers(g);resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,1);const token=g.players[0].zones.battlefield.find(c=>c.token);assert.match(token.type_line,/Artifact Creature — Soldier/);assert.equal(token.tapped,false);assert.equal(g.combat.attackers.length,1);
});

test('Aurelia: Port Razer untaps on damage, adds combat, and cannot attack the same player twice',()=>{
 const g=game(3),p=enter(g,'Port Razer');begin(g);setAttacker(g,p.instance,'player:1');confirmAttackers(g);advance(g,{automatic:false});confirmBlockers(g,1);advance(g,{automatic:false});applyCombatDamage(g);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(p.tapped,false);advance(g,{automatic:false});advance(g,{automatic:false});advance(g,{automatic:false});assert.throws(()=>setAttacker(g,p.instance,'player:1'),/already attacked/);assert.equal(attackTargetError(g,p,{kind:'player',owner:2}),'');setAttacker(g,p.instance,'player:2');
});

test('Aurelia: Fervor, legendary boosts and graveyard Anger grant only the applicable live effects',()=>{
 const g=game(),a=enter(g,'Aurelia, the Warleader'),ally=creature(g);ally.summoningSick=true;const rising=enter(g,'Rising of the Day');assert.equal(attackError(g,0,ally),'');assert.equal(combatStats(g,0,a).power,4);assert.equal(combatStats(g,0,ally).power,1);transfer(g,rising.instance,'exile',0);assert.match(attackError(g,0,ally),/sickness/);const anger=card('Anger');g.players[0].zones.graveyard.push(anger);const mountain=enter(g,'Mountain');assert.ok(keywordSet(g,0,ally).has('haste'));transfer(g,mountain.instance,'exile',0);assert.equal(keywordSet(g,0,ally).has('haste'),false);enter(g,'Fervor');assert.ok(keywordSet(g,0,ally).has('haste'));
});

test('Aurelia: Dolmen Gate prevents damage only to controlled attackers, with unpreventable damage taking precedence',()=>{
 const g=game(),ally=creature(g),source=creature(g,'Damage source',4,4);enter(g,'Dolmen Gate');begin(g);setAttacker(g,ally.instance,'player:1');confirmAttackers(g);const packet=target=>({source:{owner:1,card:source},target:{kind:'card',owner:0,id:target.instance},amount:2});dealDamagePackets(g,[packet(ally),packet(source)],true);assert.equal(ally.markedDamage,undefined);assert.equal(source.markedDamage,2);dealDamagePackets(g,[packet(ally)],false);assert.equal(ally.markedDamage,2);
});

test('Aurelia: Exemplar grants color-dependent keywords at resolution and permits declining its target',()=>{
 const g=game(),a=enter(g,'Aurelia, Exemplar of Justice'),ally=creature(g);ally.colors=['R','W'];changeStep(g,4);chooseTriggerTarget(g,g.stack.at(-1).id,'card:'+ally.instance);ally.colors=['W'];resolveTop(g);assert.equal(combatStats(g,0,ally).power,3);assert.ok(keywordSet(g,0,ally).has('vigilance'));assert.equal(keywordSet(g,0,ally).has('trample'),false);assert.equal(combatStats(g,0,a).power,2);
});

test('Aurelia: Myrel restricts opponent spells and creature/artifact abilities, while lands still produce mana',()=>{
 const g=game(),m=enter(g,'Myrel, Shield of Argive'),forest=enter(g,'Mountain',1),rock=enter(g,'Sol Ring',1);const instant=card('Boros Charm');g.players[1].zones.hand.push(instant);addMana(g.players[1],{R:1,W:1});assert.match(castingTiming(g,1,instant),/prevents/);assert.equal(canRespond(g,1),false);assert.match(activationError(g,1,rock,activatedAbilities(g,1,rock)[0]),/prevents/);assert.equal(activationError(g,1,forest,activatedAbilities(g,1,forest)[0]),'');transfer(g,m.instance,'exile',0);assert.equal(castingTiming(g,1,instant),'');assert.equal(canRespond(g,1),true);
});

test('Aurelia: Myrel’s restriction also applies to enchantment abilities in the final item of the printed type list',()=>{
 const g=game();enter(g,'Myrel, Shield of Argive');const enchantment=enter(g,'Reconnaissance',1);assert.match(activationError(g,1,enchantment,activatedAbilities(g,1,enchantment)[0]),/prevents/);
});

test('Aurelia: Sun Titan targets only low-cost permanents and rechecks graveyard identity before optional return',()=>{
 const g=game(),rock=card('Sol Ring'),large=card('Worn Powerstone'),spell=card('Boros Charm');large.cmc=4;g.players[0].zones.graveyard.push(rock,large,spell);const titan=enter(g,'Sun Titan');const trigger=g.stack.at(-1);assert.deepEqual(triggerTargetOptions(g,trigger).map(t=>t.id),[rock.instance]);chooseTriggerTarget(g,trigger.id,'card:'+rock.instance);resolveTop(g);assert.equal(g.pendingEffect.step.op,'optional');assert.doesNotThrow(()=>validateSession(structuredClone(g)));resolveOracleChoice(g,['yes']);assert.ok(g.players[0].zones.battlefield.includes(rock));begin(g);setAttacker(g,titan.instance,'player:1');confirmAttackers(g);assert.equal(g.stack.length,0,'A mandatory-target trigger cannot remain on the stack without a legal target');assert.equal(g.pendingEffect,undefined);
});

test('Aurelia: Reconnaissance removes an attacker before damage and can untap one after damage',()=>{
 for(const afterDamage of [false,true]){
  const g=game(),r=enter(g,'Reconnaissance'),ally=creature(g);begin(g);setAttacker(g,ally.instance,'player:1');confirmAttackers(g);if(afterDamage)finish(g);const ability=activatedAbilities(g,0,r)[0];activateMana(g,r.instance,ability.id);chooseTriggerTarget(g,g.stack.at(-1).id,'card:'+ally.instance);resolveTop(g);assert.equal(ally.tapped,false);assert.equal(g.combat.attackers.length,0);assert.equal(g.players[1].life,afterDamage?39:40);assert.equal(g.pendingEffect,undefined);
 }
});

test('Aurelia: Tome pays a page counter as a cost, gets commander triggers, and countering does not refund costs',()=>{
 const g=game(),t=enter(g,'Tome of Legends');assert.equal(t.counters.page,1);const commander=enter(g,'Aurelia, the Warleader',0,{commander:true});resolveTop(g);assert.equal(t.counters.page,2);const ability=activatedAbilities(g,0,t)[0];assert.equal(ability.manualCost,false);addMana(g.players[0],{C:1});activateMana(g,t.instance,ability.id);assert.equal(t.counters.page,1);assert.equal(t.tapped,true);counterTop(g);assert.equal(t.counters.page,1);t.tapped=false;t.counters={};addMana(g.players[0],{C:1});assert.match(activationError(g,0,t,ability),/page counters/);assert.ok(commander);
});

test('Aurelia: Esper Sentinel tracks the first noncreature spell for each opponent, including before it entered',()=>{
 const g=game(3);g.active=1;const spell=card('Sol Ring');g.players[1].zones.hand.push(spell);addMana(g.players[1],{C:10});castSpell(g,spell.instance);resolveTop(g);const e=enter(g,'Esper Sentinel',0);const second=card('Sol Ring');g.players[1].zones.hand.push(second);castSpell(g,second.instance);assert.equal(g.stack.length,1);resolveTop(g);g.active=2;g.players[0].zones.library.push(card('Mountain'));const next=card('Sol Ring');g.players[2].zones.hand.push(next);addMana(g.players[2],{C:10});castSpell(g,next.instance);assert.equal(g.stack.length,2);e.temporaryStats={power:2,toughness:0};resolveTop(g);assert.equal(g.pendingEffect.owner,2);assert.equal(g.pendingEffect.step.cost,'{3}');assert.doesNotThrow(()=>validateSession(structuredClone(g)));resolveOracleChoice(g,['no']);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.stack.length,1);
});

test('Aurelia: Savage Beating chooses modes before responses, charges entwine, and restricts casting to own combat',()=>{
 const g=game(),ally=creature(g),s=card('Savage Beating');g.players[0].zones.hand.push(s);assert.match(castingTiming(g,0,s),/during combat/);begin(g);addMana(g.players[0],{R:3,C:4});setAttacker(g,ally.instance,'player:1');confirmAttackers(g);const entry=castSpell(g,s.instance,{mode:2});assert.equal(entry.mode,2);assert.equal(ally.tapped,true);assert.equal(ally.temporaryKeywords,undefined);resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(ally.tapped,false);assert.ok(keywordSet(g,0,ally).has('double strike'));assert.equal(g.turnPlan.steps.length,17);
 const h=game();h.active=1;h.step=4;assert.match(castingTiming(h,0,s),/your turn/);
});

test('Aurelia: Akroma’s Will chooses both only with a commander at cast time and resolves after that commander leaves',()=>{
 const g=game(),ally=creature(g),s=card("Akroma's Will");g.players[0].zones.hand.push(s);addMana(g.players[0],{W:1,C:3});assert.equal(spellModes(s,g,0).length,2);assert.throws(()=>castSpell(g,s.instance,{mode:2}),/mode/);const commander=enter(g,'Aurelia, the Warleader',0,{commander:true});assert.equal(spellModes(s,g,0).length,3);castSpell(g,s.instance,{mode:2});transfer(g,commander.instance,'exile',0);resolveTop(g);assert.equal(g.pendingEffect,undefined);for(const keyword of ['flying','vigilance','double strike','lifelink','indestructible'])assert.ok(keywordSet(g,0,ally).has(keyword),keyword);assert.ok(ally.temporaryKeywords.includes('protection from all colors'));
});

test('Aurelia: Unbreakable Formation addendum remembers the cast phase, and counters only its affected creatures',()=>{
 for(const castStep of [3,4]){const g=game(),ally=creature(g),s=card('Unbreakable Formation');g.step=castStep;g.players[0].zones.hand.push(s);addMana(g.players[0],{W:1,C:2});castSpell(g,s.instance);g.step=castStep===3?4:3;resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.ok(keywordSet(g,0,ally).has('indestructible'));assert.equal(ally.counters['+1/+1'],castStep===3?1:undefined);assert.equal(keywordSet(g,0,ally).has('vigilance'),castStep===3);}
});

test('Aurelia: Seize the Day flashback uses its alternative cost, announces a target, and exiles on every stack exit',()=>{
 for(const countered of [false,true]){const g=game(),ally=creature(g),s=card('Seize the Day');ally.tapped=true;g.players[0].zones.graveyard.push(s);addMana(g.players[0],{R:1,C:2});castSpell(g,s.instance,{targets:['card:'+ally.instance]});assert.equal(g.stack.at(-1).flashback,true);assert.doesNotThrow(()=>validateSession(structuredClone(g)));if(countered)counterTop(g);else resolveTop(g);assert.ok(g.players[0].zones.exile.includes(s));assert.equal(ally.tapped,countered);assert.equal(g.pendingEffect,undefined);}
 const g=game(),ally=creature(g),s=card('Seize the Day');g.players[0].zones.graveyard.push(s);addMana(g.players[0],{R:1,C:2});castSpell(g,s.instance,{targets:['card:'+ally.instance]});transfer(g,s.instance,'hand',0);assert.ok(g.players[0].zones.exile.includes(s));
});

test('Aurelia: World at War resolves in second-main order and rebounds only after a resolving hand cast',()=>{
 const g=game(),ally=creature(g),s=card('World at War');g.players[0].zones.hand.push(s);addMana(g.players[0],{R:2,C:3});castSpell(g,s.instance);resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.ok(g.players[0].zones.exile.includes(s));assert.equal(s.rebound.owner,0);assert.equal(g.turnPlan.steps[10].step,4);assert.equal(g.turnPlan.steps[10].beginEffects[0].text,'Untap all creatures that attacked this turn.');assert.equal(ally.tapped,false);
 endTurn(g);endTurn(g);changeStep(g,1);assert.equal(g.stack.length,1);assert.equal(s.rebound,undefined);resolveTop(g);assert.equal(g.pendingEffect.step.op,'castExiled');const h=validateSession(structuredClone(g));assert.equal(projectGame(h,1).pendingEffect.kind,'remote-choice');const played=reduceAction(h,{type:'cast',id:s.instance},0).game;assert.equal(played.pendingEffect,undefined);assert.equal(played.stack[0].castFrom,'exile');resolveTop(played);assert.equal(played.players[0].zones.graveyard[0].instance,s.instance);assert.equal(played.players[0].zones.graveyard[0].rebound,undefined);
 const countered=game(),c=card('World at War');countered.players[0].zones.hand.push(c);addMana(countered.players[0],{R:2,C:3});castSpell(countered,c.instance);counterTop(countered);assert.ok(countered.players[0].zones.graveyard.includes(c));assert.equal(c.rebound,undefined);
});

test('Aurelia: declining or countering rebound leaves the card exiled with no ongoing free-cast permission',()=>{
 for(const countered of [false,true]){const g=game(),s=card('World at War');g.players[0].zones.hand.push(s);addMana(g.players[0],{R:2,C:3});castSpell(g,s.instance);resolveTop(g);endTurn(g);endTurn(g);changeStep(g,1);if(countered)counterTop(g);else{resolveTop(g);resolveOracleChoice(g,[]);}assert.equal(castingPermission(g,0,s,'exile'),null);assert.ok(g.players[0].zones.exile.includes(s));assert.equal(g.pendingEffect,undefined);}
});

test('Aurelia: Face-Breaker groups damage per player and its Treasure cost grants play permission only after resolution',()=>{
 const g=game(3),f=enter(g,'Professional Face-Breaker'),ally=creature(g),other=creature(g);const events=dealDamagePackets(g,[ally,other].map(card=>({source:{owner:0,card},target:{kind:'player',owner:1},amount:1})),true);
 // Damage events are batched by the caller, as in combat damage.
 const {instance:id}=f;assert.ok(id);return import('../combat-effects.mjs').then(({queueCombatTriggers})=>{queueCombatTriggers(g,events);assert.equal(g.stack.length,1);resolveTop(g);const treasure=g.players[0].zones.battlefield.find(c=>c.token);assert.ok(treasure);const land=card('Mountain');g.players[0].zones.library.push(land);activateMana(g,id,activatedAbilities(g,0,f).find(a=>a.sacrificeType==='Treasure').id,{sacrificeId:treasure.instance});assert.ok(!g.players[0].zones.battlefield.includes(treasure));assert.equal(g.players[0].zones.exile.length,0);resolveTop(g);assert.equal(g.players[0].zones.exile[0],land);assert.doesNotThrow(()=>validateSession(structuredClone(g)));playLand(g,land.instance);assert.equal(land.playPermission,undefined);assert.equal(g.players[0].landsPlayed,1);});
});

test('Aurelia: temporary exile permission expires, cannot survive a zone change, and does not bypass seat ownership',()=>{
 for(const move of [false,true]){const g=game(),f=enter(g,'Professional Face-Breaker'),treasure=enter(g,'Sol Ring',0,{name:'Treasure',type_line:'Token Artifact — Treasure',token:true}),s=card('Sol Ring');g.players[0].zones.library.push(s);activateMana(g,f.instance,activatedAbilities(g,0,f).find(a=>a.sacrificeType==='Treasure').id,{sacrificeId:treasure.instance});resolveTop(g);assert.ok(castingPermission(g,0,s,'exile'));assert.throws(()=>reduceAction(g,{type:'cast',id:s.instance},1),/control/);if(move){transfer(g,s.instance,'hand',0);transfer(g,s.instance,'exile',0);}else endTurn(g);assert.equal(castingPermission(g,0,s,'exile'),null);assert.throws(()=>castSpell(g,s.instance),/permission/);}
});

test('Aurelia: Fury announces a positive division of X before responses, taps damaged creatures, and restricts damaged players',()=>{
 const g=game(3),ally=creature(g),s=card("Aurelia's Fury");g.players[0].zones.hand.push(s);addMana(g.players[0],{W:1,R:1,C:4});const before=JSON.stringify(g);assert.throws(()=>castSpell(g,s.instance,{x:4,targets:['player:1'],division:{'player:1':3}}),/Divide/);assert.equal(JSON.stringify(g),before);castSpell(g,s.instance,{x:4,targets:['player:1','card:'+ally.instance],division:{'player:1':2,['card:'+ally.instance]:2}});assert.doesNotThrow(()=>validateSession(structuredClone(g)));assert.equal(g.players[1].life,40);resolveTop(g);assert.equal(g.players[1].life,38);assert.equal(g.players[2].life,40);assert.equal(ally.markedDamage,2);assert.equal(ally.tapped,true);assert.match(castingTiming(g,1,card('Boros Charm')),/noncreature/);assert.equal(castingTiming(g,1,card('Combat Celebrant')),'Cast this during your main phase with an empty stack.');endTurn(g);changeStep(g,1);assert.equal(castingTiming(g,1,card('Boros Charm')),'');assert.equal(g.pendingEffect,undefined);
});

test('Aurelia: Fury does not redistribute damage from illegal targets, and prevention stops follow-up taps',()=>{
 const g=game(),ally=creature(g),other=creature(g),s=card("Aurelia's Fury");g.players[0].zones.hand.push(s);addMana(g.players[0],{W:1,R:1,C:3});castSpell(g,s.instance,{x:3,targets:['player:1','card:'+ally.instance,'card:'+other.instance],division:{'player:1':1,['card:'+ally.instance]:1,['card:'+other.instance]:1}});transfer(g,ally.instance,'hand',0);other.temporaryKeywords=['protection from all colors'];resolveTop(g);assert.equal(g.players[1].life,39);assert.equal(other.tapped,false);assert.equal(other.markedDamage,undefined);assert.equal(g.pendingEffect,undefined);
});

test('Aurelia: both split halves have their own costs, timing and effects; Response targets only combat creatures',()=>{
 const g=game(),ally=creature(g),s=card('Response // Resurgence');assert.equal(spellTargetOptions(g,0,s).length,0);begin(g);setAttacker(g,ally.instance,'player:1');confirmAttackers(g);assert.ok(spellTargetOptions(g,0,s).some(t=>t.id===ally.instance));g.players[0].zones.hand.push(s);addMana(g.players[0],{R:2});castSpell(g,s.instance,{face:0,targets:['card:'+ally.instance]});resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(ally));assert.equal(g.pendingEffect,undefined);
 const h=game(),a=creature(h),resurgence=card('Response // Resurgence');h.players[0].zones.hand.push(resurgence);addMana(h.players[0],{R:1,W:1,C:4});castSpell(h,resurgence.instance,{face:1});assert.equal(h.stack.at(-1).card.face,1);resolveTop(h);assert.ok(keywordSet(h,0,a).has('first strike'));assert.ok(keywordSet(h,0,a).has('vigilance'));assert.equal(h.turnPlan.steps.length,18);assert.equal(h.pendingEffect,undefined);
});

test('Aurelia: simultaneous own triggers can be reordered before automatic response priority starts',()=>{
 const g=game(),hero=enter(g,'Hero of Bladehold');begin(g);setAttacker(g,hero.instance,'player:1');confirmAttackers(g);g.responseMode='auto';settlePriority(g);assert.equal(g.stack.length,2);const group=triggerOrderGroup(g);assert.equal(group.owner,0);const order=group.entries.toReversed().map(e=>e.id);assert.throws(()=>orderTriggers(g,1,order),/Another player/);assert.throws(()=>orderTriggers(g,0,[order[0],order[0]]),/all and only/);assert.match(castingTiming(g,0,card('Boros Charm')),/trigger order/);orderTriggers(g,0,order);assert.equal(g.stack.at(-1).combatTrigger.keyword,'battle cry');assert.doesNotThrow(()=>validateSession(structuredClone(g)));g.responseMode='hold';passPriority(g,0);assert.equal(triggerOrderGroup(g),null);resolveTop(g);assert.equal(g.stack.length,1);resolveTop(g);resolveOracleChoice(g,['player:1']);resolveOracleChoice(g,['player:1']);assert.ok(g.players[0].zones.battlefield.filter(c=>c.token).every(c=>combatStats(g,0,c).power===1));
});

test('Aurelia: shared trigger-order packets are restricted to the owning seat and preserve all other stack objects',()=>{
 const g=game(),hero=enter(g,'Hero of Bladehold');begin(g);setAttacker(g,hero.instance,'player:1');confirmAttackers(g);const group=triggerOrderGroup(g),ids=group.entries.toReversed().map(e=>e.id);assert.throws(()=>reduceAction(g,{type:'orderTriggers',ids},1),/Another player/);const changed=reduceAction(g,{type:'orderTriggers',ids},0).game;assert.deepEqual(changed.stack.map(e=>e.id),g.stack.map(e=>e.id).toReversed());assert.equal(g.stack.at(-1).combatTrigger.keyword,undefined);
});
