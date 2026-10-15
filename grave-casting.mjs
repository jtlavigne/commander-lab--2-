import {cardFace} from './card-state.mjs';
import {activeRuleParagraphs,normalizeRules} from './ability-effects.mjs';

// Graveyard permissions retain their provider so spending one does not consume
// another source's allowance or a card's independent flashback permission.
export function graveAbilityPermissions(g,owner,card){
 const result=[],type=cardFace(card).type_line||'',turn=g.turn+':'+g.active;
 if(g.active===owner&&/\b(?:Instant|Sorcery)\b/.test(type))for(const source of g.players[owner].zones.battlefield)if(!source.faceDown)for(const {text,index} of activeRuleParagraphs(source)){
  if(!/^Once during each of your turns, you may cast an instant or sorcery spell from your graveyard\. If a spell cast this way would be put into your graveyard, exile it instead\.$/i.test(normalizeRules(text)))continue;
  const key='grave:'+source.instance+':'+index;
  if(source.graveCastUses?.turn===turn&&source.graveCastUses.ids.includes(key))continue;
  result.push({key,label:source.name+' - once this turn',graveyardExile:true,provider:source.instance,providerKey:key});
 }
 if(!/\bLand\b/.test(type))for(const source of g.players[owner].zones.battlefield)if(!source.faceDown)for(const {text} of activeRuleParagraphs(source))if(/^Each nonland card in your graveyard has escape\. The escape cost is equal to the card's mana cost plus exile three other cards from your graveyard\./i.test(normalizeRules(text)))result.push({key:'escape:'+source.instance,label:source.name+' - escape',cost:cardFace(card).mana_cost,escapeCount:3});
 for(const rule of g.temporaryGraveyardRules||[])if(rule.owner===owner&&rule.turn===turn&&rule.kind==='play')result.push({key:'turn:'+rule.source.instance,label:rule.source.name+' - play this turn',landPlay:true});
 const grant=card.graveCastGrant;if(grant?.owner===owner&&grant.turn===turn&&grant.zoneChangeId===(card.zoneChangeId||null))result.push({key:'grant',label:'Granted cast this turn',graveyardExile:true});
 return result;
}
export function graveyardExileReplacement(g,card,owner){return !card.token&&!card.spellCopy&&!card.cardCopy&&(g.temporaryGraveyardRules||[]).some(rule=>rule.kind==='exile'&&rule.owner===owner&&rule.turn===g.turn+':'+g.active);}
export function consumeGravePermission(g,owner,permission){
 if(!permission.provider)return;
 const source=g.players[owner].zones.battlefield.find(c=>c.instance===permission.provider);if(!source)throw Error('The casting permission is no longer available.');
 const turn=g.turn+':'+g.active;if(source.graveCastUses?.turn!==turn)source.graveCastUses={turn,ids:[]};source.graveCastUses.ids.push(permission.providerKey);
}
