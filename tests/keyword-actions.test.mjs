import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,transfer,validateSession,resetGame} from '../engine.mjs';
import {applyOracleEffect,compileOracleEffect,oracleChoiceOptions,resolveOracleChoice,resolveCounterChoice,counterChoiceOptions} from '../oracle-effects.mjs';
import {activateMana,resolveTop,passPriority,castSpell} from '../casting.mjs';
import {spellTargetOptions} from '../spell-effects.mjs';
import {effectTargetOptions} from '../effect-targets.mjs';
import {activatedAbilities,addMana} from '../mana.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {discoverTokens} from '../token-catalog.mjs';
import {phaseOut,phaseInForTurn} from '../turn-effects.mjs';
import {readFileSync} from 'node:fs';
import {keywordSet} from '../creature-rules.mjs';
import {queueCombatTriggers,chooseTriggerTarget} from '../combat-effects.mjs';
const oracle=JSON.parse(readFileSync(new URL('./fixtures/keyword-actions-oracle.json',import.meta.url))).cards;
const real=name=>card(name,structuredClone(oracle.find(c=>c.name===name)));

const card=(name,extra={})=>({instance:crypto.randomUUID(),name,type_line:'Creature',power:'2',toughness:'2',oracle_text:'',counters:{},face:0,...extra});
function game(){const g=newGame(2);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
function apply(g,text,source=card('Source'),owner=0){assert.equal(applyOracleEffect(g,{owner,name:source.name,source,text}),true,text);}

test('Investigate creates functional Clues and queues each investigate trigger after resolution',()=>{
 const g=game();enter(g,card('Observer',{type_line:'Enchantment',oracle_text:'Whenever you investigate, draw a card.'}));g.players[0].zones.library=[card('a'),card('b'),card('c')];
 apply(g,'Investigate twice.');const clues=g.players[0].zones.battlefield.filter(c=>c.token);
 assert.equal(clues.length,2);assert.notEqual(clues[0].instance,clues[1].instance);assert.equal(g.stack.length,2);assert.equal(g.players[0].zones.hand.length,0);
 while(g.stack.length)resolveTop(g);assert.equal(g.players[0].zones.hand.length,2);
 addMana(g.players[0],{C:2});activateMana(g,clues[0].instance,activatedAbilities(g,0,clues[0])[0].id);
 assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,1);assert.equal(g.players[0].zones.hand.length,2);resolveTop(g);assert.equal(g.players[0].zones.hand.length,3);
});
test('unrecognized compound suffixes do not partially investigate',()=>{
 const g=game(),before=structuredClone(g);assert.equal(compileOracleEffect('Investigate. Do an unsupported thing.'),null);
 assert.equal(applyOracleEffect(g,{owner:0,source:card('Source'),text:'Investigate. Do an unsupported thing.'}),false);assert.deepEqual(g,before);
});

