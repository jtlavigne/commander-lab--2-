import {findCard} from './engine.mjs';
import {cardFace} from './card-state.mjs';
import {attachmentLegal} from './attachments.mjs';
export function armorOptions(g,id){
 const target=findCard(g,id);if(target?.zone!=='battlefield')return [];
 return g.players.flatMap((p,owner)=>p.zones.battlefield.filter(card=>!card.faceDown&&card.attachedTo===id&&/(?:^|\n)(?:Umbra armor|Totem armor)\b/i.test(cardFace(card).oracle_text||'')&&attachmentLegal(g,{card,owner},target)));
}
export function chooseDestructionReplacement(g,found,resume){
 const options=armorOptions(g,found.card.instance);if(options.length<=1)return options[0]||null;
 const chosen=options.find(c=>c.instance===found.card.armorChoice?.id&&(c.battlefieldId||null)===found.card.armorChoice.battlefieldId);if(chosen)return chosen;
 g.pendingEffect={kind:'destruction-choice',owner:found.owner,name:found.card.name,id:found.card.instance,battlefieldId:found.card.battlefieldId||null,resume};return undefined;
}
export function destructionChoiceOptions(g){return g.pendingEffect?.kind==='destruction-choice'?armorOptions(g,g.pendingEffect.id):[];}
