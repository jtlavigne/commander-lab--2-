import {findCard,transfer} from './engine.mjs';
import {prepareTokenEntries,tokenCopyDefinition} from './tokens.mjs';

// Copy effects describe the object and exceptions, never individual card names.
// Unrecognized exceptions remain manual rather than silently losing abilities.
export const COPY_OPERATIONS=['copyPermanent','exileAndCopy'];
export function compilePermanentCopy(text){
 const copy=text.match(/^Create (a|one|two|three|four|five|\d+|X) tokens? (?:that's|that are) (?:a copy|copies) of target (?:creature|artifact|permanent)(?: you control)?(, except (?:it isn't|they aren't) legendary)?\.$/i);
 if(copy)return [{op:'copyPermanent',amount:({a:'1',one:'1',two:'2',three:'3',four:'4',five:'5'}[copy[1].toLowerCase()]||copy[1].toUpperCase()),nonlegendary:!!copy[2]}];
 if(/^Exile target nonland permanent card with mana value X from your graveyard\. Create a token that's a copy of that card\.$/i.test(text))return [{op:'exileAndCopy',amount:'1',nonlegendary:false}];
 return null;
}
export function runPermanentCopy(g,context,step,remaining,run){
 if(!COPY_OPERATIONS.includes(step.op))return false;
 const count=step.amount==='X'?context.x||0:Number(step.amount);
 if(!Number.isSafeInteger(count)||count<0||count>500)throw Error('Choose a copy count from 0 to 500.');
 const requests=[];
 for(const target of context.targets||[context.target].filter(Boolean)){
  const found=findCard(g,target.id),zone=step.op==='exileAndCopy'?'graveyard':'battlefield',identity=zone==='battlefield'?'battlefieldId':'zoneChangeId';
  if(found?.zone!==zone||(found.card[identity]||null)!==target[identity])continue;
  // Capture before changing zones: the source can leave while the independent
  // token keeps its own rules text, art and (where applicable) both faces.
  const definition=tokenCopyDefinition(found.card,{nonlegendary:step.nonlegendary});
  if(step.op==='exileAndCopy')transfer(g,found.card.instance,'exile',found.card.ownerSeat??found.owner);
  requests.push(...prepareTokenEntries(g,context.owner,definition,count,{useTemplate:false}).requests);
 }
 run(g,context,[{op:'enterPermanents',requests},...remaining]);return true;
}
export function validatePermanentCopy(step,fail){
 if(COPY_OPERATIONS.includes(step.op)&&(typeof step.nonlegendary!=='boolean'||typeof step.amount!=='string'||! /^(?:X|\d+)$/.test(step.amount)||step.amount!=='X'&&Number(step.amount)>500))fail();
}
