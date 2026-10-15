import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,changeStep,endTurn,untap} from '../engine.mjs';
import {castSpell,resolveTop,counterTop,activateMana,passPriority} from '../casting.mjs';
import {addMana,manaTotals,spellPayment,availableSpellPayment,activatedAbilities} from '../mana.mjs';
import {resolveOracleChoice,oracleChoiceOptions,compileOracleEffect} from '../oracle-effects.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
import {cardFace} from '../card-state.mjs';
import {combatStats} from '../creature-rules.mjs';
import {playLand} from '../casting.mjs';
const priorRecords=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/mizzix_of_the_izmagnus.json',import.meta.url))).cards;
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/kalamax_the_stormsire.json',import.meta.url))).cards;
const card=name=>{const c=records.find(c=>c.name===name)||priorRecords.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{}};};
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';return g;};
function enter(g,name,owner=0){const c=card(name);g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);return c;}
function cast(g,name,options={},owner=0){const c=card(name);g.players[owner].zones.hand.push(c);addMana(g.players[owner],{G:20,U:20,R:20,C:50});castSpell(g,c.instance,options);return c;}
function settle(g){for(let n=0;g.stack.length&&n<100;n++){if(g.pendingEffect)throw Error('Unexpected choice '+g.pendingEffect.step?.op);resolveTop(g);}assert.equal(g.stack.length,0);}

