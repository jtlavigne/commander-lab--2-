import {cardFace} from './card-state.mjs';
import {normalizeRules} from './ability-effects.mjs';
import {findCard} from './engine.mjs';
import {protectedFrom} from './creature-rules.mjs';

export const isAura=card=>!card.faceDown&&/\bAura\b/.test(cardFace(card).type_line||'');
export function auraTargetText(card){
 if(card.attachmentMode==='reanimated')return 'target creature.';
 if(/(?:^|\n)Enchant creature card in a graveyard(?:$|\n)/i.test(normalizeRules(cardFace(card).oracle_text)))return 'target creature card from a graveyard.';
 const enchant=normalizeRules(cardFace(card).oracle_text).match(/(?:^|\n)Enchant (creature|planeswalker|land|artifact|enchantment|permanent)( you control)?(?:$|\n)/i);
 return enchant?'target '+enchant[1]+(enchant[2]||'')+'.':null;
}
export function attachmentLegal(g,source,target){
 if(!source||!target||source.card.faceDown)return false;
 const card=source.card,recipient=target.card,type=recipient.faceDown?'Creature':cardFace(recipient).type_line||'';
 if(isAura(card)&&!card.attachmentMode&&auraTargetText(card)==='target creature card from a graveyard.')return target.zone==='graveyard'&&/\bCreature\b/.test(type)&&(card.attachedZoneChangeId===undefined||card.attachedZoneChangeId===(recipient.zoneChangeId||null));
 if(target.zone!=='battlefield')return false;
 if(card.attachmentMode==='reanimated'&&(!card.reanimationLink||card.reanimationLink.id!==recipient.instance||card.reanimationLink.battlefieldId!==recipient.battlefieldId))return false;
 if(card.instance===recipient.instance||card.attachedBattlefieldId!==undefined&&card.attachedBattlefieldId!==(recipient.battlefieldId||null)||protectedFrom(g,target.owner,recipient,card))return false;
 if(/\bEquipment\b/.test(cardFace(card).type_line||''))return /\bCreature\b/.test(type)&&!/\bCreature\b/.test(cardFace(card).type_line||'');
 const text=auraTargetText(card),match=text?.match(/^target (\w+)( you control)?/);
 return !!match&&(match[1]==='permanent'||new RegExp('\\b'+match[1]+'\\b','i').test(type))&&(!match[2]||source.owner===target.owner);
}
export function attachPermanent(g,id,targetId){
 const source=findCard(g,id),target=findCard(g,targetId);if(source?.zone!=='battlefield')return false;
 const candidate={...source,card:{...source.card,attachedBattlefieldId:undefined}};
 if(!attachmentLegal(g,candidate,target))return false;
 source.card.attachedTo=targetId;if(target.zone==='graveyard'){source.card.attachedZoneChangeId=target.card.zoneChangeId||null;delete source.card.attachedBattlefieldId;}else{source.card.attachedBattlefieldId=target.card.battlefieldId||null;delete source.card.attachedZoneChangeId;}return true;
}
