import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,untap,changeStep,validateSession,endTurn,commandersFor} from '../engine.mjs';
import {activateMana,resolveTop,counterTop,castSpell} from '../casting.mjs';
import {manaAbilities,activatedAbilities,addMana,manaTotals,activationError} from '../mana.mjs';
import {chooseTriggerTarget,triggerNeedsTarget} from '../combat-effects.mjs';
import {resolveOracleChoice,oracleChoiceOptions} from '../oracle-effects.mjs';
import {removePermanents,stateBasedActions,dealDamagePackets} from '../combat.mjs';
import {cardFace} from '../card-state.mjs';
import {combatStats,keywordSet,blockError} from '../creature-rules.mjs';
import {setAttacker,confirmAttackers} from '../combat.mjs';
import {autoPassEmptySteps} from '../phase-flow.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/aurelia_the_warleader.json',import.meta.url))).cards;
const historical=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle-history/goreclaw_terror_of_qal_sisma.names-fixed.json',import.meta.url))).cards;
const card=name=>{const r=(records.find(c=>c.name===name)||historical.find(c=>c.name===name&&name==='Nihil Spellbomb'));assert.ok(r,name);return {...structuredClone(r),instance:crypto.randomUUID(),counters:{},face:0};};
const game=()=>{const g=newGame(2);g.step=3;g.responseMode='hold';g.players[0].zones.command=[{...card('Aurelia, the Warleader'),commander:true}];return g;};
const enter=(g,name,owner=0)=>{const c=card(name);g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);c.summoningSick=false;return c;};
const act=(g,c,line,choice={})=>activateMana(g,c.instance,activatedAbilities(g,0,c).find(a=>a.id===line)?.id||line,choice);
const target=(g,key)=>chooseTriggerTarget(g,triggerNeedsTarget(g).id,key);

test('Aurelia audit: cached Oracle covers all 100 copies, 82 names and both split halves',()=>{
 assert.equal(records.length,82);assert.equal(records.reduce((n,c)=>n+c.quantity,0),100);assert.ok(records.every(c=>c.oracle_id&&c.scryfall_uri&&c.type_line));assert.deepEqual(records.find(c=>c.name==='Response // Resurgence').card_faces.map(f=>f.name),['Response','Resurgence']);
});

for(const [name,counts] of [['Sol Ring',{C:2}],['Arcane Signet',{R:1}],["Commander's Sphere",{R:1}],['Mind Stone',{C:1}],['Thought Vessel',{C:1}],['Worn Powerstone',{C:2}],['Hedron Archive',{C:2}],['Thran Dynamo',{C:3}],['Command Tower',{R:1}],['Ash Barrens',{C:1}],['Myriad Landscape',{C:1}],['Reliquary Tower',{C:1}],["Rogue's Passage",{C:1}],['War Room',{C:1}],['Buried Ruin',{C:1}],['Field of Ruin',{C:1}],['Ghost Quarter',{C:1}],['Scavenger Grounds',{C:1}],['Blast Zone',{C:1}],['Wind-Scarred Crag',{R:1}],['Boros Guildgate',{R:1}]])test('Aurelia utility mana: '+name,()=>{
 const g=game(),c=enter(g,name);while(g.stack.length)resolveTop(g);untap(g,0);activateMana(g,c.instance,manaAbilities(g,0,c)[0].id,{color:'R'});for(const [color,n] of Object.entries(counts))assert.equal(manaTotals(g.players[0])[color],n);
});

for(const [name,cost,count] of [["Commander's Sphere",0,1],['Mind Stone',1,1],['Hedron Archive',2,2]])test('Aurelia utility draw cost: '+name,()=>{
 const g=game(),c=enter(g,name);g.players[0].zones.library=[card('Plains'),card('Mountain')];addMana(g.players[0],{C:cost});const ability=activatedAbilities(g,0,c).find(a=>a.text==='Draw '+(count===1?'a card.':'two cards.'));activateMana(g,c.instance,ability.id);assert.ok(g.players[0].zones.graveyard.includes(c));assert.equal(g.players[0].zones.hand.length,0);resolveTop(g);assert.equal(g.players[0].zones.hand.length,count);
});

