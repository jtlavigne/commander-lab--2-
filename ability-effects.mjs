import {cardFace} from './card-state.mjs';
import {pairedPartner} from './soulbond.mjs';

// ---- Rules-text normalization and active paragraphs ----
// Keep original Oracle metadata intact; consumers match a normalized view.
export const normalizeRules=text=>(text||'').replace(/’/g,"'").replace(/[−–]/g,'-');
export function graveyardCardTypes(player){const types=new Set();for(const card of player.zones.graveyard)for(const type of ['Artifact','Battle','Creature','Enchantment','Instant','Kindred','Land','Planeswalker','Sorcery'])if(new RegExp('\\b'+type+'\\b').test(cardFace(card).type_line||''))types.add(type);return types;}
export function loyaltyCostSymbol(value){
 let cost=normalizeRules(value).trim();if(cost.startsWith('[')&&cost.endsWith(']'))cost=cost.slice(1,-1);
 return /^[+-]?(?:\d+|X)$/i.test(cost)?cost.toUpperCase():null;
}
export function activeRuleParagraphs(card){
 // Class text beyond the current level is inactive. Preserve original indices
 // because granted-ability keys and layout positions use paragraph identity.
 let level=1;return (cardFace(card).oracle_text||'').split('\n').flatMap((text,index)=>{const match=text.match(/Level (\d+)/i);if(match){level=Number(match[1]);return [];}return level<=(card.classLevel||1)?[{text,index}]:[];});
}
// ---- Shared recipient selectors ----
// `owner` and `sourceOwner` are current controllers in this query. Printed card
// ownership remains separate, particularly after a battlefield control change.
export function matchesAbilityRecipient(subject,card,owner,source,sourceOwner){
 subject=normalizeRules(subject).trim().toLowerCase();const type=(cardFace(card).type_line||'').toLowerCase();
 const enchanted=subject.match(/^enchanted (planeswalker|creature|land|artifact|permanent)$/);
 if(enchanted)return (source.loyaltyAttachment||source.manaSettings?.attachedTo||source.attachedTo)===card.instance&&(enchanted[1]==='permanent'||type.includes(enchanted[1]));
 if(subject==='equipped creature')return source.attachedTo===card.instance&&type.includes('creature');
 const tribe=subject.match(/^(?:each )?(other )?([a-z]+)s? you control$/);
 if(tribe&&type.includes('creature')&&owner===sourceOwner&&(!tribe[1]||card.instance!==source.instance)){
  const subtype=tribe[2].replace(/s$/,'');if((type.split('—')[1]||'').trim().split(/\s+/).includes(subtype))return true;
 }
 const union=subject.match(/^each (other )?creature you control that's (.+)$/);
 if(union)return type.includes('creature')&&owner===sourceOwner&&(!union[1]||card.instance!==source.instance)&&union[2].replace(/\b(?:a|an|or)\b|,/g,' ').trim().split(/\s+/).some(t=>(type.split('—')[1]||'').trim().split(/\s+/).includes(t));
 if(subject===normalizeRules(cardFace(card).name||card.name).toLowerCase())return card.instance===source.instance;
 const match=subject.match(/^(?:each )?(other )?(nonland )?(planeswalkers?|creatures?|lands?|artifacts?|enchantments?|permanents?|auras?|equipment|vehicles?)(?: (you control|your opponents control))?(?: (with a counter on it|with counters? on them))?$/);if(!match)return false;
 const kind=match[3].replace(/s$/,'');
 if(match[1]&&source.instance===card.instance||match[2]&&type.includes('land')||match[5]&&!Object.values(card.counters||{}).some(n=>n>0))return false;
 return (kind==='permanent'||type.includes(kind))&&(!match[4]||match[4]==='you control'&&owner===sourceOwner||match[4]==='your opponents control'&&owner!==sourceOwner);
}
export const BASIC_LAND_TYPES=['Plains','Island','Swamp','Mountain','Forest'];
// ---- Live land types ----
// Derive live subtypes without changing printed metadata or the Basic supertype.
// Additive type effects preserve the land's existing abilities and subtypes.
export function effectiveLandSubtypes(g,owner,card){
 const type=cardFace(card).type_line||'';if(card.faceDown||!/\bLand\b/.test(type))return [];
 const subtypes=new Set((type.split('—')[1]||'').trim().split(/\s+/).filter(Boolean));
 for(const [sourceOwner,player] of g.players.entries())for(const source of [...player.zones.battlefield,...(player.emblems||[])])if(!source.faceDown&&source.manaSettings?.mode!=='ignore')for(const {text} of activeRuleParagraphs(source)){
  const effect=normalizeRules(text).trim().match(/^(.+?) (?:is|are) (every basic land type|(?:a |an )?(?:Plains|Island|Swamp|Mountain|Forest)) in addition to (?:its|their) other(?: land)? types\.(?:\s*\([^]*\))?$/i);
  if(!effect||!matchesAbilityRecipient(effect[1],card,owner,source,sourceOwner))continue;
  for(const subtype of BASIC_LAND_TYPES)if(effect[2].toLowerCase()==='every basic land type'||effect[2].toLowerCase().endsWith(subtype.toLowerCase()))subtypes.add(subtype);
 }
 return [...subtypes];
}
// ---- Live granted abilities ----
// Continuous grants are discovered without rewriting printed Oracle text.
// Mana, loyalty and future ability consumers interpret the same descriptors.
export function grantedAbilities(g,owner,card){
 if(card.faceDown&&!card.manifested)return [];const result=[];
 for(const [sourceOwner,player] of g.players.entries())for(const source of [...player.zones.battlefield,...(player.emblems||[])])if(!source.faceDown)for(const {text,index:paragraph} of activeRuleParagraphs(source)){
  const paired=text.match(/^As long as (.+?) is paired with another creature, each of those creatures has (.+)$/i);
  if(paired){const partner=pairedPartner(g,sourceOwner,source);if(partner&&owner===sourceOwner&&[source.instance,partner.instance].includes(card.instance))for(const [index,match] of [...paired[2].matchAll(/["“]([^"”]+)["”]/g)].entries())result.push({key:'paired:'+source.instance+':'+paragraph+':'+index,text:match[1],sourceId:source.instance,sourceName:source.name,paragraph});continue;}
  const grant=text.replace(/ (?:get|gets) [+-]\d+\/[+-]\d+(?: for each [^.]+?)? and (?:have|has) /i,' have ').match(/^(.+?) (?:have|has|gain|gains)\s+([\s\S]+)$/i);if(!grant||!matchesAbilityRecipient(grant[1],card,owner,source,sourceOwner))continue;
  for(const [index,match] of [...grant[2].matchAll(/["“]([^"”]+)["”]/g)].entries())result.push({key:'granted:'+source.instance+':'+paragraph+':'+index,text:match[1],sourceId:source.instance,sourceName:source.name,paragraph});
 }return result;
}
