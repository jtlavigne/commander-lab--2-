import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,validateSession} from '../engine.mjs';
import {castSpell,resolveTop,passPriority,prioritySeat,castingTiming,activateLoyaltyAction} from '../casting.mjs';
import {addMana,activatedAbilities,activationError} from '../mana.mjs';
import {applyOracleEffect} from '../oracle-effects.mjs';
const records=JSON.parse(readFileSync(new URL('./fixtures/playtest-decks/atraxa.json',import.meta.url))).cards;
const make=name=>({...structuredClone(records.find(c=>c.name===name)),instance:crypto.randomUUID(),counters:{},face:0});
function game(){const g=newGame(2);g.step=3;g.responseMode='hold';g.players.forEach(p=>addMana(p,{W:20,U:20,G:20,C:20}));return g;}
function cast(g,name,owner=0,options={}){const card=make(name);g.players[owner].zones.hand.push(card);castSpell(g,card.instance,options);return card;}
function enter(g,name,owner=0){const card=make(name);g.players[owner].zones.hand.push(card);transfer(g,card.instance,'battlefield',owner,undefined,{deferTriggers:true});return card;}
const target=card=>['card:'+card.instance];
const passRound=g=>{for(let i=0;i<g.players.length;i++)passPriority(g,prioritySeat(g));};

test('An Offer waits for responses and creates two Treasures for the targeted spell controller on resolution',()=>{
 const g=game(),spell=cast(g,'Contentious Plan');passPriority(g,0);cast(g,"An Offer You Can't Refuse",1,{targets:target(spell)});
 assert.equal(g.players[0].zones.battlefield.length,0);assert.equal(g.stack.length,2);passRound(g);
 assert.equal(g.stack.length,0);assert.ok(g.players[0].zones.graveyard.some(c=>c.instance===spell.instance));const tokens=g.players[0].zones.battlefield;
 assert.equal(tokens.length,2);assert.ok(tokens.every(c=>c.token&&c.name==='Treasure'));assert.notEqual(tokens[0].instance,tokens[1].instance);assert.equal(g.players[1].zones.battlefield.length,0);validateSession(g);
});

test('An Offer gives Treasures even for an uncounterable spell, but not if its target has left the stack',()=>{
 for(const unavailable of [false,true]){
  const g=game(),spell=cast(g,'Contentious Plan');spell.oracle_text="This spell can't be countered.\n"+spell.oracle_text;
  passPriority(g,0);cast(g,"An Offer You Can't Refuse",1,{targets:target(spell)});if(unavailable)transfer(g,spell.instance,'graveyard',0);
  resolveTop(g);assert.equal(g.players[0].zones.battlefield.length,unavailable?0:2);assert.equal(g.stack.length,unavailable?0:1);validateSession(g);
 }
});

test('Dovins Veto cannot be countered and still resolves its noncreature counter instruction',()=>{
 const g=game(),spell=cast(g,'Contentious Plan');passPriority(g,0);const veto=cast(g,"Dovin's Veto",1,{targets:target(spell)});passPriority(g,1);cast(g,"An Offer You Can't Refuse",0,{targets:target(veto)});
 resolveTop(g);assert.ok(g.stack.some(e=>e.card?.instance===veto.instance));assert.equal(g.players[1].zones.battlefield.length,2);
 resolveTop(g);assert.equal(g.stack.length,0);assert.ok(g.players[0].zones.graveyard.some(c=>c.instance===spell.instance));assert.equal(g.pendingEffect,undefined);validateSession(g);
});

test('Krosan Grip split second blocks spells and nonmana abilities but allows land mana abilities',()=>{
 const g=game(),artifact=enter(g,'Sol Ring',1),land=enter(g,'Forest',1),walker=enter(g,'Teferi, Master of Time',1),scepter=enter(g,"Magistrate's Scepter",1);
 cast(g,'Krosan Grip',0,{targets:target(artifact)});passPriority(g,0);
 assert.match(castingTiming(g,1,make("An Offer You Can't Refuse")),/Split second/);
 assert.throws(()=>activateLoyaltyAction(g,walker.instance,0),/Split second/);
 const mana=activatedAbilities(g,1,land).find(a=>a.output),nonmana=activatedAbilities(g,1,scepter).find(a=>!a.output);
 assert.equal(activationError(g,1,land,mana),'');assert.match(activationError(g,1,scepter,nonmana),/Split second/);
 resolveTop(g);assert.ok(g.players[1].zones.graveyard.some(c=>c.instance===artifact.instance));assert.equal(g.pendingEffect,undefined);validateSession(g);
});

test('Elspeth destroys creatures using current power, respecting shields and indestructible',()=>{
 const g=game(),elspeth=enter(g,"Elspeth, Sun's Champion"),small=enter(g,'Thrummingbird'),large=enter(g,'Consecrated Sphinx',1),shield=enter(g,'Deepglow Skate',1),indestructible=enter(g,'Tekuthal, Inquiry Dominus',1);
 small.counters['+1/+1']=3;shield.counters['+1/+1']=1;shield.counters.shield=1;indestructible.counters.indestructible=1;
 assert.equal(applyOracleEffect(g,{owner:0,source:elspeth,text:'Destroy all creatures with power 4 or greater.'}),true);
 assert.ok(g.players[0].zones.graveyard.some(c=>c.instance===small.instance));assert.ok(g.players[1].zones.graveyard.some(c=>c.instance===large.instance));assert.ok(g.players[1].zones.battlefield.includes(shield));assert.equal(shield.counters.shield,undefined);assert.ok(g.players[1].zones.battlefield.includes(indestructible));validateSession(g);
});
