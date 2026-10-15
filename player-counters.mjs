import {cardFace} from './card-state.mjs';

export function playerCounters(player){return {...(player.counters||{}),poison:player.poison||0};}
export function addPlayerCounter(g,owner,kind,amount=1){
 const player=g.players[owner];if(player?.eliminated)return;
 if(!player||!Number.isSafeInteger(amount)||amount<0)throw Error('Invalid player counter amount.');
 if(player.zones.battlefield.some(card=>!card.faceDown&&new RegExp(kind==='poison'?"You can't (?:get poison counters|get counters)\\.":"You can't get counters\\.",'i').test(cardFace(card).oracle_text||'')))return;
 if(kind==='poison')player.poison+=amount;else{player.counters??={};player.counters[kind]=(player.counters[kind]||0)+amount;}
}
