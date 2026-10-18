import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,move,findCard,validateSession} from '../engine.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {counterChoiceOptions,applyOracleEffect} from '../oracle-effects.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/atraxa_praetors_voice.json',import.meta.url))).cards;
const real=name=>({...structuredClone(records.find(c=>c.name===name)),name,instance:crypto.randomUUID(),counters:{}});
const creature=(extra={})=>({name:'Entry visitor',instance:crypto.randomUUID(),type_line:'Creature',power:'0',toughness:'0',oracle_text:'This creature enters with two +1/+1 counters on it.',counters:{},...extra});
function game(){const g=newGame(2);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
function providers(g){enter(g,real('Doubling Season'));enter(g,real("Lae'zel, Vlaakith's Champion"));}
const act=(g,action,actor=0)=>reduceGameAction(g,action,actor).game;
function choice(g,op='add',actor=0){const option=counterChoiceOptions(g).find(r=>r.operation===op);assert.ok(option);return act(g,{type:'counterChoice',key:option.key},actor);}

test('manual placement stages replacements before entry, keeps position and never consumes a land play',()=>{
 let g=game();providers(g);const c=creature();g.players[0].zones.hand.push(c);
 g=act(g,{type:'move',id:c.instance,to:'battlefield',position:{x:.2,y:.6}});
 assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(findCard(g,c.instance).zone,'hand');assert.equal(g.players[0].landsPlayed,0);
 g=validateSession(JSON.parse(JSON.stringify(g)));g=choice(g);const found=findCard(g,c.instance);
 assert.equal(found.zone,'battlefield');assert.equal(found.card.counters['+1/+1'],6);assert.deepEqual(found.card.tablePosition,{x:.2,y:.6,normalized:true});assert.equal(g.players[0].landsPlayed,0);assert.equal(g.pendingEffect,undefined);
});

test('the direct move API also stages a fresh entry and preserves a battlefield reposition',()=>{
 let g=game();providers(g);const c=creature();g.players[0].zones.hand.push(c);
 assert.equal(move(g,0,c.instance,'battlefield'),c);assert.equal(findCard(g,c.instance).zone,'hand');assert.equal(g.pendingEffect.kind,'counter-choice');
 g=choice(g);const entered=findCard(g,c.instance).card,id=entered.battlefieldId;assert.equal(entered.counters['+1/+1'],6);
 assert.equal(move(g,0,c.instance,'battlefield'),entered);assert.equal(entered.battlefieldId,id);assert.equal(g.pendingEffect,undefined);validateSession(g);
});

test('direct local stack resolution waits for entry replacements and removes the stack card once',()=>{
 let g=game();providers(g);const c=creature();g.players[0].zones.hand.push(c);
 g=act(g,{type:'move',id:c.instance,to:'stack'});g=act(g,{type:'resolveTo',to:'battlefield'});
 assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.stack.length,1);assert.equal(findCard(g,c.instance).zone,'stack');
 g=validateSession(structuredClone(g));g=choice(g,'double');assert.equal(g.stack.length,0);assert.equal(findCard(g,c.instance).card.counters['+1/+1'],5);
 assert.equal(g.pendingEffect,undefined);assert.throws(()=>choice(g));validateSession(g);
});

test('land-play entry counters use replacements, reserve one play, and block a second play through reload',()=>{
 let g=game();enter(g,real('Doubling Season'));enter(g,real('Vorinclex, Monstrous Raider'),1);
 const land=real('Blast Zone'),next=real('Forest');g.players[0].zones.hand.push(land,next);
 g=act(g,{type:'playLand',id:land.instance,position:{x:.3,y:.8}});assert.equal(g.players[0].landsPlayed,1);assert.equal(findCard(g,land.instance).zone,'hand');assert.equal(g.pendingEffect.kind,'counter-choice');
 assert.throws(()=>act(g,{type:'playLand',id:next.instance}),/counter replacement/);g=validateSession(structuredClone(g));g=choice(g,'double');
 assert.equal(findCard(g,land.instance).card.counters.charge,1);assert.deepEqual(findCard(g,land.instance).card.tablePosition,{x:.3,y:.8,normalized:true});assert.equal(g.players[0].landsPlayed,1);assert.throws(()=>act(g,{type:'playLand',id:next.instance}),/land/i);validateSession(g);
});

