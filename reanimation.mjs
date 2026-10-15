import {cardFace,manaValue} from './card-state.mjs';
import {findCard,transfer} from './engine.mjs';
import {removePermanents} from './combat.mjs';
import {queueCombatTriggers,snapshotCard} from './combat-effects.mjs';
import {attachPermanent} from './attachments.mjs';

export const REANIMATION_OPERATIONS=['reanimateAllLegendary','reanimate','victimize','reanimateAura','sacrificeTracked'];
export function compileReanimationEffect(text){
 if(/^Return all legendary permanent cards from your graveyard to the battlefield\.$/i.test(text))return [{op:'reanimateAllLegendary'}];
 if(/^it loses "enchant creature card in a graveyard" and gains "enchant creature put onto the battlefield with this Aura\." Return enchanted creature card to the battlefield under your control and attach this Aura to it\. When this Aura leaves the battlefield, that creature's controller sacrifices it\.$/i.test(text))return [{op:'reanimateAura'}];
 if(text==="That creature's controller sacrifices it.")return [{op:'sacrificeTracked'}];
 if(/^(?:Put|Return) target creature card from (?:a|your) graveyard (?:onto|to) the battlefield(?: under your control)?\.(?: You lose life equal to that card's mana value\.)?$/i.test(text))return [{op:'reanimate',loseLife:/You lose life/i.test(text)}];
 if(/^Choose two target creature cards in your graveyard\. Sacrifice a creature\. If you do, return the chosen cards to the battlefield tapped\.$/i.test(text))return [{op:'victimize',min:1,max:1}];
 return null;
}
export function reanimationChoiceOptions(g,pending){
 if(pending.step.op!=='victimize')return null;
 return g.players[pending.owner].zones.battlefield.filter(c=>/\bCreature\b/.test(cardFace(c).type_line||'')).map(c=>({key:c.instance,label:'Sacrifice '+c.name,zone:'battlefield'}));
}
export function runReanimationStep(g,context,step,remaining){
 if(step.op==='reanimateAllLegendary'){
  const cards=g.players[context.owner].zones.graveyard.filter(card=>{const type=cardFace(card).type_line||'';return /\bLegendary\b/.test(type)&&/\b(?:Artifact|Battle|Creature|Enchantment|Land|Planeswalker)\b/.test(type);}),events=[];
  for(const card of cards){transfer(g,card.instance,'battlefield',context.owner,undefined,{deferTriggers:true});events.push({kind:'enter',owner:context.owner,card:snapshotCard(card)});}
  queueCombatTriggers(g,events);return 1;
 }
 if(step.op==='sacrificeTracked'){const ref=context.event?.card?.reanimationLink,found=ref&&findCard(g,ref.id);if(found?.zone==='battlefield'&&found.card.battlefieldId===ref.battlefieldId)removePermanents(g,[ref.id],{sacrifice:true});return 1;}
 if(step.op==='reanimateAura'){
  const aura=findCard(g,context.source.instance);if(aura?.zone!=='battlefield'||aura.card.battlefieldId!==context.source.battlefieldId)return 1;
  const target=findCard(g,aura.card.attachedTo);if(target?.zone!=='graveyard'||(target.card.zoneChangeId||null)!==aura.card.attachedZoneChangeId)return 1;
  delete aura.card.attachedTo;delete aura.card.attachedZoneChangeId;aura.card.attachmentMode='reanimated';
  transfer(g,target.card.instance,'battlefield',context.owner,undefined,{deferTriggers:true});
  aura.card.reanimationLink={id:target.card.instance,battlefieldId:target.card.battlefieldId,abilityOwner:context.owner};attachPermanent(g,aura.card.instance,target.card.instance);
  queueCombatTriggers(g,[{kind:'enter',owner:context.owner,card:snapshotCard(target.card)}]);return 1;
 }
 if(step.op==='reanimate'){
  const target=context.target,found=target&&findCard(g,target.id);if(found?.zone==='graveyard'&&(found.card.zoneChangeId||null)===target.zoneChangeId){const value=manaValue(found.card);transfer(g,found.card.instance,'battlefield',context.owner);if(step.loseLife)g.players[context.owner].life-=value;}
  return 1;
 }
 if(step.op==='victimize'){
  const pending={kind:'oracle-choice',owner:context.owner,name:context.name,context,step,remaining};if(reanimationChoiceOptions(g,pending).length){g.pendingEffect=pending;return 2;}return 1;
 }
 return 0;
}
export function resolveReanimationChoice(g,pending,keys,run){
 if(pending.step.op!=='victimize')return false;
 if(removePermanents(g,keys,{sacrifice:true}).length){
  const events=[];for(const target of pending.context.targets||[]){const found=findCard(g,target.id);if(found?.zone==='graveyard'&&(found.card.zoneChangeId||null)===target.zoneChangeId){transfer(g,found.card.instance,'battlefield',pending.owner,undefined,{deferTriggers:true,entryTapped:true});events.push({kind:'enter',owner:pending.owner,card:snapshotCard(found.card)});}}
  queueCombatTriggers(g,events);
 }
 run(g,pending.context,pending.remaining);return true;
}
