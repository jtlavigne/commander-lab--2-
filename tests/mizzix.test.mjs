import {autoPassEmptySteps} from '../phase-flow.mjs';
import {grantExilePlay} from '../permission-effects.mjs';
import {applyOracleEffect} from '../oracle-effects.mjs';
import {chooseTriggerTarget,triggerTargetOptions} from '../combat-effects.mjs';
import {resolveOracleChoice,oracleChoiceOptions} from '../oracle-effects.mjs';
import {spellTargetOptions} from '../spell-effects.mjs';
import {combatStats} from '../creature-rules.mjs';
import {castingPermission} from '../spell-rules.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,changeStep,resetGame} from '../engine.mjs';
import {castSpell,resolveTop,counterTop,passPriority,resolveProliferate,activateMana} from '../casting.mjs';
import {addMana,manaTotals,spellPayment,activatedAbilities} from '../mana.mjs';
import {manaValue} from '../card-state.mjs';
import {genericReduction} from '../spell-costs.mjs';
import {addPlayerCounter} from '../player-counters.mjs';
import {copySpell} from '../stack-effects.mjs';
import {effectTargetOptions} from '../effect-targets.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/mizzix_of_the_izmagnus.json',import.meta.url))).cards;
const card=name=>{const c=records.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{}};};
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';return g;};
function enter(g,name,owner=0){const c=card(name);g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);return c;}
function cast(g,name,options={},owner=0){const c=card(name);g.players[owner].zones.hand.push(c);addMana(g.players[owner],{U:20,R:20,C:50});castSpell(g,c.instance,options);return c;}

test('Mizzix has 82 cached Oracle records and exactly 100 supplied cards',()=>{assert.equal(records.length,82);assert.equal(records.reduce((n,c)=>n+c.quantity,0),100);});
for(const count of [2,3,4])test('Mizzix gains experience only when its qualifying cast trigger resolves in '+count+' seats',()=>{
 const g=game(count),source=enter(g,'Mizzix of the Izmagnus'),spell=cast(g,'Brainstorm');assert.equal(g.stack.length,2);assert.equal(g.players[0].counters?.experience,undefined);transfer(g,source.instance,'graveyard',0);resolveTop(g);assert.equal(g.players[0].counters.experience,1);assert.ok(g.stack.some(e=>e.card?.instance===spell.instance));counterTop(g);assert.equal(g.players[0].counters.experience,1);assert.ok(g.players.slice(1).every(p=>!p.counters?.experience));validateSession(JSON.parse(JSON.stringify(g)));
});
test('experience comparison happens when casting, uses strict greater-than and ignores other types/controllers and copies',()=>{
 const g=game();enter(g,'Mizzix of the Izmagnus');addPlayerCounter(g,0,'experience',2);
 for(const name of ['Brainstorm','Sol Ring']){cast(g,name);assert.equal(g.stack.length,1);counterTop(g);}
 const opposing=cast(g,'Brainstorm',{},1);assert.equal(g.stack.length,1);passPriority(g,1);cast(g,'Counterspell',{targets:['card:'+opposing.instance]});assert.equal(g.stack.length,2);counterTop(g);const target=effectTargetOptions(g,{owner:0,card:card('Twincast'),text:'Copy target instant or sorcery spell.'}).find(t=>t.id===opposing.instance);copySpell(g,target,0);assert.equal(g.stack.length,2);counterTop(g);counterTop(g);
 cast(g,'Frantic Search');cast(g,'Seething Song');assert.equal(g.stack.length,4);resolveTop(g);assert.equal(g.players[0].counters.experience,3);counterTop(g);resolveTop(g);assert.equal(g.players[0].counters.experience,4);counterTop(g);
});
test('experience discounts apply live to generic costs, never colored requirements, and persist independently of the source',()=>{
 const g=game(),source=enter(g,'Mizzix of the Izmagnus'),spell=card('Comet Storm');addPlayerCounter(g,0,'experience',4);addMana(g.players[0],{R:2,C:3});assert.ok(spellPayment(g,0,spell,'hand',{x:7}));assert.equal(spellPayment(g,0,spell,'hand',{x:8}),null);assert.equal(spellPayment(g,0,spell,'hand',{x:0,spend:{C:2}}),null);assert.equal(genericReduction(g,0,card('Sol Ring')),0);transfer(g,source.instance,'hand',0);assert.equal(genericReduction(g,0,spell),0);assert.equal(g.players[0].counters.experience,4);transfer(g,source.instance,'battlefield',0);assert.equal(genericReduction(g,0,spell),4);changeStep(g,11);assert.equal(g.players[0].counters.experience,4);assert.equal(resetGame(g).players[0].counters,undefined);
});
test('full stack mana value includes every X symbol and the selected split half, independent of mana spent',()=>{
 const g=game();enter(g,'Mizzix of the Izmagnus');addPlayerCounter(g,0,'experience',5);cast(g,'Crackle with Power',{x:2});assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.players[0].counters.experience,6);counterTop(g);assert.equal(manaValue(card('Crackle with Power')),2);assert.equal(manaValue(card('Crackle with Power'),{onStack:true,x:2}),8);const split=card('Expansion // Explosion');assert.equal(manaValue({...split,face:0},{onStack:true}),2);assert.equal(manaValue({...split,face:1},{onStack:true,x:3}),7);assert.equal(manaValue(split),6);
});
test('experience counters use shared player-counter proliferation and persist without Mizzix',()=>{
 const g=game();addPlayerCounter(g,0,'experience',2);g.pendingEffect={kind:'proliferate',owner:0,name:'Proliferate'};resolveProliferate(g,[],[0]);assert.equal(g.players[0].counters.experience,3);assert.equal(g.players[1].counters,undefined);validateSession(JSON.parse(JSON.stringify(g)));assert.equal(g.players[0].poison,0);
});

