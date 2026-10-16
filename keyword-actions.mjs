import {KEYWORD_TOKENS} from './token-catalog.mjs';
import {findCard} from './engine.mjs';
import {isCreature,combatStats} from './creature-rules.mjs';
import {createTokens,prepareTokenEntries,tokenCopyDefinition} from './tokens.mjs';
import {permanentCounterEvent} from './counter-effects.mjs';
import {queueCombatTriggers,snapshotCard} from './combat-effects.mjs';

// Rule 701 actions compile to the same serializable instructions used by
// ordinary spells. Card names never select an implementation here.
export const KEYWORD_ACTION_OPERATIONS=['investigate','populate','bolster','adapt','monstrosity','becomeMonstrous'];
const amountPattern='(?:X|\\d+)';
export function compileKeywordAction(text){
 if(/^Investigate\.$/i.test(text))return [{op:'investigate',amount:'1'}];
 if(/^Investigate twice\.$/i.test(text))return [{op:'investigate',amount:'2'}];
 const repeated=text.match(/^Investigate (\d+) times\.$/i);if(repeated)return [{op:'investigate',amount:repeated[1]}];
 if(/^Populate\.$/i.test(text))return [{op:'populate'}];
 if(/^Support \d+\.$/i.test(text))return [{op:'counter',amount:'1',counter:'+1/+1',scope:'target creature'}];
 const counted=text.match(new RegExp('^(Bolster|Adapt|Monstrosity) ('+amountPattern+')\\.$','i'));
 return counted?[{op:counted[1].toLowerCase(),amount:counted[2].toUpperCase()}]:null;
}

// Resolution choices are not targets. Shroud and hexproof do not remove a
// creature from Bolster or Populate, and Bolster uses current toughness.
export function keywordActionOptions(g,pending){
 const {step,owner}=pending;
 if(!['populate','bolster'].includes(step.op))return null;
 let cards=g.players[owner].zones.battlefield.filter(isCreature);
 if(step.op==='populate')cards=cards.filter(c=>c.token);
 else{
  const values=cards.map(c=>({card:c,toughness:combatStats(g,owner,c)?.toughness}));
  if(values.some(v=>typeof v.toughness!=='number'))throw Error('Set creature toughness before resolving bolster.');
  const least=Math.min(...values.map(v=>v.toughness));cards=values.filter(v=>v.toughness===least).map(v=>v.card);
 }
 return cards.map(card=>({key:card.instance,label:card.name,zone:'battlefield'}));
}
function liveSource(g,source){
 const found=source&&findCard(g,source.instance);
 return found?.zone==='battlefield'&&(found.card.battlefieldId||null)===(source.battlefieldId||null)?found:null;
}
function amountFor(context,step){
 const amount=step.amount==='X'?context.x||context.event?.x||0:Number(step.amount);
 if(!Number.isSafeInteger(amount)||amount<0||amount>999999)throw Error('Choose a supported whole-number keyword action amount.');
 return amount;
}
function countersThen(g,context,card,amount,remaining,run){
 const event=permanentCounterEvent(g,context.owner,card.instance,{'+1/+1':amount});
 run(g,context,[...(event?[{op:'counterBatch',events:[event]}]:[]),...remaining]);
}

// Return 0 for another family's operation, 1 for a finished instruction, and
// 2 when a choice or nested continuation owns the rest of this resolution.
export function runKeywordAction(g,context,step,remaining,run){
 if(step.op==='investigate'){
  const amount=amountFor(context,step);if(amount>500)throw Error('Investigate at most 500 times per instruction.');
  for(let i=0;i<amount;i++){
   createTokens(g,context.owner,KEYWORD_TOKENS.investigate);
   queueCombatTriggers(g,[{kind:'keyword-action',action:'investigate',owner:context.owner,card:context.source}]);
  }return 1;
 }
 if(['populate','bolster'].includes(step.op)){
  const pending={kind:'oracle-choice',owner:context.owner,name:context.name,context,step:{...step,min:1,max:1,zone:'battlefield'},remaining};
  if(keywordActionOptions(g,pending).length){g.pendingEffect=pending;return 2;}return 1;
 }
 if(['adapt','monstrosity'].includes(step.op)){
  const found=liveSource(g,context.source);if(!found)return 1;
  if(step.op==='adapt'&&(found.card.counters?.['+1/+1']||0)>0||step.op==='monstrosity'&&found.card.monstrous)return 1;
  const amount=amountFor(context,step),after=step.op==='monstrosity'?[{op:'becomeMonstrous',id:found.card.instance,battlefieldId:found.card.battlefieldId||null,amount:String(amount)},...remaining]:remaining;
  countersThen(g,context,found.card,amount,after,run);return 2;
 }
 if(step.op==='becomeMonstrous'){
  const found=liveSource(g,{instance:step.id,battlefieldId:step.battlefieldId});
  if(found&&!found.card.monstrous){found.card.monstrous=true;queueCombatTriggers(g,[{kind:'keyword-action',action:'monstrosity',owner:found.owner,card:snapshotCard(found.card),x:amountFor(context,step)}]);}return 1;
 }
 return 0;
}
export function resolveKeywordAction(g,pending,keys,run){
 const {step,context,remaining,owner}=pending;
 if(!['populate','bolster'].includes(step.op))return false;
 const card=keys.length&&g.players[owner].zones.battlefield.find(c=>c.instance===keys[0]);
 if(step.op==='populate'&&card){const {requests}=prepareTokenEntries(g,owner,tokenCopyDefinition(card),1,{useTemplate:false});run(g,context,[{op:'enterPermanents',requests},...remaining]);return true;}
 if(step.op==='bolster'&&card)countersThen(g,context,card,amountFor(context,step),remaining,run);
 else run(g,context,remaining);
 return true;
}

// Pending programs are loaded from disk and sent across the network. Validate
// the same operation definitions at that boundary, including continuations.
export function validateKeywordAction(step,fail){
 if(!KEYWORD_ACTION_OPERATIONS.includes(step.op))return;
 if(step.op!=='populate'&&(typeof step.amount!=='string'||! /^(?:X|\d+)$/.test(step.amount)||step.amount!=='X'&&Number(step.amount)>999999))fail();
 if(['populate','bolster'].includes(step.op)&&step.zone!==undefined&&(step.zone!=='battlefield'||step.min!==1||step.max!==1))fail();
 if(step.op==='becomeMonstrous'&&(typeof step.id!=='string'||!step.id||step.battlefieldId!==null&&typeof step.battlefieldId!=='string'))fail();
}
