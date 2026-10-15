import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession,advance} from '../engine.mjs';
import {castSpell,resolveTop,passPriority,prioritySeat,counterTop,canRespond,activateLoyaltyAction} from '../casting.mjs';
import {addMana,manaTotals} from '../mana.mjs';
import {compileOracleEffect,resolveOracleChoice} from '../oracle-effects.mjs';
import {spellTargetOptions} from '../spell-effects.mjs';
const examples=JSON.parse(readFileSync(new URL('./fixtures/spell-resolution.json',import.meta.url))).cards;
const aurelia=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/aurelia_the_warleader.json',import.meta.url))).cards;
const card=(name,extra={})=>({...structuredClone([...examples,...aurelia].find(c=>c.name===name)||{name,type_line:'Creature',power:'2',toughness:'2',oracle_text:''}),instance:crypto.randomUUID(),counters:{},...extra});
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';g.players.forEach(p=>addMana(p,{W:20,U:20,B:20,R:20,G:20,C:20}));return g;};
const enter=(g,c,owner=0)=>{g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);return c;};
const cast=(g,c,options={},owner=0)=>{g.players[owner].zones.hand.push(c);return castSpell(g,c.instance,options);};
const passAll=g=>{for(let n=0;n<g.players.length;n++)passPriority(g,prioritySeat(g));};
test('real Oracle poison and draw instructions occur in order at resolution for every player count',()=>{
 for(const count of [2,3,4]){const g=game(count),spell=card('Prologue to Phyresis'),draw=card('Plains');g.players[0].zones.library=[draw];cast(g,spell);assert.ok(g.players.every(p=>p.poison===0));assert.equal(g.players[0].zones.library.length,1);assert.equal(g.stack[0].card.instance,spell.instance);for(let n=0;n<count-1;n++){passPriority(g,prioritySeat(g));assert.ok(g.players.every(p=>p.poison===0));}passPriority(g,prioritySeat(g));assert.deepEqual(g.players.map(p=>p.poison),[0,...Array(count-1).fill(1)]);assert.ok(g.players[0].zones.hand.includes(draw));assert.equal(g.players[0].zones.graveyard[0].instance,spell.instance);assert.equal(g.stack.length,0);}
});
test('real multi-sentence sorcery draws, loses life and gives opponents poison without changing unrelated players',()=>{
 const g=game(3);g.players[0].zones.library=[card('Plains'),card('Mountain')];cast(g,card('Infectious Inquiry'));assert.equal(g.players[0].life,40);passAll(g);assert.equal(g.players[0].zones.hand.length,2);assert.deepEqual(g.players.map(p=>p.life),[38,40,40]);assert.deepEqual(g.players.map(p=>p.poison),[0,1,1]);
});
test('countering a spell prevents every instruction; a response resolves first and retains the original spell',()=>{
 const g=game();g.players[0].zones.library=[card('Plains')];const original=card('Prologue to Phyresis');cast(g,original);counterTop(g);assert.ok(g.players.every(p=>p.poison===0));assert.equal(g.players[0].zones.hand.length,0);
 const h=game();h.players[0].zones.library=[card('Plains')];h.players[1].zones.library=[card('Mountain')];cast(h,card('Prologue to Phyresis'));passPriority(h,0);const response=card('Response',{type_line:'Instant',mana_cost:'{U}',oracle_text:'Draw a card.'});cast(h,response,{},1);passAll(h);assert.equal(h.players[1].zones.hand.length,1);assert.ok(h.players.every(p=>p.poison===0));assert.equal(h.stack.length,1);passAll(h);assert.equal(h.players[1].poison,1);
});
test('unsupported instruction sequences never execute just their recognized prefix',()=>{
 const g=game(),spell=card('Unknown',{type_line:'Sorcery',mana_cost:'{0}',oracle_text:'Each opponent gets a poison counter. Do something entirely unfamiliar. Draw a card.'});g.players[0].zones.library=[card('Plains')];assert.equal(compileOracleEffect(spell.oracle_text),null);cast(g,spell);passAll(g);assert.equal(g.pendingEffect.kind,'combat-manual');assert.ok(g.players.every(p=>p.poison===0));assert.equal(g.players[0].zones.hand.length,0);assert.throws(()=>advance(g),/pending/);
});
test('poison prevention affects its controller while the rest of a resolving spell still happens',()=>{
 const g=game(3);enter(g,card('Prevention',{type_line:'Creature',oracle_text:"You can't get poison counters."}),1);g.players[0].zones.library=[card('Plains')];cast(g,card('Prologue to Phyresis'));passAll(g);assert.deepEqual(g.players.map(p=>p.poison),[0,0,1]);assert.equal(g.players[0].zones.hand.length,1);
});
test('target choices are validated before mana payment and survive reload while opponents can respond',()=>{
 const g=game(),target=enter(g,card('Target'),1),spell=card('Swords to Plowshares');g.players[0].zones.hand.push(spell);const before=JSON.stringify(g);assert.throws(()=>castSpell(g,spell.instance),/targets/);assert.equal(JSON.stringify(g),before);assert.throws(()=>castSpell(g,spell.instance,{targets:['card:missing']}),/legal/);assert.equal(JSON.stringify(g),before);castSpell(g,spell.instance,{targets:['card:'+target.instance]});assert.equal(g.players[1].zones.battlefield.length,1);const loaded=validateSession(structuredClone(g));assert.equal(loaded.stack[0].targets[0].id,target.instance);passAll(loaded);assert.equal(loaded.players[1].zones.exile[0].instance,target.instance);assert.equal(loaded.players[1].life,42);
});
test('Swords uses current power and current controller, while exiling to the owner’s zone',()=>{
 const g=game(3),target=enter(g,card('Target',{power:'4',toughness:'4'}),1);cast(g,card('Swords to Plowshares'),{targets:['card:'+target.instance]});transfer(g,target.instance,'battlefield',2);target.counters['+1/+1']=2;passAll(g);assert.equal(g.players[2].life,46);assert.equal(g.players[1].life,40);assert.ok(g.players[1].zones.exile.includes(target));
 const h=game(),negative=enter(h,card('Negative',{power:'-1',toughness:'2'}),1);cast(h,card('Swords to Plowshares'),{targets:['card:'+negative.instance]});passAll(h);assert.equal(h.players[1].life,40);
});
test('a blinked target or new hexproof makes the entire targeted spell fail, including its draw',()=>{
 for(const blink of [false,true]){const g=game(),target=enter(g,card('Target'),1),spell=card('Exile and draw',{type_line:'Instant',mana_cost:'{0}',oracle_text:'Exile target creature. Draw a card.'});g.players[0].zones.library=[card('Plains')];cast(g,spell,{targets:['card:'+target.instance]});if(blink){transfer(g,target.instance,'exile',1);transfer(g,target.instance,'battlefield',1);}else target.temporaryKeywords=['hexproof'];passAll(g);assert.ok(g.players[1].zones.battlefield.includes(target));assert.equal(g.players[0].zones.hand.length,0);assert.equal(g.pendingEffect,undefined);}
});
test('Path’s optional search is controlled by the target’s controller and the spell stays resolving until it finishes',()=>{
 const g=game(),target=enter(g,card('Target'),1),basic=card('Plains');g.players[1].zones.library=[basic];const spell=card('Path to Exile');cast(g,spell,{targets:['card:'+target.instance]});passAll(g);assert.equal(g.pendingEffect.owner,1);assert.equal(g.pendingEffect.step.op,'optional');assert.equal(g.stack[0].card.instance,spell.instance);assert.equal(g.stack[0].resolving,true);assert.equal(g.players[0].zones.graveyard.length,0);assert.throws(()=>passPriority(g,0),/pending/);assert.doesNotThrow(()=>validateSession(structuredClone(g)));resolveOracleChoice(g,['yes']);assert.equal(g.pendingEffect.owner,1);resolveOracleChoice(g,[basic.instance]);assert.equal(g.stack.length,0);assert.ok(g.players[0].zones.graveyard.includes(spell));assert.equal(basic.tapped,true);assert.ok(g.players[1].zones.battlefield.includes(basic));
});
test('Generous Gift gives the target’s controller a token even when indestructible prevents destruction',()=>{
 for(const indestructible of [false,true]){const g=game(),target=enter(g,card('Permanent',{oracle_text:indestructible?'Indestructible':''}),1);cast(g,card('Generous Gift'),{targets:['card:'+target.instance]});passAll(g);const token=g.players[1].zones.battlefield.find(c=>c.token);assert.equal(token.name,'Elephant');assert.equal(token.power,'3');assert.equal(token.toughness,'3');assert.equal(g.players[1].zones.graveyard.includes(target),!indestructible);}
});
test('Boros Charm announces a mode and target before responses; only that mode resolves',()=>{
 const g=game(),walker=enter(g,card('Walker',{type_line:'Planeswalker',loyalty:'5'}),1);const spell=card('Boros Charm');assert.ok(spellTargetOptions(g,0,spell,{mode:0}).some(t=>t.id===walker.instance));assert.throws(()=>cast(g,spell,{targets:['player:1']}),/mode/);const entry=castSpell(g,spell.instance,{mode:0,targets:['card:'+walker.instance]});assert.equal(entry.mode,0);assert.equal(walker.counters.loyalty,5);passAll(g);assert.equal(walker.counters.loyalty,1);assert.equal(g.players[1].life,40);
 const h=game(),target=enter(h,card('Target'));cast(h,card('Boros Charm'),{mode:2,targets:['card:'+target.instance]});passAll(h);assert.ok(target.temporaryKeywords.includes('double strike'));assert.equal(h.players[1].life,40);
});
test('a targeted instant without any legal targets does not falsely hold automatic response priority',()=>{
 const g=game();g.players[1].zones.hand=[card('Swords to Plowshares')];assert.equal(canRespond(g,1),false);enter(g,card('Target'));assert.equal(canRespond(g,1),true);
});
test('Aurelia: Boros Charm indestructibility applies only on resolution and to its controller’s permanents',()=>{
 const g=game(),own=enter(g,card('Own')),other=enter(g,card('Other'),1);cast(g,card('Boros Charm'),{mode:1});assert.equal(own.temporaryKeywords,undefined);passAll(g);assert.ok(own.temporaryKeywords.includes('indestructible'));assert.equal(other.temporaryKeywords,undefined);
});
test('Aurelia: Chaos Warp shuffles into the owner’s library and puts a revealed permanent onto the battlefield',()=>{
 const g=game(3),target=enter(g,card('Mountain'),1);transfer(g,target.instance,'battlefield',2);cast(g,card('Chaos Warp'),{targets:['card:'+target.instance]});passAll(g);assert.ok(g.players[1].zones.battlefield.includes(target));assert.equal(g.players[2].zones.battlefield.length,0);assert.equal(g.players[1].zones.library.length,0);assert.ok(g.log.some(s=>s.includes('reveals Mountain')));
});
test('Aurelia: Chaos Warp leaves a revealed instant in the library and applies a revealed permanent’s entry rules',t=>{
 t.mock.method(Math,'random',()=>.99);
 for(const reveal of ['Boros Charm','Worn Powerstone']){const g=game(),target=enter(g,card('Mountain'),1),top=card(reveal);g.players[1].zones.library=[top];cast(g,card('Chaos Warp'),{targets:['card:'+target.instance]});passAll(g);if(reveal==='Boros Charm'){assert.equal(g.players[1].zones.library[0].instance,top.instance);assert.equal(g.players[1].zones.battlefield.length,0);}else{assert.ok(g.players[1].zones.battlefield.includes(top));assert.equal(top.tapped,true);}}
});
test('a later unconditional instruction still happens when an optional search is declined',()=>{
 const g=game(),draw=card('Mountain');g.players[0].zones.library=[draw];const spell=card('Optional search and draw',{type_line:'Sorcery',mana_cost:'{0}',oracle_text:'You may search your library for a basic land card, put it onto the battlefield tapped, then shuffle. Draw a card.'});cast(g,spell);passAll(g);assert.equal(g.pendingEffect.step.op,'optional');resolveOracleChoice(g,['no']);assert.ok(g.players[0].zones.hand.includes(draw));assert.equal(g.players[0].zones.battlefield.length,0);assert.equal(g.stack.length,0);
});
test('scry can bottom a card before a subsequent draw, with the spell still on the stack during the choice',()=>{
 const g=game(),top=card('Plains'),next=card('Mountain');g.players[0].zones.library=[top,next];cast(g,card('Scry and draw',{type_line:'Instant',mana_cost:'{0}',oracle_text:'Scry 1. Draw a card.'}));passAll(g);assert.equal(g.pendingEffect.step.op,'scry');assert.equal(g.players[0].zones.hand.length,0);assert.equal(g.stack[0].resolving,true);assert.doesNotThrow(()=>validateSession(structuredClone(g)));resolveOracleChoice(g,[top.instance]);assert.ok(g.players[0].zones.hand.includes(next));assert.equal(g.players[0].zones.library[0].instance,top.instance);assert.equal(g.stack.length,0);
});
test('scry orders all cards kept on top before continuing a multi-instruction spell',()=>{
 const g=game(),list=['Plains','Mountain','Plains','Mountain'].map(name=>card(name));g.players[0].zones.library=[...list];cast(g,card('Scry three',{type_line:'Sorcery',mana_cost:'{0}',oracle_text:'Scry 3. Draw a card.'}));passAll(g);resolveOracleChoice(g,[list[2].instance]);assert.equal(g.pendingEffect.step.op,'orderTop');assert.throws(()=>resolveOracleChoice(g,[list[0].instance]),/at least/);assert.doesNotThrow(()=>validateSession(structuredClone(g)));resolveOracleChoice(g,[list[1].instance,list[0].instance]);assert.equal(g.players[0].zones.hand[0].instance,list[1].instance);assert.deepEqual(g.players[0].zones.library.map(c=>c.instance),[list[0],list[3],list[2]].map(c=>c.instance));
});
test('scry can keep the top card and an empty library needs no choice',()=>{
 for(const empty of [false,true]){const g=game(),top=card('Plains');if(!empty)g.players[0].zones.library=[top];cast(g,card('Scry',{type_line:'Instant',mana_cost:'{0}',oracle_text:'Scry 1.'}));passAll(g);if(empty)assert.equal(g.pendingEffect,undefined);else{resolveOracleChoice(g,[]);assert.ok(g.players[0].zones.library.includes(top));}assert.equal(g.stack.length,0);}
});
test('variable planeswalker draw effects use the X paid at activation and wait for resolution',()=>{
 const g=game(),walker=enter(g,card('Variable walker',{type_line:'Planeswalker',loyalty:'5',oracle_text:'−X: Draw X cards.'}));g.players[0].zones.library=[card('Plains'),card('Mountain'),card('Plains')];activateLoyaltyAction(g,walker.instance,0,2);assert.equal(walker.counters.loyalty,3);assert.equal(g.players[0].zones.hand.length,0);passAll(g);assert.equal(g.players[0].zones.hand.length,2);assert.equal(g.pendingEffect,undefined);
});
