export function createPileUI({getGame,getNetwork,getSeat,setSeat,dispatch,render,renderCard,refreshHover,resolvePendingEffect,setStatus,el,button}){
 const $=id=>document.getElementById(id);
 const labels={library:'Library',hand:'Hand',battlefield:'Battlefield',graveyard:'Graveyard',exile:'Exile',command:'Command zone',stack:'Stack'};
 let view=null;

 function finishLibrarySearch(shuffle=true){
  dispatch({type:'librarySearch',open:false,shuffle},{after:()=>{$('pile-dialog').close();view=null;}});
 }

 const finishSearch=button('Finish search & shuffle',()=>finishLibrarySearch());
 finishSearch.id='finish-library-search';finishSearch.hidden=true;
 $('automatic').closest('.turn-actions').prepend(finishSearch);

 function show(owner,zone){
  if(!getNetwork())setSeat(owner);
  view={owner,zone};$('pile-search').value='';render();renderPile();
  if(!$('pile-dialog').open)$('pile-dialog').showModal();
  if(zone==='library')$('pile-search').focus();
 }

 function open(owner,zone){
  const game=getGame(),network=getNetwork();
  if(network&&zone==='library'){
   if(owner!==getSeat()){setStatus('You can search only your own library.');return;}
   if(game.pendingEffect?.kind==='oracle-choice'){resolvePendingEffect();setStatus('Use the pending effect choices to search.');return;}
   if(!game.players[owner].librarySearch){dispatch({type:'librarySearch',open:true},{after:()=>show(owner,zone)});return;}
  }
  show(owner,zone);
 }

 function renderPile(){
  if(!view)return;
  const {owner,zone}=view,player=getGame().players[owner];
  if(!player)return;
  $('pile-owner').textContent='SEAT 0'+(owner+1)+' / '+player.name;
  $('pile-title').textContent=labels[zone]+' · '+player.zones[zone].length+' cards';
  $('pile-caption').textContent=zone==='library'?'Top to bottom, left to right. Hold Left Alt over a card to inspect it, or drag it directly onto the table.':'Hold Left Alt to inspect or drag a card back onto the table.';
  const cards=player.zones[zone],query=zone==='library'?$('pile-search').value.trim().toLocaleLowerCase():'';
  const entries=cards.map((card,index)=>({card,index})).filter(({card})=>!query||[card.name,...(card.card_faces||[]).map(face=>face.name)].some(name=>name?.toLocaleLowerCase().includes(query)));
  $('pile-search-controls').hidden=zone!=='library';$('pile-search-clear').hidden=!$('pile-search').value;
  $('pile-search-status').textContent=query?entries.length+' of '+cards.length+' cards':cards.length+' cards';
  $('pile-cards').replaceChildren(...entries.map(({card,index})=>{const wrapper=el('div');wrapper.append(renderCard(card),el('div',zone==='library'?(index===0?'TOP / 1':String(index+1)):String(index+1),'pile-index'));return wrapper;}));
  if(getNetwork()&&zone==='library'&&player.librarySearch){
   const actions=el('div',undefined,'pile-search-row');
   actions.append(button('Finish search & shuffle',()=>finishLibrarySearch()),button('Finish without shuffling',()=>finishLibrarySearch(false)));
   $('pile-cards').append(actions);
  }
  if(!entries.length)$('pile-cards').append(el('p',cards.length?'No cards match your search.':'This pile is empty.','pile-empty-message'));
  refreshHover();
 }

 function refresh(){
  const game=getGame(),network=getNetwork();
  finishSearch.hidden=!network||!game.players[getSeat()]?.librarySearch;
  renderPile();
 }

 $('pile-search').oninput=renderPile;
 $('pile-search-clear').onclick=()=>{$('pile-search').value='';renderPile();$('pile-search').focus();};

 return {open,render:refresh};
}