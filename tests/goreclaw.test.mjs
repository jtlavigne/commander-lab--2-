import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,changeStep,validateSession,untap} from '../engine.mjs';
import {castSpell,resolveTop,activateMana,counterTop} from '../casting.mjs';
import {addMana,spellPayment,availableSpellPayment,manaTotals,activatedAbilities,activationError,manaAbilities,productionChoices} from '../mana.mjs';
import {combatStats,keywordSet,blockError} from '../creature-rules.mjs';
import {setAttacker,confirmAttackers,dealDamagePackets,stateBasedActions,removePermanents} from '../combat.mjs';
import {compileOracleEffect,oracleChoiceOptions,resolveOracleChoice} from '../oracle-effects.mjs';
import {chooseTriggerTarget,triggerNeedsTarget,triggerTargetOptions} from '../combat-effects.mjs';
import {parseCsv,nameCorrections} from '../scripts/fetch-test-deck.mjs';
import {autoPassEmptySteps} from '../phase-flow.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/goreclaw_terror_of_qal_sisma.json',import.meta.url),'utf8'));
let sequence=0;const exercisedCards=new Set();
const historical=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle-history/goreclaw_terror_of_qal_sisma.names-fixed.json',import.meta.url))).cards;
const card=name=>{const c=(fixture.cards.find(c=>c.name===name)||historical.find(c=>c.name===name&&name==='Nihil Spellbomb'));assert.ok(c,'Missing cached Oracle: '+name);exercisedCards.add(name);return {...structuredClone(c),instance:'goreclaw-'+(++sequence),counters:{},face:0};};
const game=()=>{const g=newGame(2);g.step=3;g.responseMode='hold';return g;};
const field=(g,name,owner=0)=>{const c=card(name);g.players[owner].zones.battlefield.push(c);return c;};
const enter=(g,name)=>{const c=card(name);g.players[0].zones.hand.push(c);transfer(g,c.instance,'battlefield',0);return c;};
const drain=g=>{for(let n=0;g.stack.length&&!g.pendingEffect;n++){assert.ok(n<100);resolveTop(g);}};