for(const name of ["Wayfarer's Bauble",'Burnished Hart','Evolving Wilds','Terramorphic Expanse','Myriad Landscape','Expedition Map'])test('Aurelia utility library choice: '+name,()=>{
 const g=game(),c=enter(g,name),land=card('Mountain'),nonbasic=card('Command Tower');g.players[0].zones.library.push(land,nonbasic);untap(g,0);addMana(g.players[0],{C:10});const ability=activatedAbilities(g,0,c).find(a=>/Search your library/.test(a.text));activateMana(g,c.instance,ability.id);resolveTop(g);assert.equal(g.pendingEffect.step.op,'search');assert.ok(oracleChoiceOptions(g).some(o=>o.key===land.instance));assert.equal(oracleChoiceOptions(g).some(o=>o.key===nonbasic.instance),name==='Expedition Map');resolveOracleChoice(g,[land.instance]);assert.equal(g.pendingEffect,undefined);if(name==='Expedition Map')assert.ok(g.players[0].zones.hand.includes(land));else{assert.ok(g.players[0].zones.battlefield.includes(land));assert.equal(land.tapped,true);}
});

test('Aurelia: Trading Post pays each selected mode’s costs before its counterable ability resolves',()=>{
 const g=game(),p=enter(g,'Trading Post'),discard=card('Mountain');g.players[0].zones.hand.push(discard);addMana(g.players[0],{C:10});const before=JSON.stringify(g);assert.throws(()=>act(g,p,'action:0'),/discard/);assert.equal(JSON.stringify(g),before);act(g,p,'action:0',{discardIds:[discard.instance]});assert.ok(g.players[0].zones.graveyard.includes(discard));assert.equal(g.players[0].life,40);counterTop(g);assert.equal(g.players[0].life,40);p.tapped=false;act(g,p,'action:1');assert.equal(g.players[0].life,39);resolveTop(g);const goat=g.players[0].zones.battlefield.find(c=>c.token);assert.equal(goat.name,'Goat');p.tapped=false;const rock=card('Sol Ring');g.players[0].zones.graveyard.push(rock);act(g,p,'action:2',{sacrificeId:goat.instance});target(g,'card:'+rock.instance);resolveTop(g);assert.ok(g.players[0].zones.hand.includes(rock));assert.ok(!g.players[0].zones.battlefield.includes(goat));p.tapped=false;const artifact=enter(g,'Mind Stone');g.players[0].zones.library.push(card('Plains'));act(g,p,'action:3',{sacrificeId:artifact.instance});resolveTop(g);assert.equal(g.players[0].zones.hand.length,2);assert.equal(g.pendingEffect,undefined);
});

test('Aurelia: Staff of Domination uses shared untap, life, targeted tap and draw instructions',()=>{
 const g=game(),staff=enter(g,'Staff of Domination'),ally=enter(g,'Burnished Hart');addMana(g.players[0],{C:30});staff.tapped=true;act(g,staff,'action:0');resolveTop(g);assert.equal(staff.tapped,false);act(g,staff,'action:1');resolveTop(g);assert.equal(g.players[0].life,41);staff.tapped=false;ally.tapped=true;act(g,staff,'action:2');target(g,'card:'+ally.instance);resolveTop(g);assert.equal(ally.tapped,false);staff.tapped=false;act(g,staff,'action:3');target(g,'card:'+ally.instance);resolveTop(g);assert.equal(ally.tapped,true);staff.tapped=false;g.players[0].zones.library.push(card('Plains'));act(g,staff,'action:4');resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.pendingEffect,undefined);
});