test('Kalamax has 87 distinct cached records and all 100 supplied copies',()=>{assert.equal(records.length,87);assert.equal(records.reduce((n,c)=>n+c.quantity,0),100);});
for(const count of [2,3,4])test('tapped Kalamax copies only its controller first instant per turn in '+count+' seats',()=>{
 const g=game(count),source=enter(g,'Kalamax, the Stormsire');source.tapped=true;g.players[0].zones.library=[card('Island')];cast(g,'Explore');resolveTop(g);cast(g,'Harrow',{sacrificeIds:[enter(g,'Forest').instance]});assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.stack.filter(e=>e.copy).length,1);assert.equal(g.stack.at(-1).kind,'ability');resolveTop(g);assert.equal(source.counters['+1/+1'],1);while(g.stack.length)counterTop(g);cast(g,'Growth Spiral');assert.equal(g.stack.length,1);counterTop(g);endTurn(g);g.step=3;cast(g,'Growth Spiral');assert.equal(g.stack.length,2);counterTop(g);counterTop(g);validateSession(JSON.parse(JSON.stringify(g)));
});
test('untapped first instant is counted even when Kalamax cannot trigger; later tapping does not retry it',()=>{
 const g=game(),source=enter(g,'Kalamax, the Stormsire');cast(g,'Growth Spiral');assert.equal(g.stack.length,1);counterTop(g);source.tapped=true;cast(g,'Growth Spiral');assert.equal(g.stack.length,1);counterTop(g);endTurn(g);g.step=3;cast(g,'Growth Spiral',{},1);assert.equal(g.stack.length,1);counterTop(g);cast(g,'Growth Spiral');assert.equal(g.stack.length,2);
});
test('Kalamax rechecks tapped status, using last-known information after departure rather than a returned permanent',()=>{
 for(const change of ['untap','leave','blink','untap-leave']){const g=game(),source=enter(g,'Kalamax, the Stormsire');source.tapped=true;cast(g,'Growth Spiral');if(change.includes('untap'))source.tapped=false;if(change!=='untap'){transfer(g,source.instance,'hand',0);if(change==='blink')transfer(g,source.instance,'battlefield',0);}resolveTop(g);assert.equal(g.stack.filter(e=>e.copy).length,change.includes('untap')?0:1);assert.equal(source.counters['+1/+1'],undefined);}
});
test('Kalamax copies last known announced spell after it is countered and ignores sorcery copies for counters',()=>{
 const g=game(),source=enter(g,'Kalamax, the Stormsire');source.tapped=true;const original=cast(g,'Growth Spiral');transfer(g,original.instance,'graveyard',0);resolveTop(g);assert.equal(g.stack[0].copy,true);resolveTop(g);assert.equal(source.counters['+1/+1'],1);counterTop(g);cast(g,'Explore');const spell=g.stack[0];cast(g,'Reverberate',{targets:['card:'+spell.card.instance]});resolveTop(g);assert.equal(g.stack.filter(e=>e.kind==='ability').length,0);assert.equal(g.stack.filter(e=>e.copy).length,1);
});
test('Veyran adds independent triggers including its own, but does not multiply the spells themselves',()=>{
 const g=game(),source=enter(g,'Kalamax, the Stormsire'),veyran=enter(g,'Veyran, Voice of Duality');enter(g,'Young Pyromancer');source.tapped=true;cast(g,'Growth Spiral');assert.equal(g.stack.length,7);const kalamax=g.stack.filter(e=>e.source?.instance===source.instance);assert.equal(kalamax.length,2);assert.equal(g.stack.filter(e=>e.source?.instance===veyran.instance).length,2);transfer(g,veyran.instance,'hand',0);while(g.stack.at(-1).source?.instance!==source.instance)resolveTop(g);resolveTop(g);assert.equal(g.stack.filter(e=>e.copy).length,1);assert.equal(g.stack.at(-1).kind,'ability');resolveTop(g);assert.equal(source.counters['+1/+1'],1);
});
test('Veyran multiplies magecraft on copies, while cast-only token triggers stay quiet',()=>{
 const g=game(),veyran=enter(g,'Veyran, Voice of Duality');enter(g,'Young Pyromancer');cast(g,'Explore');while(g.stack.length>1)resolveTop(g);assert.equal(combatStats(g,0,veyran).power,4);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,2);cast(g,'Reverberate',{targets:['card:'+g.stack[0].card.instance]});while(g.stack.at(-1).kind==='ability')resolveTop(g);resolveTop(g);assert.equal(g.stack.filter(e=>e.kind==='ability').length,2);while(g.stack.at(-1).kind==='ability')resolveTop(g);assert.equal(combatStats(g,0,veyran).power,8);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,4);
});
for(const staffs of [1,2])test(staffs+' Twinning Staff providers add once to an entire multi-copy event',()=>{
 const g=game(),original=cast(g,'Explore');for(let n=0;n<staffs;n++)enter(g,'Twinning Staff');const vengeance=card('Increasing Vengeance');g.players[0].zones.graveyard.push(vengeance);castSpell(g,vengeance.instance,{targets:['card:'+original.instance]});resolveTop(g);assert.equal(g.stack.filter(e=>e.copy).length,2+staffs);assert.equal(g.pendingEffect,undefined);validateSession(JSON.parse(JSON.stringify(g)));
});
test('zero-count Storm remains zero even with a copy replacement on the battlefield',()=>{
 const g=game();enter(g,'Twinning Staff');const source=card('Explore');source.oracle_text='Storm\nDraw a card.';g.players[0].zones.hand.push(source);addMana(g.players[0],{G:1,C:1});castSpell(g,source.instance);resolveTop(g);assert.equal(g.stack.length,1);
});
test('Staff activation pays seven and taps before responses, then copies only its controller legal spell',()=>{
 const g=game(),staff=enter(g,'Twinning Staff'),original=cast(g,'Explore');const ability=activatedAbilities(g,0,staff)[0],before=manaTotals(g.players[0]).C;activateMana(g,staff.instance,ability.id,{targets:['card:'+original.instance]});assert.equal(staff.tapped,true);assert.equal(manaTotals(g.players[0]).C,before-7);assert.equal(g.stack.at(-1).kind,'ability');resolveTop(g);assert.equal(g.stack.filter(e=>e.copy).length,2);
});
test('Staff targeted copies each preserve X and allow separate retargeting across a saved choice',()=>{
 const g=game(3);enter(g,'Twinning Staff');const original=cast(g,'Comet Storm',{x:3,targets:['player:1']});cast(g,'Reverberate',{targets:['card:'+original.instance]});resolveTop(g);assert.equal(g.pendingEffect.step.op,'retargetCopy');resolveOracleChoice(g,['player:2']);validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[]);assert.deepEqual(g.stack.map(e=>e.targets[0].owner),[1,2,1]);resolveTop(g);resolveTop(g);resolveTop(g);assert.deepEqual(g.players.map(p=>p.life),[40,34,37]);
});
test('Fork creates red copies, including extra copies, and they retain all original announcement data',()=>{
 const g=game();enter(g,'Twinning Staff');const original=cast(g,'Growth Spiral');cast(g,'Fork',{targets:['card:'+original.instance]});resolveTop(g);assert.equal(g.stack.filter(e=>e.copy).length,2);assert.deepEqual(g.stack[0].card.colors,['G','U']);for(const copy of g.stack.filter(e=>e.copy))assert.deepEqual(cardFace(copy.card).colors,['R']);
});
test('Doublecast waits for the next qualifying own cast, survives removal, and expires at cleanup',()=>{
 const g=game();cast(g,'Doublecast');resolveTop(g);cast(g,'Sol Ring');resolveTop(g);cast(g,'Growth Spiral',{},1);counterTop(g);cast(g,'Explore');assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.stack.filter(e=>e.copy).length,1);while(g.stack.length)counterTop(g);cast(g,'Explore');assert.equal(g.stack.length,1);counterTop(g);validateSession(JSON.parse(JSON.stringify(g)));changeStep(g,11);assert.equal(g.spellCopyEffects,undefined);
});
test('Bonus Round copies spells for each caster including opponents and does not recursively copy copies',()=>{
 const g=game(3);cast(g,'Bonus Round');resolveTop(g);cast(g,'Growth Spiral',{},1);assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.stack.filter(e=>e.copy).length,1);assert.equal(g.stack[1].owner,1);while(g.stack.length)counterTop(g);cast(g,'Explore');assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.stack.length,2);while(g.stack.length)counterTop(g);changeStep(g,11);assert.equal(g.spellCopyEffects,undefined);
});
test('Harrow sacrifices a chosen own land before any response and a copy does not pay the cost again',()=>{
 const g=game(),land=enter(g,'Forest'),other=enter(g,'Island',1),spell=card('Harrow');g.players[0].zones.hand=[spell];addMana(g.players[0],{G:1,C:2});const before=JSON.stringify(g);assert.equal(spellPayment(g,0,spell,'hand'),null);assert.ok(availableSpellPayment(g,0,spell,'hand'));assert.throws(()=>castSpell(g,spell.instance,{sacrificeIds:[other.instance]}),/pay/);assert.equal(JSON.stringify(g),before);castSpell(g,spell.instance,{sacrificeIds:[land.instance]});assert.ok(g.players[0].zones.graveyard.includes(land));counterTop(g);assert.ok(g.players[0].zones.graveyard.includes(land));assert.equal(manaTotals(g.players[0]).G,0);
 const source=enter(g,'Kalamax, the Stormsire');source.tapped=true;endTurn(g);g.step=3;const sacrifice=enter(g,'Forest');g.players[0].zones.library=[card('Forest'),card('Island'),card('Mountain')];cast(g,'Harrow',{sacrificeIds:[sacrifice.instance]});resolveTop(g);resolveTop(g);resolveTop(g);assert.equal(g.pendingEffect.step.op,'search');const ids=oracleChoiceOptions(g).slice(0,2).map(o=>o.key);resolveOracleChoice(g,ids);assert.ok(ids.every(id=>g.players[0].zones.battlefield.some(c=>c.instance===id&&!c.tapped)));resolveTop(g);resolveOracleChoice(g,[]);assert.equal(g.pendingEffect,undefined);
});
test('Roiling Regrowth sacrifices only on resolution, continues without a land, and searches for tapped basics',()=>{
 for(const hasLand of [true,false]){const g=game(),land=hasLand?enter(g,'Forest'):null;g.players[0].zones.library=[card('Forest'),card('Island'),card('Command Tower')];cast(g,'Roiling Regrowth');if(land)assert.ok(g.players[0].zones.battlefield.includes(land));resolveTop(g);assert.equal(g.pendingEffect.step.op,'sacrificeChoice');resolveOracleChoice(g,land?[land.instance]:[]);assert.equal(g.pendingEffect.step.op,'search');assert.equal(oracleChoiceOptions(g).length,2);const ids=oracleChoiceOptions(g).map(o=>o.key);resolveOracleChoice(g,ids);assert.ok(ids.every(id=>g.players[0].zones.battlefield.some(c=>c.instance===id&&c.tapped)));assert.equal(g.pendingEffect,undefined);}
});
test('Growth Spiral draws before optionally placing a land without using a land play; entry replacements still apply',()=>{
 const g=game(),land=card('Rugged Highlands');g.players[0].zones.library=[land];g.players[0].landsPlayed=1;cast(g,'Growth Spiral');resolveTop(g);assert.ok(g.players[0].zones.hand.includes(land));assert.equal(g.pendingEffect.step.op,'deploy');assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[land.instance]);resolveOracleChoice(g,[land.instance]);assert.equal(land.tapped,true);assert.equal(g.players[0].landsPlayed,1);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].life,41);
});
test('Explore grants a turn land play when it resolves and clears at the next turn',()=>{
 const g=game();g.players[0].landsPlayed=1;g.players[0].zones.library=[card('Forest')];cast(g,'Explore');resolveTop(g);assert.equal(g.players[0].extraLandPlays,1);playLand(g,g.players[0].zones.hand[0].instance);assert.equal(g.players[0].landsPlayed,2);changeStep(g,11);assert.equal(g.players[0].extraLandPlays,0);assert.equal(g.players[0].landsPlayed,2);endTurn(g);g.step=3;endTurn(g);assert.equal(g.players[0].extraLandPlays,0);assert.equal(g.players[0].landsPlayed,0);
});
test('Wilderness Reclamation waits on the end-step stack and untaps only its controller lands',()=>{
 const g=game(),source=enter(g,'Wilderness Reclamation'),land=enter(g,'Forest'),artifact=enter(g,'Sol Ring'),other=enter(g,'Island',1);for(const c of [land,artifact,other])c.tapped=true;changeStep(g,10);assert.equal(g.stack.length,1);assert.equal(land.tapped,true);transfer(g,source.instance,'hand',0);resolveTop(g);assert.equal(land.tapped,false);assert.equal(artifact.tapped,true);assert.equal(other.tapped,true);
});
test('Seedborn Muse is an untap-step static rule for every other player, including face-down permanents',()=>{
 const g=game(3);enter(g,'Seedborn Muse');const land=enter(g,'Forest'),other=enter(g,'Island',1),facedown=enter(g,'Young Pyromancer');facedown.faceDown=true;for(const c of [land,other,facedown])c.tapped=true;endTurn(g);untap(g,1);assert.equal(land.tapped,false);assert.equal(other.tapped,false);assert.equal(facedown.tapped,false);assert.equal(g.stack.length,0);assert.equal(g.turnUntapStamp,g.turn+':'+g.active);
});
test('Rashmi reveals only the top card, permits an immediate lower-value announced cast and preserves reactions',()=>{
 const g=game(3);enter(g,'Rashmi, Eternities Crafter');const revealed=card('Electrodominance'),hidden=card('Forest');g.players[0].zones.library=[revealed,hidden];const original=cast(g,'Harrow',{sacrificeIds:[enter(g,'Forest').instance]});assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.pendingEffect.step.zone,'library');for(const owner of [0,1,2]){const view=projectGame(g,owner);assert.equal(view.players[0].zones.library[0].name,'Electrodominance');assert.equal(view.players[0].zones.library[1].hidden,true);}validateSession(JSON.parse(JSON.stringify(g)));castSpell(g,revealed.instance,{targets:['player:1']});assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,2);assert.equal(g.stack.at(-1).card.instance,revealed.instance);assert.equal(g.players[1].life,40);assert.equal(g.stack[0].card.instance,original.instance);resolveTop(g);assert.equal(g.players[1].life,40);resolveOracleChoice(g,[]);
});
for(const name of ['Forest','Harrow','Opt'])test('Rashmi puts '+name+' into hand when ineligible or declined without revealing the rest of the library',()=>{
 const g=game();enter(g,'Rashmi, Eternities Crafter');const top=card(name);g.players[0].zones.library=[top,card('Island')];cast(g,'Explore');resolveTop(g);if(g.pendingEffect)resolveOracleChoice(g,[]);assert.ok(g.players[0].zones.hand.includes(top));assert.equal(projectGame(g,1).players[0].zones.hand[0].hidden,true);assert.ok(projectGame(g,1).playEvents.some(e=>e.kind==='reveal'&&e.card.name===name));assert.equal(projectGame(g,1).players[0].zones.library[0].hidden,true);
});
test('Rashmi tracks earlier casts before entering and resets separately for all seats on every turn',()=>{
 const g=game();cast(g,'Sol Ring');resolveTop(g);enter(g,'Rashmi, Eternities Crafter');cast(g,'Growth Spiral');assert.equal(g.stack.length,1);counterTop(g);endTurn(g);g.step=3;g.players[0].zones.library=[card('Island')];cast(g,'Growth Spiral');assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);counterTop(g);cast(g,'Growth Spiral',{},1);assert.equal(g.stack.length,1);
});
for(const name of ['Gruul Turf','Simic Growth Chamber','Rugged Highlands','Gruul Guildgate'])test(name+' has its correct entry trigger, tapped entry and distinct printed mana outputs',()=>{
 const g=game(),existing=enter(g,'Forest'),land=enter(g,name);assert.equal(land.tapped,true);if(/Turf|Chamber/.test(name)){resolveTop(g);resolveOracleChoice(g,[existing.instance]);assert.ok(g.players[0].zones.hand.includes(existing));}else if(name==='Rugged Highlands'){resolveTop(g);assert.equal(g.players[0].life,41);}land.tapped=false;const ability=activatedAbilities(g,0,land).find(a=>a.output&&(a.output.colors?.includes('G')||a.output.fixed?.G||a.output.alternatives?.some(c=>c.G)));activateMana(g,land.instance,ability.id,{color:'G',outputIndex:ability.output.alternatives?.findIndex(c=>c.G)});assert.equal(manaTotals(g.players[0]).G,1);assert.equal(manaTotals(g.players[0]).R,name==='Gruul Turf'?1:0);assert.equal(manaTotals(g.players[0]).U,name==='Simic Growth Chamber'?1:0);
});
test('Kalamax shared utility audit reuses only identical full Oracle records with every paragraph already checked',()=>{
 const base=new URL('./fixtures/commander/',import.meta.url),progress=JSON.parse(readFileSync(new URL('checklist-progress.json',base))),ids=['goreclaw_terror_of_qal_sisma','aurelia_the_warleader','arahbo_roar_of_the_world','isshin_two_heavens_as_one','fynn_the_fangbearer','talrand_sky_summoner','mizzix_of_the_izmagnus'];let reused=0;const prior=ids.map(id=>({id,cards:JSON.parse(readFileSync(new URL('oracle/'+id+'.json',base))).cards}));for(const c of records){const source=prior.find(p=>p.cards.some(old=>old.name===c.name&&old.oracle_text===c.oracle_text));if(!source)continue;for(let i=0;i<(c.card_faces||[c]).flatMap(f=>(f.oracle_text||'').split('\n').filter(Boolean)).length;i++)assert.ok(progress[source.id].verified_paragraphs[c.name]?.includes(i),c.name+' '+i);reused++;}assert.ok(reused>=65);for(const name of ['Reverberate','Fork','Doublecast','Bonus Round','Growth Spiral','Explore','Harrow','Roiling Regrowth']){const c=card(name),text=c.oracle_text.replace(/^As an additional cost[^\n]+\n/,'');assert.ok(compileOracleEffect(text),name);}
});