test('import discovery finds Clues from keyword text without requiring reminder text or related-card metadata',()=>{
 const requirements=discoverTokens([{oracle_text:'When this creature enters, investigate.'},{card_faces:[{oracle_text:'Investigate twice.'}]}]);
 assert.equal(requirements.definitions.length,1);assert.equal(requirements.definitions[0].name,'Clue');assert.match(requirements.definitions[0].oracle_text,/Sacrifice this artifact: Draw a card/);
});
test('Populate copies a chosen creature token without its counters, damage or tap state',()=>{
 let g=game();const token=enter(g,card('Bird',{token:true,oracle_text:'Flying',colors:['U']}));token.counters['+1/+1']=3;token.markedDamage=1;token.tapped=true;
 enter(g,card('Clue',{token:true,type_line:'Artifact'}));enter(g,card('Real creature'));enter(g,card('Enemy token',{token:true}),1);
 apply(g,'Populate.');assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[token.instance]);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[token.instance]);
 const copy=g.players[0].zones.battlefield.find(c=>c.token&&c.instance!==token.instance&&c.name==='Bird');
 assert.ok(copy);assert.equal(copy.oracle_text,'Flying');assert.equal(copy.power,'2');assert.deepEqual(copy.counters,{});assert.ok(!copy.tapped);assert.ok(!copy.markedDamage);assert.ok(copy.summoningSick);
});
test('Populate with no creature tokens finishes and continues later instructions',()=>{
 const g=game();g.players[0].zones.library=[card('Draw me')];apply(g,'Populate. Draw a card.');assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].zones.hand.length,1);
});
test('Bolster uses current toughness, ignores marked damage, and does not target',()=>{
 const g=game(),low=enter(g,card('Lowest',{toughness:'1',oracle_text:'Shroud'})),high=enter(g,card('Higher',{toughness:'3'}));high.markedDamage=2;
 apply(g,'Bolster 2.');assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[low.instance]);resolveOracleChoice(g,[low.instance]);assert.equal(low.counters['+1/+1'],2);
});
test('Bolster ties are a mandatory choice, not an automatic pick',()=>{
 const g=game(),a=enter(g,card('A')),b=enter(g,card('B'));apply(g,'Bolster 1.');assert.equal(oracleChoiceOptions(g).length,2);
 assert.throws(()=>resolveOracleChoice(g,[]),/at least/);assert.throws(()=>resolveOracleChoice(g,[a.instance,b.instance]),/at most/);resolveOracleChoice(g,[b.instance]);assert.equal(b.counters['+1/+1'],1);assert.deepEqual(a.counters,{});
});
test('Bolster choices enforce seat ownership and survive serialized action replay',()=>{
 let g=game();const c=enter(g,card('Choice'));apply(g,'Bolster 2.');g=validateSession(JSON.parse(JSON.stringify(g)));
 assert.throws(()=>reduceAction(g,{type:'oracleChoice',keys:[c.instance]},1));
 g=reduceAction(g,{type:'oracleChoice',keys:[c.instance]},0).game;assert.equal(g.players[0].zones.battlefield[0].counters['+1/+1'],2);assert.equal(g.pendingEffect,undefined);
});
test('Adapt tests for +1/+1 counters at resolution and can be used again once they are removed',()=>{
 const g=game(),c=enter(g,card('Adapter',{oracle_text:'{0}: Adapt 2.'}));
 const ability=activatedAbilities(g,0,c)[0];activateMana(g,c.instance,ability.id);activateMana(g,c.instance,ability.id);assert.equal(c.counters['+1/+1'],undefined);
 resolveTop(g);assert.equal(c.counters['+1/+1'],2);resolveTop(g);assert.equal(c.counters['+1/+1'],2);
 delete c.counters['+1/+1'];apply(g,'Adapt 2.',c);assert.equal(c.counters['+1/+1'],2);
});
test('Adapt and Monstrosity do not modify a source that left and returned',()=>{
 for(const text of ['Adapt 3.','Monstrosity 3.']){const g=game(),c=enter(g,card('Source')),old=structuredClone(c);transfer(g,c.instance,'graveyard',0);transfer(g,c.instance,'battlefield',0);apply(g,text,old);assert.deepEqual(c.counters,{});assert.equal(c.monstrous,undefined);}
});
test('Monstrosity is a persistent designation, and only becoming monstrous triggers',()=>{
 const g=game(),c=enter(g,card('Monster',{oracle_text:'When this creature becomes monstrous, draw a card.'}));g.players[0].zones.library=[card('draw')];
 apply(g,'Monstrosity 0.',c);assert.equal(c.monstrous,true);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);
 apply(g,'Monstrosity 3.',c);assert.equal(c.counters['+1/+1'],undefined);assert.equal(g.stack.length,0);
 transfer(g,c.instance,'graveyard',0);assert.equal(c.monstrous,undefined);transfer(g,c.instance,'battlefield',0);apply(g,'Monstrosity 2.',c);assert.equal(c.counters['+1/+1'],2);
});
test('Monstrosity counter replacement choices preserve the designation continuation across reload',()=>{
 let g=game();const c=enter(g,card('Monster'));enter(g,card('Double',{type_line:'Enchantment',oracle_text:'If you would put one or more counters on a permanent or player, put twice that many of each of those kinds of counters on that permanent or player instead.'}));enter(g,card('Add',{type_line:'Creature',oracle_text:'If one or more counters would be put on an artifact or creature you control, that many plus one of each of those kinds of counters are put on that permanent instead.'}));
 apply(g,'Monstrosity 2.',c);assert.equal(g.pendingEffect.kind,'counter-choice');assert.ok(!c.monstrous);assert.throws(()=>passPriority(g,0),/pending effect/);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveCounterChoice(g,counterChoiceOptions(g).find(c=>c.operation==='add').key);
 const current=g.players[0].zones.battlefield.find(x=>x.instance===c.instance);assert.equal(current.counters['+1/+1'],6);assert.equal(current.monstrous,true);assert.equal(g.pendingEffect,undefined);
});
test('keyword programs reject invalid saved amounts and monstrous markers',()=>{
 const g=game();enter(g,card('Choice'));apply(g,'Bolster 1.');const bad=structuredClone(g);bad.pendingEffect.step.amount='-1';assert.throws(()=>validateSession(bad));
 const malformed=structuredClone(g);malformed.players[0].zones.battlefield[0].monstrous='yes';assert.throws(()=>validateSession(malformed));
});

