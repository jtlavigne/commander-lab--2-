import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,findCard,validateSession,resetGame} from '../engine.mjs';
import {cardFace,manaValue,creatureStats} from '../card-state.mjs';
import {enterPermanents,resolveEntryChoice,resolveCounterChoice,counterChoiceOptions} from '../oracle-effects.mjs';
import {createTokenCopies,tokenCopyDefinition} from '../tokens.mjs';
import {entryCopyOptions,entryCopyRules} from '../entry-copy.mjs';
import {activatedAbilities,addMana} from '../mana.mjs';
import {activateMana,activateLoyaltyAction,resolveTop,castSpell,counterTop} from '../casting.mjs';
import {chooseTriggerTarget} from '../combat-effects.mjs';
import {availableLoyaltyAbilities} from '../planeswalker.mjs';
import {keywordSet} from '../creature-rules.mjs';
import {cleanTurnDamage} from '../combat.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const records=['playtest-decks/jace','playtest-decks/atraxa','commander/oracle/atraxa_praetors_voice'].flatMap(name=>JSON.parse(readFileSync(new URL('./fixtures/'+name+'.json',import.meta.url))).cards);
const card=(name,extra={})=>({instance:crypto.randomUUID(),name,type_line:'Creature',power:'2',toughness:'2',mana_cost:'{2}',oracle_text:'',counters:{},...extra});
const real=name=>{const record=records.find(c=>c.name===name);assert.ok(record,name);return card(name,structuredClone(record));};
function game(count=2){const g=newGame(count);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);return transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});}
function stage(g,c,owner=0){g.players[owner].zones.hand.push(c);enterPermanents(g,{owner,name:c.name,source:{instance:'entry',name:'Entry'}},[{id:c.instance,owner}]);return c;}
function copy(g,c,source){resolveEntryChoice(g,'copy',{id:c.instance,target:source?.instance??null,battlefieldId:source?.battlefieldId||null});return findCard(g,c.instance)?.card;}
function selected(g){return g.pendingEffect.entries[g.pendingEffect.entryIndex];}

test('Spark Double copies printed planeswalker loyalty before shared counter replacements and gains live grants',()=>{
 let g=game();enter(g,real('Doubling Season'));enter(g,real("Lae'zel, Vlaakith's Champion"));enter(g,real('Ichormoon Gauntlet'));
 const source=enter(g,real('Teferi, Hero of Dominaria'));source.counters.loyalty=19;source.markedDamage=3;
 const spark=stage(g,real('Spark Double'));
 assert.equal(g.pendingEffect.entryKind,'copy');assert.equal(findCard(g,spark.instance).zone,'hand');
 g=validateSession(JSON.parse(JSON.stringify(g)));copy(g,spark,source);
 assert.equal(g.pendingEffect.kind,'counter-choice');const printed=Number(cardFace(source).loyalty);
 assert.equal(g.pendingEffect.plan.states[0].counters.loyalty,printed+1);
 const add=counterChoiceOptions(g).find(option=>option.operation==='add');resolveCounterChoice(g,add.key);
 const result=findCard(g,spark.instance).card;
 assert.equal(result.counters.loyalty,(printed+2)*2);assert.equal(result.markedDamage,undefined);assert.equal(result.token,undefined);
 assert.equal(cardFace(result).name,source.name);assert.ok(!cardFace(result).type_line.includes('Legendary'));
 assert.equal(availableLoyaltyAbilities(g,0,result).length,availableLoyaltyAbilities(g,0,source).length);
 assert.equal(manaValue(result),5);validateSession(JSON.parse(JSON.stringify(g)));
 const [token]=createTokenCopies(g,0,result);assert.equal(cardFace(token).name,source.name);assert.ok(!cardFace(token).type_line.includes('Legendary'));
 assert.equal(g.pendingEffect.kind,'counter-choice');while(g.pendingEffect?.kind==='counter-choice')resolveCounterChoice(g,counterChoiceOptions(g).find(o=>o.operation==='add').key);
 assert.equal(token.counters.loyalty,(printed+1)*2); // Spark's additional counter is not copied.
});

