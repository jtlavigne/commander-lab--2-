import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,findCard,validateSession,resetGame} from '../engine.mjs';
import {enterPermanents,resolveEntryChoice,resolveCounterChoice,resolveOracleChoice,counterChoiceOptions,applyOracleEffect} from '../oracle-effects.mjs';
import {playLand,chooseEntryLife,chooseEntryTapped,castSpell,resolveTop,activateMana} from '../casting.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {addMana} from '../mana.mjs';
import {createTokenCopies} from '../tokens.mjs';
import {selectEntryChoice,entryChoiceOptions} from '../entry-effects.mjs';
const records=['commander/oracle/atraxa_praetors_voice','playtest-decks/atraxa'].flatMap(file=>JSON.parse(readFileSync(new URL('./fixtures/'+file+'.json',import.meta.url))).cards);
const real=name=>{const record=records.find(c=>c.name===name);assert.ok(record,name);return {...structuredClone(record),instance:crypto.randomUUID(),counters:{}};};
const variable=(extra={})=>({instance:crypto.randomUUID(),name:'Variable entry',type_line:'Creature',power:'0',toughness:'0',counters:{},oracle_text:'This creature enters with that many +1/+1 counters on it.',...extra});
function game(count=2){const g=newGame(count);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
function stage(g,c,owner=0,extra={}){g.players[owner].zones.hand.push(c);enterPermanents(g,{owner,name:c.name,source:{instance:'entry-source',name:'Entry'}},[{id:c.instance,owner,...extra}]);}
function choose(g,operation){const r=counterChoiceOptions(g).find(r=>r.operation===operation);assert.ok(r,operation);resolveCounterChoice(g,r.key);}

test('chosen entry counters precede replacement order, extra counters and entry triggers',()=>{
 let g=game();enter(g,real('Doubling Season'));enter(g,real("Lae'zel, Vlaakith's Champion"));
 const c=variable({oracle_text:'This creature enters with that many +1/+1 counters on it.\nWhen this creature enters, draw a card.'});stage(g,c,0,{entryCounters:{'+1/+1':1}});
 assert.equal(g.pendingEffect.kind,'entry-choice');assert.equal(findCard(g,c.instance).zone,'hand');assert.equal(g.stack.length,0);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveEntryChoice(g,'values',{id:c.instance,values:{'counter:+1/+1':4}});
 assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.pendingEffect.plan.states[0].counters['+1/+1'],5);assert.equal(findCard(g,c.instance).zone,'hand');
 choose(g,'add');assert.equal(findCard(g,c.instance).card.counters['+1/+1'],12);assert.equal(findCard(g,c.instance).card.entryChoices,undefined);assert.equal(g.stack.length,1);validateSession(g);
});

test('a simultaneous batch stays outside the battlefield while controllers choose in active-player order',()=>{
 let g=game(3);g.active=1;const a=variable(),b=variable();g.players[0].zones.hand=[a];g.players[1].zones.hand=[b];
 enterPermanents(g,{owner:0,name:'Batch',source:{instance:'batch',name:'Batch'}},[{id:a.instance,owner:0},{id:b.instance,owner:1}]);
 assert.equal(g.pendingEffect.owner,1);resolveEntryChoice(g,'values',{id:b.instance,values:{'counter:+1/+1':3}});assert.equal(g.pendingEffect.owner,0);assert.equal(g.players[1].zones.battlefield.length,0);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveEntryChoice(g,'values',{id:a.instance,values:{'counter:+1/+1':2}});
 assert.equal(findCard(g,b.instance).card.counters['+1/+1'],3);assert.equal(findCard(g,a.instance).card.counters['+1/+1'],2);assert.equal(g.pendingEffect,undefined);
});

