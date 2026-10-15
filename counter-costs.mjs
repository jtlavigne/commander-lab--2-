import {cardFace} from './card-state.mjs';

const amounts={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
// Counter removal is a cost, not counter placement: multipliers do not apply.
// A descriptor supports arbitrary counter kinds and unions of permanent types.
export function counterRemovalCost(text){
 const match=text.match(/Remove (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) (?:([+-]\d+\/[+-]\d+|[a-z]+) )?counters? from among (other )?((?:artifacts?|creatures?|planeswalkers?|enchantments?|lands?|permanents?)(?:(?:,? and |,? or |, )(?:artifacts?|creatures?|planeswalkers?|enchantments?|lands?|permanents?))*) you control/i);
 if(!match)return null;
 return {amount:amounts[match[1].toLowerCase()]??Number(match[1]),kind:match[2]?.toLowerCase()||null,other:!!match[3],types:match[4].toLowerCase().match(/artifact|creature|planeswalker|enchantment|land|permanent/g),text:match[0]};
}
export function counterCostOptions(g,owner,source,cost){
 if(!cost)return [];
 return g.players[owner].zones.battlefield.flatMap(card=>{
  const face=cardFace(card);
  if(cost.other&&card.instance===source.instance||card.faceDown&&!card.manifested||!cost.types.some(type=>type==='permanent'||new RegExp('\\b'+type+'\\b','i').test(face.type_line||'')))return [];
  return Object.entries(card.counters||{}).filter(([kind,n])=>n>0&&(!cost.kind||cost.kind===kind)).map(([kind,available])=>({id:card.instance,battlefieldId:card.battlefieldId||null,name:card.faceDown?'Face-down creature':face.name||card.name,kind,available}));
 });
}
// Validate the complete selection before any mana, life or counters are spent.
// Incarnation IDs prevent a stale dialog from paying with a returned permanent.
export function counterCostPayment(g,owner,source,cost,selection){
 const options=counterCostOptions(g,owner,source,cost),seen=new Set();
 if(!Array.isArray(selection)||selection.length>500)throw Error('Choose counters to remove as the activation cost.');
 let total=0;
 for(const part of selection){
  const option=options.find(o=>o.id===part?.id&&o.kind===part.kind&&o.battlefieldId===part.battlefieldId),key=JSON.stringify([part?.id,part?.kind]);
  if(!option||seen.has(key)||!Number.isSafeInteger(part.amount)||part.amount<=0||part.amount>option.available)throw Error('Choose available counters from eligible permanents.');
  seen.add(key);total+=part.amount;
 }
 if(total!==cost.amount)throw Error('Remove exactly '+cost.amount+' counters to pay this cost.');
 return selection.map(part=>({...part}));
}
export function payCounterCost(g,owner,selection){
 for(const part of selection){const card=g.players[owner].zones.battlefield.find(c=>c.instance===part.id);card.counters[part.kind]-=part.amount;
  // Zero loyalty/defense must remain explicit for the state-based action pass.
  if(!card.counters[part.kind]&&!['loyalty','defense'].includes(part.kind))delete card.counters[part.kind];
 }
}