test('Cursed Mirror copies a mana creature with haste, expires without reentry, and its token copy keeps the ability',()=>{
 const g=game(),source=enter(g,card('Mana creature',{oracle_text:'{T}: Add {G}.',keywords:[]})),mirror=stage(g,real('Cursed Mirror'));
 copy(g,mirror,source);const current=findCard(g,mirror.instance).card,identity=current.battlefieldId;
 assert.ok(keywordSet(g,0,current).has('haste'));assert.equal(manaValue(current),2);
 let abilities=activatedAbilities(g,0,current);assert.equal(abilities.length,1);assert.match(abilities[0].text,/\{G\}/);activateMana(g,current.instance,abilities[0].id);
 const [token]=createTokenCopies(g,0,current);assert.ok(keywordSet(g,0,token).has('haste'));assert.equal(token.copyEffects,undefined);
 current.counters.charge=2;current.markedDamage=1;cleanTurnDamage(g);
 assert.equal(current.battlefieldId,identity);assert.equal(current.tapped,true);assert.equal(current.counters.charge,2);assert.equal(current.markedDamage,undefined);
 assert.equal(cardFace(current).name,'Cursed Mirror');assert.equal(cardFace(current).type_line,'Artifact');assert.equal(manaValue(current),3);
 abilities=activatedAbilities(g,0,current);assert.equal(abilities.length,1);assert.match(abilities[0].text,/\{R\}/);
 assert.ok(keywordSet(g,0,token).has('haste'));assert.match(activatedAbilities(g,0,token)[0].text,/\{G\}/);validateSession(g);
});

test('copied enter triggers wait for commit and have a response window before drawing',()=>{
 const g=game(),source=enter(g,card('Entry drawer',{oracle_text:'When this creature enters, draw a card.'}));g.players[0].zones.library=[card('Drawn card')];
 const mirror=stage(g,real('Cursed Mirror'));assert.equal(g.stack.length,0);copy(g,mirror,source);
 assert.equal(g.stack.length,1);assert.equal(g.players[0].zones.hand.length,0);assert.equal(g.players[0].zones.library.length,1);
 resolveTop(g);assert.equal(g.players[0].zones.hand[0].name,'Drawn card');assert.equal(g.pendingEffect,undefined);
});

test('copy selection is not targeting, respects control and current incarnation, and cannot choose batch companions',()=>{
 const g=game(),own=enter(g,card('Shrouded',{oracle_text:'Shroud'})),other=enter(g,card('Opponent'),1),spark=real('Spark Double'),companion=card('Companion');
 g.players[0].zones.hand.push(spark,companion);enterPermanents(g,{owner:0,name:'Batch',source:{instance:'batch',name:'Batch'}},[{id:spark.instance,owner:0},{id:companion.instance,owner:0}]);
 assert.deepEqual(entryCopyOptions(g,selected(g)).map(o=>o.id),[own.instance]);
 for(const source of [other,companion])assert.throws(()=>copy(g,spark,source),/eligible/);
 assert.throws(()=>resolveEntryChoice(g,'copy',{id:spark.instance,target:own.instance,battlefieldId:'old'}),/eligible/);
 copy(g,spark,own);assert.equal(g.players[0].zones.battlefield.length,3);assert.equal(creatureStats(findCard(g,spark.instance).card).power,3);
});

test('a face-down source supplies only public copiable values and never its hidden artwork',()=>{
 const g=game(),source=enter(g,card('Hidden dragon',{id:'secret',oracle_text:'Flying',localImages:['secret-art']}));source.manifested=true;source.faceDown=true;
 const mirror=stage(g,real('Cursed Mirror'));copy(g,mirror,source);const values=findCard(g,mirror.instance).card.copyEffects[0].values;
 assert.equal(values.id,undefined);assert.equal(values.localImages,undefined);assert.equal(values.power,'2');assert.equal(values.oracle_text,'Haste');assert.ok(!JSON.stringify(values).includes('Hidden dragon'));
});

test('declining Spark Double leaves an ordinary zero-toughness creature for state actions',()=>{
 let g=game();const spark=stage(g,real('Spark Double'));g=reduceGameAction(g,{type:'entryCopy',id:spark.instance,target:null},0).game;
 assert.equal(findCard(g,spark.instance).zone,'graveyard');assert.equal(findCard(g,spark.instance).card.copyEffects,undefined);assert.equal(g.pendingEffect,undefined);
});

