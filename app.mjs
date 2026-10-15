import {automaticFor} from './turn-settings.mjs';
import {decksReadyForOpening} from './opening-hand.mjs';
import {createOpeningHandUI} from './opening-hand-ui.mjs';
import {STEPS,ZONES,newGame,findCard,parseDeck,validateSession,changePlayerCount,commandersFor} from './engine.mjs';
import {practiceGame} from './practice.mjs';
import {cardFace,creatureStats} from './card-state.mjs';
import {availableLoyaltyAbilities,getLoyaltyAbility,loyaltyStatus,defaultAbilityPositions,detectLoyaltyPositions} from './planeswalker.mjs';
import {autoPassEmptySteps} from './phase-flow.mjs';
import {turnController} from './game-outcome.mjs';
import {activatedAbilities} from './mana.mjs';
import {createManaUI} from './mana-ui.mjs';
import {createTableCamera} from './camera.mjs';
import {createHandDock} from './hand-dock.mjs';
import {createCardPreview} from './card-preview.mjs';
import {createCombatUI} from './combat-ui.mjs';
import {combatStats} from './creature-rules.mjs';
import {createNetworkUI} from './network-ui.mjs';
import {reduceGameAction} from './game-actions.mjs';
import {createControllerUI} from './controller-ui.mjs';
import {castingPermission} from './spell-rules.mjs';
import {createBoardInteraction} from './board-interaction.mjs';
import {createCastPresentation} from './cast-presentation.mjs';
import {createTurnPresentation} from './turn-presentation.mjs';
import {createCardMotion,tapIndicator} from './card-motion.mjs';
import {cardKeywordBadges,keywordStrip} from './keyword-icons.mjs';
import {createLaunchUI} from './launch-ui.mjs';
// ---- Renderer state and shared UI helpers ----
// `g` is the current game snapshot; camera, hover and dialog state stay local.
// `sessionEpoch` invalidates asynchronous imports/artwork after a table change.
let launchUI,openingHandUI;
const $=id=>document.getElementById(id);
const CARD_BACK_URL=new URL('./assets/commander-lab-card-back.png',import.meta.url).href;
const COLORS=['#a9c48c','#91b8c6','#c89c87','#b6a0cc'];
const LABELS={library:'Library',hand:'Hand',battlefield:'Battlefield',graveyard:'Graveyard',exile:'Exile',command:'Command zone',stack:'Stack'};
const STEP_LABELS=['Untap','Upkeep','Draw','Main 1','Combat','Attackers','Blockers','Damage','End combat','Main 2','End','Cleanup'];
const COUNTER_PRESETS=[
 ['Power / toughness',['+1/+1','-1/-1','+1/+0','+0/+1']],
 ['Common counters',['charge','croak','toxic','loyalty','lore','shield','stun','finality','time','age','oil','quest','storage','level','verse','spore','fate','brick','ice','defense','hone']],
 // Keyword counters: Comprehensive Rules 122.1b, effective September 25, 2026.
 // https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt
 ['Keyword counters',['flying','first strike','double strike','deathtouch','decayed','exalted','haste','hexproof','indestructible','lifelink','menace','reach','shadow','trample','vigilance']],
 ['Keyword variants',['hexproof from white','hexproof from blue','hexproof from black','hexproof from red','hexproof from green','hexproof from monocolored','hexproof from multicolored']]
];
let g=newGame(),seat=0,selected=null,history=[],panel='stack',pileView=null,draggedId=null,dragOffset={x:.5,y:.5},importing=false,sessionEpoch=0;
const artCache=new Map();
const layoutCache=new Map();
let camera,cardPreview,manaUI,combatUI,boardPicker,castPresentation,turnPresentation,cardMotion;
let networkSession=null,offlineBackup=null;
let hoverPoint=null,hoverFrame=0;
let handDragImage;
let dock,handSeat=0;
try{const savedHand=localStorage.getItem('commanderLabHandSeat');if(savedHand!==null&&/^[0-3]$/.test(savedHand))handSeat=Number(savedHand);}catch{}
let artworkLoading=false;
seat=handSeat;
function hasArtwork(card){const faces=card.image_uris?.normal?1:card.card_faces?.some(face=>face.image_uris?.normal)?card.card_faces.length:1;return Array.from({length:faces},(_,i)=>card.localImages?.[i]).every(src=>typeof src==='string'&&src.startsWith('data:image/'));}
try{const saved=localStorage.getItem('commanderLab');if(saved)g=validateSession(JSON.parse(saved));}catch{setStatus('The saved session could not be read. A fresh table is ready.');}
if(handSeat>=g.players.length)seat=handSeat=0;
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
const serialize=state=>JSON.stringify(state,(key,value)=>key==='localImages'?undefined:value);
const allCards=()=>[...g.players.flatMap(p=>[...ZONES.flatMap(z=>p.zones[z]),...(p.tokenCatalog||[])]),...g.stack.map(e=>e.card).filter(Boolean)];
function setStatus(text){$('status').textContent=text;}
// Artwork is cached outside serialized game history and multiplayer commands.
// Restoring a snapshot reconnects those local assets without downloading again.
function cacheArtwork(card){
 if(card.localImages)artCache.set(card.id||card.name,{localImages:card.localImages,artworkVersion:card.artworkVersion,artworkError:card.artworkError});
}
function rememberArt(){for(const card of allCards()){cacheArtwork(card);if(card.loyaltyLayout)layoutCache.set(card.id||card.name,card.loyaltyLayout);}}
function restoreArt(){for(const card of allCards()){const art=artCache.get(card.id||card.name);if(art)Object.assign(card,art);const layout=layoutCache.get(card.id||card.name);if(layout&&!card.loyaltyLayout)card.loyaltyLayout=layout;}}
function saveLocal(){if(networkSession){$('save-status').textContent=networkSession.connection==='connected'?'SHARED · '+networkSession.revision:'RECONNECTING';return;}try{localStorage.setItem('commanderLab',serialize(g));$('save-status').textContent='SAVED LOCALLY';}catch{$('save-status').textContent='EXPORT TO SAVE';setStatus('Local storage is full or unavailable. Export this session to save it.');}}
// ---- Gameplay commands and local transactions ----
// UI effects run only after a gameplay action is accepted. They never enter packets.
function completeAction(action,after){
 if(['cast','playLand'].includes(action.type)&&$('pile-dialog').open)$('pile-dialog').close();
 if(!networkSession){
  if(['move','draw','import'].includes(action.type)&&action.owner!==undefined)seat=action.owner;
  if(action.type==='reset'){sessionEpoch++;seat=0;selected=null;}
  if(action.type==='openingReady'&&g.opening?.status==='complete'){seat=g.active;selected=null;}
 }
 after?.();
}
function dispatch(action,{message,after}={}){
 if(!networkSession)return mutate(()=>{
  g=reduceGameAction(g,action,seat,{}).game;
  if(action.type==='reset')autoPassEmptySteps(g,{});
 },message,{after:()=>completeAction(action,after),autoPass:false});
 // Include the permanent's entry identity so a delayed command cannot affect
 // a different incarnation of the same card after it leaves and returns.
 if(action.id){const source=findCard(g,action.id);if(source?.zone==='battlefield'){
  action={...action,expected:{battlefieldId:source.card.battlefieldId}};
  if(action.type==='move'&&action.owner===source.owner)delete action.owner;
 }}
 const opened=[...document.querySelectorAll('dialog[open]')].filter(d=>d.id!=='launch-screen');
 // The host publishes accepted state through networkState(). Do not predict
 // gameplay here: payment, hidden information and choices must agree first.
 return window.tableNetwork.send(action).then(()=>{
  for(const dialog of opened)if(dialog.open)dialog.close();
  completeAction(action,after);render();if(message)setStatus(message);return true;
 }).catch(error=>{setStatus(error.message);return false;});
}
// Local table setup and artwork preferences are not shared gameplay commands.
function mutate(fn,message,{after,autoPass=true}={}){
 if(networkSession){setStatus('This local-only control is unavailable in a shared table.');return false;}
 rememberArt();const before=serialize(g),previousTurn=g.turn+':'+g.active;
 try{
  fn();if(autoPass)autoPassEmptySteps(g,{});
  const handedOff=previousTurn!==g.turn+':'+g.active;
  if(handedOff){seat=g.active;selected=null;}
  after?.();history.push(before);if(history.length>60)history.shift();
  if(selected&&!findCard(g,selected))selected=null;
  render();if(handedOff)camera?.focusSeat(seat);if(message)setStatus(message);return true;
 }catch(error){
  g=JSON.parse(before);restoreArt();const dialog=$('mana-dialog');
  if(dialog?.open&&!g.pendingEffect)dialog.close();render();setStatus(error.message);return false;
 }
}
// ---- Seat control, hover selection and concealed hands ----
// Local hotseat can control every seat. A network camera can visit another mat
// while controls and the pinned hand remain bound to the assigned seat.
function selectSeat(owner){if(!g.players[owner])return;if(networkSession&&owner!==networkSession.seat){$('dock-player').value=seat;camera?.focusSeat(owner);setStatus('Viewing '+g.players[owner].name+'. Your hand stays at your assigned seat.');return;}seat=owner;selected=null;render();camera?.focusSeat(owner);setStatus('Controlling '+g.players[seat].name+'.');}
function syncHandSeat(){if(handSeat===seat)return;handSeat=seat;$('dock-scroll').scrollLeft=0;try{localStorage.setItem('commanderLabHandSeat',String(handSeat));}catch{}}
function setPanel(name){panel=name;for(const key of ['stack','log']){$(key+'-panel').hidden=key!==name;$('tab-'+key).setAttribute('aria-selected',String(key===name));$('tab-'+key).classList.toggle('selected',key===name);}}
function showPanel(){ $('workspace').classList.remove('panel-hidden');$('togglepanel').setAttribute('aria-expanded','true');$('togglepanel').textContent='Stack / Log ▷';}
function refreshHover(){
 const hit=!draggedId&&hoverPoint&&document.elementFromPoint(hoverPoint.x,hoverPoint.y)?.closest('.card[data-card]');
 const target=hit?.draggable&&findCard(g,hit.dataset.card)?hit:null;
 selected=target?.dataset.card||null;
 for(const node of document.querySelectorAll('.card.selected'))if(node!==target)node.classList.remove('selected');
 target?.classList.add('selected');
}
function scheduleHover(){if(!hoverFrame)hoverFrame=requestAnimationFrame(()=>{hoverFrame=0;refreshHover();});}
function trackHover(event){hoverPoint={x:event.clientX,y:event.clientY};refreshHover();scheduleHover();}
function clearHover(){hoverPoint=null;refreshHover();}
function concealedHand(id){const found=findCard(g,id);return found?.zone==='hand'&&found.owner!==handSeat;}
function visibleCard(card){return concealedHand(card.instance)?{...card,faceDown:true,counters:{}}:card;}
// Only a current effect may reveal another hand in a focused inspection.
// Network snapshots still enforce which card identities this client receives.
function inspectionCard(id,node){
 const found=findCard(g,id);if(!found)return null;
 const pending=g.pendingEffect,handView=node?.closest('#mana-dialog')&&pending?.owner===seat&&pending.step?.op==='viewHand'&&pending.step.target===found.owner;
 return handView&&!found.card.hidden?found.card:visibleCard(found.card);
}
function cardColor(c){if(c.previewColor)return c.previewColor;const colors=c.colors||c.color_identity||[];if(colors.length>1)return 'gold';return {U:'blue',B:'black',R:'red',G:'green',W:'gold'}[colors[0]]||'artifact';}
function cardSymbol(c){if(c.type_line?.includes('Land'))return {Forest:'♧',Island:'≈',Mountain:'△',Swamp:'☾',Plains:'☀'}[c.name]||'◇';if(c.type_line?.includes('Artifact'))return '◇';if(c.commander)return '♛';if(c.token)return '✧';return '✦';}
// ---- Card rendering and drag/drop ----
// Keep the grab point as a fraction of the card, so dock magnification and
// battlefield zoom can change its displayed size without shifting the cursor.
function clearHandDragImage(){handDragImage?.remove();handDragImage=null;}
function setHandDragImage(event,card){
 clearHandDragImage();
 const field=$('zones').querySelector('.battlefield .cards'),styles=getComputedStyle(field),scale=camera?.scale||1;
 const width=(parseFloat(styles.getPropertyValue('--card-width'))||180)*scale,height=(parseFloat(styles.getPropertyValue('--card-height'))||252)*scale;
 handDragImage=el('div',undefined,'hand-drag-image');handDragImage.setAttribute('aria-hidden','true');
 handDragImage.style.width=width+'px';handDragImage.style.height=height+'px';handDragImage.style.setProperty('--drag-scale',String(width/180));
 const copy=cardButton({...card,tapped:false},{interactive:false});copy.removeAttribute('data-card');copy.removeAttribute('title');copy.tabIndex=-1;
 handDragImage.append(copy);document.body.append(handDragImage);
 event.dataTransfer.setDragImage(handDragImage,Math.round(dragOffset.x*width),Math.round(dragOffset.y*height));
}
function enableCardDrag(node,card,{concealed=false,preview=false,rotated=false}={}){
 let grab=null,counterGrab=false;
 node.addEventListener('pointerdown',event=>{counterGrab=!!event.target.closest('[data-counter-control]');},true);
 const initial=typeof card==='function'?card():card;node.draggable=!!initial&&!concealedHand(initial.instance)&&(!networkSession||findCard(g,initial.instance)?.owner===seat);
 // Capture the original grab before a hover transition or drag threshold moves it.
 node.onpointerdown=event=>{if(event.button!==0)return;const r=node.getBoundingClientRect();grab={x:Math.max(0,Math.min(1,(event.clientX-r.left)/Math.max(1,r.width))),y:Math.max(0,Math.min(1,(event.clientY-r.top)/Math.max(1,r.height)))};};
 node.onpointerup=node.onpointercancel=()=>{grab=null;};
 node.ondragstart=event=>{
  if(event.defaultPrevented||counterGrab){event.preventDefault();return;}
  const current=typeof card==='function'?card():card;
  if(!current||!findCard(g,current.instance)||concealedHand(current.instance)||networkSession&&findCard(g,current.instance)?.owner!==seat){event.preventDefault();return;}
  draggedId=current.instance;const rect=node.getBoundingClientRect(),offset=grab||{x:(event.clientX-rect.left)/Math.max(1,rect.width),y:(event.clientY-rect.top)/Math.max(1,rect.height)};
  dragOffset=rotated?{x:offset.y,y:1-offset.x}:offset;
  event.dataTransfer.setData('application/x-commander-card',current.instance);event.dataTransfer.setData('text/plain',JSON.stringify({id:current.instance}));event.dataTransfer.effectAllowed='move';node.classList.add('dragging');
  if(preview||node.closest('.dock-slot')||concealedHand(current.instance))setHandDragImage(event,preview?{...current,faceDown:concealed}:visibleCard(current));
  // Let Chromium capture the drag image before hiding a source dialog.
  if($('pile-dialog').open)setTimeout(()=>{if(draggedId===current.instance&&$('pile-dialog').open)$('pile-dialog').close();},0);
  setStatus('Drop on a zone or another player’s mat. Hover the Stack tab to cast.');
 };
 node.ondragend=()=>{grab=null;draggedId=null;clearHandDragImage();node.classList.remove('dragging');document.querySelectorAll('.drop-target').forEach(e=>e.classList.remove('drop-target'));};
}
function pileTop(owner,zone){const cards=g.players[owner].zones[zone];return zone==='library'?cards[0]:cards.at(-1);}
function pileButton(owner,zone){
 const player=g.players[owner],top=pileTop(owner,zone),pile=button('',()=>openPile(owner,zone),'pile '+zone+(top?'':' pile-empty'));
 let face;
 if(zone==='library'){face=el('img');face.src=CARD_BACK_URL;face.alt='Commander Lab card back';face.draggable=false;}
 else if(top){const card=cardButton({...top,faceDown:false,tapped:false},{interactive:false});face=el('div',undefined,card.className+' pile-face');face.append(...card.childNodes);face.setAttribute('aria-label',top.name);}
 else face=el('span','∅','pile-empty-mark');
 const caption=el('div',undefined,'pile-caption');caption.append(el('span',zone.toUpperCase(),'pile-label'),el('strong',String(player.zones[zone].length)));
 pile.append(face,caption);pile.title=top?(zone==='library'?'':top.name+' · ')+'Drag the top card · Click to browse':'Empty pile · Drop a card here or click to browse';
 pile.setAttribute('aria-label',player.name+' '+zone+', '+player.zones[zone].length+' cards. '+(top?'Drag top card or browse pile':'Browse empty pile'));
 if(top){pile.dataset.topCard=top.instance;enableCardDrag(pile,()=>pileTop(owner,zone),{concealed:zone==='library',preview:true,rotated:zone==='exile'});}
 else{pile.draggable=false;pile.ondragstart=event=>event.preventDefault();}
 enableDrop(pile,owner,zone);return pile;
}
function cardButton(c,{interactive=true,overlayControls=false,revealed=false}={}){
 c=revealed?c:visibleCard(c);
 const found=findCard(g,c.instance),onBoard=found?.zone==='battlefield',handActions=!c.faceDown&&found?.zone==='hand'&&found.owner===seat&&activatedAbilities(g,found.owner,c).some(a=>a.cycling||a.handOnly),editable=(interactive||overlayControls)&&(onBoard||handActions);
 // A battlefield card groups real counter buttons; controls must not nest in a button.
 const b=el(editable?'div':'button',undefined,'card card-'+cardColor(c)+(c.tapped?' tapped':''));
 if(editable){b.setAttribute('role','group');b.tabIndex=interactive?0:-1;}else b.type='button';b.dataset.card=c.instance;b.title=c.faceDown?'Face-down card':c.name;b.setAttribute('aria-label',(c.faceDown?'Face-down card':c.name)+(c.tapped?', tapped':''));b.draggable=interactive;
 const src=c.localImages?.[c.face||0];
 b.dataset.displayFace=c.faceDown?'back':String(c.face||0);b.dataset.cardZone=found?.zone||'';b.dataset.permanentId=c.battlefieldId||'';
 if(c.faceDown){const back=el('div',undefined,'card-back-design'),image=el('img');image.src=CARD_BACK_URL;image.alt='Commander Lab card back';image.draggable=false;back.append(image);b.append(back);}
 else if(typeof src==='string'&&src.startsWith('data:image/')){const image=el('img');image.src=src;image.alt=c.name;image.draggable=false;b.append(image);}
 else{b.append(el('span',c.card_faces?.[c.face||0]?.name||c.name,'card-name'),el('span',cardSymbol(c),'card-illustration'),el('span',c.type_line||(c.token?'Token':'Card'),'card-type'),el('span',c.power&&c.toughness?c.power+'/'+c.toughness:c.mana_cost||'','card-footer'));}
 if((!c.faceDown||c.manifested)&&onBoard){
  const overlay=el('span',undefined,'card-overlays'),stats=combatStats(g,findCard(g,c.instance)?.owner??seat,c),counters=el('span',undefined,'card-counter-overlays');
  const displayed={...c.counters},type=cardFace(c).type_line||'';for(const [kind,key] of [['Planeswalker','loyalty'],['Battle','defense']])if(type.includes(kind))displayed[key]??=0;
  const entries=Object.entries(displayed).filter(([key,n])=>n||key==='loyalty'&&type.includes('Planeswalker')||key==='defense'&&type.includes('Battle'));
  const loyalty=type.includes('Planeswalker')?entries.find(([name])=>name==='loyalty'):null,otherCounters=entries.filter(entry=>entry!==loyalty);let loyaltyChip;
  for(const [name,n] of [...otherCounters.slice(0,4),...(loyalty?[loyalty]:[])]){
   const chip=el(editable?'button':'span',name==='loyalty'&&loyalty?String(n):n+' '+name,'card-counter-overlay');chip.dataset.counter=name;chip.setAttribute('aria-label',name+': '+n);
   if(editable){chip.type='button';chip.title='Left-click +1 · Right-click −1';chip.setAttribute('aria-label',name+': '+n+'. Click to add one; right-click to remove one.');counterControl(chip,()=>adjustCounter(c.instance,name,1),()=>adjustCounter(c.instance,name,-1));}
   if(name==='loyalty'&&loyalty){chip.classList.add('card-loyalty-overlay');loyaltyChip=chip;}else counters.append(chip);
  }if(otherCounters.length>4)counters.append(el('span','+'+(otherCounters.length-4)+' types','card-counter-overlay'));
  if(c.entryChoices?.length)overlay.append(el('span','Set entry values','card-entry-pending'));
  overlay.append(counters);if(stats){const damaged=(c.markedDamage||0)>0&&Number.isFinite(stats.remaining),remaining=damaged?Math.max(0,stats.remaining):stats.toughness,pt=el('span',undefined,'card-pt-overlay'),toughness=el('span',String(remaining),damaged?'card-toughness damaged':'card-toughness');pt.append(document.createTextNode(stats.power+' / '),toughness);pt.setAttribute('aria-label','Power '+stats.power+', '+(damaged?'remaining toughness '+remaining+'; '+c.markedDamage+' damage marked against total toughness '+stats.toughness:'toughness '+stats.toughness));if(damaged)pt.title=c.markedDamage+' damage marked · total toughness '+stats.toughness+' · damage clears at cleanup';overlay.append(pt);}if(loyaltyChip)overlay.append(loyaltyChip);b.append(overlay);renderLoyaltyAbilities(c,b,editable);
  if(editable&&(!c.faceDown||found.owner===seat)){const toggle=el('button','▾','card-actions-toggle');toggle.type='button';toggle.title='Card actions';toggle.setAttribute('aria-label','Card actions for '+c.name);toggle.setAttribute('aria-haspopup','menu');toggle.setAttribute('aria-controls','card-actions-menu');toggle.setAttribute('aria-expanded','false');counterControl(toggle,()=>openCardActions(c.instance,toggle));b.append(toggle);}
 }
 if(handActions&&editable){const toggle=el('button','▾','card-actions-toggle');toggle.type='button';toggle.title='Card actions';toggle.setAttribute('aria-label','Card actions for '+c.name);toggle.setAttribute('aria-haspopup','menu');counterControl(toggle,()=>openCardActions(c.instance,toggle));b.append(toggle);}
 if(interactive){
  enableCardDrag(b,c);
  b.addEventListener('click',e=>{if(!e.target.closest('[data-counter-control]')&&combatUI?.cardClick(c.instance)){e.preventDefault();e.stopImmediatePropagation();}});
  b.ondblclick=e=>{e.preventDefault();if(!e.target.closest('[data-counter-control]')&&!combatUI?.selectingCard(c.instance))toggleTapped(c.instance);};
  b.oncontextmenu=e=>{e.preventDefault();if(!e.target.closest('[data-counter-control]'))toggleTapped(c.instance);};
 }
 if(onBoard&&c.tapped)b.append(tapIndicator());
 // Keep the icon strip in the same bottom row as stats; counters remain above.
 const keywords=keywordStrip(cardKeywordBadges(g,found?.owner??seat,c,{onBoard}));
 if(keywords){
  const overlay=b.querySelector('.card-overlays');
  if(overlay){const footer=el('span',undefined,'card-bottom-row');footer.append(keywords);for(const stat of overlay.querySelectorAll('.card-pt-overlay,.card-loyalty-overlay'))footer.append(stat);overlay.append(footer);}
  else{const footer=el('span',undefined,'card-overlays');footer.append(keywords);b.append(footer);}
 }
 manaUI?.decorateCard(b,c,{interactive});combatUI?.decorateCard(b,c);return b;
}
function toggleTapped(id,{manual=false,fromEffect=false}={}){const found=findCard(g,id);if(!found||found.zone!=='battlefield'||networkSession&&found.owner!==seat)return;seat=found.owner;if(!manual&&!fromEffect&&manaUI?.useSource(id))return;dispatch({type:'tap',id,fromEffect});}
function toggleFaceDown(id){const found=findCard(g,id);if(!found||found.card.commander||found.zone==='command'||found.zone==='graveyard'||found.zone==='exile'||concealedHand(id))return;dispatch({type:'faceDown',id});}
function enableDrop(target,owner,zone){
 target.dataset.drop=zone;target.dataset.owner=String(owner);
 target.ondragover=e=>{if(!draggedId&&!e.dataTransfer.types.includes('application/x-commander-card'))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';target.classList.add('drop-target');};
 target.ondragleave=e=>{if(!target.contains(e.relatedTarget))target.classList.remove('drop-target');};
 target.ondrop=e=>{
  e.preventDefault();e.stopPropagation();target.classList.remove('drop-target');
  try{
   const id=e.dataTransfer.getData('application/x-commander-card')||JSON.parse(e.dataTransfer.getData('text/plain')).id;
   const found=findCard(g,id);if(!found)return;if(concealedHand(id)){draggedId=null;clearHandDragImage();setStatus('Control this seat before moving cards from its hand.');return;}const destination=zone==='stack'?found.owner:owner;let position;
   if(networkSession&&found.zone==='library'&&!g.players[seat].librarySearch){draggedId=null;clearHandDragImage();if(found.owner===seat&&zone==='hand'&&owner===seat)dispatch({type:'draw'});else setStatus('Drag the top of your library to your hand to draw.');return;}
   // A normal play uses announcement/payment; Shift-drag is an explicit manual
   // zone transfer. Both routes ultimately use the same gameplay reducer.
   if(!e.shiftKey&&castingPermission(g,found.owner,found.card,found.zone)&&['stack','battlefield'].includes(zone)&&!/\bLand\b/.test(cardFace(found.card).type_line||'')){
    draggedId=null;clearHandDragImage();manaUI.openCast(id);return;
   }
   if(zone==='battlefield'){
    const rect=target.getBoundingClientRect();const width=parseFloat(getComputedStyle(target).getPropertyValue('--card-width'))||65;const height=parseFloat(getComputedStyle(target).getPropertyValue('--card-height'))||91;
    const scale=camera?.scale||1;
    const w=(found.card.tapped?height:width)*scale,h=(found.card.tapped?width:height)*scale;
    // Store normalized mat coordinates, independent of window/camera size.
    position={x:(e.clientX-rect.left-dragOffset.x*w)/Math.max(1,rect.width-w),y:(e.clientY-rect.top-dragOffset.y*h)/Math.max(1,rect.height-h)};
   }
   if(!e.shiftKey&&['hand','exile','graveyard'].includes(found.zone)&&castingPermission(g,found.owner,found.card,found.zone)&&zone==='battlefield'&&/\bLand\b/.test(cardFace(found.card).type_line||'')){draggedId=null;clearHandDragImage();dispatch({type:'playLand',id,position});return;}
   if(!networkSession)seat=destination;draggedId=null;hoverPoint={x:e.clientX,y:e.clientY};clearHandDragImage();dispatch({type:'move',id,to:zone,owner:destination,position},{message:found.card.name+' → '+LABELS[zone]+(zone==='stack'?'':' · '+g.players[destination].name)});
  }catch(error){setStatus(error.message);}
 };
}
function placeBattlefieldCard(node,card,index){
 const width=parseFloat(getComputedStyle(node).getPropertyValue('--card-width'))||180,height=parseFloat(getComputedStyle(node).getPropertyValue('--card-height'))||252;
 const area=node.parentElement;
 const columns=Math.max(1,Math.floor((area.clientWidth+24)/(width+24)));
 const pos=card.tablePosition||{x:Math.min(1,(index%columns)*(width+24)/Math.max(1,area.clientWidth-width)),y:Math.min(1,Math.floor(index/columns)*(height+24)/Math.max(1,area.clientHeight-height)),normalized:true};
 const x=Math.max(0,Math.min(1,pos.x));let y=pos.normalized?Math.max(0,Math.min(1,pos.y)):Math.max(0,Math.min(1,pos.y/230));
 const w=card.tapped?height:width,h=card.tapped?width:height;
 node.style.left=`calc(${x*100}% - ${x*w}px + ${(w-width)/2}px)`;node.style.top=`calc(${y*100}% - ${y*h}px + ${(h-height)/2}px)`;
}
// ---- Playmats, piles and pinned hand ----
function renderTable(){
 const scroll=new Map([...$('zones').querySelectorAll('.hand .cards')].map(n=>[n.dataset.owner,n.scrollLeft]));
 $('zones').replaceChildren();
 for(const owner of [0,1,3,2].filter(owner=>owner<g.players.length)){
  const player=g.players[owner];const mat=el('section',undefined,'player-mat'+(owner===seat?' focused':''));mat.dataset.seat=owner;mat.style.setProperty('--seat-color',COLORS[owner]);mat.setAttribute('aria-label',player.name+' playmat');
  const heading=el('div',undefined,'mat-heading');
  const identity=button('',()=>selectSeat(owner),'player-heading');const title=el('div');const name=el('h2',player.name+(player.eliminated?' - eliminated':''));if(owner===g.active){const dot=el('span',undefined,'active-marker');dot.title='Active turn';name.append(dot);}title.append(name,el('span','SEAT 0'+(owner+1)+(owner===seat?' / CONTROLLING':''),'seat-description'));identity.append(el('span',String(owner+1),'seat-avatar'),title);
  const tools=el('div',undefined,'mat-tools'),life=el('div',undefined,'life-control');
  const less=button('−',()=>dispatch({type:'life',owner,delta:-1}));less.setAttribute('aria-label',player.name+': subtract one life');
  const total=button(String(player.life),()=>openStats(owner),'life-total');total.title='Edit life, poison, commander damage and name';total.setAttribute('aria-label',player.name+': '+player.life+' life. Edit stats');
  const more=button('+',()=>dispatch({type:'life',owner,delta:1}));more.setAttribute('aria-label',player.name+': add one life');life.append(less,total,more);
  tools.append(life,button('Draw',()=>dispatch({type:'draw',owner}), 'draw-button'));heading.append(identity,tools);
  const body=el('div',undefined,'mat-body'),field=el('div',undefined,'battlefield');const fieldHeading=el('div',undefined,'zone-heading');fieldHeading.append(el('span','BATTLEFIELD'),el('span',String(player.zones.battlefield.length),'zone-count'));const cards=el('div',undefined,'cards');
  if(!player.zones.battlefield.length){const empty=el('div',undefined,'battlefield-empty');empty.append(el('div','+','empty-orbit'),el('p','Your next play starts here.'),el('small','Drag a card onto the mat'));cards.append(empty);}
  field.append(fieldHeading,cards);enableDrop(cards,owner,'battlefield');
  const piles=el('div',undefined,'zone-piles');for(const zone of ['library','graveyard','exile'])piles.append(pileButton(owner,zone));body.append(field,piles);
  const bottom=el('div',undefined,'mat-bottom'),command=el('div',undefined,'command-zone'),commandRow=el('div',undefined,'cards');command.append(el('span','COMMAND ZONE','zone-label'),commandRow);
  const occupants=new Map();for(const card of player.zones.command){let slot=card.commandSlot??0;while(occupants.has(slot))slot++;occupants.set(slot,card);}
  for(let slot=0;slot<Math.max(2,...[...occupants.keys()].map(n=>n+1));slot++){
   const area=el('div',undefined,'command-slot'),card=occupants.get(slot),commander=allCards().find(c=>c.commander&&c.commandSlot===slot&&findCard(g,c.instance)?.owner===owner);
   area.dataset.commandSlot=slot;area.append(el('span',slot===0?'COMMANDER':'PARTNER / BACKGROUND','command-slot-label'));
   if(card)area.append(cardButton(card));else{const empty=el('div',commander?commander.name:'♛','command-empty');if(commander)empty.title=commander.name+' is in '+LABELS[findCard(g,commander.instance).zone];area.append(empty);}
   const casts=(card||commander)?.commandCasts??(slot===0?player.casts:0);area.append(el('span','TAX +'+(casts*2),'command-tax'));commandRow.append(area);
  }
  enableDrop(command,owner,'command');
  const hand=el('div',undefined,'hand'),label=el('div',undefined,'zone-label');label.append(el('span','HAND'),el('span',player.zones.hand.length+' CARDS'));const handRow=el('div',undefined,'cards');player.zones.hand.forEach(c=>handRow.append(cardButton(c)));if(!player.zones.hand.length)handRow.append(el('p','No cards in hand. Import a deck or draw.','empty-hand'));enableDrop(handRow,owner,'hand');hand.append(label,handRow);bottom.append(command,hand);
  mat.style.gridColumn=owner===1||owner===2?'2':'1';mat.style.gridRow=owner>=2?'2':'1';mat.append(heading,body,bottom);$('zones').append(mat);
  if(owner===handSeat){mat.classList.add('pinned-player');hand.hidden=true;bottom.hidden=true;piles.prepend(command);}
  player.zones.battlefield.forEach((c,index)=>{const b=cardButton(c);cards.append(b);placeBattlefieldCard(b,c,index);});handRow.scrollLeft=scroll.get(String(owner))||0;
 }
}
function renderHandDock(){
 const player=g.players[handSeat],items=$('dock-items'),scroll=$('dock-scroll').scrollLeft;
 dock?.reset();items.replaceChildren();items.dataset.empty=String(!player.zones.hand.length);
 $('dock-caption').textContent=player.zones.hand.length?'Hover to enlarge · Drag to play':'Import a deck or drop a card here.';
 $('dock-player').replaceChildren(...g.players.map((p,i)=>{const option=el('option','Seat '+(i+1)+' · '+p.name);option.value=i;return option;}));$('dock-player').value=handSeat;
 $('dock-count').textContent=player.zones.hand.length+' CARDS';$('hand-dock').setAttribute('aria-label',player.name+' pinned hand');
 for(const card of player.zones.hand){const slot=el('div',undefined,'dock-slot');slot.setAttribute('role','listitem');slot.dataset.name=card.faceDown?'Face-down card':card.name;const b=cardButton(card);b.removeAttribute('title');slot.append(b);items.append(slot);}
 if(!player.zones.hand.length){const empty=el('div',undefined,'dock-empty');empty.append(el('p','Your hand stays here while you explore the table.'),button('Import deck',()=>openImport(handSeat)));items.append(empty);}
 enableDrop($('hand-dock'),handSeat,'hand');dock?.layout();$('dock-scroll').scrollLeft=scroll;
}
function renderSelection(){
 $('view-seat').textContent='SEAT 0'+(seat+1);$('focus-seat').textContent='My area · '+(seat+1);
 $('quickstats').textContent=g.players[seat].life+' Life';
 document.querySelectorAll('.map-seat').forEach(b=>{const owner=Number(b.dataset.seat);b.hidden=owner>=g.players.length;b.disabled=b.hidden;b.classList.toggle('selected',owner===seat);if(g.players[owner])b.title='Focus '+g.players[owner].name;});
 document.querySelectorAll('.player-mat').forEach(mat=>mat.classList.toggle('focused',Number(mat.dataset.seat)===seat));
 document.querySelectorAll('#players button').forEach((b,i)=>{b.classList.toggle('selected',i===seat);b.setAttribute('aria-pressed',String(i===seat));});
 refreshHover();
 document.querySelectorAll('.seat-description').forEach(label=>{const owner=Number(label.closest('.player-mat').dataset.seat);label.textContent='SEAT 0'+(owner+1)+(owner===seat?' / CONTROLLING':'');});
 playerCountSelect.value=String(g.players.length);document.querySelector('.table-state span:nth-child(2)').textContent=g.players.length+' seats. One table.';
}
// ---- Card overlays: counters, stats, loyalty and action menus ----
function adjustCounter(id,name,amount){
 const found=findCard(g,id),trimmed=name.trim().replace(/\s+/g,' ');
 if(!found||!trimmed||!Number.isSafeInteger(amount)||!amount)return;
 const card=found.card,key=Object.keys(card.counters||{}).find(existing=>existing.toLowerCase()===trimmed.toLowerCase())||trimmed;
 const previous=Object.hasOwn(card.counters||{},key)?card.counters[key]:0,next=Math.max(0,previous+amount);
 if(!Number.isSafeInteger(next)||next===previous)return;
 dispatch({type:'counterEdit',id:card.instance,counter:key,delta:next-previous});
}
function counterControl(node,add,remove){
 node.dataset.counterControl='true';node.draggable=false;
 const stop=event=>{event.preventDefault();event.stopPropagation();};
 node.onpointerdown=event=>event.stopPropagation();node.onmousedown=stop;node.ondragstart=stop;node.ondblclick=stop;
 node.onclick=event=>{stop(event);add();};node.oncontextmenu=event=>{stop(event);remove?.();};
 node.onkeydown=event=>{if([' ','Enter'].includes(event.key))event.stopPropagation();else if(remove&&['-','Backspace','Delete'].includes(event.key)){stop(event);remove();}};
}
const loyaltyArtLayouts=new Map();
function activateLoyalty(id,index,x=0){
 if(manaUI?.openLoyalty(id,index,x))return;
 dispatch({type:'loyalty',id,index,x});
}
const loyaltyDialog=el('dialog');loyaltyDialog.id='loyalty-cost-dialog';const loyaltyForm=el('form'),loyaltyTitle=el('h2'),loyaltyText=el('p'),loyaltyX=el('input');loyaltyX.id='loyalty-x';loyaltyX.type='number';loyaltyX.min=0;loyaltyX.step=1;loyaltyX.required=true;const loyaltyLabel=el('label','Choose X');loyaltyLabel.htmlFor='loyalty-x';const loyaltyActions=el('div',undefined,'dialog-actions'),pay=el('button','Pay loyalty cost','primary');pay.type='submit';loyaltyActions.append(button('Cancel',()=>loyaltyDialog.close()),pay);loyaltyForm.append(loyaltyTitle,loyaltyText,loyaltyLabel,loyaltyX,loyaltyActions);loyaltyDialog.append(loyaltyForm);document.body.append(loyaltyDialog);
loyaltyForm.onsubmit=event=>{event.preventDefault();const id=loyaltyDialog.dataset.card,index=loyaltyDialog.dataset.ability,x=Number(loyaltyX.value);loyaltyDialog.close();activateLoyalty(id,index,x);};
function useLoyaltyAbility(id,index){
 const found=findCard(g,id),card=found?.card,ability=card&&getLoyaltyAbility(g,found.owner,card,index);if(!ability)return;const status=loyaltyStatus(g,found.owner,card);if(status.reason){setStatus(status.reason);return;}
 if(!ability.variable){activateLoyalty(id,index);return;}
 loyaltyDialog.dataset.card=id;loyaltyDialog.dataset.ability=index;loyaltyTitle.textContent=cardFace(card).name||card.name;loyaltyText.textContent=ability.label+': '+ability.text;loyaltyX.value=0;loyaltyX.max=ability.sign<0?card.counters?.loyalty??0:999999;loyaltyDialog.showModal();loyaltyX.select();
}
function renderLoyaltyAbilities(card,node,editable){
 const owner=findCard(g,card.instance)?.owner??seat,abilities=availableLoyaltyAbilities(g,owner,card);if(!abilities.length)return;
 const printed=abilities.filter(a=>a.printed),status=loyaltyStatus(g,owner,card),layer=el('span',undefined,'card-loyalty-abilities'),grantedLayer=el('span',undefined,'card-granted-loyalty-abilities'),face=card.face||0,defaults=defaultAbilityPositions(card),buttons=[];
 const setPosition=(button,position)=>{button.style.left=position.x*100+'%';button.style.top=position.y*100+'%';button.dataset.layoutX=position.x;button.dataset.layoutY=position.y;};
 abilities.forEach((ability,index)=>{
  const unavailable=status.reason||(!ability.variable&&ability.delta<0&&(card.counters?.loyalty??0)<-ability.delta?'Not enough loyalty.':'');
  const control=el(editable?'button':'span',ability.printed?ability.label:ability.label+' · '+ability.text,'card-loyalty-ability');control.dataset.ability=index;control.dataset.abilityKey=ability.key;if(!ability.printed)control.dataset.grantedBy=ability.grantedBy;
  control.title=ability.label+': '+ability.text+(ability.grantedBy?' · Granted by '+ability.grantedBy:'')+(unavailable?' · '+unavailable:'')+(editable&&ability.printed?' · Shift-drag to adjust alignment':'');control.setAttribute('aria-label','Activate '+ability.label+': '+ability.text+(ability.grantedBy?' (granted by '+ability.grantedBy+')':''));if(ability.printed){setPosition(control,card.loyaltyLayout?.[face]?.[index]||defaults[index]);buttons.push(control);}
  if(editable){
   control.type='button';control.setAttribute('aria-disabled',String(!!unavailable));let adjusting=null,suppressClick=false;
   counterControl(control,()=>{if(suppressClick){suppressClick=false;return;}useLoyaltyAbility(card.instance,ability.key);});
   control.onpointerdown=event=>{event.stopPropagation();suppressClick=false;if(ability.printed&&event.button===0&&event.shiftKey){event.preventDefault();suppressClick=true;adjusting={pointer:event.pointerId,rect:node.getBoundingClientRect(),moved:false};control.setPointerCapture(event.pointerId);}};
   control.onpointermove=event=>{if(!adjusting||event.pointerId!==adjusting.pointer)return;event.stopPropagation();const r=adjusting.rect,x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;setPosition(control,{x:Math.max(.02,Math.min(.98,card.tapped?y:x)),y:Math.max(.02,Math.min(.98,card.tapped?1-x:y))});adjusting.moved=true;};
   control.onpointerup=event=>{if(!adjusting||event.pointerId!==adjusting.pointer)return;event.stopPropagation();const moved=adjusting.moved;adjusting=null;if(control.hasPointerCapture(event.pointerId))control.releasePointerCapture(event.pointerId);if(moved){const update=()=>{const actual=findCard(g,card.instance)?.card;if(actual)actual.loyaltyLayout={...actual.loyaltyLayout,[face]:buttons.map(b=>({x:Number(b.dataset.layoutX),y:Number(b.dataset.layoutY)}))};};if(networkSession){update();rememberArt();}else mutate(update);}};
   control.onpointercancel=()=>{adjusting=null;if(ability.printed)setPosition(control,card.loyaltyLayout?.[face]?.[index]||defaults[index]);};
   control.onlostpointercapture=()=>{if(adjusting){adjusting=null;setPosition(control,card.loyaltyLayout?.[face]?.[index]||defaults[index]);}};
  }
  (ability.printed?layer:grantedLayer).append(control);
 });node.append(layer);if(grantedLayer.childElementCount)node.append(grantedLayer);
 const image=node.querySelector('img');if(!image||!printed.length)return;
 const align=()=>{if(!node.isConnected||!image.naturalWidth)return;let positions=loyaltyArtLayouts.get(image.src);if(positions===undefined){try{const canvas=document.createElement('canvas');canvas.width=Math.min(745,image.naturalWidth);canvas.height=Math.round(canvas.width*image.naturalHeight/image.naturalWidth);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);positions=detectLoyaltyPositions(ctx.getImageData(0,0,canvas.width,canvas.height),printed.length);}catch{positions=null;}loyaltyArtLayouts.set(image.src,positions);}buttons.forEach((b,index)=>setPosition(b,card.loyaltyLayout?.[face]?.[index]||positions?.[index]||defaults[index]));};
 if(image.complete)queueMicrotask(align);else image.addEventListener('load',align,{once:true});
}
const cardActionsMenu=el('div');cardActionsMenu.id='card-actions-menu';cardActionsMenu.popover='auto';cardActionsMenu.setAttribute('role','menu');cardActionsMenu.setAttribute('aria-label','Card actions');document.body.append(cardActionsMenu);let cardActionsInvoker=null;
cardActionsMenu.addEventListener('beforetoggle',event=>{if(event.newState==='closed'){cardActionsInvoker?.setAttribute('aria-expanded','false');cardActionsInvoker=null;}});
cardActionsMenu.addEventListener('keydown',event=>{
 event.stopPropagation();const items=[...cardActionsMenu.querySelectorAll('[role=menuitem]')],index=items.indexOf(document.activeElement);
 if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
 if(event.key==='Escape'){event.preventDefault();const invoker=cardActionsInvoker;cardActionsMenu.hidePopover();if(invoker?.isConnected)invoker.focus({preventScroll:true});}
});
function openCardActions(id,anchor){
 const found=findCard(g,id);if(!found||found.card.faceDown&&!found.card.manifested||!(found.zone==='battlefield'||found.zone==='hand'&&found.owner===seat&&activatedAbilities(g,found.owner,found.card).some(a=>a.cycling||a.handOnly)))return;
 if(cardActionsMenu.matches(':popover-open')&&cardActionsInvoker===anchor){cardActionsMenu.hidePopover();return;}
 cardActionsInvoker?.setAttribute('aria-expanded','false');cardActionsInvoker=anchor;anchor.setAttribute('aria-expanded','true');cardActionsMenu.replaceChildren(el('h3','CARD ACTIONS'));
 const actions=found.card.manifested?[{id:'turn-face-up',label:'Turn face up (pay mana cost)',open:()=>dispatch({type:'turnFaceUp',id})}]:found.zone==='hand'?[{id:'mana',label:'Card abilities',open:()=>manaUI.openSource(id)}]:[{id:'counters',label:'Counters',open:rect=>openCounterMenu(id,rect)},{id:'mana',label:'Card abilities',open:()=>manaUI.openSource(id)},{id:'mana-settings',label:'Mana rules',open:()=>manaUI.openSettings(id)}];
 if(availableLoyaltyAbilities(g,found.owner,found.card).length||/loyalty abilities/i.test(cardFace(found.card).oracle_text||''))actions.push({id:'loyalty-settings',label:'Loyalty activations',open:()=>manaUI.openLoyaltySettings(id)});
 for(const action of actions){const item=button('',()=>{const rect=cardActionsMenu.getBoundingClientRect();cardActionsMenu.hidePopover();action.open(rect);},'card-action-item');item.setAttribute('role','menuitem');item.setAttribute('aria-haspopup','dialog');item.dataset.action=action.id;item.append(el('span',action.label),el('span','›','card-action-chevron'));cardActionsMenu.append(item);}
 const rect=anchor.getBoundingClientRect();cardActionsMenu.showPopover();cardActionsMenu.style.left=Math.max(16,Math.min(rect.left,innerWidth-cardActionsMenu.offsetWidth-16))+'px';cardActionsMenu.style.top=Math.max(16,Math.min(rect.bottom+6,innerHeight-cardActionsMenu.offsetHeight-16))+'px';cardActionsMenu.querySelector('[role=menuitem]').focus({preventScroll:true});
}
const counterMenu=el('div');counterMenu.id='counter-menu';counterMenu.popover='auto';counterMenu.setAttribute('role','dialog');counterMenu.setAttribute('aria-label','Add a counter');document.body.append(counterMenu);
counterMenu.addEventListener('keydown',event=>event.stopPropagation());
function openCounterMenu(id,anchor){
 const found=findCard(g,id);if(found?.zone!=='battlefield'||found.card.faceDown)return;
 const rect=anchor.getBoundingClientRect?anchor.getBoundingClientRect():anchor,add=name=>{if(!name.trim())return;counterMenu.hidePopover();adjustCounter(id,name,1);};counterMenu.replaceChildren(el('h3','ADD A COUNTER'));
 const quick=el('div',undefined,'counter-menu-quick');for(const name of ['+1/+1','-1/-1','charge','loyalty'])quick.append(button(name,()=>add(name)));counterMenu.append(quick);
 const presets=el('select');presets.id='card-counter-preset';presets.setAttribute('aria-label','Choose a counter type');const placeholder=el('option','More counter types…');placeholder.value='';presets.append(placeholder);
 for(const [label,types] of COUNTER_PRESETS){const group=el('optgroup');group.label=label;for(const name of types){const option=el('option',name);option.value=name;group.append(option);}presets.append(group);}presets.onchange=()=>{if(presets.value)add(presets.value);};counterMenu.append(presets);
 const row=el('div',undefined,'counter-menu-custom'),input=el('input');input.id='card-counter-name';input.placeholder='Custom counter';input.maxLength=40;input.setAttribute('aria-label','Custom counter name');row.append(input,button('Add',()=>add(input.value)));input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();add(input.value);}};counterMenu.append(row);
 counterMenu.showPopover();counterMenu.style.left=Math.max(16,Math.min(rect.left,innerWidth-counterMenu.offsetWidth-16))+'px';counterMenu.style.top=Math.max(16,Math.min(rect.bottom+8,innerHeight-counterMenu.offsetHeight-16))+'px';quick.querySelector('button').focus({preventScroll:true});
}
function renderCounterControls(card){
 const counters=el('div',undefined,'counter-controls'),label=el('label','COUNTERS');label.htmlFor='counter-preset';
 const hint=el('p','Left-click +1 · Right-click −1','counter-hint'),chips=el('div',undefined,'counter-chips');
 for(const [key,n] of Object.entries(card.counters||{}))if(n){
  const chip=button(n+' '+key,()=>adjustCounter(card.instance,key,1),'counter-chip');chip.dataset.counter=key;
  chip.title='Left-click: add one · Right-click: remove one';chip.setAttribute('aria-label',key+': '+n+'. Click to add one; right-click to remove one.');
  chip.oncontextmenu=event=>{event.preventDefault();adjustCounter(card.instance,key,-1);};chips.append(chip);
 }
 const presets=el('select');presets.id='counter-preset';presets.setAttribute('aria-label','Add a common or keyword counter');const placeholder=el('option','Add a common counter…');placeholder.value='';presets.append(placeholder);
 for(const [group,types] of COUNTER_PRESETS){const options=el('optgroup');options.label=group;for(const type of types){const option=el('option',type);option.value=type;options.append(option);}presets.append(options);}
 presets.onchange=()=>{if(presets.value)adjustCounter(card.instance,presets.value,1);};
 const row=el('div',undefined,'control-row'),name=el('input');name.id='counter-name';name.value='+1/+1';name.maxLength=40;name.placeholder='Custom counter name';name.setAttribute('aria-label','Custom counter type');
 const amount=el('input');amount.id='counter-amount';amount.type='number';amount.step='1';amount.value=1;amount.setAttribute('aria-label','Counter amount (negative removes)');
 const add=button('Add',()=>{if(!Number.isSafeInteger(Number(amount.value))){setStatus('Use a whole-number counter amount.');return;}adjustCounter(card.instance,name.value,Number(amount.value));});add.id='counter-add';
 row.append(name,amount,add);counters.append(label,hint,chips,presets,row);return counters;
}
function renderCreatureControls(card){
 const stats=creatureStats(card);if(!stats)return null;
 const controls=el('div',undefined,'creature-controls'),row=el('div',undefined,'control-row');controls.append(el('h3','POWER / TOUGHNESS'));
 for(const [key,label,value] of [['power','Base power',stats.basePower],['toughness','Base toughness',stats.baseToughness]]){
  const group=el('div'),caption=el('label',label),input=el('input');input.id='creature-'+key;caption.htmlFor=input.id;input.type='number';input.step=1;input.min=-999999;input.max=999999;input.value=value??'';input.placeholder=cardFace(card)[key]??'?';group.append(caption,input);row.append(group);
 }
 const save=button('Set stats',()=>{const power=$('creature-power'),toughness=$('creature-toughness');if(!power.value||!toughness.value||!power.reportValidity()||!toughness.reportValidity())return;const values={face:card.face||0,power:Number(power.value),toughness:Number(toughness.value)};dispatch({type:'stats',id:card.instance,values});});save.id='creature-stats-apply';
 controls.append(row,el('p','Counters adjust these base values automatically. Other abilities and temporary effects can be set here.','counter-hint'),save,button('Use printed stats',()=>dispatch({type:'stats',id:card.instance,values:null})));return controls;
}
// ---- Entry choices and the floating inspector ----
// Commands replace state objects. Track a permanent's entry identity, not its
// object reference, so "Later" survives unrelated actions and shared updates.
const deferredEntries=new Set();
const entryKey=card=>card.instance+':'+(card.battlefieldId||card.zoneChangeId||'');
function promptEntry(id){
 const found=findCard(g,id);if(!found||found.zone!=='battlefield'||!found.card.entryChoices?.length)return;
 const card=found.card,fields=$('entry-fields');fields.replaceChildren();$('entry-dialog').dataset.card=id;$('entry-title').textContent=cardFace(card).name||card.name;$('entry-oracle').textContent=cardFace(card).oracle_text||'';
 for(const choice of card.entryChoices){const group=el('div'),label=el('label',choice.label),input=el('input');input.id='entry-'+fields.children.length;label.htmlFor=input.id;input.dataset.choice=choice.key;input.type='number';input.step=1;input.min=choice.min;input.max=999999;input.required=true;input.value=choice.suggested;group.append(label,input);fields.append(group);}
 $('entry-dialog').showModal();fields.querySelector('input')?.select();
}
function maybePromptEntry(){
 const pending=g.players.flatMap(player=>player.zones.battlefield).filter(card=>card.entryChoices?.length);
 const live=new Set(pending.map(entryKey));
 for(const key of deferredEntries)if(!live.has(key))deferredEntries.delete(key);
 const dialog=$('entry-dialog');if(dialog.open){const found=findCard(g,dialog.dataset.card);if(found?.zone==='battlefield'&&found.card.entryChoices?.length)return;dialog.close();}
 if(document.querySelector('dialog[open]'))return;
 const card=pending.find(card=>!deferredEntries.has(entryKey(card))&&(!networkSession||findCard(g,card.instance)?.owner===seat));if(card)promptEntry(card.instance);
}
$('entry-form').onsubmit=event=>{event.preventDefault();const found=findCard(g,$('entry-dialog').dataset.card);if(!found)return;
 const values=Object.fromEntries([...$('entry-fields').querySelectorAll('input')].map(input=>[input.dataset.choice,Number(input.value)]));
 dispatch({type:'entryValues',id:found.card.instance,values});
};
function deferEntry(){const found=findCard(g,$('entry-dialog').dataset.card);if(found)deferredEntries.add(entryKey(found.card));$('entry-dialog').close();}
$('entry-later').onclick=deferEntry;$('entry-dialog').oncancel=event=>{event.preventDefault();deferEntry();};
document.addEventListener('toggle',event=>{if(event.target.matches('dialog')&&event.newState==='closed')queueMicrotask(()=>{maybePromptEntry();manaUI?.maybeResolveEffect();openingHandUI?.refresh();});},true);
function renderInspector(id=cardPreview?.id||selected,{readOnly=false,inspectionCard:inspected}={}){
 const container=$('inspector'),scroll=container.dataset.card===id?container.scrollTop:0;container.dataset.card=id||'';container.replaceChildren();const found=id&&findCard(g,id);
 if(!found){const empty=el('div',undefined,'inspection-empty');empty.append(el('div','◇','empty-card-icon'),el('h2','A closer look.'),el('p','Hold Left Alt over a card to inspect it and make your next move.'));container.append(empty);return;}
 const {owner,zone}=found,card=inspected||visibleCard(found.card),hidden=concealedHand(id)&&(!inspected||inspected.faceDown);
 const location=el('div',undefined,'inspector-location');location.append(el('span','SEAT 0'+(owner+1)+' / '+LABELS[zone]),el('span',card.practice?'PRACTICE':card.token?'TOKEN':'CARD'));
 container.append(location,el('h2',card.faceDown?'Face-down card':card.card_faces?.[card.face||0]?.name||card.name));
 if(card.manifested&&owner===seat){const printed=card.card_faces?.[0]||card;container.append(el('p','Manifested card: '+printed.name+' '+(printed.mana_cost||''),'type-line'),el('p',printed.oracle_text||'','oracle-text'));}
 if(hidden||networkSession&&owner!==seat&&!readOnly){container.append(el('p','Control this seat to use its hand.','panel-caption'));container.scrollTop=scroll;return;}
 if(!card.faceDown)container.append(el('p',card.card_faces?.[card.face||0]?.type_line||card.type_line||'Manual token','type-line'),el('p',card.card_faces?.[card.face||0]?.oracle_text||card.oracle_text||'Add notes when creating a token.','oracle-text'));
 if(readOnly){container.scrollTop=scroll;return;}
 const actions=el('div',undefined,'inspector-actions');if(zone==='battlefield')actions.append(button(card.tapped?'Untap [T]':'Tap [T]',()=>toggleTapped(card.instance)));if(card.manifested&&owner===seat)actions.append(button('Turn face up (pay mana cost)',()=>dispatch({type:'turnFaceUp',id:card.instance})));if(!card.manifested&&!card.commander&&zone!=='command'&&zone!=='graveyard'&&zone!=='exile'&&!hidden)actions.append(button(card.faceDown?'Face up [F]':'Face down [F]',()=>toggleFaceDown(card.instance)));
 if(!card.commander&&zone!=='command'&&!hidden&&(card.localImages?.length||card.card_faces?.length||0)>1)actions.append(button('Flip card face',()=>dispatch({type:'face',id:card.instance})));
 actions.append(button('Library top',()=>dispatch({type:'libraryTop',id:card.instance})),button('Library bottom',()=>dispatch({type:'move',id:card.instance,to:'library',owner,libraryPosition:'bottom'})));
 const libraryPlacement=el('div',undefined,'control-row'),positionLabel=el('label','Position from top (1 = top)'),libraryPosition=el('input');libraryPosition.id='library-position';libraryPosition.type='number';libraryPosition.min=1;libraryPosition.max=g.players[owner].zones.library.length+(zone==='library'?0:1);libraryPosition.step=1;libraryPosition.value=1;positionLabel.htmlFor=libraryPosition.id;
 libraryPlacement.append(positionLabel,libraryPosition,button('Put in library',()=>dispatch({type:'move',id:card.instance,to:'library',owner,libraryPosition:Number(libraryPosition.value)})));
 if(card.token)actions.append(button('Remove token',()=>dispatch({type:'removeToken',id:card.instance})));container.append(actions,libraryPlacement);
 if(!hidden&&castingPermission(g,owner,card,zone))container.append(button('Cast → stack',()=>manaUI.openCast(id)));
 if(!hidden&&zone==='battlefield'){const manaActions=el('div',undefined,'mana-source-actions');manaActions.append(button('Mana abilities',()=>manaUI.openSource(id)),button('Mana rules',()=>manaUI.openSettings(id)));if(card.tapped)manaActions.append(button('Untap from resolved effect',()=>toggleTapped(id,{fromEffect:true})));if(availableLoyaltyAbilities(g,owner,card).length||/loyalty abilities/i.test(cardFace(card).oracle_text||'')){const status=loyaltyStatus(g,owner,card);manaActions.append(button('Loyalty activations · '+status.used+'/'+status.limit,()=>manaUI.openLoyaltySettings(id)));}container.append(manaActions);}
 const controls=el('div',undefined,'move-controls');const moveLabel=el('label','MOVE TO');moveLabel.htmlFor='move-zone';const row=el('div',undefined,'control-row'),zoneSelect=el('select');zoneSelect.id='move-zone';for(const z of [...ZONES,'stack']){const option=el('option',LABELS[z]);option.value=z;zoneSelect.append(option);}zoneSelect.value=zone==='hand'?'battlefield':zone==='stack'?'graveyard':'hand';
 const destination=el('select');destination.id='move-seat';destination.setAttribute('aria-label','Destination player');g.players.forEach((p,i)=>{const option=el('option',p.name);option.value=i;destination.append(option);});destination.value=owner;
 row.append(zoneSelect,button('Move →',()=>dispatch({type:'move',id:card.instance,to:zoneSelect.value,owner:Number(destination.value)})));controls.append(moveLabel,destination,row);container.append(controls);
 if(!hidden){if(zone==='battlefield'){if(card.entryChoices?.length)container.append(button('Set entering values…',()=>promptEntry(card.instance)));const stats=renderCreatureControls(card);if(stats)container.append(stats);}container.append(renderCounterControls(card));}container.scrollTop=scroll;
}
// ---- Stack and coordinated repaint ----
function renderStack(){
 const target=$('stack');target.className='stack-drop';target.replaceChildren();enableDrop(target,seat,'stack');$('stackcount').textContent=g.stack.length;
 if(!g.stack.length)target.append(el('div','The stack is clear. Drop a card here to cast it.','stack-empty'));
 if(g.stack.length)target.append(manaUI.priorityControls());
 [...g.stack].reverse().forEach((entry,index)=>{
  const box=el('div',undefined,'entry'),top=el('div',undefined,'entry-top'),description=el('div');description.append(el('div',!entry.card?entry.name:entry.card.faceDown?'Face-down card':entry.card.name,'entry-name'),el('div',g.players[entry.owner].name+(index===0?' / TOP OF STACK':''),'entry-owner'));
  if(entry.card)top.append(cardButton(entry.card));top.append(description);box.append(top);
  if(!entry.card)box.append(el('p',entry.text,'panel-caption'));
  if(entry.mode!==undefined)box.append(el('p','Chosen mode: '+entry.spellText,'panel-caption'));
  if(entry.targets?.length)box.append(el('p','Targets: '+entry.targets.map(t=>t.label).join(', '),'panel-caption'));
  if(entry.resolving)box.append(el('p','Resolving · finish the current choice to continue.','panel-caption'));
  if(index===0&&!g.pendingEffect){box.append(button(networkSession?'Pass priority':'Resolve now',()=>dispatch({type:networkSession?'pass':'resolveNow'})));if(entry.card&&!networkSession)box.append(button('Resolve → battlefield',()=>dispatch({type:'resolveTo',to:'battlefield'})),button('Resolve → graveyard',()=>dispatch({type:'resolveTo',to:'graveyard'})));box.append(button(entry.card?'Counter → graveyard':'Counter ability',()=>dispatch({type:'counter'})));}target.append(box);
 });
}
function render(){
 $('finish-library-search').hidden=!networkSession||!g.players[seat].librarySearch;
 $('automatic').checked=automaticFor(g,seat);$('automatic').disabled=false;
 $('automatic').setAttribute('aria-label',g.players[seat].name+' auto untap / draw');
 $('automatic').parentElement.title='Automatically untap and draw during '+g.players[seat].name+' turns only.';
 cardMotion?.capture();
 launchUI?.refresh();
 let result=$('game-result');if(!result){result=el('section',undefined,'game-result');result.id='game-result';result.setAttribute('role','status');document.body.append(result);}result.hidden=!g.result;if(g.result){result.replaceChildren(el('strong',g.result.draw?'Game drawn':g.result.winners.map(i=>g.players[i].name).join(' and ')+' wins'),el('span',g.result.source),networkSession&&!networkSession.host?el('span','The host can reset this game.'):button('Reset game',()=>$('reset-game').click()));}
 // Synchronize the controlled hand before building cards and overlays. Visual
 // presentations refresh after those elements exist so their anchors are current.
 syncHandSeat();
 manaUI?.beginRender();
 saveLocal();$('turnnumber').textContent=String(g.turn).padStart(2,'0');$('turn').textContent='TURN '+g.turn+' / '+g.players[g.active].name;const planned=g.turnPlan?.steps[g.turnPlan.index];$('step').textContent=STEPS[g.step]+(planned?.extra?' · Extra':'');$('step').title=planned?.extra?'Additional '+planned.kind+' phase · '+planned.source:STEPS[g.step];
 $('steps').replaceChildren(...STEPS.map((s,i)=>{const b=button(STEP_LABELS[i],()=>dispatch({type:'step',step:i}),'step'+(i===g.step?' current':''));b.title=s;b.setAttribute('aria-label',s);if(i===g.step)b.setAttribute('aria-current','step');return b;}));
 $('players').replaceChildren(...g.players.map((p,i)=>{const b=button('0'+(i+1),()=>selectSeat(i),'seat-selector'+(i===seat?' selected':''));b.style.setProperty('--seat-color',COLORS[i]);b.title='Control '+p.name;b.setAttribute('aria-label','Control '+p.name);b.setAttribute('aria-pressed',String(seat===i));return b;}));
 $('undo').disabled=networkSession?networkSession.connection!=='connected':!history.length;for(const id of ['reset','practice','quickpractice','load','player-count'])if($(id))$(id).disabled=!!networkSession;if($('reset-game'))$('reset-game').disabled=!!networkSession&&!networkSession.host;if($('starting-hands'))$('starting-hands').disabled=!!networkSession&&!networkSession.host;renderTable();renderHandDock();manaUI?.render();combatUI?.render();renderSelection();renderInspector();renderStack();boardPicker?.refresh();castPresentation?.refresh();turnPresentation?.refresh();$('log').replaceChildren(...(g.log.length?g.log.map((text,index)=>{const row=el('div',text);row.title=index===0?'Most recent action':'';return row;}):[el('p','Your table actions will appear here.')]));setPanel(panel);if($('pile-dialog').open)renderPile();cardPreview?.refresh(true);cardMotion?.refresh();refreshHover();maybePromptEntry();manaUI?.maybeResolveEffect();openingHandUI?.refresh();
}
// ---- Deck/pile dialogs and player statistics ----
function openImport(owner=seat){
 if(networkSession)owner=seat;
 $('import-seat').replaceChildren(...g.players.map((p,i)=>{const option=el('option','Seat '+(i+1)+' / '+p.name);option.value=i;return option;}));$('import-seat').value=owner;$('import-seat').disabled=!!networkSession;$('player-name').value=g.players[owner].name;$('import-dialog').showModal();
}
function openPile(owner,zone){
 if(networkSession&&zone==='library'){
  if(owner!==seat){setStatus('You can search only your own library.');return;}
  if(g.pendingEffect?.kind==='oracle-choice'){manaUI.maybeResolveEffect();setStatus('Use the pending effect choices to search.');return;}
  if(!g.players[owner].librarySearch){dispatch({type:'librarySearch',open:true},{after:()=>showPile(owner,zone)});return;}
 }
 showPile(owner,zone);
}
function showPile(owner,zone){if(!networkSession)seat=owner;pileView={owner,zone};$('pile-search').value='';render();renderPile();if(!$('pile-dialog').open)$('pile-dialog').showModal();if(zone==='library')$('pile-search').focus();}
function finishLibrarySearch(shuffle=true){dispatch({type:'librarySearch',open:false,shuffle},{after:()=>{$('pile-dialog').close();pileView=null;}});}
const finishSearch=button('Finish search & shuffle',()=>finishLibrarySearch());finishSearch.id='finish-library-search';finishSearch.hidden=true;$('automatic').closest('.turn-actions').prepend(finishSearch);