test('Aurelia: Unwinding Clock untaps only its controller’s artifacts during another player’s real untap step',()=>{
 const g=game(),clock=enter(g,'Unwinding Clock'),rock=enter(g,'Sol Ring'),land=enter(g,'Mountain');rock.tapped=land.tapped=true;g.active=1;g.step=3;untap(g,1);assert.equal(rock.tapped,true);g.step=0;untap(g,1);assert.equal(rock.tapped,false);assert.equal(land.tapped,true);rock.tapped=true;transfer(g,clock.instance,'exile',0);untap(g,1);assert.equal(rock.tapped,true);
});

test('Aurelia: Everflowing Chalice pays multikicker, enters with the actual kick count, and produces that much mana',()=>{
 const g=game(),c=card('Everflowing Chalice');g.players[0].zones.hand.push(c);addMana(g.players[0],{C:6});castSpell(g,c.instance,{kicks:3});assert.equal(manaTotals(g.players[0]).C,0);assert.doesNotThrow(()=>validateSession(structuredClone(g)));resolveTop(g);assert.equal(c.entryChoices,undefined);assert.equal(c.counters.charge,3);activateMana(g,c.instance,manaAbilities(g,0,c)[0].id);assert.equal(manaTotals(g.players[0]).C,3);transfer(g,c.instance,'exile',0);transfer(g,c.instance,'battlefield',0);assert.equal(c.counters.charge,undefined);assert.equal(c.entryChoices,undefined);
});

test('Aurelia: Wurmcoil Engine death makes separate artifact Wurms with different abilities and fresh identities',()=>{
 const g=game(),w=enter(g,'Wurmcoil Engine');assert.ok(keywordSet(g,0,w).has('deathtouch'));assert.ok(keywordSet(g,0,w).has('lifelink'));removePermanents(g,[w.instance]);resolveTop(g);assert.equal(g.pendingEffect,undefined);const tokens=g.players[0].zones.battlefield.filter(c=>c.token);assert.equal(tokens.length,2);assert.ok(tokens.every(c=>c.power==='3'&&c.toughness==='3'&&/Artifact Creature/.test(c.type_line)));assert.equal(tokens.filter(c=>keywordSet(g,0,c).has('lifelink')).length,1);assert.equal(tokens.filter(c=>keywordSet(g,0,c).has('deathtouch')).length,1);assert.notEqual(tokens[0].instance,tokens[1].instance);
});

test('Aurelia: Duplicant links to the exiled incarnation, changes stats and types but does not copy keywords',()=>{
 const g=game(),w=enter(g,'Wurmcoil Engine',1),d=enter(g,'Duplicant');w.counters['+1/+1']=2;target(g,'card:'+w.instance);resolveTop(g);assert.equal(g.pendingEffect.step.op,'optional');resolveOracleChoice(g,['yes']);assert.ok(g.players[1].zones.exile.includes(w));assert.equal(combatStats(g,0,d).power,6);assert.equal(combatStats(g,0,d).toughness,6);assert.match(cardFace(d).type_line,/Phyrexian Wurm Shapeshifter/);assert.equal(keywordSet(g,0,d).has('deathtouch'),false);assert.doesNotThrow(()=>validateSession(structuredClone(g)));transfer(g,w.instance,'graveyard',1);assert.equal(combatStats(g,0,d).power,2);assert.equal(combatStats(g,0,d).toughness,4);transfer(g,w.instance,'exile',1);assert.equal(combatStats(g,0,d).power,2);transfer(g,d.instance,'hand',0);assert.equal(d.imprintLink,undefined);assert.equal(d.imprintProfile,undefined);
});

test('Aurelia: Duplicant reads Adeline’s characteristic power in exile and follows that card’s owner’s creature count',()=>{
 const g=game(),a=enter(g,'Adeline, Resplendent Cathar',1),d=enter(g,'Duplicant');target(g,'card:'+a.instance);resolveTop(g);resolveOracleChoice(g,['yes']);assert.equal(combatStats(g,0,d).power,0);enter(g,'Burnished Hart',1);assert.equal(combatStats(g,0,d).power,1);assert.equal(combatStats(g,0,d).toughness,4);
});