test('copy state persists through saves and control changes but clears on zone changes and reset',()=>{
 let g=game();const source=enter(g,card('Original',{mana_cost:'{G}',oracle_text:'Flying',keywords:['Flying']})),spark=stage(g,real('Spark Double'));copy(g,spark,source);
 g=validateSession(JSON.parse(JSON.stringify(g)));const c=findCard(g,spark.instance).card,identity=c.battlefieldId;transfer(g,c.instance,'battlefield',1);
 assert.equal(cardFace(c).name,'Original');assert.equal(c.battlefieldId,identity);assert.equal(c.summoningSick,true);
 const fresh=resetGame(g),reset=findCard(fresh,c.instance).card;assert.equal(reset.name,'Spark Double');assert.equal(reset.copyEffects,undefined);
 transfer(g,c.instance,'hand',0);assert.equal(c.copyEffects,undefined);assert.equal(cardFace(c).name,'Spark Double');assert.equal(c.ownerSeat,0);
});

test('copied X entry values use zero, while undefined starting values still ask before counter replacement',()=>{
 const g=game(),source=enter(g,card('Variable creature',{mana_cost:'{X}',oracle_text:'This creature enters with X +1/+1 counters on it.',power:'0',toughness:'0'})),spark=stage(g,real('Spark Double'));source.counters['+1/+1']=20;copy(g,spark,source);
 assert.equal(g.pendingEffect,undefined);assert.equal(findCard(g,spark.instance).card.counters['+1/+1'],1);
 const variable=enter(g,card('Unknown',{power:'*',toughness:'*'})),second=stage(g,real('Spark Double'));copy(g,second,variable);
 assert.equal(g.pendingEffect.entryKind,'values');resolveEntryChoice(g,'values',{id:second.instance,values:{power:4,toughness:5}});
 assert.equal(creatureStats(findCard(g,second.instance).card).toughness,6);validateSession(g);
});

test('unknown copy exceptions are not silently compiled and malformed copy profiles are rejected',()=>{
 const c=real('Spark Double');assert.equal(entryCopyRules(c).length,1);c.oracle_text+=' Other text.';assert.equal(entryCopyRules(c).length,0);
 const g=game(),source=enter(g,card('Source')),spark=stage(g,real('Spark Double'));copy(g,spark,source);
 for(const mutate of [c=>c.copyEffects[0].untilEndOfTurn='yes',c=>c.copyEffects[0].values.counters={},c=>c.copyEffects[0].values.oracle_text=5]){
  const saved=JSON.parse(JSON.stringify(g));mutate(findCard(saved,spark.instance).card);assert.throws(()=>validateSession(saved));
 }
 assert.equal(tokenCopyDefinition(findCard(g,spark.instance).card).copyEffects,undefined);
});

test('a later as-enters copy replaces Spark counter exceptions instead of accumulating them',()=>{
 const g=game(),clone=enter(g,card('Blank clone',{oracle_text:'You may have this creature enter as a copy of any creature on the battlefield.'})),source=enter(g,card('Final creature',{type_line:'Legendary Creature'})),spark=stage(g,real('Spark Double'));
 copy(g,spark,clone);assert.equal(g.pendingEffect.entryKind,'copy');
 copy(g,spark,source);const result=findCard(g,spark.instance).card;
 assert.equal(cardFace(result).name,'Final creature');assert.match(cardFace(result).type_line,/Legendary/);assert.deepEqual(result.counters,{});
 validateSession(g);
});

test('an indefinite copy applied after a temporary copy remains when the earlier layer expires',()=>{
 let g=game();const blankSpark=enter(g,real('Spark Double')),source=enter(g,real('Teferi, Hero of Dominaria')),mirror=stage(g,real('Cursed Mirror'));
 copy(g,mirror,blankSpark);assert.equal(g.pendingEffect.entryKind,'copy');
 g=validateSession(JSON.parse(JSON.stringify(g)));copy(g,mirror,source);const result=findCard(g,mirror.instance).card;
 assert.equal(result.copyEffects.length,2);assert.equal(result.counters.loyalty,Number(cardFace(source).loyalty)+1);
 cleanTurnDamage(g);assert.equal(result.copyEffects.length,1);assert.equal(cardFace(result).name,source.name);assert.ok(!cardFace(result).type_line.includes('Legendary'));
});

test('ordinary nontransforming permanent copies acquire just the chosen DFC face and its mana value',()=>{
 const g=game(),source=enter(g,card('Front // Back',{layout:'transform',cmc:5,card_faces:[{name:'Front',mana_cost:'{3}{U}{U}',type_line:'Creature',power:'2',toughness:'2',oracle_text:''},{name:'Back',mana_cost:'',type_line:'Creature',power:'5',toughness:'5',oracle_text:'Flying'}]}));source.face=1;
 const spark=stage(g,real('Spark Double'));copy(g,spark,source);const c=findCard(g,spark.instance).card;
 assert.equal(cardFace(c).name,'Back');assert.equal(cardFace(c).card_faces,undefined);assert.equal(manaValue(c),0);assert.equal(creatureStats(c).power,6);
 c.face=1;assert.equal(cardFace(c).name,'Back'); // no transformable back face was created
});