test('additional discard costs are chosen and paid before the stack, and invalid costs leave mana and zones untouched',()=>{
 for(const name of ['Big Score','Unexpected Windfall']){const g=game(),spell=card(name),discard=card('Island');g.players[0].zones.hand=[spell,discard];g.players[0].zones.library=[card('Island'),card('Island')];addMana(g.players[0],{R:2,C:3});const before=JSON.stringify(g);assert.throws(()=>castSpell(g,spell.instance),/pay/);assert.equal(JSON.stringify(g),before);castSpell(g,spell.instance,{discardIds:[discard.instance]});assert.ok(g.players[0].zones.graveyard.includes(discard));assert.equal(g.players[0].zones.hand.length,0);resolveTop(g);assert.equal(g.players[0].zones.hand.length,2);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token&&c.name==='Treasure').length,2);assert.equal(g.pendingEffect,undefined);}
});
test('buyback pays an additional cost, returns only on resolution, and does not return a countered spell',()=>{
 for(const countered of [false,true]){const g=game(),original=cast(g,'Brainstorm',{},1);passPriority(g,1);const spell=cast(g,'Reiterate',{buyback:true,targets:['card:'+original.instance]});assert.equal(manaTotals(g.players[0]).C,46);if(countered){counterTop(g);assert.ok(g.players[0].zones.graveyard.includes(spell));}else{resolveTop(g);assert.ok(g.players[0].zones.hand.includes(spell));assert.equal(g.stack.filter(e=>e.copy).length,1);}assert.equal(g.pendingEffect,undefined);}
});
test('Past in Flames grants only current own graveyard spells their printed-cost flashback for this turn',()=>{
 const g=game(),looting=card('Faithless Looting'),spell=card('Seething Song'),land=card('Island');g.players[0].zones.graveyard=[looting,spell,land];cast(g,'Past in Flames');resolveTop(g);assert.ok(looting.flashbackGrant);assert.ok(spell.flashbackGrant);assert.equal(land.flashbackGrant,undefined);g.players[0].mana=[{R:1,type:'R',amount:1}];castSpell(g,looting.instance);assert.equal(g.stack[0].flashback,true);counterTop(g);assert.ok(g.players[0].zones.exile.includes(looting));assert.equal(looting.flashbackGrant,undefined);const later=card('Brainstorm');g.players[0].zones.graveyard.push(later);assert.equal(later.flashbackGrant,undefined);validateSession(JSON.parse(JSON.stringify(g)));changeStep(g,11);assert.equal(spell.flashbackGrant,undefined);assert.equal(spellPayment(g,0,spell,'graveyard'),null);
});
test('Comet Storm pays multikicker for exactly one distinct extra target per kick, dealing X to each legal target',()=>{
 const g=game(3),spell=card('Comet Storm');g.players[0].zones.hand.push(spell);addMana(g.players[0],{R:2,C:5});assert.throws(()=>castSpell(g,spell.instance,{x:3,kicks:2,targets:['player:1']}),/number/);castSpell(g,spell.instance,{x:3,kicks:2,targets:['player:0','player:1','player:2']});assert.equal(manaTotals(g.players[0]).C,0);assert.equal(manaValue(g.stack[0].card,{x:3,onStack:true}),5);resolveTop(g);assert.deepEqual(g.players.map(p=>p.life),[37,37,37]);assert.equal(g.pendingEffect,undefined);
});
test('Crackle chooses up to X targets, deals five times X to each, and X=0 permits no targets',()=>{
 const g=game(3);cast(g,'Crackle with Power',{x:2,targets:['player:1','player:2']});resolveTop(g);assert.deepEqual(g.players.map(p=>p.life),[40,30,30]);cast(g,'Crackle with Power',{x:0});resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.throws(()=>cast(g,'Crackle with Power',{x:0,targets:['player:1']}),/number/);
});
test('Explosion announces damage and draw targets separately, including the same player for both instructions',()=>{
 for(const same of [false,true]){const g=game(3);g.players[1].zones.library=Array.from({length:4},()=>card('Island'));g.players[2].zones.library=Array.from({length:4},()=>card('Island'));cast(g,'Expansion // Explosion',{face:1,x:3,targets:['player:1',same?'player:1':'player:2']});assert.deepEqual(g.stack[0].targets.map(t=>t.group),[0,1]);validateSession(JSON.parse(JSON.stringify(g)));resolveTop(g);assert.deepEqual(g.players.map(p=>p.life),[40,37,40]);assert.equal(g.players[same?1:2].zones.hand.length,3);assert.equal(g.players[same?2:1].zones.hand.length,0);assert.equal(g.pendingEffect,undefined);}
});
test('scaled mana counts current opponent hands and tapped lands only when the spell resolves',()=>{
 const g=game(3);for(let owner=1;owner<3;owner++){const a=enter(g,'Island',owner),b=enter(g,'Island',owner);a.tapped=true;b.tapped=false;}const own=enter(g,'Island');own.tapped=true;cast(g,'Mana Geyser');const before=manaTotals(g.players[0]).R;resolveTop(g);assert.equal(manaTotals(g.players[0]).R,before+2);g.players[1].zones.hand=[card('Island'),card('Island'),card('Island')];cast(g,"Jeska's Will",{mode:0,targets:['player:1']});const before2=manaTotals(g.players[0]).R;g.players[1].zones.hand.pop();resolveTop(g);assert.equal(manaTotals(g.players[0]).R,before2+2);
});

