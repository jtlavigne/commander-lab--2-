import {counterCostPayment,payCounterCost} from './counter-costs.mjs';
import {permanentCounterEvent,playerCounterEvent} from './counter-effects.mjs';
import {offeredCast} from './permission-effects.mjs';
import {consumeGravePermission} from './grave-casting.mjs';
import {finishResolutionTriggers} from './trigger-rules.mjs';
import {findCard,transfer,note} from './engine.mjs';
import {cardFace} from './card-state.mjs';
import {wantsResponse} from './response-settings.mjs';
import {manaAbilities,activatedAbilities,activationError,productionChoices,produceMana,payMana,paymentPlan,spellPayment,availableSpellPayment,parseProduction,sacrificeOptions} from './mana.mjs';
import {activateLoyaltyCost,getLoyaltyAbility,loyaltyStatus,availableLoyaltyAbilities,applyLoyaltyPermission} from './planeswalker.mjs';
import {landPlayError} from './lands.mjs';
import {pendingEntry,payLife} from './life-effects.mjs';
import {triggerNeedsTarget,resolveCombatTrigger,queueCombatTriggers,snapshotCard,triggerOrderGroup,confirmTriggerOrder,closeTriggerOrders} from './combat-effects.mjs';
import {stateBasedActions,removePermanents} from './combat.mjs';
import {enterPermanents,applyOracleEffect,applyCounterEvents,continueOracleCast} from './oracle-effects.mjs';
import {combatStats} from './creature-rules.mjs';
import {spellAnnouncement,currentSpellTargets,spellHasLegalChoices,spellModes} from './spell-effects.mjs';
import {effectTargetSpec,effectTargetOptions,groupedTargets} from './effect-targets.mjs';
import {crewCostError} from './vehicles.mjs';
import {actionRestriction} from './action-permissions.mjs';
import {spellRestriction,castingPermission,castingController,grantedFlash} from './spell-rules.mjs';
import {recordPlay} from './play-events.mjs';
import {liveSeats,nextLivingSeat} from './game-outcome.mjs';
import {playerCounters,addPlayerCounter} from './player-counters.mjs';
import {isAura} from './attachments.mjs';

