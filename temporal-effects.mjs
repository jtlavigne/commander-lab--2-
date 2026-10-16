import {createEmblem} from './rule-sources.mjs';
import {addExtraTurns,phaseOut} from './turn-effects.mjs';
import {findCard,transfer} from './engine.mjs';
import {removePermanents} from './combat.mjs';

export const TEMPORAL_OPERATIONS=['watchDamage','tapAndFreeze','emblem','extraTurns','phaseOut','delayDraw','delayEndUntap','exileUntilEnd','returnExiledTracked','drawCount','cumulativeUpkeep','sacrificeSource','delayedCopy','delayReturn','returnTracked'];
export function compileTemporalEffect(text){let m;
 if(/^Choose up to (?:one|two|three|\d+) target creatures?\. Until your next turn, whenever (?:either|one) of those creatures deals combat damage, you draw a card\.$/i.test(text))return [{op:'watchDamage',combatOnly:true,text:'Draw a card.'}];
 if(/^Tap up to (?:one|two|three|\d+) target nonland permanents?\. They don't untap during their controller's next untap step\.$/i.test(text))return [{op:'tapAndFreeze'}];
 if(/^Exile another target permanent you control\. Return it to the battlefield under its owner's control at the beginning of the next end step\.$/i.test(text))return [{op:'exileUntilEnd'}];
 if(text==="Return the tracked exiled card to the battlefield under its owner's control.")return [{op:'returnExiledTracked'}];
 if((m=text.match(/^At the beginning of the next end step, untap up to (one|two|three|four|\d+) lands\.$/i)))return [{op:'delayEndUntap',amount:({one:1,two:2,three:3,four:4}[m[1].toLowerCase()]??Number(m[1]))}];
 if((m=text.match(/^You get an emblem with ["\u201c]([^]+)["\u201d]\.?$/i)))return [{op:'emblem',text:m[1]}];
 if((m=text.match(/^Take (an?|one|two|three|\d+) extra turns? after this one\.$/i)))return [{op:'extraTurns',amount:({a:1,an:1,one:1,two:2,three:3}[m[1].toLowerCase()]??Number(m[1]))}];
 if(/^Target creature you don't control phases out\.$/i.test(text))return [{op:'phaseOut'}];
 if(/^sacrifice this (?:enchantment|artifact|creature|permanent)\.$/i.test(text))return [{op:'sacrificeSource'}];
 if(/^return it to its owner's hand at the beginning of the next end step\.$/i.test(text))return [{op:'delayReturn'}];
 if(text==="Return this tracked card to its owner's hand.")return [{op:'returnTracked'}];
 if(/^When you next cast an instant or sorcery spell this turn, copy that spell\. You may choose new targets for the copy\.$/i.test(text))return [{op:'delayedCopy',mode:'next',scope:'controller'}];
 if(/^whenever a player casts an instant or sorcery spell, that player copies it and may choose new targets for the copy until end of turn\.$/i.test(text))return [{op:'delayedCopy',mode:'each',scope:'all'}];
 if((m=text.match(/^(Its controller may draw up to (two|\d+) cards|You draw a card) at the beginning of the next turn's upkeep\.$/i)))return [{op:'delayDraw',recipient:m[2]?'countered':'you',amount:m[2]?(m[2].toLowerCase()==='two'?2:Number(m[2])):1,optional:!!m[2]}];
 if((m=text.match(/^You may draw a card unless that player pays (\{\d+\})\.$/i)))return [{op:'unlessPay',cost:m[1],then:[{op:'optional',label:'Draw a card',then:[{op:'draw',amount:'a'}]}]}];
 if((m=text.match(/^Cumulative upkeep ((?:\{[0-9WUBRGC]+\})+)$/i)))return [{op:'cumulativeUpkeep',cost:m[1]}];
 return null;
}
export function runTemporalStep(g,context,step,remaining,run){
 if(step.op==='watchDamage'||step.op==='tapAndFreeze'){
  const targets=(context.targets||[]).filter(t=>{const found=findCard(g,t.id);return found?.zone==='battlefield'&&(found.card.battlefieldId||null)===t.battlefieldId;});
  if(step.op==='watchDamage'&&targets.length)(g.delayedTriggers??=[]).push({owner:context.owner,source:context.source,kind:'damage',afterTurn:g.turn+':'+g.active,untilNextTurn:true,combatOnly:step.combatOnly,targets:targets.map(t=>({id:t.id,battlefieldId:t.battlefieldId})),text:step.text});
  if(step.op==='tapAndFreeze')for(const target of targets){const card=findCard(g,target.id).card;card.tapped=true;card.skipNextUntap=true;}
  return true;
 }
 if(step.op==='exileUntilEnd'){
  for(const target of context.targets||[]){const found=findCard(g,target.id);if(found?.zone!=='battlefield'||(found.card.battlefieldId||null)!==target.battlefieldId)continue;
   const card=found.card,owner=card.ownerSeat??found.owner;transfer(g,card.instance,'exile',owner);
   // A delayed return tracks the exiled object, not a card name or current
   // source. Tokens cannot come back after leaving the battlefield.
   if(!card.token)(g.delayedTriggers??=[]).push({owner:context.owner,source:{...context.source,delayedExile:{id:card.instance,zoneChangeId:card.zoneChangeId,owner}},kind:'end-step',afterTurn:g.turn+':'+g.active,text:"Return the tracked exiled card to the battlefield under its owner's control."});
  }return true;
 }
 if(step.op==='returnExiledTracked'){
  const ref=context.source.delayedExile,found=ref&&findCard(g,ref.id);
  if(found?.zone==='exile'&&!found.card.token&&found.card.zoneChangeId===ref.zoneChangeId&&!g.players[ref.owner]?.eliminated){run(g,context,[{op:'enterPermanents',requests:[{id:ref.id,owner:ref.owner}]},...remaining]);return 'paused';}
  return true;
 }
 if(step.op==='delayEndUntap'){
  // The chosen lands are not targets and are chosen only when the delayed
  // trigger resolves. Leaving the battlefield does not cancel this trigger.
  (g.delayedTriggers??=[]).push({owner:context.owner,source:context.source,kind:'end-step',afterTurn:g.turn+':'+g.active,text:'Untap up to '+step.amount+' lands.'});return true;
 }
 if(step.op==='emblem'){createEmblem(g,context.owner,context.source,step.text);return true;}
 if(step.op==='extraTurns'){addExtraTurns(g,context.owner,step.amount);return true;}
 if(step.op==='phaseOut'){for(const target of context.targets||[])phaseOut(g,target.id);return true;}
 if(step.op==='delayReturn'){const found=findCard(g,context.source.instance);if(found?.zone==='graveyard'&&found.card.zoneChangeId===context.event?.deadZoneId)(g.delayedTriggers??=[]).push({owner:context.owner,source:{...context.source,zoneChangeId:found.card.zoneChangeId},kind:'end-step',afterTurn:g.turn+':'+g.active,text:"Return this tracked card to its owner's hand."});return true;}
 if(step.op==='returnTracked'){const found=findCard(g,context.source.instance);if(found?.zone==='graveyard'&&found.card.zoneChangeId===context.source.zoneChangeId)transfer(g,found.card.instance,'hand',found.card.ownerSeat??found.owner);return true;}
 if(step.op==='delayedCopy'){(g.spellCopyEffects??=[]).push({owner:context.owner,source:context.source,turn:g.turn+':'+g.active,mode:step.mode,scope:step.scope});return true;}
 if(step.op==='delayDraw'){
  const owner=step.recipient==='countered'?context.counteredController:context.owner;
  if(g.players[owner]&&!g.players[owner].eliminated)(g.delayedTriggers??=[]).push({owner,source:context.source,afterTurn:g.turn+':'+g.active,text:step.optional?'You may draw up to '+step.amount+' cards.':'Draw a card.'});
  return true;
 }
 if(step.op==='cumulativeUpkeep'){
  const found=findCard(g,context.source.instance);if(found?.zone!=='battlefield'||found.card.battlefieldId!==context.source.battlefieldId)return true;
  const age=(found.card.counters.age||0)+1;found.card.counters.age=age;
  const symbols=[...step.cost.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]),generic=symbols.filter(s=>/^\d+$/.test(s)).reduce((n,s)=>n+Number(s),0)*age,colors=symbols.filter(s=>!/^\d+$/.test(s));
  // Numeric upkeep scales without building a string for each age counter.
  const cost=(generic?'{'+generic+'}':'')+colors.map(s=>'{'+s+'}').join('').repeat(age)||'{0}';
  run(g,context,[{op:'optionalPay',cost,then:[],otherwise:[{op:'sacrificeSource'}]},...remaining]);return 'paused';
 }
 if(step.op==='sacrificeSource'){
  const found=findCard(g,context.source.instance);
  if(found?.zone==='battlefield'&&found.owner===context.owner&&found.card.battlefieldId===context.source.battlefieldId)removePermanents(g,[found.card.instance],{sacrifice:true});
  return true;
 }
 return false;
}
