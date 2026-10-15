import {transfer} from './engine.mjs';
import {queueCombatTriggers,snapshotCard} from './combat-effects.mjs';
import {attackTargets} from './combat.mjs';

// Token construction is shared by spells, triggered abilities and manual setup.
// Replacement providers can modify these definitions without card-name cases.
export function createTokens(g,owner,definition,amount=1,{tapped=false,deferTriggers=false}={}){
 if(!g.players[owner]||!Number.isSafeInteger(amount)||amount<0||amount>500)throw Error('Choose a token count from 0 to 500.');
 const created=[];
 for(let i=0;i<amount;i++){
  const card={...structuredClone(definition),instance:crypto.randomUUID(),token:true,ownerSeat:owner,counters:{},face:0};
  g.players[owner].zones.hand.push(card);
  transfer(g,card.instance,'battlefield',owner,undefined,{deferTriggers:true,entryTapped:tapped});created.push(card);
 }
 if(!deferTriggers)queueCombatTriggers(g,created.map(card=>({kind:'enter',owner,card:snapshotCard(card)})));
 return created;
}
export function tokenDefenders(g,owner,defender){
 if(owner!==g.active||!g.combat||g.step<4||g.step>8)return [];
 return attackTargets(g).filter(target=>defender===undefined||target.owner===defender);
}
export function enterAttacking(g,id,target){
 const card=g.players[g.active].zones.battlefield.find(c=>c.instance===id);
 if(!card||!tokenDefenders(g,g.active).some(t=>t.key===target.key))return;
 g.combat.attackers.push({id,battlefieldId:card.battlefieldId,defender:{...target},blocked:false,enteredAttacking:true});
 g.combat.defenders=[...new Set([...g.combat.defenders,target.owner])];
 // Entering attacking is not declaring an attack: no attack event or history.
}
export function enterBlocking(g,owner,id,attacker){
 const card=g.players[owner].zones.battlefield.find(c=>c.instance===id),attack=g.combat?.attackers.find(a=>a.id===attacker?.id&&(a.battlefieldId||null)===(attacker.battlefieldId||null)&&a.defender.owner===owner);
 if(!card||!attack||!g.players[g.active].zones.battlefield.some(c=>c.instance===attack.id&&(c.battlefieldId||null)===(attack.battlefieldId||null)))return;
 g.combat.blocks.push({blocker:id,battlefieldId:card.battlefieldId,attacker:attack.id,owner,enteredBlocking:true});attack.blocked=true;g.combat.assignments={};
}

export function tokenCopyDefinition(source){
 const fields=['name','mana_cost','cmc','type_line','oracle_text','power','toughness','loyalty','colors','color_identity','keywords','image_uris','localImages'];
 return Object.fromEntries(fields.filter(key=>source[key]!==undefined).map(key=>[key,structuredClone(source[key])]));
}
