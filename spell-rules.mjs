import {cardFace,manaValue} from './card-state.mjs';
import {normalizeRules} from './ability-effects.mjs';
import {offeredCast} from './permission-effects.mjs';
import {graveAbilityPermissions} from './grave-casting.mjs';

// Casting restrictions, modes and additional costs are announcement data.
// They are not instructions to run again when the spell resolves.
export function modalDefinition(card){
 const text=normalizeRules(cardFace(card).oracle_text),lines=text.split('\n'),heading=lines.find(line=>/^Choose (?:one|two)(?: —|\. If you control a commander as you cast this spell, you may choose both instead\.)$/.test(line));
 if(!heading)return null;
 const modes=lines.filter(line=>line.startsWith('• ')).map(line=>line.slice(2)),entwine=text.match(/(?:^|\n)Entwine ((?:\{[^}]+\})+)/)?.[1];
 return modes.length?{modes,count:heading.startsWith('Choose two')?2:1,entwine,commanderBoth:/If you control a commander/.test(heading)}:null;
}
export function canChooseBoth(g,owner,definition){return !!definition&&(!!definition.entwine||definition.commanderBoth&&!!g?.players[owner]?.zones.battlefield.some(c=>!c.faceDown&&c.commander));}
export function modalAdditionalCost(g,owner,card,mode){
 const definition=modalDefinition(card);if(!definition||definition.count===2||mode!==definition.modes.length)return '';
 return canChooseBoth(g,owner,definition)?definition.entwine||'':null;
}
export function multikickerCost(card,kicks=0){
 if(!Number.isSafeInteger(kicks)||kicks<0||kicks>100)return null;
 const match=normalizeRules(cardFace(card).oracle_text).match(/(?:^|\n)(Multikicker|Kicker) ((?:\{[^}]+\})+)/),cost=match?.[2];
 if(match?.[1]==='Kicker'&&kicks>1)return null;
 return kicks&&!cost?null:(cost||'').repeat(kicks);
}
export function overloadCost(card,mode){return mode===1?normalizeRules(cardFace(card).oracle_text).match(/(?:^|\n)Overload ((?:\{[^}]+\})+)/)?.[1]:undefined;}
export function buybackCost(card,chosen=false){const cost=normalizeRules(cardFace(card).oracle_text).match(/(?:^|\n)Buyback ((?:\{[^}]+\})+)/)?.[1];return chosen?(cost??null):'';}
export function castingDiscardCount(card){const match=normalizeRules(cardFace(card).oracle_text).match(/(?:^|\n)As an additional cost to cast this spell, discard (a|one|two|three|\d+) cards?\./i);return match?({a:1,one:1,two:2,three:3}[match[1].toLowerCase()]??Number(match[1])):0;}
export function castingSacrificeType(card){return normalizeRules(cardFace(card).oracle_text).match(/(?:^|\n)As an additional cost to cast this spell, sacrifice a (land|creature|artifact|enchantment)\./i)?.[1].toLowerCase();}
export function castingLifeCost(card,x=0){const match=normalizeRules(cardFace(card).oracle_text).match(/(?:^|\n)As an additional cost to cast this spell, pay (X|\d+) life\./i);const value=match?(match[1].toUpperCase()==='X'?x:Number(match[1])):0;return Number.isSafeInteger(value)&&value>=0&&value<=999999?value:null;}
export function castingSacrificeOptions(g,owner,card){const type=castingSacrificeType(card);return type?g.players[owner].zones.battlefield.filter(c=>new RegExp('\\b'+type+'\\b','i').test(cardFace(c).type_line||'')):[];}
export function resolutionText(card){
 return normalizeRules(cardFace(card).oracle_text).split('\n').filter(line=>!/^Cast this spell only |^As an additional cost to cast this spell, (?:discard |sacrifice a |pay (?:X|\d+) life\.)|^This spell costs \{\d+\} less to cast for each creature on the battlefield\.$|^(?:Entwine|Flashback|Rebound|Delve|Kicker|Multikicker|Overload|Buyback|Storm|Miracle)\b/i.test(line)).join('\n');
}
export function spellRestriction(g,owner,card){
 const text=normalizeRules(cardFace(card).oracle_text);
 if(/(?:^|\n)Cast this spell only during combat on your turn\./i.test(text)&&(g.active!==owner||g.step<4||g.step>8))return 'Cast this spell only during combat on your turn.';
 return '';
}
export function grantedFlash(g,owner,card){
 return g.players[owner].zones.battlefield.some(source=>!source.faceDown&&normalizeRules(cardFace(source).oracle_text).split('\n').some(line=>{
  const grant=line.match(/^You may cast (.+?) spells as though they had flash\.$/i);if(!grant)return false;
  return grant[1].split(/, | and | or /).some(type=>new RegExp('\\b'+type+'\\b','i').test(cardFace(card).type_line||''));
 }));
}
export function flashbackOptions(g,owner,card){
 const printed=normalizeRules(cardFace(card).oracle_text).match(/(?:^|\n)Flashback ((?:\{[^}]+\})+)/)?.[1],grant=card.flashbackGrant,granted=grant?.owner===owner&&grant.turn===g.turn+':'+g.active&&grant.zoneChangeId===(card.zoneChangeId||null)?grant.cost:null;
 const cost=granted==='printed'?cardFace(card).mana_cost:granted,options=[...(printed?[{key:'printed',cost:printed}]:[]),...(cost?[{key:'granted',cost}]:[])];
 const value=cost=>[...cost.matchAll(/\{([^}]+)\}/g)].reduce((n,m)=>n+(/^\d+$/.test(m[1])?Number(m[1]):1),0);return options.sort((a,b)=>value(a.cost)-value(b.cost));
}
export function castingPermission(g,owner,card,zone,options={}){
 const pending=g.pendingEffect;
 if(offeredCast(pending,card,zone)&&pending.owner===owner){const face=cardFace(card);if(pending.step.scope==='instant or sorcery'&&!/\b(?:Instant|Sorcery)\b/.test(face.type_line||'')||pending.step.manaValue!==undefined&&manaValue(card,{onStack:true})>pending.step.manaValue)return null;return {zone,cost:pending.step.cost??'{0}',free:pending.step.cost===undefined,duringResolution:true,...(pending.step.graveyardExile?{graveyardExile:true}:{})};}
 if(['hand','command'].includes(zone))return {zone};
 if(zone==='graveyard'){
  const choices=flashbackOptions(g,owner,card),selected=options.flashback===undefined?choices[0]:choices.find(c=>c.key===options.flashback);
  const methods=[...(selected?[{key:'flashback',cost:selected.cost,flashback:true}]:[]),...graveAbilityPermissions(g,owner,card)],method=options.permission===undefined?methods[0]:methods.find(m=>m.key===options.permission);
  if(method)return {zone,...method};
 }
 const permission=card.playPermission;
 if(zone==='exile'&&permission?.owner===owner&&permission.turn===g.turn+':'+g.active&&permission.zoneChangeId===card.zoneChangeId&&(!permission.spellsOnly||!/\bLand\b/.test(cardFace(card).type_line||'')))return {zone,...(permission.free?{cost:'{0}',free:true}:{})};
 return null;
}

// Resolution permissions may let a player cast a card owned by another seat.
// Ownership is retained on the instance; the new stack entry has the caster.
export function castingController(g,found){
 const pending=g.pendingEffect;
 return found&&offeredCast(pending,found.card,found.zone)?pending.owner:found?.owner;
}