test('Aurelia: Steel Hellkite uses actual combat-damaged players and exact mana value, with a spent once-per-turn activation',()=>{
 const g=game(),h=enter(g,'Steel Hellkite'),enemy=enter(g,'Sol Ring',1),other=enter(g,'Mind Stone',1),land=enter(g,'Mountain',1);dealDamagePackets(g,[{source:{owner:0,card:h},target:{kind:'player',owner:1},amount:1}],true);addMana(g.players[0],{C:8});act(g,h,'action:1');resolveTop(g);assert.equal(combatStats(g,0,h).power,6);act(g,h,'action:2',{x:1});assert.match(activationError(g,0,h,activatedAbilities(g,0,h).find(a=>a.id==='action:2')),/already/);resolveTop(g);assert.ok(g.players[1].zones.graveyard.includes(enemy));assert.ok(g.players[1].zones.battlefield.includes(other));assert.ok(g.players[1].zones.battlefield.includes(land));assert.equal(g.pendingEffect,undefined);assert.doesNotThrow(()=>validateSession(structuredClone(g)));endTurn(g);changeStep(g,1);addMana(g.players[0],{C:2});act(g,h,'action:2',{x:2});resolveTop(g);assert.ok(g.players[1].zones.battlefield.includes(other));
});

test('Aurelia: Path of Ancestry keeps spending provenance after the land leaves and scries before the matching creature resolves',()=>{
 const g=game(),path=enter(g,'Path of Ancestry');untap(g,0);activateMana(g,path.instance,manaAbilities(g,0,path)[0].id,{color:'W'});transfer(g,path.instance,'exile',0);addMana(g.players[0],{C:3});const sentinel=card('Esper Sentinel');g.players[0].zones.hand.push(sentinel);g.players[0].zones.library.push(card('Plains'));g.players[0].zones.command[0].type_line='Legendary Creature — Human';castSpell(g,sentinel.instance);assert.equal(g.stack.length,2);assert.equal(g.stack.at(-1).text,'Scry 1.');assert.doesNotThrow(()=>validateSession(structuredClone(g)));resolveTop(g);assert.equal(g.pendingEffect.step.op,'scry');resolveOracleChoice(g,[]);assert.equal(g.stack.length,1);resolveTop(g);assert.ok(g.players[0].zones.battlefield.includes(sentinel));
});

test('Aurelia: Path of Ancestry uses commander types at spending time, ignores hidden commanders, and doubles separate scry triggers',()=>{
 for(const hidden of [false,true]){const g=game(),path=enter(g,'Path of Ancestry');path.manaSettings={mode:'multiply',scope:'Land',amount:2};untap(g,0);activateMana(g,path.instance,manaAbilities(g,0,path)[0].id,{color:'W'});const commander=g.players[0].zones.command[0];if(hidden)transfer(g,commander.instance,'hand',0);else commander.type_line='Legendary Creature — Human';const human=card('Myrel, Shield of Argive');g.players[0].zones.hand.push(human);addMana(g.players[0],{C:2});castSpell(g,human.instance);assert.equal(g.stack.filter(e=>e.text==='Scry 1.').length,hidden?0:2);}
});

