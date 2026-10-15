import {cardFace} from './card-state.mjs';
import {fieldCards,combatStats,isCreature,rulesText} from './creature-rules.mjs';

// Evaluate reductions from live characteristics, rather than modifying printed costs.
// Generic reductions never remove colored requirements (CR 601.2f, 118.7).
export function genericReduction(g,owner,spell){
 const face=cardFace(spell);let reduction=0;
 const creatureCount=(face.oracle_text||'').match(/^This spell costs \{(\d+)\} less to cast for each creature on the battlefield\.$/im);if(creatureCount)reduction+=Number(creatureCount[1])*fieldCards(g).filter(({card})=>isCreature(card)).length;
 for(const {card:source,owner:controller} of fieldCards(g))if(controller===owner&&!source.faceDown)for(const text of rulesText(source).split('\n')){
  const power=text.match(/^Creature spells you cast with power (\d+) or greater cost \{(\d+)\} less to cast\.$/i);
  const spellPower=/power and toughness are each equal to the number of lands you control/i.test(face.oracle_text||'')?g.players[owner].zones.battlefield.filter(c=>!c.faceDown&&/\bLand\b/.test(cardFace(c).type_line||'')).length:Number(face.power);
  if(power&&isCreature(spell)&&spellPower>=Number(power[1]))reduction+=Number(power[2]);
  const pair=text.match(/^Instant and sorcery spells you cast cost \{(\d+)\} less to cast\.$/i);if(pair&&/\b(?:Instant|Sorcery)\b/.test(face.type_line||''))reduction+=Number(pair[1]);
  const experience=text.match(/^Instant and sorcery spells you cast cost \{(\d+)\} less to cast for each (\w+) counter you have\.$/i);if(experience&&/\b(?:Instant|Sorcery)\b/.test(face.type_line||''))reduction+=Number(experience[1])*(g.players[owner].counters?.[experience[2].toLowerCase()]||0);
  const plain=text.match(/^(?:(Creature|Artifact|Enchantment|Instant|Sorcery|Planeswalker) spells|Spells) you cast cost \{(\d+)\} less to cast\.$/i);
  if(plain&&(!plain[1]||new RegExp('\\b'+plain[1]+'\\b','i').test(face.type_line||'')))reduction+=Number(plain[2]);
 }
 const opponentColor=(face.oracle_text||'').match(/^This spell costs \{(\d+)\} less to cast if an opponent controls a (white|blue|black|red|green) permanent\.$/im);if(opponentColor&&fieldCards(g).some(({card,owner:controller})=>controller!==owner&&!card.faceDown&&(cardFace(card).colors||[]).includes({white:'W',blue:'U',black:'B',red:'R',green:'G'}[opponentColor[2].toLowerCase()])))reduction+=Number(opponentColor[1]);
 if(/^This spell costs \{X\} less to cast, where X is the total power of creatures you control\.$/im.test(face.oracle_text||''))reduction+=g.players[owner].zones.battlefield.filter(isCreature).reduce((sum,c)=>sum+(Number(combatStats(g,owner,c)?.power)||0),0);
 return Math.max(0,reduction);
}
export function optionalLifeReductions(g,owner,spell){
 const face=cardFace(spell);if(/\b(?:Instant|Sorcery|Land)\b/.test(face.type_line||''))return [];
 const colors={white:'W',blue:'U',black:'B',red:'R',green:'G'};
 return fieldCards(g).flatMap(({card,owner:controller})=>{
  if(controller!==owner||card.faceDown)return [];const m=rulesText(card).match(/As an additional cost to cast (white|blue|black|red|green) permanent spells, you may pay 2 life\. Those spells cost \{([WUBRG])\} less to cast if you paid life this way\./i);
  return m&&(face.colors||[]).includes(colors[m[1].toLowerCase()])?[{id:card.instance,name:card.name,color:m[2],life:2}]:[];
 });
}
export function adjustedColoredCost(g,owner,spell,choices=[],baseCost=cardFace(spell).mana_cost){
 if(!Array.isArray(choices)||new Set(choices).size!==choices.length)return null;
 const options=optionalLifeReductions(g,owner,spell);let cost=baseCost,life=0;
 for(const id of choices){const option=options.find(o=>o.id===id);if(!option)return null;cost=cost.replace('{'+option.color+'}','');life+=option.life;}
 return {cost,life};
}