test('deck 1 Oracle cache preserves all 100 copies, verified names, printing metadata and explicit corrections',()=>{
 assert.equal(fixture.complete,true);assert.equal(fixture.cards.length,75);assert.equal(fixture.cards.reduce((n,c)=>n+c.quantity,0),100);assert.equal(fixture.cards.find(c=>c.name==='Forest').quantity,26);assert.equal(fixture.cards.find(c=>c.name===nameCorrections['Commander Sphere']).requested_name,"Commander's Sphere");assert.equal(fixture.decklist_source,'commander_test_decks_color_fixes.csv');assert.ok(fixture.cards.every(c=>c.oracle_id&&c.scryfall_uri&&c.type_line));
 const rows=parseCsv('name,text\r\n"Goreclaw, Terror","line one\nline ""two"""\r\n');assert.deepEqual(rows,[{name:'Goreclaw, Terror',text:'line one\nline "two"'}]);
});
test('Goreclaw reductions affect affordability and actual payment, preserve green costs, and disappear with the source',()=>{
 const g=game(),source=field(g,'Goreclaw, Terror of Qal Sisma'),champion=card('Steel Leaf Champion'),tyrant=card('Carnage Tyrant');g.players[0].zones.hand=[champion,tyrant];addMana(g.players[0],{G:2,C:2});assert.ok(spellPayment(g,0,tyrant,'hand'));assert.equal(spellPayment(g,0,champion,'hand'),null);castSpell(g,tyrant.instance);assert.deepEqual(manaTotals(g.players[0]),{W:0,U:0,B:0,R:0,G:0,C:0});resolveTop(g);transfer(g,source.instance,'graveyard',0);const second=card('Carnage Tyrant');addMana(g.players[0],{G:2,C:2});assert.equal(spellPayment(g,0,second,'hand'),null);
});
test('Ghalta reduction uses current total creature power without reducing colored requirements',()=>{
 const g=game(),elf=field(g,'Llanowar Elves'),ghalta=card('Ghalta, Primal Hunger');elf.counters['+1/+1']=7;addMana(g.players[0],{G:2,C:2});assert.ok(spellPayment(g,0,ghalta,'hand'));elf.counters['+1/+1']=6;assert.equal(spellPayment(g,0,ghalta,'hand'),null);
});
test('Goreclaw attack bonus chooses eligible creatures at resolution, lasts through the turn, and grants trample',()=>{
 const g=game(),source=field(g,'Goreclaw, Terror of Qal Sisma'),large=field(g,'Carnage Tyrant'),small=field(g,'Llanowar Elves');changeStep(g,5);setAttacker(g,source.instance,'player:1');confirmAttackers(g);assert.equal(g.stack.length,1);small.counters['+1/+1']=3;resolveTop(g);assert.equal(combatStats(g,0,large).power,8);assert.equal(combatStats(g,0,small).power,5);assert.ok(keywordSet(g,0,small).has('trample'));g.combat.attackers=[];changeStep(g,11);assert.equal(combatStats(g,0,small).power,4);assert.equal(keywordSet(g,0,small).has('trample'),false);
});
test('creature cast triggers enter the stack above the spell and optional draws require a choice',()=>{
 const g=game();field(g,'Beast Whisperer');field(g,'Primordial Sage');g.players[0].zones.library=[card('Forest'),card('Forest')];const elf=card('Llanowar Elves');g.players[0].zones.hand=[elf];addMana(g.players[0],{G:1});castSpell(g,elf.instance);assert.equal(g.stack.length,3);resolveTop(g);assert.equal(g.pendingEffect.kind,'oracle-choice');resolveOracleChoice(g,['no']);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.stack[0].card.instance,elf.instance);resolveTop(g);assert.ok(g.players[0].zones.battlefield.includes(elf));
});
test('entry triggers use live power, ignore tokens when specified, and recheck Guardian Project intervening conditions',()=>{
 const g=game();field(g,'Guardian Project');field(g,'Elemental Bond');const harvest=field(g,'Soul of the Harvest');const champion=enter(g,'Steel Leaf Champion');assert.equal(g.stack.length,3);const same=card('Steel Leaf Champion');g.players[0].zones.graveyard.push(same);g.players[0].zones.library=Array.from({length:5},()=>card('Forest'));resolveTop(g);resolveOracleChoice(g,['no']);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1,'Guardian condition rechecked at resolution');transfer(g,harvest.instance,'graveyard',0);const token=card('Carnage Tyrant');token.token=true;g.players[0].zones.hand.push(token);transfer(g,token.instance,'battlefield',0);assert.equal(g.stack.length,1,'Only Elemental Bond sees this token');assert.ok(champion);
});
test('library searches preserve duplicate copies, allow fail-to-find and put Cultivate choices in distinct zones',()=>{
 const g=game(),cultivate=card('Cultivate'),forests=[card('Forest'),card('Forest')];g.players[0].zones.library=[...forests,card('Carnage Tyrant')];g.stack=[{card:cultivate,owner:0}];resolveTop(g);assert.equal(g.pendingEffect.step.max,2);assert.equal(oracleChoiceOptions(g).length,2);assert.doesNotThrow(()=>validateSession(structuredClone(g)));resolveOracleChoice(g,forests.map(c=>c.instance));assert.equal(g.players[0].zones.battlefield[0].tapped,true);assert.equal(g.players[0].zones.hand[0].instance,forests[1].instance);assert.equal(g.players[0].zones.graveyard[0].name,'Cultivate');
 g.stack=[{card:card("Nature's Lore"),owner:0}];resolveTop(g);assert.equal(oracleChoiceOptions(g).length,0);resolveOracleChoice(g,[]);assert.equal(g.pendingEffect,undefined);
});
test('search restrictions distinguish a Forest subtype from basic and leave Nature’s Lore land untapped',()=>{
 const g=game(),forest=card('Forest');forest.type_line='Land — Forest Island';forest.name='Test dual';g.players[0].zones.library=[forest];g.stack=[{card:card("Nature's Lore"),owner:0}];resolveTop(g);assert.equal(oracleChoiceOptions(g).length,1);resolveOracleChoice(g,[forest.instance]);assert.equal(forest.tapped,false);
});
test('Craterhoof and Pathbreaker Ibex evaluate X once at resolution and End-Raze excludes itself',()=>{
 const g=game(),elf=field(g,'Llanowar Elves'),hoof=enter(g,'Craterhoof Behemoth');resolveTop(g);assert.equal(combatStats(g,0,elf).power,3);assert.equal(combatStats(g,0,hoof).power,7);assert.ok(keywordSet(g,0,elf).has('trample'));
 const other=game(),forerunner=enter(other,'End-Raze Forerunners'),ally=field(other,'Llanowar Elves');resolveTop(other);assert.equal(combatStats(other,0,ally).power,3);assert.equal(combatStats(other,0,forerunner).power,7);assert.ok(keywordSet(other,0,ally).has('vigilance'));
 assert.ok(compileOracleEffect('creatures you control gain trample and get +X/+X until end of turn, where X is the greatest power among creatures you control.'));
});
test('Surrak grants entering creatures a counter and haste, while Hydra characteristics follow land count',()=>{
 const g=game();field(g,'Surrak and Goreclaw');const elf=enter(g,'Llanowar Elves');resolveTop(g);assert.equal(elf.counters['+1/+1'],1);assert.ok(keywordSet(g,0,elf).has('haste'));const hydra=enter(g,'Ulvenwald Hydra');assert.equal(hydra.entryChoices,undefined);field(g,'Forest');field(g,'Forest');assert.equal(combatStats(g,0,hydra).power,2);transfer(g,g.players[0].zones.battlefield.find(c=>c.name==='Forest').instance,'graveyard',0);assert.equal(combatStats(g,0,hydra).toughness,1);
});
test('real blockers obey low-power restrictions and Temple requires five lands before mana activation',()=>{
 const g=game(),beast=field(g,'Questing Beast'),elf=field(g,'Llanowar Elves',1);assert.match(blockError(g,1,elf,beast,1),/power/);elf.counters['+1/+1']=2;assert.equal(blockError(g,1,elf,beast,1),'');const temple=field(g,'Temple of the False God'),ability=activatedAbilities(g,0,temple)[0];assert.match(activationError(g,0,temple,ability),/lands/);for(let i=0;i<4;i++)field(g,'Forest');activateMana(g,temple.instance,ability.id);assert.equal(manaTotals(g.players[0]).C,2);
});
test('targeted entry removal offers only legal permanent kinds, respects hexproof and resolves through replacements',()=>{
 const g=game(),enemy=field(g,'Sol Ring',1),land=field(g,'Forest',1);field(g,'Carnage Tyrant',1);enter(g,'Meteor Golem');const trigger=triggerNeedsTarget(g);assert.deepEqual(triggerTargetOptions(g,trigger).map(t=>t.id),[enemy.instance]);chooseTriggerTarget(g,trigger.id,'card:'+enemy.instance);resolveTop(g);assert.ok(g.players[1].zones.graveyard.includes(enemy));assert.ok(g.players[1].zones.battlefield.includes(land));
 const h=game(),ring=field(h,'Sol Ring',1),sage=enter(h,'Reclamation Sage');const t=triggerNeedsTarget(h);chooseTriggerTarget(h,t.id,'card:'+ring.instance);resolveTop(h);resolveOracleChoice(h,['no']);assert.ok(h.players[1].zones.battlefield.includes(ring));assert.ok(sage);
});
test('Kogla fights simultaneously; losing its target or source before resolution deals no fight damage',()=>{
 const g=game(),enemy=field(g,'Carnage Tyrant',1);enemy.oracle_text='Trample';const kogla=enter(g,'Kogla, the Titan Ape'),trigger=triggerNeedsTarget(g);chooseTriggerTarget(g,trigger.id,'card:'+enemy.instance);resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(kogla));assert.ok(g.players[1].zones.graveyard.includes(enemy));
 const h=game(),e=field(h,'Steel Leaf Champion',1),k=enter(h,'Kogla, the Titan Ape'),t=triggerNeedsTarget(h);chooseTriggerTarget(h,t.id,'card:'+e.instance);transfer(h,k.instance,'hand',0);resolveTop(h);assert.equal(e.markedDamage,undefined);
});
test('equipment attaches via the stack, grants live keywords and Skullclamp queues its equipped creature death draw',()=>{
 const g=game(),elf=field(g,'Llanowar Elves'),boots=field(g,'Swiftfoot Boots');elf.summoningSick=true;addMana(g.players[0],{C:1});activateMana(g,boots.instance,'equip');const t=triggerNeedsTarget(g);chooseTriggerTarget(g,t.id,'card:'+elf.instance);assert.equal(keywordSet(g,0,elf).has('haste'),false);resolveTop(g);assert.ok(keywordSet(g,0,elf).has('haste'));assert.ok(keywordSet(g,0,elf).has('hexproof'));
 const clamp=field(g,'Skullclamp');addMana(g.players[0],{C:1});g.players[0].zones.library=[card('Forest'),card('Forest')];activateMana(g,clamp.instance,'equip');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+elf.instance);resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(elf));assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].zones.hand.length,2);assert.equal(clamp.attachedTo,undefined);
});
test('sacrifice searches and artifact draw abilities pay costs once and resolve their shared effect',()=>{
 const g=game(),elder=field(g,'Sakura-Tribe Elder'),forest=card('Forest');g.players[0].zones.library=[forest];activateMana(g,elder.instance,'action:0');assert.ok(g.players[0].zones.graveyard.includes(elder));resolveTop(g);resolveOracleChoice(g,[forest.instance]);assert.equal(forest.tapped,true);const sphere=field(g,"Commander's Sphere");g.players[0].zones.library=[card('Forest')];activateMana(g,sphere.instance,'action:1');resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);
});
test('Return of the Wildspeaker modes remain choices and evaluate only the selected effect',()=>{
 const g=game();field(g,'Carnage Tyrant');const human=field(g,'Llanowar Elves');human.type_line='Creature — Human';g.players[0].zones.library=Array.from({length:9},()=>card('Forest'));g.stack=[{card:card('Return of the Wildspeaker'),owner:0}];resolveTop(g);assert.equal(g.pendingEffect.step.op,'mode');resolveOracleChoice(g,['0']);assert.equal(g.players[0].zones.hand.length,7);g.stack=[{card:card('Return of the Wildspeaker'),owner:0}];resolveTop(g);resolveOracleChoice(g,['1']);assert.equal(combatStats(g,0,g.players[0].zones.battlefield[0]).power,10);assert.equal(combatStats(g,0,human).power,1);
});
test('Rishkar’s Expertise draws from live power, offers a legal free spell and generates cast triggers',()=>{
 const g=game();field(g,'Steel Leaf Champion');field(g,'Beast Whisperer');const elf=card('Llanowar Elves');g.players[0].zones.hand=[elf,card('Carnage Tyrant')];g.players[0].zones.library=Array.from({length:6},()=>card('Forest'));g.stack=[{card:card("Rishkar's Expertise"),owner:0}];resolveTop(g);assert.equal(g.players[0].zones.hand.length,7);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[elf.instance]);resolveOracleChoice(g,[elf.instance]);assert.equal(g.pendingEffect.step.op,'castOffered');castSpell(g,elf.instance);assert.equal(g.stack.length,2);assert.equal(g.stack[0].card.instance,elf.instance);resolveTop(g);assert.equal(g.players[0].zones.hand.length,7);resolveTop(g);assert.ok(g.players[0].zones.battlefield.includes(elf));
});
test('Terastodon makes tokens only for targets actually put in graveyards, not indestructible or replacement-exiled targets',()=>{
 const g=game(),ring=field(g,'Sol Ring',1),vessel=field(g,'Thought Vessel',1);vessel.oracle_text+='\nIndestructible';enter(g,'Terastodon');const trigger=triggerNeedsTarget(g);chooseTriggerTarget(g,trigger.id,['card:'+ring.instance,'card:'+vessel.instance]);resolveTop(g);resolveOracleChoice(g,['yes']);assert.ok(g.players[1].zones.graveyard.includes(ring));assert.ok(g.players[1].zones.battlefield.includes(vessel));const tokens=g.players[1].zones.battlefield.filter(c=>c.token);assert.equal(tokens.length,1);assert.equal(tokens[0].power,'3');assert.equal(tokens[0].summoningSick,true);
});
test('Lieutenant effects depend on controlling your own commander and update stats and keywords live',()=>{
 const g=game(),baloth=field(g,'Thunderfoot Baloth'),elf=field(g,'Llanowar Elves');assert.equal(combatStats(g,0,baloth).power,5);assert.equal(keywordSet(g,0,elf).has('trample'),false);const commander=field(g,'Goreclaw, Terror of Qal Sisma');commander.commander=true;commander.ownerSeat=0;assert.equal(combatStats(g,0,baloth).power,7);assert.equal(combatStats(g,0,elf).power,3);assert.ok(keywordSet(g,0,elf).has('trample'));transfer(g,commander.instance,'command',0);assert.equal(combatStats(g,0,baloth).power,5);
});
test('Apex enrage queues from actual damage, and Questing Beast repeats the actual player damage to a legal planeswalker',()=>{
 const g=game(),apex=field(g,'Apex Altisaur'),enemy=field(g,'Steel Leaf Champion',1);const events=dealDamagePackets(g,[{source:{card:enemy,owner:1},target:{kind:'card',owner:0,id:apex.instance},amount:2}]);stateBasedActions(g,{damageEvents:events});assert.equal(g.stack.length,1);chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+enemy.instance);resolveTop(g);assert.ok(g.players[1].zones.graveyard.includes(enemy));assert.equal(apex.markedDamage,7);assert.equal(g.stack.length,1,'The fight damage generates a new enrage trigger');
 const h=game(),beast=field(h,'Questing Beast'),walker={instance:'Walker',name:'Walker',type_line:'Planeswalker',counters:{loyalty:5}};h.players[1].zones.battlefield.push(walker);stateBasedActions(h,{damageEvents:dealDamagePackets(h,[{source:{card:beast,owner:0},target:{kind:'player',owner:1},amount:4}],true)});chooseTriggerTarget(h,triggerNeedsTarget(h).id,'card:Walker');resolveTop(h);assert.equal(walker.counters.loyalty,1);
});
test('Questing Beast prevents shield and protection from preventing friendly creature combat damage',()=>{
 const g=game(),beast=field(g,'Questing Beast'),elf=field(g,'Llanowar Elves'),enemy=field(g,'Steel Leaf Champion',1);enemy.oracle_text='Protection from green';enemy.counters.shield=1;const events=dealDamagePackets(g,[{source:{card:elf,owner:0},target:{kind:'card',owner:1,id:enemy.instance},amount:1}],true);assert.equal(enemy.markedDamage,1);assert.equal(enemy.counters.shield,undefined);assert.ok(events.length);transfer(g,beast.instance,'graveyard',0);dealDamagePackets(g,[{source:{card:elf,owner:0},target:{kind:'card',owner:1,id:enemy.instance},amount:1}],true);assert.equal(enemy.markedDamage,1);
});
test('Vorinclex adds mana for its controller and opponent taps queue a next-untap restriction with zone identity',()=>{
 const g=game();field(g,'Vorinclex, Voice of Hunger');const own=field(g,'Forest'),enemy=field(g,'Forest',1);activateMana(g,own.instance,'basic:G');assert.equal(manaTotals(g.players[0]).G,2);activateMana(g,enemy.instance,'basic:G');assert.equal(manaTotals(g.players[1]).G,1);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(enemy.skipNextUntap,true);untap(g,1);assert.equal(enemy.tapped,true);assert.equal(enemy.skipNextUntap,undefined);untap(g,1);assert.equal(enemy.tapped,false);
});
test('Defiler’s optional life cost reduces only green requirements, pays exactly once and triggers on a green permanent cast',()=>{
 const g=game(),defiler=field(g,'Defiler of Vigor'),champion=card('Steel Leaf Champion');g.players[0].zones.hand=[champion];addMana(g.players[0],{G:2});assert.equal(spellPayment(g,0,champion,'hand'),null);assert.ok(spellPayment(g,0,champion,'hand',{lifeReductions:[defiler.instance]}));castSpell(g,champion.instance,{lifeReductions:[defiler.instance]});assert.equal(g.players[0].life,38);assert.equal(g.stack.length,2);resolveTop(g);assert.equal(defiler.counters['+1/+1'],1);assert.equal(champion.counters['+1/+1'],undefined);resolveTop(g);assert.equal(g.players[0].life,38);
});
test('Greater Good snapshots sacrificed power, queues death triggers above its ability, then requires three discards',()=>{
 const g=game(),good=field(g,'Greater Good'),solemn=field(g,'Solemn Simulacrum');solemn.counters['+1/+1']=2;g.players[0].zones.library=Array.from({length:8},()=>card('Forest'));activateMana(g,good.instance,'action:0',{sacrificeId:solemn.instance});assert.equal(g.stack.length,2);assert.equal(g.stack.at(-1).source.instance,solemn.instance);resolveTop(g);resolveOracleChoice(g,['no']);resolveTop(g);assert.equal(g.players[0].zones.hand.length,4);assert.equal(g.pendingEffect.step.op,'discard');assert.throws(()=>resolveOracleChoice(g,[]),/3/);resolveOracleChoice(g,g.players[0].zones.hand.slice(0,3).map(c=>c.instance));assert.equal(g.players[0].zones.hand.length,1);
});
test('Blast Zone pays both X symbols and later uses last-known charge counters after sacrifice',()=>{
 const g=game(),zone=enter(g,'Blast Zone');assert.equal(zone.counters.charge,1);addMana(g.players[0],{C:4});activateMana(g,zone.instance,'action:2',{x:2});assert.equal(manaTotals(g.players[0]).C,0);resolveTop(g);assert.equal(zone.counters.charge,3);untap(g,0);const vessel=field(g,"Commander's Sphere"),elf=field(g,'Llanowar Elves');addMana(g.players[0],{C:3});activateMana(g,zone.instance,'action:3');assert.ok(g.players[0].zones.graveyard.includes(zone));resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(vessel));assert.ok(g.players[0].zones.battlefield.includes(elf));
});
test('Myriad Landscape enforces a shared land subtype; Scavenger Grounds can sacrifice its own Desert',()=>{
 const g=game(),land=field(g,'Myriad Landscape'),a=card('Forest'),b=card('Forest'),island={...card('Forest'),instance:'Island',name:'Island',type_line:'Basic Land — Island'};g.players[0].zones.library=[a,b,island];addMana(g.players[0],{C:2});activateMana(g,land.instance,'action:2');resolveTop(g);assert.throws(()=>resolveOracleChoice(g,[a.instance,island.instance]),/subtype/);resolveOracleChoice(g,[a.instance,b.instance]);assert.equal(a.tapped,true);assert.equal(b.tapped,true);const grounds=field(g,'Scavenger Grounds');g.players[1].zones.graveyard=[card('Carnage Tyrant')];addMana(g.players[0],{C:2});activateMana(g,grounds.instance,'action:1',{sacrificeId:grounds.instance});resolveTop(g);assert.equal(g.players[0].zones.graveyard.length,0);assert.equal(g.players[1].zones.graveyard.length,0);assert.ok(g.players[0].zones.exile.includes(grounds));
});
test('War Room pays commander-identity life; Relic exiles itself as a cost and all graveyards on resolution',()=>{
 const g=game(),war=field(g,'War Room'),commander=card('Goreclaw, Terror of Qal Sisma');commander.commander=true;g.players[0].zones.command=[commander];g.players[0].zones.library=[card('Forest'),card('Forest')];addMana(g.players[0],{C:3});activateMana(g,war.instance,'action:1');assert.equal(g.players[0].life,39);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);const relic=field(g,'Relic of Progenitus');g.players[1].zones.graveyard=[card('Forest')];addMana(g.players[0],{C:1});activateMana(g,relic.instance,'action:1');assert.ok(g.players[0].zones.exile.includes(relic));resolveTop(g);assert.equal(g.players[1].zones.graveyard.length,0);assert.equal(g.players[0].zones.hand.length,2);
});
test('Field of Ruin makes each player choose their search; Ghost Quarter gives the targeted controller a search',()=>{
 const g=game(),ruin=field(g,'Field of Ruin'),enemy=field(g,'Myriad Landscape',1);g.players[0].zones.library=[card('Forest')];g.players[1].zones.library=[card('Forest')];addMana(g.players[0],{C:2});activateMana(g,ruin.instance,'action:1');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+enemy.instance);resolveTop(g);assert.equal(g.pendingEffect.owner,0);resolveOracleChoice(g,[g.players[0].zones.library[0].instance]);assert.equal(g.pendingEffect.owner,1);assert.doesNotThrow(()=>validateSession(structuredClone(g)));resolveOracleChoice(g,[]);assert.ok(g.players[1].zones.graveyard.includes(enemy));assert.equal(g.pendingEffect,undefined);
 const h=game(),quarter=field(h,'Ghost Quarter'),forest=field(h,'Forest',1);h.players[1].zones.library=[card('Forest')];activateMana(h,quarter.instance,'action:1');chooseTriggerTarget(h,triggerNeedsTarget(h).id,'card:'+forest.instance);resolveTop(h);assert.equal(h.pendingEffect.owner,1);resolveOracleChoice(h,['no']);assert.ok(h.players[1].zones.graveyard.includes(forest));
});
test('uncounterable spells reject the stack counter action without changing zones or priority',()=>{
 const g=game(),tyrant=card('Carnage Tyrant');g.stack=[{card:tyrant,owner:0}];const before=JSON.stringify(g);assert.throws(()=>counterTop(g),/cannot be countered/);assert.equal(JSON.stringify(g),before);g.stack=[{card:card('Rampant Growth'),owner:0}];counterTop(g);assert.equal(g.stack.length,0);
});
test('Nihil Spellbomb’s graveyard trigger offers a real optional payment and allows mana abilities during resolution',()=>{
 const g=game(),bomb=field(g,'Nihil Spellbomb'),birds=field(g,'Birds of Paradise');g.players[1].zones.graveyard=[card('Forest')];g.players[0].zones.library=[card('Forest')];activateMana(g,bomb.instance,'action:0');assert.equal(g.stack.length,2);chooseTriggerTarget(g,triggerNeedsTarget(g).id,'player:1');resolveTop(g);assert.equal(g.pendingEffect.step.op,'optionalPay');assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),['no']);activateMana(g,birds.instance,'own:1',{color:'B'});assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),['yes','no']);resolveOracleChoice(g,['yes']);assert.equal(manaTotals(g.players[0]).B,0);assert.equal(g.players[0].zones.hand.length,1);resolveTop(g);assert.equal(g.players[1].zones.graveyard.length,0);
});
test('Ash Barrens landcycling discards from hand and finds a basic to hand without casting',()=>{
 const g=game(),barrens=card('Ash Barrens'),forest=card('Forest');g.players[0].zones.hand=[barrens];g.players[0].zones.library=[forest];addMana(g.players[0],{C:1});activateMana(g,barrens.instance,'landcycling');assert.ok(g.players[0].zones.graveyard.includes(barrens));resolveTop(g);resolveOracleChoice(g,[forest.instance]);assert.ok(g.players[0].zones.hand.includes(forest));assert.equal(forest.summoningSick,undefined);assert.equal(g.players[0].zones.battlefield.length,0);
});
test('optional life reductions affect hand affordability and dynamic characteristic power affects Goreclaw’s discount',()=>{
 const g=game(),defiler=field(g,'Defiler of Vigor'),elf=card('Llanowar Elves');assert.ok(availableSpellPayment(g,0,elf,'hand'));assert.deepEqual(availableSpellPayment(g,0,elf,'hand').choices,[defiler.instance]);g.players[0].life=1;assert.equal(availableSpellPayment(g,0,elf,'hand'),null);
 const h=game();field(h,'Goreclaw, Terror of Qal Sisma');for(let i=0;i<4;i++)field(h,'Forest');addMana(h.players[0],{G:2,C:2});assert.ok(spellPayment(h,0,card('Ulvenwald Hydra'),'hand'));
});
for(const [name,expected] of [['Elvish Mystic',{G:1}],['Fyndhorn Elves',{G:1}],['Sol Ring',{C:2}],['Mind Stone',{C:1}],['Thought Vessel',{C:1}],['Worn Powerstone',{C:2}],['Reliquary Tower',{C:1}],['Forest',{G:1}],['Ash Barrens',{C:1}]])test(name+' uses its actual Oracle mana ability without duplicate options',()=>{
 const g=game(),source=field(g,name),abilities=manaAbilities(g,0,source);assert.equal(abilities.length,1);activateMana(g,source.instance,abilities[0].id);for(const [type,n] of Object.entries(expected))assert.equal(manaTotals(g.players[0])[type],n);
});
for(const name of ['Arcane Signet',"Commander's Sphere"])test(name+' derives available colors from the commander rather than inventing WUBRG',()=>{
 const g=game(),commander=card('Goreclaw, Terror of Qal Sisma');commander.commander=true;g.players[0].zones.command=[commander];const source=field(g,name),abilities=manaAbilities(g,0,source);assert.deepEqual(abilities[0].output.colors,['G']);activateMana(g,source.instance,abilities[0].id,{color:'G'});assert.equal(manaTotals(g.players[0]).G,1);
});
for(const name of ['Rampant Growth',"Kodama's Reach",'Three Visits'])test(name+' resolves its printed search destinations using separate card copies',()=>{
 const g=game(),forests=[card('Forest'),card('Forest')];g.players[0].zones.library=forests.slice();g.stack=[{card:card(name),owner:0}];resolveTop(g);assert.equal(g.pendingEffect.step.op,'search');const max=g.pendingEffect.step.max,selected=forests.slice(0,max);resolveOracleChoice(g,selected.map(c=>c.instance));assert.equal(g.players[0].zones.battlefield[0].tapped,name!=='Three Visits');assert.equal(g.players[0].zones.hand.length,name==="Kodama's Reach"?1:0);
});
for(const name of ["Wayfarer's Bauble",'Burnished Hart','Evolving Wilds','Terramorphic Expanse'])test(name+' searches after paying its printed sacrifice and mana costs',()=>{
 const g=game(),source=field(g,name),forests=[card('Forest'),card('Forest')];g.players[0].zones.library=forests.slice();addMana(g.players[0],{C:3});const ability=activatedAbilities(g,0,source).find(a=>/Search your library/.test(a.text));activateMana(g,source.instance,ability.id);assert.ok(g.players[0].zones.graveyard.includes(source));resolveTop(g);const max=g.pendingEffect.step.max;resolveOracleChoice(g,forests.slice(0,max).map(c=>c.instance));assert.equal(g.players[0].zones.battlefield.length,max);assert.ok(g.players[0].zones.battlefield.every(c=>c.tapped));
});
test('Garruk’s Uprising checks power both when triggering and resolving and grants trample live',()=>{
 const g=game(),large=field(g,'Steel Leaf Champion');g.players[0].zones.library=[card('Forest'),card('Forest')];const uprising=enter(g,"Garruk's Uprising");assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);assert.ok(keywordSet(g,0,large).has('trample'));enter(g,'Llanowar Elves');assert.equal(g.stack.length,0);enter(g,'Carnage Tyrant');assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].zones.hand.length,2);transfer(g,uprising.instance,'graveyard',0);assert.equal(keywordSet(g,0,large).has('trample'),false);
});
test('Ghalta Stampede deploys chosen creatures without casting them; Bane destroys simultaneously and counts all destroyed permanents',()=>{
 const g=game();field(g,'Beast Whisperer');enter(g,'Ghalta, Stampede Tyrant');const elf=card('Llanowar Elves'),ring=card('Sol Ring');g.players[0].zones.hand=[elf,ring];resolveTop(g);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[elf.instance]);resolveOracleChoice(g,[elf.instance]);assert.equal(g.stack.length,0);assert.ok(g.players[0].zones.battlefield.includes(elf));
 const h=game(),ring2=field(h,'Sol Ring'),uprising=field(h,"Garruk's Uprising",1),bane=enter(h,'Bane of Progress');resolveTop(h);assert.ok(h.players[0].zones.graveyard.includes(ring2));assert.ok(h.players[1].zones.graveyard.includes(uprising));assert.equal(bane.counters['+1/+1'],2);
});
test('Eternal Witness returns a selected graveyard card; Regal Force draws for green creatures including itself',()=>{
 const g=game(),forest=card('Forest');g.players[0].zones.graveyard=[forest];enter(g,'Eternal Witness');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+forest.instance);resolveTop(g);resolveOracleChoice(g,['yes']);assert.ok(g.players[0].zones.hand.includes(forest));
 const h=game();field(h,'Llanowar Elves');field(h,'Solemn Simulacrum');h.players[0].zones.library=Array.from({length:4},()=>card('Forest'));enter(h,'Regal Force');resolveTop(h);assert.equal(h.players[0].zones.hand.length,2);
});
test('Hydra and Solemn optional searches may be declined without shuffling or choose a legal land',()=>{
 const g=game(),lands=[card('Forest'),card('Myriad Landscape')];g.players[0].zones.library=lands.slice();field(g,'Forest');enter(g,'Ulvenwald Hydra');resolveTop(g);assert.equal(g.pendingEffect.step.op,'optional');resolveOracleChoice(g,['no']);assert.deepEqual(g.players[0].zones.library,lands);enter(g,'Solemn Simulacrum');resolveTop(g);resolveOracleChoice(g,['yes']);assert.equal(oracleChoiceOptions(g).length,1);resolveOracleChoice(g,[lands[0].instance]);assert.equal(lands[0].tapped,true);
});
test('Woodfall Primus destroys a noncreature target and persist returns it once with a -1/-1 counter',()=>{
 const g=game(),ring=field(g,'Sol Ring',1),primus=enter(g,'Woodfall Primus');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+ring.instance);resolveTop(g);assert.ok(g.players[1].zones.graveyard.includes(ring));removePermanents(g,[primus.instance],{sacrifice:true});resolveTop(g);assert.ok(g.players[0].zones.battlefield.includes(primus));assert.equal(primus.counters['-1/-1'],1);drain(g);removePermanents(g,[primus.instance],{sacrifice:true});assert.equal(g.stack.length,0);
});
test('Acidic Slime can destroy a land; Kogla attack targets only the defending player’s artifacts/enchantments',()=>{
 const g=game(),land=field(g,'Forest',1);enter(g,'Acidic Slime');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+land.instance);resolveTop(g);assert.ok(g.players[1].zones.graveyard.includes(land));
 const h=game(),kogla=field(h,'Kogla, the Titan Ape'),own=field(h,'Sol Ring'),enemy=field(h,'Sol Ring',1);changeStep(h,5);setAttacker(h,kogla.instance,'player:1');confirmAttackers(h);const trigger=triggerNeedsTarget(h);assert.deepEqual(triggerTargetOptions(h,trigger).map(t=>t.id),[enemy.instance]);chooseTriggerTarget(h,trigger.id,'card:'+enemy.instance);resolveTop(h);assert.ok(h.players[1].zones.graveyard.includes(enemy));assert.ok(h.players[0].zones.battlefield.includes(own));
});
test('Kogla’s bounce activation grants indestructible only to its current incarnation',()=>{
 const g=game(),kogla=field(g,'Kogla, the Titan Ape'),human=field(g,'Eternal Witness');addMana(g.players[0],{G:1,C:1});activateMana(g,kogla.instance,'action:2');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+human.instance);resolveTop(g);assert.ok(g.players[0].zones.hand.includes(human));assert.ok(keywordSet(g,0,kogla).has('indestructible'));
});
test('Old Gnawbone creates one Treasure per actual friendly combat damage; Nyxbloom multiplies produced mana',()=>{
 const g=game();field(g,'Old Gnawbone');const elf=field(g,'Llanowar Elves');stateBasedActions(g,{damageEvents:dealDamagePackets(g,[{source:{card:elf,owner:0},target:{kind:'player',owner:1},amount:3}],true)});resolveTop(g);const treasures=g.players[0].zones.battlefield.filter(c=>c.name==='Treasure');assert.equal(treasures.length,3);assert.equal(treasures[0].type_line,'Token Artifact — Treasure');activateMana(g,treasures[0].instance,'own:0',{color:'U'});assert.equal(manaTotals(g.players[0]).U,1);field(g,'Nyxbloom Ancient');const forest=field(g,'Forest');activateMana(g,forest.instance,'basic:G');assert.equal(manaTotals(g.players[0]).G,3);
});
test('Pathbreaker Ibex snapshots greatest power once for every creature in its attack bonus',()=>{
 const g=game(),ibex=field(g,'Pathbreaker Ibex'),large=field(g,'Carnage Tyrant');changeStep(g,5);setAttacker(g,ibex.instance,'player:1');confirmAttackers(g);resolveTop(g);assert.equal(combatStats(g,0,ibex).power,10);assert.equal(combatStats(g,0,large).power,14);assert.ok(keywordSet(g,0,ibex).has('trample'));
});
test('graveyard utilities support target-player exile, choosing one graveyard card, return-to-hand and one-turn unblockable',()=>{
 const g=game(),crypt=field(g,"Tormod's Crypt"),grave=card('Forest');g.players[1].zones.graveyard=[grave];activateMana(g,crypt.instance,'action:0');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'player:1');resolveTop(g);assert.ok(g.players[1].zones.exile.includes(grave));
 const relic=field(g,'Relic of Progenitus');g.players[1].zones.graveyard=[card('Forest'),card('Carnage Tyrant')];activateMana(g,relic.instance,'action:0');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'player:1');resolveTop(g);assert.equal(g.pendingEffect.owner,1);resolveOracleChoice(g,[g.players[1].zones.graveyard[0].instance]);assert.equal(g.players[1].zones.graveyard.length,1);
 const ruin=field(g,'Buried Ruin'),artifact=card('Sol Ring');g.players[0].zones.graveyard.push(artifact);addMana(g.players[0],{C:2});activateMana(g,ruin.instance,'action:1');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+artifact.instance);resolveTop(g);assert.ok(g.players[0].zones.hand.includes(artifact));
 const passage=field(g,"Rogue's Passage"),elf=field(g,'Llanowar Elves'),enemy=field(g,'Carnage Tyrant',1);addMana(g.players[0],{C:4});activateMana(g,passage.instance,'action:1');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+elf.instance);resolveTop(g);assert.match(blockError(g,1,enemy,elf,1),/Unblockable/);
});
test('Soul-Guide Lantern has separate graveyard entry, opponent-graveyard and paid draw actions',()=>{
 const g=game(),grave=card('Forest');g.players[1].zones.graveyard=[grave];const lantern=enter(g,'Soul-Guide Lantern');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+grave.instance);resolveTop(g);assert.ok(g.players[1].zones.exile.includes(grave));g.players[1].zones.graveyard=[card('Forest')];activateMana(g,lantern.instance,'action:1');resolveTop(g);assert.equal(g.players[1].zones.graveyard.length,0);assert.ok(g.players[0].zones.graveyard.includes(lantern));
 const second=field(g,'Soul-Guide Lantern');g.players[0].zones.library=[card('Forest')];addMana(g.players[0],{C:1});activateMana(g,second.instance,'action:2');resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);
});
test('Mind Stone’s draw costs mana, tap and sacrifice; entering Powerstone/Landscape are tapped',()=>{
 const g=game(),stone=field(g,'Mind Stone');g.players[0].zones.library=[card('Forest')];addMana(g.players[0],{C:1});activateMana(g,stone.instance,'action:1');assert.ok(g.players[0].zones.graveyard.includes(stone));resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);assert.equal(enter(g,'Worn Powerstone').tapped,true);assert.equal(enter(g,'Myriad Landscape').tapped,true);
});
test('Lightning Greaves equips for zero, grants haste/shroud and prevents subsequent targeted equipment',()=>{
 const g=game(),greaves=field(g,'Lightning Greaves'),elf=field(g,'Llanowar Elves');assert.equal(activatedAbilities(g,0,greaves).filter(a=>!a.output).length,1);activateMana(g,greaves.instance,'equip');chooseTriggerTarget(g,triggerNeedsTarget(g).id,'card:'+elf.instance);resolveTop(g);assert.ok(keywordSet(g,0,elf).has('shroud'));assert.ok(keywordSet(g,0,elf).has('haste'));const boots=field(g,'Swiftfoot Boots');addMana(g.players[0],{C:1});assert.throws(()=>activateMana(g,boots.instance,'equip'),/No legal creature/);
});
for(const name of ['Thought Vessel','Reliquary Tower'])test(name+' removes cleanup’s normal seven-card hand limit',()=>{
 const g=game();g.responseMode='auto';g.step=11;g.players[0].zones.hand=Array.from({length:8},()=>card('Forest'));field(g,name);autoPassEmptySteps(g);assert.equal(g.active,1);
});
for(const [name,keywords] of [['Birds of Paradise',['flying']],['Questing Beast',['vigilance','deathtouch','haste']],['Soul of the Harvest',['trample']],['Carnage Tyrant',['trample','hexproof']],['Ghalta, Primal Hunger',['trample']],['Ghalta, Stampede Tyrant',['trample']],['Woodfall Primus',['trample']],['Craterhoof Behemoth',['haste']],['End-Raze Forerunners',['vigilance','trample','haste']],['Thunderfoot Baloth',['trample']],['Acidic Slime',['deathtouch']],['Ulvenwald Hydra',['reach']],['Old Gnawbone',['flying']],['Nyxbloom Ancient',['trample']],['Vorinclex, Voice of Hunger',['trample']],['Defiler of Vigor',['trample']],['Surrak and Goreclaw',['trample']]])test(name+' reads its printed combat keywords from cached Oracle text',()=>{
 const g=game(),c=field(g,name);for(const keyword of keywords)assert.ok(keywordSet(g,0,c).has(keyword),name+' missing '+keyword);
});
test('Surrak and persist correctly cancel opposite counters, allowing Woodfall Primus to persist again',()=>{
 const g=game();field(g,'Surrak and Goreclaw');const primus=field(g,'Woodfall Primus');removePermanents(g,[primus.instance],{sacrifice:true});resolveTop(g);drain(g);assert.equal(primus.counters['-1/-1'],undefined);assert.equal(primus.counters['+1/+1'],undefined);removePermanents(g,[primus.instance],{sacrifice:true});assert.equal(g.stack.length,1);assert.equal(g.stack[0].combatTrigger.returnCounter,'-1/-1');
});
test('the color-fixed deck replacement exiles a graveyard card, crews and gains live power from that linked exile',()=>{
 const g=game(),vehicle=enter(g,'Unlicensed Hearse'),pilot=enter(g,'Steel Leaf Champion'),grave=card('Forest');g.players[1].zones.graveyard.push(grave);activateMana(g,vehicle.instance,'action:0',{targets:['card:'+grave.instance]});resolveTop(g);activateMana(g,vehicle.instance,'crew:2',{crewIds:[pilot.instance]});assert.equal(pilot.tapped,true);resolveTop(g);assert.equal(combatStats(g,0,vehicle).power,1);assert.equal(combatStats(g,0,vehicle).toughness,1);
});
test('the first-deck scenario suite exercises every supplied card name',()=>{
 assert.deepEqual(fixture.cards.filter(c=>!exercisedCards.has(c.name)).map(c=>c.name),[]);
});
test('saved Oracle choices reject malformed nested programs and inactive choosing seats',()=>{
 const g=game();g.stack=[{card:card('Return of the Wildspeaker'),owner:0}];resolveTop(g);assert.doesNotThrow(()=>validateSession(structuredClone(g)));const bad=structuredClone(g);delete bad.pendingEffect.step.modes;assert.throws(()=>validateSession(bad),/Invalid/);const inactive=structuredClone(g);inactive.pendingEffect.context.owner=2;assert.throws(()=>validateSession(inactive),/Invalid/);
});
test('a zero-land Hydra dies before its enter trigger can find a land; an unresolved variable entry waits for values',()=>{
 const g=game(),hydra=card('Ulvenwald Hydra');g.stack=[{card:hydra,owner:0}];g.players[0].zones.library=[card('Forest')];resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(hydra));assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect.step.op,'optional');
 const h=game(),variable={instance:'Variable',name:'Variable',type_line:'Creature',power:'0',toughness:'0',entryChoices:[{key:'counter:+1/+1',label:'Starting counters',suggested:0,min:0}],counters:{}};h.players[0].zones.battlefield.push(variable);stateBasedActions(h);assert.ok(h.players[0].zones.battlefield.includes(variable));
});
