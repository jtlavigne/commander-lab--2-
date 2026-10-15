import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,transfer,validateSession} from '../engine.mjs';
import {castSpell,activateLoyaltyAction,resolveTop} from '../casting.mjs';
import {chooseTriggerTarget,triggerTargetOptions} from '../combat-effects.mjs';
import {combatGroups} from '../board-interaction.mjs';
import {setAttacker,confirmAttackers,startCombat} from '../combat.mjs';
import {recordPlay} from '../play-events.mjs';
import {projectGame,compactView,expandView,diff,applyPatch} from '../multiplayer/protocol.mjs';
const card=(id,extra={})=>({instance:id,name:id,type_line:'Creature',mana_cost:'{0}',power:'3',toughness:'4',oracle_text:'',counters:{},...extra});
function table(count=2){const g=newGame(count);g.step=3;g.responseMode='hold';return g;}
function enter(g,id,owner=0,extra={}){const c=card(id,extra);g.players[owner].zones.hand.push(c);transfer(g,id,'battlefield',owner);c.summoningSick=false;return c;}

for(const count of [2,3,4])test(count+' seats: combat groups show all outgoing groups to the attacker and only incoming groups to each defender',()=>{
 const g=table(count);enter(g,'Walker',1,{type_line:'Planeswalker',loyalty:'5'});for(let i=0;i<count;i++)enter(g,'Attacker'+i);g.step=4;startCombat(g);g.step=5;g.combat.stage='attackers';for(let i=0;i<count;i++)setAttacker(g,'Attacker'+i,i===0?'card:Walker':'player:'+(1+(i-1)%(count-1)));confirmAttackers(g);const before=JSON.stringify(g);assert.equal(combatGroups(g,0).flatMap(group=>group.attackers).length,count);for(let owner=1;owner<count;owner++){const groups=combatGroups(g,owner);assert.ok(groups.every(group=>group.defender.owner===owner));assert.deepEqual(groups.flatMap(group=>group.attackers.map(a=>a.id)).sort(),g.combat.attackers.filter(a=>a.defender.owner===owner).map(a=>a.id).sort());}assert.equal(JSON.stringify(g),before);
});

test('combat presentation excludes a new incarnation and creatures no longer controlled by the attacker',()=>{
 const g=table(),a=enter(g,'A');g.step=4;startCombat(g);g.step=5;g.combat.stage='attackers';setAttacker(g,a.instance,'player:1');confirmAttackers(g);transfer(g,a.instance,'exile',0);transfer(g,a.instance,'battlefield',0);assert.deepEqual(combatGroups(g,0),[]);
});

test('a public cast announcement survives immediate resolution and replicated patches without revealing other hand cards',()=>{
 const g=table();g.responseMode='auto';g.players[1].zones.hand.push(card('private-card-id',{name:'Secret opponent card',type_line:'Sorcery',mana_cost:'{99}'}));const spell=card('Fire',{type_line:'Instant',oracle_text:'Fire deals 2 damage to target player.'});g.players[0].zones.hand.push(spell);const before=projectGame(g,1);castSpell(g,spell.instance,{targets:['player:1']});assert.equal(g.stack.length,0);assert.equal(g.players[1].life,38);assert.equal(g.playEvents.length,1);assert.equal(g.playEvents[0].targets[0].owner,1);assert.doesNotThrow(()=>validateSession(structuredClone(g)));const after=projectGame(g,0);assert.equal(JSON.stringify(after).includes('Secret opponent card'),false);const packed=compactView(after);assert.deepEqual(expandView(packed.state,packed.assets),after);const peer=projectGame(g,1);assert.deepEqual(applyPatch(before,diff(before,peer)),peer);
});

test('targeted loyalty abilities use the same announcement and resolution path, including protection checks',()=>{
 const g=table(),walker=enter(g,'Walker',0,{type_line:'Planeswalker',loyalty:'4',colors:['R'],oracle_text:'0: This planeswalker deals 2 damage to target creature.'}),victim=enter(g,'Victim',1),protectedCard=enter(g,'Protected',1,{oracle_text:'Protection from red'});activateLoyaltyAction(g,walker.instance,0);const entry=g.stack.at(-1);assert.ok(triggerTargetOptions(g,entry).some(t=>t.id===victim.instance));assert.equal(triggerTargetOptions(g,entry).some(t=>t.id===protectedCard.instance),false);chooseTriggerTarget(g,entry.id,'card:'+victim.instance);assert.equal(g.playEvents.at(-1).kind,'ability');assert.equal(victim.markedDamage,undefined);resolveTop(g);assert.equal(victim.markedDamage,2);
});

test('presentation history is bounded, validated and absent for a rejected spell announcement',()=>{
 const g=table(),spell=card('Targeted',{type_line:'Instant',oracle_text:'Exile target creature.'});g.players[0].zones.hand.push(spell);assert.throws(()=>castSpell(g,spell.instance),/targets/);assert.equal(g.playEvents,undefined);for(let n=0;n<12;n++)recordPlay(g,{owner:0,source:spell,text:'Public announcement '+n});assert.equal(g.playEvents.length,8);assert.equal(g.playEvents[0].text,'Public announcement 4');const broken=structuredClone(g);broken.playEvents[0].owner=8;assert.throws(()=>validateSession(broken));
});
