import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,findCard,validateSession,resetGame} from '../engine.mjs';
import {createTokenCopies} from '../tokens.mjs';
import {castSpell,resolveTop,activateLoyaltyAction} from '../casting.mjs';
import {chooseTriggerTarget} from '../combat-effects.mjs';
import {counterChoiceOptions,resolveCounterChoice,applyOracleEffect,resolveOracleChoice} from '../oracle-effects.mjs';
import {addMana,activatedAbilities} from '../mana.mjs';
import {combatStats} from '../creature-rules.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const records=['commander/oracle/atraxa_praetors_voice','commander/oracle/kess_dissident_mage','playtest-decks/jace','playtest-decks/atraxa'].flatMap(path=>JSON.parse(readFileSync(new URL('./fixtures/'+path+'.json',import.meta.url))).cards);
const real=name=>{const c=records.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{}};};
const bear=(name='Counter bear')=>({name,instance:crypto.randomUUID(),type_line:'Creature',mana_cost:'{3}',power:'0',toughness:'0',oracle_text:'This creature enters with two +1/+1 counters on it.\n{T}: Add {G}.',counters:{}});
function game(){const g=newGame(2);g.step=3;g.responseMode='hold';return g;}
function enter(g,c,owner=0){c=typeof c==='string'?real(c):c;g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;}
function grave(g,c,owner=0){c=typeof c==='string'?real(c):c;c.ownerSeat=owner;c.zoneChangeId=crypto.randomUUID();g.players[owner].zones.graveyard.push(c);return c;}
function cast(g,name,targets=[]){const c=real(name);g.players[0].zones.hand.push(c);addMana(g.players[0],{W:10,U:10,B:10,R:10,G:10,C:10});castSpell(g,c.instance,{targets:targets.map(c=>'card:'+c.instance)});return c;}
function select(g,operation){const choice=counterChoiceOptions(g).find(r=>r.operation===operation);assert.ok(choice,operation);resolveCounterChoice(g,choice.key);}
function providers(g){enter(g,'Vorinclex, Monstrous Raider');enter(g,"Lae'zel, Vlaakith's Champion");}
function effect(g,text){assert.equal(applyOracleEffect(g,{owner:0,name:'Effect',source:{instance:'effect',name:'Effect'},text}),true);}

test('manual copied walkers wait outside card zones, retain abilities and use printed starting loyalty',()=>{
 let g=game();const source=enter(g,'Tamiyo, Field Researcher',1);source.counters.loyalty=1;source.tapped=true;providers(g);const hand=g.players[0].zones.hand.length;createTokenCopies(g,0,source,2,{nonlegendary:true});
 assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.pendingEffect.entryRequests.length,2);assert.equal(g.players[0].zones.hand.length,hand);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,0);assert.equal(projectGame(g,1).pendingEffect.kind,'remote-choice');
 g=validateSession(JSON.parse(JSON.stringify(g)));select(g,'add');assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,0);select(g,'double');const copies=g.players[0].zones.battlefield.filter(c=>c.token);assert.deepEqual(copies.map(c=>c.counters.loyalty),[10,9]);assert.ok(copies.every(c=>!c.type_line.includes('Legendary')&&!c.tapped&&c.oracle_text===source.oracle_text));assert.equal(g.players[1].zones.battlefield[0].counters.loyalty,1);validateSession(g);
});

test('resolved copy instructions wait for entry choices before drawing and do not replay the token creation',()=>{
 let g=game();providers(g);const source=enter(g,bear());source.counters['+1/+1']=9;g.players[0].zones.library=[{...real('Forest'),instance:'after-copy'}];
 assert.equal(applyOracleEffect(g,{owner:0,name:'Copy then draw',source:{instance:'effect',name:'Effect'},text:"Create a token that's a copy of target creature. Draw a card.",targets:[{kind:'card',id:source.instance,owner:0,battlefieldId:source.battlefieldId}]}),true);
 assert.equal(g.players[0].zones.hand.length,0);const id=g.pendingEffect.entryRequests[0].id;g=validateSession(structuredClone(g));select(g,'add');const token=findCard(g,id).card;assert.equal(token.counters['+1/+1'],6);assert.equal(activatedAbilities(g,0,token).length,1);assert.equal(g.players[0].zones.hand[0].instance,'after-copy');assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,1);assert.equal(g.pendingEffect,undefined);
});

