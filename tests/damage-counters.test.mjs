import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,findCard,changeStep,validateSession} from '../engine.mjs';
import {setAttacker,confirmAttackers,setBlocker,confirmBlockers,applyCombatDamage,previewCombat,dealDamagePackets,stateBasedActions,cleanTurnDamage} from '../combat.mjs';
import {counterChoiceOptions,resolveCounterChoice,applyOracleEffect} from '../oracle-effects.mjs';
import {keywordTotal,combatStats} from '../creature-rules.mjs';
import {grantKeywords,loseKeywords} from '../temporary-effects.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {resolveTop,passPriority} from '../casting.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const records=['commander/oracle/atraxa_praetors_voice','playtest-decks/atraxa'].flatMap(file=>JSON.parse(readFileSync(new URL('./fixtures/'+file+'.json',import.meta.url))).cards);
const creature=(name,power=3,toughness=10,oracle_text='',extra={})=>({instance:crypto.randomUUID(),name,type_line:'Creature',power:String(power),toughness:String(toughness),oracle_text,counters:{},...extra});
const real=name=>{const c=records.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{}};};
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';return g;};
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});c.summoningSick=false;return c;}
function combat(g,attackers,blocks=[]){changeStep(g,4);changeStep(g,5);for(const [card,owner=1] of attackers)setAttacker(g,card.instance,'player:'+owner);confirmAttackers(g);changeStep(g,6);for(const [blocker,attacker,owner=1] of blocks)setBlocker(g,owner,blocker.instance,attacker.instance);for(const owner of g.combat.defenders)confirmBlockers(g,owner);changeStep(g,7);}
const packet=(source,owner,target,amount=3)=>({source:{owner,card:source},target,amount});
function choose(g,operation){const option=counterChoiceOptions(g).find(o=>o.operation===operation);assert.ok(option,operation);resolveCounterChoice(g,option.key);}

for(const [name,keyword] of [['Viral Drake','infect'],['Ichor Rats','infect']])test(name+' uses real infect text and the source controller for poison replacement',()=>{
 const g=game(),source=enter(g,real(name));enter(g,real('Vorinclex, Monstrous Raider'));const events=dealDamagePackets(g,[packet(source,0,{kind:'player',owner:1},2)],true);
 assert.equal(g.players[1].life,40);assert.equal(g.players[1].poison,4);assert.equal(events.find(e=>e.kind==='damage').amount,2);assert.ok(events.find(e=>e.kind==='damage').keywords.includes(keyword));
});

test('Bloated Contaminator applies toxic replacements before its respondable proliferate trigger',()=>{
 const g=game(),source=enter(g,real('Bloated Contaminator'));enter(g,real('Vorinclex, Monstrous Raider'));combat(g,[[source]]);applyCombatDamage(g);
 assert.equal(g.players[1].life,36);assert.equal(g.players[1].poison,2);assert.equal(g.stack.length,1);assert.match(g.stack[0].text,/proliferate/i);
 resolveTop(g);assert.equal(g.pendingEffect.kind,'proliferate');
});

test('each toxic source is halved separately and zero counters do not erase damage or its triggers',()=>{
 const g=game(),a=enter(g,real('Bloated Contaminator')),b=enter(g,real('Bloated Contaminator'));enter(g,real('Vorinclex, Monstrous Raider'),1);combat(g,[[a],[b]]);applyCombatDamage(g);
 assert.equal(g.players[1].life,32);assert.equal(g.players[1].poison,0);assert.equal(g.stack.length,2);assert.equal(g.pendingEffect,undefined);
});

for(const keyword of ['Infect','Wither'])for(const noncombat of [false,true])test(keyword+' distinguishes combat counters from resolving-effect counters for Doubling Season ('+noncombat+')',()=>{
 const g=game(),source=enter(g,creature('Source',3,10,keyword)),target=enter(g,creature('Target',0,20),1);enter(g,real('Doubling Season'),1);
 dealDamagePackets(g,[packet(source,0,{kind:'card',id:target.instance,owner:1},3)],!noncombat);
 assert.equal(target.counters['-1/-1'],noncombat?6:3);assert.equal(target.markedDamage,undefined);
});

