import {dismissCardPreview} from './card-preview.mjs';
import {openingPending,bottomCount,freeMulligans,MULLIGAN_MODES} from './opening-hand.mjs';

// Private card selection stays in this renderer. Only a confirmed keep sends
// IDs to the host; the host publishes counts/readiness, never those selections.
export function createOpeningHandUI({getGame,getNetwork,getSeat,selectSeat,dispatch,renderCard}){
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const css=make('link');css.rel='stylesheet';css.href=new URL('./opening-hand.css',import.meta.url).href;document.head.append(css);
 const dialog=make('dialog');dialog.id='opening-hand-dialog';dialog.setAttribute('aria-labelledby','opening-title');dialog.addEventListener('cancel',e=>e.preventDefault());document.body.append(dialog);
 let selected=[],identity='',busy=false,failure='';
 function button(text,fn,id){const b=make('button',text);b.type='button';if(id)b.id=id;b.disabled=busy;b.onclick=fn;return b;}
 async function send(action){if(busy)return;busy=true;failure='';refresh();try{const ok=await dispatch(action);if(ok!==false)selected=[];else failure=document.getElementById('status')?.textContent||'The action was not accepted. Try again.';}catch(error){failure=error.message;}finally{busy=false;refresh();}}
 function refresh(){
  dismissCardPreview(dialog);
  const g=getGame();if(!openingPending(g)){if(dialog.open)dialog.close();identity='';selected=[];return;}
  const net=getNetwork(),owner=net?.seat??getSeat(),p=g.players[owner],s=g.opening.players[owner];
  const key=JSON.stringify([owner,g.opening.round,s.kept,p.zones.hand.map(c=>c.instance)]);if(key!==identity){identity=key;selected=[];}
  dialog.replaceChildren();const title=make('h2','Verify your starting hand - '+p.name);title.id='opening-title';dialog.append(title);
  const mode=g.lobby?.mulligan?.mode||'regular',free=freeMulligans(g),due=bottomCount(g,owner);
  dialog.append(make('p',MULLIGAN_MODES[mode]+' · '+(free===Infinity?'Unlimited free redraws':free+' free mulligan(s)')+' · Mulligans taken: '+s.mulligans,'opening-rule'));
  const seats=make('div',undefined,'opening-seats');
  g.opening.players.forEach((state,i)=>{const text=g.players[i].name+' · '+(state.ready?'Ready':state.kept?'Hand kept':state.redraw?'Waiting for redraw':'Choosing');if(net)seats.append(make('span',text));else{const b=button(text,()=>selectSeat(i));b.dataset.openingSeat=i;b.setAttribute('aria-pressed',String(i===owner));seats.append(b);}});dialog.append(seats);
  const hint=make('p',s.ready?'Ready. Waiting for the other players.':s.kept?'Confirm Ready to begin with this hand.':s.redraw?'Mulligan chosen. Your next hand is dealt after everyone has decided.':due?'Select '+due+' card(s) to put on the bottom, then choose Ready. Last selected goes bottommost.':'Review your hand, then choose Ready or Mulligan. Play begins only when everyone is ready.');hint.id='opening-instructions';hint.setAttribute('role','status');dialog.append(hint);
  const cards=make('div',undefined,'opening-cards');cards.id='opening-cards';
  if(!s.redraw)for(const c of p.zones.hand){
   const wrap=make('button',undefined,'opening-card-choice');wrap.type='button';wrap.dataset.openingCard=c.instance;wrap.title=c.name+'\n'+(c.oracle_text||'');wrap.setAttribute('aria-label',c.name);wrap.setAttribute('aria-pressed',String(selected.includes(c.instance)));wrap.disabled=busy||s.kept||due===0;
   const visual=renderCard(c,{interactive:false});visual.inert=true;visual.removeAttribute('data-card');visual.tabIndex=-1;visual.setAttribute('aria-hidden','true');
   // Rendered cards can themselves be buttons. Use a noninteractive wrapper
   // for their children so our selection button never nests another button.
   wrap.dataset.inspectCard=c.instance;
   const art=make('span',undefined,visual.className);art.append(...visual.childNodes);wrap.append(art,make('span',c.name,'opening-card-name'));
   if(selected.includes(c.instance))wrap.append(make('span','Bottom '+(selected.indexOf(c.instance)+1),'opening-order'));
   wrap.onclick=()=>{if(selected.includes(c.instance))selected=selected.filter(id=>id!==c.instance);else if(selected.length<due)selected.push(c.instance);refresh();};cards.append(wrap);
  }dialog.append(cards);
  const actions=make('div',undefined,'opening-actions');
  if(!s.kept&&!s.redraw){const redraw=button('Mulligan',()=>send({type:'openingMulligan',owner}),'opening-mulligan');redraw.disabled=busy||s.mulligans-free>=7;actions.append(redraw);}
  if(!s.ready&&!s.redraw){const ready=button('Ready',()=>send({type:'openingReady',owner,bottom:selected}),'opening-ready');ready.disabled=busy||!s.kept&&selected.length!==due;actions.append(ready);}
  if(!net&&(s.ready||s.redraw)){const next=g.opening.players.findIndex((state,i)=>i!==owner&&!state.ready&&!state.redraw);if(next>=0)actions.append(button('View '+g.players[next].name+"'s hand",()=>selectSeat(next),'opening-next'));}
  dialog.append(actions);if(failure){const error=make('p',failure);error.setAttribute('role','alert');dialog.append(error);}if(!dialog.open)dialog.showModal();document.dispatchEvent(new Event('refresh-card-preview'));
 }
 refresh();return {refresh};
}
