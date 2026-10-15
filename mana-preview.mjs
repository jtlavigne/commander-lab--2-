import {cardFace} from './card-state.mjs';
import {castableSpellPayment} from './casting.mjs';
import {castingPermission} from './spell-rules.mjs';
import {manaAbilities,activationError,manaModifiers,productionChoices,produceMana,payMana,MANA_TYPES} from './mana.mjs';

// A preview proves payment is possible; it never reserves mana or changes the
// table. Real casting still pays through the normal command/payment validator.
export function previewSpellMana(g,owner,{maxStates=2048}={}){
 const player=g.players[owner],result=new Map();
 if(!player||player.eliminated||g.result)return result;
 const pending=['hand','command','graveyard','exile'].flatMap(zone=>player.zones[zone]
  .filter(card=>!card.hidden&&!card.faceDown&&!/\bLand\b/.test(cardFace(card).type_line||'')&&castingPermission(g,owner,card,zone))
  .map(card=>({card,zone})));
 const check=game=>{for(let i=pending.length-1;i>=0;i--){const {card,zone}=pending[i];if(castableSpellPayment(game,owner,card,zone)){result.set(card.instance,{floating:game===g});pending.splice(i,1);}}};
 check(g);if(!pending.length)return result;
 const sources=player.zones.battlefield.filter(c=>!c.faceDown&&!c.tapped&&/\bLand\b/.test(cardFace(c).type_line||''))
  .map(card=>({card,abilities:manaAbilities(g,owner,card).filter(a=>a.tap&&!a.untap&&!a.exileSelf&&!a.discardSelf&&!a.exertSelf&&!a.usesStack&&!a.manualCost&&!a.sacrifice&&!a.sacrificeType&&!a.discardCount&&!a.counterCost&&!a.counterRemoval&&!a.output.manual&&!a.output.combination)}));
 // Fold mana lots by payment qualities, not source labels, to avoid exploring
 // identical color choices repeatedly. Keep restrictions and snow distinct.
 const poolKey=p=>{const totals=new Map();for(const lot of p.mana||[]){const key=JSON.stringify([lot.type,!!lot.snow,lot.restriction||'']);totals.set(key,(totals.get(key)||0)+lot.amount);}return JSON.stringify([...totals].sort());};
 const visited=new Set();let examined=0;
 function search(game,used){
  if(!pending.length||examined++>=maxStates)return;
  const stateKey=[...used].sort().join(',')+'|'+game.players[owner].life+'|'+poolKey(game.players[owner]);
  if(visited.has(stateKey))return;visited.add(stateKey);
  const equivalent=new Set();
  for(const {card,abilities} of sources){
   if(used.has(card.instance))continue;
   for(const ability of abilities){
    if(activationError(game,owner,card,ability))continue;
    const output=ability.output,base=output.alternatives?output.alternatives.map((_,outputIndex)=>({outputIndex})):output.colors?output.colors.map(color=>({color})):[{}];
    for(const choice of base){
     let choices=[choice];
     try{
      const counts=productionChoices(game,owner,card,output,choice),produced=Object.keys(counts).filter(t=>counts[t]>0);
      for(const effect of manaModifiers(game,owner,card))if(effect.color==='choice'||effect.color==='produced'){
       const colors=effect.color==='choice'?MANA_TYPES:produced;
       choices=choices.flatMap(c=>colors.map(color=>({...c,bonusColors:{...c.bonusColors,[effect.card.instance]:color}}))).slice(0,maxStates);
      }
     }catch{continue;} // Unknown quantities need a manual activation, not a guessed highlight.
     for(const selection of choices){
      if(examined>=maxStates||!pending.length)return;
      // Only the activating player's mana and life are mutated by these helpers.
      const p={...game.players[owner],mana:(game.players[owner].mana||[]).map(l=>({...l})),counters:{...game.players[owner].counters}},next={...game,players:game.players.map((other,i)=>i===owner?p:other)};
      try{if(ability.manaCost)payMana(p,card,ability.manaCost,{ability:true});p.life-=ability.lifeCost||0;produceMana(next,owner,card,ability,selection);}catch{continue;}
      // Identical basic lands are interchangeable for this search; retain
      // distinct abilities/modifiers so filter lands still get their own turn.
      const signature=JSON.stringify([abilities,cardFace(card).type_line,card.counters,manaModifiers(game,owner,card),p.life,poolKey(p)]);
      if(equivalent.has(signature))continue;equivalent.add(signature);
      check(next);search(next,new Set([...used,card.instance]));
     }
    }
   }
  }
 }
 search(g,new Set());return result;
}
