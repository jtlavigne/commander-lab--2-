import {activeRuleParagraphs,normalizeRules} from './ability-effects.mjs';
import {enterPermanents} from './oracle-effects.mjs';
import {matchingToken} from './token-catalog.mjs';
import {transfer} from './engine.mjs';
import {queueCombatTriggers,snapshotCard} from './combat-effects.mjs';
import {attackTargets} from './combat.mjs';
import {publicManifest} from './face-down-state.mjs';

// Token construction is shared by spells, triggered abilities and manual setup.
// Replacement providers can modify these definitions without card-name cases.
export function createTokens(g,owner,definition,amount=1,options={}){
 const {cards}=prepareTokenEntries(g,owner,definition,amount,options);
 for(const card of cards){g.players[owner].zones.hand.push(card);transfer(g,card.instance,'battlefield',owner,undefined,{deferTriggers:true,entryTapped:!!options.tapped});}
 if(!options.deferTriggers)queueCombatTriggers(g,cards.flatMap(card=>[{kind:'enter',owner,card:snapshotCard(card)},{kind:'create-token',owner,card:snapshotCard(card)}]));
 return cards;
}
// Deterministic token-count replacements compose once per live provider.
// Creation and entry counters are separate events: a token can be doubled in
// number, then each member has its entering counters replaced independently.
export function tokenCreationCount(g,owner,amount){
 if(!g.players[owner]||!Number.isSafeInteger(amount)||amount<0||amount>500)throw Error('Choose a token count from 0 to 500.');
 for(const source of g.players[owner].zones.battlefield)if(!source.faceDown)for(const {text} of activeRuleParagraphs(source)){
  const rule=normalizeRules(text).replace(/\s*\([^()]*\)\s*/g,' ').trim();
  if(/^(?:If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead|If one or more tokens would be created under your control, twice that many of those tokens are created instead)\.$/i.test(rule))amount*=2;
 }
 if(amount>500)throw Error('Token replacements would create more than 500 tokens.');return amount;
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

// Copiable values (CR 707) exclude counters, damage, temporary grants, linked
// exile counts and Vehicle animation. Rules text, not the generic Copy token's
// reminder text, supplies every activated, triggered and static ability.
export function tokenCopyDefinition(source,{nonlegendary=false}={}){
 if(source.faceDown)source=publicManifest(source);
 const fields=['id','name','mana_cost','cmc','type_line','oracle_text','power','toughness','loyalty','defense','colors','color_indicator','color_identity','keywords','image_uris','localImages','artworkVersion','layout'];
 const pick=card=>Object.fromEntries(fields.filter(key=>card[key]!==undefined).map(key=>[key,structuredClone(card[key])]));
 const definition=pick(source);
 if(source.card_faces?.length){definition.card_faces=source.card_faces.map(pick);definition.face=source.face||0;}
 if(nonlegendary)for(const face of [definition,...(definition.card_faces||[])])face.type_line=(face.type_line||'').replace(/\bLegendary\s*/g,'').trim();
 return definition;
}
// Staged tokens remain in the saved entry request, outside all card zones,
// until replacement choices finish. No temporary hand card is exposed or
// mistaken for a draw, and the source definition is captured only once.
export function prepareTokenEntries(g,owner,definition,amount=1,{tapped=false,useTemplate=true}={}){
 amount=tokenCreationCount(g,owner,amount);
 const template=useTemplate&&matchingToken([...(g.players[owner].tokenCatalog||[]),...g.players.filter((_,i)=>i!==owner).flatMap(p=>p.tokenCatalog||[])],definition);
 const value={oracle_text:'',...(template||{}),...definition};delete value.tokenTemplate;
 const cards=Array.from({length:amount},()=>({...structuredClone(value),instance:crypto.randomUUID(),token:true,ownerSeat:owner,counters:{},face:value.face||0}));
 return {cards,requests:cards.map(token=>({id:token.instance,owner,token,entryTapped:tapped}))};
}
export function createTokenCopies(g,owner,source,amount=1,options={}){
 const {cards,requests}=prepareTokenEntries(g,owner,tokenCopyDefinition(source,options),amount,{...options,useTemplate:false});
 enterPermanents(g,{owner,name:'Create token copy',source:snapshotCard(source)},requests);
 return cards;
}
