import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,findCard,validateSession,changeStep} from '../engine.mjs';
import {applyOracleEffect,resolveOracleChoice,counterChoiceOptions,resolveCounterChoice,enterPermanents} from '../oracle-effects.mjs';
import {resolveTop,activateMana,castSpell} from '../casting.mjs';
import {chooseTriggerTarget} from '../combat-effects.mjs';
import {activatedAbilities,addMana} from '../mana.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const records=['commander/oracle/atraxa_praetors_voice','playtest-decks/atraxa','playtest-decks/jace'].flatMap(file=>JSON.parse(readFileSync(new URL('./fixtures/'+file+'.json',import.meta.url))).cards);
const real=name=>{const c=records.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{}};};
const creature=(name='Visitor')=>({name,instance:crypto.randomUUID(),type_line:'Creature',power:'0',toughness:'0',oracle_text:'This creature enters with two +1/+1 counters on it.',counters:{}});
function game(){const g=newGame(2);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){c=typeof c==='string'?real(c):c;g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
function providers(g,owner=0){enter(g,'Doubling Season',owner);enter(g,"Lae'zel, Vlaakith's Champion",owner);}
function effect(g,text,extra={}){assert.equal(applyOracleEffect(g,{owner:0,name:'Entry test',source:{name:'Entry test',instance:'entry-test'},text,...extra}),true);}
function choose(g,op){const rule=counterChoiceOptions(g).find(r=>r.operation===op);assert.ok(rule,op);resolveCounterChoice(g,rule.key);}

test('library search waits before shuffling or drawing and preserves selected entry identity across saves',()=>{
 let g=game();enter(g,'Doubling Season');enter(g,'Vorinclex, Monstrous Raider',1);const land=real('Blast Zone'),rest=[real('Forest'),real('Island')];g.players[0].zones.library=[land,...rest];
 effect(g,'Search your library for a land card, put it onto the battlefield tapped, then shuffle. Draw a card.');resolveOracleChoice(g,[land.instance]);assert.equal(g.pendingEffect.kind,'counter-choice');assert.deepEqual(g.players[0].zones.library.map(c=>c.instance),[land,...rest].map(c=>c.instance));assert.equal(g.players[0].zones.hand.length,0);
 g=validateSession(structuredClone(g));choose(g,'double');const found=findCard(g,land.instance);assert.equal(found.zone,'battlefield');assert.equal(found.card.counters.charge,1);assert.equal(found.card.tapped,true);assert.equal(g.players[0].zones.hand.length,1);assert.ok(rest.some(c=>c.instance===g.players[0].zones.hand[0].instance));assert.equal(g.players[0].zones.library.length,1);assert.equal(g.pendingEffect,undefined);
});

test('Cultivate keeps its split destinations and forced tapped entry with counter replacement',()=>{
 const g=game();enter(g,'Doubling Season');const a={...real('Forest'),oracle_text:'This land enters with a charge counter on it.'},b=real('Island');g.players[0].zones.library=[a,b];effect(g,real('Cultivate').oracle_text);resolveOracleChoice(g,[a.instance,b.instance]);assert.equal(findCard(g,a.instance).zone,'battlefield');assert.equal(a.counters.charge,2);assert.equal(a.tapped,true);assert.equal(findCard(g,b.instance).zone,'hand');assert.equal(g.players[0].zones.library.length,0);assert.equal(g.pendingEffect,undefined);
});

test('hand deployment is one simultaneous batch and does not use incoming counter providers',()=>{
 let g=game();enter(g,'Doubling Season');enter(g,"Lae'zel, Vlaakith's Champion");const incoming=real('Vorinclex, Monstrous Raider'),a=creature(),b=creature('Second visitor');g.players[0].zones.hand=[incoming,a,b];
 effect(g,'Put any number of creature cards from your hand onto the battlefield. Draw a card.');g.players[0].zones.library=[real('Forest')];resolveOracleChoice(g,[incoming.instance,a.instance,b.instance]);assert.equal(g.pendingEffect.kind,'counter-choice');assert.ok([incoming,a,b].every(c=>findCard(g,c.instance).zone==='hand'));
 g=validateSession(structuredClone(g));choose(g,'add');assert.equal(findCard(g,a.instance).zone,'hand');choose(g,'double');assert.equal(findCard(g,a.instance).card.counters['+1/+1'],6);assert.equal(findCard(g,b.instance).card.counters['+1/+1'],5);assert.equal(findCard(g,incoming.instance).zone,'battlefield');assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.players[0].zones.hand[0].name,'Forest');
});