test('Aurelia: equipment grants live stats and keywords, attack searches, and equipped-creature death draws',()=>{
 for(const [name,cost,keywords] of [['Lightning Greaves',0,['haste','shroud']],['Swiftfoot Boots',1,['hexproof','haste']]]){const g=game(),ally=enter(g,'Burnished Hart'),equipment=enter(g,name);addMana(g.players[0],{C:cost});act(g,equipment,'equip');target(g,'card:'+ally.instance);resolveTop(g);for(const keyword of keywords)assert.ok(keywordSet(g,0,ally).has(keyword));transfer(g,equipment.instance,'exile',0);for(const keyword of keywords)assert.equal(keywordSet(g,0,ally).has(keyword),false);}
 const g=game(),ally=enter(g,'Burnished Hart'),sword=enter(g,'Sword of the Animist');g.players[0].zones.library.push(card('Mountain'));addMana(g.players[0],{C:2});act(g,sword,'equip');target(g,'card:'+ally.instance);resolveTop(g);assert.equal(combatStats(g,0,ally).power,3);changeStep(g,5);setAttacker(g,ally.instance,'player:1');confirmAttackers(g);resolveTop(g);resolveOracleChoice(g,['yes']);const land=g.players[0].zones.library[0];resolveOracleChoice(g,[land.instance]);assert.equal(land.tapped,true);
 const h=game(),bear=enter(h,'Burnished Hart'),clamp=enter(h,'Skullclamp');h.players[0].zones.library.push(card('Plains'),card('Mountain'));addMana(h.players[0],{C:1});act(h,clamp,'equip');target(h,'card:'+bear.instance);resolveTop(h);assert.equal(combatStats(h,0,bear).power,3);assert.equal(combatStats(h,0,bear).toughness,1);removePermanents(h,[bear.instance]);resolveTop(h);assert.equal(h.players[0].zones.hand.length,2);assert.equal(clamp.attachedTo,undefined);
});

test('Aurelia: Solemn Simulacrum’s entry and death choices are independently optional',()=>{
 const g=game(),basic=card('Mountain');g.players[0].zones.library.push(basic);const c=enter(g,'Solemn Simulacrum');resolveTop(g);resolveOracleChoice(g,['yes']);resolveOracleChoice(g,[basic.instance]);assert.equal(basic.tapped,true);g.players[0].zones.library.push(card('Plains'));removePermanents(g,[c.instance]);resolveTop(g);resolveOracleChoice(g,['yes']);assert.equal(g.players[0].zones.hand.length,1);
});

test('Aurelia: Crypt, Relic, Spellbomb and Lantern keep their costs, choosing players and graveyard scopes separate',()=>{
 const g=game(),crypt=enter(g,"Tormod's Crypt"),grave=card('Mountain');g.players[1].zones.graveyard.push(grave);act(g,crypt,'action:0');target(g,'player:1');resolveTop(g);assert.ok(g.players[1].zones.exile.includes(grave));
 const relic=enter(g,'Relic of Progenitus'),one=card('Mountain'),two=card('Plains');g.players[1].zones.graveyard.push(one,two);act(g,relic,'action:0');target(g,'player:1');resolveTop(g);assert.equal(g.pendingEffect.owner,1);resolveOracleChoice(g,[two.instance]);assert.ok(g.players[1].zones.graveyard.includes(one));g.players[0].zones.library.push(card('Plains'));addMana(g.players[0],{C:1});act(g,relic,'action:1');resolveTop(g);assert.equal(g.players[1].zones.graveyard.length,0);assert.ok(g.players[0].zones.exile.includes(relic));
 const bomb=enter(g,'Nihil Spellbomb');g.players[1].zones.graveyard.push(card('Mountain'));g.players[0].zones.library.push(card('Mountain'));addMana(g.players[0],{B:1});act(g,bomb,'action:0');target(g,'player:1');resolveTop(g);assert.equal(g.pendingEffect.step.op,'optionalPay');resolveOracleChoice(g,['yes']);resolveTop(g);assert.equal(g.players[0].zones.hand.length,2);assert.equal(g.players[1].zones.graveyard.length,0);
 const dead=card('Plains');g.players[1].zones.graveyard.push(dead);const lantern=enter(g,'Soul-Guide Lantern');target(g,'card:'+dead.instance);resolveTop(g);assert.ok(g.players[1].zones.exile.includes(dead));g.players[1].zones.graveyard.push(card('Mountain'));act(g,lantern,'action:1');resolveTop(g);assert.equal(g.players[1].zones.graveyard.length,0);const second=enter(g,'Soul-Guide Lantern');target(g,'card:'+lantern.instance);resolveTop(g);g.players[0].zones.library.push(card('Plains'));addMana(g.players[0],{C:1});act(g,second,'action:2');resolveTop(g);assert.equal(g.players[0].zones.hand.length,3);
});

