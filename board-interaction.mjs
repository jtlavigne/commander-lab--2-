import {blockController} from './combat.mjs';
import {findCard} from './engine.mjs';

export function combatGroups(game,seat){
 const combat=game.combat;if(!combat)return [];
 const groups=new Map();
 for(const attack of combat.attackers){
  if(seat!==combat.owner&&attack.defender.owner!==seat&&!(game.step===6&&blockController(game,attack.defender.owner)===seat))continue;
  const found=findCard(game,attack.id);if(found?.zone!=='battlefield'||found.owner!==combat.owner||attack.battlefieldId!==undefined&&(found.card.battlefieldId||null)!==attack.battlefieldId)continue;
  const key=attack.defender.key|| (attack.defender.kind==='player'?'player:'+attack.defender.owner:'card:'+attack.defender.id);
  if(!groups.has(key))groups.set(key,{key,defender:attack.defender,attackers:[]});groups.get(key).attackers.push(attack);
 }
 return [...groups.values()];
}

// Target selection is a local draft. Only the completed announcement is sent
// through the shared reducer; no private hand or unchosen target is broadcast.
export function createBoardInteraction({getGame,getSeat,renderCard,el,button,setStatus}){
 const hud=el('section',undefined,'board-pick-hud');hud.id='board-target-picker';hud.hidden=true;hud.setAttribute('aria-label','Choose targets on the table');document.body.append(hud);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('board-target-arrows');svg.setAttribute('aria-hidden','true');document.body.append(svg);
 let draft=null,keys=[],amounts={},pointer=null,frame=0;
 const options=()=>draft?.options()||[],selected=()=>options().filter(o=>keys.includes(o.key));
 const minimum=()=>Math.min(draft?.min??1,options().length),total=()=>Number(draft?.total?.()||0);
 function clearPaint(){for(const node of document.querySelectorAll('.board-target-valid,.board-target-picked,.board-target-source'))node.classList.remove('board-target-valid','board-target-picked','board-target-source');}
 function stop(){cancelAnimationFrame(frame);frame=0;draft=null;keys=[];amounts={};hud.hidden=true;hud.replaceChildren();svg.replaceChildren();clearPaint();document.body.classList.remove('board-picking');}
 function cancel(){const callback=draft?.onCancel;stop();callback?.();}
 function confirm(){
  if(!draft)return;const count=keys.length,used=Object.values(amounts).reduce((a,b)=>a+b,0);
  if(count<minimum()||count>(draft.max??1)||draft.division&&used!==total()){setStatus(draft.division?'Assign exactly '+total()+' damage before continuing.':'Choose a legal number of targets.');return;}
  const reason=draft.validate?.([...keys],{...amounts});if(reason){setStatus(reason);return;}
  const callback=draft.onConfirm,result=[...keys],division={...amounts};stop();callback(result,division);
 }
 function choose(key,delta=1){
  const option=options().find(o=>o.key===key);if(!option)return false;
  if(draft.division){const used=Object.values(amounts).reduce((a,b)=>a+b,0);if(delta>0&&used>=total()){setStatus('All '+total()+' damage is assigned. Right-click a target to remove damage.');return true;}amounts[key]=Math.max(0,(amounts[key]||0)+delta);if(amounts[key]){if(!keys.includes(key))keys.push(key);}else{delete amounts[key];keys=keys.filter(k=>k!==key);}}
  else if(keys.includes(key))keys=keys.filter(k=>k!==key);
  else if((draft.max??1)===1)keys=[key];else if(keys.length<(draft.max??1))keys.push(key);else{setStatus('The maximum number of targets is selected.');return true;}
  draft.onChange?.([...keys],{...amounts});paint();
  if(!draft.division&&(draft.max??1)===1&&keys.length&&draft.autoConfirm!==false)confirm();return true;
 }
 function targetNode(option){
  const nodes=option.kind==='player'?[...document.querySelectorAll('[data-target-key]')].filter(n=>n.dataset.targetKey===option.key):[...document.querySelectorAll('.card[data-card]')].filter(n=>n.dataset.card===option.id);
  return nodes.find(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;});
 }
 function arrows(){
  svg.replaceChildren();if(!draft)return;
  const origin=targetNode({kind:'card',id:draft.source?.instance}),a=origin?.getBoundingClientRect()||hud.getBoundingClientRect(),sx=a.left+a.width/2,sy=a.top+a.height/2;
  const endpoints=selected().map(option=>{const rect=targetNode(option)?.getBoundingClientRect();return rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:null;}).filter(Boolean);if(pointer)endpoints.push(pointer);
  for(const point of endpoints){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',`M ${sx} ${sy} Q ${(sx+point.x)/2} ${Math.min(sy,point.y)-70} ${point.x} ${point.y}`);svg.append(path);const tip=document.createElementNS(svg.namespaceURI,'circle');tip.setAttribute('cx',point.x);tip.setAttribute('cy',point.y);tip.setAttribute('r','5');svg.append(tip);}
  frame=requestAnimationFrame(arrows);
 }
 function paint(){
  if(!draft)return;
  if(getSeat()!==draft.owner){cancel();return;}
  const available=options(),legal=new Set(available.map(o=>o.key));keys=keys.filter(k=>legal.has(k));amounts=Object.fromEntries(Object.entries(amounts).filter(([key])=>keys.includes(key)));
  clearPaint();hud.replaceChildren();document.body.classList.add('board-picking');hud.hidden=false;
  const heading=el('div',undefined,'board-pick-heading');heading.append(el('strong',draft.title),el('span',draft.division?Object.values(amounts).reduce((a,b)=>a+b,0)+' / '+total()+' damage assigned':'Click highlighted cards or a player.'));hud.append(heading);
  const players=el('div',undefined,'board-pick-players');for(const option of available.filter(o=>o.kind==='player')){const chip=button(option.label+' · '+getGame().players[option.owner].life+' life',()=>{},'board-target-player');chip.dataset.targetKey=option.key;chip.setAttribute('aria-pressed',String(keys.includes(option.key)));players.append(chip);}if(players.children.length)hud.append(players);
  const offboard=available.filter(o=>o.kind==='card'&&(draft.proxies||o.zone&&o.zone!=='battlefield'));if(offboard.length){const tray=el('div',undefined,'board-pick-cards');for(const option of offboard){const found=findCard(getGame(),option.id);if(found){const card=renderCard(found.card);card.dataset.targetKey=option.key;tray.append(card);}}hud.append(el('p',draft.proxies?'Or attack a planeswalker:':'Choose a card from the '+offboard[0].zone+'.','panel-caption'),tray);}
  const chosen=el('div',undefined,'board-pick-selected');for(const option of selected()){const item=el('span',option.label+(draft.division?' · '+amounts[option.key]+' damage':''));chosen.append(item);}if(chosen.children.length)hud.append(chosen);
  const controls=el('div',undefined,'board-pick-controls');controls.append(button(draft.min===0&&!keys.length?'Choose no targets':'Confirm targets',confirm,'primary board-pick-control board-pick-confirm'));if(!draft.required)controls.append(button('Cancel',cancel,'board-pick-control'));controls.append(button('Clear',()=>{keys=[];amounts={};draft.onChange?.([],{});paint();},'board-pick-control'));hud.append(controls);
  for(const option of available){
   const nodes=option.kind==='card'?[...document.querySelectorAll('.card[data-card]')].filter(n=>n.dataset.card===option.id):[...document.querySelectorAll('[data-target-key]')].filter(n=>n.dataset.targetKey===option.key);
   if(option.kind==='player'){const heading=document.querySelector(`.player-mat[data-seat="${option.owner}"] .player-heading`);if(heading){heading.dataset.targetKey=option.key;nodes.push(heading);}}
   for(const node of nodes){node.classList.add('board-target-valid');node.classList.toggle('board-target-picked',keys.includes(option.key));}
  }
  for(const node of document.querySelectorAll('.card[data-card]'))if(node.dataset.card===draft.source?.instance)node.classList.add('board-target-source');
  if(!frame)frame=requestAnimationFrame(arrows);
 }
 function start(config){
  if(config.roles){const choices=[];const pick=index=>start({...config,id:config.id+':'+index,roles:undefined,min:config.roles[index].optional?0:1,max:1,title:config.title+' - '+config.roles[index].label,selected:config.roles[index].optional?(config.selected||[]).filter(key=>config.options().some(o=>o.key===key&&o.groups?.includes(index))).slice(0,1):config.selected?.[index]?[config.selected[index]]:[],options:()=>config.options().filter(o=>o.groups?.includes(index)),validate:undefined,onConfirm:keys=>{choices.push(keys[0]);if(index+1<config.roles.length)pick(index+1);else config.onConfirm(choices.filter(Boolean),{});}});return pick(0);}
  if(config.owner!==getSeat())return false;
  if(draft?.id===config.id){draft={...draft,...config};paint();return true;}
  stop();draft=config;keys=[...(config.selected||[])];amounts={...(config.amounts||{})};pointer=null;paint();return true;
 }
 function intercept(event){
  if(!draft||event.target.closest('.board-pick-control'))return;
  const candidate=event.target.closest('[data-target-key]'),card=event.target.closest('.card[data-card]'),key=candidate?.dataset.targetKey||card&&'card:'+card.dataset.card;
  if(!key)return;event.preventDefault();event.stopImmediatePropagation();
  if(!choose(key,event.type==='contextmenu'?-1:1)){if(!draft.onOtherCard?.(card?.dataset.card))setStatus('Choose a highlighted target.');}
 }
 document.addEventListener('click',intercept,true);document.addEventListener('contextmenu',intercept,true);
 document.addEventListener('pointermove',event=>{if(draft)pointer={x:event.clientX,y:event.clientY};},{passive:true});
 document.addEventListener('keydown',event=>{if(!draft||event.target.matches('input,textarea,select'))return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(!draft.required)cancel();}else if(event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();confirm();}else if(['t','f'].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();}},true);
 return {start,refresh:paint,stop,cancel,choose,get active(){return draft?.id||null;}};
}
