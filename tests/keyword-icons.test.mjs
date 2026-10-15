import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../engine.mjs';
import {cardKeywordBadges} from '../keyword-icons.mjs';
const card=(oracle_text,extra={})=>({instance:'card',name:'Creature',type_line:'Creature',oracle_text,counters:{},...extra});
const names=(g,c,onBoard=false,owner=0)=>cardKeywordBadges(g,owner,c,{onBoard}).map(b=>b.name);

test('printed keywords have distinct SVG pictograms, and reminders/targets are not abilities',()=>{
 const g=newGame(2),c=card('Flying, vigilance, deathtouch, lifelink');
 const badges=cardKeywordBadges(g,0,c);assert.deepEqual(names(g,c),['deathtouch','flying','lifelink','vigilance']);assert.equal(new Set(badges.map(b=>b.path)).size,4);
 assert.deepEqual(names(g,card('Destroy target creature with flying.\nReach (This creature can block creatures with flying.)')),['reach']);
 assert.deepEqual(names(g,card('Other creatures you control have haste.\nFlying creatures you control get +1/+1.')),[]);
});
test('board grants, keyword counters, temporary abilities and removals follow live state',()=>{
 const g=newGame(2),c=card('Vigilance',{counters:{flying:1},temporaryKeywords:['trample']});
 const provider=card('Other creatures you control have haste.',{instance:'provider'});g.players[0].zones.battlefield=[c,provider];
 assert.deepEqual(names(g,c,true),['flying','haste','trample','vigilance']);
 assert.deepEqual(names(g,c),['vigilance'],'Off-board previews do not inherit board grants or counters');
 assert.deepEqual(names(g,c,true,1),['flying','trample','vigilance']);
 g.players[0].zones.battlefield.pop();c.lostKeywords=['flying'];assert.deepEqual(names(g,c,true),['trample','vigilance']);
});
test('conditional and attached grants use the shared recipient and condition checks',()=>{
 const g=newGame(2),c=card('');g.players[0].zones.battlefield=[c,card('Equipped creature has hexproof.',{instance:'equipment',attachedTo:'card'})];
 assert.deepEqual(names(g,c,true),['hexproof']);g.players[0].zones.battlefield[1].attachedTo='other';assert.deepEqual(names(g,c,true),[]);
 g.players[0].zones.battlefield[1]=card('As long as you control your commander, creatures you control have double strike.',{instance:'provider'});
 assert.deepEqual(names(g,c,true),[]);c.commander=true;assert.deepEqual(names(g,c,true),['double strike']);
});
test('hidden hands leak no icons, and manifested creatures expose only public grants',()=>{
 const g=newGame(2),c=card('Flying\nWard {2}',{faceDown:true,manifested:true,keywords:['Flying','Ward']});
 g.players[0].zones.battlefield=[c,card('Creatures you control have haste.',{instance:'provider'})];
 assert.deepEqual(names(g,c),[]);assert.deepEqual(names(g,c,true),['haste']);
 c.manifested=false;assert.deepEqual(names(g,c,true),[]);
});
test('double-faced metadata cannot leak the inactive face into icons',()=>{
 const g=newGame(2),c=card('',{keywords:['Flying','Menace','Ward'],card_faces:[{oracle_text:'Flying'},{oracle_text:'Menace\nWard {2}'}]});
 assert.deepEqual(names(g,c),['flying']);c.face=1;assert.deepEqual(names(g,c),['menace','ward']);
});
test('only requested keywords produce badges; keyword actions and other mechanics stay out',()=>{
 const g=newGame(2),c=card('Protection from red\nWard {2}\nEnchant creature\nEquip {3}\nProwess\nChangeling\nAffinity for artifacts\nWhen this creature enters, scry 2.\nProliferate.\nSurveil 2.\nCompleated');
 assert.deepEqual(names(g,c),['affinity','changeling','protection','prowess','ward']);
 assert.deepEqual(names(g,card('Whenever you scry, draw a card.\nFlying (Scry 1 is not an instruction here.)')),['flying']);
});

test('metadata cannot expand the requested display vocabulary',()=>{
 const g=newGame(2),c=card('Backup 2',{keywords:['Backup','Flying']});
 assert.deepEqual(names(g,c),[]);
 c.oracle_text='Flying\nBackup 2';assert.deepEqual(names(g,c),['flying']);
 c.counters={infect:1};c.temporaryKeywords=['toxic','cascade'];g.players[0].zones.battlefield=[c,card('Creatures you control have wither.',{instance:'provider'})];
 assert.deepEqual(names(g,c,true),['flying'],'Nonlisted grants/counters cannot create badges');
});

test('every keyword in the supplied reference has an individual icon',()=>{
 const expected=['deathtouch','defender','double strike','first strike','flash','flying','haste','hexproof','indestructible','lifelink','menace','protection','reach','trample','vigilance','ward','prowess','changeling','affinity'].sort();
 const badges=cardKeywordBadges(newGame(2),0,card(expected.join('\n')));
 assert.deepEqual(badges.map(b=>b.name),expected);assert.equal(new Set(badges.map(b=>b.path)).size,expected.length);
});

test('render queries do not mutate game state or activate later Class levels',()=>{
 const g=newGame(2),c=card('Ward {1}\n{2}: Level 2\nFlying');g.players[0].zones.battlefield=[c];
 const before=JSON.stringify(g);assert.deepEqual(names(g,c,true),['ward']);assert.equal(JSON.stringify(g),before);
 c.classLevel=2;assert.deepEqual(names(g,c,true),['flying','ward']);
});