test('real copy spells retain responses before resolution and choose from the battlefield at resolution',()=>{
 for(const name of ['Spark Double','Cursed Mirror'])for(const countered of [false,true]){
  const g=game(),source=enter(g,card('Removed before resolution')),spell=real(name);g.players[0].zones.hand.push(spell);addMana(g.players[0],{U:4,R:3});
  castSpell(g,spell.instance);assert.equal(g.pendingEffect,undefined);assert.equal(findCard(g,spell.instance).zone,'stack');
  transfer(g,source.instance,'graveyard',0);
  if(countered){counterTop(g);assert.equal(g.pendingEffect,undefined);assert.equal(findCard(g,spell.instance).zone,'graveyard');}
  else{
   resolveTop(g);assert.equal(g.pendingEffect.entryKind,'copy');assert.deepEqual(entryCopyOptions(g,selected(g)),[]);
   copy(g,spell,null);assert.equal(g.pendingEffect,undefined);
   if(name==='Cursed Mirror')activateMana(g,spell.instance,activatedAbilities(g,0,findCard(g,spell.instance).card)[0].id);
  }
  validateSession(g);
 }
});

test('Atraxa Tamiyo exile-and-copy can create a cloning token without an inert token or temporary hand entry',()=>{
 const g=game(),tamiyo=enter(g,real('Tamiyo, Compleated Sage')),source=enter(g,card('Copyable creature',{oracle_text:'Vigilance',keywords:['Vigilance']})),spark=real('Spark Double');g.players[0].zones.graveyard.push(spark);
 activateLoyaltyAction(g,tamiyo.instance,1,4);chooseTriggerTarget(g,g.stack.at(-1).id,['card:'+spark.instance]);
 assert.equal(findCard(g,spark.instance).zone,'graveyard');resolveTop(g);
 assert.equal(findCard(g,spark.instance).zone,'exile');assert.equal(g.pendingEffect.entryKind,'copy');
 const token=selected(g).card;assert.equal(g.players[0].zones.hand.length,0);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,0);
 copy(g,token,source);const result=findCard(g,token.instance).card;
 assert.equal(result.token,true);assert.equal(cardFace(result).name,'Copyable creature');assert.ok(keywordSet(g,0,result).has('vigilance'));assert.equal(creatureStats(result).power,3);
 assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].zones.hand.length,0);validateSession(JSON.parse(JSON.stringify(g)));
});

test('concealed face-down battlefield cards have the same copy eligibility in authoritative and player views',()=>{
 const g=game(),source=enter(g,card('Private printed identity',{id:'private-printing',oracle_text:'{T}: Add {U}.',localImages:['private-art']}),1),mirror=stage(g,real('Cursed Mirror'));source.faceDown=true;
 const view=projectGame(g,0),projected=view.pendingEffect.entries[view.pendingEffect.entryIndex];
 assert.equal(view.players[1].zones.battlefield[0].hidden,true);
 assert.deepEqual(entryCopyOptions(view,projected).map(o=>o.id),entryCopyOptions(g,selected(g)).map(o=>o.id));
 assert.deepEqual(entryCopyOptions(view,projected).map(o=>o.id),[source.instance]);
 assert.equal(entryCopyOptions(g,selected(g))[0].label,'Face-down creature');
 copy(g,mirror,source);const values=findCard(g,mirror.instance).card.copyEffects[0].values;
 assert.equal(values.name,'Face-down creature');assert.equal(values.power,'2');assert.equal(values.localImages,undefined);assert.equal(values.id,undefined);assert.equal(values.oracle_text,'Haste');
});

test('copied sunburst uses the colors spent on the resolving copy spell rather than the original permanent',()=>{
 const g=game(),source=enter(g,card('Sunburst creature',{power:'0',toughness:'0',mana_cost:'{5}',oracle_text:'Sunburst'})),spark=real('Spark Double');source.counters['+1/+1']=12;
 g.players[0].zones.hand.push(spark);addMana(g.players[0],{W:1,U:1,B:1,R:1});castSpell(g,spark.instance);resolveTop(g);copy(g,spark,source);
 assert.equal(findCard(g,spark.instance).card.counters['+1/+1'],5);assert.equal(g.pendingEffect,undefined);
});
