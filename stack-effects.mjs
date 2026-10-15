import {transfer} from './engine.mjs';
import {cardFace} from './card-state.mjs';
import {queueCombatTriggers,snapshotCard} from './combat-effects.mjs';
import {recordPlay} from './play-events.mjs';

export function counterSpell(g,target,controller,source){
 const entry=g.stack.find(e=>e.card?.instance===target.id&&e.card.zoneChangeId===target.zoneChangeId);if(!entry)return null;
 const card=snapshotCard(entry.card),owner=entry.owner;
 const uncounterable=/This spell can't be countered\./i.test(cardFace(entry.card).oracle_text||'')||g.players[owner].zones.battlefield.some(provider=>!provider.faceDown&&(cardFace(provider).oracle_text||'').split('\n').some(text=>{const m=text.match(/^(Creature|Instant|Sorcery|Artifact|Enchantment) spells you control can't be countered\.$/i);return m&&new RegExp('\\b'+m[1]+'\\b','i').test(cardFace(entry.card).type_line||'');}));
 if(!uncounterable){transfer(g,card.instance,'graveyard',card.ownerSeat??owner);queueCombatTriggers(g,[{kind:'counter-spell',owner:controller,card:source,targetSpell:card}]);}
 return {owner,card,countered:!uncounterable};
}

export function copySpell(g,target,owner,options={}){
 const original=g.stack.find(e=>e.card?.instance===target.id&&e.card.zoneChangeId===target.zoneChangeId);if(!original)return null;
 return copyStackEntry(g,original,owner,options);
}
export function copyStackEntry(g,original,owner,{colors}={}){
 const entry=structuredClone(original);entry.owner=owner;entry.copy=true;delete entry.manualPlacement;delete entry.resolving;delete entry.castFrom;
 entry.card={...entry.card,instance:crypto.randomUUID(),zoneChangeId:crypto.randomUUID(),ownerSeat:owner,spellCopy:true};
 if(colors){entry.card.colors=[...colors];if(entry.card.card_faces)entry.card.card_faces[entry.card.face||0].colors=[...colors];}
 for(const key of ['commander','commandSlot','commandCasts','tablePosition','battlefieldId','manaActivation'])delete entry.card[key];
 g.stack.push(entry);queueCombatTriggers(g,[{kind:'copy',owner,card:snapshotCard(entry.card),x:entry.castX||0}]);
 recordPlay(g,{kind:'copy',owner,source:entry.card,text:entry.spellText||cardFace(entry.card).oracle_text,targets:entry.targets||[],stackId:entry.card.instance});return entry;
}
