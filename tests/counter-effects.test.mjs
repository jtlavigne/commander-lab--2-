import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,changeStep} from '../engine.mjs';
import {castSpell,resolveTop,resolveProliferate,counterTop,activateLoyaltyAction,activateManaLoyalty,passPriority} from '../casting.mjs';
import {loyaltyStatus,availableLoyaltyAbilities} from '../planeswalker.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {addMana} from '../mana.mjs';
import {chooseTriggerTarget} from '../combat-effects.mjs';
import {keywordSet} from '../creature-rules.mjs';
import {counterChoiceOptions,resolveCounterChoice} from '../oracle-effects.mjs';
import {createCounterPlan,advanceCounterPlan,commitCounterPlan,permanentCounterEvent,playerCounterEvent,validateCounterPlan} from '../counter-effects.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';

const atraxa=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards;
const fynn=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/fynn_the_fangbearer.json',import.meta.url))).cards;
const examples=JSON.parse(readFileSync(new URL('./fixtures/spell-resolution.json',import.meta.url))).cards;
const card=name=>{const found=[...atraxa,...fynn,...examples].find(c=>c.name===name);assert.ok(found,name);return {...structuredClone(found),instance:crypto.randomUUID(),counters:{}};};
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';return g;};
function enter(g,name,owner=0){const c=typeof name==='string'?card(name):name;g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);return c;}
const permanent=(g,type='Creature',owner=0)=>enter(g,{instance:crypto.randomUUID(),name:'Recipient',type_line:type,power:'2',toughness:'2',oracle_text:'',counters:{}},owner);
function place(g,actor,target,counters,cause='effect'){const plan=createCounterPlan(g,[typeof target==='number'?playerCounterEvent(actor,target,counters,cause):permanentCounterEvent(g,actor,target.instance,counters,cause)]);assert.equal(advanceCounterPlan(plan),null);commitCounterPlan(g,plan);return plan;}
function cast(g,name,targets=[]){const c=card(name);g.players[0].zones.hand.push(c);addMana(g.players[0],{W:10,U:10,B:10,R:10,G:10,C:10});castSpell(g,c.instance,{targets});return c;}
const deck=g=>{g.players[0].zones.library=Array.from({length:8},()=>({...card('Forest'),instance:crypto.randomUUID()}));};

test('Atraxa cache contains 88 Oracle records and all 100 supplied copies',()=>{assert.equal(atraxa.length,88);assert.equal(atraxa.reduce((n,c)=>n+c.quantity,0),100);});

// These providers enter after the walker: these cases isolate activation costs,
// while the separate pre-entry replacement integration remains outstanding.
for(const [provider,owner,added] of [['Doubling Season',0,1],['Vorinclex, Monstrous Raider',0,2],['Vorinclex, Monstrous Raider',1,0],["Lae'zel, Vlaakith's Champion",0,2]])test(provider+' modifies a real loyalty activation cost only when applicable (seat '+owner+')',()=>{
 const g=game(),walker=enter(g,'Elspeth, Sun\'s Champion'),before=walker.counters.loyalty;enter(g,provider,owner);activateLoyaltyAction(g,walker.instance,0);
 assert.equal(walker.counters.loyalty,before+added);assert.equal(loyaltyStatus(g,0,walker).used,1);assert.equal(g.stack.length,1);assert.equal(g.pendingEffect,undefined);
 assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,0,'Activation has not resolved');counterTop(g);assert.equal(walker.counters.loyalty,before+added,'Countering does not refund activation costs');
});

test('another replacement makes a positive loyalty cost eligible for Doubling Season',()=>{
 const g=game(),walker=enter(g,"Elspeth, Sun's Champion"),before=walker.counters.loyalty;enter(g,'Doubling Season');enter(g,"Lae'zel, Vlaakith's Champion");activateLoyaltyAction(g,walker.instance,0);assert.equal(walker.counters.loyalty,before+4);assert.equal(g.pendingEffect,undefined);
});