test('monstrous survives control changes and phasing but is removed by reset',()=>{
 const g=game(),c=enter(g,card('Monster'));apply(g,'Monstrosity 1.',c);transfer(g,c.instance,'battlefield',1);assert.equal(c.monstrous,true);
 phaseOut(g,c.instance);assert.equal(g.phasedOut[0].card.monstrous,true);phaseInForTurn(g,1);assert.equal(g.players[1].zones.battlefield[0].monstrous,true);
 const reset=resetGame(g);assert.ok(reset.players.flatMap(p=>Object.values(p.zones).flat()).every(c=>c.monstrous===undefined));
});

test('Support announces optional creature targets on either side and rechecks them on resolution',()=>{
 const g=game(),a=enter(g,card('Own')),b=enter(g,card('Opponent'),1),c=enter(g,card('Hexproof',{oracle_text:'Hexproof'}),1),spell=card('Lead by Example',{type_line:'Instant',mana_cost:'{0}',oracle_text:'Support 2.'});g.players[0].zones.hand.push(spell);
 assert.deepEqual(spellTargetOptions(g,0,spell).map(o=>o.id),[a.instance,b.instance]);
 castSpell(g,spell.instance,{targets:['card:'+a.instance,'card:'+b.instance]});assert.deepEqual(a.counters,{});assert.equal(g.stack.length,1);
 transfer(g,b.instance,'hand',1);resolveTop(g);assert.equal(a.counters['+1/+1'],1);assert.deepEqual(c.counters,{});assert.equal(g.stack.length,0);
});

test('Support on a permanent excludes itself, allows zero targets, and costs precede counters',()=>{
 const g=game(),source=enter(g,card('Supporter',{oracle_text:'{0}: Support 2.'})),other=enter(g,card('Other'));
 assert.deepEqual(effectTargetOptions(g,{owner:0,source,text:'Support 2.'}).map(o=>o.id),[other.instance]);
 const ability=activatedAbilities(g,0,source)[0];assert.throws(()=>activateMana(g,source.instance,ability.id,{targets:['card:'+source.instance]}),/legal/);
 activateMana(g,source.instance,ability.id,{targets:[]});resolveTop(g);assert.deepEqual(other.counters,{});
 activateMana(g,source.instance,ability.id,{targets:['card:'+other.instance]});assert.deepEqual(other.counters,{});resolveTop(g);assert.equal(other.counters['+1/+1'],1);
});

