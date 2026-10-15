import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,resetGame,findCard} from '../engine.mjs';
import {castSpell,resolveTop,counterTop} from '../casting.mjs';
import {addMana} from '../mana.mjs';
import {copyStackEntry} from '../stack-effects.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards;
const card=(name,extra={})=>({...structuredClone(records.find(c=>c.name===name)||{name,type_line:'Artifact',oracle_text:''}),instance:crypto.randomUUID(),counters:{},...extra});
const game=()=>{const g=newGame(3);g.step=3;g.responseMode='hold';return g;};
function cast(g,c,counts,options={}){g.players[0].zones.hand.push(c);addMana(g.players[0],counts);return castSpell(g,c.instance,options);}

// Actual Atraxa fixtures exercise both single-color and hybrid Phyrexian mana.
for(const [name,counts,life,loyalty] of [
 ['Tamiyo, Compleated Sage',{C:2,G:2,U:1},0,5],
 ['Tamiyo, Compleated Sage',{C:2,G:1,U:2},0,5],
 ['Tamiyo, Compleated Sage',{C:2,G:1,U:1},2,3],
 ["Vraska, Betrayal's Sting",{C:4,B:2},0,6],
 ["Vraska, Betrayal's Sting",{C:4,B:1},2,4]
])test(name+' enters with '+loyalty+' loyalty after paying '+life+' Phyrexian life',()=>{
 let g=game();const c=card(name),entry=cast(g,c,counts,{allowLife:true});assert.equal(entry.castPayment.phyrexianLife,life);assert.equal(g.players[0].life,40-life);assert.equal(g.players[0].zones.battlefield.length,0);
 g=validateSession(structuredClone(g));resolveTop(g);const entered=findCard(g,c.instance).card;assert.equal(entered.counters.loyalty,loyalty);assert.equal(entered.entryChoices,undefined);
 // Counters changed by play, then a blink: neither the payment nor the edited
 // loyalty carries into the new permanent. A control change keeps counters.
 entered.counters.loyalty=2;transfer(g,c.instance,'battlefield',1);assert.equal(entered.counters.loyalty,2);transfer(g,c.instance,'exile',0);transfer(g,c.instance,'battlefield',0);assert.equal(entered.counters.loyalty,Number(c.loyalty));
});

test('unrelated additional life costs do not reduce compleated loyalty',()=>{
 const g=game(),provider=card('Life reducer',{type_line:'Creature',power:'4',toughness:'4',oracle_text:'As an additional cost to cast green permanent spells, you may pay 2 life. Those spells cost {G} less to cast if you paid life this way.'});g.players[0].zones.hand.push(provider);transfer(g,provider.instance,'battlefield',0);
 const c=card('Tamiyo, Compleated Sage'),entry=cast(g,c,{C:2,U:2},{allowLife:true,lifeReductions:[provider.instance]});assert.equal(g.players[0].life,38);assert.equal(entry.castPayment.phyrexianLife,0);resolveTop(g);assert.equal(c.counters.loyalty,5);
});

test('each Phyrexian symbol paid with life contributes to the entry record',()=>{
 const g=game(),c=card('Multiple symbols',{type_line:'Planeswalker',mana_cost:'{G/P}{U/P}',loyalty:'5',oracle_text:'Compleated'});cast(g,c,{}, {allowLife:true});resolveTop(g);assert.equal(g.players[0].life,36);assert.equal(c.counters.loyalty,1);
});

test('chosen X initializes entering counters after responses, survives reload, and is not requested again',()=>{
 let g=game();const c=card('X construct',{type_line:'Artifact Creature',power:'0',toughness:'0',mana_cost:'{X}{X}',oracle_text:'This creature enters with X +1/+1 counters on it.'}),entry=cast(g,c,{C:6},{x:3});assert.equal(entry.castX,3);assert.deepEqual(c.counters,{});
 g=validateSession(structuredClone(g));resolveTop(g);const entered=findCard(g,c.instance).card;assert.equal(entered.counters['+1/+1'],3);assert.equal(entered.entryChoices,undefined);
});

test('countering a paid spell does not initialize its entry state or refund life',()=>{
 const g=game(),c=card('Tamiyo, Compleated Sage');cast(g,c,{C:2,G:1,U:1},{allowLife:true});counterTop(g);assert.equal(g.players[0].life,38);assert.deepEqual(c.counters,{});assert.equal(c.castPayment,undefined);transfer(g,c.instance,'battlefield',0);assert.equal(c.counters.loyalty,5);
});

test('sunburst counts actual colors spent, including generic costs but excluding colorless',()=>{
 for(const [counts,want] of [[{W:1,U:1,C:1},2],[{U:3},1],[{C:3},0]]){
  const g=game(),c=card('Sunburst artifact',{mana_cost:'{3}',oracle_text:'Sunburst'}),entry=cast(g,c,counts);assert.equal(entry.castPayment.colors.length,want);resolveTop(g);assert.equal(c.counters.charge||0,want);assert.equal(c.entryChoices,undefined);
 }
});

test('a spell copy keeps X but does not inherit mana spent for sunburst',()=>{
 const g=game(),c=card('Copyable artifact',{mana_cost:'{X}',oracle_text:'Sunburst\nThis artifact enters with X oil counters on it.'}),original=cast(g,c,{W:1,U:1},{x:2}),copy=copyStackEntry(g,original,1);resolveTop(g);const token=findCard(g,copy.card.instance).card;assert.equal(token.token,true);assert.equal(token.counters.oil,2);assert.equal(token.counters.charge,undefined);resolveTop(g);assert.deepEqual(c.counters,{oil:2,charge:2});
});

test('casting history is public on the stack, absent from hidden hands and reset decks, and validated',()=>{
 const g=game(),c=card('Tamiyo, Compleated Sage');g.players[0].zones.hand.push(c);assert.ok(!JSON.stringify(projectGame(g,1)).includes('Tamiyo'));addMana(g.players[0],{C:2,U:1,G:1});castSpell(g,c.instance,{allowLife:true});assert.equal(projectGame(g,1).stack[0].castPayment.phyrexianLife,2);
 for(const value of [{phyrexianLife:1,colors:[]},{phyrexianLife:2,colors:['C']},{phyrexianLife:2,colors:['U','U']},{phyrexianLife:-2,colors:[]}]){const invalid=structuredClone(g);invalid.stack[0].castPayment=value;assert.throws(()=>validateSession(invalid));}
 const fresh=resetGame(g);assert.equal(fresh.stack.length,0);assert.ok(fresh.players.every(p=>Object.values(p.zones).flat().every(c=>!c.castPayment)));
});