test('Tamiyo exiles a graveyard walker then its copied entry preserves X and replacement choices',()=>{
 let g=game();const tamiyo=enter(g,'Tamiyo, Compleated Sage');tamiyo.counters.loyalty=10;providers(g);const source=grave(g,'Teferi, Temporal Archmage');activateLoyaltyAction(g,tamiyo.instance,1,6);chooseTriggerTarget(g,g.stack.at(-1).id,['card:'+source.instance]);resolveTop(g);assert.equal(findCard(g,source.instance).zone,'exile');assert.equal(g.pendingEffect.kind,'counter-choice');const tokenId=g.pendingEffect.entryRequests[0].id;
 g=validateSession(structuredClone(g));select(g,'double');assert.equal(findCard(g,tokenId).card.counters.loyalty,Number(source.loyalty)*2+1);assert.equal(findCard(g,source.instance).zone,'exile');assert.equal(g.players[0].zones.battlefield.find(c=>c.instance===tamiyo.instance).counters.loyalty,4);
});

test('populate copies intrinsic entering counters and waits before the next instruction',()=>{
 const g=game();const source=enter(g,{...bear(),token:true});source.counters['+1/+1']=8;providers(g);g.players[0].zones.library=[real('Forest')];effect(g,'Populate. Draw a card.');resolveOracleChoice(g,[source.instance]);assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.players[0].zones.hand.length,0);select(g,'double');const copy=g.players[0].zones.battlefield.find(c=>c.token&&c.instance!==source.instance);assert.equal(copy.counters['+1/+1'],5);assert.equal(g.players[0].zones.hand.length,1);
});

test('Reanimate delays life loss and later triggers until its foreign-owned creature has entered',()=>{
 let g=game();providers(g);const target=grave(g,bear(),1),spell=cast(g,'Reanimate',[target]);resolveTop(g);assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.players[0].life,40);assert.equal(findCard(g,target.instance).zone,'graveyard');assert.equal(findCard(g,spell.instance).zone,'stack');
 g=validateSession(structuredClone(g));select(g,'add');const found=findCard(g,target.instance);assert.equal(found.owner,0);assert.equal(found.card.ownerSeat,1);assert.equal(found.card.counters['+1/+1'],6);assert.equal(g.players[0].life,37);assert.equal(findCard(g,spell.instance).zone,'graveyard');assert.equal(g.pendingEffect,undefined);
});

test('Primevals returns one simultaneous batch without letting incoming Vorinclex modify the other entries',()=>{
 const g=game();enter(g,'Doubling Season');enter(g,'Tamiyo, Compleated Sage');const walker=grave(g,'Tamiyo, Field Researcher'),incoming=grave(g,'Vorinclex, Monstrous Raider'),spell=cast(g,"Primevals' Glorious Rebirth");resolveTop(g);assert.equal(walker.counters.loyalty,Number(walker.loyalty)*2);assert.equal(findCard(g,incoming.instance).zone,'battlefield');assert.equal(findCard(g,spell.instance).zone,'graveyard');assert.equal(g.pendingEffect,undefined);
});

test('Victimize pays sacrifice once before two pending entries, then returns both tapped before triggers',()=>{
 let g=game();providers(g);const fodder=enter(g,{...bear('Fodder'),power:'1',toughness:'1',oracle_text:''}),a=grave(g,bear('A')),b=grave(g,bear('B')),spell=cast(g,'Victimize',[a,b]);resolveTop(g);resolveOracleChoice(g,[fodder.instance]);assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(findCard(g,fodder.instance).zone,'graveyard');assert.equal(findCard(g,a.instance).zone,'graveyard');assert.equal(findCard(g,b.instance).zone,'graveyard');g=validateSession(structuredClone(g));select(g,'add');assert.equal(findCard(g,a.instance).zone,'graveyard');select(g,'double');assert.equal(findCard(g,a.instance).card.counters['+1/+1'],6);assert.equal(findCard(g,b.instance).card.counters['+1/+1'],5);assert.ok([a,b].every(c=>findCard(g,c.instance).card.tapped));assert.equal(findCard(g,spell.instance).zone,'graveyard');assert.equal(g.pendingEffect,undefined);
});

test('a replacement provider sacrificed to Victimize is absent from the entry plan',()=>{
 const g=game();enter(g,'Branching Evolution');const snake=enter(g,'Winding Constrictor'),a=grave(g,bear('A')),b=grave(g,bear('B'));cast(g,'Victimize',[a,b]);resolveTop(g);resolveOracleChoice(g,[snake.instance]);assert.equal(g.pendingEffect,undefined);assert.equal(a.counters['+1/+1'],4);assert.equal(b.counters['+1/+1'],4);assert.equal(findCard(g,snake.instance).zone,'graveyard');
});

