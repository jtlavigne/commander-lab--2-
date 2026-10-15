import {cardFace} from './card-state.mjs';
import {normalizeRules,loyaltyCostSymbol,activeRuleParagraphs,matchesAbilityRecipient,grantedAbilities} from './ability-effects.mjs';
import {pendingLifeEntry} from './life-effects.mjs';
import {actionRestriction} from './action-permissions.mjs';

const clean=normalizeRules;
export const loyaltyTurn=g=>g.turn+':'+g.active;
const paragraphs=card=>activeRuleParagraphs(card).map(p=>p.text);
function parseLoyalty(text,paragraph){
 const match=text.trim().match(/^([^:]+):\s*(.+)$/);if(!match)return null;
 const cost=loyaltyCostSymbol(match[1]);if(cost===null)return null;
 return {cost,label:cost.replace('-','−'),text:match[2],paragraph,variable:cost.includes('X'),delta:cost.includes('X')?null:Number(cost),sign:cost.startsWith('-')?-1:1};
}
const affects=matchesAbilityRecipient;
export function availableLoyaltyAbilities(g,owner,card,visited=new Set()){
 if(card.faceDown)return [];
 // Ability-copying effects form a graph (two walkers can copy each other).
 // Stop revisiting an incarnation while retaining its printed/quoted abilities.
 const result=loyaltyAbilities(card).map(a=>({...a,key:'printed:'+a.paragraph,printed:true}));
 for(const grant of grantedAbilities(g,owner,card)){
   const ability=parseLoyalty(grant.text,grant.paragraph);if(!ability)continue;
   // Repeated identical granted abilities provide the same available action.
   if(result.some(a=>a.cost===ability.cost&&a.text===ability.text))continue;
   result.push({...ability,key:grant.key,printed:false,grantedBy:grant.sourceName});
 }
 if(visited.has(card.instance))return result;
 const next=new Set(visited);next.add(card.instance);
 const field=g.players.flatMap((p,controller)=>p.zones.battlefield.filter(c=>!c.faceDown).map(c=>({card:c,owner:controller})));
 const isSelf=(subject,source)=>[source.name,cardFace(source).name,(cardFace(source).name||source.name).split(',')[0]].some(name=>clean(subject).toLowerCase()===clean(name).toLowerCase());
 for(const source of field)for(const raw of paragraphs(source.card)){
  const match=clean(raw).match(/^(.+?) has (?:all )?(?:the )?loyalty abilities of (.+?)\.$/i);if(!match)continue;
  const applies=isSelf(match[1],source.card)?card.instance===source.card.instance:affects(match[1],card,owner,source.card,source.owner);
  if(!applies)continue;
  const providers=/^all other planeswalkers on the battlefield$/i.test(match[2])?field.filter(p=>p.card.instance!==card.instance&&/\bPlaneswalker\b/.test(cardFace(p.card).type_line||'')):isSelf(match[2],source.card)?[source]:[];
  for(const provider of providers)for(const ability of availableLoyaltyAbilities(g,provider.owner,provider.card,next)){
   if(result.some(a=>a.cost===ability.cost&&a.text===ability.text))continue;
   result.push({...ability,key:'inherited:'+provider.card.instance+':'+ability.key,printed:false,grantedBy:provider.card.name});
  }
 }
 return result;
}
export function getLoyaltyAbility(g,owner,card,ref){const abilities=availableLoyaltyAbilities(g,owner,card);return typeof ref==='number'||/^\d+$/.test(String(ref))?abilities[Number(ref)]:abilities.find(a=>a.key===ref);}
export function loyaltyStatus(g,owner,card){
 const turn=loyaltyTurn(g),used=card.loyaltyActivations?.turn===turn?card.loyaltyActivations.used:0;let limit=1,instant=false;
 for(const [sourceOwner,player] of g.players.entries())for(const source of [...player.zones.battlefield,...(player.emblems||[])])if(!source.faceDown)for(const raw of paragraphs(source)){
  const line=clean(raw),permission=line.match(/^You may activate (?:the )?loyalty abilities of (.+?) (twice|three times|four times) each turn rather than only once\./i);
  if(permission&&sourceOwner===owner&&affects(permission[1],card,owner,source,sourceOwner))limit=Math.max(limit,{'twice':2,'three times':3,'four times':4}[permission[2].toLowerCase()]);
  const timing=line.match(/^You may activate (?:the )?loyalty abilities of (.+?) on any player's turn any time you could cast an instant\./i);
  if(timing&&sourceOwner===owner&&affects(timing[1],card,owner,source,sourceOwner))instant=true;
 }
 for(const effect of g.loyaltyEffects||[])if(effect.turn===turn&&effect.owner===owner){limit=Math.max(limit,effect.limit||1);}
 limit+=(g.loyaltyEffects||[]).filter(e=>e.turn===turn&&e.owner===owner).reduce((n,e)=>n+(e.extra||0),0)+(card.loyaltyExtra?.turn===turn?card.loyaltyExtra.amount:0);
 let reason=actionRestriction(g,owner,'activate',card);
 if(reason)return {used,limit,remaining:Math.max(0,limit-used),reason,instant};
 if(card.faceDown||!availableLoyaltyAbilities(g,owner,card).length)reason='No loyalty ability is available.';
 else if(used>=limit)reason='Loyalty activation limit reached ('+used+'/'+limit+' this turn).';
 else if(g.pendingEffect||pendingLifeEntry(g))reason='Finish the pending effect first.';
 else if(g.step===0)reason='Advance to upkeep before activating abilities.';
 else if(!instant&&(g.stack.length||owner!==g.active||![3,9].includes(g.step)))reason='Activate loyalty during your main phase with an empty stack.';
 else if(g.stack.length&&(g.priority?.seat??g.stack.at(-1).owner)!==owner)reason='Another player has priority.';
 return {used,limit,remaining:Math.max(0,limit-used),reason,instant};
}
export function activateLoyaltyCost(g,owner,card,ref,x=0,options={}){
 const status=loyaltyStatus(g,owner,card);if(status.reason)throw Error(status.reason);
 const abilities=availableLoyaltyAbilities(g,owner,card),ability=getLoyaltyAbility(g,owner,card,ref);if(!ability)throw Error('Loyalty ability no longer available.');
 const result=payLoyaltyCost(card,abilities.findIndex(a=>a.key===ability.key),x,abilities,options);card.loyaltyActivations={turn:loyaltyTurn(g),used:status.used+1};return result;
}
export function applyLoyaltyPermission(g,owner,text){
 text=clean(text);let extra=0,limit=0;
 if(/^For each planeswalker you control, you may activate one of its loyalty abilities once this turn as though none of its loyalty abilities have been activated this turn\.?$/i.test(text.trim()))extra=1;
 const permission=text.trim().match(/^You may activate (?:the )?loyalty abilities of planeswalkers you control (twice|three times) this turn rather than only once\.?$/i);if(permission)limit=permission[1].toLowerCase()==='twice'?2:3;
 if(extra||limit){const turn=loyaltyTurn(g);g.loyaltyEffects=(g.loyaltyEffects||[]).filter(e=>e.turn===turn);const effect=g.loyaltyEffects.find(e=>e.owner===owner);if(effect){effect.extra+=extra;effect.limit=Math.max(effect.limit,limit);}else g.loyaltyEffects.push({turn,owner,extra,limit});}
 return !!(extra||limit);
}
export function validateLoyaltyState(g,card){
 const validTurn=value=>typeof value==='string'&&/^\d+:[0-3]$/.test(value),whole=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999;
 if(card){if(card.loyaltyActivations&&(!validTurn(card.loyaltyActivations.turn)||!whole(card.loyaltyActivations.used))||card.loyaltyExtra&&(!validTurn(card.loyaltyExtra.turn)||!whole(card.loyaltyExtra.amount))||card.loyaltyAttachment!==undefined&&typeof card.loyaltyAttachment!=='string'||card.classLevel!==undefined&&(!whole(card.classLevel)||card.classLevel<1))throw Error('Invalid loyalty state.');}
 else if(g.loyaltyEffects&&(!Array.isArray(g.loyaltyEffects)||g.loyaltyEffects.length>100||g.loyaltyEffects.some(e=>!e||!validTurn(e.turn)||!Number.isInteger(e.owner)||e.owner<0||e.owner>3||!whole(e.extra)||!whole(e.limit))))throw Error('Invalid loyalty effects.');
}

export function loyaltyAbilities(card){
 if(card.faceDown)return [];
 const face=cardFace(card);if(!/\bPlaneswalker\b/.test(face.type_line||''))return [];
 return (face.oracle_text||'').split('\n').flatMap((text,paragraph)=>{const ability=parseLoyalty(text,paragraph);return ability?[ability]:[];});
}
export function defaultAbilityPositions(card){
 const face=cardFace(card),paragraphs=(face.oracle_text||'').split('\n'),weights=paragraphs.map(text=>Math.max(1,Math.ceil(text.length/46))+.5),total=weights.reduce((a,b)=>a+b,0)||1;
 return loyaltyAbilities(card).map(ability=>({x:.104,y:.625+.25*(weights.slice(0,ability.paragraph).reduce((a,b)=>a+b,0)+.5)/total}));
}
// Standard loyalty shields form broad dark bands beside the rules text. Use
// their image positions rather than distributing buttons across equal rows.
export function detectLoyaltyPositions({data,width,height},count){
 if(!count)return [];
 const left=Math.floor(width*.065),right=Math.floor(width*.14),start=Math.floor(height*.55),end=Math.floor(height*.92),bands=[];
 let band=null;
 for(let y=start;y<end;y++){
  let dark=0;for(let x=left;x<right;x++){const i=(y*width+x)*4;if(Math.max(data[i],data[i+1],data[i+2])<100&&data[i+3]>128)dark++;}
  if(dark/Math.max(1,right-left)>.55){if(band&&y-band.end<=height*.014)band.end=y;else{band={start:y,end:y};bands.push(band);}}
 }
 const candidates=bands.filter(b=>b.end-b.start>=height*.017&&b.end-b.start<=height*.07);
 if(candidates.length===count)return candidates.map(b=>({x:.104,y:(b.start+b.end)/2/height}));
 // Retro frames print costs as text. Find the long horizontal stroke in the
 // leading +/minus sign, rather than treating wrapped effect text as abilities.
 const strokes=[];let stroke=null;
 for(let y=Math.floor(height*.6);y<height*.9;y++){
  let run=0,qualifies=false;
  for(let x=Math.floor(width*.123);x<width*.16;x++){const i=(y*width+x)*4;if(Math.max(data[i],data[i+1],data[i+2])<90&&data[i+3]>128){run++;if(run>=width*.02)qualifies=true;}else run=0;}
  if(qualifies){if(stroke&&y-stroke.end<height*.006)stroke.end=y;else{stroke={start:y,end:y};strokes.push(stroke);}}
 }
 const textCosts=strokes.filter(b=>b.end-b.start>=height*.001&&b.end-b.start<height*.006);
 return textCosts.length===count?textCosts.map(b=>({x:.155,y:(b.start+b.end)/2/height})):null;
}
export function payLoyaltyCost(card,index,x=0,abilities=loyaltyAbilities(card),{deferPositive=false}={}){
 const ability=abilities[index];if(!ability)throw Error('Loyalty ability not found.');
 if(!Number.isSafeInteger(x)||x<0)throw Error('X must be a nonnegative whole number.');
 const delta=ability.variable?ability.sign*x:ability.delta,current=card.counters?.loyalty??0,next=current+delta;
 if(next<0)throw Error('Not enough loyalty to pay this ability’s cost.');
 if(!Number.isSafeInteger(next))throw Error('Loyalty value is too large.');
 // Activations defer positive placement to the shared replacement plan after
 // putting the ability on the stack. Negative costs remove counters directly;
 // preserve explicit zero so state-based actions see a depleted planeswalker.
 if(!deferPositive||delta<=0){card.counters??={};card.counters.loyalty=next;}
 return {ability,delta};
}