for(const first of ['add','double'])test('loyalty cost replacement order persists before response priority: '+first,()=>{
 let g=game();const walker=enter(g,"Elspeth, Sun's Champion"),id=walker.instance,before=walker.counters.loyalty;enter(g,'Vorinclex, Monstrous Raider');enter(g,"Lae'zel, Vlaakith's Champion");
 g=reduceGameAction(g,{type:'loyalty',id,index:0},0).game;
 assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.pendingEffect.owner,0);assert.equal(g.stack.length,1);assert.equal(g.players[0].zones.battlefield.find(c=>c.instance===id).counters.loyalty,before);
 assert.throws(()=>passPriority(g,0),/pending effect/);assert.throws(()=>reduceGameAction(g,{type:'loyalty',id,index:0},0),/replacement choices/);
 g=validateSession(JSON.parse(JSON.stringify(g)));const key=counterChoiceOptions(g).find(r=>r.operation===first).key;
 g=reduceGameAction(g,{type:'counterChoice',key},0).game;assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,1);const current=g.players[0].zones.battlefield.find(c=>c.instance===id);assert.equal(current.counters.loyalty,before+(first==='add'?4:3));assert.equal(loyaltyStatus(g,0,current).used,1);
 resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,3,'Elspeth resolves only after paying and passing priority');
});

test('spending the last loyalty counter removes the walker but keeps its ability on the stack',()=>{
 const g=game(),walker=enter(g,"Elspeth, Sun's Champion");walker.counters.loyalty=3;activateLoyaltyAction(g,walker.instance,1);
 assert.equal(g.players[0].zones.battlefield.includes(walker),false);assert.ok(g.players[0].zones.graveyard.some(c=>c.instance===walker.instance));assert.equal(g.stack.length,1);assert.equal(g.stack[0].source.instance,walker.instance);assert.equal(g.stack[0].source.counters.loyalty,0);resolveTop(g);assert.equal(g.stack.length,0);
});

test('negative and zero loyalty costs do not run counter-placement replacements',()=>{
 const g=game(),walker=enter(g,'Vraska, Betrayal\'s Sting'),before=walker.counters.loyalty;enter(g,'Vorinclex, Monstrous Raider');enter(g,"Lae'zel, Vlaakith's Champion");activateLoyaltyAction(g,walker.instance,0);assert.equal(walker.counters.loyalty,before);assert.equal(g.pendingEffect,undefined);counterTop(g);
 const elspeth=enter(g,"Elspeth, Sun's Champion");const prior=elspeth.counters.loyalty;activateLoyaltyAction(g,elspeth.instance,1);assert.equal(elspeth.counters.loyalty,prior-3);assert.equal(g.pendingEffect,undefined);
});

test('failed negative loyalty costs leave counters, activation allowance and stack unchanged',()=>{
 const g=game(),walker=enter(g,"Elspeth, Sun's Champion");enter(g,'Vorinclex, Monstrous Raider');const before=structuredClone(g);assert.throws(()=>reduceGameAction(g,{type:'loyalty',id:walker.instance,index:2},0),/Not enough loyalty/);assert.deepEqual(g,before);
});

test('mana-producing loyalty abilities pay replaced costs now and produce mana only on resolution',()=>{
 const g=game(),walker=enter(g,{instance:'mana-walker',name:'Mana walker',type_line:'Planeswalker',loyalty:'3',oracle_text:'+2: Add {G}{G}{G}.',counters:{}});enter(g,'Vorinclex, Monstrous Raider');activateManaLoyalty(g,walker.instance,0);assert.equal(walker.counters.loyalty,7);assert.deepEqual(g.players[0].mana,[]);assert.equal(g.stack[0].kind,'mana');resolveTop(g);assert.equal(g.players[0].mana.reduce((sum,l)=>sum+l.amount,0),3);
});