test('a counter replacement makes combat damage counters eligible for Doubling Season once',()=>{
 const g=game(),source=enter(g,creature('Wither',2,10,'Wither')),target=enter(g,creature('Target',0,20),1);enter(g,real('Vorinclex, Monstrous Raider'));enter(g,real('Doubling Season'),1);
 dealDamagePackets(g,[packet(source,0,{kind:'card',id:target.instance,owner:1},2)],true);
 assert.equal(target.counters['-1/-1'],8);assert.equal(g.pendingEffect,undefined);
});

for(const first of ['add','double'])test('combat counter order is chosen by the affected controller before all simultaneous results: '+first,()=>{
 let g=game();const source=enter(g,creature('Wither lifelink',3,10,'Wither, lifelink')),other=enter(g,creature('Other attacker',2,10)),target=enter(g,creature('Blocker',1,12),1);
 enter(g,real('Vorinclex, Monstrous Raider'));enter(g,real('Winding Constrictor'),1);combat(g,[[source],[other]],[[target,source]]);
 const before=JSON.stringify(g),preview=previewCombat(g);assert.match(preview.warning,/replacement order/);assert.equal(preview.error,'');assert.equal(JSON.stringify(g),before);
 applyCombatDamage(g);assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.pendingEffect.owner,1);assert.equal(g.combat.normalDone,false);
 assert.deepEqual(target.counters,{});assert.equal(source.markedDamage,undefined);assert.equal(g.players[0].life,40);assert.equal(g.players[1].life,40);
 assert.throws(()=>applyCombatDamage(g),/pending/);assert.throws(()=>passPriority(g,1),/pending/);
 g=validateSession(JSON.parse(JSON.stringify(g)));choose(g,first);
 const t=findCard(g,target.instance).card,s=findCard(g,source.instance).card;
 assert.equal(t.counters['-1/-1'],first==='add'?8:7);assert.equal(s.markedDamage,1);assert.equal(g.players[0].life,43);assert.equal(g.players[1].life,38);assert.equal(g.combat.normalDone,true);assert.equal(g.pendingEffect,undefined);
 const after=JSON.stringify(g);assert.throws(()=>choose(g,first));assert.equal(JSON.stringify(g),after);validateSession(g);
 cleanTurnDamage(g);assert.equal(s.markedDamage,undefined);assert.equal(t.counters['-1/-1'],first==='add'?8:7);
});

test('poison prohibition and halving never reduce lifelink or commander damage actually dealt',()=>{
 const g=game(),source=enter(g,creature('Commander',4,10,'Infect, lifelink',{commander:true,ownerSeat:0}));enter(g,{instance:'no-poison',name:'No poison',type_line:'Artifact',oracle_text:"You can't get poison counters.",counters:{}},1);
 dealDamagePackets(g,[packet(source,0,{kind:'player',owner:1},4)],true);
 assert.equal(g.players[1].poison,0);assert.equal(g.players[1].life,40);assert.equal(g.players[0].life,44);assert.equal(g.players[1].commanderDamage[source.instance],4);
});

test('numeric toxic instances add across printed abilities, live grants and repeated temporary grants',()=>{
 const g=game(),source=enter(g,creature('Toxic',2,10,'Flying, toxic 1\nToxic 2\nWhenever this creature attacks, another creature gains toxic 9.'));
 enter(g,{instance:'toxic-grant',name:'Grant',type_line:'Enchantment',oracle_text:'Creatures you control have toxic 1.',counters:{}});grantKeywords(source,['toxic 1']);grantKeywords(source,['toxic 1']);
 assert.equal(keywordTotal(g,0,source,'toxic'),6);dealDamagePackets(g,[packet(source,0,{kind:'player',owner:1},2)],true);assert.equal(g.players[1].poison,6);
 loseKeywords(source,['toxic']);assert.equal(keywordTotal(g,0,source,'toxic'),0);grantKeywords(source,['toxic 1']);assert.ok(keywordTotal(g,0,source,'toxic')>0);
});

