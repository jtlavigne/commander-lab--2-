import {parseDeck} from './engine.mjs';

export function createDeckImportUI({getGame,getNetwork,getSeat,getEpoch,allCards,dispatch,setStatus,render,rememberArt,cacheArtwork,restoreArt}){
 const $=id=>document.getElementById(id);
 let importing=false,artworkLoading=false;

 function hasArtwork(card){
  const faces=card.image_uris?.normal?1:card.card_faces?.some(face=>face.image_uris?.normal)?card.card_faces.length:1;
  return Array.from({length:faces},(_,index)=>card.localImages?.[index]).every(source=>typeof source==='string'&&source.startsWith('data:image/'));
 }

 async function lookupNames(names){
  const unique=[...new Map(names.map(name=>[name.trim().toLowerCase(),name.trim()])).values()],records=new Map();
  for(let index=0;index<unique.length;index+=250){const loaded=await window.cards.lookupBatch(unique.slice(index,index+250));for(const [name,card] of Object.entries(loaded))records.set(name.trim().toLowerCase(),card);}
  return Object.fromEntries(names.map(name=>[name,records.get(name.trim().toLowerCase())]));
 }

 function open(owner=getSeat()){
  const game=getGame();if(getNetwork())owner=getSeat();
  $('import-seat').replaceChildren(...game.players.map((player,index)=>{const option=document.createElement('option');option.textContent='Seat '+(index+1)+' / '+player.name;option.value=index;return option;}));
  $('import-seat').value=owner;$('import-seat').disabled=!!getNetwork();$('player-name').value=game.players[owner].name;$('import-dialog').showModal();
 }

 $('import-seat').onchange=()=>{$('player-name').value=getGame().players[Number($('import-seat').value)].name;};

 $('import-form').onsubmit=async event=>{
  event.preventDefault();if(importing)return;
  const game=getGame(),target=Number($('import-seat').value),commanders=[$('commander').value.trim(),$('partner').value.trim()].filter(Boolean),playerName=$('player-name').value.trim();let list;
  try{list=parseDeck($('deck').value);}catch(error){$('import-status').textContent=error.message;return;}
  if(!list.length){$('import-status').textContent='Paste a deck list first.';return;}
  if(list.reduce((count,row)=>count+row.count,0)>500){$('import-status').textContent='Please keep each imported deck to 500 cards or fewer.';return;}
  if(!window.cards){$('import-status').textContent='Launch through Electron to download card data. The practice table works offline.';return;}
  const epoch=getEpoch();importing=true;$('import').disabled=true;$('refreshart').disabled=true;$('import').textContent='Loading cards…';
  try{
   const names=[...new Set([...list.map(card=>card.name),...commanders])];$('import-status').textContent='Loading '+names.length+' card names and caching artwork. First imports can take a few minutes.';
   const records=await lookupNames(names);$('import-status').textContent='Finding tokens and caching their artwork...';const reserve=window.cards.lookupTokens?await window.cards.lookupTokens(names):{tokens:[],warnings:[]};if(epoch!==getEpoch())throw Error('The table changed during import. Cached cards are ready; import again into this table.');
   const instance=(card,isCommander=false)=>({...card,instance:crypto.randomUUID(),tapped:false,counters:{},face:0,commander:isCommander,ownerSeat:target});
   const library=[],command=commanders.map((name,commandSlot)=>{if(!records[name])throw Error('Missing card: '+name);return {...instance(records[name],true),commandSlot,commandCasts:0};});
   if(command.length===2&&command[0].id===command[1].id)throw Error('Choose two different command-zone cards.');
   const remaining=new Set(command.map(card=>card.id));
   for(const row of list){const card=records[row.name];if(!card)throw Error('Missing card: '+row.name);let count=row.count;if(remaining.delete(card.id))count--;for(let index=0;index<count;index++)library.push(instance(card));}
   const count=library.length+command.length;if(count>500)throw Error('Please keep each imported deck, including commanders, to 500 cards or fewer.');
   const missingImages=[...new Map([...library,...command].map(card=>[card.id,card])).values()].filter(card=>!hasArtwork(card)||card.artworkError);
   const resultMessage=(reserve.warnings.length?reserve.warnings.join(' ')+' ':'')+'Loaded '+reserve.tokens.length+' token templates. Imported '+count+' cards for '+(playerName||game.players[target].name)+(missingImages.length?'. Images missing for '+missingImages.length+' card names; click Images to retry.':' with card images.');
   dispatch({type:'import',owner:target,library,command,tokenCatalog:reserve.tokens,name:playerName},{message:resultMessage});
   $('import-dialog').close();$('import-status').textContent='Card data and artwork download from Scryfall and cache locally.';
  }catch(error){$('import-status').textContent=error.message;setStatus(error.message);}
  finally{importing=false;$('import').disabled=false;$('refreshart').disabled=artworkLoading;$('import').textContent='Import & shuffle →';}
 };

 async function hydrateArt({retry=false}={}){
  rememberArt();if(!window.cards||artworkLoading)return;
  const epoch=getEpoch(),cards=allCards(),missingCards=cards.filter(card=>card.id&&(!hasArtwork(card)||card.artworkVersion!==2)),tokenIds=[...new Set(missingCards.filter(card=>card.token||card.tokenTemplate).map(card=>card.id))],names=[...new Set(missingCards.filter(card=>!card.token&&!card.tokenTemplate).map(card=>card.name))];
  if(!names.length&&!tokenIds.length){if(retry)setStatus(cards.some(card=>card.id)?'All imported cards already have images.':'Import a deck to download its card images.');return;}
  artworkLoading=true;$('refreshart').disabled=true;setStatus('Downloading missing card images…');
  try{
   const records=await lookupNames(names),byId={};for(let index=0;index<tokenIds.length;index+=250)Object.assign(byId,await window.cards.lookupIds(tokenIds.slice(index,index+250)));
   if(epoch!==getEpoch())return;
   for(const card of cards){const record=(card.token||card.tokenTemplate)?byId[card.id]:records[card.name];if(record){card.localImages=record.localImages;card.artworkVersion=record.artworkVersion;if(record.artworkError)card.artworkError=record.artworkError;else delete card.artworkError;cacheArtwork(card);}}
   restoreArt();render();
   const missing=[...new Set(cards.filter(card=>card.id&&(!hasArtwork(card)||card.artworkVersion!==2)).map(card=>card.name))];
   setStatus(missing.length?'High-resolution images unavailable for '+missing.join(', ')+'. Click Images to retry.':'High-resolution card images ready.');
  }catch(error){setStatus('Card images could not download: '+error.message+'. Click Images to retry.');}
  finally{artworkLoading=false;$('refreshart').disabled=importing;}
 }

 return {open,hydrateArt,isImporting:()=>importing,isArtworkLoading:()=>artworkLoading};
}