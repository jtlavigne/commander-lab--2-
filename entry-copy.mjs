import {cardFace,manaValue} from './card-state.mjs';
import {tokenCopyDefinition} from './tokens.mjs';

// Compile only complete, recognized as-enters clauses. These describe the
// eligible objects and copy exceptions; no card names select implementations.
export function entryCopyRules(card){
 if(card.faceDown)return [];
 const face=cardFace(card);
 return (face.oracle_text||'').replace(/’/g,"'").split('\n').flatMap((line,index)=>{
  const self='(?:this (?:creature|artifact|permanent)|'+(face.name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')';
  const permanent=line.match(new RegExp('^You may have '+self+' enter(?: the battlefield)? as a copy of (?:a|any) (creature(?: or planeswalker)?)( you control)?(?: on the battlefield)?(.*)\\.$','i'));
  const temporary=line.match(new RegExp('^As '+self+' enters(?: the battlefield)?, you may have it become a copy of any (creature) on the battlefield until end of turn(.*)\\.$','i'));
  const match=permanent||temporary;if(!match)return [];
  const tail=permanent?match[3]:match[2];
  const bonus=", except it enters with an additional +1/+1 counter on it if it's a creature, it enters with an additional loyalty counter on it if it's a planeswalker, and it isn't legendary";
  if(!['',', except it has haste',bonus].includes(tail))return [];
  return [{key:(card.copyEffects?.length||0)+':'+index,types:match[1].split(' or '),own:!!permanent&&!!match[2],untilEndOfTurn:!!temporary,haste:tail===', except it has haste',nonlegendary:tail===bonus,additionalCounters:tail===bonus}];
 });
}

export function nextEntryCopy(entry){
 return entryCopyRules(entry.card).find(rule=>!(entry.copyDecisions||[]).includes(rule.key));
}

// This choice does not target. Hexproof, shroud and protection do not exclude
// a permanent, but a batch companion is still outside the battlefield.
const publicCopyFace=card=>card.faceDown?{name:'Face-down creature',type_line:'Creature'}:cardFace(card);
export function entryCopyOptions(game,entry){
 const rule=nextEntryCopy(entry);if(!rule)return [];
 return game.players.flatMap((player,owner)=>rule.own&&owner!==entry.owner?[]:player.zones.battlefield.filter(card=>{
  const type=publicCopyFace(card).type_line||'';
  return rule.types.some(kind=>new RegExp('\\b'+kind+'\\b','i').test(type));
 }).map(card=>({key:'card:'+card.instance,id:card.instance,battlefieldId:card.battlefieldId||null,kind:'card',owner,zone:'battlefield',label:publicCopyFace(card).name||card.name})));
}

export function applyEntryCopy(game,entry,answer){
 const rule=nextEntryCopy(entry);if(!rule)throw Error('No copy decision is pending.');
 if(answer.target!==null){
  const option=entryCopyOptions(game,entry).find(option=>option.id===answer.target&&option.battlefieldId===answer.battlefieldId);
  if(!option)throw Error('Choose an eligible battlefield permanent to copy.');
  if((entry.card.copyEffects?.length||0)>=50)throw Error('Too many chained copy effects.');
  const source=game.players[option.owner].zones.battlefield.find(card=>card.instance===option.id);
  const definition=tokenCopyDefinition(source,{nonlegendary:rule.nonlegendary});
  // An ordinary permanent copy has only the copied face. Transforming token
  // copies created by separate effects retain their established DFC behavior.
  const values={...definition,...definition.card_faces?.[definition.face||0]};delete values.card_faces;delete values.face;
  if(definition.card_faces?.length){values.layout='normal';delete values.cmc;values.cmc=manaValue(values);}
  values.oracle_text??='';
  if(rule.haste){values.oracle_text+=(values.oracle_text?'\n':'')+'Haste';values.keywords=[...new Set([...(values.keywords||[]),'Haste'])];}
  entry.card.copyEffects??=[];entry.card.copyEffects.push({values,untilEndOfTurn:rule.untilEndOfTurn});
  // CR 707.9e: an entry-counter exception from an earlier copy effect is
  // superseded if a later copy effect applies. It is never a copiable ability.
  const type=cardFace(entry.card).type_line||'';entry.copyCounters={};
  if(rule.additionalCounters){if(/\bCreature\b/.test(type))entry.copyCounters['+1/+1']=1;if(/\bPlaneswalker\b/.test(type))entry.copyCounters.loyalty=1;}
 }
 entry.copyDecisions??=[];entry.copyDecisions.push(rule.key);
 return answer.target!==null;
}
