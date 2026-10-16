import {cardFace} from './card-state.mjs';
import {normalizeRules} from './ability-effects.mjs';
import {effectTargetSpec,effectTargetOptions,groupedTargets} from './effect-targets.mjs';
import {findCard} from './engine.mjs';
import {modalDefinition,canChooseBoth,resolutionText} from './spell-rules.mjs';
import {isAura,auraTargetText} from './attachments.mjs';

export const spellTargetText=(card,text)=>isAura(card)?auraTargetText(card)||'target unsupported Aura recipient.':text;

// Announcements are stored separately from printed Oracle metadata. Choices
// are public before opponents receive priority; resolution rechecks targets.
export function spellModes(card,g,owner){
 if(!/\b(?:Instant|Sorcery)\b/.test(cardFace(card).type_line||''))return [];
 const definition=modalDefinition(card);if(!definition){const text=resolutionText(card);return /(?:^|\n)Overload /.test(cardFace(card).oracle_text||'')?[text,text.replace(/\btarget\b/g,'each')]:[];}
 if(definition.count===2)return definition.modes.flatMap((first,i)=>definition.modes.slice(i+1).map(second=>first+'\n'+second));
 return [...definition.modes,...(canChooseBoth(g,owner,definition)?[definition.modes.join('\n')]:[])];
}
export function spellText(card,{mode}={},g,owner){
 const modes=spellModes(card,g,owner);if(!modes.length)return resolutionText(card);
 if(!Number.isInteger(mode)||!modes[mode])throw Error('Choose a spell mode before casting.');return modes[mode];
}
export function spellTargetOptions(g,owner,card,options={}){
 if(!isAura(card)&&!/\b(?:Instant|Sorcery)\b/.test(cardFace(card).type_line||''))return [];
 return effectTargetOptions(g,{owner,card:{...card,castKicks:options.kicks||0},castX:options.x||0,text:spellTargetText(card,spellText(card,options,g,owner))});
}
export function spellAnnouncement(g,owner,card,options={}){
 const text=spellText(card,options,g,owner),targetText=isAura(card)||/\b(?:Instant|Sorcery)\b/.test(cardFace(card).type_line||'')?spellTargetText(card,text):'';
 return {spellText:text,...announceEffectTargets(g,{owner,card,text:targetText},options.targets||[],options),...(options.mode!==undefined?{mode:options.mode}:{})};
}
export function announceEffectTargets(g,entry,keys=[],options={}){
 const {owner}=entry,spec=effectTargetSpec(entry.text,{x:options.x??entry.castX,kicks:options.kicks??entry.card?.castKicks});
 if(!Array.isArray(keys)||!spec?.repeated&&new Set(keys).size!==keys.length)throw Error('Choose distinct spell targets.');
 if(!spec){if(keys.length)throw Error('This spell does not use those targets.');return {};}
 const available=effectTargetOptions(g,{...entry,castX:options.x??entry.castX});
 if(keys.length<(spec.optional?0:spec.min||1)||keys.length>(spec.max??1))throw Error('Choose a legal number of spell targets.');
 let targets=keys.map(key=>available.find(t=>t.key===key));if(targets.some(t=>!t))throw Error('Choose a legal spell target.');
 targets=groupedTargets(spec,targets,owner);
 let division;
 if(spec.divided){const amounts=options.division||{},x=spec.total??options.x??0;if(!Number.isSafeInteger(x)||x<0||Object.keys(amounts).some(key=>!keys.includes(key))||keys.some(key=>!Number.isSafeInteger(amounts[key])||amounts[key]<1)||keys.reduce((sum,key)=>sum+amounts[key],0)!==x)throw Error('Divide all '+(spec.total??'X')+' damage among the chosen targets, at least 1 to each.');division=keys.map(key=>({key,amount:amounts[key]}));}
 return {targets,...(division?{division}:{})};
}
export function copyTargetOptions(g,entry){
 const available=effectTargetOptions(g,{...entry,text:entry.spellText||cardFace(entry.card).oracle_text});
 return [...available,...(entry.targets||[]).filter(t=>!available.some(o=>o.key===t.key)).map(t=>({...t,label:t.label+' (keep original target)'}))];
}
export function retargetCopy(g,entry,keys){
 if(!Array.isArray(keys)||keys.length!==(entry.targets||[]).length)throw Error('Keep the same number of spell targets.');
 const text=entry.spellText||cardFace(entry.card).oracle_text,spec=effectTargetSpec(text,{x:entry.castX,kicks:entry.card.castKicks}),available=effectTargetOptions(g,{...entry,text});
 if(!spec?.repeated&&new Set(keys).size!==keys.length)throw Error('Choose distinct spell targets.');
 const targets=keys.map((key,i)=>{
  // An unchanged target retains its identity even if it is now illegal. A
  // changed target must be legal, including its role in a modal instruction.
  if(key===entry.targets[i].key)return entry.targets[i];
  const option=available.find(o=>o.key===key),group=entry.targets[i].group;
  if(!option||group!==undefined&&spec.groups&&(typeof spec.groups[group]==='object'?!option.groups?.includes(group):spec.groups[group]==='own'?option.owner!==entry.owner:option.owner===entry.owner))throw Error('Choose a legal spell target.');
  return {...option,...(group!==undefined?{group}:{})};
 });
 return {targets,...(entry.division?{division:entry.division.map((d,i)=>({...d,key:keys[i]}))}:{})};
}
export function spellHasLegalChoices(g,owner,card,chosen){
 const modes=spellModes(card,g,owner),choices=chosen?[chosen]:modes.length?modes.map((_,mode)=>({mode})):[{}];
 return choices.some(options=>{const text=spellText(card,options,g,owner),spec=isAura(card)||/\b(?:Instant|Sorcery)\b/.test(cardFace(card).type_line||'')?effectTargetSpec(spellTargetText(card,text),options):null;
  if(!spec||spec.optional)return true;
  const available=spellTargetOptions(g,owner,card,options);
  return spec.groups?spec.groups.every((group,index)=>spec.optionalGroupIndices?.includes(index)||available.some(t=>typeof group==='object'?t.groups?.includes(spec.groups.indexOf(group)):group==='own'?t.owner===owner:t.owner!==owner)):available.length>=(spec.min||1);
 });
}
export function currentSpellTargets(g,entry){
 const available=effectTargetOptions(g,{...entry,text:spellTargetText(entry.card,entry.spellText??cardFace(entry.card).oracle_text)});
 const spec=effectTargetSpec(spellTargetText(entry.card,entry.spellText??cardFace(entry.card).oracle_text),{x:entry.castX,kicks:entry.card.castKicks});
 return (entry.targets||[]).flatMap(t=>{
  const current=available.find(o=>o.key===t.key);if(!current)return [];
  if(t.group!==undefined&&spec?.groups&&(typeof spec.groups[t.group]==='object'?!current.groups?.includes(t.group):spec.groups[t.group]==='own'?current.owner!==entry.owner:current.owner===entry.owner))return [];
  const same=t.kind==='player'||(['graveyard','stack'].includes(t.zone)?(findCard(g,t.id)?.card.zoneChangeId||null)===t.zoneChangeId:(findCard(g,t.id)?.card.battlefieldId||null)===t.battlefieldId);
  return same?[{...t,owner:current.owner}]:[];
 });
}
