import fs from 'node:fs/promises';
import {parseCsv} from './fetch-test-deck.mjs';
import {ACTIVE_DECKLIST} from './deck-source.mjs';
const base=new URL('../tests/fixtures/commander/',import.meta.url);
const [manifest,rows]=await Promise.all(['commander_deck_manifest.csv',ACTIVE_DECKLIST].map(async f=>parseCsv(await fs.readFile(new URL(f,base),'utf8'))));
if(rows.some(r=>!manifest.some(d=>d.deck_id===r.deck_id)))throw Error('Deck list contains an unknown deck ID.');
const decks=manifest.map(d=>{
 const list=rows.filter(r=>r.deck_id===d.deck_id),commanders=list.filter(r=>r.role==='commander').map(r=>r.card_name);
 if(!commanders.length||list.some(r=>!r.card_name||!Number.isSafeInteger(Number(r.quantity))||Number(r.quantity)<1)||list.reduce((n,r)=>n+Number(r.quantity),0)!==Number(d.total_cards))throw Error('Invalid deck structure or quantity: '+d.deck_id);
 return {id:d.deck_id,name:d.commander,colors:d.color_identity,focus:d.test_focus.replaceAll('_',' '),commanders,list:list.map(r=>r.quantity+' '+r.card_name).join('\n')};
});
await fs.writeFile(new URL('../premade-decks.mjs',import.meta.url),'// Generated from '+ACTIVE_DECKLIST+' by scripts/update-premade-decks.mjs.\nexport const PREMADE_DECKS='+JSON.stringify(decks,null,1)+';\n');
console.log('Updated '+decks.length+' premade decks from '+ACTIVE_DECKLIST+'.');
