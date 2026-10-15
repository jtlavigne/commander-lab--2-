// Return the shared inspector before a focused view replaces its contents.
export function dismissCardPreview(container){
 const preview=document.getElementById('card-zoom-preview');
 if(preview&&container.contains(preview))preview.dispatchEvent(new Event('dismiss-preview'));
}

// The artwork and inspector share one temporary surface, outside the table camera.
export function createCardPreview({roots,getCard,renderCard,renderDetails}){
 const preview=document.createElement('div'),art=document.createElement('div'),details=document.createElement('div');
 preview.id='card-zoom-preview';preview.hidden=true;preview.popover='manual';preview.setAttribute('role','region');preview.setAttribute('aria-label','Card inspector');
 art.className='zoom-art';art.setAttribute('role','group');art.setAttribute('aria-label','Card artwork and controls');details.id='inspector';
 preview.append(art,details);document.body.append(preview);
 let held=false,controllerHeld=false,dragging=false,point=null,source=null,id=null,anchor=null,modal=null;
 const inside=(rect,p)=>p&&p.x>=rect.left&&p.x<=rect.right&&p.y>=rect.top&&p.y<=rect.bottom;
 const overDetails=()=>{const hit=point&&document.elementFromPoint(point.x,point.y);return hit&&(details.contains(hit)||art.contains(hit)&&hit.closest('[data-counter-control]'));};
 const editing=()=>details.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select');
 function hide(){
  if(preview.contains(document.activeElement))document.activeElement.blur();
  if(preview.matches(':popover-open'))preview.hidePopover();
  preview.hidden=true;source=null;id=null;anchor=null;modal=null;art.replaceChildren();
  if(preview.parentElement!==document.body)document.body.append(preview);
 }
 // Modal cards are valid inspection targets too. Keep the popover inside its
 // dialog so Chromium's modal focus boundary does not make it inert.
 preview.addEventListener('dismiss-preview',hide);
 const topModal=()=>[...document.querySelectorAll('dialog:modal')].at(-1);
 const blocked=()=>!preview.contains(document.activeElement)&&document.activeElement?.closest('input:not(#pile-search),textarea,select,[contenteditable="true"]')&&!document.elementFromPoint(point?.x||0,point?.y||0)?.closest('.card[data-card],[data-inspect-card]');
 function refresh(force=false){
  const inspecting=held||controllerHeld;
  if(dragging||!point||blocked()||(!inspecting&&!overDetails()&&!editing())){hide();return;}
  const hit=document.elementFromPoint(point.x,point.y),node=hit?.closest('.card[data-card],[data-inspect-card]'),activeModal=topModal();
  const next=inspecting&&node&&!preview.contains(node)&&(!activeModal||activeModal.contains(node))&&roots.some(root=>root.contains(node))?node:null;
  // Keep the controls reachable across the small gap beside the source card.
  const p=preview.getBoundingClientRect(),bridge=anchor&&{left:Math.min(anchor.left,p.left),right:Math.max(anchor.right,p.right),top:Math.min(anchor.top,p.top),bottom:Math.max(anchor.bottom,p.bottom)};
  // Board repaint replaces card nodes after counter edits; keep the inspector
  // reachable while its card still exists. Modal choices require a live source.
  const keep=id&&(source?.isConnected||!modal)&&(!modal||modal.open)&&(!activeModal||activeModal===modal)&&(!preview.hidden&&(preview.contains(hit)||editing()||(inspecting&&inside(bridge,point))));
  const nextId=next?.dataset.inspectCard||next?.dataset.card||(keep?id:null),card=nextId&&getCard(nextId,next||source);
  if(!card){hide();return;}
  const changed=nextId!==id;
  if(changed||force||next&&source!==next){
   id=nextId;source=next||source;
   const readOnly=!!source.closest('dialog:not(#pile-dialog),.combat-focus,#play-presentation,[data-inspect-card]');
   const copy=renderCard({...card,tapped:false},{interactive:false,overlayControls:!readOnly,revealed:true});
   copy.removeAttribute('title');copy.removeAttribute('data-card');copy.classList.remove('selected');copy.tabIndex=-1;
   art.replaceChildren(copy);renderDetails(id,{readOnly,inspectionCard:card});
  }
  if(next&&(changed||preview.hidden)){anchor=next.getBoundingClientRect();modal=next.closest('dialog[open]');}
  const host=modal?.open?modal:document.body;
  if(preview.parentElement!==host){if(preview.matches(':popover-open'))preview.hidePopover();host.append(preview);}
  preview.hidden=false;if(!preview.matches(':popover-open'))preview.showPopover();
  if(anchor){
   const width=preview.offsetWidth,height=preview.offsetHeight,margin=16;
   let left=anchor.right+margin;
   if(left+width>innerWidth-margin)left=anchor.left-width-margin;
   preview.style.left=Math.max(margin,Math.min(left,innerWidth-width-margin))+'px';
   preview.style.top=Math.max(margin,Math.min((anchor.top+anchor.bottom-height)/2,innerHeight-height-margin))+'px';
  }
 }
 document.addEventListener('pointermove',event=>{point={x:event.clientX,y:event.clientY};refresh();});
 document.documentElement.addEventListener('pointerleave',()=>{if(!editing()){point=null;hide();}});
 document.addEventListener('keydown',event=>{
  if(event.code==='Escape'){held=false;controllerHeld=false;hide();return;}
  if(event.code!=='AltLeft')return;
  if(!blocked())event.preventDefault();held=true;refresh();
 });
 document.addEventListener('keyup',event=>{
  if(event.code!=='AltLeft')return;
  if(held&&!blocked())event.preventDefault();held=false;refresh();
 });
 details.addEventListener('focusout',()=>queueMicrotask(()=>refresh()));
 document.addEventListener('dragstart',event=>{dragging=true;hide();queueMicrotask(()=>{if(event.defaultPrevented){dragging=false;refresh();}});},true);
 document.addEventListener('dragend',()=>{dragging=false;point=null;hide();},true);
 document.addEventListener('drop',()=>{dragging=false;point=null;hide();},true);
 window.addEventListener('blur',()=>{held=false;controllerHeld=false;dragging=false;point=null;hide();});
 window.addEventListener('resize',()=>refresh());
 document.addEventListener('beforetoggle',event=>{if(event.target.matches('dialog')&&event.newState==='open')hide();},true);
 document.addEventListener('close',event=>{if(event.target===modal)hide();},true);
 document.addEventListener('refresh-card-preview',()=>refresh(true));
 return {refresh,setControllerInspect(value,position){controllerHeld=!!value;if(value&&position)point=position;refresh();},get id(){return id;}};
}
