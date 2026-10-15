import fs from 'node:fs/promises';
import {parseCsv} from './fetch-test-deck.mjs';
import {ACTIVE_DECKLIST} from './deck-source.mjs';
const base=new URL('../tests/fixtures/commander/',import.meta.url);
const sources=process.argv.slice(2).length?process.argv.slice(2):['commander_test_decks_names_fixed.csv',ACTIVE_DECKLIST];
if(sources.length!==2||sources.some(f=>!/^commander_test_decks[a-z_]*\.csv$/.test(f)))throw Error('Provide two deck fixture CSV filenames.');
const [original,corrected]=await Promise.all(sources.map(async file=>parseCsv(await fs.readFile(new URL(file,base),'utf8'))));
if(original.length!==corrected.length)throw Error('Row counts differ; reconcile before fetching.');
const changes=[];let changedRows=0;for(let i=0;i<original.length;i++){
 const a=original[i],b=corrected[i];for(const key of ['deck_id','commander','color_identity','test_focus','quantity','role'])if(a[key]!==b[key])throw Error('Unexpected structural change at row '+(i+2)+': '+key);
 if(a.card_name!==b.card_name)changedRows++;
 if(a.card_name!==b.card_name&&!changes.some(c=>c.from===a.card_name&&c.to===b.card_name))changes.push({from:a.card_name,to:b.card_name});
}
console.log(JSON.stringify({from:sources[0],to:sources[1],rows:corrected.length,decks:new Set(corrected.map(r=>r.deck_id)).size,changed_rows:changedRows,card_changes:changes},null,2));