test('granted creature loyalty uses the same replacement costs and variable X stays announced X',()=>{
 const g=game(),creature=permanent(g);enter(g,{instance:'grant',name:'Grant',type_line:'Enchantment',oracle_text:'Creatures you control have "+X: Draw X cards."',counters:{}});enter(g,'Winding Constrictor');enter(g,'Vorinclex, Monstrous Raider');const ability=availableLoyaltyAbilities(g,0,creature)[0];activateLoyaltyAction(g,creature.instance,ability.key,2);assert.equal(g.pendingEffect.kind,'counter-choice');resolveCounterChoice(g,counterChoiceOptions(g).find(r=>r.operation==='add').key);assert.equal(creature.counters.loyalty,6);assert.equal(g.stack[0].castX,2);
});

test('Doubling Season doubles each counter kind on controlled permanents, not players or opposing permanents',()=>{
 const g=game(),own=permanent(g,'Planeswalker'),other=permanent(g,'Creature',1);enter(g,'Doubling Season');place(g,0,own,{loyalty:2,charge:1});place(g,0,other,{charge:1});place(g,0,0,{energy:1});assert.deepEqual(own.counters,{loyalty:4,charge:2});assert.equal(other.counters.charge,1);assert.equal(g.players[0].counters.energy,1);
});

test('Branching Evolution doubles only creature +1/+1 counters',()=>{
 const g=game(),creature=permanent(g),artifact=permanent(g,'Artifact');enter(g,'Branching Evolution');place(g,0,creature,{'+1/+1':2,charge:1,'-1/-1':1});place(g,0,artifact,{'+1/+1':1});assert.deepEqual(creature.counters,{'+1/+1':4,charge:1,'-1/-1':1});assert.equal(artifact.counters['+1/+1'],1);
});

test('Winding Constrictor adds one per kind on controlled artifacts/creatures and on its player',()=>{
 const g=game(),artifact=permanent(g,'Artifact'),walker=permanent(g,'Planeswalker'),enemy=permanent(g,'Creature',1);enter(g,'Winding Constrictor');place(g,1,artifact,{charge:3,oil:1});place(g,0,walker,{loyalty:1});place(g,0,0,{poison:1,energy:2});place(g,0,enemy,{charge:1});assert.deepEqual(artifact.counters,{charge:4,oil:2});assert.equal(walker.counters.loyalty,1);assert.equal(g.players[0].poison,2);assert.equal(g.players[0].counters.energy,3);assert.equal(enemy.counters.charge,1);
});

test("Lae'zel requires its controller to put counters on their own creature, planeswalker or player",()=>{
 const g=game(),own=permanent(g),walker=permanent(g,'Planeswalker'),artifact=permanent(g,'Artifact'),enemy=permanent(g,'Creature',1);enter(g,"Lae'zel, Vlaakith's Champion");place(g,0,own,{'+1/+1':1});place(g,1,walker,{loyalty:1});place(g,0,artifact,{charge:1});place(g,0,enemy,{'+1/+1':1});place(g,0,0,{energy:1});assert.equal(own.counters['+1/+1'],2);assert.equal(walker.counters.loyalty,1);assert.equal(artifact.counters.charge,1);assert.equal(enemy.counters['+1/+1'],1);assert.equal(g.players[0].counters.energy,2);
});

test('Vorinclex follows the placing player, including counters placed on opponents',()=>{
 const g=game(),own=permanent(g),enemy=permanent(g,'Creature',1);enter(g,'Vorinclex, Monstrous Raider');place(g,0,enemy,{'+1/+1':2});place(g,1,own,{charge:3});place(g,0,1,{poison:2});place(g,1,0,{poison:3});assert.equal(enemy.counters['+1/+1'],4);assert.equal(own.counters.charge,1);assert.equal(g.players[1].poison,4);assert.equal(g.players[0].poison,1);
});

