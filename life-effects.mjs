import {cardFace} from './card-state.mjs';
import {effectiveLandSubtypes,matchesAbilityRecipient} from './ability-effects.mjs';

const clean=text=>(text||'').replace(/’/g,"'");
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const self=card=>'(?:'+[...new Set([cardFace(card).name,card.name?.split(' // ')[0]].filter(Boolean))].map(escape).concat('this (?:land|artifact|creature|enchantment|planeswalker|battle|permanent)').join('|')+')';
const numbers={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
const amount=text=>numbers[text.toLowerCase()]??Number(text);
// Evaluate against the battlefield BEFORE this permanent enters (CR 614.12).
// In particular a check land cannot satisfy its own condition under Dryad.
export function entryConditionMet(g,owner,card,condition){
 if(!g?.players[owner])return null;
 const field=g.players[owner].zones.battlefield.filter(c=>c!==card&&c.instance!==card.instance),text=clean(condition).trim();
 const opponents=text.match(/^you have (\w+|\d+) or (more|fewer) opponents$/i);
 if(opponents){const n=amount(opponents[1]);return Number.isFinite(n)?opponents[2].toLowerCase()==='more'?g.players.length-1>=n:g.players.length-1<=n:null;}
 const control=text.match(/^you control (.+)$/i);if(!control)return null;
 const requirement=control[1],types=requirement.match(/^(?:an? )?(?:Plains|Island|Swamp|Mountain|Forest)(?:(?:,? or |,? and |, )(?:an? )?(?:Plains|Island|Swamp|Mountain|Forest))*$/i);
 if(types){const wanted=requirement.match(/Plains|Island|Swamp|Mountain|Forest/gi).map(t=>t.toLowerCase()),have=new Set(field.flatMap(c=>effectiveLandSubtypes(g,owner,c)).map(t=>t.toLowerCase()));return /\band\b/i.test(requirement)?wanted.every(t=>have.has(t)):wanted.some(t=>have.has(t));}
 const count=requirement.match(/^(an?|one|two|three|four|five|six|seven|eight|nine|ten|\d+)(?: or (more|fewer))? (?:other )?(basic |legendary )?(lands?|creatures?|artifacts?|enchantments?|planeswalkers?|permanents?)$/i);
 if(count){const n=amount(count[1]),kind=count[4].replace(/s$/i,''),found=field.filter(c=>{if(c.faceDown)return !count[3]&&['creature','permanent'].includes(kind.toLowerCase());const type=cardFace(c).type_line||'';return (!count[3]||new RegExp('\\b'+count[3].trim()+'\\b','i').test(type))&&(kind.toLowerCase()==='permanent'||new RegExp('\\b'+kind+'\\b','i').test(type));}).length;return count[2]?.toLowerCase()==='fewer'?found<=n:found>=n;}
 if(/^a commander$/i.test(requirement))return field.some(c=>c.commander);
 return null;
}
export function entryTapState(card,g,owner,{forceTapped=false}={}){
 let tapped=forceTapped,unknown=[];
 if(!card.faceDown){
  const pattern=new RegExp('(?:^|\\n)'+self(card)+' enters(?: the battlefield)? tapped([^\\n.]*)(?:\\.|$)','gi');
  for(const [,tail] of clean(cardFace(card).oracle_text).matchAll(pattern)){
   const condition=tail.trim().match(/^(unless|if) (.+)$/i);
   if(!condition){if(!tail.trim()||/^ with /i.test(tail))tapped=true;else unknown.push(tail.trim());continue;}
   if(condition[1].toLowerCase()==='unless'&&/^you pay \d+ life$/i.test(condition[2]))continue;
   const met=entryConditionMet(g,owner,card,condition[2]);
   if(met===null)unknown.push(condition[0]);else if(condition[1].toLowerCase()==='unless'?!met:met)tapped=true;
  }
 }
 // Shared battlefield replacement effects; use the same recipient rules as
 // granted abilities. Unlike intrinsic abilities these can affect face-downs.
 if(g)for(const [sourceOwner,player] of g.players.entries())for(const source of player.zones.battlefield)if(source!==card&&source.instance!==card.instance&&!source.faceDown)for(const line of (cardFace(source).oracle_text||'').split('\n')){
  const effect=line.match(/^(.+?) enter(?:s)?(?: the battlefield)? tapped\.$/i);if(!effect)continue;
  const scope=effect[1].match(/ (you control|your opponents control)$/i)?.[0]||'';
  const recipient=card.faceDown?{...card,type_line:'Creature',card_faces:undefined}:card;
  for(const subject of effect[1].slice(0,effect[1].length-scope.length).split(/,? and |, /i))if(matchesAbilityRecipient(subject+scope,recipient,owner,source,sourceOwner))tapped=true;
 }
 return {tapped,...(!tapped&&unknown.length?{condition:unknown.join('; ')}:{})};
}
export function entersTapped(card,g,owner){
 return entryTapState(card,g,owner).tapped;
}
export function entryLifePayment(card){
 if(card.faceDown)return null;const text=clean(cardFace(card).oracle_text),subject=self(card);
 const match=text.match(new RegExp('(?:^|\\n)As '+subject+' enters(?: the battlefield)?, you may pay (\\d+) life\\. If you don\'t, it enters(?: the battlefield)? tapped\\.','i'))
  ||text.match(new RegExp('(?:^|\\n)'+subject+' enters(?: the battlefield)? tapped unless you pay (\\d+) life\\.','i'));
 return match&&Number(match[1])>0?Number(match[1]):null;
}
export function pendingEntry(g){
 for(const [owner,player] of g.players.entries())for(const card of player.zones.battlefield)if(card.entryLife||card.entryCondition)return {card,owner};return null;
}
export const pendingLifeEntry=pendingEntry;
export function selfDamageAmount(source,text){
 let amount=0;const pattern=new RegExp('(?:^|\\n|\\. )'+self(source)+' deals (\\d+) damage to you\\.(?=\\s|$)','gi');
 for(const match of clean(text).matchAll(pattern))amount+=Number(match[1]);return amount;
}
export function dealPlayerDamage(player,amount){
 if(!Number.isSafeInteger(amount)||amount<0||amount>999999)throw Error('Damage must be a whole number from 0 to 999999.');
 player.life-=amount;
}
export function payLife(player,amount){
 if(!Number.isSafeInteger(amount)||amount<0||amount>999999||player.life<amount)throw Error('Not enough life to pay this cost.');
 player.life-=amount;
}