test('Expressive Iteration privately chooses hand/bottom cards and grants only its exiled card a normal-cost turn permission',()=>{
 const g=game(3),cards=['Brainstorm','Island','Seething Song','Opt'].map(card);g.players[0].zones.library=[...cards];cast(g,'Expressive Iteration');resolveTop(g);assert.equal(g.pendingEffect.step.op,'iterationHand');assert.equal(projectGame(g,0).players[0].zones.library[0].name,'Brainstorm');assert.ok(projectGame(g,1).players[0].zones.library.every(c=>c.hidden));assert.equal(projectGame(g,0).players[0].zones.library[3].hidden,true);resolveOracleChoice(g,[cards[0].instance]);assert.equal(g.pendingEffect.step.op,'iterationBottom');validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[cards[1].instance]);assert.deepEqual(g.players[0].zones.library.map(c=>c.instance),[cards[3],cards[1]].map(c=>c.instance));assert.ok(g.players[0].zones.exile.includes(cards[2]));assert.ok(castingPermission(g,0,cards[2],'exile'));assert.equal(castingPermission(g,1,cards[2],'exile'),null);changeStep(g,11);g.active=1;assert.equal(castingPermission(g,0,cards[2],'exile'),null);
});
test('Electrodominance finishes its damage before offering a targeted free hand spell; casting it preserves response priority',()=>{
 const g=game(),target=enter(g,'Storm-Kiln Artist',1),spell=card('Cyclonic Rift');g.players[0].zones.hand.push(spell);cast(g,'Electrodominance',{x:3,targets:['player:1']});resolveTop(g);assert.equal(g.players[1].life,37);assert.equal(g.pendingEffect.step.op,'freeCast');resolveOracleChoice(g,[spell.instance]);assert.equal(g.pendingEffect.step.op,'castOffered');assert.ok(g.stack.some(e=>e.card?.name==='Electrodominance'));castSpell(g,spell.instance,{mode:0,targets:['card:'+target.instance]});assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,1);assert.ok(g.players[1].zones.battlefield.includes(target));assert.ok(g.players[0].zones.graveyard.some(c=>c.name==='Electrodominance'));counterTop(g);assert.ok(g.players[1].zones.battlefield.includes(target));
});
test('Mizzix Mastery exiles originals, casts announced card copies in chosen order and waits to stack their cast triggers',()=>{
 const g=game(),a=card('Seething Song'),b=card('Brainstorm'),c=card('Faithless Looting');g.players[0].zones.graveyard=[a,b,c];enter(g,'Young Pyromancer');const mastery=cast(g,"Mizzix's Mastery",{mode:1});resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,1);resolveTop(g);assert.equal(g.pendingEffect.step.op,'chooseExiled');assert.ok([a,b,c].every(c=>g.players[0].zones.exile.includes(c)));const copies=g.players[0].zones.exile.filter(c=>c.cardCopy);assert.equal(copies.length,3);
 for(const name of ['Seething Song','Brainstorm']){const copy=copies.find(c=>c.name===name);resolveOracleChoice(g,[copy.instance]);assert.equal(g.pendingEffect.step.op,'castOffered');castSpell(g,copy.instance);assert.equal(g.stack.filter(e=>e.kind==='ability').length,0);assert.equal(g.pendingEffect.step.op,'chooseExiled');validateSession(JSON.parse(JSON.stringify(g)));}
 resolveOracleChoice(g,[]);assert.ok(g.players[0].zones.exile.includes(mastery));assert.equal(g.players[0].zones.exile.filter(c=>c.cardCopy).length,0);assert.deepEqual(g.stack.map(e=>e.card?.name||'trigger'),['Seething Song','Brainstorm','trigger','trigger']);assert.equal(g.deferredTriggers,undefined);assert.equal(g.resolutionInProgress,undefined);counterTop(g);counterTop(g);counterTop(g);assert.equal(g.players[0].zones.graveyard.filter(c=>c.spellCopy).length,0);assert.ok(resetGame(g).players[0].zones.library.every(c=>!c.cardCopy));
});
test('a targeted Mastery rechecks its graveyard target and cannot exile or cast an opponent card',()=>{
 const g=game(),a=card('Seething Song'),other=card('Brainstorm');g.players[0].zones.graveyard=[a];g.players[1].zones.graveyard=[other];const mastery=card("Mizzix's Mastery");assert.ok(!spellTargetOptions(g,0,mastery,{mode:0}).some(t=>t.id===other.instance));cast(g,mastery.name,{mode:0,targets:['card:'+a.instance]});transfer(g,a.instance,'hand',0);resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].zones.exile.length,0);
});
test('Epic Experiment offers only eligible instant/sorcery cards and moves uncast exiled cards to the graveyard after choices',()=>{
 const g=game(),cards=['Seething Song','Island','Sol Ring','Apex of Power'].map(card);g.players[0].zones.library=[...cards];cast(g,'Epic Experiment',{x:4});resolveTop(g);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[cards[0].instance]);resolveOracleChoice(g,[cards[0].instance]);castSpell(g,cards[0].instance);assert.equal(g.pendingEffect,undefined);assert.ok(cards.slice(1).every(c=>g.players[0].zones.graveyard.includes(c)));assert.equal(g.stack[0].card.instance,cards[0].instance);assert.equal(g.players[0].zones.exile.length,0);resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(cards[0]));
});
test('Apex exiles seven with spell-only normal-cost permission and adds ten chosen-color mana only when cast from hand',()=>{
 const g=game(),cards=Array.from({length:8},()=>card('Island'));g.players[0].zones.library=[...cards];const apex=cast(g,'Apex of Power');resolveTop(g);assert.equal(g.players[0].zones.exile.length,7);assert.equal(g.pendingEffect.step.op,'chooseManaColor');const before=manaTotals(g.players[0]).R;resolveOracleChoice(g,['R']);assert.equal(manaTotals(g.players[0]).R,before+10);assert.equal(castingPermission(g,0,cards[0],'exile'),null);assert.ok(g.players[0].zones.graveyard.includes(apex));
});
test('Thousand-Year Storm counts earlier own instant/sorcery casts, preserves independent copies and uses last-known spell data if countered',()=>{
 const g=game();enter(g,'Thousand-Year Storm');const first=cast(g,'Seething Song');resolveTop(g);assert.equal(g.stack.length,1);counterTop(g);cast(g,'Sol Ring');resolveTop(g);cast(g,'Brainstorm',{},1);counterTop(g);const spell=cast(g,'Seething Song');assert.equal(g.stack.length,2);transfer(g,spell.instance,'graveyard',0);resolveTop(g);assert.equal(g.stack.length,1);assert.equal(g.stack[0].copy,true);const before=manaTotals(g.players[0]).R;resolveTop(g);assert.equal(manaTotals(g.players[0]).R,before+5);assert.equal(g.castHistory.total,4);assert.deepEqual(g.castHistory.instantSorcery,[2,1]);
});
test('Storm counts earlier spells from every seat and type, excluding copies, even when the original is countered',()=>{
 const g=game();cast(g,'Sol Ring');counterTop(g);cast(g,'Seething Song',{},1);counterTop(g);const desire=cast(g,"Mind's Desire");assert.equal(g.stack.length,2);transfer(g,desire.instance,'graveyard',0);resolveTop(g);assert.equal(g.stack.length,2);assert.ok(g.stack.every(e=>e.copy));assert.equal(g.castHistory.total,3);assert.equal(g.pendingEffect,undefined);
});
test('Increasing Vengeance targets only own spells and makes two copies when cast from a graveyard',()=>{
 const g=game(),original=cast(g,'Seething Song'),vengeance=card('Increasing Vengeance');g.players[0].zones.graveyard=[vengeance];addMana(g.players[0],{R:2,C:3});castSpell(g,vengeance.instance,{targets:['card:'+original.instance]});resolveTop(g);assert.equal(g.stack.filter(e=>e.copy).length,2);assert.ok(g.players[0].zones.exile.includes(vengeance));assert.equal(g.pendingEffect,undefined);
});
test('Expansion checks full stack mana value including X, and Vandalblast overload destroys only opposing artifacts',()=>{
 const g=game(),original=cast(g,'Stroke of Genius',{x:3,targets:['player:1']}),expansion=card('Expansion // Explosion');assert.ok(!spellTargetOptions(g,0,expansion).some(t=>t.id===original.instance));counterTop(g);const own=enter(g,'Sol Ring'),other=enter(g,'Sol Ring',1),creature=enter(g,'Young Pyromancer',1);cast(g,'Vandalblast',{mode:1});resolveTop(g);assert.ok(g.players[0].zones.battlefield.includes(own));assert.ok(g.players[1].zones.battlefield.includes(creature));assert.ok(g.players[1].zones.graveyard.includes(other));
});
test('Storm-Kiln uses artifact counts and Magecraft while Young Pyromancer and Guttersnipe trigger only on casting',()=>{
 const g=game();const artist=enter(g,'Storm-Kiln Artist');enter(g,'Young Pyromancer');enter(g,'Guttersnipe');enter(g,'Sol Ring');assert.equal(combatStats(g,0,artist).power,3);cast(g,'Seething Song');assert.equal(g.stack.length,4);while(g.stack.length>1)resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token&&c.name==='Treasure').length,1);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token&&c.name==='Elemental').length,1);assert.equal(g.players[1].life,38);assert.equal(combatStats(g,0,artist).power,4);const original=g.stack[0],target=effectTargetOptions(g,{owner:0,card:card('Twincast'),text:'Copy target instant or sorcery spell.'})[0];copySpell(g,target,0);assert.equal(g.stack.filter(e=>e.kind==='ability').length,1);
});

