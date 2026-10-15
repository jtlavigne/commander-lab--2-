// Magnify a hand without moving its screen anchor or changing game state.
export function createHandDock({root,track,items,caption,onScroll}){
 let cardWidth=64,cardHeight=90,pitch=74,padding=120,radius=180,desiredWidth=1100,peakScale=2.2;
 let slots=[],pointer=null,frame=0,resizing=null;
 try{const saved=JSON.parse(localStorage.getItem('commanderLabDockSize'));if(saved?.version===1&&Number.isFinite(saved.width)&&Number.isFinite(saved.cardWidth)){desiredWidth=Math.max(540,Math.min(4000,saved.width));cardWidth=Math.max(48,Math.min(160,saved.cardWidth));}}catch{}
 function saveSize(){try{localStorage.setItem('commanderLabDockSize',JSON.stringify({version:1,width:desiredWidth,cardWidth}));}catch{}}
 function applySize(save=false){
  reset();cardWidth=Math.max(48,Math.min(160,Math.round(cardWidth)));cardHeight=Math.round(cardWidth*90/64);pitch=cardWidth+10;padding=Math.max(120,Math.ceil(cardWidth*1.85));radius=cardWidth*2.8125;
  peakScale=Math.max(1,Math.min(2.2,(innerHeight-210)/cardHeight));
  const width=Math.max(Math.min(540,innerWidth-32),Math.min(innerWidth-32,desiredWidth)),height=cardHeight+24;
  root.style.width=width+'px';root.style.height=height+'px';root.style.setProperty('--dock-card-width',cardWidth+'px');root.style.setProperty('--dock-card-height',cardHeight+'px');root.style.setProperty('--dock-card-scale',String(cardWidth/64));
  track.style.height=Math.ceil(cardHeight*peakScale+22)+'px';document.documentElement.style.setProperty('--hand-dock-height',height+'px');
  for(const handle of root.querySelectorAll('[data-resize]')){handle.setAttribute('aria-valuenow',handle.dataset.resize==='height'?cardWidth:Math.round(width));handle.setAttribute('aria-valuetext',handle.dataset.resize==='height'?cardWidth+' pixel cards':Math.round(width)+' pixel dock');}
  layout();if(save)saveSize();
 }
 function updateScroll(){onScroll({canLeft:track.scrollLeft>1,canRight:track.scrollLeft+track.clientWidth<track.scrollWidth-1});}
 function reset(){
  pointer=null;cancelAnimationFrame(frame);frame=0;
  for(const slot of slots){slot.style.transform='';slot.style.zIndex='';}
  root.classList.remove('magnifying');caption.textContent=items.dataset.empty==='true'?'Import a deck or drop a card here.':'Hover to enlarge · Drag to play';
 }
 function paint(){
  frame=0;if(pointer===null)return;
  const local=pointer-track.getBoundingClientRect().left+track.scrollLeft;
  const scales=slots.map(slot=>{const distance=Math.abs(local-(Number(slot.dataset.dockX)+cardWidth/2));return distance>=radius?1:1+(peakScale-1)*Math.cos(distance/radius*Math.PI/2)**2;});
  const extra=scales.map(scale=>(scale-1)*cardWidth),total=extra.reduce((a,b)=>a+b,0);let prefix=0;
  slots.forEach((slot,i)=>{slot.style.transform=`translateX(${prefix+extra[i]/2-total/2}px) scale(${scales[i]})`;slot.style.zIndex=String(Math.round(scales[i]*100));prefix+=extra[i];});
  root.classList.toggle('magnifying',total>1);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
 function layout(){
  slots=[...items.querySelectorAll('.dock-slot')];
  const width=Math.max(track.clientWidth,Math.max(0,slots.length*pitch-(pitch-cardWidth))+padding*2);
  items.style.width=width+'px';const start=(width-Math.max(0,slots.length*pitch-(pitch-cardWidth)))/2;
  slots.forEach((slot,i)=>{const x=start+i*pitch;slot.dataset.dockX=String(x);slot.style.left=x+'px';slot.style.width=cardWidth+'px';slot.style.height=cardHeight+'px';});
  updateScroll();if(pointer!==null)schedule();
 }
 root.addEventListener('pointermove',event=>{
  if(resizing||event.pointerType==='touch'||event.target.closest('.dock-meta,.dock-tools,.dock-resize')||root.classList.contains('drag-in-progress'))return;
  pointer=event.clientX;const slot=event.target.closest('.dock-slot');if(slot)caption.textContent=slot.dataset.name;schedule();
 });
 root.addEventListener('pointerleave',reset);
 root.addEventListener('focusin',event=>{const slot=event.target.closest('.dock-slot');if(!slot||!event.target.matches(':focus-visible'))return;pointer=track.getBoundingClientRect().left+Number(slot.dataset.dockX)+cardWidth/2-track.scrollLeft;caption.textContent=slot.dataset.name;schedule();});
 root.addEventListener('focusout',event=>{if(!root.contains(event.relatedTarget))reset();});
 root.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();track.scrollLeft+=(event.deltaX||event.deltaY)*(event.deltaMode===1?16:1);},{passive:false});
 track.addEventListener('scroll',()=>{updateScroll();if(pointer!==null)schedule();});
 root.addEventListener('dragstart',()=>{root.classList.add('drag-in-progress');setTimeout(reset,0);});
 const finishDrag=()=>{root.classList.remove('drag-in-progress');reset();};
 // Zone drop handlers stop bubbling; always restore hover after a completed drag.
 document.addEventListener('dragend',finishDrag,true);document.addEventListener('drop',finishDrag,true);
 for(const handle of root.querySelectorAll('[data-resize]')){
  handle.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;event.preventDefault();event.stopPropagation();reset();
   resizing={id:event.pointerId,x:event.clientX,y:event.clientY,width:root.getBoundingClientRect().width,cardHeight,mode:handle.dataset.resize};
   handle.setPointerCapture(event.pointerId);root.classList.add('resizing');
  });
  handle.addEventListener('pointermove',event=>{
   if(!resizing||event.pointerId!==resizing.id)return;event.preventDefault();event.stopPropagation();
   const dx=event.clientX-resizing.x,dy=event.clientY-resizing.y;
   if(resizing.mode!=='height')desiredWidth=Math.max(540,Math.min(innerWidth-32,resizing.width+dx*(resizing.mode==='left'?-2:2)));
   if(resizing.mode==='height'||resizing.mode==='corner')cardWidth=(resizing.cardHeight-dy)*64/90;
   applySize();
  });
  const finishResize=event=>{if(!resizing||event.pointerId!==resizing.id)return;resizing=null;root.classList.remove('resizing');if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);saveSize();};
  handle.addEventListener('pointerup',finishResize);handle.addEventListener('pointercancel',finishResize);handle.addEventListener('lostpointercapture',finishResize);
  handle.addEventListener('dblclick',()=>{desiredWidth=1100;cardWidth=64;applySize(true);});
  handle.addEventListener('keydown',event=>{
   if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();event.stopPropagation();
   if(event.key==='Home'){desiredWidth=1100;cardWidth=64;}else if(event.key==='ArrowUp')cardWidth+=8;else if(event.key==='ArrowDown')cardWidth-=8;else desiredWidth=root.clientWidth+(event.key==='ArrowRight'?40:-40);
   applySize(true);
  });
 }
 window.addEventListener('resize',()=>applySize());
 new ResizeObserver(layout).observe(track);
 applySize();
 return {layout,reset,changeSize:delta=>{cardWidth+=delta;applySize(true);},scroll:direction=>{track.scrollBy({left:direction*250,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}};
}