test('Oath delayed return uses the owner replacement choices after the source leaves',()=>{
 let g=game();providers(g,1);const visitor=enter(g,{...creature(),ownerSeat:1,oracle_text:creature().oracle_text+'\nWhen this creature enters, draw a card.'});visitor.counters['+1/+1']=9;const old=visitor.battlefieldId;g.players[1].zones.library=[real('Forest')];const oath=real('Oath of Teferi');g.players[0].zones.hand.push(oath);transfer(g,oath.instance,'battlefield',0);chooseTriggerTarget(g,g.stack.at(-1).id,['card:'+visitor.instance]);resolveTop(g);transfer(g,oath.instance,'graveyard',0);changeStep(g,10);resolveTop(g);
 assert.equal(g.pendingEffect.owner,1);assert.equal(findCard(g,visitor.instance).zone,'exile');assert.equal(g.players[1].zones.hand.length,0);assert.equal(projectGame(g,0).pendingEffect.kind,'remote-choice');g=validateSession(structuredClone(g));choose(g,'add');const returned=findCard(g,visitor.instance);assert.equal(returned.owner,1);assert.notEqual(returned.card.battlefieldId,old);assert.equal(returned.card.counters['+1/+1'],6);assert.equal(g.stack.length,1);assert.equal(g.stack[0].combatTrigger.event.card.counters['+1/+1'],6);resolveTop(g);assert.equal(g.players[1].zones.hand.length,1);
});

test('Sun Titan optional return uses entering counters and defers its new entry triggers',()=>{
 let g=game();providers(g);const target={...creature(),mana_cost:'{2}',ownerSeat:0,zoneChangeId:'titan-grave',oracle_text:creature().oracle_text+'\nWhen this creature enters, draw a card.'};g.players[0].zones.graveyard=[target];g.players[0].zones.library=[real('Forest')];const titan=real('Sun Titan');g.players[0].zones.hand.push(titan);transfer(g,titan.instance,'battlefield',0);chooseTriggerTarget(g,g.stack.at(-1).id,['card:'+target.instance]);resolveTop(g);assert.equal(g.pendingEffect.step.op,'optional');resolveOracleChoice(g,['yes']);assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(findCard(g,target.instance).zone,'graveyard');g=validateSession(structuredClone(g));choose(g,'double');assert.equal(findCard(g,target.instance).card.counters['+1/+1'],5);assert.equal(g.players[0].zones.hand.length,0);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);
});

test('Proteus Staff preserves its public reveal through entry choices and orders the remainder afterwards',()=>{
 let g=game();providers(g);const staff=enter(g,'Proteus Staff'),victim=enter(g,{...creature('Victim'),power:'1',toughness:'1',oracle_text:''}),hit=creature(),before=[real('Island'),real('Sol Ring')],after=real('Plains');g.players[0].zones.library=[...before,hit,after];addMana(g.players[0],{U:1,C:2});const ability=activatedAbilities(g,0,staff).find(a=>!a.output);activateMana(g,staff.instance,ability.id,{targets:['card:'+victim.instance]});resolveTop(g);assert.equal(g.pendingEffect.step.op,'polymorphReveal');resolveOracleChoice(g,[]);assert.equal(g.pendingEffect.kind,'counter-choice');const view=projectGame(g,1);assert.ok(view.players[0].zones.library.slice(0,3).every(c=>!c.hidden));assert.ok(view.players[0].zones.library.slice(3).every(c=>c.hidden));assert.equal(findCard(g,hit.instance).zone,'library');g=validateSession(structuredClone(g));choose(g,'add');assert.equal(g.pendingEffect.step.op,'orderBottomLibrary');assert.equal(findCard(g,hit.instance).card.counters['+1/+1'],6);resolveOracleChoice(g,before.map(c=>c.instance).reverse());assert.deepEqual(g.players[0].zones.library.map(c=>c.instance),[after.instance,victim.instance,before[1].instance,before[0].instance]);assert.equal(g.pendingEffect,undefined);
});