test('Mind\'s Desire grants a temporary free-play permission without bypassing ordinary spell or land timing',()=>{
 const g=game(),drawn=card('Seething Song');g.players[0].zones.library=[drawn];cast(g,"Mind's Desire");resolveTop(g);assert.equal(g.stack.length,1);resolveTop(g);assert.ok(g.players[0].zones.exile.includes(drawn));assert.equal(castingPermission(g,0,drawn,'exile').free,true);g.players[0].mana=[];castSpell(g,drawn.instance);assert.equal(g.stack[0].card.instance,drawn.instance);resolveTop(g);assert.equal(manaTotals(g.players[0]).R,5);assert.equal(drawn.playPermission,undefined);
});
test('Jeska\'s Will may choose both while controlling a commander, grants normal-cost play permission and retains that choice after removal',()=>{
 const g=game(),commander=enter(g,'Mizzix of the Izmagnus');commander.commander=true;g.players[0].zones.library=[card('Island'),card('Seething Song'),card('Sol Ring')];g.players[1].zones.hand=[card('Island'),card('Island')];cast(g,"Jeska's Will",{mode:2,targets:['player:1']});resolveTop(g);transfer(g,commander.instance,'graveyard',0);resolveTop(g);assert.equal(g.players[0].zones.exile.length,3);assert.ok(g.players[0].zones.exile.every(c=>castingPermission(g,0,c,'exile')));assert.ok(g.players[0].zones.exile.every(c=>!castingPermission(g,0,c,'exile').free));assert.equal(g.pendingEffect,undefined);
});
test('Solve the Equation reveals the selected instant or sorcery, preserves duplicates and shuffles even when no card is found',()=>{
 const g=game(),a=card('Seething Song'),b=card('Seething Song'),land=card('Island'),artifact=card('Sol Ring');g.players[0].zones.library=[a,b,land,artifact];cast(g,'Solve the Equation');resolveTop(g);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key).sort(),[a.instance,b.instance].sort());resolveOracleChoice(g,[b.instance]);assert.ok(g.players[0].zones.hand.includes(b));assert.equal(g.players[0].zones.library.length,3);assert.equal(g.pendingEffect,undefined);const view=projectGame(g,1);assert.equal(view.players[0].zones.hand[0].hidden,true);assert.equal(view.playEvents.findLast(e=>e.kind==='reveal').card.name,b.name);
});
test('Faithless Looting draws then discards two on both casts and flashback exiles only after its choices finish',()=>{
 const g=game(),looting=cast(g,'Faithless Looting');g.players[0].zones.library=Array.from({length:4},()=>card('Island'));resolveTop(g);assert.equal(g.pendingEffect.step.op,'discard');assert.equal(g.players[0].zones.hand.length,2);resolveOracleChoice(g,g.players[0].zones.hand.map(c=>c.instance));assert.ok(g.players[0].zones.graveyard.includes(looting));castSpell(g,looting.instance);resolveTop(g);assert.ok(g.stack.some(e=>e.card?.instance===looting.instance));resolveOracleChoice(g,g.players[0].zones.hand.map(c=>c.instance));assert.ok(g.players[0].zones.exile.includes(looting));assert.equal(g.pendingEffect,undefined);
});
for(const name of ['Izzet Boilerworks','Swiftwater Cliffs','Izzet Guildgate'])test(name+' enters tapped and applies its printed entry and mana actions',()=>{
 const g=game(),existing=enter(g,'Island');const land=enter(g,name);assert.equal(land.tapped,true);if(name==='Izzet Boilerworks'){resolveTop(g);resolveOracleChoice(g,[existing.instance]);assert.ok(g.players[0].zones.hand.includes(existing));}else if(name==='Swiftwater Cliffs'){resolveTop(g);assert.equal(g.players[0].life,41);}assert.equal(g.pendingEffect,undefined);
 land.tapped=false;const ability=activatedAbilities(g,0,land).find(a=>a.output);activateMana(g,land.instance,ability.id,{color:'U'});assert.equal(manaTotals(g.players[0]).U,1);assert.equal(manaTotals(g.players[0]).R,name==='Izzet Boilerworks'?1:0);
});