test('real Thraben Inspector entry and Growing Ranks upkeep use the shared keyword actions',()=>{
 const g=game(),inspector=enter(g,real('Thraben Inspector'));
 queueCombatTriggers(g,[{kind:'enter',owner:0,card:inspector}]);assert.equal(g.stack.length,1);validateSession(JSON.parse(JSON.stringify(g)));resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.name==='Clue').length,1);
 const token=enter(g,card('Warrior',{token:true}));enter(g,real('Growing Ranks'));queueCombatTriggers(g,[{kind:'upkeep',owner:0}]);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect.step.op,'populate');resolveOracleChoice(g,[token.instance]);assert.equal(g.players[0].zones.battlefield.filter(c=>c.name==='Warrior').length,2);
});

test('real Growth-Chamber Guardian adapts, triggers, and optionally searches only its named card',()=>{
 let g=game();const source=enter(g,real('Growth-Chamber Guardian')),copy=real('Growth-Chamber Guardian'),other=card('Different card');g.players[0].zones.library=[copy,other];addMana(g.players[0],{G:3});
 activateMana(g,source.instance,activatedAbilities(g,0,source)[0].id);resolveTop(g);assert.equal(source.counters['+1/+1'],2);assert.equal(g.stack.length,1);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveTop(g);assert.equal(g.pendingEffect.step.op,'optional');resolveOracleChoice(g,['yes']);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[copy.instance]);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[copy.instance]);assert.equal(g.players[0].zones.hand[0].name,'Growth-Chamber Guardian');assert.equal(g.pendingEffect,undefined);
});

test('real Fleecemane Lion receives its live monstrous grants and loses them after blinking',()=>{
 const g=game(),source=enter(g,real('Fleecemane Lion'));assert.equal(keywordSet(g,0,source).has('indestructible'),false);addMana(g.players[0],{G:4,W:1});
 activateMana(g,source.instance,activatedAbilities(g,0,source)[0].id);assert.equal(source.monstrous,undefined);resolveTop(g);assert.equal(source.monstrous,true);assert.equal(source.counters['+1/+1'],1);
 assert.ok(keywordSet(g,0,source).has('hexproof'));assert.ok(keywordSet(g,0,source).has('indestructible'));transfer(g,source.instance,'exile',0);transfer(g,source.instance,'battlefield',0);assert.equal(keywordSet(g,0,source).has('hexproof'),false);
});

test('real Dromoka bolster trigger chooses the least-tough creature on resolution',()=>{
 const g=game(),dromoka=enter(g,real('Dromoka, the Eternal')),small=enter(g,card('Small'));
 queueCombatTriggers(g,[{kind:'attack',owner:0,card:dromoka,defender:1,defenderTarget:{kind:'player',owner:1}}]);assert.equal(g.stack.length,1);resolveTop(g);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[small.instance]);resolveOracleChoice(g,[small.instance]);assert.equal(small.counters['+1/+1'],2);
});

test('real Generous Patron supports opponents and triggers separately for each recipient',()=>{
 const g=game(),a=enter(g,card('A'),1),b=enter(g,card('B'),1),patron=enter(g,real('Generous Patron'));g.players[0].zones.library=[card('draw1'),card('draw2')];
 queueCombatTriggers(g,[{kind:'enter',owner:0,card:patron}]);chooseTriggerTarget(g,g.stack[0].id,['card:'+a.instance,'card:'+b.instance]);resolveTop(g);
 assert.equal(a.counters['+1/+1'],1);assert.equal(b.counters['+1/+1'],1);assert.equal(g.stack.length,2);validateSession(JSON.parse(JSON.stringify(g)));
 resolveTop(g);resolveTop(g);assert.equal(g.players[0].zones.hand.length,2);
});