test('copy retargeting can retain an illegal original target while changing another target',()=>{
 const g=game(3),creature=enter(g,'Storm-Kiln Artist',1),original=cast(g,'Comet Storm',{x:3,kicks:1,targets:['card:'+creature.instance,'player:1']});cast(g,'Reverberate',{targets:['card:'+original.instance]});transfer(g,creature.instance,'hand',1);resolveTop(g);assert.equal(g.pendingEffect.step.op,'retargetCopy');resolveOracleChoice(g,['card:'+creature.instance,'player:2']);assert.equal(g.stack.at(-1).targets[0].battlefieldId,original.battlefieldId||g.stack[0].targets[0].battlefieldId);resolveTop(g);assert.equal(g.players[2].life,37);assert.ok(g.players[1].zones.hand.includes(creature));
});

test('Veyran doubles independently with multiple providers and does not multiply delayed nonpermanent triggers',()=>{
 const g=game(),a=enter(g,'Veyran, Voice of Duality'),b=enter(g,'Veyran, Voice of Duality');cast(g,'Doublecast');assert.equal(g.stack.filter(e=>e.source?.instance===a.instance).length,3);assert.equal(g.stack.filter(e=>e.source?.instance===b.instance).length,3);while(g.stack.at(-1).kind==='ability')resolveTop(g);resolveTop(g);cast(g,'Explore');assert.equal(g.stack.filter(e=>e.source?.name==='Doublecast').length,1);assert.equal(g.stack.filter(e=>e.source?.instance===a.instance).length,3);
});

