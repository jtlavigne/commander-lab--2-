import {turnController} from './game-outcome.mjs';
import {findCard} from './engine.mjs';
import {attackTargets,blockController,previewCombat,damageSources,assignmentFor,damagePhase} from './combat.mjs';
import {isCreature,summoningSick,attackError,mustAttack,blockError,exertAbility,attackTargetError} from './creature-rules.mjs';
import {triggerNeedsTarget,triggerTargetOptions} from './combat-effects.mjs';

import {effectTargetSpec} from './effect-targets.mjs';
import {combatGroups} from './board-interaction.mjs';

export function createCombatUI({getGame,getSeat,selectSeat,dispatch,setStatus,el,button,showStack,boardPicker,renderCard}){
 const root=el('section',undefined,'combat-panel camera-hud');root.id='combat-panel';root.setAttribute('aria-label','Combat declarations and damage preview');document.getElementById('table-viewport').append(root);
 const css=el('link');css.rel='stylesheet';css.href=new URL('./combat.css',import.meta.url).href;document.head.append(css);
 const arena=el('section',undefined,'combat-arena');arena.id='combat-arena';arena.setAttribute('aria-label','Combat groups for your seat');
 const scrim=el('div',undefined,'combat-focus-scrim');scrim.hidden=true;scrim.setAttribute('aria-hidden','true');document.getElementById('table-viewport').append(scrim);
 let selectedBlocker=null,pickedAttacker=null,projection=null;
 const hint=text=>el('p',text,'combat-hint');
 function select(values,value,change){const node=el('select');for(const [key,label] of values){const option=el('option',label);option.value=key;node.append(option);}node.value=value;node.onchange=()=>change(node.value);return node;}
 function selectingCard(id){const g=getGame(),f=findCard(g,id);return f?.zone==='battlefield'&&((g.step===5&&g.combat?.stage==='attackers'&&!g.combat.attackersConfirmed&&getSeat()===g.active)||(g.step===6&&g.combat?.defenders.some(seat=>blockController(g,seat)===getSeat()&&!g.combat.confirmedDefenders.includes(seat))));}
 function cardClick(id){
  if(!selectingCard(id))return false;const g=getGame(),c=g.combat,f=findCard(g,id);if(!f||!isCreature(f.card))return false;
  if(g.step===5){if(f.owner!==getSeat())return false;const error=attackError(g,f.owner,f.card);if(error){setStatus(error);return true;}pickAttacker(id);return true;}
  if(c.defenders.includes(f.owner)&&blockController(g,f.owner)===getSeat()&&!c.confirmedDefenders.includes(f.owner)){selectedBlocker=selectedBlocker===id?null:id;render();setStatus(selectedBlocker?'Click an attacking creature to assign this blocker.':'Blocker selection cleared.');return true;}
  if(selectedBlocker&&c.attackers.some(a=>a.id===id&&a.defender.owner===findCard(g,selectedBlocker)?.owner)){dispatch({type:'blocker',id:selectedBlocker,attacker:id,selected:!c.blocks.some(b=>b.blocker===selectedBlocker&&b.attacker===id)});return true;}return false;
 }
 function pickAttacker(id){
  const g=getGame(),found=findCard(g,id);if(found?.owner!==getSeat()||g.step!==5||g.combat?.attackersConfirmed||g.stack.length||g.pendingEffect||attackError(g,found.owner,found.card))return false;
  pickedAttacker=id;
  boardPicker.start({id:'attack:'+id,owner:getSeat(),title:found.card.name+' · Choose who to attack',source:found.card,proxies:true,min:1,max:1,options:()=>attackTargets(getGame()).filter(target=>!attackTargetError(getGame(),findCard(getGame(),id)?.card||found.card,target)),onConfirm:keys=>{pickedAttacker=null;dispatch({type:'attacker',id,target:keys[0],selected:true});},onOtherCard:other=>pickAttacker(other),onCancel:()=>{pickedAttacker=null;render();}});render();return true;
 }
 function arenaCard(card,{attack,eligible=false}={}){
  const g=getGame(),owner=getSeat(),wrap=el('div',undefined,'combat-arena-card'),node=renderCard(card);node.classList.remove('tapped');
  if(eligible||attack&&owner===g.active&&g.step===5&&!g.combat.attackersConfirmed){node.dataset.attacker=card.instance;node.checked=!!attack;node.disabled=!!attackError(g,owner,card)||!!g.stack.length||!!g.pendingEffect;node.setAttribute('aria-pressed',String(!!attack));node.onclick=()=>pickAttacker(card.instance);}
  else{node.onclick=()=>cardClick(card.instance);if(g.step===6){const found=findCard(g,card.instance),blocker=selectedBlocker&&findCard(g,selectedBlocker);node.disabled=!!g.stack.length||!!g.pendingEffect;if(attack&&blocker){const valid=!blockError(g,blocker.owner,blocker.card,card,attack.defender.owner);node.classList.toggle('combat-block-target',valid);node.disabled||=!valid;}else if(!attack&&found&&candidatesForBlocker(found).length===0)node.disabled=true;}}
  node.classList.toggle('combat-blocker-picked',card.instance===selectedBlocker||card.instance===pickedAttacker);wrap.append(node);
  const projected=projection?.creatures.find(c=>c.id===card.instance);if(projected){const outcome=el('span',projected.after?projected.after.remaining+' toughness left':projected.destination||'Leaves battlefield','combat-card-outcome');outcome.classList.toggle('lethal',!projected.after);wrap.append(outcome);}
  if(attack&&g.step===5&&!g.combat.attackersConfirmed&&owner===g.active){
   const remove=button('Remove',()=>dispatch({type:'attacker',id:card.instance,target:attack.defender.key,selected:false}),'combat-remove-attacker');remove.disabled=mustAttack(g,owner,card)||!!g.stack.length;wrap.append(remove);
   if(exertAbility(card)){const label=el('label','Exert'),check=el('input');check.type='checkbox';check.dataset.exert=card.instance;check.checked=!!attack.exert;check.disabled=!!g.stack.length||card.exertedTurn===g.turn+':'+g.active;check.onchange=()=>dispatch({type:'attacker',id:card.instance,target:attack.defender.key,selected:true,exert:check.checked});label.prepend(check);wrap.append(label);}
  }
  return wrap;
 }
 function candidatesForBlocker(found){const g=getGame();return (g.combat?.attackers||[]).filter(a=>a.defender.owner===found.owner&&findCard(g,a.id)&&!blockError(g,found.owner,found.card,findCard(g,a.id).card,found.owner));}
 function renderArena(){
  const g=getGame(),c=g.combat,owner=getSeat();arena.replaceChildren();arena.dataset.stage=String(g.step);arena.hidden=!c||g.step<5||g.step>8;if(arena.hidden)return;
  const declaring=g.step===5&&!c.attackersConfirmed,groups=combatGroups(g,owner);arena.append(el('h3',owner===g.active?(declaring?'Choose an attacker, then its defender':'Your attack'):'Attacking '+g.players[owner].name));
  if(owner===g.active&&declaring){const pool=el('div',undefined,'combat-arena-pool');for(const card of g.players[owner].zones.battlefield.filter(isCreature))if(!c.attackers.some(a=>a.id===card.instance))pool.append(arenaCard(card,{eligible:true}));if(pool.children.length)arena.append(pool);}
  const lanes=el('div',undefined,'combat-arena-lanes');for(const group of groups){const lane=el('section',undefined,'combat-arena-lane');lane.dataset.defender=group.key;lane.append(el('h4',group.defender.label||g.players[group.defender.owner].name));const cards=el('div',undefined,'combat-arena-cards');for(const attack of group.attackers){const found=findCard(g,attack.id);if(found){const item=arenaCard(found.card,{attack});for(const block of c.blocks.filter(b=>b.attacker===attack.id)){const blocker=findCard(g,block.blocker);if(blocker){const assigned=el('div',undefined,'combat-assigned-blocker'),visual=arenaCard(blocker.card);assigned.append(el('span','BLOCKING','combat-block-label'),visual);if(g.step===6&&blockController(g,blocker.owner)===owner&&!c.confirmedDefenders.includes(blocker.owner)){const remove=button('Remove block',()=>dispatch({type:'blocker',id:block.blocker,attacker:block.attacker,selected:false}),'combat-remove-block');remove.dataset.removeBlock=block.blocker;remove.disabled=!!g.stack.length||!!g.pendingEffect;assigned.append(remove);}item.append(assigned);} }cards.append(item);}}lane.append(cards);lanes.append(lane);}arena.append(lanes);
  if(!groups.length&&owner!==g.active)arena.append(hint('No creatures are attacking you.'));
  if(g.step===6)for(const defender of c.defenders.filter(seat=>blockController(g,seat)===owner&&!c.confirmedDefenders.includes(seat))){arena.append(el('h4','Choose a blocker, then an attacker'));const pool=el('div',undefined,'combat-arena-pool');for(const card of g.players[defender].zones.battlefield.filter(isCreature))pool.append(arenaCard(card));arena.append(pool);}
 }
 function decorateCard(node,card){
  const g=getGame(),f=findCard(g,card.instance);if(f?.zone!=='battlefield')return;
  if(summoningSick(g,f.owner,f.card)){node.classList.add('summoning-sick');node.setAttribute('data-summoning-sick','true');node.title=(node.title||card.name)+' · Summoning sickness';}
  if(g.combat?.attackers.some(a=>a.id===card.instance))node.classList.add('combat-attacker');if(g.combat?.blocks.some(b=>b.blocker===card.instance))node.classList.add('combat-blocker');if(selectedBlocker===card.instance)node.classList.add('combat-blocker-picked');
 }
 function render(){
  try{
  const g=getGame(),c=g.combat,owner=getSeat(),pending=triggerNeedsTarget(g),manual=g.pendingEffect?.kind==='combat-manual'?g.pendingEffect:null;
  const blocker=selectedBlocker&&findCard(g,selectedBlocker);if(blocker&&(g.step!==6||blockController(g,blocker.owner)!==owner||c?.confirmedDefenders.includes(blocker.owner))||selectedBlocker&&!blocker)selectedBlocker=null;
  projection=c&&[6,7].includes(g.step)?previewCombat(g):null;
  if(boardPicker.active?.startsWith('attack:')&&(owner!==g.active||g.step!==5||c?.attackersConfirmed||g.stack.length||g.pendingEffect)){boardPicker.stop();pickedAttacker=null;}
  if(boardPicker.active?.startsWith('trigger:')&&!pending)boardPicker.stop();renderArena();
  for(const card of document.querySelectorAll('.battlefield .card[data-card]'))card.classList.toggle('combat-blocker-picked',card.dataset.card===selectedBlocker);
  const inCombat=!!c&&g.step>=4&&g.step<=8,focused=inCombat||!!pending||!!manual;
  root.classList.toggle('combat-focus',focused);scrim.hidden=!focused;root.replaceChildren();
  const header=el('div',undefined,'combat-panel-heading');
  if(!focused){arena.hidden=true;root.append(header,arena);if(owner===g.active&&(g.step===3||g.step===9))header.append(button('Begin combat',()=>dispatch({type:'step',step:4})));else header.append(el('span','Combat begins during the active player?s turn.','combat-hint'));return;}
  const stageNames={4:'Beginning of combat',5:c?.attackersConfirmed?'Attackers declared':'Declare attackers',6:c?.stage==='blockers'?'Declare blockers':'Review combat damage',7:damagePhase(g)==='first'?'First-strike damage':'Combat damage',8:'End of combat'};
  header.append(el('h2',pending?'Choose targets':manual?'Resolve effect':stageNames[g.step]||'Combat'));
  if(inCombat){const progress=el('nav',undefined,'combat-progress');progress.setAttribute('aria-label','Combat progress');for(const [step,label] of [[5,'Attack'],[6,'Block'],[7,'Damage']]){const item=el('span',label);if(g.step===step)item.setAttribute('aria-current','step');progress.append(item);}header.append(progress);}
  if(g.stack.length)header.append(button('Responses ? '+g.stack.length,showStack));root.append(header);
  if(pending||manual)arena.hidden=true;root.append(arena);
  const body=el('div',undefined,'combat-panel-body');root.append(body);
  if(pending&&Number.isInteger(g.networkSeat)&&pending.owner!==g.networkSeat){body.append(hint('Waiting for '+g.players[pending.owner].name+' to choose targets.'));return;}if(manual&&Number.isInteger(g.networkSeat)&&manual.owner!==g.networkSeat)return;if(pending){body.append(el('strong',pending.name+' · Choose targets on the table'),hint(pending.text));const spec=effectTargetSpec(pending.text);
   if(owner!==pending.owner)body.append(button('Control '+g.players[pending.owner].name,()=>selectSeat(pending.owner)));else boardPicker.start({id:'trigger:'+pending.id,owner,source:pending.source,title:pending.name+' · Choose targets',required:true,min:spec.optional?0:1,max:spec.max||1,options:()=>{const entry=getGame().stack.find(e=>e.id===pending.id);return entry?triggerTargetOptions(getGame(),entry):[];},validate:keys=>{if(!spec.perOpponent)return '';const entry=getGame().stack.find(e=>e.id===pending.id),available=entry?triggerTargetOptions(getGame(),entry):[];return new Set(keys.map(key=>available.find(t=>t.key===key)?.owner)).size===keys.length?'':'Choose at most one creature for each opponent.';},onConfirm:keys=>dispatch({type:'triggerTarget',id:pending.id,keys})});return;}
  if(manual){body.append(el('strong',manual.name+' · Effect to resolve'),hint(manual.text),hint('Use the table controls for this effect, then acknowledge it to continue.'));body.append(button('Effect resolved',()=>dispatch({type:'manualResolved'})));return;}
  if(!c||g.step<4||g.step>8){body.append(hint('Declare attackers, assign defenders, confirm each defending seat’s blockers, then verify damage.'));const begin=button('Begin combat',()=>dispatch({type:'step',step:4}));begin.disabled=owner!==g.active||g.stack.length>0;body.append(begin);return;}
  const blocked=g.stack.length>0||!!g.pendingEffect;body.append(hint(g.players[g.active].name+' is attacking. '+(blocked?'Resolve the stack before continuing.':'')));
  if(g.step===4){body.append(hint('Beginning-of-combat triggers use the stack.'));const next=button('Choose attackers →',()=>dispatch({type:'advance'}));next.id='combat-to-attackers';next.disabled=blocked||Number.isInteger(g.networkSeat)&&owner!==turnController(g);body.append(next);return;}
  if(g.step===5&&!c.attackersConfirmed){
   if(owner!==g.active)body.append(button('Control '+g.players[g.active].name,()=>selectSeat(g.active)));
   body.append(hint('Click a creature on the table or combat overlay, then click the highlighted player or planeswalker. Assigned attackers are grouped by defender.'));
   const all=button('Select all eligible',()=>dispatch({type:'attackAll'}));all.disabled=owner!==g.active||blocked;
   const confirm=button('Confirm attackers · '+c.attackers.length,()=>dispatch({type:'confirmAttackers'}),'primary');confirm.id='combat-confirm-attackers';confirm.disabled=owner!==g.active||blocked||!!pickedAttacker;body.append(all,confirm);return;
  }
  if(g.step===5){const next=button('Declare blockers →',()=>dispatch({type:'advance'}));next.id='combat-to-blockers';next.disabled=blocked||Number.isInteger(g.networkSeat)&&owner!==turnController(g);body.append(next);return;}
  if(g.step===6&&c.stage==='blockers'){
   for(const defender of c.defenders)body.append(button(g.players[defender].name+(c.confirmedDefenders.includes(defender)?' · confirmed':' · blockers'),()=>selectSeat(blockController(g,defender))));
   for(const defender of c.defenders.filter(seat=>blockController(g,seat)===owner&&!c.confirmedDefenders.includes(seat))){
    body.append(hint(selectedBlocker?'Choose a highlighted attacker for this blocker. Click an existing assignment to remove it.':'Choose a blocker card, then the attacker it will block. You can assign several blockers to one attacker.'));
    const confirm=button('Confirm '+g.players[defender].name+'’s blockers',()=>dispatch({type:'confirmBlockers',defender}),'primary');confirm.id=defender===c.defenders.find(seat=>blockController(g,seat)===owner&&!c.confirmedDefenders.includes(seat))?'combat-confirm-blockers':'combat-confirm-blockers-'+defender;confirm.dataset.defender=defender;confirm.disabled=blocked;body.append(confirm);
   }if(!c.defenders.some(seat=>blockController(g,seat)===owner))body.append(hint('Select an attacked seat to declare its blockers.'));
  }
  if([6,7].includes(g.step)){
   const preview=projection,visibleAttacks=new Set(combatGroups(g,owner).flatMap(group=>group.attackers.map(a=>a.id))),visibleCards=new Set([...visibleAttacks,...c.blocks.filter(b=>visibleAttacks.has(b.attacker)).map(b=>b.blocker)]),section=el('section',undefined,'combat-preview');section.id='combat-preview';section.append(el('h3','Projected combat damage'));if(preview.error)section.append(hint(preview.error));
   for(const p of preview.players.filter(p=>owner===g.active||p.owner===owner))section.append(hint(p.name+': '+p.before+' → '+p.after+' life'+(p.poison?' · +'+p.poison+' poison':'')));
   for(const p of preview.planeswalkers.filter(p=>owner===g.active||p.owner===owner))section.append(hint(p.name+': '+p.before+' → '+p.after+' loyalty'+(p.destination?' · '+p.destination:'')));
   for(const creature of preview.creatures.filter(p=>visibleCards.has(p.id))){const item=el('div',undefined,'combat-preview-creature');item.dataset.previewCard=creature.id;item.append(hint(creature.name+': '+(creature.after?creature.after.remaining+'/'+creature.after.toughness+' toughness remaining · '+creature.after.damage+' damage marked':creature.destination)));
    if(creature.options.length>1)item.append(select(creature.options.map(o=>[o.zone,o.zone+' · '+o.reason]),c.deathChoices[creature.id]||creature.options[0].zone,value=>dispatch({type:'deathChoice',id:creature.id,zone:value})));section.append(item);
   }section.append(hint('Preview uses current stats. Resolve triggers and responses before applying damage.'));body.append(section);
   if(['review','damage'].includes(c.stage)&&!c.normalDone){
    for(const source of damageSources(g)){if(source.targets.length<2||source.owner!==owner||!Number.isFinite(source.power))continue;const group=el('div',undefined,'combat-assignment');group.dataset.assignment=source.id;group.append(hint(source.card.name+' · assign '+Math.max(0,source.power)+' damage'));const current=assignmentFor(g,source);for(const target of source.targets){const key=target.kind==='player'?'player:'+target.owner:'card:'+target.id,label=el('label',target.label),input=el('input');input.type='number';input.min=0;input.max=Math.max(0,source.power);input.step=1;input.value=current.find(a=>a.target===key)?.amount||0;input.dataset.damageTarget=key;input.setAttribute('aria-label',source.card.name+' damage to '+target.label);label.append(input);group.append(label);}group.append(button('Save damage assignment',()=>dispatch({type:'damageAssignment',id:source.id,assignments:[...group.querySelectorAll('input')].map(i=>({target:i.dataset.damageTarget,amount:Number(i.value)}))})));body.append(group);}
    if(g.step===6){const next=button('Verified · move to damage →',()=>dispatch({type:'advance'}),'primary');next.id='combat-to-damage';next.disabled=blocked||Number.isInteger(g.networkSeat)&&owner!==turnController(g)||!!preview.error||c.defenders.some(o=>!c.confirmedDefenders.includes(o));body.append(next);}
    else{const apply=button('Apply '+(damagePhase(g)==='first'?'first-strike':'normal')+' damage',()=>dispatch({type:'damage'}),'primary');apply.id='combat-apply-damage';apply.disabled=blocked||!!preview.error||Number.isInteger(g.networkSeat)&&owner!==turnController(g);body.append(apply);}
   }
  }
  if(c.normalDone){body.append(hint('Combat damage applied. Marked creature damage lasts until cleanup.'));const next=button('End combat →',()=>dispatch({type:'step',step:8}));next.id='combat-end';next.disabled=blocked||Number.isInteger(g.networkSeat)&&owner!==turnController(g);body.append(next);}
  }finally{
   const body=root.querySelector('.combat-panel-body');
   if(body){const actions=el('div',undefined,'combat-focus-actions');for(const child of [...body.children])if(child.tagName==='BUTTON')actions.append(child);if(actions.children.length)root.append(actions);body.hidden=!body.children.length;}
  }
 }
 return {render,decorateCard,cardClick,selectingCard};
}
