import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,changeStep,endTurn} from '../engine.mjs';
import {activateMana,resolveTop,counterTop,passPriority,castSpell} from '../casting.mjs';
import {addMana,activatedAbilities,activationError} from '../mana.mjs';
import {isCreature,combatStats,attackError} from '../creature-rules.mjs';
import {cardFace} from '../card-state.mjs';
import {stateBasedActions} from '../combat.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/goreclaw_terror_of_qal_sisma.json',import.meta.url))).cards;
for(const id of ['goreclaw_terror_of_qal_sisma','aurelia_the_warleader'])test(id+' active Oracle revision contains and plays the colorless Vehicle replacement',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/'+id+'.json',import.meta.url)));assert.equal(fixture.decklist_source,'commander_test_decks_color_fixes.csv');assert.equal(fixture.cards.some(c=>c.name==='Nihil Spellbomb'),false);const h={...structuredClone(fixture.cards.find(c=>c.name==='Unlicensed Hearse')),instance:crypto.randomUUID(),counters:{}};assert.deepEqual(h.color_identity,[]);const g=game();enter(g,h);const p=pilot(g);exile(g,h,graves(g).slice(0,1));activateMana(g,h.instance,'crew:2',{crewIds:[p.instance]});resolveTop(g);assert.equal(combatStats(g,0,h).power,1);
});
const card=name=>({...structuredClone(records.find(c=>c.name===name)),instance:crypto.randomUUID(),counters:{}});
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';return g;};
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);return c;}
const hearse=g=>enter(g,card('Unlicensed Hearse'));
function pilot(g,power=2,owner=0){return enter(g,{instance:crypto.randomUUID(),name:'Pilot',type_line:'Creature',power:String(power),toughness:'3',counters:{}},owner);}
function graves(g,owner=1,n=3){return Array.from({length:n},()=>{const c=card('Forest');g.players[owner].zones.graveyard.push(c);return c;});}
function exile(g,h,targets){activateMana(g,h.instance,'action:0',{targets:targets.map(c=>'card:'+c.instance)});resolveTop(g);}
test('Hearse casts for two, enters as a noncreature with no variable-value prompt, and has one crew ability',()=>{
 const g=game(),h=card('Unlicensed Hearse');g.players[0].zones.hand.push(h);addMana(g.players[0],{C:2});castSpell(g,h.instance);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(isCreature(h),false);assert.equal(h.entryChoices,undefined);assert.equal(h.linkedExileCount,0);pilot(g);assert.deepEqual(activatedAbilities(g,0,h).map(a=>a.id),['own:0','crew:2','action:0'].filter(id=>id!=='own:0'));validateSession(g);
});
test('Hearse announces zero, one or two cards from one graveyard before tapping; invalid drafts pay no cost',()=>{
 for(const count of [0,1,2]){const g=game(),h=hearse(g),cards=graves(g);activateMana(g,h.instance,'action:0',{targets:cards.slice(0,count).map(c=>'card:'+c.instance)});assert.equal(h.tapped,true);assert.equal(g.players[1].zones.exile.length,0);assert.equal(g.stack[0].combatTrigger.targets.length,count);resolveTop(g);assert.equal(g.players[1].zones.exile.length,count);assert.equal(h.linkedExileCount,count);}
 const g=game(),h=hearse(g),a=graves(g),b=graves(g,0);for(const targets of [undefined,a.map(c=>'card:'+c.instance),['card:'+a[0].instance,'card:'+a[0].instance],['card:'+a[0].instance,'card:'+b[0].instance]]){assert.throws(()=>activateMana(g,h.instance,'action:0',{targets}));assert.equal(h.tapped,false);assert.equal(g.stack.length,0);}
});
test('graveyard exile is interruptible and rechecks each target incarnation; a remaining valid target still exiles',()=>{
 const g=game(),h=hearse(g),cards=graves(g);activateMana(g,h.instance,'action:0',{targets:cards.slice(0,2).map(c=>'card:'+c.instance)});transfer(g,cards[0].instance,'hand',1);transfer(g,cards[0].instance,'graveyard',1);passPriority(g,0);assert.equal(g.players[1].zones.exile.length,0);passPriority(g,1);assert.equal(g.players[1].zones.exile.length,1);assert.equal(g.players[1].zones.exile[0],cards[1]);assert.equal(h.linkedExileCount,1);
});
test('exiled-card links update live, cannot survive returning an exiled card, and reset when the Hearse changes zones',()=>{
 const g=game(),h=hearse(g),cards=graves(g);exile(g,h,cards.slice(0,2));pilot(g);activateMana(g,h.instance,'crew:2',{crewIds:g.players[0].zones.battlefield.filter(c=>c.name==='Pilot').map(c=>c.instance)});resolveTop(g);assert.equal(combatStats(g,0,h).power,2);transfer(g,cards[0].instance,'hand',1);assert.equal(combatStats(g,0,h).power,1);transfer(g,cards[0].instance,'exile',1);assert.equal(combatStats(g,0,h).power,1);transfer(g,h.instance,'hand',0);transfer(g,h.instance,'battlefield',0);assert.equal(h.linkedExileCount,0);assert.equal(h.animatedCreature,undefined);assert.equal(h.exileLinks,undefined);
});
test('an exile ability whose source leaves still exiles, without linking the returned permanent',()=>{
 const g=game(),h=hearse(g),cards=graves(g);activateMana(g,h.instance,'action:0',{targets:[cards[0]].map(c=>'card:'+c.instance)});transfer(g,h.instance,'hand',0);transfer(g,h.instance,'battlefield',0);resolveTop(g);assert.equal(g.players[1].zones.exile.length,1);assert.equal(h.linkedExileCount,0);
});
test('crew pays with distinct untapped own creatures, using live power, including summoning-sick pilots',()=>{
 const g=game(),h=hearse(g),one=pilot(g,1),two=pilot(g,1),foreign=pilot(g,5,1);one.counters['+1/+1']=1;const crew=activatedAbilities(g,0,h).find(a=>a.crew===2);assert.equal(activationError(g,0,h,crew),'');for(const ids of [[one.instance,one.instance],[two.instance],[foreign.instance],[h.instance]]){assert.throws(()=>activateMana(g,h.instance,'crew:2',{crewIds:ids}));assert.equal(one.tapped,false);assert.equal(h.animatedCreature,undefined);}
 activateMana(g,h.instance,'crew:2',{crewIds:[one.instance]});assert.equal(one.summoningSick,true);assert.equal(one.tapped,true);assert.equal(one.tapAbility,true);assert.equal(two.tapped,false);assert.equal(h.animatedCreature,undefined);counterTop(g);assert.equal(h.animatedCreature,undefined);assert.equal(one.tapped,true);
});
test('an uncrewed Vehicle can tap on entry; an animated Vehicle has normal sickness and cannot crew itself',()=>{
 const g=game(),h=hearse(g),cards=graves(g);exile(g,h,cards.slice(0,2));h.tapped=false;const p=pilot(g);activateMana(g,h.instance,'crew:2',{crewIds:[p.instance]});resolveTop(g);assert.equal(isCreature(h),true);assert.match(attackError(g,0,h),/sickness/);assert.match(activationError(g,0,h,activatedAbilities(g,0,h).find(a=>a.id==='action:0')),/sickness/);assert.throws(()=>activateMana(g,h.instance,'crew:2',{crewIds:[h.instance]}));
});
test('crewing an empty Hearse makes it 0/0 and state-based actions put it in the graveyard',()=>{
 const g=game(),h=hearse(g),p=pilot(g);activateMana(g,h.instance,'crew:2',{crewIds:[p.instance]});resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(h));assert.equal(g.pendingEffect,undefined);
});
test('normal Vehicles use printed stats, repeated crew works while tapped, and cleanup removes animation and damage',()=>{
 const g=game(),h=enter(g,{instance:'vehicle',name:'Test Vehicle',type_line:'Artifact — Vehicle',power:'4',toughness:'5',oracle_text:'Crew 2',counters:{}}),p=pilot(g,3);h.summoningSick=false;activateMana(g,h.instance,'crew:2',{crewIds:[p.instance]});resolveTop(g);assert.equal(combatStats(g,0,h).power,4);assert.equal(attackError(g,0,h),'');h.tapped=true;const q=pilot(g,2);activateMana(g,h.instance,'crew:2',{crewIds:[q.instance]});resolveTop(g);assert.equal(h.tapped,true);h.markedDamage=2;changeStep(g,11);assert.equal(isCreature(h),false);assert.equal(h.markedDamage,undefined);assert.match(cardFace(h).type_line,/Artifact — Vehicle/);
});
for(const count of [2,3,4])test(count+' seats preserve crew, links and target announcements through shared actions and serialization',()=>{
 let g=game(count),h=hearse(g),p=pilot(g),cards=graves(g);g=reduceAction(g,{type:'activate',id:h.instance,ability:'action:0',choice:{targets:cards.slice(0,2).map(c=>'card:'+c.instance)}},0).game;g=reduceAction(g,{type:'pass'},0).game;for(let seat=1;seat<count;seat++)g=reduceAction(g,{type:'pass'},seat).game;
 g=reduceAction(g,{type:'activate',id:h.instance,ability:'crew:2',choice:{crewIds:[p.instance]}},0).game;assert.doesNotThrow(()=>validateSession(JSON.parse(JSON.stringify(g))));assert.throws(()=>reduceAction(g,{type:'activate',id:h.instance,ability:'crew:2',choice:{crewIds:[p.instance]}},1),/control/);
 for(let seat=0;seat<count;seat++)g=reduceAction(g,{type:'pass'},seat).game;assert.equal(combatStats(g,0,g.players[0].zones.battlefield.find(c=>c.instance===h.instance)).power,2);
});