for(const first of ['double','half'])test('the affected opponent orders competing Vorinclex replacements, '+first+' first',()=>{
 const g=game(),target=permanent(g,'Creature',1);enter(g,'Vorinclex, Monstrous Raider');enter(g,'Vorinclex, Monstrous Raider',1);const plan=createCounterPlan(g,[permanentCounterEvent(g,0,target.instance,{charge:1})]),choice=advanceCounterPlan(plan);assert.equal(choice.owner,1);assert.equal(target.counters.charge,undefined);assert.equal(advanceCounterPlan(plan,choice.options.find(r=>r.operation===first).key),null);commitCounterPlan(g,plan);assert.equal(target.counters.charge||0,first==='double'?1:0);
});

for(const first of ['double','add'])test('noncommuting replacement order changes the result, '+first+' first',()=>{
 const g=game(),target=permanent(g);enter(g,'Doubling Season');enter(g,'Winding Constrictor');const plan=createCounterPlan(g,[permanentCounterEvent(g,0,target.instance,{'+1/+1':1})]),choice=advanceCounterPlan(plan);assert.equal(choice.owner,0);assert.equal(advanceCounterPlan(plan,choice.options.find(r=>r.operation===first).key),null);commitCounterPlan(g,plan);assert.equal(target.counters['+1/+1'],first==='double'?3:4);assert.equal(new Set(plan.states[0].applied).size,2);
});

test('independent doublers commute and each source modifies the event only once',()=>{
 const g=game(),target=permanent(g);enter(g,'Doubling Season');enter(g,'Doubling Season');enter(g,'Branching Evolution');place(g,0,target,{'+1/+1':1,charge:1});assert.deepEqual(target.counters,{'+1/+1':8,charge:4});
});

test('counter plans distinguish effect placement from a cost and reevaluate after a replacement',()=>{
 const g=game(),target=permanent(g,'Planeswalker');enter(g,'Doubling Season');place(g,0,target,{loyalty:1},'cost');assert.equal(target.counters.loyalty,1);enter(g,'Vorinclex, Monstrous Raider');place(g,0,target,{loyalty:1},'cost');assert.equal(target.counters.loyalty,5,'Vorinclex replacement makes the newly placed counters an effect under CR 614.16');
});

test('live provider text survives renaming; face-down and departed providers stop applying',()=>{
 const g=game(),target=permanent(g),provider=enter(g,{...card('Branching Evolution'),name:'Renamed provider'});place(g,0,target,{'+1/+1':1});provider.faceDown=true;place(g,0,target,{'+1/+1':1});provider.faceDown=false;transfer(g,provider.instance,'graveyard',0);place(g,0,target,{'+1/+1':1});assert.equal(target.counters['+1/+1'],4);
});

test('replacement choices are ordered by affected seats in APNAP order and saved without committing early',()=>{
 const g=game(3);g.active=1;const a=permanent(g,'Creature',0),b=permanent(g,'Creature',1);for(const owner of [0,1]){enter(g,'Doubling Season',owner);enter(g,'Winding Constrictor',owner);}const plan=createCounterPlan(g,[permanentCounterEvent(g,2,a.instance,{charge:1}),permanentCounterEvent(g,2,b.instance,{charge:1})]);let choice=advanceCounterPlan(plan);assert.equal(choice.owner,1);validateCounterPlan(JSON.parse(JSON.stringify(plan)),()=>{throw Error('Invalid plan');},3);choice=advanceCounterPlan(plan,choice.options.find(r=>r.operation==='double').key);assert.equal(choice.owner,0);assert.equal(a.counters.charge,undefined);assert.equal(b.counters.charge,undefined);assert.equal(advanceCounterPlan(plan,choice.options.find(r=>r.operation==='add').key),null);commitCounterPlan(g,plan);assert.equal(a.counters.charge,4);assert.equal(b.counters.charge,3);
});

test('stale battlefield identities cannot receive planned counters after leaving and returning',()=>{
 const g=game(),target=permanent(g),event=permanentCounterEvent(g,0,target.instance,{charge:2}),plan=createCounterPlan(g,[event]);advanceCounterPlan(plan);transfer(g,target.instance,'hand',0);transfer(g,target.instance,'battlefield',0);commitCounterPlan(g,plan);assert.equal(target.counters.charge,undefined);assert.throws(()=>createCounterPlan(g,[event]),/no longer/);
});