test('Aurelia: Meteor Golem targets opposing nonlands, and Buried Ruin retrieves an artifact to its owner’s hand',()=>{
 const g=game(),enemy=enter(g,'Sol Ring',1);enter(g,'Mountain',1);enter(g,'Meteor Golem');target(g,'card:'+enemy.instance);resolveTop(g);assert.ok(g.players[1].zones.graveyard.includes(enemy));const ruin=enter(g,'Buried Ruin'),rock=card('Mind Stone');g.players[0].zones.graveyard.push(rock);addMana(g.players[0],{C:2});act(g,ruin,'action:1');target(g,'card:'+rock.instance);resolveTop(g);assert.ok(g.players[0].zones.hand.includes(rock));assert.ok(g.players[0].zones.graveyard.includes(ruin));
});

test('Aurelia: shared land actions enforce colors, threshold, hand cycling, life costs and unblockable duration',()=>{
 const g=game(),orchard=enter(g,'Exotic Orchard');assert.match(activationError(g,0,orchard,manaAbilities(g,0,orchard)[0]),/eligible/);enter(g,'Mountain',1);activateMana(g,orchard.instance,manaAbilities(g,0,orchard)[0].id,{color:'R'});assert.equal(manaTotals(g.players[0]).R,1);const temple=enter(g,'Temple of the False God');assert.match(activationError(g,0,temple,manaAbilities(g,0,temple)[0]),/lands/);for(let i=0;i<3;i++)enter(g,'Plains');activateMana(g,temple.instance,manaAbilities(g,0,temple)[0].id);assert.equal(manaTotals(g.players[0]).C,2);
 const ash=card('Ash Barrens'),basic=card('Mountain');g.players[0].zones.hand.push(ash);g.players[0].zones.library.push(basic);activateMana(g,ash.instance,'landcycling');resolveTop(g);resolveOracleChoice(g,[basic.instance]);assert.ok(g.players[0].zones.hand.includes(basic));assert.ok(g.players[0].zones.graveyard.includes(ash));const room=enter(g,'War Room');g.players[0].zones.library.push(card('Plains'));addMana(g.players[0],{C:3});act(g,room,'action:1');assert.equal(g.players[0].life,38);resolveTop(g);assert.equal(g.players[0].zones.hand.length,2);
 const passage=enter(g,"Rogue's Passage"),ally=enter(g,'Burnished Hart'),blocker=enter(g,'Burnished Hart',1);addMana(g.players[0],{C:4});act(g,passage,'action:1');target(g,'card:'+ally.instance);resolveTop(g);assert.match(blockError(g,1,blocker,ally,1),/Unblockable/);changeStep(g,11);assert.equal(ally.temporaryKeywords,undefined);
});

test('Aurelia: land destruction offers controller searches, and Ghost Quarter’s decline does not shuffle',()=>{
 const g=game(),ruin=enter(g,'Field of Ruin'),enemy=enter(g,'Myriad Landscape',1);g.players[0].zones.library.push(card('Plains'));g.players[1].zones.library.push(card('Mountain'));addMana(g.players[0],{C:2});act(g,ruin,'action:1');target(g,'card:'+enemy.instance);resolveTop(g);assert.equal(g.pendingEffect.owner,0);resolveOracleChoice(g,[g.players[0].zones.library[0].instance]);assert.equal(g.pendingEffect.owner,1);resolveOracleChoice(g,[]);assert.ok(g.players[1].zones.graveyard.includes(enemy));
 const quarter=enter(g,'Ghost Quarter'),land=enter(g,'Mountain',1);g.players[1].zones.library.push(card('Plains'));const before=g.players[1].zones.library.map(c=>c.instance);act(g,quarter,'action:1');target(g,'card:'+land.instance);resolveTop(g);assert.equal(g.pendingEffect.owner,1);assert.equal(g.pendingEffect.step.op,'optional');resolveOracleChoice(g,['no']);assert.deepEqual(g.players[1].zones.library.map(c=>c.instance),before);
});

