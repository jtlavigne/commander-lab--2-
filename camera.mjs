// Screen-space camera over a fixed tabletop. Game state stays in engine.mjs.
export const TABLE={width:6180,height:3780,padding:60,gap:60,matWidth:3000,matHeight:1800};
export const MIN_ZOOM=.04,MAX_ZOOM=2;
export function seatBounds(seat){
 const column=seat===1||seat===2?1:0,row=seat>=2?1:0;
 return {x:TABLE.padding+column*(TABLE.matWidth+TABLE.gap),y:TABLE.padding+row*(TABLE.matHeight+TABLE.gap),width:TABLE.matWidth,height:TABLE.matHeight};
}
export function zoomAt(view,scale,point){
 scale=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,scale));
 const ratio=scale/view.scale;
 return {x:point.x-(point.x-view.x)*ratio,y:point.y-(point.y-view.y)*ratio,scale};
}
export function constrainView(view,size){
 const scale=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,view.scale)),margin=64;
 const axis=(offset,world,viewport,start=0)=>world*scale<=viewport?start+(viewport-world*scale)/2:Math.max(start+viewport-world*scale-margin,Math.min(start+margin,offset));
 return {x:axis(view.x,TABLE.width,size.width),y:axis(view.y,TABLE.height,size.height,size.top||0),scale};
}
export function frameRect(rect,size){
 const scale=Math.max(MIN_ZOOM,Math.min(1.1,size.width/(rect.width+48),size.height/(rect.height+48)));
 return {x:size.width/2-(rect.x+rect.width/2)*scale,y:(size.top||0)+size.height/2-(rect.y+rect.height/2)*scale,scale};
}
export function workingView(seat,size){
 return frameRect(seatBounds(seat),size);
}
export function availableViewSize(viewport,dock){return {width:viewport.width,height:Math.max(1,Math.min(viewport.height,dock?dock.top-viewport.top-12:viewport.height))};}

