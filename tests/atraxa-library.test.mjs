import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,draw,validateSession} from '../engine.mjs';
import {activateLoyaltyAction,resolveTop,castSpell,passPriority} from '../casting.mjs';
import {applyOracleEffect,oracleChoiceOptions,resolveOracleChoice} from '../oracle-effects.mjs';
import {addMana} from '../mana.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards;
const card=(name,extra={})=>({instance:crypto.randomUUID(),name,type_line:'Instant',mana_cost:'{2}',oracle_text:'',counters:{},...extra});
const real=name=>card(name,structuredClone(records.find(c=>c.name===name)));
function game(){const g=newGame(2);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
function activate(g,c,index=0){activateLoyaltyAction(g,c.instance,index);assert.equal(g.pendingEffect,undefined);resolveTop(g);}

test('Narset privately looks, only accepts a noncreature nonland, then reveals exactly that card before random bottom',()=>{
 let g=game();const n=enter(g,real('Narset, Parter of Veils')),land=card('Land',{type_line:'Land'}),creature=card('Creature',{type_line:'Creature'}),spell=card('Selected'),other=card('Other'),unseen=card('Unseen');g.players[0].zones.library=[land,creature,spell,other,unseen];activate(g,n);
 assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),[spell.instance,other.instance]);assert.throws(()=>resolveOracleChoice(g,[land.instance]));assert.ok(projectGame(g,1).players[0].zones.library.every(c=>c.hidden));assert.equal(projectGame(g,0).players[0].zones.library.filter(c=>!c.hidden).length,4);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[spell.instance]);assert.equal(g.pendingEffect.step.op,'finishLook');assert.throws(()=>passPriority(g,0),/pending/);assert.deepEqual(projectGame(g,1).players[0].zones.library.filter(c=>!c.hidden).map(c=>c.name),['Selected']);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[]);assert.equal(g.players[0].zones.hand[0].name,'Selected');assert.equal(g.players[0].zones.library[0].name,'Unseen');assert.deepEqual(g.players[0].zones.library.slice(1).map(c=>c.name).sort(),['Creature','Land','Other']);assert.equal(g.drawHistory,undefined);
 assert.ok(projectGame(g,1).players[0].zones.hand.every(c=>c.hidden));
});

test('Narset may decline an eligible card, handles no eligible cards and an empty library',()=>{
 for(const kind of ['decline','none','empty']){const g=game(),n=enter(g,real('Narset, Parter of Veils'));g.players[0].zones.library=kind==='empty'?[]:[card('Inspected',{type_line:kind==='none'?'Creature':'Instant'}),card('Land',{type_line:'Land'})];activate(g,n);if(kind!=='empty')resolveOracleChoice(g,[]);assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].zones.hand.length,0);assert.equal(g.players[0].failedDraw,undefined);}
});

test('Narset limits individual opposing draws after replacements, remembers earlier draws, and stops restricting when gone',()=>{
 const g=game();g.players[1].zones.library=Array.from({length:10},(_,i)=>card('Card '+i));draw(g,1,1);const n=enter(g,real('Narset, Parter of Veils'));
 draw(g,1,3);assert.equal(g.players[1].zones.hand.length,1);g.turn++;enter(g,card('Draw doubler',{type_line:'Enchantment',oracle_text:'If you would draw a card, draw two cards instead.'}),1);draw(g,1,3);assert.equal(g.players[1].zones.hand.length,2);
 transfer(g,n.instance,'graveyard',0);draw(g,1,1);assert.equal(g.players[1].zones.hand.length,4);
});

test('forbidden draws neither deck a player nor permit optional draw choices',()=>{
 const g=game();enter(g,real('Narset, Parter of Veils'));g.players[1].zones.library=[card('Only')];draw(g,1,1);draw(g,1,2);assert.equal(g.players[1].failedDraw,undefined);
 assert.equal(applyOracleEffect(g,{owner:1,source:card('Choice'),text:'You may draw a card.'}),true);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),['no']);assert.throws(()=>resolveOracleChoice(g,['yes']));resolveOracleChoice(g,['no']);
 g.turn++;assert.equal(applyOracleEffect(g,{owner:1,source:card('Choice'),text:'You may draw up to 3 cards.'}),true);assert.deepEqual(oracleChoiceOptions(g).map(o=>o.key),['0','1']);resolveOracleChoice(g,['0']);
});

test('Sorin may keep the top card private or reveal and put it in hand, losing mana-value life without drawing',()=>{
 for(const keep of [false,true]){let g=game();const s=enter(g,real('Sorin the Mirthless')),top=card('Top',{mana_cost:'{X}{3}{B}'});g.players[0].zones.library=[top,card('Next')];activate(g,s);assert.equal(g.players[0].life,40);assert.ok(projectGame(g,1).players[0].zones.library.every(c=>c.hidden));resolveOracleChoice(g,keep?[top.instance]:[]);
 if(keep){g=validateSession(JSON.parse(JSON.stringify(g)));assert.equal(projectGame(g,1).players[0].zones.library[0].name,'Top');resolveOracleChoice(g,[]);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.players[0].life,36);assert.equal(g.players[0].zones.library[0].name,'Next');}else{assert.equal(g.players[0].life,40);assert.equal(g.players[0].zones.library[0].name,'Top');}assert.equal(g.drawHistory,undefined);}
});

test('Experimental Augury waits for responses then selection and bottom order before proliferating',()=>{
 let g=game();const spell=real('Experimental Augury'),cards=[card('First'),card('Second'),card('Third'),card('Unseen')];g.players[0].zones.hand=[spell];g.players[0].zones.library=[...cards];addMana(g.players[0],{U:2});castSpell(g,spell.instance);assert.equal(g.pendingEffect,undefined);resolveTop(g);assert.equal(g.pendingEffect.step.op,'selectLook');resolveOracleChoice(g,[cards[1].instance]);assert.equal(g.pendingEffect.step.op,'orderBottomLibrary');
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[cards[2].instance,cards[0].instance]);assert.deepEqual(g.players[0].zones.library.map(c=>c.name),['Unseen','Third','First']);assert.equal(g.pendingEffect.kind,'proliferate');assert.equal(g.drawHistory,undefined);
});
