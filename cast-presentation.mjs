import {findCard} from './engine.mjs';
import {cardFace} from './card-state.mjs';

export function createCastPresentation({getGame,renderCard,resolveArt,priorityControls,el,button}){
 const root=el('section',undefined,'play-presentation');root.id='play-presentation';root.hidden=true;root.setAttribute('aria-label','Spell and ability announcement');document.body.append(root);
 const arrows=document.createElementNS('http://www.w3.org/2000/svg','svg');arrows.classList.add('play-presentation-arrows');arrows.setAttribute('aria-hidden','true');document.body.append(arrows);
 let initialized=false,seen=new Set(),current=null,timer=0,frame=0,hold=0;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function hide(){clearTimeout(timer);clearTimeout(hold);cancelAnimationFrame(frame);frame=0;current=null;root.hidden=true;root.replaceChildren();arrows.replaceChildren();}
 const onStack=event=>getGame().stack.some(e=>e.id===event?.stackId||e.card?.instance===event?.stackId);
 function topAnnouncement(events){
  const entry=getGame().stack.at(-1);if(!entry)return null;
  const stackId=entry.card?.instance||entry.id,announced=events.findLast(event=>event.stackId===stackId);if(announced)return announced;
  // Triggered abilities and restored/manual stack entries may have no play event.
  const card=entry.card||entry.source||{instance:entry.id,name:entry.name,type_line:'Ability'};
  return {id:'stack:'+stackId,stackId,owner:entry.owner,kind:entry.card?'cast':'ability',card,text:entry.spellText??entry.text??cardFace(card).oracle_text??'',targets:entry.targets||entry.combatTrigger?.targets||[]};
 }
 function dismissWhenResolved(){
  if(onStack(current)){clearTimeout(hold);hold=0;}
  else if(current&&!hold)hold=setTimeout(hide,4500);
 }
 function targetElement(target){
  const candidates=target.kind==='card'?[...document.querySelectorAll('.battlefield .card[data-card]')].filter(n=>n.dataset.card===target.id):[...document.querySelectorAll('.player-mat[data-seat="'+target.owner+'"] .player-heading')];
  return candidates.find(n=>{const r=n.getBoundingClientRect();return r.width&&r.right>0&&r.left<innerWidth&&r.top<innerHeight&&r.bottom>0;})||[...root.querySelectorAll('[data-announced-target]')].find(n=>n.dataset.announcedTarget===target.key);
 }
 function drawArrows(){
  arrows.replaceChildren();if(!current||root.hidden)return;
  const source=root.querySelector('.play-source .card')?.getBoundingClientRect();if(source)for(const target of current.targets){const rect=targetElement(target)?.getBoundingClientRect();if(!rect)continue;const path=document.createElementNS(arrows.namespaceURI,'path'),sx=source.right,sy=source.top+source.height/2,tx=rect.left+rect.width/2,ty=rect.top+rect.height/2;path.setAttribute('d',`M ${sx} ${sy} Q ${(sx+tx)/2} ${Math.min(sy,ty)-35} ${tx} ${ty}`);arrows.append(path);}
  frame=requestAnimationFrame(drawArrows);
 }
 function paint(){
  if(!current)return;const g=getGame();root.replaceChildren();root.hidden=false;root.dataset.play=current.id;
  const heading=el('div',undefined,'play-presentation-heading'),title=el('strong',g.players[current.owner]?.name+' · '+(current.kind==='reveal'?'Revealed card':root.classList.contains('is-casting')?(current.kind==='copy'?'Copying':current.kind==='cast'?'Casting':'Ability'):current.kind==='copy'?'Spell copy':current.kind==='cast'?'Spell':'Ability')),dismiss=button('×',hide,'icon-button');dismiss.setAttribute('aria-label','Dismiss spell presentation');heading.append(title,dismiss);root.append(heading);
  const layout=el('div',undefined,'play-presentation-layout'),source=el('div',undefined,'play-source'),definition=resolveArt(current.card);source.append(renderCard(definition,{revealed:current.kind==='reveal'}),el('strong',current.card.name));layout.append(source);
  const detail=el('div',undefined,'play-presentation-details');detail.append(el('p',current.text,'play-effect-text'));
  if(g.pendingEffect?.revealed){const tray=el('div',undefined,'play-targets');tray.append(el('strong','Revealed cards'));for(const id of g.pendingEffect.revealed.ids){const found=findCard(g,id);if(found&&!found.card.hidden)tray.append(renderCard(found.card));}detail.append(tray);}
  const targets=el('div',undefined,'play-targets');for(const target of current.targets){const item=el('div',undefined,'play-target');item.dataset.announcedTarget=target.key;const found=target.kind==='card'&&findCard(g,target.id);if(['battlefield','stack'].includes(found?.zone)&&!found.card.hidden&&!found.card.faceDown)item.append(renderCard(found.card));item.append(el('span',target.label||g.players[target.owner]?.name||'Target'));targets.append(item);}if(targets.children.length){detail.append(el('span','TARGETS','eyebrow'),targets);}else detail.append(el('p','No targets.','panel-caption'));
  const status=el('p',current.kind==='reveal'?'Publicly revealed':onStack(current)?'On the stack - players may respond':'Resolved or removed from the stack','play-status');detail.append(status);layout.append(detail);root.append(layout);
  if(g.stack.length)root.append(priorityControls());
 }
 function present(event,animate=true){
  hide();hold=0;current=event;root.classList.toggle('is-casting',animate);paint();drawArrows();
  if(animate)timer=setTimeout(()=>{root.classList.remove('is-casting');paint();dismissWhenResolved();},reduced()?80:420);else dismissWhenResolved();
 }
 function refresh(){if(getGame().result){hide();return;}
  const events=getGame().playEvents||[],added=initialized?events.filter(event=>!seen.has(event.id)):[];
  seen=new Set(events.map(event=>event.id));initialized=true;
  const top=topAnnouncement(events);
  if(top){if(current?.id!==top.id)present(top,added.some(event=>event.id===top.id));else{current=top;paint();dismissWhenResolved();}return;}
  if(added.length){present(added.at(-1));return;}
  if(current){if(!events.length){hide();return;}paint();dismissWhenResolved();}
 }
 return {refresh,hide,root};
}
