import {cardFace} from './card-state.mjs';
import {isCreature,combatStats} from './creature-rules.mjs';

export function crewCandidates(g,owner,source){
 return g.players[owner].zones.battlefield.filter(c=>c.instance!==source.instance&&!c.tapped&&isCreature(c)&&Number.isSafeInteger(combatStats(g,owner,c)?.power));
}
export function crewCostError(g,owner,source,required,ids){
 const options=crewCandidates(g,owner,source);
 if(ids===undefined)return options.reduce((sum,c)=>sum+Math.max(0,combatStats(g,owner,c).power),0)<required?'Not enough untapped creature power to crew.':'';
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!options.some(c=>c.instance===id)))return 'Choose distinct untapped creatures you control to crew.';
 if(ids.reduce((sum,id)=>sum+combatStats(g,owner,options.find(c=>c.instance===id)).power,0)<required)return 'The chosen creatures do not have enough total power to crew.';
 return '';
}
export function animateVehicle(g,source){
 const card=g.players.flatMap(p=>p.zones.battlefield).find(c=>c.instance===source.instance&&(c.battlefieldId||null)===(source.battlefieldId||null));
 if(card&&!card.faceDown&&/\bVehicle\b/.test(cardFace(card).type_line||''))card.animatedCreature=true;
}
