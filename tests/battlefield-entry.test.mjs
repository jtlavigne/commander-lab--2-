import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,transfer,advance,validateSession,resetGame} from '../engine.mjs';
import {playLand,chooseEntryLife,chooseEntryTapped,activateMana} from '../casting.mjs';
import {entryTapState,pendingEntry} from '../life-effects.mjs';
import {effectiveLandSubtypes} from '../ability-effects.mjs';
const card=(name,type_line,oracle_text='',extra={})=>({instance:crypto.randomUUID(),name,type_line,oracle_text,counters:{},...extra});
const land=(type='Forest')=>card('Unrelated name','Land — '+type);
const check=()=>card('Hinterland Harbor','Land','This land enters tapped unless you control a Forest or an Island.\n{T}: Add {G} or {U}.');
const dryad=()=>card('Dryad of the Ilysian Grove','Enchantment Creature — Nymph','Lands you control are every basic land type in addition to their other types.',{power:'2',toughness:'4'});
const game=(n=2)=>{const g=newGame(n);g.step=3;g.responseMode='hold';return g;};
function enter(g,c,owner=0,options={}){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,options);return c;}
test('check lands enter tapped without a matching land, untapped with either printed subtype',()=>{
 for(const type of [null,'Forest','Island','Plains','Forest Island','Island Mountain']){const g=game();if(type)enter(g,land(type));const c=enter(g,check());assert.equal(c.tapped,!type||type==='Plains',type);assert.equal(c.entryCondition,undefined);}
});
test('land subtype conditions read live Dryad effects and do not count the entering land itself',()=>{
 const g=game(),d=enter(g,dryad());assert.equal(enter(g,check()).tapped,true,'Dryad alone provides no existing land');
 const existing=g.players[0].zones.battlefield.find(c=>c.name==='Hinterland Harbor');assert.equal(existing.tapped,true,'Entry decisions are not retroactive');assert.ok(effectiveLandSubtypes(g,0,existing).includes('Forest'));
 assert.equal(enter(g,check()).tapped,false,'An existing land gains Forest and Island');
 transfer(g,d.instance,'graveyard',0);assert.equal(enter(g,check()).tapped,true,'Ordinary Harbors have neither printed basic subtype');
 const h=game();enter(h,dryad());const c=card('Typed check land','Land — Forest Island','This land enters tapped unless you control a Forest or an Island.');assert.equal(enter(h,c).tapped,true,'Even its own printed subtype cannot satisfy the pre-entry check');
});
test('Dryad must apply to lands of the entering controller, while opponents’ lands never satisfy control checks',()=>{
 const g=game();enter(g,dryad());enter(g,land('Mountain'));enter(g,land('Forest'),1);assert.equal(enter(g,check(),1).tapped,false);transfer(g,g.players[1].zones.battlefield[0].instance,'graveyard',1);enter(g,land('Mountain'),1);assert.equal(enter(g,check(),1).tapped,true);
 const d=g.players[0].zones.battlefield.find(c=>c.name==='Dryad of the Ilysian Grove');transfer(g,d.instance,'battlefield',1);assert.equal(enter(g,check(),1).tapped,false);assert.equal(enter(g,check()).tapped,true);
});
test('Chromatic Lantern gives mana abilities without satisfying basic-land-subtype checks',()=>{
 const g=game();enter(g,card('Chromatic Lantern','Artifact','Lands you control have "{T}: Add one mana of any color."'));enter(g,land('Mountain'));assert.equal(enter(g,check()).tapped,true);
});
test('and requires both land types; older card-name wording is also recognized',()=>{
 const g=game();enter(g,land('Forest'));let c=card('Both','Land','Both enters the battlefield tapped unless you control a Forest and an Island.');assert.equal(enter(g,c).tapped,true);enter(g,land('Island'));c=card('Both','Land','Both enters the battlefield tapped unless you control a Forest and an Island.');assert.equal(enter(g,c).tapped,false);
});
test('fast and slow land thresholds exclude the entering land and count only the controller’s lands',()=>{
 for(const [name,text,taps] of [['Copperline Gorge','This land enters tapped unless you control two or fewer other lands.',n=>n>2],['Dreamroot Cascade','This land enters tapped unless you control two or more other lands.',n=>n<2]])for(const count of [0,1,2,3,4]){const g=game();for(let n=0;n<count;n++)enter(g,land());for(let n=0;n<4;n++)enter(g,land(),1);assert.equal(enter(g,card(name,'Land',text)).tapped,taps(count),name+': '+count);}
});
test('basic-land counts use the Basic supertype, which Dryad does not grant',()=>{
 const g=game();enter(g,dryad());for(let n=0;n<3;n++)enter(g,land());const make=()=>card('Cinder Glade','Land — Mountain Forest','This land enters tapped unless you control two or more basic lands.');assert.equal(enter(g,make()).tapped,true);for(let n=0;n<2;n++)enter(g,card('Forest','Basic Land — Forest'));assert.equal(enter(g,make()).tapped,false);
});
test('opponent-count conditions distinguish two-, three-, and four-player games',()=>{
 for(const count of [2,3,4]){const g=game(count);assert.equal(enter(g,card('Spectator Seating','Land','This land enters tapped unless you have two or more opponents.')).tapped,count===2);}
});
test('other permanent conditions and if wording share the same condition evaluator',()=>{
 const g=game(),make=()=>card('Eiganjo Castle variant','Land','This land enters tapped unless you control a legendary creature.');assert.equal(enter(g,make()).tapped,true);enter(g,card('Legend','Legendary Creature','',{power:'2',toughness:'2'}));assert.equal(enter(g,make()).tapped,false);
 const h=game();enter(h,land());enter(h,land());assert.equal(enter(h,card('Conditional','Land','This land enters tapped if you control two or more other lands.')).tapped,true);
});
test('unconditional tapped entries work for every permanent type, with counters and active faces',()=>{
 for(const type of ['Land','Artifact','Creature','Enchantment','Planeswalker','Battle']){const g=game();enter(g,dryad());enter(g,land());const c=enter(g,card('Permanent',type,'This '+type.toLowerCase()+' enters tapped with two charge counters on it.'));assert.equal(c.tapped,true,type);assert.equal(c.counters.charge,2);}
 const g=game();const c=enter(g,card('Front // Back','Land','',{face:1,card_faces:[{name:'Front',type_line:'Land',oracle_text:''},{name:'Back',type_line:'Land',oracle_text:'Back enters tapped.'}]}));assert.equal(c.tapped,true);assert.equal(entryTapState({...c,faceDown:true},g,0).tapped,false);
});
test('global tapped-entry replacements apply to the proper controller and permanent types',()=>{
 const g=game();enter(g,card('Frozen Aether','Enchantment','Artifacts, creatures, and lands your opponents control enter tapped.'));assert.equal(enter(g,land()).tapped,false);assert.equal(enter(g,land(),1).tapped,true);assert.equal(enter(g,card('Rock','Artifact'),1).tapped,true);assert.equal(enter(g,card('Aura','Enchantment'),1).tapped,false);
 const h=game();enter(h,card('Root Maze','Enchantment','Artifacts and lands enter tapped.'));assert.equal(enter(h,land()).tapped,true);assert.equal(enter(h,land(),1).tapped,true);assert.equal(enter(h,card('Creature','Creature'),1).tapped,false);
});
test('an external tapped instruction is retained when a shock-land payment is accepted',()=>{
 for(const replacement of [false,true]){const g=game();if(replacement)enter(g,card('Orb of Dreams','Artifact','Permanents enter tapped.'));const c=enter(g,card('Hallowed Fountain','Land — Plains Island',"As this land enters, you may pay 2 life. If you don't, it enters tapped."),0,{entryTapped:!replacement});assert.equal(c.entryLife.forcedTapped,true);chooseEntryLife(g,c.instance,true);assert.equal(c.tapped,true);assert.equal(g.players[0].life,38);}
});
test('unknown entry conditions require an explicit decision, survive reload, and block actions',()=>{
 const g=game(),c=enter(g,card('Game Trail','Land','This land enters tapped unless you reveal a Mountain or Forest card from your hand.\n{T}: Add {R} or {G}.'));assert.ok(c.entryCondition);assert.equal(pendingEntry(g).card.instance,c.instance);assert.throws(()=>advance(g),/pending/);assert.throws(()=>activateMana(g,c.instance,'own:1'),/entry|choice/);const restored=validateSession(structuredClone(g));assert.equal(pendingEntry(restored).card.instance,c.instance);chooseEntryTapped(restored,c.instance,false);assert.equal(pendingEntry(restored),null);assert.equal(restored.players[0].zones.battlefield[0].tapped,false);assert.throws(()=>chooseEntryTapped(restored,c.instance,true),/No entry/);
 const reset=resetGame(g);assert.equal(pendingEntry(reset),null);transfer(g,c.instance,'hand',0);assert.equal(c.entryCondition,undefined);
});
test('control changes preserve tap state; fresh entries recheck the new battlefield',()=>{
 const g=game();enter(g,land());const c=enter(g,check());assert.equal(c.tapped,false);transfer(g,c.instance,'battlefield',1);assert.equal(c.tapped,false);transfer(g,c.instance,'hand',1);playLand({...g,active:1},c.instance);assert.equal(c.tapped,true);
});
test('tapped-entry instructions are not mistaken for attack triggers or untap effects',()=>{
 const g=game();for(const text of ['Whenever a land enters tapped, draw a card.','When this land enters, tap target land.','This land enters untapped.'])assert.equal(enter(g,card('Other text','Land',text)).tapped,false);
});
