// Draw counts contain no card identities. This also works with projected
// multiplayer state, without publishing hidden cards for visual effects.
export function presentationState(game){return {turn:game.turn+':'+game.active,drawTurn:game.drawHistory?.turn,draws:[...(game.drawHistory?.counts||game.players.map(()=>0))],playing:game.lobby?.status!=='waiting'&&game.opening?.status!=='choosing'};}
export function drawChanges(previous,next){
 if(!previous)return [];
 return next.draws.flatMap((count,owner)=>{const before=previous.drawTurn===next.drawTurn?previous.draws[owner]||0:0,amount=Math.max(0,count-before);return amount?[{owner,amount}]:[];});
}
export function createTurnPresentation({getGame,getSeat,getEpoch}){
 const banner=document.createElement('section');banner.id='turn-announcement';banner.className='turn-announcement';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.setAttribute('aria-atomic','true');
 const title=document.createElement('strong');banner.append(title);document.body.append(banner);
 const layer=document.createElement('div');layer.id='draw-animations';layer.setAttribute('aria-hidden','true');document.body.append(layer);
 const back=new URL('./assets/commander-lab-card-back.png',import.meta.url).href;
 let previous=null,epoch=null,timer=0,turnAnimation=null;const flights=new Set();
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function clear(){clearTimeout(timer);turnAnimation?.cancel();turnAnimation=null;banner.hidden=true;for(const flight of flights){flight.animation.cancel();flight.node.remove();}flights.clear();}
 function announce(name){
  clearTimeout(timer);turnAnimation?.cancel();title.textContent=name+"'s Turn";banner.hidden=false;
  turnAnimation=banner.animate(reduced()?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translate(-50%,-12px) scale(.97)'},{opacity:1,transform:'translate(-50%,0) scale(1)'}],{duration:reduced()?100:220,easing:'ease-out',fill:'both'});
  timer=setTimeout(()=>{turnAnimation?.cancel();const fade=turnAnimation=banner.animate([{opacity:1},{opacity:0}],{duration:180,fill:'both'});fade.finished.then(()=>{if(turnAnimation===fade)banner.hidden=true;}).catch(()=>{});},1600);
 }
 function rect(node){const r=node?.getBoundingClientRect();return r&&r.width>0&&r.height>0?r:null;}
 const visible=r=>r&&r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight;
 function fly(owner,amount){
  const mat=document.querySelector('.player-mat[data-seat="'+owner+'"]'),from=rect(mat?.querySelector('.pile.library'));
  const pinned=owner===getSeat(),to=pinned?rect(document.querySelector('#dock-items .dock-slot:last-child .card'))||rect(document.getElementById('dock-scroll')):rect(mat?.querySelector('.hand .cards'));
  if(!from||!to||!visible(from)&&!visible(to))return;
  const clamp=(n,size,max)=>Math.max(4,Math.min(max-size-4,n)),width=Math.max(36,Math.min(96,from.width)),height=width*1.4;
  const start={x:clamp(from.left+(from.width-width)/2,width,innerWidth),y:clamp(from.top+(from.height-height)/2,height,innerHeight)},end={x:clamp(to.left+(to.width-width)/2,width,innerWidth),y:clamp(to.top+(to.height-height)/2,height,innerHeight)},count=Math.min(12,amount);
  for(let i=0;i<count;i++){
   while(flights.size>=32){const oldest=flights.values().next().value;oldest.animation.cancel();oldest.node.remove();flights.delete(oldest);}
   const node=document.createElement('div');node.className='draw-flight';node.dataset.owner=owner;node.dataset.drawCount=amount;node.style.width=width+'px';node.style.height=height+'px';
   const image=document.createElement('img');image.src=back;image.alt='';node.append(image);if(i===count-1&&amount>count){const label=document.createElement('span');label.className='draw-batch-count';label.textContent='Draw '+amount;node.append(label);}layer.append(node);
   const transform=(point,rotation=0)=>`translate(${point.x}px,${point.y}px) rotate(${rotation}deg)`;
   const frames=reduced()?[{transform:transform(end),opacity:0},{transform:transform(end),opacity:.9},{transform:transform(end),opacity:0}]:[{transform:transform(start,-8),opacity:0},{transform:transform(start,-8),opacity:1,offset:.08},{transform:transform({x:(start.x+end.x)/2,y:Math.max(16,Math.min(start.y,end.y)-55)},4),opacity:1,offset:.52},{transform:transform(end),opacity:0}];
   const animation=node.animate(frames,{duration:reduced()?160:620,delay:reduced()?0:i*55,easing:'cubic-bezier(.22,.65,.3,1)',fill:'both'}),flight={node,animation};flights.add(flight);
   animation.finished.catch(()=>{}).finally(()=>{flights.delete(flight);node.remove();});
  }
 }
 function refresh(){
  const game=getGame(),next=presentationState(game),nextEpoch=getEpoch(),blocked=document.hidden||!!document.getElementById('launch-screen')?.open||!next.playing||!!game.result;
  if(epoch!==nextEpoch||blocked){clear();previous=next;epoch=nextEpoch;return;}
  const changed=previous&&previous.turn!==next.turn,started=previous&&!previous.playing&&next.playing,draws=drawChanges(previous,next);previous=next;
  if(changed||started)announce(game.players[game.active].name);
  // Measure after card layout and camera handoff finish. Queue every accepted
  // update so rapid draws are not lost to an unrelated repaint.
  if(draws.length){const acceptedEpoch=epoch;requestAnimationFrame(()=>{if(acceptedEpoch===getEpoch()&&!document.hidden&&!document.getElementById('launch-screen')?.open&&!getGame().result)for(const {owner,amount} of draws)fly(owner,amount);});}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 return {refresh,clear};
}