test('Mastery card copies still pay additional discard costs, and casting mana abilities is allowed during the offered cast',()=>{
 const g=game(),score=card('Big Score'),discard=card('Island'),land=enter(g,'Island');g.players[0].zones.graveyard=[score];g.players[0].zones.hand=[discard];cast(g,"Mizzix's Mastery",{mode:0,targets:['card:'+score.instance]});resolveTop(g);const copy=g.players[0].zones.exile.find(c=>c.cardCopy);resolveOracleChoice(g,[copy.instance]);g.players[0].mana=[];activateMana(g,land.instance,'basic:U');assert.equal(manaTotals(g.players[0]).U,1);assert.throws(()=>castSpell(g,copy.instance),/pay/);castSpell(g,copy.instance,{discardIds:[discard.instance]});assert.ok(g.players[0].zones.graveyard.includes(discard));assert.equal(g.pendingEffect,undefined);assert.equal(g.stack[0].card.instance,copy.instance);assert.equal(manaTotals(g.players[0]).U,1);
});
test('Past in Flames pays its printed flashback cost and Apex cast from exile gets no hand-only mana',()=>{
 const g=game(),past=card('Past in Flames');g.players[0].zones.graveyard=[past];addMana(g.players[0],{C:4,R:1});castSpell(g,past.instance);assert.equal(manaTotals(g.players[0]).C,0);resolveTop(g);assert.ok(g.players[0].zones.exile.includes(past));const apex=card('Apex of Power');apex.zoneChangeId='apex-exile';apex.playPermission={owner:0,turn:g.turn+':'+g.active,zoneChangeId:apex.zoneChangeId};g.players[0].zones.exile.push(apex);addMana(g.players[0],{C:7,R:3});castSpell(g,apex.instance);resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(manaTotals(g.players[0]).R,0);
});
test('Increasing Vengeance chooses independent new targets for both copies while retaining X and original targets',()=>{
 const g=game(3);for(const p of g.players)p.zones.library=Array.from({length:4},()=>card('Island'));const original=cast(g,'Stroke of Genius',{x:2,targets:['player:1']}),vengeance=card('Increasing Vengeance');g.players[0].zones.graveyard=[vengeance];castSpell(g,vengeance.instance,{targets:['card:'+original.instance]});resolveTop(g);assert.equal(g.pendingEffect.step.op,'retargetCopy');resolveOracleChoice(g,['player:2']);assert.equal(g.pendingEffect.step.op,'retargetCopy');validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,['player:0']);assert.equal(g.pendingEffect,undefined);assert.deepEqual(g.stack.map(e=>e.targets[0].owner),[1,2,0]);for(let i=0;i<3;i++)resolveTop(g);assert.deepEqual(g.players.map(p=>p.zones.hand.length),[2,2,2]);
});
test('Expansion pays either permitted hybrid color and copies a legal low-mana-value opposing spell',()=>{
 const g=game(),original=cast(g,'Seething Song',{},1);passPriority(g,1);const expansion=card('Expansion // Explosion');g.players[0].zones.hand=[expansion];addMana(g.players[0],{R:2});castSpell(g,expansion.instance,{face:0,targets:['card:'+original.instance]});assert.equal(manaTotals(g.players[0]).R,0);resolveTop(g);assert.equal(g.stack.filter(e=>e.copy).length,1);assert.equal(g.pendingEffect,undefined);
});
test('shared Mizzix utility evidence requires identical full Oracle text and every prior paragraph checked',()=>{
 const base=new URL('./fixtures/commander/',import.meta.url),progress=JSON.parse(readFileSync(new URL('checklist-progress.json',base))),prior=['goreclaw_terror_of_qal_sisma','aurelia_the_warleader','arahbo_roar_of_the_world','isshin_two_heavens_as_one','fynn_the_fangbearer','talrand_sky_summoner'].map(id=>({id,cards:JSON.parse(readFileSync(new URL('oracle/'+id+'.json',base))).cards}));let reused=0;for(const c of records){const source=prior.find(p=>p.cards.some(old=>old.name===c.name&&old.oracle_text===c.oracle_text));if(source){const paragraphs=(c.card_faces||[c]).flatMap(face=>(face.oracle_text||'').split('\n').filter(Boolean));for(let i=0;i<paragraphs.length;i++)assert.ok(progress[source.id].verified_paragraphs[c.name]?.includes(i),c.name+' '+i);reused++;}}assert.ok(reused>=50);
});