test('a controller can choose another pending permanent without jumping another controller in player order',()=>{
 let g=game(3);g.active=1;const a=variable(),b=variable(),c=variable();g.players[0].zones.hand=[a];g.players[1].zones.hand=[b,c];
 enterPermanents(g,{owner:0,name:'Batch',source:{instance:'batch',name:'Batch'}},[{id:a.instance,owner:0},{id:b.instance,owner:1},{id:c.instance,owner:1}]);
 assert.deepEqual(entryChoiceOptions(g,g.pendingEffect.entries).map(o=>o.card.instance),[b.instance,c.instance]);
 assert.throws(()=>selectEntryChoice(g,a.instance,'values'),/current controller/);selectEntryChoice(g,c.instance,'values');
 assert.equal(g.pendingEffect.entryIndex,2);g=validateSession(JSON.parse(JSON.stringify(g)));resolveEntryChoice(g,'values',{id:c.instance,values:{'counter:+1/+1':5}});
 assert.equal(g.pendingEffect.owner,1);assert.equal(g.pendingEffect.entries[g.pendingEffect.entryIndex].card.instance,b.instance);assert.equal(g.players[1].zones.battlefield.length,0);
 resolveEntryChoice(g,'values',{id:b.instance,values:{'counter:+1/+1':3}});assert.equal(g.pendingEffect.owner,0);resolveEntryChoice(g,'values',{id:a.instance,values:{'counter:+1/+1':2}});
 assert.equal(findCard(g,c.instance).card.counters['+1/+1'],5);assert.equal(findCard(g,b.instance).card.counters['+1/+1'],3);assert.equal(findCard(g,a.instance).card.counters['+1/+1'],2);validateSession(g);
});

test('choosing the second shock payment first spends life once and preserves batch affordability',()=>{
 let g=game();g.players[0].life=3;const a=real('Breeding Pool'),b=real('Hallowed Fountain');g.players[0].zones.hand=[a,b];
 enterPermanents(g,{owner:0,name:'Lands',source:{instance:'lands',name:'Lands'}},[{id:a.instance,owner:0},{id:b.instance,owner:0}]);
 selectEntryChoice(g,b.instance,'life');assert.equal(g.players[0].life,3);g=validateSession(structuredClone(g));chooseEntryLife(g,b.instance,true);assert.equal(g.players[0].life,1);assert.equal(g.players[0].zones.battlefield.length,0);
 assert.throws(()=>chooseEntryLife(g,a.instance,true),/Not enough life/);chooseEntryLife(g,a.instance,false);
 assert.equal(findCard(g,a.instance).card.tapped,true);assert.equal(findCard(g,b.instance).card.tapped,false);assert.equal(g.players[0].life,1);validateSession(g);
});

test('life and condition decisions on one card compose in either order without overriding another tapped reason',()=>{
 for(const lifeFirst of [false,true])for(const pay of [false,true])for(const tapped of [false,true]){
  let g=game();const c=real('Breeding Pool');c.oracle_text+='\nThis land enters tapped unless you control a silver-bordered permanent.';g.players[0].zones.hand=[c];playLand(g,c.instance);
  if(lifeFirst){selectEntryChoice(g,c.instance,'life');chooseEntryLife(g,c.instance,pay);g=validateSession(JSON.parse(JSON.stringify(g)));chooseEntryTapped(g,c.instance,tapped);}
  else{chooseEntryTapped(g,c.instance,tapped);g=validateSession(JSON.parse(JSON.stringify(g)));chooseEntryLife(g,c.instance,pay);}
  assert.equal(findCard(g,c.instance).card.tapped,tapped||!pay);assert.equal(g.players[0].life,pay?38:40);assert.equal(g.pendingEffect,undefined);validateSession(g);
 }
});

test('old pending entries without order or tap-reason metadata remain loadable',()=>{
 let g=game();const c=real('Breeding Pool');g.players[0].zones.hand=[c];playLand(g,c.instance);delete g.pendingEffect.entryKind;delete g.pendingEffect.entries[0].tapState;
 g=validateSession(JSON.parse(JSON.stringify(g)));chooseEntryLife(g,c.instance,true);assert.equal(findCard(g,c.instance).card.tapped,false);assert.equal(g.players[0].life,38);
});

test('variable creature stats are set before entry and available to entry observers',()=>{
 let g=game();const c=variable({power:'*',toughness:'*',oracle_text:'Its power and toughness depend on an unsupported variable.'});stage(g,c);
 assert.equal(findCard(g,c.instance).zone,'hand');g=validateSession(structuredClone(g));resolveEntryChoice(g,'values',{id:c.instance,values:{power:7,toughness:8}});
 const entered=findCard(g,c.instance).card;assert.deepEqual(entered.battlefieldStats,{face:0,power:7,toughness:8});assert.equal(entered.entryChoices,undefined);validateSession(g);
});

