import {findCard,transfer} from './engine.mjs';
import {cardFace} from './card-state.mjs';

export function finishSpell(g,id){
 const entry=g.stack.find(e=>e.card?.instance===id);if(!entry)return;
 const {card,owner}=entry,rebound=entry.castFrom==='hand'&&/(?:^|\n)Rebound(?:$|[ (])/i.test(cardFace(card).oracle_text||'');
 transfer(g,id,rebound?'exile':entry.buyback?'hand':'graveyard',card.ownerSeat??owner);
 if(rebound&&findCard(g,id)?.zone==='exile')card.rebound={owner,zoneChangeId:card.zoneChangeId};
 if(g.stack.length)g.priority={seat:g.active,passes:0};else delete g.priority;
}
