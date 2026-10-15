// Supplemental regression examples requested by the user; this does not fetch
// or advance another deck in the sequential Commander manifest.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {createCardClient}=createRequire(import.meta.url)('../card-client.cjs');
const names=['Prologue to Phyresis','Infectious Inquiry'];
const result=await createCardClient().collection(names);
if(result.not_found.length)throw Error('Example cards missing: '+result.not_found.map(c=>c.name).join(', '));
const keys=['id','oracle_id','name','mana_cost','cmc','type_line','oracle_text','colors','color_identity','scryfall_uri'];
await fs.writeFile(new URL('../tests/fixtures/spell-resolution.json',import.meta.url),JSON.stringify({source:'https://api.scryfall.com/cards/collection',fetched_at:new Date().toISOString(),purpose:'Supplemental poison/draw examples; not a completed Commander deck',cards:result.data.map(card=>Object.fromEntries(keys.filter(k=>card[k]!==undefined).map(k=>[k,card[k]])))},null,2)+'\n');
console.log('Cached '+result.data.length+' supplemental spell-resolution Oracle records.');