test('Rashmi free casts retain X zero and cannot cast a card at equal or higher resulting mana value',()=>{
 const g=game();enter(g,'Rashmi, Eternities Crafter');const revealed=card('Electrodominance');g.players[0].zones.library=[revealed];cast(g,'Harrow',{sacrificeIds:[enter(g,'Forest').instance]});resolveTop(g);assert.throws(()=>castSpell(g,revealed.instance,{x:1,targets:['player:1']}),/permission|X must/);castSpell(g,revealed.instance,{targets:['player:1']});validateSession(JSON.parse(JSON.stringify(g)));assert.equal(g.stack.at(-1).castX,0);assert.equal(g.stack.at(-1).castFrom,'library');
});

test('sacrifice cost triggers wait until casting has finished, and the cost remains paid if the spell is countered',()=>{
 const g=game(),land=enter(g,'Forest'),observer={instance:'observer',name:'Sacrifice observer',type_line:'Enchantment',oracle_text:'Whenever you sacrifice a land, draw a card.',counters:{}};g.players[0].zones.hand.push(observer);transfer(g,observer.instance,'battlefield',0);cast(g,'Harrow',{sacrificeIds:[land.instance]});assert.deepEqual(g.stack.map(e=>e.card?.name||e.name),['Harrow','Sacrifice observer']);assert.equal(g.deferredTriggers,undefined);assert.equal(g.resolutionInProgress,undefined);validateSession(JSON.parse(JSON.stringify(g)));counterTop(g);counterTop(g);assert.ok(g.players[0].zones.graveyard.includes(land));
});