test('counter plan limits are checked before committing any recipients',()=>{
 const g=game(),a=permanent(g),b=permanent(g);b.counters.charge=999999;const plan=createCounterPlan(g,[permanentCounterEvent(g,0,a.instance,{charge:1}),permanentCounterEvent(g,0,b.instance,{charge:1})]);advanceCounterPlan(plan);assert.throws(()=>commitCounterPlan(g,plan),/too large/);assert.equal(a.counters.charge,undefined);assert.equal(b.counters.charge,999999);for(const actor of ['0',-1,1.5])assert.throws(()=>createCounterPlan(g,[playerCounterEvent(actor,0,{poison:1})]),/Invalid counter/);
});

test('cannot-get-counter effects take precedence over replacements',()=>{
 const g=game();enter(g,'Vorinclex, Monstrous Raider',1);enter(g,{instance:crypto.randomUUID(),name:'Counter prohibition',type_line:'Enchantment',oracle_text:"You can't get poison counters.",counters:{}});place(g,1,0,{poison:2,energy:1});assert.equal(g.players[0].poison,0);assert.equal(g.players[0].counters.energy,2);
});

test('Contentious Plan with Tekuthal finishes two independent proliferates before drawing once',()=>{
 const g=game(),a=permanent(g),b=permanent(g);deck(g);a.counters.charge=1;b.counters.oil=1;enter(g,'Tekuthal, Inquiry Dominus');const spell=cast(g,'Contentious Plan');resolveTop(g);assert.equal(g.pendingEffect.kind,'proliferate');resolveProliferate(g,[a.instance]);assert.equal(g.pendingEffect.kind,'proliferate');assert.equal(g.players[0].zones.hand.length,0);assert.ok(g.stack.some(e=>e.card?.instance===spell.instance));resolveProliferate(g,[b.instance]);assert.equal(a.counters.charge,2);assert.equal(b.counters.oil,2);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,0);validateSession(JSON.parse(JSON.stringify(g)));
});

test('multiple proliferate replacements apply once each rather than recursively expanding',()=>{
 const g=game(),target=permanent(g);deck(g);target.counters.charge=1;enter(g,'Tekuthal, Inquiry Dominus');enter(g,'Tekuthal, Inquiry Dominus');cast(g,'Contentious Plan');resolveTop(g);for(let n=0;n<4;n++){assert.equal(g.pendingEffect.kind,'proliferate');resolveProliferate(g,n%2?[target.instance]:[]);}assert.equal(g.pendingEffect,undefined);assert.equal(target.counters.charge,3);assert.equal(g.players[0].zones.hand.length,1);
});

test('proliferate gives every positive kind, includes non-poison player counters, and does not target',()=>{
 const g=game(),target=permanent(g);deck(g);target.counters={charge:1,oil:2,loyalty:0};target.temporaryKeywords=['shroud'];g.players[1].poison=1;g.players[1].counters={energy:3,experience:1};cast(g,'Contentious Plan');resolveTop(g);resolveProliferate(g,[target.instance],[1]);assert.deepEqual(target.counters,{charge:2,oil:3,loyalty:0});assert.equal(g.players[1].poison,2);assert.deepEqual(g.players[1].counters,{energy:4,experience:2});assert.equal(g.players[0].counters,undefined);
});

