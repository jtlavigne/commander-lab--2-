import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,findCard} from '../engine.mjs';
import {castSpell,resolveTop,counterTop,activateMana,resolveProliferate,passPriority} from '../casting.mjs';
import {activatedAbilities,addMana} from '../mana.mjs';
import {effectTargetOptions} from '../effect-targets.mjs';
import {spellHasLegalChoices,retargetCopy} from '../spell-effects.mjs';
import {combatStats} from '../creature-rules.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards;
const card=(name,extra={})=>({instance:crypto.randomUUID(),name,type_line:'Creature',power:'2',toughness:'2',oracle_text:'',counters:{},...extra});
const real=name=>{const record=records.find(c=>c.name===name);assert.ok(record,name);return card(name,structuredClone(record));};
function game(){const g=newGame(2);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
function prepare(g){const spell=real('Smell Fear');g.players[0].zones.hand.push(spell);addMana(g.players[0],{G:2});return spell;}
const keys=(...cards)=>cards.map(c=>'card:'+c.instance);
function ability(g,staff,index){return activatedAbilities(g,0,staff).find(a=>a.id===(index===1?'own:':'action:')+index).id;}

test('Smell Fear requires a friendly target but permits omitting the opponent, including in playable previews',()=>{
 const g=game(),spell=prepare(g),other=enter(g,card('Opponent'),1);
 assert.equal(spellHasLegalChoices(g,0,spell),false);assert.throws(()=>castSpell(g,spell.instance,{targets:keys(other)}),/required group/);assert.throws(()=>castSpell(g,spell.instance,{targets:[]}),/number/);
 const own=enter(g,card('Friendly')),second=enter(g,card('Second friendly'));own.counters={'+1/+1':1};
 assert.throws(()=>castSpell(g,spell.instance,{targets:keys(own,second)}),/required group/);
 transfer(g,other.instance,'graveyard',1);assert.equal(spellHasLegalChoices(g,0,spell),true);
 castSpell(g,spell.instance,{targets:keys(own)});assert.equal(g.stack[0].targets[0].group,0);assert.equal(own.counters['+1/+1'],1);resolveTop(g);assert.equal(g.pendingEffect.kind,'proliferate');resolveProliferate(g,[own.instance]);assert.equal(own.counters['+1/+1'],2);assert.equal(own.markedDamage,undefined);assert.equal(g.pendingEffect,undefined);
});

test('Smell Fear proliferates before simultaneous fight damage and resumes its saved continuation',()=>{
 let g=game();const own=enter(g,card('Friendly')),other=enter(g,card('Opponent',{power:'3',toughness:'4'}),1),spell=prepare(g);own.counters={'+1/+1':1};
 castSpell(g,spell.instance,{targets:keys(other,own)});assert.deepEqual(g.stack[0].targets.map(t=>t.group),[0,1]);resolveTop(g);assert.equal(other.markedDamage,undefined);assert.throws(()=>passPriority(g,0),/pending/);
 g=validateSession(JSON.parse(JSON.stringify(g)));resolveProliferate(g,[own.instance]);const survivor=findCard(g,own.instance);assert.equal(combatStats(g,0,survivor.card).toughness,4);assert.equal(survivor.card.markedDamage,3);assert.equal(findCard(g,other.instance).zone,'graveyard');assert.equal(g.pendingEffect,undefined);
});

test('Smell Fear resolves proliferate with one legal target, but does nothing with no legal targets or when countered',()=>{
 for(const mode of ['ownGone','otherGone','bothGone','onlyGone','countered']){const g=game(),own=enter(g,card('Friendly')),other=enter(g,card('Opponent'),1),spell=prepare(g);g.players[0].poison=1;
 castSpell(g,spell.instance,{targets:mode==='onlyGone'?keys(own):keys(own,other)});
 if(['ownGone','bothGone','onlyGone'].includes(mode))transfer(g,own.instance,'hand',0);if(['otherGone','bothGone'].includes(mode))transfer(g,other.instance,'hand',1);
 if(mode==='countered')counterTop(g);else resolveTop(g);
 if(['ownGone','otherGone'].includes(mode)){assert.equal(g.pendingEffect.kind,'proliferate');resolveProliferate(g,[],[0]);assert.equal(g.players[0].poison,2);}else{assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].poison,1);}
 assert.ok(g.players.every(p=>p.zones.battlefield.every(c=>!c.markedDamage)));}
});