test('Aurelia: Blast Zone pays XX and uses sacrificed charge counters; Scavenger Grounds can sacrifice itself',()=>{
 const g=game(),zone=enter(g,'Blast Zone');addMana(g.players[0],{C:4});act(g,zone,'action:2',{x:2});assert.equal(manaTotals(g.players[0]).C,0);resolveTop(g);assert.equal(zone.counters.charge,3);untap(g,0);const rock=enter(g,"Commander's Sphere");addMana(g.players[0],{C:3});act(g,zone,'action:3');resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(rock));const grounds=enter(g,'Scavenger Grounds');g.players[1].zones.graveyard.push(card('Mountain'));addMana(g.players[0],{C:2});act(g,grounds,'action:1',{sacrificeId:grounds.instance});resolveTop(g);assert.equal(g.players[0].zones.graveyard.length,0);assert.equal(g.players[1].zones.graveyard.length,0);
});

for(const name of ['Thought Vessel','Reliquary Tower'])test('Aurelia: '+name+' retains a hand larger than seven at cleanup',()=>{const g=game();g.responseMode='auto';g.step=11;enter(g,name);g.players[0].zones.hand=Array.from({length:8},()=>card('Plains'));autoPassEmptySteps(g);assert.equal(g.active,1);});

for(const [name,keywords] of [['Aurelia, Exemplar of Justice',['flying']],['Adeline, Resplendent Cathar',['vigilance']],['Anger',['haste']],['Sun Titan',['vigilance']],['Professional Face-Breaker',['menace']],['Steel Hellkite',['flying']]])test('Aurelia printed keywords: '+name,()=>{const g=game(),c=enter(g,name);for(const k of keywords)assert.ok(keywordSet(g,0,c).has(k));});

test('Aurelia audit: Karlach’s Background setup has a second visible command slot and independent cast tax',()=>{
 const g=game(),k={...card('Karlach, Fury of Avernus'),commander:true},background={instance:crypto.randomUUID(),name:'Background fixture',type_line:'Legendary Enchantment — Background',mana_cost:'{2}{W}',oracle_text:'',colors:['W'],color_identity:['W'],commander:true,counters:{}};g.players[0].zones.command=[k,background];validateSession(g);assert.deepEqual(commandersFor(g,0).map(c=>c.commandSlot),[0,1]);addMana(g.players[0],{C:20,R:4,W:4});castSpell(g,k.instance);resolveTop(g);castSpell(g,background.instance);resolveTop(g);transfer(g,k.instance,'command',0);transfer(g,background.instance,'command',0);assert.equal(k.commandCasts,1);assert.equal(background.commandCasts,1);castSpell(g,background.instance);resolveTop(g);assert.equal(k.commandCasts,1);assert.equal(background.commandCasts,2);
});

test('Aurelia audit: Tome of Legends gains separate page counters when its commander enters and attacks',()=>{
 const g=game(),tome=enter(g,'Tome of Legends'),commander=g.players[0].zones.command[0];transfer(g,commander.instance,'battlefield',0);resolveTop(g);assert.equal(tome.counters.page,2);changeStep(g,5);setAttacker(g,commander.instance,'player:1');confirmAttackers(g);while(g.stack.length)resolveTop(g);assert.equal(tome.counters.page,3);
});
