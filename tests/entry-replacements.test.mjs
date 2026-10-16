import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,findCard,validateSession,resetGame} from '../engine.mjs';
import {castSpell,resolveTop,passPriority,counterTop} from '../casting.mjs';
import {addMana} from '../mana.mjs';
import {counterChoiceOptions,resolveCounterChoice,enterPermanents} from '../oracle-effects.mjs';
import {preparePermanentEntries} from '../entry-effects.mjs';
import {advanceCounterPlan} from '../counter-effects.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards.concat(JSON.parse(readFileSync(new URL('./fixtures/playtest-decks/atraxa.json',import.meta.url))).cards);
const real=name=>{const c=records.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{}};};
const creature=(name='Construct')=>({name,instance:crypto.randomUUID(),type_line:'Artifact Creature',power:'0',toughness:'0',mana_cost:'{X}',oracle_text:'This creature enters with X +1/+1 counters on it.',counters:{}});
function game(n=2){const g=newGame(n);g.step=3;g.responseMode='hold';return g;}
function enter(g,name,owner=0){const c=typeof name==='string'?real(name):name;g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
function cast(g,c,mana,options={}){g.players[0].zones.hand.push(c);addMana(g.players[0],mana);castSpell(g,c.instance,options);return c;}

for(const [name,mana,base] of [['Tamiyo, Compleated Sage',{C:2,G:1,U:1},5],["Vraska, Betrayal's Sting",{C:4,B:1},6]])for(const first of ['subtract','double'])test(name+' and Doubling Season order is chosen before entry: '+first,()=>{
 const loyalty=first==='subtract'?(base-2)*2:base*2-2;
 let g=game();enter(g,'Doubling Season');const c=cast(g,real(name),mana,{allowLife:true});resolveTop(g);
 assert.equal(findCard(g,c.instance).zone,'stack');assert.equal(g.players[0].life,38);assert.equal(g.pendingEffect.kind,'counter-choice');assert.deepEqual(counterChoiceOptions(g).map(r=>r.operation).sort(),['double','subtract']);assert.throws(()=>passPriority(g,0),/pending effect/);assert.throws(()=>counterTop(g),/pending/);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveCounterChoice(g,counterChoiceOptions(g).find(r=>r.operation===first).key);assert.equal(findCard(g,c.instance).zone,'battlefield');assert.equal(findCard(g,c.instance).card.counters.loyalty,loyalty);assert.equal(g.stack.length,0);assert.equal(g.pendingEffect,undefined);validateSession(g);
});

for(const [provider,seat,expected] of [['Doubling Season',0,8],['Vorinclex, Monstrous Raider',0,8],['Vorinclex, Monstrous Raider',1,2],["Lae'zel, Vlaakith's Champion",0,5],['Winding Constrictor',0,4],['Branching Evolution',0,4]])test(provider+' applies the proper entry scope to a real walker (seat '+seat+')',()=>{
 const g=game();enter(g,provider,seat);const c=cast(g,real('Elspeth, Sun\'s Champion'),{W:3,C:3});resolveTop(g);assert.equal(c.counters.loyalty,expected);assert.equal(g.pendingEffect,undefined);
});

test('countered spells never start entry choices and unrelated life payments do not create compleated replacements',()=>{
 const g=game();enter(g,'Doubling Season');const c=cast(g,real('Tamiyo, Compleated Sage'),{C:2,G:1,U:1},{allowLife:true});counterTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(findCard(g,c.instance).zone,'graveyard');assert.equal(g.players[0].life,38);
 const next=cast(g,real('Tamiyo, Compleated Sage'),{C:2,G:2,U:1});resolveTop(g);assert.equal(next.counters.loyalty,10);assert.equal(g.pendingEffect,undefined);
});

test('X entry counters and effect-added counters form one event before replacement, with no premature 0/0 death',()=>{
 let g=game();enter(g,'Branching Evolution');enter(g,'Winding Constrictor');const c=cast(g,creature(),{C:2},{x:2});resolveTop(g);assert.equal(findCard(g,c.instance).zone,'stack');assert.equal(g.players[0].zones.graveyard.length,0);
 g=validateSession(structuredClone(g));resolveCounterChoice(g,counterChoiceOptions(g).find(r=>r.operation==='add').key);assert.equal(findCard(g,c.instance).card.counters['+1/+1'],6);assert.equal(findCard(g,c.instance).zone,'battlefield');
 const uncast=creature('Return target');g.players[0].zones.graveyard.push(uncast);uncast.oracle_text='This creature enters with two +1/+1 counters on it.';enterPermanents(g,{owner:0,name:'Return',source:{name:'Return',instance:'return'}},[{id:uncast.instance,owner:0,entryCounters:{'+1/+1':1},entryTapped:true}]);resolveCounterChoice(g,counterChoiceOptions(g).find(r=>r.operation==='double').key);assert.equal(uncast.counters['+1/+1'],7);assert.equal(uncast.tapped,true);
});

test('sunburst and multikicker use their recorded casting choices before entry replacement',()=>{
 const g=game();enter(g,'Doubling Season');const sun=cast(g,{...creature('Sunburst'),type_line:'Artifact',mana_cost:'{3}',oracle_text:'Sunburst'},{W:1,U:1,C:1});resolveTop(g);assert.equal(sun.counters.charge,4);
 const chalice=cast(g,real('Everflowing Chalice'),{C:4},{kicks:2});resolveTop(g);assert.equal(chalice.counters.charge,4);
});

test('entry triggers see the final counts and cannot respond during the replacement choice',()=>{
 let g=game();enter(g,'Vorinclex, Monstrous Raider');enter(g,"Lae'zel, Vlaakith's Champion");enter(g,{name:'Observer',instance:'observer',type_line:'Enchantment',oracle_text:'Whenever a creature you control enters, draw a card.',counters:{}});g.players[0].zones.library=[{...real('Forest'),instance:'draw'}];
 const c=cast(g,creature(),{C:2},{x:2});resolveTop(g);assert.equal(g.stack.length,1);assert.equal(g.stack[0].card.instance,c.instance);assert.equal(g.players[0].zones.hand.length,0);
 g=validateSession(structuredClone(g));resolveCounterChoice(g,counterChoiceOptions(g).find(r=>r.operation==='add').key);assert.equal(g.stack.length,1);assert.equal(g.stack[0].kind,'ability');assert.equal(g.stack[0].combatTrigger.event.card.counters['+1/+1'],6);resolveTop(g);assert.equal(g.players[0].zones.hand[0].instance,'draw');
});

test('a simultaneous incoming provider does not replace its own or its batch companions entry counters',()=>{
 const g=game(),constrictor=real('Winding Constrictor'),c=creature();c.oracle_text='This creature enters with two +1/+1 counters on it.';g.players[0].zones.hand.push(constrictor,c);
 enterPermanents(g,{owner:0,name:'Batch',source:{instance:'batch',name:'Batch'}},[{id:constrictor.instance,owner:0,entryCounters:{'+1/+1':1}},{id:c.instance,owner:0}]);assert.equal(constrictor.counters['+1/+1'],1);assert.equal(c.counters['+1/+1'],2);
 const next=creature('Later');next.oracle_text=c.oracle_text;cast(g,next,{C:1},{x:1});resolveTop(g);assert.equal(next.counters['+1/+1'],3);
});

test('prospective entry batches are mutation-free and replacement choices use APNAP controller order',()=>{
 const g=game(3);enter(g,'Doubling Season',0);enter(g,'Doubling Season',1);enter(g,"Lae'zel, Vlaakith's Champion",0);enter(g,"Lae'zel, Vlaakith's Champion",1);g.active=1;
 const a=real('Elspeth, Sun\'s Champion'),b=real('Tamiyo, Field Researcher');g.players[0].zones.hand.push(a);g.players[1].zones.hand.push(b);const before=structuredClone(g),batch=preparePermanentEntries(g,[{id:a.instance,owner:0},{id:b.instance,owner:1}]);assert.deepEqual(g,before);assert.equal(advanceCounterPlan(batch.plan).owner,1);
 enterPermanents(g,{owner:0,name:'Batch',source:{instance:'batch',name:'Batch'}},[{id:a.instance,owner:0},{id:b.instance,owner:1}]);assert.equal(g.pendingEffect.owner,1);resolveCounterChoice(g,counterChoiceOptions(g).find(r=>r.operation==='add').key);assert.equal(g.pendingEffect.owner,0);assert.equal(findCard(g,a.instance).zone,'hand');assert.equal(findCard(g,b.instance).zone,'hand');resolveCounterChoice(g,counterChoiceOptions(g).find(r=>r.operation==='double').key);assert.equal(a.counters.loyalty,9);assert.equal(b.counters.loyalty,10);
});

test('saved entry plans reject invalid reductions, mismatched identities and foreign choices; reset discards the plan',()=>{
 const g=game();enter(g,'Doubling Season');const c=cast(g,real('Tamiyo, Compleated Sage'),{C:2,G:1,U:1},{allowLife:true});resolveTop(g);const key=counterChoiceOptions(g)[0].key;assert.throws(()=>reduceAction(g,{type:'counterChoice',key},1));
 for(const change of [x=>x.pendingEffect.plan.states[0].providers.find(r=>r.operation==='subtract').amount=-2,x=>x.pendingEffect.entryRequests[0].id='wrong',x=>x.pendingEffect.entryRequests[0].owner=99]){const bad=structuredClone(g);change(bad);assert.throws(()=>validateSession(bad));}
 const fresh=resetGame(g);assert.equal(fresh.pendingEffect,undefined);assert.equal(fresh.stack.length,0);assert.ok(Object.values(fresh.players[0].zones).flat().some(card=>card.instance===c.instance));
});

test('entry counter triggers fire once with final amounts and wait until the permanent has entered',()=>{
 const g=game();enter(g,'Branching Evolution');const c=creature('Counter observer');c.oracle_text+='\nWhenever one or more +1/+1 counters are put on this creature, draw a card.';g.players[0].zones.library=[{...real('Forest'),instance:'counter-draw'}];cast(g,c,{C:3},{x:3});resolveTop(g);assert.equal(c.counters['+1/+1'],6);assert.equal(g.stack.length,1);assert.equal(g.stack[0].combatTrigger.event.counters['+1/+1'],6);assert.equal(g.players[0].zones.hand.length,0);resolveTop(g);assert.equal(g.players[0].zones.hand[0].instance,'counter-draw');
});

for(const [first,loyalty,zone] of [['half',0,'graveyard'],['subtract',1,'battlefield']])test('opposing Vorinclex and compleated respect order and zero-loyalty state actions: '+first,()=>{
 const g=game();enter(g,'Vorinclex, Monstrous Raider',1);const c=cast(g,real('Tamiyo, Compleated Sage'),{C:2,G:1,U:1},{allowLife:true});resolveTop(g);assert.equal(findCard(g,c.instance).zone,'stack');resolveCounterChoice(g,counterChoiceOptions(g).find(r=>r.operation===first).key);assert.equal(findCard(g,c.instance).zone,zone);assert.equal(c.counters.loyalty||0,loyalty);assert.equal(g.pendingEffect,undefined);
});