function renderPile(){
 if(!pileView)return;const {owner,zone}=pileView,player=g.players[owner];$('pile-owner').textContent='SEAT 0'+(owner+1)+' / '+player.name;$('pile-title').textContent=LABELS[zone]+' · '+player.zones[zone].length+' cards';$('pile-caption').textContent=zone==='library'?'Top to bottom, left to right. Hold Left Alt over a card to inspect it, or drag it directly onto the table.':'Hold Left Alt to inspect or drag a card back onto the table.';
 const cards=player.zones[zone],query=zone==='library'?$('pile-search').value.trim().toLocaleLowerCase():'';
 const entries=cards.map((card,index)=>({card,index})).filter(({card})=>!query||[card.name,...(card.card_faces||[]).map(face=>face.name)].some(name=>name?.toLocaleLowerCase().includes(query)));
 $('pile-search-controls').hidden=zone!=='library';$('pile-search-clear').hidden=!$('pile-search').value;
 $('pile-search-status').textContent=query?entries.length+' of '+cards.length+' cards':cards.length+' cards';
 $('pile-cards').replaceChildren(...entries.map(({card,index})=>{const wrapper=el('div');wrapper.append(cardButton(card),el('div',zone==='library'?(index===0?'TOP / 1':String(index+1)):String(index+1),'pile-index'));return wrapper;}));
 if(networkSession&&zone==='library'&&player.librarySearch){
  const actions=el('div',undefined,'pile-search-row');
  actions.append(button('Finish search & shuffle',()=>finishLibrarySearch()),button('Finish without shuffling',()=>finishLibrarySearch(false)));
  $('pile-cards').append(actions);
 }
 if(!entries.length)$('pile-cards').append(el('p',cards.length?'No cards match your search.':'This pile is empty.','pile-empty-message'));refreshHover();
}
$('pile-search').oninput=renderPile;
$('pile-search-clear').onclick=()=>{$('pile-search').value='';renderPile();$('pile-search').focus();};
let statsSeat=0;
function openStats(owner){
 if(networkSession&&owner!==seat){setStatus('Each player edits their own totals.');return;}
 statsSeat=owner;const p=g.players[owner];$('stats-title').textContent=p.name;$('seat-name').value=p.name;$('life-total').value=p.life;$('poison-total').value=p.poison;$('command-casts').value=p.casts;
 const commanders=commandersFor(g,owner);$('command-casts').value=commanders[0]?.commandCasts??p.casts;
 $('command-casts').previousElementSibling.textContent=commanders.length>1?commanders[0].name+' casts':'Command casts';
 $('partner-casts').replaceChildren(...commanders.slice(1).map(card=>{const group=el('div'),label=el('label',card.name+' casts'),input=el('input');input.id='casts-'+card.instance;label.htmlFor=input.id;input.type='number';input.min=0;input.step=1;input.required=true;input.dataset.commander=card.instance;input.value=card.commandCasts??0;group.append(label,input);return group;}));
 $('damage-inputs').replaceChildren(...g.players.map((source,i)=>{const group=el('div'),label=el('label','Seat '+(i+1));label.htmlFor='damage-'+i;label.title=source.name;const input=el('input');input.type='number';input.min=0;input.required=true;input.id='damage-'+i;input.value=p.damage[i];group.append(label,input);return group;}));$('stats-dialog').showModal();
}
// ---- Toolbar actions and confirmed table changes ----
function confirmAction(title,text,action){$('confirm-title').textContent=title;$('confirm-text').textContent=text;$('confirm-action').onclick=()=>{$('confirm-dialog').close();action();};$('confirm-dialog').showModal();}
function undo(){if(g.opening?.status==='choosing'||!networkSession&&history.length&&JSON.parse(history.at(-1)).opening?.status==='choosing'){setStatus('Opening-hand decisions cannot be undone.');return;}if(networkSession){dispatch({type:'undo'});return;}if(!history.length)return;rememberArt();const previousTurn=g.turn+':'+g.active;g=JSON.parse(history.pop());const handedOff=previousTurn!==g.turn+':'+g.active;if(handedOff)seat=g.active;restoreArt();sessionEpoch++;selected=null;render();if(handedOff)camera?.focusSeat(seat);setStatus('Last table action undone.');}
$('advance').onclick=()=>dispatch({type:'advance'});
$('endturn').onclick=()=>dispatch({type:'endTurn'});
$('draw').onclick=()=>dispatch({type:'draw'});$('untap').onclick=()=>dispatch({type:'untap'});
$('shuffle').onclick=()=>dispatch({type:'shuffle'});
$('mulligan').onclick=()=>dispatch({type:'redraw'});
$('undo').onclick=undo;$('openimport').onclick=()=>openImport();$('import-seat').onchange=()=>{$('player-name').value=g.players[Number($('import-seat').value)].name;};
$('token').onclick=()=>{
 const select=$('token-template');select.replaceChildren(new Option('Custom token',''));
 for(const [index,token] of (g.players[seat].tokenCatalog||[]).entries())select.add(new Option(token.name+(token.power!==undefined?' '+token.power+'/'+token.toughness:'')+' '+(token.colors||[]).join(''),String(index)));
 select.value=select.options.length>1?'0':'';select.onchange();$('token-dialog').showModal();
};
$('token-template').onchange=()=>{const custom=$('token-template').value==='';for(const id of ['token-name','token-text','token-power'])$(id).disabled=!custom;};
$('help').onclick=()=>$('help-dialog').showModal();
$('quickstats').onclick=()=>openStats(seat);
$('quickpractice').onclick=()=>$('practice').click();
$('refreshart').onclick=()=>hydrateArt({retry:true});
$('dock-player').onchange=()=>selectSeat(Number($('dock-player').value));
$('dock-draw').onclick=()=>dispatch({type:'draw'});
$('dock-left').onclick=()=>dock.scroll(-1);$('dock-right').onclick=()=>dock.scroll(1);
$('dock-smaller').onclick=()=>dock.changeSize(-8);$('dock-larger').onclick=()=>dock.changeSize(8);
$('reset').onclick=()=>confirmAction('Start a fresh table?','This clears the current table. You can undo this action or export your session first.',()=>mutate(()=>{g=newGame(g.players.length);sessionEpoch++;seat=0;selected=null;},'Fresh table ready.'));
const resetGameButton=button('Reset game',()=>confirmAction('Reset this game and keep the decks?','Return all nontoken cards to their owners’ decks and commanders to their command zones, shuffle, and draw seven. Reset life to the format starting total, poison, damage, mana, counters, turn, and stack. Keep the imported decks, artwork, and player names. When every seat has a deck, return to starting-hand verification with Ready and Mulligan.',()=>dispatch({type:'reset',opening:decksReadyForOpening(g)},{message:'Game reset; decks kept.'})));resetGameButton.id='reset-game';$('reset').before(resetGameButton);
const startingHandsButton=button('Starting hands',()=>confirmAction('Deal starting hands and verify readiness?','Start a clean game using the current decks and selected mulligan rules. Shuffle and deal seven to each seat, then show Ready / Mulligan. Everyone must confirm before play begins.',()=>dispatch({type:'reset',opening:true},{message:'Review starting hands before playing.'})));startingHandsButton.id='starting-hands';resetGameButton.after(startingHandsButton);
const playerCountSelect=el('select');playerCountSelect.id='player-count';playerCountSelect.setAttribute('aria-label','Number of players');for(const count of [2,3,4]){const option=el('option',count+' players');option.value=count;playerCountSelect.append(option);}const playerCountLabel=el('label',undefined,'player-count-control');playerCountLabel.append(playerCountSelect);$('players').after(playerCountLabel);playerCountSelect.onchange=()=>{const count=Number(playerCountSelect.value);playerCountSelect.value=g.players.length;if(count===g.players.length)return;confirmAction('Start a '+count+'-player game?','Start a clean game with '+count+' active seats. Keep imported decks and names; unused seats’ decks are saved and restored if you add those seats again. This can be undone.',()=>mutate(()=>{g=changePlayerCount(g,count);sessionEpoch++;seat=0;selected=null;},count+'-player game ready.'));};
$('practice').onclick=()=>{const action=()=>mutate(()=>{g=practiceGame(g.players.length);sessionEpoch++;seat=0;selected=null;},'Offline practice table loaded. Import real decks for artwork and card text.');if(allCards().length)confirmAction('Load the practice table?','Replace the current table with illustrative decks for the active seats. You can undo this action.',action);else action();};
$('togglepanel').onclick=()=>{const hidden=$('workspace').classList.toggle('panel-hidden');$('togglepanel').setAttribute('aria-expanded',String(!hidden));$('togglepanel').textContent=hidden?'Stack / Log ◁':'Stack / Log ▷';};
$('togglepanel').ondragenter=()=>{if(draggedId){showPanel();setPanel('stack');}};
for(const name of ['stack','log'])$('tab-'+name).onclick=()=>setPanel(name);
$('tab-stack').ondragenter=()=>{if(draggedId)setPanel('stack');};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
$('loadlabel').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('load').click();}};
$('stats-form').onsubmit=e=>{e.preventDefault();const life=Number($('life-total').value),poison=Number($('poison-total').value),casts=Number($('command-casts').value),extra=[...$('partner-casts').querySelectorAll('input')],damage=g.players.map((_,i)=>Number($('damage-'+i).value));if(![life,poison,...damage].every(Number.isFinite)||![casts,...extra.map(input=>Number(input.value))].every(n=>Number.isSafeInteger(n)&&n>=0))return;dispatch({type:'playerStats',owner:statsSeat,name:$('seat-name').value.trim(),life,poison,damage,totalCasts:casts,casts:Object.fromEntries([...commandersFor(g,statsSeat).map((c,i)=>[c.instance,i?Number(extra.find(input=>input.dataset.commander===c.instance)?.value??c.commandCasts??0):casts])])});$('stats-dialog').close();};
$('token-form').onsubmit=e=>{e.preventDefault();const name=$('token-name').value.trim(),count=Number($('token-count').value);if($('token-template').value!==''){dispatch({type:'token',templateIndex:Number($('token-template').value),count});$('token-dialog').close();return;}if(!name||!Number.isInteger(count)||count<1||count>50)return;const parts=($('token-power').value.trim()||name.match(/^[+-]?\d+\/[+-]?\d+/)?.[0]||'').split('/');dispatch({type:'token',name,count,text:$('token-text').value,power:parts[0]?.trim()||'0',toughness:parts[1]?.trim()||'0'});$('token-dialog').close();};
document.addEventListener('keydown',e=>{
 if(e.altKey||e.target.closest('input,textarea,select')||document.querySelector('dialog[open]'))return;
 refreshHover();
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
 else if(e.ctrlKey||e.metaKey)return;
 else if(selected&&e.key.toLowerCase()==='t'){e.preventDefault();toggleTapped(selected,{manual:e.shiftKey});}
 else if(selected&&e.key.toLowerCase()==='f'){e.preventDefault();toggleFaceDown(selected);}
 else if(e.key==='Escape'){clearHover();}
});
// ---- Imports, session files and local artwork hydration ----
// Fetch each distinct name once, then create a separate instance for every
// physical copy. Shared metadata must never make duplicate cards share identity.
async function lookupNames(names){
 const unique=[...new Map(names.map(name=>[name.trim().toLowerCase(),name.trim()])).values()],records=new Map();
 for(let i=0;i<unique.length;i+=250){const loaded=await window.cards.lookupBatch(unique.slice(i,i+250));for(const [name,card] of Object.entries(loaded))records.set(name.trim().toLowerCase(),card);}
 return Object.fromEntries(names.map(name=>[name,records.get(name.trim().toLowerCase())]));
}
$('import-form').onsubmit=async e=>{
 e.preventDefault();if(importing)return;const target=Number($('import-seat').value),commanders=[$('commander').value.trim(),$('partner').value.trim()].filter(Boolean),playerName=$('player-name').value.trim();let list;
 try{list=parseDeck($('deck').value);}catch(error){$('import-status').textContent=error.message;return;}
 if(!list.length){$('import-status').textContent='Paste a deck list first.';return;}
 if(list.reduce((n,row)=>n+row.count,0)>500){$('import-status').textContent='Please keep each imported deck to 500 cards or fewer.';return;}
 if(!window.cards){$('import-status').textContent='Launch through Electron to download card data. The practice table works offline.';return;}
 const epoch=sessionEpoch;importing=true;$('import').disabled=true;$('refreshart').disabled=true;$('import').textContent='Loading cards…';
 try{
  const names=[...new Set([...list.map(c=>c.name),...commanders])];$('import-status').textContent='Loading '+names.length+' card names and caching artwork. First imports can take a few minutes.';
  const records=await lookupNames(names);$('import-status').textContent='Finding tokens and caching their artwork...';const reserve=window.cards.lookupTokens?await window.cards.lookupTokens(names):{tokens:[],warnings:[]};if(epoch!==sessionEpoch)throw Error('The table changed during import. Cached cards are ready; import again into this table.');
  const instance=(c,isCommander=false)=>({...c,instance:crypto.randomUUID(),tapped:false,counters:{},face:0,commander:isCommander,ownerSeat:target});
  const library=[],command=commanders.map((name,commandSlot)=>{if(!records[name])throw Error('Missing card: '+name);return {...instance(records[name],true),commandSlot,commandCasts:0};});
  if(command.length===2&&command[0].id===command[1].id)throw Error('Choose two different command-zone cards.');
  const remaining=new Set(command.map(card=>card.id));
  for(const row of list){const card=records[row.name];if(!card)throw Error('Missing card: '+row.name);let count=row.count;if(remaining.delete(card.id))count--;for(let i=0;i<count;i++)library.push(instance(card));}
  const count=library.length+command.length;if(count>500)throw Error('Please keep each imported deck, including commanders, to 500 cards or fewer.');
  const missingImages=[...new Map([...library,...command].map(card=>[card.id,card])).values()].filter(card=>!hasArtwork(card)||card.artworkError);
  const resultMessage=(reserve.warnings.length?reserve.warnings.join(' ')+' ':'')+'Loaded '+reserve.tokens.length+' token templates. Imported '+count+' cards for '+(playerName||g.players[target].name)+(missingImages.length?'. Images missing for '+missingImages.length+' card names; click Images to retry.':' with card images.');
  dispatch({type:'import',owner:target,library,command,tokenCatalog:reserve.tokens,name:playerName},{message:resultMessage});
  $('import-dialog').close();$('import-status').textContent='Card data and artwork download from Scryfall and cache locally.';
 }catch(error){$('import-status').textContent=error.message;setStatus(error.message);}
 finally{importing=false;$('import').disabled=false;$('refreshart').disabled=artworkLoading;$('import').textContent='Import & shuffle →';}
};
$('save').onclick=()=>{const url=URL.createObjectURL(new Blob([serialize(g)],{type:'application/json'}));const link=el('a');link.href=url;link.download='commander-session.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Session exported, including card positions and counters.');};
$('load').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{if(file.size>30*1024*1024)throw Error('Session file exceeds 30 MB.');const value=validateSession(JSON.parse(await file.text()));mutate(()=>{g=value;sessionEpoch++;seat=0;selected=null;restoreArt();},'Session loaded. Restoring cached artwork…');await hydrateArt();}
 catch(error){setStatus(error.message);}finally{e.target.value='';}
};
async function hydrateArt({retry=false}={}){
 rememberArt();if(!window.cards||artworkLoading)return;const epoch=sessionEpoch,all=allCards(),missingCards=all.filter(c=>c.id&&(!hasArtwork(c)||c.artworkVersion!==2)),tokenIds=[...new Set(missingCards.filter(c=>c.token||c.tokenTemplate).map(c=>c.id))],names=[...new Set(missingCards.filter(c=>!c.token&&!c.tokenTemplate).map(c=>c.name))];
 if(!names.length&&!tokenIds.length){if(retry)setStatus(all.some(c=>c.id)?'All imported cards already have images.':'Import a deck to download its card images.');return;}
 artworkLoading=true;$('refreshart').disabled=true;setStatus('Downloading missing card images…');
 try{const records=await lookupNames(names),byId={};for(let i=0;i<tokenIds.length;i+=250)Object.assign(byId,await window.cards.lookupIds(tokenIds.slice(i,i+250)));if(epoch!==sessionEpoch)return;for(const card of all){const record=(card.token||card.tokenTemplate)?byId[card.id]:records[card.name];if(record){card.localImages=record.localImages;card.artworkVersion=record.artworkVersion;if(record.artworkError)card.artworkError=record.artworkError;else delete card.artworkError;cacheArtwork(card);}}restoreArt();render();const missing=[...new Set(all.filter(c=>c.id&&(!hasArtwork(c)||c.artworkVersion!==2)).map(c=>c.name))];setStatus(missing.length?'High-resolution images unavailable for '+missing.join(', ')+'. Click Images to retry.':'High-resolution card images ready.');}
 catch(error){setStatus('Card images could not download: '+error.message+'. Click Images to retry.');}
 finally{artworkLoading=false;$('refreshart').disabled=importing;}
}
dock=createHandDock({root:$('hand-dock'),track:$('dock-scroll'),items:$('dock-items'),caption:$('dock-caption'),onScroll:({canLeft,canRight})=>{$('dock-left').disabled=!canLeft;$('dock-right').disabled=!canRight;}});
cardPreview=createCardPreview({roots:[document.body],getCard:inspectionCard,renderCard:cardButton,renderDetails:renderInspector});
boardPicker=createBoardInteraction({getGame:()=>g,getSeat:()=>seat,renderCard:card=>cardButton(card,{interactive:false}),el,button,setStatus});
manaUI=createManaUI({getGame:()=>g,getSeat:()=>seat,selectSeat,toggleTapped,findCard,dispatch,setStatus,el,button,boardPicker,useLoyaltyAbility,renderCard:(card,options)=>cardButton(card,{...options,interactive:false})});
combatUI=createCombatUI({openLibrary:owner=>openPile(owner,'library'),getGame:()=>g,getSeat:()=>seat,selectSeat,dispatch,setStatus,el,button,boardPicker,renderCard:card=>cardButton(card,{interactive:false}),showStack:()=>{showPanel();setPanel('stack');}});
turnPresentation=createTurnPresentation({getGame:()=>g,getSeat:()=>seat,getEpoch:()=>sessionEpoch});
cardMotion=createCardMotion({getSeat:()=>seat,getEpoch:()=>sessionEpoch});
castPresentation=createCastPresentation({getGame:()=>g,renderCard:(card,options)=>cardButton(card,{...options,interactive:false}),resolveArt:card=>({...card,localImages:findCard(g,card.instance)?.card.localImages||artCache.get(card.id||card.name)?.localImages}),priorityControls:()=>manaUI.priorityControls({id:'play-priority-controls',responses:true}),el,button});

