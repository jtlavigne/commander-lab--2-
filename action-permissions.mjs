import {cardFace} from './card-state.mjs';
import {activeRuleParagraphs,normalizeRules} from './ability-effects.mjs';

// ---- Restrictions shared by action previews and payment ----
// "Can't" effects win over permissions; check live providers for both UI queries
// and cost payment. A source leaving immediately removes its restriction.
export function actionRestriction(g,owner,kind,card){
 // Split second restricts spells and nonmana activations while its spell is
 // on the stack. Mana abilities and triggered abilities can still happen.
 if(kind!=='mana'&&g.stack.some(entry=>entry.card&&/(?:^|\n)Split second\b/i.test(cardFace(entry.card).oracle_text||'')))return 'Split second prevents casting spells and activating nonmana abilities.';
 if(kind==='cast'&&g.players[owner].noncreatureLock===g.turn+':'+g.active&&!/\bCreature\b/.test(cardFace(card).type_line||''))return 'This player cannot cast noncreature spells this turn.';
 for(const [controller,player] of g.players.entries())for(const source of player.zones.battlefield)if(!source.faceDown)for(const {text:raw} of activeRuleParagraphs(source)){
  const text=normalizeRules(raw),lock=text.match(/^During your turn, your opponents can't cast spells or activate abilities of (.+?)\.$/i);
  if(!lock||g.active!==controller||owner===controller)continue;
  // Match the restricted permanent categories as a union. A creature/artifact
  // only needs one matching category for its activation to be prohibited.
  const types=lock[1].replace(/,?\s+(?:and|or)\s+/gi,',').split(/,\s*/).map(type=>type.trim().replace(/s$/i,''));
  if(kind==='cast'||['activate','mana'].includes(kind)&&types.some(type=>new RegExp('\\b'+type+'\\b','i').test(cardFace(card).type_line||'')))return source.name+' prevents this action during its controller’s turn.';
 }
 return '';
}