test('staged token copies can choose values without entering a temporary hand zone and reset drops the staged token',()=>{
 let g=game();const source=enter(g,variable());source.counters['+1/+1']=8;const [copy]=createTokenCopies(g,0,source);
 assert.equal(g.pendingEffect.kind,'entry-choice');assert.equal(findCard(g,copy.instance),null);assert.equal(g.players[0].zones.hand.length,0);
 assert.equal(resetGame(g).players.flatMap(p=>Object.values(p.zones).flat()).some(c=>c.instance===copy.instance),false);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveEntryChoice(g,'values',{id:copy.instance,values:{'counter:+1/+1':3}});assert.equal(findCard(g,copy.instance).card.counters['+1/+1'],3);assert.equal(g.players[0].zones.hand.length,0);
});

test('noncast X and sunburst entries use zero rather than asking for an invented cast value',()=>{
 for(const oracle_text of ['This creature enters with X +1/+1 counters on it.','Sunburst']){
  const g=game(),c=variable({mana_cost:'{X}{X}',oracle_text});stage(g,c);assert.equal(g.pendingEffect,undefined);assert.equal(findCard(g,c.instance).zone,'graveyard','Zero-toughness entries die after completing the batch');
 }
 const g=game(),c=variable({mana_cost:'{X}{X}',oracle_text:'This creature enters with X +1/+1 counters on it.'});g.players[0].zones.hand.push(c);addMana(g.players[0],{C:6});castSpell(g,c.instance,{x:3});resolveTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(c.counters['+1/+1'],3);
});

test('an undefined text-only X remains a pre-entry choice rather than inheriting zero from an unrelated cast',()=>{
 const g=game(),c=variable({mana_cost:'{3}',oracle_text:'This creature enters with X +1/+1 counters on it.'});g.players[0].zones.hand.push(c);addMana(g.players[0],{C:3});castSpell(g,c.instance);resolveTop(g);
 assert.equal(g.pendingEffect.kind,'entry-choice');assert.equal(findCard(g,c.instance).zone,'stack');resolveEntryChoice(g,'values',{id:c.instance,values:{'counter:+1/+1':4}});assert.equal(c.counters['+1/+1'],4);assert.equal(g.pendingEffect,undefined);
});

test('shock life is paid before entry and once per chosen land across a saved simultaneous batch',()=>{
 let g=game();g.players[0].life=3;const a=real('Breeding Pool'),b=real('Hallowed Fountain');g.players[0].zones.hand=[a,b];
 enterPermanents(g,{owner:0,name:'Lands',source:{instance:'lands',name:'Lands'}},[{id:a.instance,owner:0},{id:b.instance,owner:0}]);
 chooseEntryLife(g,a.instance,true);assert.equal(g.players[0].life,1);assert.equal(g.players[0].zones.battlefield.length,0);assert.equal(g.pendingEffect.entries[0].card.entryLife,undefined);
 g=validateSession(JSON.parse(JSON.stringify(g)));const before=JSON.stringify(g);assert.throws(()=>chooseEntryLife(g,b.instance,true),/Not enough life/);assert.equal(JSON.stringify(g),before);
 chooseEntryLife(g,b.instance,false);assert.equal(g.players[0].life,1);assert.equal(findCard(g,a.instance).card.tapped,false);assert.equal(findCard(g,b.instance).card.tapped,true);assert.equal(findCard(g,a.instance).card.entryLife,undefined);validateSession(g);
});

for(const name of ['Breeding Pool','Hallowed Fountain','Godless Shrine','Overgrown Tomb','Temple Garden','Watery Grave'])test(name+' uses its cached Oracle entry clause before entering, including decline and fresh entry',()=>{
 for(const pay of [false,true]){
  let g=game();const c=real(name);g.players[0].zones.hand=[c];playLand(g,c.instance);assert.equal(g.pendingEffect.kind,'entry-choice');assert.equal(g.players[0].zones.battlefield.length,0);assert.equal(g.players[0].life,40);
  g=validateSession(JSON.parse(JSON.stringify(g)));chooseEntryLife(g,c.instance,pay);const entered=findCard(g,c.instance).card;
  assert.equal(entered.tapped,!pay);assert.equal(g.players[0].life,pay?38:40);assert.equal(g.players[0].landsPlayed,1);assert.equal(entered.entryLife,undefined);assert.equal(g.pendingEffect,undefined);
  assert.throws(()=>chooseEntryLife(g,c.instance,pay),/No life payment/);transfer(g,c.instance,'exile',0);
  enterPermanents(g,{owner:0,name:'Return '+name,source:{instance:'return',name:'Return'}},[{id:c.instance,owner:0}]);assert.equal(g.pendingEffect.kind,'entry-choice');chooseEntryLife(g,c.instance,false);assert.equal(entered.tapped,true);assert.equal(g.players[0].life,pay?38:40);assert.equal(g.players[0].landsPlayed,1);
 }
});