test('repositioning and control changes preserve incarnation and counters without new entry choices',()=>{
 let g=game();providers(g);const c=enter(g,creature());c.counters['+1/+1']=9;const id=c.battlefieldId;
 g=act(g,{type:'move',id:c.instance,to:'battlefield',position:{x:.8,y:.4}});
 assert.equal(findCard(g,c.instance).card.battlefieldId,id);assert.equal(findCard(g,c.instance).card.counters['+1/+1'],9);assert.equal(g.pendingEffect,undefined);
 g=act(g,{type:'move',id:c.instance,to:'battlefield',owner:1});assert.equal(findCard(g,c.instance).owner,1);assert.equal(findCard(g,c.instance).card.battlefieldId,id);assert.equal(findCard(g,c.instance).card.counters['+1/+1'],9);assert.equal(g.pendingEffect,undefined);assert.equal(g.stack.length,0);
});

test('manual placement retains the original manual effect and defers entry triggers until its controller confirms',()=>{
 let g=game();providers(g);const c=creature({ownerSeat:1,oracle_text:'This creature enters with two +1/+1 counters on it.\nWhen this creature enters, draw a card.'});g.players[0].zones.graveyard.push(c);g.players[0].zones.library.push(real('Forest'));
 const manual={kind:'combat-manual',owner:1,name:'Manual return',text:'Return the selected card manually, then confirm.'};g.pendingEffect=manual;
 g=act(g,{type:'move',id:c.instance,to:'battlefield'});assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.pendingEffect.remaining[0].op,'resumeManualEffect');
 g=validateSession(JSON.parse(JSON.stringify(g)));g=choice(g);assert.deepEqual(g.pendingEffect,manual);assert.equal(g.stack.length,0);assert.equal(g.deferredTriggers.length,1);assert.equal(findCard(g,c.instance).card.ownerSeat,1);
 assert.throws(()=>reduceAction(g,{type:'manualResolved'},0),/No manual effect/);g=reduceAction(g,{type:'manualResolved'},1).game;assert.equal(g.pendingEffect,undefined);assert.equal(g.deferredTriggers,undefined);assert.equal(g.stack.length,1);
 g=act(g,{type:'resolveNow'});assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.players[1].zones.hand.length,0);validateSession(g);
});

test('manual entry cannot overwrite an automated resolution choice',()=>{
 const g=game(),c=creature();g.players[0].zones.hand.push(c);g.players[0].zones.library.push(real('Forest'),real('Island'));
 applyOracleEffect(g,{owner:0,name:'Scry',source:{instance:'scry',name:'Scry'},text:'Scry 1.'});const before=JSON.stringify(g);
 assert.throws(()=>act(g,{type:'move',id:c.instance,to:'battlefield'}),/pending effect/);assert.equal(JSON.stringify(g),before);assert.equal(findCard(g,c.instance).zone,'hand');
});

test('saved manual-entry continuations reject invalid controller and effect kinds',()=>{
 const g=game();providers(g);const c=creature();g.players[0].zones.hand.push(c);g.pendingEffect={kind:'combat-manual',owner:0,name:'Manual',text:'Resolve manually.'};
 const pending=act(g,{type:'move',id:c.instance,to:'battlefield'});validateSession(structuredClone(pending));
 for(const corrupt of [e=>e.owner=99,e=>e.kind='oracle-choice',e=>e.text=7]){const saved=structuredClone(pending);corrupt(saved.pendingEffect.remaining[0].effect);assert.throws(()=>validateSession(saved));}
});
