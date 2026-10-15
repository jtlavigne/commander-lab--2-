import {counterRemovalCost,counterCostOptions} from './counter-costs.mjs';
import {cardFace,creatureStats} from './card-state.mjs';
import {graveAbilityPermissions} from './grave-casting.mjs';
import {crewCostError} from './vehicles.mjs';
import {effectTargetSpec,effectTargetOptions} from './effect-targets.mjs';
import {grantedAbilities,loyaltyCostSymbol,BASIC_LAND_TYPES,effectiveLandSubtypes} from './ability-effects.mjs';
import {pendingEntry,dealPlayerDamage,selfDamageAmount} from './life-effects.mjs';
import {summoningSick} from './creature-rules.mjs';
import {genericReduction,adjustedColoredCost,optionalLifeReductions} from './spell-costs.mjs';
import {actionRestriction} from './action-permissions.mjs';
import {modalAdditionalCost,castingPermission,multikickerCost,overloadCost,buybackCost,castingDiscardCount,castingSacrificeType,castingSacrificeOptions,castingLifeCost,flashbackOptions} from './spell-rules.mjs';
import {triggeredParagraphs} from './trigger-rules.mjs';

// Mana keeps its source, snow quality, spending restriction and duration.
// CR 106, 118 and 605: https://magic.wizards.com/en/rules
export const MANA_TYPES=['W','U','B','R','G','C'];
export const MANA_NAMES={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green',C:'Colorless'};
export function commanderColors(g,owner){
 if(g.networkCommanderColors)return g.networkCommanderColors[owner]||[];
 const cards=g.players.flatMap((p,seat)=>Object.values(p.zones).flat().map(card=>({card,seat}))).concat(g.stack.filter(e=>e.card).map(e=>({card:e.card,seat:e.owner})));
 return [...new Set(cards.filter(({card,seat})=>card.commander&&(card.ownerSeat??seat)===owner).flatMap(({card})=>card.color_identity||[]))];
}
const numberWords={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
const amountOf=s=>numberWords[String(s).toLowerCase()]??(/^\d+$/.test(s)?Number(s):null);
const clean=text=>(text||'').replace(/[’]/g,"'").replace(/−/g,'-');
const textOf=card=>clean(cardFace(card).oracle_text);
const typeOf=card=>cardFace(card).type_line||'';
const field=g=>g.players.flatMap((p,owner)=>p.zones.battlefield.filter(c=>!c.faceDown).map(card=>({card,owner})));
const sum=counts=>Object.values(counts).reduce((a,b)=>a+b,0);
export function manaTotals(player){const totals=Object.fromEntries(MANA_TYPES.map(t=>[t,0]));for(const lot of player.mana||[])totals[lot.type]+=lot.amount;return totals;}
export function manaText(counts){return MANA_TYPES.filter(t=>counts[t]).map(t=>counts[t]+' '+t).join(' · ')||'No mana';}
export function validateMana(player){
 player.mana??=[];
 if(!Array.isArray(player.mana)||player.mana.length>1000||player.mana.some(lot=>!lot||!MANA_TYPES.includes(lot.type)||!Number.isSafeInteger(lot.amount)||lot.amount<1||lot.amount>999999||lot.restriction!==undefined&&!['creature','artifact','enchantment','instant','sorcery','planeswalker','battle','commander','manual'].includes(lot.restriction)||lot.retain!==undefined&&!['turn','always'].includes(lot.retain)||lot.snow!==undefined&&typeof lot.snow!=='boolean'||['source','sourceId','activationId'].some(key=>lot[key]!==undefined&&typeof lot[key]!=='string')))throw Error('Invalid mana pool.');
 if(player.mana.some(lot=>lot.spendScry&&(!lot.spendScry.id||!lot.spendScry.source||['id','instance','name','type_line'].some(key=>typeof (key==='id'?lot.spendScry.id:lot.spendScry.source[key])!=='string'))))throw Error('Invalid mana spending trigger.');
}
export function addMana(player,counts,qualities={}){
 for(const [type,amount] of Object.entries(counts))if(!MANA_TYPES.includes(type)||!Number.isSafeInteger(amount)||amount<0||amount>999999)throw Error('Mana amounts must be whole numbers from 0 to 999999.');
 const next=structuredClone(player.mana||[]);
 for(const type of MANA_TYPES)if(counts[type]){
  const lot={type,amount:counts[type],...qualities},same=next.find(a=>MANA_TYPES.includes(a.type)&&a.type===type&&a.spendScry?.id===lot.spendScry?.id&&['source','sourceId','activationId','restriction','retain','snow'].every(key=>a[key]===lot[key]));
  if(same)same.amount+=lot.amount;else next.push(lot);
 }
 validateMana({mana:next});player.mana=next;
}
function restrictionFor(text){
 if(!/spend (?:this|that) mana only/i.test(text))return undefined;
 const m=text.match(/spend (?:this|that) mana only to cast (creature|artifact|enchantment|instant|sorcery|planeswalker|battle|commander) spells?\b([^.]*)/i);
 return m&&!m[2].trim()?m[1].toLowerCase():'manual';
}
export function parseProduction(text){
 text=clean(text);const add=text.match(/\bAdd\s+([^.]*)/i);if(!add)return null;const clause=add[1];
 const symbols=[...clause.matchAll(/\{([WUBRGC])\}/g)].map(m=>m[1]);
 const restriction=restrictionFor(text),retain=/don't lose this mana as steps and phases end/i.test(text)?(/until end of turn/i.test(text)?'turn':'always'):undefined;
 if(symbols.length){
  const alternatives=/\bor\b/.test(clause)&&!(/for each|equal to|that many/.test(clause));
  const fixed=Object.fromEntries(MANA_TYPES.map(t=>[t,symbols.filter(s=>s===t).length]));
  const groups=alternatives?clause.split(/\s*,\s*(?:or\s+)?|\s+or\s+/).map(part=>{const tokens=[...part.matchAll(/\{([WUBRGC])\}/g)].map(m=>m[1]);return Object.fromEntries(MANA_TYPES.map(t=>[t,tokens.filter(s=>s===t).length]));}):null;
  return {fixed:alternatives?null:fixed,alternatives:groups,colors:null,amount:1,variable:/\b(?:for each|equal to|that many|X)\b/.test(clause),clause,restriction,retain};
 }
 const any=clause.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|X|that much|that many) mana (?:of|in) (?:any|a single|different)/i);
 return {fixed:null,colors:any?MANA_TYPES.slice(0,5):MANA_TYPES,amount:any?amountOf(any[1]):null,variable:!any||amountOf(any[1])===null||/for each|equal to/.test(clause),combination:/any combination|different colors/.test(clause),manual:!any,clause,restriction,retain};
}
function descriptor(cost,text,id,{nonmana=false}={}){
 const output=parseProduction(text);if(!output&&!nonmana)return null;cost=clean(cost.trim()).replace(/^[A-Za-z ]+ \u2014 /,'');
 const manaCost=(cost.match(/\{(?:\d+|[WUBRGCSX]|[WUBRG2]\/[^}]+)\}/g)||[]).join('');
 const lifeCost=[...cost.matchAll(/\bpay (\d+) life\b/gi)].reduce((n,m)=>n+Number(m[1]),0),variableLife=/Pay life equal to the number of colors in your commanders?' color identity/i.test(cost),sacrificeType=cost.match(/Sacrifice (?:a|an|another) (creature|artifact|Desert|Treasure)\b/i)?.[1],counterCost=cost.match(/Remove (a|one|two|three|\d+) ([a-z]+) counters? from this (?:artifact|creature|permanent|land)/i),discard=cost.match(/Discard (a|one|two|three|\d+) cards?/i);
 const counterRemoval=counterRemovalCost(cost);
 const residue=cost.replace(counterRemoval?.text||'','').replace(/\{[^}]+\}|\bpay \d+ life\b|Pay life equal to the number of colors in your commanders?' color identity|Sacrifice (?:this (?:artifact|creature|token|permanent|land|enchantment|planeswalker|battle)|(?:an?|another) (?:creature|artifact|Desert|Treasure))|Exert this (?:creature|permanent)|Exile this (?:artifact|creature|land|permanent|enchantment|planeswalker|battle)|Remove (?:a|one|two|three|\d+) [a-z]+ counters? from this (?:artifact|creature|permanent|land)|Discard this card|Discard (?:a|one|two|three|\d+) cards?/gi,'').replace(/[,\s]/g,'');
 return {id,cost,text,output,...(counterRemoval?{counterRemoval}:{}),discardSelf:/Discard this card/i.test(cost),handOnly:/Discard this card/i.test(cost),exertSelf:/Exert this (?:creature|permanent)/i.test(cost),tap:/\{T\}/.test(cost),untap:/\{Q\}/.test(cost),sacrifice:/\bsacrifice this (?:artifact|creature|token|permanent|land|enchantment|planeswalker|battle)\b/i.test(cost),sacrificeType,sacrificeOther:/Sacrifice another /i.test(cost),...(discard?{discardCount:discard[1]==='a'?1:amountOf(discard[1])}:{}),...(counterCost?{counterCost:{kind:counterCost[2].toLowerCase(),amount:counterCost[1]==='a'?1:amountOf(counterCost[1])}}:{}),exileSelf:/Exile this (?:artifact|creature|land|permanent|enchantment|planeswalker|battle)/i.test(cost),variableLife,manaCost,lifeCost,manualCost:!!residue,usesStack:!output||/\btarget\b/i.test((text+' '+cost).replace(/\([^)]*\)/g,''))};
}
export function manaAbilities(g,owner,card,{landTypes}={}){
 if(card.faceDown&&!card.manifested)return [];const abilities=[],text=textOf(card);
 for(const [lineIndex,line] of text.split('\n').entries()){
  // Granted and triggered abilities are handled separately, never as this card's own tap ability.
  if(/^\s*\(/.test(line)||/\b(?:have|has|gains?)\s+["“]|^(?:Whenever|When|At |If )/i.test(line.trim()))continue;
  const match=line.match(/^\s*([^:]+):\s*(.*\bAdd\b.*)$/i);if(!match)continue;
  if(loyaltyCostSymbol(match[1])!==null)continue;
  const ability=descriptor(match[1],match[2],'own:'+lineIndex);if(ability){
   if(/in your commander's color identity/i.test(ability.text))ability.output.colors=commanderColors(g,owner).filter(t=>t!=='C');
   if(ability.cost.toLowerCase().includes('sacrifice '+card.name.toLowerCase())){ability.sacrifice=true;ability.manualCost=!!ability.cost.replace(/\{[^}]+\}|[,\s]/g,'').toLowerCase().replace('sacrifice'+card.name.replace(/\s/g,'').toLowerCase(),'');}abilities.push(ability);
  }
 }
 const basics={Plains:'W',Island:'U',Swamp:'B',Mountain:'R',Forest:'G',Wastes:'C'};
 const subtypes=effectiveLandSubtypes(g,owner,card);
 for(const [subtype,color] of Object.entries(basics))if(subtypes.includes(subtype)||card.name===subtype){
  const basic=descriptor('{T}','Add {'+color+'}.','basic:'+color),key=manaOptionKey(g,owner,card,basic,{});
  if(!abilities.some(a=>a.output.fixed&&manaOptionKey(g,owner,card,a,{})===key))abilities.push(basic);
 }
 for(const grant of grantedAbilities(g,owner,card)){
  const match=grant.text.match(/^([^:]+):\s*(.+)$/);if(!match||loyaltyCostSymbol(match[1])!==null)continue;
  const ability=descriptor(match[1],match[2],grant.key);if(ability){ability.grantedBy=grant.sourceName;abilities.push(ability);}
 }
 for(const ability of abilities){
  const reference=clean(ability.text).match(/any (color|type) that a land (an opponent controls|you control) could produce/i);if(!reference)continue;
  const types=landTypes||landManaTypes(g),allowed=new Set();
  for(const {card:land,owner:controller} of field(g))if(typeOf(land).includes('Land')&&(reference[2]==='you control'?controller===owner:controller!==owner))for(const type of types.get(land.instance)||[])if(reference[1]==='type'||type!=='C')allowed.add(type);
  ability.output.colors=MANA_TYPES.filter(t=>allowed.has(t));ability.output.fixed=null;ability.output.alternatives=null;
 }
 const generalCycling=textOf(card).match(/(?:^|\n)Cycling ((?:\{[^}]+\})+)/);if(generalCycling)abilities.push({...descriptor(generalCycling[1],'Draw a card.','cycling',{nonmana:true}),cycling:true,discardSelf:true});
 for(const ability of abilities)if(ability.variableLife)ability.lifeCost=commanderColors(g,owner).length;
 return abilities;
}
export function sacrificeOptions(g,owner,ability,source){return !ability.sacrificeType?[]:g.players[owner].zones.battlefield.filter(c=>(!ability.sacrificeOther||c.instance!==source?.instance)&&!c.faceDown&&new RegExp('\\b'+ability.sacrificeType+'\\b','i').test(typeOf(c)));}
export function landManaTypes(g){
 // CR 106.7: ignore tap state and ability costs; circular references alone
 // cannot invent a mana type. Grow the least fixed point from real sources.
 const lands=field(g).filter(({card})=>typeOf(card).includes('Land')),types=new Map(lands.map(({card})=>[card.instance,new Set()]));
 for(let iteration=0;iteration<=lands.length*6;iteration++){
  let changed=false;
  for(const {card,owner} of lands)for(const ability of manaAbilities(g,owner,card,{landTypes:types})){
   const output=ability.output,possible=new Set();
   if(output.variable||output.manual){try{const counts=productionChoices(g,owner,card,output,{});for(const [type,n] of Object.entries(counts))if(n>0)possible.add(type);}catch{/* An undefined output cannot invent a mana type. */}}
   else{for(const type of output.colors||[])possible.add(type);for(const counts of [output.fixed,...(output.alternatives||[])].filter(Boolean))for(const [type,n] of Object.entries(counts))if(n>0)possible.add(type);}
   for(const type of possible)if(!types.get(card.instance).has(type)){types.get(card.instance).add(type);changed=true;}
  }
  if(!changed)break;
 }return types;
}
export function activatedAbilities(g,owner,card){
 const abilities=manaAbilities(g,owner,card);if(card.faceDown&&!card.manifested)return abilities;
 for(const [,power] of textOf(card).matchAll(/(?:^|\n)Crew (\d+)\b/g))abilities.push({...descriptor('','This Vehicle becomes an artifact creature until end of turn.','crew:'+power,{nonmana:true}),crew:Number(power),cost:'Crew '+power,manualCost:false});
 for(const {index,text:line} of triggeredParagraphs(card)){
  if(/^(?:Equip|Crew|(?:Basic )?landcycling|Cycling)\b/i.test(line))continue;
  const m=line.match(/^\s*([^:]+):\s*([^]+)$/);if(!m||loyaltyCostSymbol(m[1])!==null||/\b(?:have|has|gains?)\s+["“]|^(?:Whenever|When|At |If )/i.test(line)||/\bAdd\b/i.test(m[2]))continue;
  const ability=descriptor(m[1],m[2],'action:'+index,{nonmana:true});if(ability){if(/^Choose one —\n/.test(ability.text))ability.modes=ability.text.split('\n').slice(1).map(line=>line.replace(/^• /,''));abilities.push(ability);}
 }
 for(const grant of grantedAbilities(g,owner,card)){
  const m=grant.text.match(/^([^:]+):\s*(.+)$/);if(!m||loyaltyCostSymbol(m[1])!==null||/\bAdd\b/i.test(m[2]))continue;
  const ability=descriptor(m[1],m[2],grant.key,{nonmana:true});if(ability){ability.grantedBy=grant.sourceName;abilities.push(ability);}
 }
 const instantEquip=field(g).some(({card:provider,owner:controller})=>controller===owner&&!provider.faceDown&&/You may activate equip abilities any time you could cast an instant\./i.test(textOf(provider)));
 for(const match of textOf(card).matchAll(/(?:^|\n)Equip (legendary creature )?(\{\d+\})/g)){
  const ability=descriptor(match[2],'Attach to target '+(match[1]||'creature ')+"you control."+(instantEquip?'':' Activate only as a sorcery.'),match[1]?'equip:legendary':'equip',{nonmana:true});abilities.push(ability);
 }
 if(/\bEquipment\b/.test(typeOf(card))&&field(g).filter(f=>f.owner===owner&&!f.card.faceDown&&/\bArtifact\b/.test(typeOf(f.card))).length>=3&&field(g).some(f=>f.owner===owner&&!f.card.faceDown&&/Equipment you control have equip \{0\} as long as you control three or more artifacts\./i.test(textOf(f.card)))&&!abilities.some(a=>a.id==='equip'&&a.manaCost==='{0}'))abilities.push(descriptor('{0}','Attach to target creature you control.'+(instantEquip?'':' Activate only as a sorcery.'),'equip:granted-zero',{nonmana:true}));
 const cycling=textOf(card).match(/(?:^|\n)Basic landcycling (\{\d+\})/);if(cycling)abilities.push({...descriptor(cycling[1],'Search your library for a basic land card, reveal it, put it into your hand, then shuffle.','landcycling',{nonmana:true}),cycling:true,discardSelf:true});
 for(const ability of abilities)if(ability.variableLife)ability.lifeCost=commanderColors(g,owner).length;
 return abilities;
}
export function activationError(g,owner,card,ability,{allowLife=true,x=0,spend}={}){
 if(g.result)return 'This game has ended.';
 const restriction=actionRestriction(g,owner,'activate',card);if(restriction)return restriction;
 if(g.pendingEffect&&!(g.pendingEffect.kind==='oracle-choice'&&['optionalPay','castOffered','castExiled'].includes(g.pendingEffect.step.op)&&g.pendingEffect.owner===owner&&ability.output&&!ability.usesStack))return 'Finish the pending effect first.';
 if(pendingEntry(g))return 'Finish the entering land’s life payment choice first.';
 if(g.step===0)return 'Advance to upkeep before activating abilities.';
 if(ability.crew!==undefined){const error=crewCostError(g,owner,card,ability.crew);if(error)return error;}
 if(ability.output?.colors&&!ability.output.colors.length)return 'The lands this ability refers to cannot produce an eligible mana type.';
 if(ability.tap&&card.tapped)return 'Already tapped.';
 if(ability.untap&&!card.tapped)return 'Already untapped.';
 if((ability.tap||ability.untap)&&summoningSick(g,owner,card))return 'Summoning sickness: this creature cannot use tap or untap abilities yet.';
 if(/Activate only as a sorcery/i.test(ability.text)&&(g.active!==owner||![3,9].includes(g.step)||g.stack.length))return 'Activate only as a sorcery.';
 if(ability.id.startsWith('equip')&&!effectTargetOptions(g,{owner,source:card,text:ability.text}).length)return 'No legal creature can be equipped.';
 const hasTargets=text=>{const spec=effectTargetSpec(text);return !spec||spec.optional||effectTargetOptions(g,{owner,source:card,text}).length>0;};
 if(ability.modes&&ability.mode===undefined?!ability.modes.some(hasTargets):!hasTargets(ability.text))return 'No legal targets for this ability.';
 const artifacts=ability.text.match(/Activate only if you control (\w+) or more artifacts/i);if(artifacts&&g.players[owner].zones.battlefield.filter(c=>!c.faceDown&&/\bArtifact\b/.test(typeOf(c))).length<(amountOf(artifacts[1])??Infinity))return 'Not enough artifacts to activate this ability.';
 const lands=ability.text.match(/Activate only if you control (\w+) or more lands/i);if(lands&&g.players[owner].zones.battlefield.filter(c=>!c.faceDown&&/\bLand\b/.test(typeOf(c))).length<(amountOf(lands[1])??Infinity))return 'Not enough lands to activate this ability.';
 if(ability.manaCost&&!paymentPlan({...g.players[owner],life:g.players[owner].life-(ability.lifeCost||0)},card,ability.manaCost,{ability:true,allowLife,x,spend}))return 'Not enough eligible floating mana.';
 if(ability.lifeCost&&g.players[owner].life<ability.lifeCost)return 'Not enough life to pay this cost.';
 if(ability.sacrificeType&&!sacrificeOptions(g,owner,ability,card).length)return 'No eligible permanent to sacrifice.';
 if(ability.counterCost&&(card.counters?.[ability.counterCost.kind]||0)<ability.counterCost.amount)return 'Not enough '+ability.counterCost.kind+' counters to pay this cost.';
 if(ability.counterRemoval&&counterCostOptions(g,owner,card,ability.counterRemoval).reduce((sum,o)=>sum+o.available,0)<ability.counterRemoval.amount)return 'Not enough eligible counters to pay this cost.';
 if(ability.discardCount&&g.players[owner].zones.hand.length<ability.discardCount)return 'Not enough cards to discard as a cost.';
 if(/Activate only once each turn\./i.test(ability.text)&&card.abilityUses?.turn===g.turn+':'+g.active&&card.abilityUses.ids.includes(ability.id))return 'This ability has already been activated this turn.';
 return '';
}
export function productionChoices(g,owner,source,output,choice={}){
 if(output.alternatives){const chosen=output.alternatives[choice.outputIndex??0];if(!chosen)throw Error('Choose a mana option.');return chosen;}
 let amount=output.amount;
 if(output.variable){
  const clause=output.clause;
  if(/for each (?:creature|land|artifact|enchantment) you control/i.test(clause)){const kind=clause.match(/for each (creature|land|artifact|enchantment)/i)[1];amount=g.players[owner].zones.battlefield.filter(c=>!c.faceDown&&typeOf(c).toLowerCase().includes(kind)).length;}
  else if(/equal to (?:this creature's|[^.]*'s) power/i.test(clause))amount=creatureStats(source)?.power;
  else if(/for each (\w+) counter on this (?:artifact|creature|land|permanent)/i.test(clause))amount=source.counters?.[clause.match(/for each (\w+) counter/i)[1].toLowerCase()]||0;
  else amount=choice.amount;
 }
 if(output.manual){const counts=choice.counts||{};if(!sum(counts))throw Error('Enter the mana this effect produces.');return counts;}
 if(output.fixed){const multiplier=output.variable?amount:1;if(!Number.isSafeInteger(multiplier)||multiplier<0)throw Error('Choose the amount of mana produced.');return Object.fromEntries(Object.entries(output.fixed).map(([t,n])=>[t,n*multiplier]));}
 if(!Number.isSafeInteger(amount)||amount<0||amount>999999)throw Error('Choose the amount of mana produced.');
 if(output.combination){const counts=choice.counts||{};if(sum(counts)!==amount||Object.keys(counts).some(t=>!output.colors.includes(t)))throw Error('Choose exactly '+amount+' mana in the allowed colors.');return counts;}
 const color=choice.color||output.colors?.[0];if(!output.colors.includes(color))throw Error('Choose an allowed mana color.');return {[color]:amount};
}
// Equivalent plain mana choices share one UI button. Keep action IDs intact,
// and preserve separate options whenever costs or additional effects differ.
export function manaOptionKey(g,owner,source,ability,choice){
 const output=ability.output;
 if(!output||output.variable||output.manual||output.combination||ability.manualCost||ability.usesStack||!/^\s*Add [^.]+\.?\s*$/i.test(ability.text)||/\b(?:if|unless|only)\b/i.test(ability.text))return null;
 const counts=productionChoices(g,owner,source,output,choice);
 return JSON.stringify([ability.cost.replace(/\s/g,'').toLowerCase(),MANA_TYPES.map(t=>counts[t]||0),output.restriction||'',output.retain||'']);
}
function matchesSource(g,owner,scope,source){const type=typeOf(source);return BASIC_LAND_TYPES.includes(scope)?effectiveLandSubtypes(g,owner,source).includes(scope):scope==='Permanent'||scope==='Nonland'&&!type.includes('Land')||type.includes(scope);}
export function manaModifiers(g,owner,source,{tap=true}={}){
 if(!tap)return [];const result=[];
 for(const effect of g.temporaryManaRules||[])if(matchesSource(g,owner,effect.scope,source))result.push({card:effect.source,kind:'extra',amount:1,color:effect.color});
 for(const {card,owner:controller} of field(g)){
  const text=textOf(card),settings=card.manaSettings||{};
  if(settings.mode==='ignore')continue;
  if(['multiply','extra'].includes(settings.mode)){
   if((controller===owner||settings.global)&&matchesSource(g,owner,settings.scope||'Land',source)&&(!settings.attachedTo||settings.attachedTo===source.instance))result.push({card,kind:settings.mode,amount:settings.amount||1,color:settings.color||'produced'});continue;
  }
  // Auras need an explicit attachment before affecting a land.
  if(/enchanted (?:land|Forest|Mountain|Swamp|Island|Plains).*(?:tapped for mana|taps for mana)/i.test(text)){
   if(settings.attachedTo!==source.instance)continue;const bonus=text.match(/adds?\s+(?:an additional )?(\{[WUBRGC]\}|\w+ mana of (?:any|the chosen) color)/i);
   if(bonus)result.push({card,kind:'extra',amount:1,color:bonus[1].startsWith('{')?bonus[1][1]:MANA_TYPES.includes(settings.color)?settings.color:'choice'});continue;
  }
  const multiplier=text.match(/If you tap (?:a|an) (land|permanent|nonland permanent|creature|artifact) for mana, (?:it|that permanent) produces (twice|three times|double|triple) as much/i);
  if(multiplier&&controller===owner){const scope=multiplier[1]==='nonland permanent'?'Nonland':multiplier[1][0].toUpperCase()+multiplier[1].slice(1);if(matchesSource(g,owner,scope,source))result.push({card,kind:'multiply',amount:/three|triple/.test(multiplier[2])?3:2});continue;}
  if(settings.color&&MANA_TYPES.includes(settings.color)&&/Whenever a (?:basic )?land(?:'s ability| is tapped) .*chosen color/i.test(text)){
   const global=/its controller adds/i.test(text);if((controller===owner||global)&&typeOf(source).includes('Land')&&(!/basic land/i.test(text)||typeOf(source).includes('Basic')))result.push({card,kind:'chosen-extra',amount:1,color:settings.color});continue;
  }
  const extra=text.match(/Whenever (you|a player) tap(?:s)? (?:a|an) (land|nonland permanent|Forest|Mountain|Swamp|Island|Plains|basic land) for mana, ([^.]+)/i);
  if(extra&&(controller===owner||extra[1]==='a player')){
   const scope=extra[2]==='nonland permanent'?'Nonland':extra[2]==='basic land'?'Basic Land':extra[2][0].toUpperCase()+extra[2].slice(1);
   if(!matchesSource(g,owner,scope,source))continue;const fixed=extra[3].match(/adds? (?:an additional )?\{([WUBRGC])\}/i);
   if(fixed)result.push({card,kind:'extra',amount:1,color:fixed[1]});
   else if(/adds? (?:an additional )?one mana of any type (?:that|the) (?:land|permanent) produced/i.test(extra[3]))result.push({card,kind:'extra',amount:1,color:'produced'});
  }
 }
 return result;
}
export function produceMana(g,owner,source,ability,choice={}){
 let counts=productionChoices(g,owner,source,ability.output,choice);const effects=manaModifiers(g,owner,source,{tap:ability.tap});
 const originals=Object.keys(counts).filter(t=>counts[t]>0),damage=selfDamageAmount(source,ability.text);if(!originals.length){if(damage)dealPlayerDamage(g.players[owner],damage);return [];}
 const factor=effects.filter(e=>e.kind==='multiply').reduce((n,e)=>n*e.amount,1);
 const qualities={source:source.name,snow:/\bSnow\b/.test(typeOf(source))};if(choice.activationId){qualities.activationId=choice.activationId;qualities.sourceId=source.instance;}if(ability.output.restriction)qualities.restriction=ability.output.restriction;if(ability.output.retain)qualities.retain=ability.output.retain;
 if(/When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1\./i.test(ability.text))qualities.spendScry={id:crypto.randomUUID(),source:{instance:source.instance,name:source.name,type_line:typeOf(source)}};
 addMana(g.players[owner],Object.fromEntries(Object.entries(counts).map(([t,n])=>[t,n*factor])),qualities);
 for(const effect of effects.filter(e=>e.kind==='extra'||e.kind==='chosen-extra')){
  if(effect.kind==='chosen-extra'&&!originals.includes(effect.color))continue;
  let color=effect.color;
  if(color==='choice'){color=choice.bonusColors?.[effect.card.instance]||choice.extraColor;if(!MANA_TYPES.includes(color))throw Error('Choose a mana color for '+effect.card.name+'.');}
  if(color==='produced'){color=choice.bonusColors?.[effect.card.instance]||choice.extraColor||originals[0];if(!originals.includes(color))throw Error('Extra mana must match a type the source produced.');}
  addMana(g.players[owner],{[color]:effect.amount},{source:effect.card.name,snow:/\bSnow\b/.test(typeOf(effect.card)),...(choice.activationId?{activationId:choice.activationId,sourceId:source.instance}:{})});
 }
 if(damage)dealPlayerDamage(g.players[owner],damage);
 return effects.map(e=>e.card.name);
}
export function clearMana(g,{endOfTurn=false}={}){
 for(const [owner,player] of g.players.entries()){
  const relevant=field(g).filter(e=>e.owner===owner||/Players don't lose unspent mana/i.test(textOf(e.card))).map(e=>e.card);
  player.mana=(player.mana||[]).flatMap(lot=>{
   if(lot.retain==='always'||lot.retain==='turn'&&!endOfTurn)return [lot];
   for(const card of relevant){const text=textOf(card),settings=card.manaSettings||{};if(settings.mode==='ignore')continue;
    if(settings.mode==='retain'&&(settings.color==='all'||settings.color===lot.type))return [lot];
    const match=text.match(/(?:^|\n)(?:You|Players) don't lose unspent(?: ([a-z]+))? mana as steps and phases end/i);
    if(match){const color=Object.keys(MANA_NAMES).find(t=>MANA_NAMES[t].toLowerCase()===match[1]);if(!match[1]||color===lot.type)return [lot];}
   }
   const conversion=relevant.find(card=>card.manaSettings?.mode!=='ignore'&&/(?:^|\n)If you would lose unspent mana, that mana becomes (?:colorless|white|blue|black|red|green) instead/i.test(textOf(card)));
   if(conversion){const color=textOf(conversion).match(/that mana becomes (\w+) instead/i)[1];return [{...lot,type:Object.keys(MANA_NAMES).find(t=>MANA_NAMES[t].toLowerCase()===color),retain:undefined}];}
   return [];
  });
 }
}
function eligible(lot,card,{ability=false,allowRestricted=false}={}){
 if(!lot.restriction)return true;if(allowRestricted&&lot.restriction==='manual')return true;if(ability)return false;
 if(lot.restriction==='commander')return !!card.commander;
 return typeOf(card).toLowerCase().includes(lot.restriction)&&lot.restriction!=='manual';
}
export function paymentPlan(player,card,cost,{x=0,generic=0,allowLife=false,allowRestricted=false,ability=false,spend}={}){
 if(typeof cost!=='string'||!Number.isSafeInteger(x)||x<0||!Number.isSafeInteger(generic))return null;
 const tokens=[...cost.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]);if(tokens.join('')!==cost.replace(/[{}]/g,''))return null;
 let genericCost=generic;const specific=[];
 for(const token of tokens){if(/^\d+$/.test(token))genericCost+=Number(token);else if(token==='X')genericCost+=x;else if(token==='Y'||token==='Z')return null;else specific.push(token);}
 genericCost=Math.max(0,genericCost);if(genericCost>999999)return null;
 const lots=player.mana||[],remaining=lots.map(lot=>eligible(lot,card,{ability,allowRestricted})?lot.amount:0),spent=lots.map(()=>0),memo=new Set();
 if(spend&&Object.entries(spend).some(([type,n])=>!MANA_TYPES.includes(type)||!Number.isSafeInteger(n)||n<0||n>999999))return null;
 const budget=spend?Object.fromEntries(MANA_TYPES.map(t=>[t,spend[t]||0])):null;
 specific.sort((a,b)=>Number(a.includes('/'))-Number(b.includes('/')));
 let nodes=0;
 function search(index,need,life){
  if(++nodes>50000)return null;
  if(remaining.reduce((a,b)=>a+b,0)<need)return null;
  const key=index+','+need+','+life+','+remaining.join(',');if(memo.has(key))return null;memo.add(key);
  if(index===specific.length){let rest=need;if(budget&&Object.values(budget).reduce((a,b)=>a+b,0)!==rest)return null;const allowances=budget?{...budget}:null;const order=lots.map((_,i)=>i).sort((a,b)=>Number(!!lots[b].restriction)-Number(!!lots[a].restriction)||Number(lots[a].type!=='C')-Number(lots[b].type!=='C'));const payment=[...spent];for(const i of order){const n=Math.min(rest,remaining[i],allowances?allowances[lots[i].type]:Infinity);payment[i]+=n;rest-=n;if(allowances)allowances[lots[i].type]-=n;}return rest?null:{spent:payment,life};}
  const token=specific[index],options=token.split('/');
  for(const option of options){
   if(/^\d+$/.test(option)){const result=search(index+1,need+Number(option),life);if(result)return result;continue;}
   if(option==='P'){if(allowLife&&life+2<=player.life){const result=search(index+1,need,life+2);if(result)return result;}continue;}
   if(!MANA_TYPES.includes(option)&&option!=='S')continue;
   const seen=new Set();for(let i=0;i<lots.length;i++)if(remaining[i]&&(!budget||budget[lots[i].type]>0)&&(option==='S'?lots[i].snow:lots[i].type===option)){
    const signature=lots[i].type+','+!!lots[i].snow+','+(lots[i].restriction||'');if(seen.has(signature))continue;seen.add(signature);remaining[i]--;spent[i]++;if(budget)budget[lots[i].type]--;const result=search(index+1,need,life);remaining[i]++;spent[i]--;if(budget)budget[lots[i].type]++;if(result)return result;
   }
  }return null;
 }
 return search(0,genericCost,0);
}
export function payMana(player,card,cost,options={}){
 const plan=paymentPlan(player,card,cost,options);if(!plan)throw Error('Not enough eligible mana to pay this cost.');
 player.mana=(player.mana||[]).map((lot,i)=>({...lot,amount:lot.amount-plan.spent[i]})).filter(lot=>lot.amount>0);player.life-=plan.life;return plan;
}
export function spellPayment(g,owner,card,zone,options={}){
 const face=cardFace(card);if(card.faceDown||/\bLand\b/.test(face.type_line||'')||face.mana_cost===undefined||face.mana_cost==='')return null;
 const permission=castingPermission(g,owner,card,zone,options);if(!permission)return null;
 const escaped=options.escapeIds||[];if(!Array.isArray(escaped)||escaped.length!==(permission.escapeCount||0)||new Set(escaped).size!==escaped.length||escaped.some(id=>id===card.instance||!g.players[owner].zones.graveyard.some(c=>c.instance===id))||escaped.some(id=>(options.delveIds||[]).includes(id)))return null;
 if(overloadCost(card,options.mode)&&permission.cost!==undefined)return null;
 const tax=card.commander&&zone==='command'?2*(card.commandCasts??g.players[owner].casts):0;
 const colored=adjustedColoredCost(g,owner,card,options.lifeReductions||[],permission.cost??overloadCost(card,options.mode)??face.mana_cost);const additionalLife=castingLifeCost(card,options.x??0);if(!colored||additionalLife===null||colored.life+additionalLife>g.players[owner].life)return null;colored.life+=additionalLife;
 const additional=modalAdditionalCost(g,owner,card,options.mode);if(additional===null)return null;
 const kicker=multikickerCost(card,options.kicks),buyback=buybackCost(card,options.buyback);if(kicker===null||buyback===null)return null;
 const discarded=options.discardIds||[],discardCount=castingDiscardCount(card);if(!Array.isArray(discarded)||discarded.length!==discardCount||new Set(discarded).size!==discarded.length||discarded.some(id=>id===card.instance||!g.players[owner].zones.hand.some(c=>c.instance===id)))return null;
 const sacrificed=options.sacrificeIds||[],sacrificeCount=castingSacrificeType(card)?1:0;if(!Array.isArray(sacrificed)||sacrificed.length!==sacrificeCount||new Set(sacrificed).size!==sacrificed.length||sacrificed.some(id=>!castingSacrificeOptions(g,owner,card).some(c=>c.instance===id)))return null;
 const delved=options.delveIds||[];if(!Array.isArray(delved)||new Set(delved).size!==delved.length||delved.length>delveMaximum(g,owner,card,zone,options)||delved.some(id=>!delveOptions(g,owner,card).some(c=>c.instance===id)))return null;
 const plan=paymentPlan({...g.players[owner],life:g.players[owner].life-colored.life},card,colored.cost+additional+kicker+buyback,{...options,generic:tax+(options.generic||0)-genericReduction(g,owner,card)-delved.length});
 // Preserve the Phyrexian portion separately from additional life costs.
 // Entry abilities such as compleated care why life was paid, not its total.
 return plan?{...plan,phyrexianLife:plan.life,life:plan.life+colored.life,escaped:[...escaped],delved:[...delved],discarded:[...discarded],sacrificed:[...sacrificed]}:null;
}
export function delveOptions(g,owner,card){return /(?:^|\n)Delve\b/i.test(cardFace(card).oracle_text||'')?g.players[owner].zones.graveyard.filter(c=>c.instance!==card.instance):[];}
export function delveMaximum(g,owner,card,zone,options={}){
 if(!/(?:^|\n)Delve\b/i.test(cardFace(card).oracle_text||''))return 0;
 const cost=(castingPermission(g,owner,card,zone,options)?.cost??overloadCost(card,options.mode)??cardFace(card).mana_cost??'')+(modalAdditionalCost(g,owner,card,options.mode)||'')+(multikickerCost(card,options.kicks)||'');
 const printed=[...cost.matchAll(/\{(\d+|X)\}/gi)].reduce((n,m)=>n+(m[1].toUpperCase()==='X'?options.x||0:Number(m[1])),0),tax=card.commander&&zone==='command'?2*(card.commandCasts??g.players[owner].casts):0;
 return Math.max(0,printed+tax+(options.generic||0)-genericReduction(g,owner,card));
}
export function availableSpellPayment(g,owner,card,zone,options={}){
 const tryPayment=choice=>{if(choice.escapeIds===undefined)choice={...choice,escapeIds:g.players[owner].zones.graveyard.filter(c=>c.instance!==card.instance&&!(choice.delveIds||[]).includes(c.instance)).slice(0,castingPermission(g,owner,card,zone,choice)?.escapeCount||0).map(c=>c.instance)};if(choice.sacrificeIds===undefined)choice={...choice,sacrificeIds:castingSacrificeOptions(g,owner,card).slice(0,1).map(c=>c.instance)};if(choice.discardIds===undefined)choice={...choice,discardIds:g.players[owner].zones.hand.filter(c=>c.instance!==card.instance).slice(0,castingDiscardCount(card)).map(c=>c.instance)};const ordinary=spellPayment(g,owner,card,zone,choice);if(ordinary)return ordinary;if(choice.delveIds!==undefined)return null;const candidates=delveOptions(g,owner,card).filter(c=>!choice.escapeIds.includes(c.instance));for(let n=1;n<=Math.min(candidates.length,delveMaximum(g,owner,card,zone,choice));n++){const plan=spellPayment(g,owner,card,zone,{...choice,delveIds:candidates.slice(0,n).map(c=>c.instance)});if(plan)return plan;}return null;};
 const ordinary=tryPayment(options);if(ordinary)return {plan:ordinary,choices:[]};
 if(zone==='graveyard'&&options.flashback===undefined)for(const form of flashbackOptions(g,owner,card)){const plan=tryPayment({...options,flashback:form.key});if(plan)return {plan,choices:[],flashback:form.key};}
 if(zone==='graveyard'&&options.permission===undefined)for(const method of graveAbilityPermissions(g,owner,card)){const plan=tryPayment({...options,permission:method.key});if(plan)return {plan,choices:[],permission:method.key};}
 const candidates=optionalLifeReductions(g,owner,card).slice(0,12),max=Math.min(candidates.length,Math.floor(g.players[owner].life/2));
 // Prefer the smallest life payment. The normal payment validator still checks
 // every colored requirement and spending restriction for each candidate.
 for(let count=1;count<=max;count++){
  let result=null;function choose(start,ids){if(result)return;if(ids.length===count){const plan=tryPayment({...options,lifeReductions:ids});if(plan)result={plan,choices:ids};return;}for(let i=start;i<candidates.length;i++)choose(i+1,[...ids,candidates[i].id]);}choose(0,[]);if(result)return result;
 }return null;
}
export function validateManaSettings(settings){
 if(settings===undefined)return;
 if(!settings||typeof settings!=='object'||Array.isArray(settings)||!['auto','ignore','multiply','extra','retain'].includes(settings.mode)||settings.amount!==undefined&&(!Number.isSafeInteger(settings.amount)||settings.amount<1||settings.amount>100)||settings.scope!==undefined&&!['Land','Permanent','Nonland','Creature','Artifact','Forest','Mountain','Swamp','Island','Plains','Basic Land'].includes(settings.scope)||settings.color!==undefined&&!['all','produced',...MANA_TYPES].includes(settings.color)||settings.attachedTo!==undefined&&typeof settings.attachedTo!=='string'||settings.global!==undefined&&typeof settings.global!=='boolean')throw Error('Invalid mana settings.');
}
export function reverseManaTap(g,card,{fromEffect=false}={}){
 if(card.entryLife||card.entryCondition)throw Error('Finish this permanent’s entry choice first.');
 if(!card.tapped)return;
 if(!fromEffect&&card.tapAbility)throw Error('This tap paid for an ability. Untap it through a resolved effect or the turn’s untap step, or use Undo.');
 const activation=card.manaActivation;
 if(!fromEffect&&activation){
  const player=g.players[activation.owner],current=(player.mana||[]).filter(lot=>lot.activationId===activation.id);
  const signature=lot=>JSON.stringify([lot.type,lot.source,lot.snow||false,lot.restriction||'',lot.retain||'']);
  const totals=lots=>{const map=new Map();for(const lot of lots){const key=signature(lot);map.set(key,(map.get(key)||0)+lot.amount);}return map;};
  const available=totals(current),original=totals(activation.produced);
  if([...original].some(([key,n])=>(available.get(key)||0)<n))throw Error('This source’s mana has been spent or cleared. Untap it through a resolved effect or the turn’s untap step, or use Undo.');
  player.mana=(player.mana||[]).filter(lot=>lot.activationId!==activation.id);
  for(const lot of activation.spent){const {type,amount,...qualities}=lot;addMana(player,{[type]:amount},qualities);}
  player.life+=activation.lifePaid||0;
 }
 card.tapped=false;delete card.manaActivation;delete card.tapAbility;
}
export function validateManaActivation(record){
 if(record===undefined)return;
 if(!record||typeof record.id!=='string'||!Number.isInteger(record.owner)||record.owner<0||record.owner>3||!Array.isArray(record.spent)||!Array.isArray(record.produced)||record.lifePaid!==undefined&&(!Number.isSafeInteger(record.lifePaid)||record.lifePaid<0||record.lifePaid>999999))throw Error('Invalid mana activation.');
 validateMana({mana:record.spent});validateMana({mana:record.produced});if(record.produced.some(l=>l.activationId!==record.id))throw Error('Invalid mana activation.');
}
