import {cardFace} from './card-state.mjs';
import {activeRuleParagraphs,normalizeRules} from './ability-effects.mjs';

// A replacement changes one copy event's count. It is applied once to the
// entire batch, rather than again to each individual copy or saved choice.
export function spellCopyCount(g,owner,count){
 if(!count)return 0;
 for(const card of g.players[owner].zones.battlefield)if(!card.faceDown)for(const {text} of activeRuleParagraphs(card))if(/^If you would copy a spell one or more times, instead copy it that many times plus an additional time\./i.test(normalizeRules(text)))count++;
 return count;
}
export function spellTriggerCount(observers,owner,event){
 const caster=event.kind==='targeted-spell'?event.spellOwner:event.owner,spell=event.kind==='targeted-spell'?event.spellCard:event.card;
 if(!['cast','copy','targeted-spell','spent-mana'].includes(event.kind)||caster!==owner||!/\b(?:Instant|Sorcery)\b/.test(cardFace(spell||{}).type_line||''))return 1;
 let count=1;
 for(const source of observers)if(source.owner===owner&&!source.card.faceDown)for(const {text} of activeRuleParagraphs(source.card))if(/^If you casting or copying an instant or sorcery spell causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time\.$/i.test(normalizeRules(text)))count++;
 return count;
}
