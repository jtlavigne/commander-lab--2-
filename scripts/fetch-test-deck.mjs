import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {ACTIVE_DECKLIST} from './deck-source.mjs';
const require=createRequire(import.meta.url),{createCardClient,matchCard}=require('../card-client.cjs');
const root=fileURLToPath(new URL('../',import.meta.url)),fixtures=path.join(root,'tests','fixtures','commander'),source=path.resolve(process.env.COMMANDER_FIXTURE_SOURCE||fixtures);
// Preserve supplied names; corrections are explicit and included in the cache.
export const nameCorrections={'Commander Sphere':"Commander's Sphere"};
export function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.some(Boolean))rows.push(row);row=[];}else field+=c;}if(quoted)throw Error('Unclosed CSV quote.');if(field||row.length){row.push(field);rows.push(row);}const header=rows.shift().map(s=>s.replace(/^\uFEFF/,''));return rows.map((values,i)=>{if(values.length!==header.length)throw Error('Invalid CSV row '+(i+2));return Object.fromEntries(header.map((key,j)=>[key,values[j]]));});
}
async function main(){
 const deckId=process.argv[2];if(!deckId||!/^[a-z0-9_]+$/.test(deckId))throw Error('Provide one deck_id from commander_deck_manifest.csv.');
 await fs.mkdir(fixtures,{recursive:true});for(const name of ['commander_deck_manifest.csv','commander_test_coverage.csv','commander_test_decks.csv']){const target=path.join(fixtures,name);try{await fs.access(target);}catch{await fs.copyFile(path.join(source,name),target);}}
 const deckFile=ACTIVE_DECKLIST;
 try{await fs.access(path.join(fixtures,deckFile));}catch{await fs.copyFile(path.join(source,deckFile),path.join(fixtures,deckFile));}
 const [manifest,coverage,rows]=await Promise.all(['commander_deck_manifest.csv','commander_test_coverage.csv',deckFile].map(async name=>parseCsv(await fs.readFile(path.join(fixtures,name),'utf8'))));
 const deck=manifest.find(d=>d.deck_id===deckId);if(!deck)throw Error('Deck not found: '+deckId);const list=rows.filter(r=>r.deck_id===deckId),total=list.reduce((n,r)=>n+Number(r.quantity),0);if(total!==Number(deck.total_cards))throw Error('Deck total disagrees with manifest: '+total);
 const output=path.join(fixtures,'oracle',deckId+'.json');await fs.mkdir(path.dirname(output),{recursive:true});let previous=[];if(!process.argv.includes('--refresh')){try{previous=JSON.parse(await fs.readFile(output,'utf8')).cards;}catch(error){if(error.code!=='ENOENT')throw error;}}
 const names=[...new Set(list.map(r=>nameCorrections[r.card_name]||r.card_name))],missing=names.filter(name=>!matchCard(previous,name));
 const client=createCardClient(),result=missing.length?await client.collection(missing):{data:[],not_found:[]},records=[...previous,...result.data];
 const keys=['id','oracle_id','name','mana_cost','cmc','type_line','oracle_text','power','toughness','loyalty','defense','colors','color_identity','keywords','layout','card_faces','image_uris','scryfall_uri','rulings_uri','legalities'];
 const cards=list.flatMap(row=>{const lookup=nameCorrections[row.card_name]||row.card_name,card=matchCard(records,lookup);if(!card)return [];return [{requested_name:row.card_name,...(lookup!==row.card_name?{name_correction:lookup}:{}),quantity:Number(row.quantity),role:row.role,...Object.fromEntries(keys.filter(k=>card[k]!==undefined).map(k=>[k,card[k]]))}];});
 const notFound=result.not_found.filter(item=>!matchCard(records,item.name));
 const value={deck,decklist_source:deckFile,coverage:coverage.find(c=>c.deck_id===deckId),fetched_at:new Date().toISOString(),source:'https://api.scryfall.com/cards/collection (multi-part names may use /cards/named)',complete:cards.length===list.length,not_found:notFound,cards};await fs.writeFile(output,JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify({deck:deck.commander,total,oracle_records:cards.length,complete:value.complete,output:path.relative(root,output)}));
 if(!value.complete)throw Error('Names not found (successful records cached): '+result.not_found.map(r=>r.name).join(', '));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
