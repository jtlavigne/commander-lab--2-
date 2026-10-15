import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,transfer,advance,changeStep,endTurn,validateSession} from '../engine.mjs';
import {playLand,chooseEntryLife,activateMana,prioritySeat,passPriority,canRespond} from '../casting.mjs';
import {manaAbilities,manaTotals,reverseManaTap,payMana} from '../mana.mjs';
import {entryLifePayment,selfDamageAmount} from '../life-effects.mjs';

const card=(name,type_line,oracle_text,extra={})=>({name,instance:name,type_line,oracle_text,counters:{},face:0,tapped:false,...extra});
const fountain=()=>card('Hallowed Fountain','Land — Plains Island',"({T}: Add {W} or {U}.)\nAs this land enters, you may pay 2 life. If you don't, it enters tapped.");
const pain=()=>card('Adarkar Wastes','Land','{T}: Add {C}.\n{T}: Add {W} or {U}. This land deals 1 damage to you.');
const setup=()=>{const g=newGame();g.step=3;g.responseMode='hold';return g;};
test('shock lands offer an entry payment; paying changes only the entering controller’s life',()=>{
 const g=setup(),p=g.players[0],land=fountain();p.zones.hand=[land];playLand(g,land.instance);assert.equal(p.landsPlayed,1);assert.equal(p.life,40);assert.equal(land.tapped,true);assert.equal(land.entryLife.amount,2);
 const before=JSON.stringify(g);for(const action of [()=>advance(g),()=>changeStep(g,9),()=>endTurn(g),()=>activateMana(g,land.instance,'basic:U')])assert.throws(action,/pending|choice/);assert.equal(JSON.stringify(g),before);
 chooseEntryLife(g,land.instance,true);assert.equal(p.life,38);assert.equal(g.players[1].life,40);assert.equal(land.tapped,false);assert.equal(land.entryLife,undefined);
 activateMana(g,land.instance,'basic:U');assert.equal(manaTotals(p).U,1);assert.equal(p.life,38,'Shock lands do not charge life each time they tap');reverseManaTap(g,land);assert.equal(p.life,38);
 assert.throws(()=>chooseEntryLife(g,land.instance,true),/No life payment/);assert.equal(p.life,38);
});
test('shock choices survive reload, can be declined, and repeat only on a fresh entry',()=>{
 const g=setup(),land=fountain();g.players[1].zones.library=[land];transfer(g,land.instance,'battlefield',1);const restored=validateSession(structuredClone(g));chooseEntryLife(restored,land.instance,false);const c=restored.players[1].zones.battlefield[0];assert.equal(c.tapped,true);assert.equal(restored.players[1].life,40);
 transfer(restored,c.instance,'battlefield',2);assert.equal(c.entryLife,undefined);transfer(restored,c.instance,'exile',2);transfer(restored,c.instance,'battlefield',2);chooseEntryLife(restored,c.instance,true);assert.equal(restored.players[2].life,38);assert.equal(c.tapped,false);
 transfer(g,land.instance,'graveyard',1);assert.equal(land.entryLife,undefined);assert.doesNotThrow(()=>endTurn(g));
});
test('life payments require sufficient life, support old text, and do not override another tapped instruction',()=>{
 const g=setup(),land=fountain();g.players[0].life=1;g.players[0].zones.hand=[land];playLand(g,land.instance);const before=JSON.stringify(g);assert.throws(()=>chooseEntryLife(g,land.instance,true),/Not enough life/);assert.equal(JSON.stringify(g),before);chooseEntryLife(g,land.instance,false);assert.equal(g.players[0].life,1);
 for(const text of ["As Hallowed Fountain enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",'Hallowed Fountain enters tapped unless you pay 2 life.'])assert.equal(entryLifePayment({...land,oracle_text:text}),2);
 land.oracle_text+="\nThis land enters tapped.";transfer(g,land.instance,'hand',0);transfer(g,land.instance,'battlefield',0);g.players[0].life=2;chooseEntryLife(g,land.instance,true);assert.equal(g.players[0].life,0);assert.equal(land.tapped,true);
 assert.equal(entryLifePayment({...land,faceDown:true}),null);assert.equal(entryLifePayment({...land,oracle_text:'Whenever a creature enters, you may pay 2 life.'}),null);
 const bad=structuredClone(g);bad.players[0].zones.battlefield[0].entryLife={amount:-2,forcedTapped:false};assert.throws(()=>validateSession(bad));
});
test('pain lands deal damage once per colored activation, and corrective untaps restore only that activation',()=>{
 const g=setup(),p=g.players[0],land=pain();p.zones.battlefield=[land,card('Doubler','Enchantment','If you tap a land for mana, it produces twice as much of that mana instead.')];
 activateMana(g,land.instance,'own:0');assert.equal(p.life,40);assert.equal(manaTotals(p).C,2);reverseManaTap(g,land);
 activateMana(g,land.instance,'own:1',{outputIndex:1});assert.equal(p.life,39);assert.equal(manaTotals(p).U,2);assert.equal(g.stack.length,0);assert.equal(land.manaActivation.lifePaid,1);
 const saved=validateSession(structuredClone(g));reverseManaTap(saved,saved.players[0].zones.battlefield[0]);assert.equal(saved.players[0].life,40);assert.equal(manaTotals(saved.players[0]).U,0);
 reverseManaTap(g,land,{fromEffect:true});assert.equal(p.life,39);assert.equal(manaTotals(p).U,2);activateMana(g,land.instance,'own:1',{outputIndex:0});assert.equal(p.life,38);payMana(p,card('Spell','Instant',''),'{W}');assert.throws(()=>reverseManaTap(g,land),/spent/);assert.equal(p.life,38);
 assert.equal(selfDamageAmount(land,'Adarkar Wastes deals 1 damage to you.'),1);assert.equal(selfDamageAmount(land,'Whenever you tap this land, it deals 1 damage to you.'),0);
});
test('Dryad’s added abilities avoid a pain land’s printed damage clause',()=>{
 const g=setup(),p=g.players[0],land=pain();p.zones.battlefield=[land,card('Fixing','Enchantment','Lands you control are every basic land type in addition to their other types.')];activateMana(g,land.instance,'basic:R');assert.equal(manaTotals(p).R,1);assert.equal(p.life,40);
});
test('explicit activation life costs are paid before effects and refunded only by unspent mana corrections',()=>{
 const g=setup(),p=g.players[0],land=card('Mana source','Land','{T}, Pay 1 life: Add one mana of any color.');p.zones.battlefield=[land];const ability=manaAbilities(g,0,land)[0];assert.equal(ability.lifeCost,1);assert.equal(ability.manualCost,false);
 activateMana(g,land.instance,ability.id,{color:'B'});assert.equal(p.life,39);reverseManaTap(g,land);assert.equal(p.life,40);assert.equal(manaTotals(p).B,0);
 p.life=0;assert.throws(()=>activateMana(g,land.instance,ability.id,{color:'B'}),/Not enough life/);assert.equal(land.tapped,false);assert.equal(manaTotals(p).B,0);
 const fetch=card('Fetch','Land','{T}, Pay 1 life, Sacrifice this land: Search your library for a land card.');p.life=4;p.zones.battlefield=[fetch];activateMana(g,fetch.instance,'action:0');assert.equal(p.life,3);assert.equal(g.stack.length,1);assert.equal(p.zones.graveyard[0].instance,'Fetch');for(let i=0;i<4;i++)passPriority(g,prioritySeat(g));assert.equal(p.life,3);
});
test('pain mana simulation includes life loss without modifying the real player',()=>{
 const g=setup(),p=g.players[1];p.life=2;p.zones.battlefield=[pain()];p.zones.hand=[card('Phyrexian response','Instant','',{mana_cost:'{U}{U/P}'})];const before=JSON.stringify(g);assert.equal(canRespond(g,1),false);assert.equal(JSON.stringify(g),before);
});
