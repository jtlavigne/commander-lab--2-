import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {ACTIVE_DECKLIST} from '../scripts/deck-source.mjs';
import {parseCsv} from '../scripts/fetch-test-deck.mjs';
import {PREMADE_DECKS} from '../premade-decks.mjs';
const base=new URL('./fixtures/commander/',import.meta.url);
const [current,previous,manifest]=await Promise.all([ACTIVE_DECKLIST,'commander_test_decks_names_fixed.csv','commander_deck_manifest.csv'].map(async f=>parseCsv(await fs.readFile(new URL(f,base),'utf8'))));
test('the updated color-fixed source preserves all 39 decks, 3271 rows, quantities, roles and 100-card totals',()=>{
 assert.equal(ACTIVE_DECKLIST,'commander_test_decks_color_fixes.csv');assert.equal(current.length,3271);assert.equal(current.length,previous.length);assert.equal(new Set(current.map(r=>r.deck_id)).size,39);
 for(let i=0;i<current.length;i++){for(const key of ['deck_id','commander','color_identity','test_focus','quantity','role'])assert.equal(current[i][key],previous[i][key],key+' at row '+(i+2));}
 for(const d of manifest)assert.equal(current.filter(r=>r.deck_id===d.deck_id).reduce((n,r)=>n+Number(r.quantity),0),100,d.commander);
});
test('all premade deck options exactly match the active CSV, including commanders and duplicate quantities',()=>{
 assert.equal(PREMADE_DECKS.length,manifest.length);for(const d of PREMADE_DECKS){const rows=current.filter(r=>r.deck_id===d.id);assert.equal(d.list,rows.map(r=>r.quantity+' '+r.card_name).join('\n'));assert.deepEqual(d.commanders,rows.filter(r=>r.role==='commander').map(r=>r.card_name));}
});
test('the supplied changes replace 17 off-color Spellbombs and Kenrith’s Dockside without modifying other cards',()=>{
 const changes=current.flatMap((r,i)=>r.card_name===previous[i].card_name?[]:[{from:previous[i].card_name,to:r.card_name,deck:r.deck_id}]);assert.equal(changes.length,18);assert.equal(changes.filter(c=>c.from==='Nihil Spellbomb'&&c.to==='Unlicensed Hearse').length,17);assert.deepEqual(changes.filter(c=>c.from!=='Nihil Spellbomb'),[{from:'Dockside Extortionist',to:'Tireless Provisioner',deck:'kenrith_the_returned_king'}]);
 for(const r of current.filter(r=>r.card_name==='Nihil Spellbomb'))assert.ok(r.color_identity.includes('B'),r.commander);
});
