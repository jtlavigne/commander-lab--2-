import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../engine.mjs';
import {addMana} from '../mana.mjs';
import {previewSpellMana} from '../mana-preview.mjs';

const card=(instance,type_line,oracle_text='',extra={})=>({instance,name:instance,type_line,oracle_text,counters:{},tapped:false,face:0,...extra});
const land=(id,type='Forest',extra={})=>card(id,'Basic Land — '+type,'',extra);
const spell=(id,cost,extra={})=>card(id,'Creature','',{mana_cost:cost,...extra});
function setup(){const g=newGame();g.step=3;g.responseMode='hold';return g;}

test('untapped lands preview hand and command payments without changing game state',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield=[land('f1'),land('f2')];
 p.zones.hand=[spell('bear','{1}{G}'),spell('blue','{U}'),spell('big','{3}{G}')];
 p.zones.command=[spell('commander','{G}{G}',{commander:true})];
 const before=structuredClone(g),preview=previewSpellMana(g,0);
 assert.deepEqual([...preview.keys()].sort(),['bear','commander']);
 assert.equal(preview.get('bear').floating,false);assert.deepEqual(g,before);
});
test('floating and available lands combine, while tapped and opposing lands do not',()=>{
 const g=setup(),p=g.players[0];addMana(p,{C:1});p.zones.battlefield=[land('f1'),land('f2','Forest',{tapped:true})];
 g.players[1].zones.battlefield=[land('opponent','Island')];p.zones.hand=[spell('bear','{1}{G}'),spell('blue','{U}'),spell('large','{2}{G}'),spell('free','{1}')];
 const preview=previewSpellMana(g,0);assert.deepEqual([...preview.keys()].sort(),['bear','free']);assert.equal(preview.get('free').floating,true);
});
test('commander tax changes the preview and each seat has its own resources',()=>{
 const g=setup(),p=g.players[0];p.zones.command=[spell('commander','{G}',{commander:true,commandCasts:1})];p.zones.battlefield=[land('f1'),land('f2')];
 assert.equal(previewSpellMana(g,0).has('commander'),false);p.zones.battlefield.push(land('f3'));assert.equal(previewSpellMana(g,0).has('commander'),true);
 g.players[1].zones.hand=[spell('other','{G}')];assert.equal(previewSpellMana(g,1).has('other'),false);
});
test('a multicolor source contributes one choice, never every color at once',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield=[card('triome','Land — Forest Island Mountain')];p.zones.hand=[spell('u','{U}'),spell('r','{R}'),spell('g','{G}'),spell('two','{U}{R}')];
 assert.deepEqual([...previewSpellMana(g,0).keys()].sort(),['g','r','u']);
});
test('Dryad and Lantern supply colors through shared battlefield mana rules',()=>{
 for(const fixer of [card('dryad','Enchantment Creature','Lands you control are every basic land type in addition to their other types.'),card('lantern','Artifact','Lands you control have "{T}: Add one mana of any color."')]){
  const g=setup(),p=g.players[0];p.zones.battlefield=[land('f'),fixer];p.zones.hand=[spell('blue','{U}')];assert.equal(previewSpellMana(g,0).has('blue'),true,fixer.name);
  p.zones.battlefield.pop();assert.equal(previewSpellMana(g,0).has('blue'),false);
 }
});
test('Exotic Orchard needs colors from opponents lands',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield=[card('orchard','Land','{T}: Add one mana of any color that a land an opponent controls could produce.')];p.zones.hand=[spell('blue','{U}'),spell('green','{G}')];
 assert.equal(previewSpellMana(g,0).size,0);g.players[1].zones.battlefield=[land('island','Island',{tapped:true})];assert.deepEqual([...previewSpellMana(g,0).keys()],['blue']);
});
test('filter activation costs must be funded before counting their output',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield=[card('filter','Land','{T}: Add {C}.\n{R/G}, {T}: Add {R}{R}, {R}{G}, or {G}{G}.')];p.zones.hand=[spell('red','{R}{R}'),spell('tooMuch','{R}{R}{R}')];
 assert.equal(previewSpellMana(g,0).size,0);p.zones.battlefield.push(land('forest'));assert.deepEqual([...previewSpellMana(g,0).keys()],['red']);
});
test('multipliers and selectable extra mana use actual source production',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield=[land('forest'),card('double','Enchantment','If you tap a permanent for mana, it produces twice as much of that mana instead.'),card('extra','Enchantment','',{manaSettings:{mode:'extra',scope:'Land',color:'choice',amount:1}})];
 p.zones.hand=[spell('mixed','{G}{G}{U}'),spell('four','{4}')];assert.deepEqual([...previewSpellMana(g,0).keys()],['mixed']);
});
test('snow, colorless and restricted mana remain distinct',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield=[card('restricted','Snow Land','{T}: Add {C}{C}. Spend this mana only to cast creature spells.')];
 p.zones.hand=[spell('snow','{S}{C}'),card('artifact','Artifact','',{mana_cost:'{1}'}),spell('blue','{U}')];assert.deepEqual([...previewSpellMana(g,0).keys()],['snow']);
});
test('unmodeled production and sacrifice costs do not invent affordable cards',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield=[card('unknown','Land','{T}: Add X mana of any one color.'),card('sac','Land','{T}, Sacrifice this land: Add {G}{G}.')];p.zones.hand=[spell('green','{G}')];assert.equal(previewSpellMana(g,0).size,0);
});
test('preview never substitutes potential mana for actual payment',async()=>{
 const {castSpell}=await import('../casting.mjs');const g=setup(),p=g.players[0];p.zones.battlefield=[land('f')];p.zones.hand=[spell('one','{G}')];
 assert.ok(previewSpellMana(g,0).has('one'));assert.throws(()=>castSpell(g,'one'),/cannot pay/);assert.equal(g.stack.length,0);assert.equal(p.zones.battlefield[0].tapped,false);
});
test('search is bounded and many equivalent basic lands reach expensive spells',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield=Array.from({length:20},(_,i)=>land('f'+i));p.zones.hand=[spell('large','{19}{G}'),spell('impossible','{U}')];
 const preview=previewSpellMana(g,0,{maxStates:64});assert.ok(preview.has('large'));assert.equal(preview.has('impossible'),false);
});