test('a resolving counter spell waits for its replacement choice before granting keywords or finishing',()=>{
 const g=game(),target=permanent(g);enter(g,'Doubling Season');enter(g,'Winding Constrictor');const spell=cast(g,'Snakeskin Veil',['card:'+target.instance]);resolveTop(g);assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(keywordSet(g,0,target).has('hexproof'),false);assert.equal(target.counters['+1/+1'],undefined);validateSession(JSON.parse(JSON.stringify(g)));assert.throws(()=>reduceAction(g,{type:'pass'},0),/replacement choices/);const rule=counterChoiceOptions(g).find(r=>r.operation==='add');resolveCounterChoice(g,rule.key);assert.equal(target.counters['+1/+1'],4);assert.equal(keywordSet(g,0,target).has('hexproof'),true);assert.ok(g.players[0].zones.graveyard.some(c=>c.instance===spell.instance));assert.equal(g.pendingEffect,undefined);
});

test('opponents choose replacements for their counters without receiving the other private state',()=>{
 const g=game(3);deck(g);enter(g,'Vorinclex, Monstrous Raider');enter(g,'Winding Constrictor',1);const spell=cast(g,'Prologue to Phyresis');resolveTop(g);assert.equal(g.pendingEffect.owner,1);assert.equal(g.players[1].poison,0);assert.equal(g.players[2].poison,0);assert.equal(projectGame(g,0).pendingEffect.kind,'remote-choice');assert.throws(()=>reduceAction(g,{type:'counterChoice',key:counterChoiceOptions(g)[0].key},0),/choosing/);const next=reduceAction(g,{type:'counterChoice',key:counterChoiceOptions(g).find(r=>r.operation==='add').key},1).game;assert.equal(next.players[1].poison,4);assert.equal(next.players[2].poison,2);assert.equal(next.players[0].zones.hand.length,1);assert.ok(next.players[0].zones.graveyard.some(c=>c.instance===spell.instance));
});

test('Deepglow Skate targets any number of permanents and doubles live counts by placing additional counters',()=>{
 const g=game(),a=permanent(g),b=permanent(g,'Artifact',1),empty=permanent(g,'Land');a.counters={'+1/+1':2,charge:1};b.counters={oil:3};enter(g,'Doubling Season');enter(g,'Deepglow Skate');chooseTriggerTarget(g,g.stack.at(-1).id,[a,b,empty].map(c=>'card:'+c.instance));a.counters.charge=4;resolveTop(g);assert.deepEqual(a.counters,{'+1/+1':6,charge:12});assert.equal(b.counters.oil,6);assert.deepEqual(empty.counters,{});assert.equal(g.pendingEffect,undefined);validateSession(JSON.parse(JSON.stringify(g)));
});

test('Deepglow zero targets is legal and stale chosen permanents are excluded at resolution',()=>{
 const g=game(),a=permanent(g),b=permanent(g);a.counters.charge=2;b.counters.oil=1;enter(g,'Deepglow Skate');chooseTriggerTarget(g,g.stack.at(-1).id,[a,b].map(c=>'card:'+c.instance));transfer(g,a.instance,'hand',0);transfer(g,a.instance,'battlefield',0);a.counters.charge=3;resolveTop(g);assert.equal(a.counters.charge,3);assert.equal(b.counters.oil,2);enter(g,'Deepglow Skate');chooseTriggerTarget(g,g.stack.at(-1).id,[]);resolveTop(g);assert.equal(b.counters.oil,2);assert.equal(g.pendingEffect,undefined);
});

test('Atraxa end-step and cast-trigger proliferates use response-gated shared resolution',()=>{
 const g=game(),target=permanent(g);deck(g);target.counters.charge=1;enter(g,"Atraxa, Praetors' Voice");changeStep(g,10);assert.equal(target.counters.charge,1);assert.equal(g.stack.length,1);resolveTop(g);resolveProliferate(g,[target.instance]);assert.equal(target.counters.charge,2);g.step=3;enter(g,'Flux Channeler');enter(g,'Inexorable Tide');cast(g,'Contentious Plan');assert.equal(g.stack.length,3);counterTop(g);assert.equal(target.counters.charge,2);resolveTop(g);resolveProliferate(g,[target.instance]);assert.equal(target.counters.charge,3);resolveTop(g);resolveProliferate(g,[target.instance]);assert.equal(target.counters.charge,4);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.pendingEffect,undefined);
});