export function createTableCamera({viewport,world,map,marker,zoomLabel,onSeat,handDock,getPlayerCount=()=>4}){
 const currentSize=()=>{const size=availableViewSize(viewport.getBoundingClientRect(),handDock?.getBoundingClientRect()),bar=document.getElementById('mana-bar'),top=bar?bar.offsetTop+bar.offsetHeight+12:0;return {...size,top,height:Math.max(1,size.height-top)};};
 let size=currentSize();
 let view=workingView(0,size),mode='seat',focusedSeat=0,pan=null,space=false,suppressClick=false,saveTimer,dragPoint=null,edgeFrame=0,lastFrame=0;
 world.style.width=TABLE.width+'px';world.style.height=TABLE.height+'px';world.style.padding=TABLE.padding+'px';world.style.gap=TABLE.gap+'px';
 world.style.gridTemplateColumns=`repeat(2, ${TABLE.matWidth}px)`;world.style.gridTemplateRows=`repeat(2, ${TABLE.matHeight}px)`;
 world.style.setProperty('--mat-height',TABLE.matHeight+'px');
 const inputActive=event=>event.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open]');
 function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem('commanderLabCamera',JSON.stringify({version:2,...view,mode,focusedSeat}));}catch{/* Viewing is still available without local storage. */}},200);}
 function paint({constrain=true}={}){
  if(constrain)view=constrainView(view,size);
  // CSS zoom repaints images/text at their displayed resolution. A transform
  // on the full board can instead stretch a cached low-resolution layer.
  world.style.transform='none';world.style.zoom=String(view.scale);
  world.style.left=view.x/view.scale+'px';world.style.top=view.y/view.scale+'px';
  world.dataset.scale=String(view.scale);world.dataset.cameraX=String(view.x);world.dataset.cameraY=String(view.y);
  zoomLabel.textContent=Math.round(view.scale*100)+'%';
  const left=Math.max(0,-view.x/view.scale),top=Math.max(0,((size.top||0)-view.y)/view.scale);
  const right=Math.min(TABLE.width,(size.width-view.x)/view.scale),bottom=Math.min(TABLE.height,((size.top||0)+size.height-view.y)/view.scale);
  marker.style.left=left/TABLE.width*100+'%';marker.style.top=top/TABLE.height*100+'%';
  marker.style.width=Math.max(0,right-left)/TABLE.width*100+'%';marker.style.height=Math.max(0,bottom-top)/TABLE.height*100+'%';
  persist();
 }
 function focusSeat(seat){mode='seat';focusedSeat=seat;size=currentSize();view=workingView(seat,size);paint();}
 function fitSeat(seat){mode='seat-overview';focusedSeat=seat;size=currentSize();view=frameRect(seatBounds(seat),size);paint();}
 const tableBounds=()=>({x:0,y:0,width:TABLE.width,height:getPlayerCount()===2?TABLE.padding*2+TABLE.matHeight:TABLE.height});
 function fit(){mode='table';size=currentSize();view=frameRect(tableBounds(),size);paint();}
 function panBy(x,y){mode='free';view={...view,x:view.x+x,y:view.y+y};paint();}
 function zoom(scale,point={x:size.width/2,y:(size.top||0)+size.height/2}){mode='free';view=zoomAt(view,scale,point);paint();}
 function centerAt(point){mode='free';view={...view,x:size.width/2-point.x*view.scale,y:size.height/2-point.y*view.scale};paint();}
 function endPan(){
  if(!pan)return;const previous=pan;pan=null;viewport.classList.remove('panning');
  if(viewport.hasPointerCapture(previous.id))viewport.releasePointerCapture(previous.id);
  suppressClick=previous.moved||previous.forced;setTimeout(()=>suppressClick=false,0);
 }
 viewport.addEventListener('pointerdown',event=>{
  if(event.target.closest('.camera-hud')||document.querySelector('dialog[open]'))return;
  const forced=event.button===1||space&&event.button===0;
  if(!forced&&(event.button!==0||event.target.closest('button,input,select,a,.card,.hand .cards,.command-zone .cards')))return;
  event.preventDefault();mode='free';pan={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:view.x,y:view.y,moved:false,forced};viewport.setPointerCapture(event.pointerId);viewport.classList.add('panning');
 });
 viewport.addEventListener('pointermove',event=>{
  if(!pan||pan.id!==event.pointerId)return;const dx=event.clientX-pan.startX,dy=event.clientY-pan.startY;
  if(Math.abs(dx)+Math.abs(dy)>3)pan.moved=true;
  view={...view,x:pan.x+dx,y:pan.y+dy};paint();
 });
 viewport.addEventListener('pointerup',endPan);viewport.addEventListener('pointercancel',endPan);viewport.addEventListener('lostpointercapture',endPan);
 viewport.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();}},true);
 viewport.addEventListener('auxclick',event=>{if(event.button===1)event.preventDefault();});
 // Capture precedes card drag handlers: Space/middle-drag always moves the view.
 viewport.addEventListener('dragstart',event=>{if(space||pan)event.preventDefault();},true);
 viewport.addEventListener('wheel',event=>{
  if(event.target.closest('.camera-hud'))return;
  event.preventDefault();
  const hand=event.target.closest('.hand .cards,.command-zone .cards');
  if(hand&&event.shiftKey){hand.scrollLeft+=event.deltaY||event.deltaX;return;}
  if(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)*1.5){panBy(-event.deltaX-(event.shiftKey?event.deltaY:0),event.shiftKey?0:-event.deltaY);return;}
  const rect=viewport.getBoundingClientRect(),delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?size.height:1);
  zoom(view.scale*Math.exp(-Math.max(-300,Math.min(300,delta))*.0018),{x:event.clientX-rect.left,y:event.clientY-rect.top});
 },{passive:false});
 document.addEventListener('keydown',event=>{
  if(inputActive(event)||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.code==='Space'){event.preventDefault();space=true;viewport.classList.add('space-pan');}
  else if(event.key==='0'){event.preventDefault();fit();}
  else if(/^[1-4]$/.test(event.key)){event.preventDefault();onSeat(Number(event.key)-1);}
  else if(event.key==='+'||event.key==='='){event.preventDefault();zoom(view.scale*1.15);}
  else if(event.key==='-'){event.preventDefault();zoom(view.scale/1.15);}
  else if(event.key.startsWith('Arrow')){event.preventDefault();const amount=event.shiftKey?160:70;panBy(event.key==='ArrowLeft'?amount:event.key==='ArrowRight'?-amount:0,event.key==='ArrowUp'?amount:event.key==='ArrowDown'?-amount:0);}
 });
 document.addEventListener('keyup',event=>{if(event.code==='Space'){space=false;viewport.classList.remove('space-pan');}});
 window.addEventListener('blur',()=>{space=false;viewport.classList.remove('space-pan');endPan();stopEdgePan();});
 map.addEventListener('click',event=>{
  const seatButton=event.target.closest('[data-seat]');if(seatButton){onSeat(Number(seatButton.dataset.seat));return;}
  const rect=map.getBoundingClientRect();centerAt({x:(event.clientX-rect.left)/rect.width*TABLE.width,y:(event.clientY-rect.top)/rect.height*TABLE.height});
 });
 // Move the viewport near its edges while carrying a card to a distant playmat.
 function stopEdgePan(){dragPoint=null;cancelAnimationFrame(edgeFrame);edgeFrame=0;lastFrame=0;}
 function tickEdgePan(time){
  if(!dragPoint){edgeFrame=0;return;}const rect=viewport.getBoundingClientRect(),edge=48;
  const speed=(value,start,end)=>value<start+edge?Math.min(1,(start+edge-value)/edge):value>end-edge?-Math.min(1,(value-end+edge)/edge):0;
  const factor=Math.min(2,(time-(lastFrame||time-16))/16);lastFrame=time;
  const x=speed(dragPoint.x,rect.left,rect.right)*12*factor,y=speed(dragPoint.y,rect.top,rect.bottom)*12*factor;
  if(x||y)panBy(x,y);edgeFrame=requestAnimationFrame(tickEdgePan);
 }
 viewport.addEventListener('dragover',event=>{
  if(event.defaultPrevented||!event.dataTransfer.types.includes('application/x-commander-card'))return;
  event.preventDefault();dragPoint=event.target.closest('.camera-hud')?null:{x:event.clientX,y:event.clientY};if(dragPoint&&!edgeFrame)edgeFrame=requestAnimationFrame(tickEdgePan);
 },true);
 viewport.addEventListener('dragleave',event=>{if(!viewport.contains(event.relatedTarget))stopEdgePan();});
 document.addEventListener('drop',stopEdgePan,true);document.addEventListener('dragend',stopEdgePan,true);
 new ResizeObserver(()=>{
  const next=currentSize();if(next.width===size.width&&next.height===size.height)return;
  // Refitting is an explicit action. Window/dock resizing must not move the table.
  size=next;paint({constrain:false});
 }).observe(viewport);
 try{
  const saved=JSON.parse(localStorage.getItem('commanderLabCamera'));
  if(saved?.version===2&&[saved.x,saved.y,saved.scale].every(Number.isFinite)&&saved.scale>0){view=saved;mode=['seat','seat-overview','table','free'].includes(saved.mode)?saved.mode:'free';focusedSeat=Number.isInteger(saved.focusedSeat)&&saved.focusedSeat>=0&&saved.focusedSeat<getPlayerCount()?saved.focusedSeat:0;if(mode==='table')view=frameRect(tableBounds(),size);else if(mode==='seat')view=workingView(focusedSeat,size);else if(mode==='seat-overview')view=frameRect(seatBounds(focusedSeat),size);}
 }catch{/* Start at seat one if camera preferences cannot be restored. */}
 paint();
 return {focusSeat,fitSeat,fit,panBy,zoomIn:()=>zoom(view.scale*1.15),zoomOut:()=>zoom(view.scale/1.15),resetZoom:()=>zoom(1),get scale(){return view.scale;},get focusedSeat(){return focusedSeat;}};
}