test('Animate Dead waits for replacement order, attaches before state actions, and retains its sacrifice link',()=>{
 let g=game();providers(g);const target=grave(g,bear(),1),aura=cast(g,'Animate Dead',[target]);resolveTop(g);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(findCard(g,target.instance).zone,'graveyard');assert.equal(findCard(g,aura.instance).zone,'battlefield');g=validateSession(structuredClone(g));select(g,'add');const returned=findCard(g,target.instance).card,liveAura=findCard(g,aura.instance).card;assert.equal(liveAura.attachedTo,returned.instance);assert.equal(liveAura.reanimationLink.battlefieldId,returned.battlefieldId);assert.equal(combatStats(g,0,returned).power,5);transfer(g,aura.instance,'graveyard',0);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(findCard(g,target.instance).zone,'graveyard');assert.equal(findCard(g,target.instance).owner,1);
});

test('pending token entries reject malformed metadata and reset without adding phantom deck cards',()=>{
 const g=game();providers(g);const source=enter(g,bear());createTokenCopies(g,0,source);const id=g.pendingEffect.entryRequests[0].id;
 for(const mutate of [r=>r.token.instance='other',r=>r.token.token=false,r=>r.token.counters={charge:2},r=>r.token.oracle_text=5,r=>r.from='hand']){const bad=structuredClone(g);mutate(bad.pendingEffect.entryRequests[0]);assert.throws(()=>validateSession(bad));}
 const fresh=resetGame(g);assert.equal(fresh.pendingEffect,undefined);assert.ok(!fresh.players.some(p=>Object.values(p.zones).flat().some(c=>c.instance===id)));assert.ok(!JSON.stringify(fresh).includes('entryRequests'));
});

test('Doubling Season doubles Elspeth tokens without multiplying a one-or-more creation trigger',()=>{
 const g=game();enter(g,'Doubling Season');const staff=enter(g,'Staff of the Storyteller'),walker=enter(g,"Elspeth, Sun's Champion");activateLoyaltyAction(g,walker.instance,0);resolveTop(g);assert.equal(g.players[0].zones.battlefield.filter(c=>c.token&&c.name==='Soldier').length,6);assert.equal(g.stack.length,1);assert.equal(g.stack[0].source.instance,staff.instance);resolveTop(g);assert.equal(staff.counters.story,2);assert.equal(g.pendingEffect,undefined);
});

test('copied planeswalkers are doubled in number and each enters with separately doubled loyalty',()=>{
 const g=game();enter(g,'Doubling Season');const source=enter(g,'Tamiyo, Field Researcher',1);createTokenCopies(g,0,source,1,{nonlegendary:true});const tokens=g.players[0].zones.battlefield.filter(c=>c.token);assert.equal(tokens.length,2);assert.ok(tokens.every(c=>c.counters.loyalty===Number(source.loyalty)*2));assert.equal(g.players[1].zones.battlefield[0].counters.loyalty,Number(source.loyalty));
});

test('token-count providers are live, controller-scoped and each applies once, including zero-token effects',()=>{
 const g=game();const a=enter(g,'Doubling Season'),b=enter(g,'Doubling Season');enter(g,'Doubling Season',1);const hidden=enter(g,'Doubling Season');hidden.faceDown=true;effect(g,'Create three 1/1 white Soldier creature tokens.');assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,12);transfer(g,a.instance,'graveyard',0);transfer(g,b.instance,'graveyard',0);effect(g,'Create one 1/1 white Soldier creature token.');assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,13);effect(g,'Create 0 1/1 white Soldier creature tokens.');assert.equal(g.players[0].zones.battlefield.filter(c=>c.token).length,13);
});

test('doubled zero-base tokens receive subsequent replaced counters before state actions',()=>{
 const g=game();enter(g,'Doubling Season');effect(g,'Create a 0/0 black Zombie Army creature token. Put two +1/+1 counters on it.');const tokens=g.players[0].zones.battlefield.filter(c=>c.token);assert.equal(tokens.length,2);assert.ok(tokens.every(c=>c.counters['+1/+1']===4));assert.equal(g.players[0].zones.graveyard.length,0);assert.equal(g.pendingEffect,undefined);
});
