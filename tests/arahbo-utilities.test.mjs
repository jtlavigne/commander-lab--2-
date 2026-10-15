import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,untap} from '../engine.mjs';
import {activateMana,castSpell,resolveTop} from '../casting.mjs';
import {manaAbilities,addMana,manaTotals,activationError} from '../mana.mjs';
import {oracleChoiceOptions,resolveOracleChoice} from '../oracle-effects.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/arahbo_roar_of_the_world.json',import.meta.url)));
const card=name=>{const c=fixture.cards.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{}};};
const game=()=>{const g=newGame(3);g.step=3;g.responseMode='hold';g.players[0].zones.command=[{...card('Arahbo, Roar of the World'),commander:true}];return g;};
function enter(g,name){const c=card(name);g.players[0].zones.hand.push(c);transfer(g,c.instance,'battlefield',0);return c;}
test('Arahbo current Oracle cache matches the revised CSV, with complete copies and a colorless Hearse',()=>{assert.equal(fixture.decklist_source,'commander_test_decks_color_fixes.csv');assert.equal(fixture.complete,true);assert.equal(fixture.cards.length,82);assert.equal(fixture.cards.reduce((n,c)=>n+c.quantity,0),100);assert.equal(fixture.cards.some(c=>c.name==='Nihil Spellbomb'),false);assert.deepEqual(fixture.cards.find(c=>c.name==='Unlicensed Hearse').color_identity,[]);});
for(const name of ['Arcane Signet',"Commander's Sphere",'Command Tower'])test('Arahbo utility: '+name+' offers its green/white identity only and produces the chosen color',()=>{
 for(const color of ['G','W']){const g=game(),c=enter(g,name),ability=manaAbilities(g,0,c)[0];assert.deepEqual([...ability.output.colors].sort(),['G','W']);activateMana(g,c.instance,ability.id,{color});assert.equal(manaTotals(g.players[0])[color],1);assert.equal(manaTotals(g.players[1])[color],0);}
});
for(const name of ['Selesnya Sanctuary','Blossoming Sands','Selesnya Guildgate'])test('Arahbo land: '+name+' enters tapped with the printed entry action on the stack',()=>{
 const g=game(),forest=enter(g,'Forest'),land=enter(g,name);assert.equal(land.tapped,true);assert.match(activationError(g,0,land,manaAbilities(g,0,land)[0]),/tapped/);
 if(name==='Selesnya Sanctuary'){resolveTop(g);assert.equal(g.pendingEffect.step.op,'selectMove');assert.ok(oracleChoiceOptions(g).some(c=>c.key===forest.instance));resolveOracleChoice(g,[forest.instance]);assert.ok(g.players[0].zones.hand.includes(forest));}
 if(name==='Blossoming Sands'){assert.equal(g.players[0].life,40);resolveTop(g);assert.equal(g.players[0].life,41);}
 untap(g,0);const ability=manaAbilities(g,0,land)[0];activateMana(g,land.instance,ability.id,{color:'W',outputIndex:1});assert.equal(manaTotals(g.players[0]).W,1);if(name==='Selesnya Sanctuary')assert.equal(manaTotals(g.players[0]).G,1);
});
test('Arahbo Path of Ancestry tracks the spent mana and scries only when casting a creature sharing the commander’s Cat type',()=>{
 const g=game(),path=enter(g,'Path of Ancestry'),spell=card('King of the Pride'),top=card('Forest');g.players[0].zones.hand.push(spell);g.players[0].zones.library.push(top);untap(g,0);activateMana(g,path.instance,manaAbilities(g,0,path)[0].id,{color:'W'});addMana(g.players[0],{C:2});castSpell(g,spell.instance);assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.pendingEffect.step.op,'scry');resolveOracleChoice(g,[]);assert.equal(g.players[0].zones.library[0],top);resolveTop(g);assert.ok(g.players[0].zones.battlefield.includes(spell));
});
test('unchanged utility Oracle paragraphs are identical to the already verified first/second-deck rules scenarios',()=>{
 const baseline=['goreclaw_terror_of_qal_sisma','aurelia_the_warleader'].flatMap(id=>JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/'+id+'.json',import.meta.url))).cards);
 const common=fixture.cards.filter(c=>baseline.some(b=>b.name===c.name));assert.ok(common.length>=40);for(const c of common)assert.ok(baseline.some(b=>b.name===c.name&&b.oracle_text===c.oracle_text&&b.mana_cost===c.mana_cost&&b.type_line===c.type_line),c.name+' needs a fresh audit');
});
