import {cardFace} from './card-state.mjs';

const creature=card=>/\bCreature\b/.test(cardFace(card).type_line||'');
export function pairedPartner(g,owner,card){
 const pair=card.pairedWith,partner=pair&&g.players[owner].zones.battlefield.find(c=>c.instance===pair.id&&c.battlefieldId===pair.battlefieldId);
 return creature(card)&&partner&&creature(partner)&&partner.pairedWith?.id===card.instance&&partner.pairedWith.battlefieldId===card.battlefieldId?partner:null;
}
export function refreshPairs(g){for(const [owner,p] of g.players.entries())for(const c of p.zones.battlefield)if(c.pairedWith&&!pairedPartner(g,owner,c))delete c.pairedWith;}
export function soulbondOptions(g,owner,source,event){
 const live=g.players[owner].zones.battlefield.find(c=>c.instance===source.instance&&c.battlefieldId===source.battlefieldId);if(!live||!creature(live)||pairedPartner(g,owner,live))return [];
 return g.players[owner].zones.battlefield.filter(c=>c.instance!==live.instance&&creature(c)&&!pairedPartner(g,owner,c)&&(event.card.instance===source.instance||c.instance===event.card.instance&&c.battlefieldId===event.card.battlefieldId));
}
export function pairCreatures(g,owner,source,event,id){
 const partner=soulbondOptions(g,owner,source,event).find(c=>c.instance===id);if(!partner)throw Error('Choose an unpaired creature you control.');
 const card=g.players[owner].zones.battlefield.find(c=>c.instance===source.instance);card.pairedWith={id:partner.instance,battlefieldId:partner.battlefieldId};partner.pairedWith={id:card.instance,battlefieldId:card.battlefieldId};
}
