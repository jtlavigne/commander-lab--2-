import {findCard,transfer,note} from './engine.mjs';
import {cardFace} from './card-state.mjs';
import {payMana,paymentPlan} from './mana.mjs';
import {prioritySeat} from './casting.mjs';

export function manifestTop(g,owner){
 const card=g.players[owner].zones.library[0];if(!card)return;
 // A prior public instance handle must not identify a card coming out of a
 // concealed, shuffled library. Commander designation remains public.
 if(!card.commander)card.instance=crypto.randomUUID();
 card.faceDown=true;card.manifested=true;card.face=0;transfer(g,card.instance,'battlefield',owner);return card;
}
export function manifestFaceUpError(g,owner,card){
 if(!card.faceDown||!card.manifested)return 'This is not a manifested permanent.';
 if(g.pendingEffect||g.step===0)return 'Wait until you have priority.';
 if(prioritySeat(g)!==owner)return 'Another player has priority.';
 const face=cardFace({...card,manifested:false,faceDown:false,face:0});
 if(!/\bCreature\b/.test(face.type_line||'')||!face.mana_cost)return 'Only a creature card with a mana cost can turn face up this way.';
 if(!paymentPlan(g.players[owner],face,face.mana_cost,{ability:true}))return 'Not enough eligible floating mana to turn this card face up.';
 return '';
}
export function turnManifestFaceUp(g,id){
 const found=findCard(g,id);if(found?.zone!=='battlefield')throw Error('Manifested permanent not found.');
 const {card,owner}=found,error=manifestFaceUpError(g,owner,card);if(error)throw Error(error);
 const face=cardFace({...card,manifested:false,faceDown:false,face:0});payMana(g.players[owner],face,face.mana_cost,{ability:true});
 card.faceDown=false;delete card.manifested;card.face=0;g.priority={seat:owner,passes:0};note(g,g.players[owner].name+' turns '+face.name+' face up.');
}
