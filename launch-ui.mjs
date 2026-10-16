import {el as make,loadStyles} from './ui-dom.mjs';
import {MULLIGAN_MODES} from './opening-hand.mjs';
import {FORMATS,lobbyGame} from './lobby.mjs';
import {PREMADE_DECKS} from './premade-decks.mjs';

const BACKGROUNDS=[{file:'emerald-sanctuary.png',name:'Emerald Sanctuary'},{file:'moonlit-archipelago.png',name:'Moonlit Archipelago'}];
export function createLaunchUI({getGame,getNetwork,dispatch,onLocal,onState,onLeave,openImport,selectSeat,setStatus}){
 const bridge=window.tableNetwork,q=id=>document.getElementById(id);
 loadStyles('./launch.css',import.meta.url);
 const screen=make('dialog');screen.id='launch-screen';screen.setAttribute('aria-label','Commander Lab launch screen');
 screen.innerHTML=`<div class="launch-landscape" aria-hidden="true"></div><div class="launch-shade"></div><div class="launch-layout"><nav class="launch-nav"><span class="eyebrow">YOUR NEXT GREAT GAME</span><h1>Commander<span>Lab</span></h1><p>A place to play things out.</p><button id="launch-local">Local</button><button id="launch-multiplayer">Multiplayer</button><button id="launch-settings">Settings</button><button id="launch-exit">Exit game</button><button id="launch-resume" class="launch-resume">Return to table</button><span id="landscape-title" class="landscape-title"></span></nav><section class="launch-panel"><div id="launch-content"></div><p id="launch-error" role="alert"></p></section></div>`;
 document.body.append(screen);let page='home',rooms=[],busy=false,background=Math.floor(Math.random()*BACKGROUNDS.length),lastLobby='',wasWaiting=false;
 let motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;try{const saved=localStorage.getItem('commanderLabBackgroundMotion');if(saved!==null)motion=saved==='true';}catch{}
 const landscape=screen.querySelector('.launch-landscape'),secondLandscape=make('div');secondLandscape.className='launch-landscape';secondLandscape.setAttribute('aria-hidden','true');landscape.after(secondLandscape);const layers=[landscape,secondLandscape];let activeLayer=1;
 function changeBackground(){const b=BACKGROUNDS[background];activeLayer=1-activeLayer;layers[activeLayer].style.backgroundImage=`url("${new URL('./assets/backgrounds/'+b.file,import.meta.url).href}")`;layers.forEach((n,i)=>{n.classList.toggle('active',i===activeLayer);n.classList.toggle('paused',!motion);});q('landscape-title').textContent=b.name;}
 changeBackground();for(const b of BACKGROUNDS){const img=new Image();img.src=new URL('./assets/backgrounds/'+b.file,import.meta.url).href;}
 const cycle=setInterval(()=>{if(screen.open&&motion){background=(background+1)%BACKGROUNDS.length;changeBackground();}},120000);window.addEventListener('unload',()=>clearInterval(cycle),{once:true});
 const motionLabel=make('label');motionLabel.className='launch-motion';const motionInput=make('input');motionInput.type='checkbox';motionInput.checked=motion;motionInput.id='background-motion';motionLabel.append(motionInput,' Animate menu backgrounds');q('settings-dialog')?.append(motionLabel);
 motionInput.onchange=()=>{motion=motionInput.checked;layers.forEach(n=>n.classList.toggle('paused',!motion));try{localStorage.setItem('commanderLabBackgroundMotion',String(motion));}catch{}};
 const content=q('launch-content'),error=e=>{q('launch-error').textContent=e.message||String(e);setStatus(e.message||String(e));};
 function button(text,fn,id){const n=make('button',text);n.type='button';if(id)n.id=id;n.onclick=()=>run(fn);return n;}
 function heading(title,caption){content.replaceChildren(make('h2',title));if(caption)content.append(make('p',caption));}
 function field(label,id,value='',type='text'){const wrap=make('label',label),input=make('input');input.id=id;input.type=type;input.value=value;wrap.append(input);content.append(wrap);return input;}
 function select(label,id,options,value){const wrap=make('label',label),s=make('select');s.id=id;for(const [v,t] of options){const o=make('option',t);o.value=v;s.append(o);}s.value=value;wrap.append(s);content.append(wrap);return s;}
 function row(...nodes){const n=make('div');n.className='launch-actions';n.append(...nodes);content.append(n);return n;}
 async function command(action){const ok=await dispatch(action);if(ok===false)throw Error(document.getElementById('status').textContent||'This action could not be accepted.');return ok;}
 async function run(fn){if(busy)return;busy=true;q('launch-error').textContent='';screen.setAttribute('aria-busy','true');try{await fn();}catch(e){error(e);}finally{busy=false;screen.removeAttribute('aria-busy');}}
 function show(next='home'){page=next;q('launch-error').textContent='';renderPage();if(!screen.open)screen.showModal();}
 function table(){if(getGame().lobby?.status==='waiting'){show('lobby');return;}screen.close();location.hash='table';}
 function options(){const g=getGame(),l=g.lobby;field('Room name','lobby-name',l?.name||'Commander Lab table');select('Players','lobby-count',[[2,'2 players'],[3,'3 players'],[4,'4 players']],g.players.length);const format=select('Game rules','lobby-format',Object.entries(FORMATS).map(([k,v])=>[k,v.name]),l?.format||'commander');const note=make('p','Two-Headed Giant is a manual team preset. Shared life, simultaneous team turns and team combat are not automated.');note.className='panel-caption';note.hidden=format.value!=='twoheaded';format.onchange=()=>note.hidden=format.value!=='twoheaded';content.append(note);mulliganOptions(l);}
 function mulliganOptions(l){
  const mode=select('Mulligan rules','lobby-mulligan',Object.entries(MULLIGAN_MODES),l?.mulligan?.mode||'regular');
  const extra=field('Additional free mulligans','lobby-mulligan-extra',l?.mulligan?.extraFree??1,'number');extra.min=0;extra.max=20;
  const info=make('p','Regular: draw seven, then bottom one card for each paid mulligan. Games with 3+ players and Brawl get one free. Extra adds free mulligans; Gentlemen\'s permits unlimited free redraws. Everyone must keep a hand and confirm ready.');info.className='panel-caption';content.append(info);
  const update=()=>extra.parentElement.hidden=mode.value!=='extra';mode.onchange=update;update();
 }
 function readOptions(){return {name:q('lobby-name').value,count:Number(q('lobby-count').value),format:q('lobby-format').value,mulligan:{mode:q('lobby-mulligan').value,extraFree:Number(q('lobby-mulligan-extra').value)}};}
 async function leave(){if(getNetwork()){await bridge.leave();onLeave();}show('home');}
 async function join(url,code){if(!bridge)throw Error('Launch the desktop app to join a room.');onState(await bridge.join({url,code}));show('lobby');}
 async function browse(){if(!bridge)throw Error('Launch the desktop app to discover rooms.');const status=q('room-search-status');if(status)status.textContent='Searching your local network…';rooms=await bridge.discover();if(page==='multiplayer')renderPage();}
 function renderPage(){
  if(page==='home'){heading('Gather around the table.','Play every seat locally, or invite friends on your network.');content.append(make('p','Import your own deck or choose from the 39 supplied Commander test decks.'));return;}
  if(page==='local'){heading('Local play','Control all hands on this computer.');options();row(button('Create local lobby',()=>{onLocal(lobbyGame(readOptions()));show('lobby');},'local-create'),button('Resume saved table',table));return;}
  if(page==='multiplayer'){
   heading('Find your table','Open lobbies on the same local network.');row(button('Host a room',()=>show('host'),'room-host'),button('Refresh rooms',browse,'rooms-refresh'),button('Reconnect',async()=>{onState(await bridge.reconnect());getGame().lobby?.status==='waiting'?show('lobby'):table();},'room-reconnect'));
   const status=make('p',rooms.length?rooms.length+' open room(s)':'No rooms found. Refresh, or paste an invite below.');status.id='room-search-status';content.append(status);const list=make('div');list.id='room-list';for(const room of rooms){const item=make('div');item.className='room-row';item.append(make('strong',room.name),make('span',(FORMATS[room.format]?.name||room.format)+' · '+room.occupied+'/'+room.capacity));const b=button('Join',()=>join(room.url,room.code));b.disabled=room.occupied>=room.capacity;item.append(b);list.append(item);}content.append(list);
   const code=field('Room code or full invite','room-code');code.placeholder='Paste the room code or ws://address:port#code';code.maxLength=512;
   const address=field('Host address (if discovery cannot find it)','room-address');address.placeholder='ws://192.168.1.10:32109';
   row(button('Join room',async()=>{let c=code.value.trim(),url=address.value.trim();if(/^wss?:\/\//i.test(c)){const invite=new URL(c);c=invite.hash.slice(1);invite.hash='';url=invite.href;}if(!url){rooms=await bridge.discover();url=rooms.find(r=>r.code===c)?.url;}if(!url)throw Error('Room not found on this network. Paste the host address as well as its code.');if(!/^[A-Za-z0-9_-]{16}$/.test(c))throw Error('Paste the complete room code.');await join(url,c);},'room-join'));return;
  }
  if(page==='host'){heading('Host a room','Keep this app open while friends play.');options();const port=field('Hosting port','lobby-port','32109','number');port.min=0;port.max=65535;row(button('Open lobby',async()=>{if(!bridge)throw Error('Launch the desktop app to host a room.');const game=lobbyGame(readOptions());onState(await bridge.host({game,port:Number(port.value),automatic:false}));show('lobby');},'lobby-host-open'),button('Back',()=>show('multiplayer')));return;}
  if(page==='lobby')renderLobby();
 }
 function renderLobby(){
  const g=getGame(),l=g.lobby,net=getNetwork(),host=!net||net.host;if(!l||l.status!=='waiting'){table();return;}
  heading(l.name,(net?'Network lobby':'Local hotseat lobby')+' · '+FORMATS[l.format].name);
  content.append(make('p','Mulligans: '+MULLIGAN_MODES[l.mulligan?.mode||'regular']+(l.mulligan?.mode==='extra'?' +'+l.mulligan.extraFree+' free':'')));
  if(net){const invite=field('Invite — copy and send to friends','lobby-invite',(net.addresses?.[0]||net.url||'')+'#'+net.code);invite.readOnly=true;if(net.discoveryWarning)content.append(make('p',net.discoveryWarning));}
  if(host){options();row(button('Apply host options',async()=>{const o=readOptions();await command({type:'lobbySettings',...o});},'lobby-apply'));}
  const players=make('div');players.id='lobby-players';
  for(const [i,p] of g.players.entries()){
   const card=make('article');card.className='lobby-player';card.dataset.lobbySeat=i;const report=l.decks[i],connected=!net||net.presence?.find(s=>s.seat===i)?.connected,own=!net||net.seat===i;card.append(make('h3',p.name+(own&&net?' · You':'')),make('p',(net?(connected?'Connected':'Waiting for player')+' · ':'')+(report?.count||0)+' cards · '+(l.ready[i]?'Ready':'Not ready')));
   if(report?.issues.length){const warnings=make('ul');for(const issue of report.issues)warnings.append(make('li',issue));if(own)for(const detail of report.identityNotes||[])warnings.append(make('li',detail));card.append(warnings);if(host&&report.count){const label=make('label'),check=make('input');check.type='checkbox';check.checked=!!l.acknowledged[i];check.dataset.deckAcknowledgment=i;check.onchange=()=>run(()=>command({type:'lobbyAcknowledge',seat:i,accepted:check.checked}));label.append(check,' I understand these deck warnings and allow this deck.');card.append(label);}}
   if(own){card.append(button('Choose / import deck',()=>{selectSeat(i);openImport(i);},'lobby-import-'+i),button(l.ready[i]?'Unready':'Ready',()=>command({type:'lobbyReady',owner:i,ready:!l.ready[i]}),'lobby-ready-'+i));if(report?.count)card.append(button('Recheck deck',()=>command({type:'lobbyRecheck',owner:i}),'lobby-recheck-'+i));}if(net&&host&&i>0&&net.presence?.find(s=>s.seat===i)?.reserved)card.append(button('Release seat',()=>command({type:'releaseSeat',seat:i}),'lobby-release-'+i));players.append(card);
  }content.append(players);
  if(host){const start=button('Start game',async()=>{await command({type:'lobbyStart'});if(getGame().lobby?.status==='playing')table();},'lobby-start');start.disabled=!l.ready.every(Boolean)||l.decks.some((d,i)=>!d?.count||d.issues.length&&!l.acknowledged[i])||!!net&&net.connection!=='connected';row(start);}
  else content.append(make('p','The host will start once everyone is ready.'));
  row(button(net?(host?'Stop hosting':'Leave room'):'Back to menu',()=>net?leave():show('home'),'lobby-leave'));
 }
 function refresh(){const g=getGame(),waiting=g.lobby?.status==='waiting';if(waiting){const key=JSON.stringify([g.lobby,g.players.map(p=>p.name),getNetwork()?.presence,getNetwork()?.connection]);if(!wasWaiting||key!==lastLobby){page='lobby';renderPage();lastLobby=key;}if(!screen.open)screen.showModal();}else if(wasWaiting)table();wasWaiting=waiting;}
 q('launch-local').onclick=()=>{if(getNetwork()){error(Error('Leave the shared room before starting local play.'));return;}getGame().lobby?.status==='waiting'?show('lobby'):show('local');};
 q('launch-multiplayer').onclick=()=>run(async()=>{if(getNetwork()){show('lobby');return;}show('multiplayer');await browse();});
 q('launch-settings').onclick=()=>q('settings').click();q('launch-exit').onclick=()=>run(async()=>{if(window.desktopApp)await window.desktopApp.exit();else throw Error('Exit is available in the desktop app.');});q('launch-resume').onclick=table;
 screen.addEventListener('cancel',e=>{e.preventDefault();if(getGame().lobby?.status!=='waiting')table();});
 const home=button('Menu',()=>show(getGame().lobby?.status==='waiting'?'lobby':'home'),'open-launch');document.querySelector('.header-actions').prepend(home);
 // Use the existing import pipeline so quantities, Oracle, art and IPC stay shared.
 const form=q('import-form'),label=make('label','Deck source'),source=make('select');source.id='deck-source';for(const [v,t] of [['paste','Paste deck list'],['file','Import text file'],['premade','Supplied Commander decks (39)']]){const o=make('option',t);o.value=v;source.append(o);}label.append(source);form.querySelector('.dialog-heading').after(label);
 const search=make('input');search.id='premade-search';search.type='search';search.placeholder='Search commander or deck theme';search.setAttribute('aria-label','Search supplied decks');search.hidden=true;const decks=make('select');decks.id='premade-deck';decks.hidden=true;decks.setAttribute('aria-label','Supplied Commander deck');const file=make('input');file.id='deck-file';file.type='file';file.accept='.txt,.dec,.dek';file.hidden=true;label.after(search,decks,file);
 function filterDecks(){const term=search.value.trim().toLowerCase();decks.replaceChildren(make('option','Choose a commander…'));decks.firstChild.value='';for(const d of PREMADE_DECKS.filter(d=>(d.name+' '+d.focus+' '+d.colors).toLowerCase().includes(term))){const o=make('option',d.name+' · '+d.colors);o.value=d.id;decks.append(o);}}filterDecks();search.oninput=filterDecks;
 source.onchange=()=>{search.hidden=decks.hidden=source.value!=='premade';file.hidden=source.value!=='file';};decks.onchange=()=>{const d=PREMADE_DECKS.find(d=>d.id===decks.value);if(!d)return;q('deck').value=d.list;q('commander').value=d.commanders[0]||'';q('partner').value=d.commanders[1]||'';q('import-status').textContent='Supplied test fixture; deck legality is checked in the lobby. Import downloads Oracle data and artwork.';};
 file.onchange=()=>run(async()=>{const f=file.files[0];if(!f)return;if(f.size>200000)throw Error('Deck file is too large.');q('deck').value=await f.text();q('import-status').textContent='Deck list loaded. Set its commander if needed, then import.';});
 if(location.hash!=='#table'||getGame().lobby?.status==='waiting')show(getGame().lobby?.status==='waiting'?'lobby':'home');refresh();
 return {refresh,show};
}
