import {cardFace} from './card-state.mjs';
import {castableSpellPayment} from './casting.mjs';
import {castingPermission} from './spell-rules.mjs';
import {manaAbilities,activationError,manaModifiers,productionChoices,produceMana,payMana,MANA_TYPES} from './mana.mjs';

// Only model immediate, finite activations whose costs can be paid without a
// separate choice. Stack abilities and sacrifices of other cards stay manual.
function previewable(ability){
 return ability.output&&(ability.tap||ability.sacrifice)&&!ability.untap&&!ability.exileSelf&&!ability.discardSelf&&!ability.exertSelf&&!ability.usesStack&&!ability.manualCost&&!ability.sacrificeType&&!ability.discardCount&&!ability.counterRemoval&&!ability.output.manual&&!ability.output.combination;
}

// A preview proves payment is possible; it never reserves mana or changes the
// table. Real casting still pays through the normal command/payment validator.
export function previewSpellMana(g,owner,{maxStates=2048}={}){
 const player=g.players[owner],result=new Map();
 if(!player||player.eliminated||g.result)return result;
 const pending=['hand','command','graveyard','exile'].flatMap(zone=>player.zones[zone]
  .filter(card=>!card.hidden&&!card.faceDown&&!/\bLand\b/.test(cardFace(card).type_line||'')&&castingPermission(g,owner,card,zone))
  .map(card=>({card,zone})));
 const check=game=>{for(let i=pending.length-1;i>=0;i--){const {card,zone}=pending[i];if(castingPermission(game,owner,card,zone)&&castableSpellPayment(game,owner,card,zone)){result.set(card.instance,{floating:game===g});pending.splice(i,1);}}};
 check(g);if(!pending.length)return result;
 const sources=player.zones.battlefield.filter(c=>!c.hidden&&!c.faceDown).map(c=>c.instance);
 // Fold mana lots by payment qualities, not source labels, to avoid exploring
 // identical color choices repeatedly. Keep restrictions and snow distinct.
 const poolKey=p=>{const totals=new Map();for(const lot of p.mana||[]){const key=JSON.stringify([lot.type,!!lot.snow,lot.restriction||'']);totals.set(key,(totals.get(key)||0)+lot.amount);}return JSON.stringify([...totals].sort());};
 const visited=new Set();let examined=0;
 function search(game,used){
  if(!pending.length||examined++>=maxStates)return;
  const stateKey=JSON.stringify([[...used].sort(),game.players[owner].life,poolKey(game.players[owner]),game.players[owner].zones.battlefield.map(c=>[c.instance,c.tapped,c.counters])]);
  if(visited.has(stateKey))return;visited.add(stateKey);
  const equivalent=new Set();
  for(const id of sources){
   if(used.has(id))continue;
   // Re-read grants and source presence after each simulated activation: a
   // sacrificed permanent cannot keep supplying mana or granting abilities.
   const card=game.players[owner].zones.battlefield.find(c=>c.instance===id);if(!card)continue;
   const abilities=manaAbilities(game,owner,card).filter(previewable);
   for(const ability of abilities){
    if(activationError(game,owner,card,ability,{allowLife:false}))continue;
    const output=ability.output,base=output.alternatives?output.alternatives.map((_,outputIndex)=>({outputIndex})):output.colors?output.colors.map(color=>({color})):[{}];
    for(const choice of base){
     let choices=[choice];
     try{
      const counts=productionChoices(game,owner,card,output,choice),produced=Object.keys(counts).filter(t=>counts[t]>0);
      for(const effect of manaModifiers(game,owner,card,{tap:ability.tap}))if(effect.color==='choice'||effect.color==='produced'){
       const colors=effect.color==='choice'?MANA_TYPES:produced;
       choices=choices.flatMap(c=>colors.map(color=>({...c,bonusColors:{...c.bonusColors,[effect.card.instance]:color}}))).slice(0,maxStates);
      }
     }catch{continue;} // Unknown quantities need a manual activation, not a guessed highlight.
     for(const selection of choices){
      if(examined>=maxStates||!pending.length)return;
      // Match activation order without invoking priority, triggers, or UI:
      // calculate output, pay costs, then produce mana on an isolated board.
      const current=game.players[owner],source={...card,counters:{...card.counters}},p={...current,mana:(current.mana||[]).map(l=>({...l})),counters:{...current.counters},zones:{...current.zones,battlefield:current.zones.battlefield.map(c=>c.instance===id?source:c)}},next={...game,players:game.players.map((other,i)=>i===owner?p:other)};
      try{
       const counts=productionChoices(game,owner,card,output,selection);
       if(ability.manaCost)payMana(p,card,ability.manaCost,{ability:true,allowLife:false});
       p.life-=ability.lifeCost||0;
       if(ability.counterCost){source.counters[ability.counterCost.kind]-=ability.counterCost.amount;if(!source.counters[ability.counterCost.kind])delete source.counters[ability.counterCost.kind];}
       if(ability.tap)source.tapped=true;
       if(ability.sacrifice)p.zones.battlefield=p.zones.battlefield.filter(c=>c.instance!==id);
       produceMana(next,owner,source,{...ability,output:{...output,fixed:counts,variable:false,alternatives:null,manual:false,colors:null}},selection);
      }catch{continue;}
      // Identical basic lands are interchangeable for this search; retain
      // distinct abilities/modifiers so filter lands still get their own turn.
      const signature=JSON.stringify([ability.sacrifice||ability.counterCost?id:null,abilities,cardFace(card).type_line,card.counters,manaModifiers(game,owner,card,{tap:ability.tap}),p.life,poolKey(p)]);
      if(equivalent.has(signature))continue;equivalent.add(signature);
      check(next);search(next,new Set([...used,card.instance]));
     }
    }
   }
  }
 }
 search(g,new Set());return result;
}
