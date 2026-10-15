// Animate rendered faces only. Hidden hands never supply artwork to this layer,
// and changing seats/sessions discards old faces before the next presentation.
export function createCardMotion({getSeat,getEpoch}){
 let previous=new Map(),scope='';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 // Capture the current angle before a redraw so reversing a tap mid-animation
 // starts where the card is now, rather than jumping to its previous endpoint.
 function capture(){for(const entry of previous.values())if(entry.motion&&entry.node.isConnected&&performance.now()-entry.motion.started<entry.motion.duration){const style=getComputedStyle(entry.node);entry.current={transform:style.transform,left:style.left,top:style.top};}}
 function clear(){for(const entry of previous.values())for(const animation of entry.node.getAnimations())if(animation.id.startsWith('card-motion'))animation.cancel();previous.clear();}
 function refresh(){
  const nextScope=getEpoch()+':'+getSeat();
  if(scope!==nextScope||document.hidden){clear();scope=nextScope;}
  const next=new Map(),now=performance.now();
  for(const node of document.querySelectorAll('.battlefield .card[data-card], .hand .card[data-card], #dock-items .card[data-card], .command-zone .card[data-card]')){
   const key=(node.closest('#dock-items')?'dock:':'table:')+node.dataset.card,old=previous.get(key);
   const state={face:node.dataset.displayFace,tapped:node.classList.contains('tapped'),zone:node.dataset.cardZone,identity:node.dataset.permanentId};
   const clone=node.cloneNode(true);clone.querySelectorAll('.card-flip-face').forEach(n=>n.remove());
   let motion=old?.motion;
   const sameObject=old&&old.state.zone===state.zone&&old.state.identity===state.identity;
   if(sameObject&&(old.state.face!==state.face||old.state.tapped!==state.tapped)){
    motion={started:now,duration:old.state.face!==state.face?420:240,flip:old.state.face!==state.face,from:old.state.tapped?90:0,to:state.tapped?90:0,fromTransform:old.current?.transform,front:old.clone,position:state.zone==='battlefield'?{from:{left:old.current?.left||old.clone.style.left,top:old.current?.top||old.clone.style.top},to:{left:node.style.left,top:node.style.top}}:null};
   }else if(!sameObject)motion=null;
   if(motion&&now-motion.started<motion.duration&&!reduced.matches&&!document.hidden){
    const rotate=n=>'rotate('+n+'deg)',middle=(motion.from+motion.to)/2;
    const frames=motion.flip?[{transform:rotate(motion.from)+' perspective(900px) rotateY(0deg)'},{transform:rotate(middle)+' perspective(900px) rotateY(90deg)',offset:.5},{transform:rotate(motion.to)+' perspective(900px) rotateY(0deg)'}]:[{transform:rotate(motion.from)},{transform:rotate(motion.to)}];
    if(motion.fromTransform)frames[0].transform=motion.fromTransform;
    if(motion.position){Object.assign(frames[0],motion.position.from);Object.assign(frames.at(-1),motion.position.to);}
    const animation=node.animate(frames,{duration:motion.duration,easing:'ease-in-out'});animation.id='card-motion-transform';animation.currentTime=now-motion.started;
    if(motion.flip){
     // Cover the new face with the previously visible face until edge-on. The
     // inert copy cannot intercept drags, counter buttons or keyboard actions.
     const front=document.createElement('div');front.className='card-flip-face';front.setAttribute('aria-hidden','true');front.inert=true;
     const visual=motion.front.cloneNode(true);visual.removeAttribute('data-card');visual.removeAttribute('id');visual.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));front.append(visual);node.append(front);
     const fade=front.animate([{opacity:1},{opacity:1,offset:.499},{opacity:0,offset:.5},{opacity:0}],{duration:motion.duration,fill:'forwards'});fade.id='card-motion-face';fade.currentTime=now-motion.started;
     animation.finished.catch(()=>{}).finally(()=>{fade.cancel();front.remove();});
    }
   }else motion=null;
   next.set(key,{node,state,clone,motion});
  }
  // Removed elements can still have running animations. Release them promptly.
  for(const entry of previous.values())if(!entry.node.isConnected)for(const animation of entry.node.getAnimations())if(animation.id.startsWith('card-motion'))animation.cancel();
  previous=next;
 }
 reduced.addEventListener('change',()=>{if(reduced.matches)clear();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 return {capture,refresh,clear};
}

export function tapIndicator(){
 const badge=document.createElement('span');badge.className='card-tap-indicator';badge.setAttribute('aria-hidden','true');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 40 40');
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M10 29V17a9 9 0 0 1 9-9h7v-5l11 10-11 10v-6h-7v12z');svg.append(path);badge.append(svg);return badge;
}