document.addEventListener('pointermove',trackHover);document.addEventListener('pointerover',trackHover);document.addEventListener('pointerout',scheduleHover);
document.documentElement.addEventListener('pointerleave',clearHover);window.addEventListener('blur',clearHover);
document.addEventListener('dragstart',clearHover,true);document.addEventListener('dragend',trackHover);document.addEventListener('drop',trackHover,true);
document.addEventListener('wheel',event=>{hoverPoint={x:event.clientX,y:event.clientY};scheduleHover();},{capture:true,passive:true});
document.addEventListener('transitionend',event=>{if(event.target.closest('.dock-slot'))scheduleHover();});
document.addEventListener('toggle',event=>{if(event.target.matches('dialog')||event.target===$('card-zoom-preview'))scheduleHover();},true);
new MutationObserver(scheduleHover).observe($('zones'),{attributes:true,attributeFilter:['style']});
document.addEventListener('dragend',clearHandDragImage);document.addEventListener('drop',clearHandDragImage);window.addEventListener('blur',clearHandDragImage);
render();
camera=createTableCamera({viewport:$('table-viewport'),world:$('zones'),map:$('table-map'),marker:$('map-view'),zoomLabel:$('zoom-level'),onSeat:selectSeat,handDock:$('hand-dock'),getPlayerCount:()=>g.players.length});
// ---- Authoritative network snapshots and offline-table restoration ----
// A join preserves the local table separately. Reconnect replaces the projected
// snapshot and restores local artwork; it does not reconstruct hidden cards.
function networkStatus(info){
 if(info.connection==='offline'){if(networkSession&&g.networkSeat===undefined)leaveNetwork();return;}
 if(!networkSession){rememberArt();offlineBackup=serialize(g);sessionEpoch++;}
 networkSession={...networkSession,...info};saveLocal();launchUI?.refresh();if(info.message)setStatus(info.message);
}
function networkState(packet){
 const first=!networkSession||networkSession.seat===undefined;if(!networkSession){rememberArt();offlineBackup=serialize(g);sessionEpoch++;}
 if(g.networkEpoch!==undefined&&g.networkEpoch!==packet.game.networkEpoch){sessionEpoch++;for(const dialog of document.querySelectorAll('dialog[open]'))if(!['network-dialog','launch-screen'].includes(dialog.id))dialog.close();}
 networkSession={...networkSession,...packet,connection:'connected'};rememberArt();g=packet.game;seat=packet.seat;selected=null;restoreArt();render();if(first)camera?.focusSeat(seat);hydrateArt();
}
function leaveNetwork(){networkSession=null;sessionEpoch++;g=offlineBackup?JSON.parse(offlineBackup):newGame();offlineBackup=null;seat=handSeat=0;selected=null;$('automatic').disabled=false;restoreArt();render();camera?.focusSeat(seat);setStatus('Left the shared table. Your previous local table is restored.');}
createNetworkUI({getGame:()=>g,serialize,getAutomatic:()=>false,onState:networkState,onStatus:networkStatus,onLeave:leaveNetwork,setStatus});
$('automatic').onchange=()=>dispatch({type:'automatic',enabled:$('automatic').checked});
new ResizeObserver(()=>$('sidebar').style.top=$('table-viewport').offsetTop+'px').observe($('table-viewport'));
$('focus-seat').onclick=()=>camera.focusSeat(seat);$('fit-table').onclick=()=>camera.fit();
$('fit-seat').onclick=()=>camera.fitSeat(seat);
$('zoom-in').onclick=()=>camera.zoomIn();$('zoom-out').onclick=()=>camera.zoomOut();$('zoom-level').onclick=()=>camera.resetZoom();
createControllerUI({setStatus,onPan:(x,y)=>camera.panBy(x,y),
 onAction(action,event){
  if(action==='inspect'){cardPreview.setControllerInspect(event.phase!=='release',event.point);return;}
  const controls={draw:'draw',nextStep:'advance',endTurn:'endturn',undo:'undo',toggleStack:'togglepanel',zoomIn:'zoom-in',zoomOut:'zoom-out',fitSeat:'fit-seat',fitTable:'fit-table'};
  if(controls[action]){$(controls[action]).click();return;}
  if(action==='pass'){const pass=document.querySelector('#play-priority-controls [data-priority-pass],#play-priority-controls [id$=trigger-order-confirm]')||document.querySelector('#priority-controls button');if(pass)pass.click();else setStatus('No priority action is available for this seat.');return;}
  if(action==='previousSeat'||action==='nextSeat'){selectSeat((camera.focusedSeat+(action==='nextSeat'?1:g.players.length-1))%g.players.length);return;}
  const node=event.point&&document.elementFromPoint(event.point.x,event.point.y)?.closest('.card[data-card]'),id=node?.dataset.card;
  if(!id)return;
  if(action==='tap'||action==='manualTap')toggleTapped(id,{manual:action==='manualTap'});
  else if(action==='flip')toggleFaceDown(id);
  else if(action==='cardActions')node.querySelector('.card-actions-toggle')?.click();
 },
 onDrop(id,target,point){
  // Reuse the mouse drop path, including casting costs, zone checks and packets.
  dragOffset={x:.5,y:.5};const data=new DataTransfer();data.setData('application/x-commander-card',id);
  target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data,clientX:point.x,clientY:point.y}));
 }
});
window.cards?.onProgress?.(progress=>{if(!importing&&!artworkLoading)return;const message=progress.stage==='images'?'Card images '+progress.completed+' / '+progress.total+(progress.name?' · '+progress.name:''):'Loading card data · '+progress.total+' names';if(importing)$('import-status').textContent=message;setStatus(message);});
hydrateArt();

launchUI=createLaunchUI({getGame:()=>g,getNetwork:()=>networkSession,dispatch,onLocal:game=>mutate(()=>{g=game;sessionEpoch++;seat=handSeat=0;selected=null;},'Local lobby ready.',{autoPass:false}),onState:networkState,onLeave:leaveNetwork,openImport,selectSeat,setStatus});

openingHandUI=createOpeningHandUI({getGame:()=>g,getNetwork:()=>networkSession,getSeat:()=>seat,selectSeat,dispatch,renderCard:cardButton});