test('fight targets retain roles across control changes, blink, and copy retargeting',()=>{
 const g=game(),own=enter(g,card('Friendly')),alternative=enter(g,card('Alternative')),other=enter(g,card('Opponent'),1),spell=prepare(g);
 castSpell(g,spell.instance,{targets:keys(own)});const entry=g.stack[0];assert.throws(()=>retargetCopy(g,entry,keys(own,other)),/same number/);assert.throws(()=>retargetCopy(g,entry,keys(other)),/legal spell target/);assert.equal(retargetCopy(g,entry,keys(alternative)).targets[0].group,0);
 // Same card after leaving and returning is not the announced target.
 transfer(g,own.instance,'exile',0);transfer(g,own.instance,'battlefield',0);resolveTop(g);assert.equal(g.pendingEffect,undefined);
 const next=prepare(g);castSpell(g,next.instance,{targets:keys(own,other)});transfer(g,own.instance,'battlefield',1);resolveTop(g);assert.equal(g.pendingEffect.kind,'proliferate');resolveProliferate(g,[]);assert.ok(g.players[1].zones.battlefield.every(c=>!c.markedDamage));
});

test('Staff destruction targets ownership instead of control and pays life before opponents respond',()=>{
 const g=game(),staff=enter(g,real('Staff of Compleation')),stolen=enter(g,card('Mine elsewhere')),borrowed=enter(g,card('Theirs here'),1);
 transfer(g,stolen.instance,'battlefield',1);transfer(g,borrowed.instance,'battlefield',0);
 const action=activatedAbilities(g,0,staff).find(a=>a.id==='action:0'),options=effectTargetOptions(g,{owner:0,source:staff,text:action.text});
 assert.ok(options.some(o=>o.id===stolen.instance));assert.ok(!options.some(o=>o.id===borrowed.instance));assert.ok(options.some(o=>o.id===staff.instance));
 assert.throws(()=>activateMana(g,staff.instance,action.id,{targets:keys(borrowed)}),/legal ability targets/);assert.equal(g.players[0].life,40);assert.equal(staff.tapped,false);
 activateMana(g,staff.instance,action.id,{targets:keys(stolen)});assert.equal(g.players[0].life,39);assert.equal(staff.tapped,true);assert.equal(findCard(g,stolen.instance).zone,'battlefield');resolveTop(g);assert.equal(findCard(g,stolen.instance).zone,'graveyard');assert.equal(findCard(g,stolen.instance).owner,0);
});

test('Staff life-paid mana is immediate, accepts each color but not colorless, and validates before paying',()=>{
 for(const color of ['W','U','B','R','G']){const g=game(),staff=enter(g,real('Staff of Compleation'));assert.throws(()=>activateMana(g,staff.instance,ability(g,staff,1),{color:'C'}));assert.equal(g.players[0].life,40);assert.equal(staff.tapped,false);
 activateMana(g,staff.instance,ability(g,staff,1),{color});assert.equal(g.players[0].life,38);assert.equal(staff.tapped,true);assert.equal(g.players[0].mana[0].type,color);assert.equal(g.players[0].mana[0].amount,1);assert.equal(g.stack.length,0);}
 const g=game(),staff=enter(g,real('Staff of Compleation'));g.players[0].life=1;assert.throws(()=>activateMana(g,staff.instance,ability(g,staff,1),{color:'G'}),/life/i);assert.equal(staff.tapped,false);assert.equal(g.players[0].life,1);
});

test('Staff proliferate and draw are responseable with life costs retained when countered',()=>{
 for(const index of [2,3])for(const countered of [true,false]){let g=game();const staff=enter(g,real('Staff of Compleation'));staff.counters={charge:1};g.players[0].zones.library=[card('Draw')];activateMana(g,staff.instance,ability(g,staff,index));assert.equal(g.players[0].life,40-(index+1));assert.equal(g.players[0].zones.hand.length,0);assert.equal(staff.counters.charge,1);
 g=validateSession(JSON.parse(JSON.stringify(g)));if(countered)counterTop(g);else{resolveTop(g);if(index===2){assert.equal(g.pendingEffect.kind,'proliferate');resolveProliferate(g,[staff.instance]);}}
 assert.equal(g.players[0].life,40-(index+1));assert.equal(g.players[0].zones.hand.length,index===3&&!countered?1:0);assert.equal(findCard(g,staff.instance).card.counters.charge,index===2&&!countered?2:1);assert.equal(g.pendingEffect,undefined);}
});

test('Staff untap costs five mana, waits for resolution, and cannot untap a new incarnation',()=>{
 for(const mode of ['resolve','countered','blink']){const g=game(),staff=enter(g,real('Staff of Compleation'));staff.tapped=true;assert.throws(()=>activateMana(g,staff.instance,ability(g,staff,4)),/mana/i);addMana(g.players[0],{C:5});activateMana(g,staff.instance,ability(g,staff,4));assert.equal(g.players[0].mana.reduce((n,m)=>n+m.amount,0),0);assert.equal(staff.tapped,true);
 if(mode==='blink'){transfer(g,staff.instance,'exile',0);transfer(g,staff.instance,'battlefield',0);staff.tapped=true;}if(mode==='countered')counterTop(g);else resolveTop(g);assert.equal(staff.tapped,mode!=='resolve');assert.equal(g.pendingEffect,undefined);}
});