export function prioritySeat(g){const seat=triggerOrderGroup(g)?.owner??(g.stack.length?(g.priority?.seat??g.stack.at(-1).owner):g.active);return g.players[seat]?.eliminated?nextLivingSeat(g,seat):seat;}
export function resetPriority(g,owner){if(g.result){delete g.priority;return;}g.priority={seat:g.players[owner].eliminated?nextLivingSeat(g,owner):owner,passes:0};}
export function castingTiming(g,owner,card){
 if(g.result)return 'This game has ended.';
 const restriction=actionRestriction(g,owner,'cast',card);if(restriction)return restriction;
 const printedRestriction=spellRestriction(g,owner,card);if(printedRestriction)return printedRestriction;
 const duringResolution=offeredCast(g.pendingEffect,card)&&g.pendingEffect.owner===owner;
 if(!duringResolution&&triggerOrderGroup(g))return 'Confirm simultaneous trigger order first.';
 if(!duringResolution&&triggerNeedsTarget(g))return 'Choose the triggered ability’s target first.';
 if(pendingEntry(g))return 'Finish the entering land’s life payment choice first.';
 if(g.pendingEffect&&!duringResolution)return 'Finish the pending effect first.';
 if(g.step===0)return 'Advance to upkeep before casting spells.';
 const face=cardFace(card),instant=/\bInstant\b/.test(face.type_line||'')||/(?:^|\n)Flash\b/.test(face.oracle_text||'')||grantedFlash(g,owner,card);
 if(!duringResolution&&g.stack.length&&prioritySeat(g)!==owner)return 'Another player has priority.';
 if(!duringResolution&&!instant&&(g.stack.length||g.active!==owner||![3,9].includes(g.step)))return 'Cast this during your main phase with an empty stack.';
 return '';
}
export function castSpell(g,id,options={}){
 const found=findCard(g,id);if(!found)throw Error('Card not found.');
 const owner=castingController(g,found),{zone}=found,card=options.face===undefined?found.card:{...found.card,face:options.face};
 if(options.face!==undefined&&(!['split','modal_dfc'].includes(card.layout)||!Number.isInteger(options.face)||!card.card_faces?.[options.face]))throw Error('Choose a castable card face.');
 const permission=castingPermission(g,owner,card,zone,options);if(!permission)throw Error('No permission to cast this card from its current zone.');
 if(permission.free&&options.x)throw Error('X must be zero when casting without paying the mana cost.');
 const timing=castingTiming(g,owner,card);if(timing)throw Error(timing);
 const announcement=spellAnnouncement(g,owner,card,options);
 const payment=spellPayment(g,owner,card,zone,options);if(!payment)throw Error('You cannot pay this spell’s mana cost.');
 const spentColors=[...new Set((g.players[owner].mana||[]).filter((lot,i)=>payment.spent[i]>0&&lot.type!=='C').map(lot=>lot.type))];
 const spentScry=(g.players[owner].mana||[]).flatMap((lot,i)=>lot.spendScry&&payment.spent[i]?[{kind:'spent-mana',owner,card:snapshotCard(card),source:lot.spendScry.source,amount:payment.spent[i]}]:[]);
 const castChoice=permission.duringResolution?g.pendingEffect:null;if(castChoice)delete g.pendingEffect;
 consumeGravePermission(g,owner,permission);
 const resolving=g.resolutionInProgress;g.resolutionInProgress=true;
 for(const id of payment.escaped||[])transfer(g,id,'exile',owner);
 for(const id of payment.delved||[])transfer(g,id,'exile',owner);
 for(const id of payment.discarded||[])transfer(g,id,'graveyard',owner);
 const player=g.players[owner];player.mana=(player.mana||[]).map((lot,i)=>({...lot,amount:lot.amount-payment.spent[i]})).filter(lot=>lot.amount>0);player.life-=payment.life;
 if(payment.sacrificed.length)removePermanents(g,payment.sacrificed,{sacrifice:true});
 found.card.face=card.face||0;
 found.card.castKicks=options.kicks||0;
 transfer(g,id,'stack',owner);const entry=g.stack.at(-1);delete entry.manualPlacement;entry.buyback=!!options.buyback;entry.castX=options.x||0;entry.castStep=g.step;entry.castFrom=zone;Object.assign(entry,announcement);
 entry.castPayment={phyrexianLife:payment.phyrexianLife,colors:spentColors};
 if(permission.flashback)entry.flashback=true;
 if(permission.graveyardExile)entry.graveyardExile=true;
 recordPlay(g,{owner,source:entry.card,text:entry.spellText,targets:entry.targets,stackId:entry.card.instance});
 const targeted=(entry.targets||[]).filter(t=>t.kind==='card'&&t.zone==='battlefield').flatMap(t=>{const found=findCard(g,t.id);return found?[{kind:'targeted-spell',owner:found.owner,card:snapshotCard(found.card),spellOwner:owner,spellCard:snapshotCard(card)}]:[];});
 queueCombatTriggers(g,[{kind:'cast',owner,card:snapshotCard(card),x:options.x||0,spell:{...structuredClone({...entry,card:undefined}),card:snapshotCard(entry.card)}},...spentScry,...targeted]);
 if(castChoice)continueOracleCast(g,castChoice);
 else if(!resolving){stateBasedActions(g);finishResolutionTriggers(g);}
 note(g,g.players[owner].name+' casts '+card.name+'.'+(payment.life?' Pays '+payment.life+' life.':''));settlePriority(g);return entry;
}
export function activateMana(g,id,abilityId,choice={}){
 if(triggerOrderGroup(g))throw Error('Confirm simultaneous trigger order first.');
 if(triggerNeedsTarget(g))throw Error('Choose the triggered ability’s target first.');
 const found=findCard(g,id);if(!found||!['battlefield','hand'].includes(found.zone))throw Error('Use a source on the battlefield or a cycling card in hand.');
 const {card,owner}=found;let ability=activatedAbilities(g,owner,card).find(a=>a.id===abilityId);if(!ability)throw Error('Ability not found.');
 if(ability.modes){if(!Number.isInteger(choice.mode)||!ability.modes[choice.mode])throw Error('Choose an ability mode before paying costs.');ability={...ability,text:ability.modes[choice.mode],mode:choice.mode};}
 if(found.zone==='hand'&&!ability.cycling&&!ability.handOnly||found.zone==='battlefield'&&(ability.cycling||ability.handOnly))throw Error('Use this discard ability from your hand.');
 const unavailable=activationError(g,owner,card,ability,{allowLife:choice.allowLife===true,x:choice.x||0,spend:choice.spend});if(unavailable)throw Error(unavailable);
 if(ability.crew!==undefined){const error=crewCostError(g,owner,card,ability.crew,choice.crewIds||[]);if(error)throw Error(error);}
 const targetSpec=effectTargetSpec(ability.text);let announced;
 if(targetSpec&&(targetSpec.sameGraveyard||ability.modes||ability.handOnly||choice.targets!==undefined)){
  const keys=choice.targets,available=effectTargetOptions(g,{owner,source:card,text:ability.text});
  if(!Array.isArray(keys)||new Set(keys).size!==keys.length||keys.length>(targetSpec.max||1)||keys.length<(targetSpec.optional?0:targetSpec.min||1))throw Error('Choose the ability targets before paying costs.');
  announced=keys.map(key=>available.find(t=>t.key===key));if(announced.some(t=>!t)||targetSpec.sameGraveyard&&new Set(announced.map(t=>t.owner)).size>1)throw Error('Choose legal ability targets.');announced=groupedTargets(targetSpec,announced,owner);
 }
 const sacrificed=ability.sacrificeType?sacrificeOptions(g,owner,ability,card).find(c=>c.instance===choice.sacrificeId):null;if(ability.sacrificeType&&!sacrificed)throw Error('Choose an eligible permanent to sacrifice.');
 const discards=choice.discardIds||[];if(ability.discardCount&&(!Array.isArray(discards)||discards.length!==ability.discardCount||new Set(discards).size!==discards.length||discards.some(id=>!g.players[owner].zones.hand.some(c=>c.instance===id))))throw Error('Choose the cards to discard as a cost.');
 const sacrificedPower=sacrificed?combatStats(g,owner,sacrificed)?.power:undefined;
 if(/sacrificed creature's power/i.test(ability.text)&&typeof sacrificedPower!=='number')throw Error('Set the sacrificed creature’s power first.');
 if(g.stack.length&&prioritySeat(g)!==owner&&!(g.pendingEffect?.kind==='oracle-choice'&&['optionalPay','castOffered','castExiled'].includes(g.pendingEffect.step.op)&&g.pendingEffect.owner===owner))throw Error('Another player has priority.');
 const counts=ability.output?productionChoices(g,owner,card,ability.output,choice):{};
 if(ability.manualCost&&!choice.costsConfirmed)throw Error('Confirm the other activation costs first.');
 const countersPaid=ability.counterRemoval?counterCostPayment(g,owner,card,ability.counterRemoval,choice.counterPayments):[];
 const beforeMana=structuredClone(g.players[owner].mana||[]),beforeLife=g.players[owner].life,payment=ability.manaCost?payMana(g.players[owner],card,ability.manaCost,{ability:true,x:choice.x||0,allowLife:choice.allowLife===true,spend:choice.spend}):null;
 if(ability.lifeCost)payLife(g.players[owner],ability.lifeCost);
 payCounterCost(g,owner,countersPaid);
 if(ability.counterCost){card.counters[ability.counterCost.kind]-=ability.counterCost.amount;if(!card.counters[ability.counterCost.kind])delete card.counters[ability.counterCost.kind];}
 if(/Activate only once each turn\./i.test(ability.text)){if(card.abilityUses?.turn!==g.turn+':'+g.active)card.abilityUses={turn:g.turn+':'+g.active,ids:[]};card.abilityUses.ids.push(ability.id);}
 if(ability.tap){card.tapped=true;if(ability.usesStack)card.tapAbility=true;}
 if(ability.untap){card.tapped=false;delete card.manaActivation;delete card.tapAbility;}
 if(ability.crew!==undefined)for(const id of choice.crewIds||[]){const creature=g.players[owner].zones.battlefield.find(c=>c.instance===id);creature.tapped=true;creature.tapAbility=true;}
 if(ability.exertSelf){card.skipNextUntap=true;card.exertedTurn=g.turn+':'+g.active;}
 const source=snapshotCard(card),stackSize=g.stack.length;
 if(ability.sacrifice)removePermanents(g,[id],{sacrifice:true});
 if(sacrificed)removePermanents(g,[sacrificed.instance],{sacrifice:true});if(ability.exileSelf)transfer(g,id,'exile',owner);
 if(ability.discardSelf)transfer(g,id,'graveyard',owner);
 if(ability.discardCount)for(const id of discards)transfer(g,id,'graveyard',owner);
 const costTriggers=g.stack.splice(stackSize);
 if(ability.usesStack){const entry={kind:ability.output?'mana':'ability',id:'ability-'+crypto.randomUUID(),owner,name:card.name,text:ability.text,source,ability,counts,sacrificedPower,castX:choice.x||0,...(!ability.output?{combatTrigger:{event:{kind:'activate',owner,card:source},...(announced?{target:announced[0],targets:announced,targetsChosen:true}:{})}}:{})};g.stack.push(entry);if(!ability.output&&(!effectTargetSpec(ability.text)||announced))recordPlay(g,{kind:'ability',owner,source,text:ability.text,targets:announced,stackId:entry.id});resetPriority(g,owner);}
 else{const activationId='tap-'+crypto.randomUUID();produceMana(g,owner,source,{...ability,output:{...ability.output,fixed:counts,variable:false,alternatives:null,manual:false,colors:null}},{...choice,activationId});if(ability.tap&&!ability.sacrifice)card.manaActivation={id:activationId,owner,spent:beforeMana.map((lot,i)=>({...lot,amount:payment?.spent[i]||0})).filter(lot=>lot.amount>0),produced:structuredClone(g.players[owner].mana.filter(lot=>lot.activationId===activationId)),lifePaid:beforeLife-g.players[owner].life};if(g.stack.length)resetPriority(g,owner);}
 g.stack.push(...costTriggers);if(ability.cycling)queueCombatTriggers(g,[{kind:'cycle',owner,card:source,x:choice.x||0}]);if(ability.tap&&ability.output&&!ability.usesStack)queueCombatTriggers(g,[{kind:'tap-mana',owner,card:source}]);if(!g.pendingEffect)stateBasedActions(g);note(g,g.players[owner].name+' activates '+card.name+': '+ability.text);if(ability.usesStack||g.stack.length)settlePriority(g);return ability;
}
// A loyalty cost is paid before response priority. Positive costs use the same
// saved replacement choices as counter effects, with cause='cost' so Doubling
// Season alone cannot multiply them. The ability remains on the stack while
// its controller orders replacements; this is not resolution of the ability.
function finishLoyaltyCost(g,card,entry,delta){
 g.stack.push(entry);resetPriority(g,entry.owner);
 if(delta>0)applyCounterEvents(g,entry,[permanentCounterEvent(g,entry.owner,card.instance,{loyalty:delta},'cost')]);
 else stateBasedActions(g);
 settlePriority(g);
}
export function activateManaLoyalty(g,id,index,x=0,choice={}){
 if(triggerOrderGroup(g))throw Error('Confirm simultaneous trigger order first.');
 const found=findCard(g,id);if(found?.zone!=='battlefield')throw Error('Planeswalker not found.');
 const {card,owner}=found,selected=getLoyaltyAbility(g,owner,card,index),output=selected&&parseProduction(selected.text);if(!output)throw Error('This loyalty ability does not produce mana.');
 const counts=productionChoices(g,owner,card,output,choice),source={instance:id,name:card.name,type_line:cardFace(card).type_line||''};
 const {ability,delta}=activateLoyaltyCost(g,owner,card,index,x,{deferPositive:true});
 const entry={kind:'mana',id:'mana-'+crypto.randomUUID(),owner,name:card.name+' '+ability.label,text:ability.text,source,ability:{text:ability.text,tap:false,output},counts};note(g,'Activated '+card.name+' '+ability.label+'. Mana is added when the ability resolves.');finishLoyaltyCost(g,card,entry,delta);
}
export function activateLoyaltyAction(g,id,ref,x=0){
 if(triggerOrderGroup(g))throw Error('Confirm simultaneous trigger order first.');
 const found=findCard(g,id);if(found?.zone!=='battlefield')throw Error('Planeswalker not found.');
 const {card,owner}=found,selected=getLoyaltyAbility(g,owner,card,ref);if(!selected)throw Error('Loyalty ability no longer available.');if(parseProduction(selected.text))throw Error('Choose the mana this loyalty ability produces.');
 const {ability,delta}=activateLoyaltyCost(g,owner,card,ref,x,{deferPositive:true}),source=snapshotCard(card),entry={kind:'ability',id:'loyalty-'+crypto.randomUUID(),owner,name:card.name+' '+ability.label,text:ability.text,source,ability:{text:ability.text,tap:false,output:null},counts:{},castX:x,combatTrigger:{event:{kind:'activate',owner,card:source}}};
 if(!effectTargetSpec(ability.text))recordPlay(g,{kind:'ability',owner,source,text:ability.text,stackId:entry.id});note(g,'Activated '+card.name+' '+ability.label+(ability.grantedBy?' (granted by '+ability.grantedBy+')':'')+'.');finishLoyaltyCost(g,card,entry,delta);
}
export function resolveTop(g){
 if(pendingEntry(g))throw Error('Finish the entering land’s life payment choice first.');
 if(g.pendingEffect)throw Error('Finish the pending effect first.');
 const entry=g.stack.at(-1);if(!entry)return null;
 // The local manual Resolve action accepts the displayed default order.
 // Automatic priority never makes that choice on a player's behalf.
 closeTriggerOrders(g);
 if(entry.kind==='ability'){
  if(entry.combatTrigger&&triggerNeedsTarget(g)?.id===entry.id)throw Error('Choose the triggered ability’s target first.');
  g.stack.pop();if(entry.combatTrigger){let applied=resolveCombatTrigger(g,entry);if(!applied)applied=applyLoyaltyPermission(g,entry.owner,entry.text);if(!applied&&/^Proliferate\b/i.test(entry.text)){g.pendingEffect={kind:'proliferate',owner:entry.owner,name:entry.name};applied=true;}if(!applied)g.pendingEffect={kind:'combat-manual',owner:entry.owner,name:entry.name,text:entry.text};else if(!g.pendingEffect)stateBasedActions(g);note(g,entry.name+(applied?' ability resolved.':' · resolve the displayed effect manually.'));}
  else{const applied=applyOracleEffect(g,entry)||applyLoyaltyPermission(g,entry.owner,entry.text);if(!applied&&/^Proliferate\b/i.test(entry.text))g.pendingEffect={kind:'proliferate',owner:entry.owner,name:entry.name};if(!applied&&!g.pendingEffect)g.pendingEffect={kind:'combat-manual',owner:entry.owner,name:entry.name,text:entry.text};note(g,entry.name+' resolves: '+entry.text);}
 }else if(entry.kind==='mana'){
  produceMana(g,entry.owner,entry.source,{...entry.ability,output:{...entry.ability.output,fixed:entry.counts,variable:false,alternatives:null,manual:false,colors:null}},{extraColor:entry.extraColor});g.stack.pop();note(g,entry.name+' resolves: mana added.');
 }else{
  const face=cardFace(entry.card),text=entry.spellText??face.oracle_text??'',to=/\b(?:Instant|Sorcery)\b/.test(face.type_line||'')?'graveyard':'battlefield';
  if(to==='battlefield'){
   const target=isAura(entry.card)?currentSpellTargets(g,entry)[0]:null;
   if(isAura(entry.card)&&!target){transfer(g,entry.card.instance,'graveyard',entry.card.ownerSeat??entry.owner);note(g,entry.card.name+' does not resolve: its Aura target is illegal.');}
   else enterPermanents(g,entry,[{id:entry.card.instance,owner:entry.owner,...(target?{attachTo:target.id}:{})}]);
  }
  else{
   const spec=effectTargetSpec(text,{x:entry.castX,kicks:entry.card.castKicks}),targets=spec?currentSpellTargets(g,entry):[];
   if(spec&&entry.targets?.length&&!targets.length){transfer(g,entry.card.instance,'graveyard',entry.card.ownerSeat??entry.owner);note(g,entry.card.name+' does not resolve: all targets are illegal.');}
   else{
    if(spec&&entry.targets!==undefined)entry.targets=targets;
    entry.resolving=true;
    const applied=(!spec||entry.targets!==undefined)&&applyOracleEffect(g,entry,text);
    if(!applied){delete entry.resolving;const permission=applyLoyaltyPermission(g,entry.owner,text);transfer(g,entry.card.instance,'graveyard',entry.card.ownerSeat??entry.owner);if(text&&!permission)g.pendingEffect={kind:'combat-manual',owner:entry.owner,name:entry.card.name,text};}
   }
  }
  note(g,entry.card.name+(g.pendingEffect?' · finish its resolution.':' leaves the stack → '+to+'.'));
 }
 if(!g.pendingEffect)stateBasedActions(g);if(g.stack.length)resetPriority(g,g.active);else delete g.priority;return entry;
}
export function counterTop(g){
 if(triggerNeedsTarget(g)||g.pendingEffect||pendingEntry(g))throw Error('Finish pending choices first.');
 const entry=g.stack.at(-1);if(!entry)return null;
 if(entry.card&&/This spell can't be countered\./i.test(cardFace(entry.card).oracle_text||''))throw Error('This spell cannot be countered.');
 closeTriggerOrders(g);
 if(entry.card)transfer(g,entry.card.instance,'graveyard',entry.card.ownerSeat??entry.owner);else g.stack.pop();
 if(g.stack.length)resetPriority(g,g.active);else delete g.priority;note(g,'Countered '+(entry.name||entry.card.name)+'.');return entry;
}
export function passPriority(g,owner){
 if(g.pendingEffect)throw Error('Finish the pending effect before passing priority.');
 if(triggerNeedsTarget(g))throw Error('Choose the triggered ability’s target first.');
 if(pendingEntry(g))throw Error('Finish the entering land’s life payment choice first.');
 if(triggerOrderGroup(g)){confirmTriggerOrder(g,owner);resetPriority(g,g.active);return settlePriority(g);}
 if(!g.stack.length)throw Error('The stack is empty.');if(owner!==prioritySeat(g))throw Error('Another player has priority.');
 g.priority??={seat:owner,passes:0};g.priority.passes++;note(g,g.players[owner].name+' passes priority.');
 if(g.priority.passes===liveSeats(g).length){const resolved=resolveTop(g);settlePriority(g);return resolved;}
 g.priority.seat=nextLivingSeat(g,owner);return settlePriority(g);
}
// Conservative availability check: unknown conditions hold priority instead of
// silently skipping a legal action. Private card names never appear in prompts.
export function castableSpellPayment(g,owner,card,zone,options={}){
 options={allowLife:true,...options};
 const modes=spellModes(card,g,owner),choices=options.mode!==undefined?[options]:modes.length?modes.map((_,mode)=>({...options,mode})):[options];
 for(const choice of choices)if(spellHasLegalChoices(g,owner,card,choice)){const result=availableSpellPayment(g,owner,card,zone,choice);if(result)return {...result,mode:choice.mode};}return null;
}
export function canRespond(g,owner,{includeMain=false}={}){
 if(pendingEntry(g)||g.players[owner].eliminated)return false;
 const specialCards=g.players[owner].zones.battlefield.filter(c=>c.manifested&&c.faceDown).map(c=>cardFace({...c,manifested:false,faceDown:false,face:0})).filter(c=>/\bCreature\b/.test(c.type_line||'')&&c.mana_cost);
 const canTurnUp=game=>specialCards.some(c=>paymentPlan(game.players[owner],c,c.mana_cost,{ability:true}));if(canTurnUp(g))return true;
 const player=g.players[owner],main=includeMain&&owner===g.active&&[3,9].includes(g.step)&&!g.stack.length;
 if(main&&[...player.zones.hand,...player.zones.exile.filter(c=>castingPermission(g,owner,c,'exile')),...player.zones.graveyard.filter(c=>castingPermission(g,owner,c,'graveyard'))].some(c=>/\bLand\b/.test(cardFace(c).type_line||'')))if(!landPlayError(g,owner))return true;
 if(main&&[...player.zones.hand,...player.zones.command].some(c=>!c.faceDown&&!/\bLand\b/.test(cardFace(c).type_line||'')&&cardFace(c).mana_cost===undefined))return true;
 if(player.zones.battlefield.some(card=>{const status=loyaltyStatus(g,owner,card);return (status.instant||main)&&!status.reason&&availableLoyaltyAbilities(g,owner,card).some(a=>a.variable||a.delta>=0||(card.counters?.loyalty||0)>=-a.delta);}))return true;
 if(player.zones.battlefield.some(c=>!c.faceDown&&/may cast|as though.*flash|spells.*have flash/i.test(cardFace(c).oracle_text||'')))return true;
 const playable=[...player.zones.hand,...player.zones.command,...player.zones.graveyard.filter(c=>castingPermission(g,owner,c,'graveyard')),...player.zones.exile.filter(c=>castingPermission(g,owner,c,'exile'))];
 const responseZone=c=>player.zones.hand.includes(c)?'hand':player.zones.command.includes(c)?'command':player.zones.graveyard.includes(c)?'graveyard':'exile';
 const responses=playable.filter(c=>!c.faceDown&&!actionRestriction(g,owner,'cast',c)&&!spellRestriction(g,owner,c)&&spellHasLegalChoices(g,owner,c)&&(main&&!/\bLand\b/.test(cardFace(c).type_line||'')||/\bInstant\b/.test(cardFace(c).type_line||'')||/(?:^|\n)Flash\b/.test(cardFace(c).oracle_text||'')));
 if(responses.some(card=>castableSpellPayment(g,owner,card,responseZone(card),{allowLife:true,allowRestricted:true})))return true;
 const actions=['battlefield','hand'].flatMap(zone=>player.zones[zone].filter(c=>!c.faceDown).flatMap(card=>activatedAbilities(g,owner,card).filter(a=>(zone==='hand'?a.cycling||a.handOnly:!a.cycling&&!a.handOnly)&&a.usesStack&&(main||!/Activate only as a sorcery/i.test(a.text))&&(!a.tap||!card.tapped)).map(ability=>({card,ability}))));
 if(actions.some(({card,ability})=>!activationError(g,owner,card,ability)))return true;
 if(!responses.length&&!actions.length&&!specialCards.length)return false;
 // Explore colored source choices and activation costs without touching live state.
 const sources=player.zones.battlefield.filter(c=>!c.faceDown&&!c.tapped&&manaAbilities(g,owner,c).some(a=>a.tap));
 const slimCard=card=>{const {localImages,card_faces,...metadata}=card;return {...metadata,card_faces:card_faces?.map(({localImages,image_uris,...face})=>face)};};
 const simulation={...g,stack:g.stack.map(entry=>entry.card?{...entry,card:slimCard(entry.card)}:entry),log:[],players:g.players.map(p=>({...p,zones:Object.fromEntries(Object.entries(p.zones).map(([zone,cards])=>[zone,(zone==='battlefield'?cards:cards.filter(c=>c.commander)).map(slimCard)]))}))};
 let states=[{game:structuredClone(simulation),used:new Set()}],visited=new Set(),iterations=0;
 for(let cursor=0;cursor<states.length;cursor++){
  const {game,used}=states[cursor];
  for(const source of sources)if(!used.has(source.instance))for(const ability of manaAbilities(game,owner,source).filter(a=>a.tap)){
   const currentSource=findCard(game,source.instance)?.card;if(!currentSource||activationError(game,owner,currentSource,ability))continue;
   if(ability.output.manual||ability.output.variable||ability.manualCost||ability.counterRemoval||ability.counterCost||ability.usesStack)return true;
   const choices=ability.output.alternatives?ability.output.alternatives.map((_,outputIndex)=>({outputIndex})):ability.output.colors?ability.output.colors.map(color=>({color})): [{}];
   if(ability.output.combination)return true;
   for(const choice of choices){
    if(++iterations>256)return true;
    const next=structuredClone(game),found=findCard(next,source.instance);try{
     if(ability.manaCost)payMana(next.players[owner],source,ability.manaCost,{ability:true});
     if(ability.lifeCost)payLife(next.players[owner],ability.lifeCost);
     found.card.tapped=true;produceMana(next,owner,found.card,ability,choice);
    }catch(error){if(!/Not enough eligible mana/.test(error.message))return true;continue;}
    const nextUsed=new Set([...used,source.instance]),key=[...nextUsed].sort().join(',')+'|'+JSON.stringify(next.players[owner].mana);if(visited.has(key))continue;visited.add(key);
    if(canTurnUp(next)||responses.some(card=>castableSpellPayment(next,owner,card,responseZone(card),{allowLife:true,allowRestricted:true}))||actions.some(({card,ability})=>{const current=findCard(next,card.instance)?.card;return current&&!activationError(next,owner,current,ability);}))return true;
    states.push({game:next,used:nextUsed});
   }
  }
 }
 // Unknown alternative costs or casting permissions require a manual window.
 return responses.some(c=>/rather than pay|without paying|costs? .*less|convoke|delve|affinity|improvise/i.test(cardFace(c).oracle_text||''))||player.zones.battlefield.some(c=>!c.faceDown&&/may cast|spells you cast cost|have flash/i.test(cardFace(c).oracle_text||''));
}
export function settlePriority(g){if(g.players.some(p=>p.librarySearch))return;if(g.result){delete g.priority;return;}
 if(triggerOrderGroup(g))return;
 if(!g.stack.length||g.pendingEffect||pendingEntry(g)||triggerNeedsTarget(g))return null;
 while(g.stack.length&&!g.result){
  if(triggerOrderGroup(g)||g.pendingEffect||pendingEntry(g)||triggerNeedsTarget(g)||g.stack.at(-1).manualPlacement)return null;const owner=prioritySeat(g);if(wantsResponse(g,owner,()=>canRespond(g,owner)))return null;
  g.priority??={seat:owner,passes:0};g.priority.passes++;
  if(g.priority.passes===liveSeats(g).length){const entry=resolveTop(g);if(!g.stack.length)return entry;}
  else g.priority.seat=nextLivingSeat(g,owner);
 }
 return null;
}
export function resolveProliferate(g,ids=[],owners=[]){
 if(g.pendingEffect?.kind!=='proliferate')throw Error('No proliferate effect is pending.');
 for(const id of new Set(ids)){const found=findCard(g,id);if(found?.zone!=='battlefield'||!Object.values(found.card.counters||{}).some(n=>n>0))throw Error('Choose permanents that already have counters.');}
 for(const owner of new Set(owners))if(!Number.isInteger(owner)||!g.players[owner]||!Object.values(playerCounters(g.players[owner])).some(n=>n>0))throw Error('Choose players that already have counters.');
 const pending=g.pendingEffect,counts=values=>Object.fromEntries(Object.entries(values).filter(([,n])=>n>0).map(([kind])=>[kind,1])),events=[...new Set(ids)].map(id=>permanentCounterEvent(g,pending.owner,id,counts(findCard(g,id).card.counters)));for(const owner of new Set(owners))events.push(playerCounterEvent(pending.owner,owner,counts(playerCounters(g.players[owner]))));
 note(g,g.pendingEffect.name+': proliferated '+new Set(ids).size+' permanents and '+new Set(owners).size+' players.');delete g.pendingEffect;continueOracleCast(g,{context:pending.context||{owner:pending.owner,name:pending.name,source:{instance:crypto.randomUUID(),name:pending.name}},remaining:[{op:'counterBatch',events},...(pending.remaining||[])]});settlePriority(g);
}
export function playLand(g,id,position){
 if(pendingEntry(g))throw Error('Finish the entering land’s life payment choice first.');
 const found=findCard(g,id);if(!found||!['hand','exile','graveyard'].includes(found.zone)||!castingPermission(g,found.owner,found.card,found.zone)||!/\bLand\b/.test(cardFace(found.card).type_line||''))throw Error('No permission to play a land from this zone.');
 const error=landPlayError(g,found.owner);if(error)throw Error(error);
 const card=transfer(g,id,'battlefield',found.owner,position);g.players[found.owner].landsPlayed=(g.players[found.owner].landsPlayed||0)+1;
 note(g,g.players[found.owner].name+' plays '+card.name+' as a land.');return card;
}
export function chooseEntryLife(g,id,pay){
 const found=findCard(g,id);if(found?.zone!=='battlefield'||!found.card.entryLife)throw Error('No life payment choice is pending for this land.');
 if(typeof pay!=='boolean')throw Error('Choose whether to pay life.');
 const {card,owner}=found,{amount,forcedTapped}=card.entryLife;if(pay)payLife(g.players[owner],amount);
 card.tapped=forcedTapped||!pay;delete card.entryLife;if(card.tapped)delete card.entryCondition;
 note(g,g.players[owner].name+(pay?' pays '+amount+' life for ':' declines the life payment for ')+card.name+'; it enters '+(card.tapped?'tapped.':'untapped.'));settlePriority(g);
}
export function chooseEntryTapped(g,id,tapped){
 const found=findCard(g,id);if(found?.zone!=='battlefield'||!found.card.entryCondition)throw Error('No entry condition is pending for this permanent.');
 if(typeof tapped!=='boolean')throw Error('Choose tapped or untapped.');
 const {card,owner}=found;card.tapped=tapped||!!card.entryLife;delete card.entryCondition;if(card.entryLife)card.entryLife.forcedTapped=tapped;
 note(g,g.players[owner].name+' confirms '+card.name+' enters '+(tapped?'tapped.':'untapped.'));settlePriority(g);
}