test('unknown conditions resolve before the life choice and cannot override a forced tapped instruction',()=>{
 for(const tapped of [false,true]){
  let g=game();const c=real('Breeding Pool');c.oracle_text+='\nThis land enters tapped unless you control a silver-bordered permanent.';g.players[0].zones.hand=[c];playLand(g,c.instance);
  assert.ok(g.pendingEffect.entries[0].card.entryCondition);assert.throws(()=>chooseEntryLife(g,c.instance,true),/requested decision/);chooseEntryTapped(g,c.instance,tapped);
  assert.equal(g.pendingEffect.kind,'entry-choice');g=validateSession(structuredClone(g));chooseEntryLife(g,c.instance,true);
  assert.equal(findCard(g,c.instance).card.tapped,tapped);assert.equal(g.players[0].life,38);assert.equal(findCard(g,c.instance).card.entryCondition,undefined);
 }
 const g=game(),c=real('Breeding Pool');g.players[0].zones.hand=[c];enterPermanents(g,{owner:0,name:'Forced',source:{instance:'forced',name:'Forced'}},[{id:c.instance,owner:0,entryTapped:true}]);chooseEntryLife(g,c.instance,true);assert.equal(c.tapped,true);
});

test('a search waits for shock life before shuffle and draw, preserving private order across saves',()=>{
 let g=game();const c=real('Breeding Pool'),draw=real('Forest');g.players[0].zones.library=[c,draw];
 applyOracleEffect(g,{owner:0,name:'Search',source:{instance:'search',name:'Search'},text:'Search your library for a land card, put it onto the battlefield tapped, then shuffle. Draw a card.'});
 resolveOracleChoice(g,[c.instance]);assert.equal(g.pendingEffect.kind,'entry-choice');assert.equal(g.players[0].zones.library[0].instance,c.instance);assert.equal(g.players[0].zones.hand.length,0);
 g=validateSession(JSON.parse(JSON.stringify(g)));chooseEntryLife(g,c.instance,false);assert.equal(findCard(g,c.instance).card.tapped,true);assert.equal(g.players[0].zones.hand[0].instance,draw.instance);assert.equal(g.players[0].zones.library.length,0);assert.equal(g.players[0].life,40);
});

test('pre-entry decisions reject wrong card, decision type, missing, extra and invalid values without partial mutation',()=>{
 const g=game(),c=variable();stage(g,c);const before=JSON.stringify(g);
 for(const [kind,answer] of [['life',{id:c.instance,pay:true}],['values',{id:'wrong',values:{'counter:+1/+1':2}}],['values',{id:c.instance,values:{}}],['values',{id:c.instance,values:{'counter:+1/+1':-1}}],['values',{id:c.instance,values:{'counter:+1/+1':2,other:1}}]]){
  assert.throws(()=>resolveEntryChoice(g,kind,answer));assert.equal(JSON.stringify(g),before);
 }
 assert.throws(()=>reduceGameAction(g,{type:'draw'},0),/pre-entry/);assert.throws(()=>activateMana(g,c.instance,'any'),/pre-entry/);
});

test('saved pre-entry states reject invalid controller, selection index, stat and counter payloads',()=>{
 const g=game(),c=variable();stage(g,c);validateSession(structuredClone(g));
 for(const mutate of [p=>p.owner=1,p=>p.entryIndex=99,p=>p.entryKind='other',p=>p.entries[0].tapState.life='yes',p=>p.entries[0].tapState.forced=true,p=>p.entries[0].card.counters.charge=-1,p=>p.entries[0].card.entryLife={amount:-2,forcedTapped:false},p=>p.entries[0].card.battlefieldStats={face:0,power:Infinity},p=>p.entries.push(p.entries[0])]){
  const saved=structuredClone(g);mutate(saved.pendingEffect);assert.throws(()=>validateSession(saved));
 }
});