test('Mass Polymorph batches incoming creatures, excludes their replacement effects and waits to shuffle',()=>{
 let g=game();enter(g,'Doubling Season');enter(g,'Vorinclex, Monstrous Raider',1);enter(g,{...creature('A'),power:'1',toughness:'1',oracle_text:''});enter(g,{...creature('B'),power:'1',toughness:'1',oracle_text:''});const provider=real('Vorinclex, Monstrous Raider'),hit={...creature(),oracle_text:'This creature enters with a +1/+1 counter on it.'},land=real('Island');g.players[0].zones.library=[provider,hit,land];const spell=real('Mass Polymorph');g.players[0].zones.hand=[spell];addMana(g.players[0],{U:1,C:5});castSpell(g,spell.instance);resolveTop(g);resolveOracleChoice(g,[]);assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(findCard(g,provider.instance).zone,'library');assert.deepEqual(g.players[0].zones.library.map(c=>c.instance),[provider,hit,land].map(c=>c.instance));g=validateSession(structuredClone(g));choose(g,'double');assert.equal(findCard(g,hit.instance).card.counters['+1/+1'],1);assert.equal(findCard(g,provider.instance).zone,'battlefield');assert.deepEqual(g.players[0].zones.library.map(c=>c.instance),[land.instance]);assert.equal(findCard(g,spell.instance).zone,'graveyard');
});

test('saved reveal/entry continuations reject malformed remainder and public-reveal references',()=>{
 const g=game();providers(g);g.players[0].zones.library=[real('Island'),creature()];effect(g,'Reveal cards from the top of your library until you reveal one creature card, put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library.');resolveOracleChoice(g,[]);assert.equal(g.pendingEffect.kind,'counter-choice');
 for(const mutate of [p=>p.remaining[0].hits=['unknown'],p=>p.remaining[0].remainder='hand',p=>p.revealed.owner=99,p=>p.revealed.ids=[17]]){const saved=structuredClone(g);mutate(saved.pendingEffect);assert.throws(()=>validateSession(saved));}validateSession(structuredClone(g));
});

test('shuffle-and-reveal entry applies replacements to a fresh incarnation',()=>{
 let g=game();providers(g);const target=enter(g,creature());target.counters['+1/+1']=9;const old=target.battlefieldId;
 effect(g,"The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield.",{targets:[{kind:'card',id:target.instance,owner:0,battlefieldId:old}]});
 assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(findCard(g,target.instance).zone,'library');assert.equal(g.players[0].life,40);g=validateSession(structuredClone(g));choose(g,'add');const returned=findCard(g,target.instance);assert.equal(returned.zone,'battlefield');assert.notEqual(returned.card.battlefieldId,old);assert.equal(returned.card.counters['+1/+1'],6);assert.equal(g.players[0].zones.library.length,0);assert.equal(g.players[0].life,40);assert.equal(g.pendingEffect,undefined);
});

test('simultaneous check lands cannot count another incoming land or its Dryad type grant',()=>{
 for(const reverse of [false,true])for(const incomingDryad of [false,true]){
  const g=game(),land=real('Hinterland Harbor'),other=real(incomingDryad?'Dryad of the Ilysian Grove':'Forest');if(incomingDryad)enter(g,'Command Tower');g.players[0].zones.hand=[land,other];const cards=reverse?[land,other]:[other,land];enterPermanents(g,{owner:0,name:'Simultaneous entry',source:{name:'Batch',instance:'batch'}},cards.map(c=>({id:c.instance,owner:0})));assert.equal(land.tapped,true);
 }
 const g=game();enter(g,'Dryad of the Ilysian Grove');enter(g,'Command Tower');const land=real('Hinterland Harbor');g.players[0].zones.hand=[land];enterPermanents(g,{owner:0,name:'Later entry',source:{name:'Later',instance:'later'}},[{id:land.instance,owner:0}]);assert.equal(land.tapped,false);
});

test('incoming tap replacements do not change batch companions shock-land payment conditions',()=>{
 const g=game(),provider={...creature('Tap provider'),type_line:'Enchantment',oracle_text:'Lands enter tapped.'},land=real('Breeding Pool');g.players[0].zones.hand=[provider,land];enterPermanents(g,{owner:0,name:'Batch',source:{name:'Batch',instance:'batch'}},[provider,land].map(c=>({id:c.instance,owner:0})));assert.equal(land.entryLife.amount,2);assert.equal(land.entryLife.forcedTapped,false);
 const later=real('Breeding Pool');g.players[0].zones.hand=[later];enterPermanents(g,{owner:0,name:'Later',source:{name:'Later',instance:'later'}},[{id:later.instance,owner:0}]);assert.equal(later.entryLife.forcedTapped,true);
});
