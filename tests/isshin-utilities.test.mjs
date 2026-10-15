import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer} from '../engine.mjs';
import {castSpell,resolveTop,activateMana} from '../casting.mjs';
import {addMana,activatedAbilities,manaAbilities,manaTotals,reverseManaTap} from '../mana.mjs';
import {resolveOracleChoice,oracleChoiceOptions} from '../oracle-effects.mjs';
const base=new URL('./fixtures/commander/',import.meta.url),records=JSON.parse(readFileSync(new URL('oracle/isshin_two_heavens_as_one.json',base))).cards;
const card=name=>{const c=records.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{}};};
const game=()=>{const g=newGame(2);g.step=3;g.responseMode='hold';return g;};
function enter(g,name,owner=0){const c=card(name);g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);return c;}
for(const [name,colors] of [['Talisman of Conviction',['R','W']],['Talisman of Hierarchy',['W','B']],['Talisman of Indulgence',['B','R']]])test(name+' offers only printed colors, deals self-damage for colored mana and can reverse an unspent tap',()=>{
 for(const color of colors){const g=game(),source=enter(g,name);const abilities=manaAbilities(g,0,source);activateMana(g,source.instance,abilities[1].id,{outputIndex:colors.indexOf(color)});assert.equal(manaTotals(g.players[0])[color],1);assert.equal(g.players[0].life,39);assert.equal(source.tapped,true);reverseManaTap(g,source);assert.equal(g.players[0].life,40);assert.equal(manaTotals(g.players[0])[color],0);}
 const g=game(),source=enter(g,name);activateMana(g,source.instance,manaAbilities(g,0,source)[0].id);assert.equal(g.players[0].life,40);assert.equal(manaTotals(g.players[0]).C,1);
});
for(const name of ['Rakdos Carnarium','Orzhov Basilica','Bloodfell Caves','Scoured Barrens','Rakdos Guildgate','Orzhov Guildgate'])test(name+' enters tapped, applies printed entry actions on resolution and preserves its mana outputs',()=>{
 const g=game(),swamp=enter(g,'Swamp'),land=enter(g,name);assert.equal(land.tapped,true);
 if(/Carnarium|Basilica/.test(name)){assert.equal(g.stack.length,1);assert.ok(g.players[0].zones.battlefield.includes(swamp));resolveTop(g);assert.equal(g.pendingEffect.step.op,'selectMove');resolveOracleChoice(g,[swamp.instance]);assert.ok(g.players[0].zones.hand.includes(swamp));}
 else if(/Caves|Barrens/.test(name)){assert.equal(g.players[0].life,40);resolveTop(g);assert.equal(g.players[0].life,41);}
 assert.equal(g.pendingEffect,undefined);land.tapped=false;const ability=manaAbilities(g,0,land)[0];assert.ok(ability);activateMana(g,land.instance,ability.id,ability.output.alternatives?{outputIndex:0}:{});assert.ok(Object.values(manaTotals(g.players[0])).reduce((a,b)=>a+b,0)>0);
});
test('Terminate destroys its announced creature only after resolution; Anguished Unmaking excludes lands and loses life on resolution',()=>{
 for(const name of ['Terminate','Anguished Unmaking']){const g=game(),target=enter(g,'Krenko, Tin Street Kingpin',1),land=enter(g,'Swamp',1),spell=card(name);g.players[0].zones.hand.push(spell);addMana(g.players[0],{W:1,B:1,R:1,C:1});if(name==='Anguished Unmaking')assert.throws(()=>castSpell(g,spell.instance,{targets:['card:'+land.instance]}),/legal spell target/);castSpell(g,spell.instance,{targets:['card:'+target.instance]});assert.equal(g.players[0].life,40);assert.ok(g.players[1].zones.battlefield.includes(target));resolveTop(g);assert.ok(g.players[1].zones[name==='Terminate'?'graveyard':'exile'].includes(target));assert.equal(g.players[0].life,name==='Terminate'?40:37);assert.equal(g.pendingEffect,undefined);}
});
test('Rakdos Charm’s first two modes exile only the chosen graveyard or destroy only the chosen artifact',()=>{
 for(const mode of [0,1]){const g=game(),target=enter(g,'Sol Ring',1),spell=card('Rakdos Charm');g.players[0].zones.hand.push(spell);g.players[0].zones.graveyard=[card('Plains')];g.players[1].zones.graveyard=[card('Swamp')];addMana(g.players[0],{B:1,R:1});castSpell(g,spell.instance,{mode,targets:[mode?'card:'+target.instance:'player:1']});resolveTop(g);assert.equal(g.pendingEffect,undefined);if(mode){assert.ok(g.players[1].zones.graveyard.includes(target));assert.equal(g.players[1].zones.exile.length,0);}else{assert.equal(g.players[1].zones.exile.length,1);assert.equal(g.players[0].zones.exile.length,0);}}
});
test('shared utility audit reuses previous paragraph evidence only for exactly matching complete Oracle text',()=>{
 const progress=JSON.parse(readFileSync(new URL('checklist-progress.json',base))),previous=['goreclaw_terror_of_qal_sisma','aurelia_the_warleader','arahbo_roar_of_the_world'].map(id=>({id,cards:JSON.parse(readFileSync(new URL('oracle/'+id+'.json',base))).cards}));previous.push({id:'goreclaw_terror_of_qal_sisma',cards:JSON.parse(readFileSync(new URL('oracle-history/goreclaw_terror_of_qal_sisma.names-fixed.json',base))).cards});
 const audited=records.filter(c=>previous.some(p=>p.cards.some(old=>old.name===c.name&&old.oracle_text===c.oracle_text)));assert.ok(audited.length>=50);
 for(const c of audited){const source=previous.find(p=>p.cards.some(old=>old.name===c.name&&old.oracle_text===c.oracle_text)),paragraphs=c.oracle_text.split('\n').filter(Boolean);for(let i=0;i<paragraphs.length;i++)assert.ok(progress[source.id].verified_paragraphs[c.name]?.includes(i),c.name+' paragraph '+i);}
});