test('mandatory trigger targets are chosen after the entire resolution, including creatures created by later instructions',()=>{
 const g=game(),source={name:'Artifact observer',instance:'observer',type_line:'Enchantment',oracle_text:'Whenever an artifact enters, put a +1/+1 counter on target creature you control.',counters:{}};g.players[0].zones.hand.push(source);transfer(g,source.instance,'battlefield',0);assert.equal(g.stack.length,0);assert.ok(applyOracleEffect(g,{kind:'ability',owner:0,name:'Token batch',source,text:'Create a Treasure token. Create a 1/1 white Human Soldier creature token.'}));const creature=g.players[0].zones.battlefield.find(c=>c.token&&/Creature/.test(c.type_line));assert.equal(g.stack.length,1);assert.ok(triggerTargetOptions(g,g.stack[0]).some(t=>t.id===creature.instance));chooseTriggerTarget(g,g.stack[0].id,'card:'+creature.instance);resolveTop(g);assert.equal(creature.counters['+1/+1'],1);assert.equal(g.deferredTriggers,undefined);
});
test('backing out of an offered exile cast retains the option to cast that card after another choice',()=>{
 const g=game(),spell=card('Seething Song');g.players[0].zones.graveyard=[spell];cast(g,"Mizzix's Mastery",{mode:0,targets:['card:'+spell.instance]});resolveTop(g);const copy=g.players[0].zones.exile.find(c=>c.cardCopy);resolveOracleChoice(g,[copy.instance]);resolveOracleChoice(g,[]);assert.ok(oracleChoiceOptions(g).some(o=>o.key===copy.instance));resolveOracleChoice(g,[copy.instance]);castSpell(g,copy.instance);assert.equal(g.pendingEffect,undefined);assert.equal(g.stack[0].card.instance,copy.instance);
});

test('automatic postcombat progression holds for an available exile land and respects the same land-play limit',()=>{
 const g=game(),land=card('Island');g.responseMode='auto';g.step=9;g.players[0].zones.hand=[land];transfer(g,land.instance,'exile',0);grantExilePlay(g,land,0);autoPassEmptySteps(g);assert.equal(g.step,9);g.players[0].landsPlayed=1;autoPassEmptySteps(g);assert.notEqual(g.step,9);
});
