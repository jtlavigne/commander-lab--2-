import {ruleSources} from './rule-sources.mjs';
import {cardFace,creatureStats} from './card-state.mjs';
import {activeRuleParagraphs,matchesAbilityRecipient,normalizeRules,effectiveLandSubtypes,graveyardCardTypes} from './ability-effects.mjs';

export const fieldCards=g=>g.players.flatMap((p,owner)=>p.zones.battlefield.map(card=>({card,owner})));
export const rulesText=c=>normalizeRules(cardFace(c).oracle_text);
export const isCreature=c=>(!c.faceDown||c.manifested)&&/\bCreature\b/.test(cardFace(c).type_line||'');
export function selfSubject(subject,card){const value=subject.trim().toLowerCase();if(value.split(/\s+/).length>=2&&(card.name||'').toLowerCase().startsWith(value+' '))return true;return /^this (?:creature|permanent|enchantment|artifact|land|planeswalker|battle|aura|equipment)$/.test(value)||[cardFace(card).name?.toLowerCase(),card.name?.toLowerCase(),cardFace(card).name?.split(',')[0].toLowerCase()].includes(value);}
export function combatRecipient(g,subject,card,owner,source,controller){
 subject=subject.trim().replace(/^(?:all|each) (?=creatures?\b)/i,'');if(selfSubject(subject,source))return card.instance===source.instance;
 if(/^your commander$/i.test(subject))return !!card.commander&&(card.ownerSeat??owner)===controller;
 const entryValue=subject.match(/^(.+?) with mana value (\d+) or less$/i);if(entryValue)return (card.cmc||0)<=Number(entryValue[2])&&combatRecipient(g,entryValue[1],card,owner,source,controller);
 const power=subject.match(/^(.+?) with power (\d+) or (greater|less)$/i);
 if(power){const stats=combatStats(g,owner,card);return typeof stats?.power==='number'&&(power[3].toLowerCase()==='greater'?stats.power>=Number(power[2]):stats.power<=Number(power[2]))&&combatRecipient(g,power[1],card,owner,source,controller);}
 const tribe=subject.match(/^(?:an? )?(\w+) creatures?( you control)?$/i);if(tribe&&!/^(?:other|nontoken|legendary|white|blue|black|red|green|attacking|blocking|tapped|untapped|equipped|enchanted|each|all)$/i.test(tribe[1])&&new RegExp('\\b'+tribe[1]+'\\b','i').test(cardFace(card).type_line||''))return isCreature(card)&&(!tribe[2]||owner===controller);
 const qualified=subject.match(/^(?:(other) )?(?:(nontoken|non-Human|legendary|white|blue|black|red|green) )?creatures?(?: you control)?$/i);
 if(qualified){const face=cardFace(card),q=qualified[2]?.toLowerCase(),color={white:'W',blue:'U',black:'B',red:'R',green:'G'}[q];return isCreature(card)&&(!/you control/i.test(subject)||owner===controller)&&(!qualified[1]||card.instance!==source.instance)&&(!q||q==='nontoken'&&!card.token||q==='non-human'&&!/\bHuman\b/.test(face.type_line||'')||q==='legendary'&&/\bLegendary\b/.test(face.type_line||'')||color&&(face.colors||[]).includes(color));}
 const attack=subject.match(/^(other )?(attacking|blocking|tapped|untapped) creatures you control$/i);
 if(attack)return owner===controller&&isCreature(card)&&(!attack[1]||card.instance!==source.instance)&&(attack[2].toLowerCase()==='tapped'?!!card.tapped:attack[2].toLowerCase()==='untapped'?!card.tapped:attack[2].toLowerCase()==='attacking'?g.combat?.attackers.some(a=>a.id===card.instance):g.combat?.blocks.some(b=>b.blocker===card.instance));
 if(/^equipped creatures you control$/i.test(subject))return owner===controller&&isCreature(card)&&fieldCards(g).some(({card:equipment})=>!equipment.faceDown&&/\bEquipment\b/.test(cardFace(equipment).type_line||'')&&equipment.attachedTo===card.instance);
 return matchesAbilityRecipient(subject,card,owner,source,controller);
}
const KEYWORDS=['first strike','double strike','flying','reach','haste','vigilance','trample','deathtouch','lifelink','menace','defender','indestructible','infect','wither','shadow','horsemanship','fear','intimidate','hexproof','shroud'];
const words=text=>KEYWORDS.filter(k=>new RegExp('(?:^|, | and )'+k+'(?:$|,| and | [(])','i').test(text.trim().replace(/\.$/,'')));
function continuousClauses(g,source,owner){
 return activeRuleParagraphs(source).flatMap(({text})=>{
  text=normalizeRules(text).replace(/^[A-Za-z ]+ \u2014 /,'').replace(/\s*\([^]*\)\s*$/,'');
  const graveCondition=text.match(/^(.+?) as long as there are (\d+|one|two|three|four|five) or more card types among cards in your graveyard\.$/i);if(graveCondition)return graveyardCardTypes(g.players[owner]).size>=({one:1,two:2,three:3,four:4,five:5}[graveCondition[2]]??Number(graveCondition[2]))?[graveCondition[1]+'.']:[];
  const conditional=text.match(/^(?:\w+ — )?As long as you control your commander, (.+)$/i);
  if(conditional){if(!g.players[owner].zones.battlefield.some(c=>c.commander&&c.ownerSeat===undefined||c.commander&&c.ownerSeat===owner))return [];return conditional[1].replace(/\.$/,'').split(/ and (?=other creatures you control)/).map(t=>t+'.');}
  return [text];
 });
}
// Display consumers can supply a broader vocabulary without changing the
// combat engine's supported keywords or duplicating continuous-effect checks.
export function keywordSet(g,owner,card,{keywords=KEYWORDS,read=words}={}){
 const result=new Set();if(card.faceDown&&!card.manifested)return result;
 for(const {text} of activeRuleParagraphs(card))for(const k of read(text))result.add(k);
 for(const k of keywords)if(card.counters?.[k]>0||card.temporaryKeywords?.includes(k))result.add(k);
 for(const {card:source,owner:controller} of ruleSources(g))if(!source.faceDown)for(const text of continuousClauses(g,source,controller)){
  const grant=text.replace(/ (?:get|gets) [+-]\d+\/[+-]\d+(?: for each [^.]+?)? and (?:have|has) /i,' have ').match(/^(.+?) (?:have|has) (.+?)(?: as long as (.+?))?\.$/i);if(!grant||!combatRecipient(g,grant[1],card,owner,source,controller))continue;
  if(grant[3]){
   const condition=grant[3].match(/^there's (?:an? |one or more )?([\w-]+) cards? in your graveyard$/i);if(!condition||!g.players[controller].zones.graveyard.some(c=>(cardFace(c).type_line||'').toLowerCase().split(/\W+/).includes(condition[1].toLowerCase())))continue;
  }
  for(const k of read(grant[2]))result.add(k);
 }
 for(const [controller,player] of g.players.entries())for(const source of player.zones.graveyard)for(const {text} of activeRuleParagraphs(source)){
  const grant=normalizeRules(text).match(/^As long as (?:this card|[^.]+) is in your graveyard and you control a (Plains|Island|Swamp|Mountain|Forest), (.+?) (?:have|has) (.+?)\./i);
  if(grant&&combatRecipient(g,grant[2],card,owner,source,controller)&&player.zones.battlefield.some(c=>effectiveLandSubtypes(g,controller,c).includes(grant[1])))for(const k of read(grant[3]))result.add(k);
 }
 for(const keyword of card.lostKeywords||[])result.delete(keyword);return result;
}
export function summoningSick(g,owner,card){return isCreature(card)&&!!card.summoningSick&&!keywordSet(g,owner,card).has('haste');}
export function protectedFrom(g,owner,card,source){
 const clauses=[rulesText(card),...(card.temporaryKeywords||[])];for(const {card:provider,owner:controller} of ruleSources(g))if(!provider.faceDown)for(const {text} of activeRuleParagraphs(provider)){const grant=text.replace(/ (?:get|gets) [+-]\d+\/[+-]\d+(?: for each [^.]+?)? and (?:have|has) /i,' have ').match(/^(.+?) (?:have|has) (protection from .+?)\.$/i);if(grant&&combatRecipient(g,grant[1],card,owner,provider,controller))clauses.push(grant[2]);}
 const colors={white:'W',blue:'U',black:'B',red:'R',green:'G'};return clauses.some(text=>{const match=text.match(/(?:^|\n|, | and )protection from (all colors|[a-z]+)/i);if(!match)return false;const scope=match[1].toLowerCase();return scope==='everything'||scope==='all colors'&&(cardFace(source).colors||[]).length>0||colors[scope]&&(cardFace(source).colors||[]).includes(colors[scope])||!colors[scope]&&new RegExp('\\b'+scope.replace(/s$/,'')+'\\b','i').test(cardFace(source).type_line||'');});
}
export function combatStats(g,owner,card){
 const base=creatureStats(card);if(!base)return null;let power=base.power,toughness=base.toughness;
 if(/power and toughness are each equal to the number of cards in your hand/i.test(rulesText(card))&&!card.battlefieldStats){power=toughness=g.players[owner].zones.hand.length;for(const [kind,n] of Object.entries(card.counters||{})){const m=kind.match(/^([+-]\d+)\/([+-]\d+)$/);if(m){power+=Number(m[1])*n;toughness+=Number(m[2])*n;}}}
 if(/power and toughness are each equal to the number of lands you control/i.test(rulesText(card))&&!card.battlefieldStats){const lands=g.players[owner].zones.battlefield.filter(c=>!c.faceDown&&/\bLand\b/.test(cardFace(c).type_line||'')).length;power=lands;toughness=lands;for(const [kind,n] of Object.entries(card.counters||{})){const m=kind.match(/^([+-]\d+)\/([+-]\d+)$/);if(m){power+=Number(m[1])*n;toughness+=Number(m[2])*n;}}}
 if(/power is equal to the number of creatures you control\./i.test(rulesText(card))&&!card.battlefieldStats){power=g.players[owner].zones.battlefield.filter(isCreature).length;for(const [kind,n] of Object.entries(card.counters||{})){const m=kind.match(/^([+-]\d+)\/[+-]\d+$/);if(m)power+=Number(m[1])*n;}}
 if(typeof power!=='number'||typeof toughness!=='number')return {...base,damage:card.markedDamage||0,remaining:null};
 power+=card.temporaryStats?.power||0;toughness+=card.temporaryStats?.toughness||0;
 for(const {card:source,owner:controller} of ruleSources(g))if(!source.faceDown)for(const text of continuousClauses(g,source,controller)){
  const boost=text.match(/^(.+?) (?:get|gets) ([+-]\d+)\/([+-]\d+)(?: and (?:have|has) [\s\S]+)?(?:\.|["”])$/i);if(boost&&combatRecipient(g,boost[1],card,owner,source,controller)){power+=Number(boost[2]);toughness+=Number(boost[3]);}
  const counted=text.match(/^(.+?) (?:get|gets) ([+-]\d+)\/([+-]\d+) for each (other )?(land you control|enchantment you control|enchantment on the battlefield|artifact and\/or enchantment you control|artifact you control|Cat you control)(?: and (?:has|have) [^.]+)?\.$/i);
  if(counted&&combatRecipient(g,counted[1],card,owner,source,controller)){
   const pool=/on the battlefield/.test(counted[5])?fieldCards(g):fieldCards(g).filter(f=>f.owner===controller),types=counted[5].startsWith('artifact and/or')?['Artifact','Enchantment']:[counted[5].split(' ')[0]];
   const amount=pool.filter(({card:c})=>!c.faceDown&&(!counted[4]||c.instance!==source.instance)&&types.some(type=>new RegExp('\\b'+type+'\\b','i').test(cardFace(c).type_line||''))).length;power+=Number(counted[2])*amount;toughness+=Number(counted[3])*amount;
  }
  const attacks=text.match(/^Each creature you control gets ([+-]\d+)\/([+-]\d+) for each time it has attacked this turn\.$/i);
  if(attacks&&owner===controller&&card.attackHistory?.turn===g.turn+':'+g.active){power+=Number(attacks[1])*card.attackHistory.count;toughness+=Number(attacks[2])*card.attackHistory.count;}
 }
 return {...base,power,toughness,damage:card.markedDamage||0,remaining:toughness-(card.markedDamage||0)};
}
export function exertAbility(card){
 const text=rulesText(card).match(/(?:^|\n)If (.+?) hasn't been exerted this turn, you may exert it as it attacks\. When you do, (.+?)(?: \(|$)/i);
 return text&&selfSubject(text[1],card)?text[2]:null;
}
function baseAttackTargetError(g,card,target){
 if(target.kind==='player')for(const {card:source,owner} of fieldCards(g))if(owner===target.owner&&source.tapped&&!source.faceDown)for(const {text} of activeRuleParagraphs(source)){
  const m=text.match(/^As long as (.+?) is tapped, no more than (one|two|\d+) creatures? can attack you each combat\.$/i),limit=m&&({one:1,two:2}[m[2]]||Number(m[2]));
  if(m&&selfSubject(m[1],source)&&(g.combat?.attackers||[]).filter(a=>a.id!==card.instance&&!a.enteredAttacking&&a.defender.kind==='player'&&a.defender.owner===target.owner).length>=limit)return 'Only '+limit+' creature(s) can attack this player this combat.';
 }
 if(target.kind==='player'&&/can't attack a player it has already attacked this turn\./i.test(rulesText(card))&&card.attackHistory?.turn===g.turn+':'+g.active&&card.attackHistory.players?.includes(target.owner))return 'This creature already attacked that player this turn.';
 return '';
}
export function attackTargetError(g,card,target){
 const base=baseAttackTargetError(g,card,target);if(base)return base;
 if(card.goadedBy?.length){const score=target=>target.kind==='player'?card.goadedBy.filter(owner=>target.owner!==owner).length+1:0,possible=g.players.flatMap((_,owner)=>owner===g.active?[]:[{kind:'player',owner}]).filter(t=>!baseAttackTargetError(g,card,t));if(score(target)<Math.max(0,...possible.map(score)))return 'Goad requires attacking a player other than its goading players if able.';}
 return '';
}
export function attackKeywordCount(g,owner,card,keyword){
 let count=activeRuleParagraphs(card).filter(({text})=>new RegExp('^'+keyword+'(?:$|[ (])','i').test(text)).length;
 for(const {card:source,owner:controller} of ruleSources(g))if(!source.faceDown)for(const {text} of activeRuleParagraphs(source)){
  const grant=normalizeRules(text).match(new RegExp('^(.+?) (?:have|has) '+keyword+'\\.','i'));if(grant&&combatRecipient(g,grant[1],card,owner,source,controller))count++;
 }return count;
}
export function attackError(g,owner,card){
 if(owner!==g.active)return 'Only the active player attacks.';if(!isCreature(card))return 'Not a face-up creature.';
 if(card.tapped)return 'Tapped.';if(summoningSick(g,owner,card))return 'Summoning sickness.';if(card.entryChoices?.length)return 'Set entering values first.';
 if(/(?:^|\n)(?:This creature|[^\n.]+) can't attack(?: or block)?\./i.test(rulesText(card)))return 'Cannot attack.';
 if(/can't attack a player it has already attacked this turn\./i.test(rulesText(card))&&!g.players.some((p,seat)=>seat!==owner&&(!attackTargetError(g,card,{kind:'player',owner:seat})||p.zones.battlefield.some(c=>!c.faceDown&&/Planeswalker/.test(cardFace(c).type_line||'')))))return 'No legal defender remains this turn.';
 if(keywordSet(g,owner,card).has('defender')&&!/can attack as though it didn't have defender/i.test(rulesText(card)))return 'Defender.';return '';
}
export function mustAttack(g,owner,card){
 if(attackError(g,owner,card))return false;
 if(card.goadedBy?.length)return true;
 if(/(?:^|\n)(?:This creature|[^\n.]+) attacks each (?:combat|turn) if able\./i.test(rulesText(card)))return true;
 return fieldCards(g).some(({card:source,owner:controller})=>!source.faceDown&&activeRuleParagraphs(source).some(({text})=>{const m=text.match(/^(.+?) attack each (?:combat|turn) if able\./i);return m&&combatRecipient(g,m[1],card,owner,source,controller);}));
}
export function blockCapacity(card){const m=rulesText(card).match(/can block (?:an|one|two|three|\d+) additional creatures?/i);if(!m)return 1;const n=m[0].match(/block (an|one|two|three|\d+)/i)[1].toLowerCase();return 1+({an:1,one:1,two:2,three:3}[n]??Number(n));}
export function blockError(g,owner,blocker,attacker,defender){
 if(owner!==defender)return 'Only this defending player can block.';if(!isCreature(blocker))return 'Not a face-up creature.';if(blocker.tapped)return 'Tapped.';
 const text=rulesText(blocker),a=keywordSet(g,g.active,attacker),b=keywordSet(g,owner,blocker),attackText=rulesText(attacker);
 if(/(?:^|\n)(?:This creature|[^\n.]+) can't (?:attack or )?block\./i.test(text))return 'Cannot block.';
 if(/can't be blocked\./i.test(attackText)||attacker.temporaryKeywords?.includes('unblockable'))return 'Unblockable.';
 const powerBlock=attackText.match(/can't be blocked by creatures with power (\d+) or less\./i);if(powerBlock&&typeof combatStats(g,owner,blocker)?.power==='number'&&combatStats(g,owner,blocker).power<=Number(powerBlock[1]))return 'Blocker power is too low.';
 if(protectedFrom(g,g.active,attacker,blocker))return 'Protection prevents this block.';
 if(a.has('flying')&&!b.has('flying')&&!b.has('reach'))return 'Needs flying or reach.';
 if(a.has('shadow')!==b.has('shadow'))return 'Shadow restriction.';if(a.has('horsemanship')&&!b.has('horsemanship'))return 'Needs horsemanship.';
 const colors=cardFace(blocker).colors||[];if(a.has('fear')&&!colors.includes('B')&&!/Artifact/.test(cardFace(blocker).type_line||''))return 'Fear restriction.';
 if(a.has('intimidate')&&!/Artifact/.test(cardFace(blocker).type_line||'')&&!colors.some(c=>(cardFace(attacker).colors||[]).includes(c)))return 'Intimidate restriction.';
 for(const [word,type] of Object.entries({forestwalk:'Forest',islandwalk:'Island',swampwalk:'Swamp',mountainwalk:'Mountain',plainswalk:'Plains'}))if(new RegExp('(?:^|\\n|, )'+word+'\\b','i').test(attackText)&&g.players[owner].zones.battlefield.some(c=>effectiveLandSubtypes(g,owner,c).includes(type)))return 'Landwalk restriction.';
 return '';
}
