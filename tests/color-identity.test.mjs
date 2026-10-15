import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {lobbyGame,deckReport,validateLobby} from '../lobby.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {projectGame,compactView} from '../multiplayer/protocol.mjs';
import {PREMADE_DECKS} from '../premade-decks.mjs';
import {parseCsv} from '../scripts/fetch-test-deck.mjs';
const historical=parseCsv(await fs.readFile(new URL('./fixtures/commander/commander_test_decks_names_fixed.csv',import.meta.url),'utf8'));
const {cards}=JSON.parse(await fs.readFile(new URL('./fixtures/commander/color-identity-regressions.json',import.meta.url),'utf8'));
const card=name=>({...structuredClone(cards.find(c=>c.name===name)),instance:crypto.randomUUID(),counters:{}});
const mismatches=r=>r.issues.filter(s=>s.includes('outside its commander'));
function game(commander='Niv-Mizzet, Parun'){
 const g=lobbyGame({count:2});g.players[0].zones.command=[{...card(commander),commander:true}];g.players[0].zones.library=[card('Nihil Spellbomb')];return g;
}
for(const name of ['Niv-Mizzet, Parun','Zedruu the Greathearted'])test(name+' historical list: identifies Nihil Spellbomb using actual Scryfall color identity',()=>{
 assert.ok(historical.some(r=>r.commander===name&&r.card_name==='Nihil Spellbomb'));const current=PREMADE_DECKS.find(d=>d.name===name);assert.ok(!current.list.includes('Nihil Spellbomb'));assert.ok(current.list.includes('1 Unlicensed Hearse'));
 const g=game(name),r=deckReport(g,0);assert.equal(mismatches(r).length,1);assert.equal(r.identityNotes.length,1);assert.match(r.identityNotes[0],/^Nihil Spellbomb: black; commander identity:/);assert.deepEqual(card('Nihil Spellbomb').colors,[]);
 g.players[0].zones.library=[];assert.deepEqual(mismatches(deckReport(g,0)),[]);
});
test('no commander selected does not falsely compare a colored deck to a colorless commander',()=>{
 const g=game();g.players[0].zones.library.push(...g.players[0].zones.command.map(c=>({...c,commander:false})));g.players[0].zones.command=[];
 const r=deckReport(g,0);assert.ok(r.issues.some(s=>s.includes('Choose one commander')));assert.deepEqual(mismatches(r),[]);assert.equal(r.identityNotes,undefined);
});
test('unavailable commander or card identity is reported as unknown, while an explicit colorless identity is valid metadata',()=>{
 const g=game(),c=g.players[0].zones.command[0];delete c.color_identity;let r=deckReport(g,0);assert.deepEqual(mismatches(r),[]);assert.ok(r.issues.some(s=>s.startsWith('Commander color identity data is unavailable')));
 c.color_identity=[];assert.equal(mismatches(deckReport(g,0)).length,1);
 g.players[0].zones.library[0].color_identity=undefined;r=deckReport(g,0);assert.deepEqual(mismatches(r),[]);assert.ok(r.issues.some(s=>s.startsWith('Some card color identity data is unavailable')));
});
test('partners use a combined identity, including all faces, while any-color mana and reminder text add no colors beyond Oracle identity',()=>{
 const g=game();g.players[0].zones.command=[{...card('Niv-Mizzet, Parun'),color_identity:['W'],oracle_text:'Partner',commander:true},{...card('Zedruu the Greathearted'),color_identity:['B'],oracle_text:'Partner',commander:true}];
 g.players[0].zones.library=[card('Nihil Spellbomb'),{instance:'extort',name:'White extort card',type_line:'Enchantment',color_identity:['W'],oracle_text:'Extort (Whenever you cast a spell, you may pay {W/B}.)'},{instance:'mana',name:'Any-color source',type_line:'Artifact',color_identity:[],oracle_text:'{T}: Add one mana of any color.'},{instance:'faces',name:'Double-faced card',color_identity:['W','B'],card_faces:[{colors:['W']},{colors:['B']}]}];
 assert.deepEqual(mismatches(deckReport(g,0)),[]);
});
test('card-specific identity details are sent only to their deck owner, not to opponents or the host of another seat',()=>{
 const g=game();g.lobby.decks[0]=deckReport(g,0);const own=JSON.stringify(compactView(projectGame(g,0))),opponent=JSON.stringify(compactView(projectGame(g,1)));assert.ok(own.includes('Nihil Spellbomb'));assert.ok(!opponent.includes('Nihil Spellbomb'));assert.ok(opponent.includes('outside its commander'));
});
test('a player can recheck a saved report without reimporting, and the new result requires fresh readiness and acknowledgment',()=>{
 const g=game();g.lobby.decks[0]={count:2,issues:['Old generic warning']};g.lobby.ready[0]=g.lobby.acknowledged[0]=true;const next=reduceAction(g,{type:'lobbyRecheck'},0).game;assert.match(next.lobby.decks[0].identityNotes[0],/^Nihil Spellbomb/);assert.equal(next.lobby.ready[0],false);assert.equal(next.lobby.acknowledged[0],false);assert.throws(()=>reduceAction(g,{type:'lobbyRecheck',owner:0},1),/own seat/);
});
test('saved and received identity-detail fields are validated before rendering',()=>{
 const g=game();g.lobby.decks[0]={count:2,issues:[],identityNotes:[42]};assert.throws(()=>validateLobby(g),/color identity details/);
});