test('toxic is combat-only, combines with infect on one source, and ignores planeswalker damage',()=>{
 const g=game(),source=enter(g,creature('Infect toxic',2,10,'Infect, toxic 1')),walker=enter(g,{instance:'walker',name:'Walker',type_line:'Planeswalker',loyalty:'10',oracle_text:'',counters:{}},1);
 dealDamagePackets(g,[packet(source,0,{kind:'player',owner:1},2)],false);assert.equal(g.players[1].poison,2);
 dealDamagePackets(g,[packet(source,0,{kind:'player',owner:1},2)],true);assert.equal(g.players[1].poison,5);
 dealDamagePackets(g,[packet(source,0,{kind:'card',id:walker.instance,owner:1},2)],true);assert.equal(walker.counters.loyalty,8);assert.equal(g.players[1].poison,5);
});

test('an infect fight retains both sources and resumes the spell once after counter ordering',()=>{
 let g=game();const source=enter(g,creature('Fighter',3,12,'Infect')),target=enter(g,creature('Opponent fighter',2,15),1);enter(g,real('Vorinclex, Monstrous Raider'));enter(g,real('Winding Constrictor'),1);g.players[0].zones.library=[creature('Draw once')];
 applyOracleEffect(g,{owner:0,name:'Fight and draw',source,text:"Target creature you control fights target creature you don't control. Draw a card.",targets:[{kind:'card',id:source.instance,owner:0,battlefieldId:source.battlefieldId,group:0},{kind:'card',id:target.instance,owner:1,battlefieldId:target.battlefieldId,group:1}]});
 assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.players[0].zones.hand.length,0);assert.equal(target.markedDamage,undefined);assert.equal(source.markedDamage,undefined);
 g=validateSession(JSON.parse(JSON.stringify(g)));choose(g,'double');assert.equal(g.players[0].zones.hand[0].name,'Draw once');assert.equal(g.players[0].zones.hand.length,1);assert.equal(findCard(g,source.instance).card.markedDamage,2);assert.equal(findCard(g,target.instance).card.counters['-1/-1'],7);assert.equal(g.pendingEffect,undefined);
});

test('damage counter and death triggers see completed results even if the recipient dies',()=>{
 const g=game(),source=enter(g,creature('Wither',3,10,'Wither')),target=enter(g,creature('Recipient',1,2,'Whenever one or more -1/-1 counters are put on this creature, draw a card.\nWhen this creature dies, draw a card.'),1);enter(g,real('Vorinclex, Monstrous Raider'));enter(g,real('Winding Constrictor'),1);
 combat(g,[[source]],[[target,source]]);applyCombatDamage(g);assert.equal(g.stack.length,0);choose(g,'double');
 assert.equal(findCard(g,target.instance).zone,'graveyard');assert.equal(g.stack.length,2);assert.equal(g.pendingEffect,undefined);
});

test('replacement choices remain private and reject malformed staged damage saves',()=>{
 const g=game(),source=enter(g,creature('Wither',3,10,'Wither')),target=enter(g,creature('Target',0,20),1);enter(g,real('Vorinclex, Monstrous Raider'));enter(g,real('Winding Constrictor'),1);combat(g,[[source]],[[target,source]]);applyCombatDamage(g);
 assert.equal(projectGame(g,0).pendingEffect.kind,'remote-choice');assert.equal(projectGame(g,1).pendingEffect.damageBatch.records.length,1);
 for(const mutate of [b=>b.records[0].amount=-1,b=>b.records[0].source.owner=5,b=>b.combatState.id='wrong',b=>b.afterDamage.inject=true,b=>b.records[0].keywords={}]){
  const saved=JSON.parse(JSON.stringify(g));mutate(saved.pendingEffect.damageBatch);assert.throws(()=>validateSession(saved));
 }
 const before=JSON.stringify(g);assert.throws(()=>reduceGameAction(g,{type:'counterChoice',key:'forged'},1));assert.equal(JSON.stringify(g),before);
});
