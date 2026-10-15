import {emblemSources} from './rule-sources.mjs';
import {publicManifest} from './face-down-state.mjs';
import {gainLife} from './resource-rules.mjs';
import {soulbondOptions} from './soulbond.mjs';
import {graveyardExileReplacement} from './grave-casting.mjs';
import {spellTriggerCount} from './spell-copy-rules.mjs';
import {cardFace,manaValue} from './card-state.mjs';
import {findCard,transfer,note,draw,shuffle} from './engine.mjs';
import {fieldCards,rulesText,selfSubject,combatRecipient,isCreature,keywordSet,protectedFrom,combatStats,attackKeywordCount,exertAbility} from './creature-rules.mjs';
import {activeRuleParagraphs,grantedAbilities} from './ability-effects.mjs';
import {addMana,parseProduction} from './mana.mjs';
import {dealDamagePackets} from './combat.mjs';
import {applyOracleEffect,applyCounterEvents} from './oracle-effects.mjs';
import {permanentCounterEvent} from './counter-effects.mjs';
import {effectTargetSpec,effectTargetOptions} from './effect-targets.mjs';
import {recordPlay} from './play-events.mjs';
import {attackTriggerCount,claimTriggerUse,triggeredParagraphs,enqueueTriggers,stageTriggers} from './trigger-rules.mjs';

const number=value=>({a:1,an:1,one:1,two:2,three:3,four:4,five:5}[value?.toLowerCase()]??Number(value));
export const snapshotCard=card=>{if(card.faceDown&&card.manifested)return publicManifest(card);const {localImages,card_faces,...rest}=card;return {...structuredClone(rest),...cardFace({...card,localImages:undefined,card_faces:card_faces?.map(({localImages,image_uris,...face})=>face)}),localImages:undefined,card_faces:undefined};};
function eventMatches(g,condition,event,source,owner){
 condition=condition.trim();if(['attack','block'].includes(event.kind))condition=condition.replace(/attacks or blocks$/i,event.kind==='attack'?'attacks':'blocks');const card=event.card,controller=event.owner;
 if(['enter','attack'].includes(event.kind))condition=condition.replace(/enters or attacks$/i,event.kind==='enter'?'enters':'attacks');
 if(event.kind==='attack'&&/ attacks for the first time each turn$/i.test(condition))return card?.instance===source.instance&&selfSubject(condition.replace(/ attacks for the first time each turn$/i,''),source)&&card.attackHistory?.count===1;
 if(event.kind==='begin-combat')return /^(?:combat on your turn|your combat phase)$/i.test(condition)&&owner===g.active||/^each combat$/i.test(condition)||/^combat on each opponent's turn$/i.test(condition)&&owner!==g.active;
 if(event.kind==='upkeep'||event.kind==='end-step'){const phase=event.kind==='upkeep'?'upkeep':'end step';return condition.toLowerCase()==='your '+phase&&owner===g.active||condition.toLowerCase()==='each '+phase||condition.toLowerCase()==='the '+phase||condition.toLowerCase()==="each opponent's "+phase&&owner!==g.active;}
 if(event.kind==='receive-damage'){const m=condition.match(/^(.+?) is dealt damage$/i);return !!m&&card?.instance===source.instance&&selfSubject(m[1],source);}
 if(event.kind==='sacrifice'){const m=condition.match(/^you sacrifice (?:a|an) (\w+)$/i);return !!m&&controller===owner&&new RegExp('\\b'+m[1]+'\\b','i').test(cardFace(card).type_line||'');}
 if(event.kind==='targeted-spell')return /^a creature you control becomes the target of a spell$/i.test(condition)&&controller===owner&&isCreature(card);
 if(event.kind==='tap-mana')return /^an opponent taps a land for mana$/i.test(condition)&&controller!==owner&&/\bLand\b/.test(cardFace(card).type_line||'');
 if(event.kind==='graveyard'){const m=condition.match(/^(.+?) is put into a graveyard from the battlefield$/i);return !!m&&card?.instance===source.instance&&selfSubject(m[1],source);}
 if(event.kind==='counter-spell')return controller===owner&&/^a spell or ability you control counters a spell$/i.test(condition);
 if(event.kind==='draw')return /^you draw a card$/i.test(condition)&&controller===owner||/^an opponent draws a card$/i.test(condition)&&controller!==owner||/^a player draws a card$/i.test(condition);
 if(event.kind==='cycle')return controller===owner&&card.instance===source.instance&&/^you cycle this card$/i.test(condition);
 if(event.kind==='create-token')return controller===owner&&/^you create (?:one or more|a|an) (?:creature )?tokens?$/i.test(condition)&&(!/creature/i.test(condition)||isCreature(card));
 if(event.kind==='cast'||event.kind==='copy'){
  if(event.kind==='cast'&&/^you copy /i.test(condition))return false;
  if(event.kind==='copy'&&!/^you (?:cast or )?copy /i.test(condition))return false;
  condition=condition.replace(/^you copy /i,'you cast ');
  condition=condition.replace(/^you cast or copy /i,'you cast ');
  if(/^you cast a spell$/i.test(condition))return controller===owner;
  if(/^you cast your first instant spell each turn$/i.test(condition))return controller===owner&&/\bInstant\b/.test(cardFace(card).type_line||'')&&event.instantOrdinal===1;
  if(/^you cast your first spell each turn$/i.test(condition))return controller===owner&&event.ownSpellOrdinal===1;
  const experience=condition.match(/^you cast an instant or sorcery spell with mana value greater than the number of (\w+) counters you have$/i);
  if(experience)return controller===owner&&/\b(?:Instant|Sorcery)\b/.test(cardFace(card).type_line||'')&&manaValue(card,{x:event.x||0,onStack:true})>(g.players[owner].counters?.[experience[1].toLowerCase()]||0);
  if(/^you cast an instant or sorcery spell$/i.test(condition))return controller===owner&&/\b(?:Instant|Sorcery)\b/.test(cardFace(card).type_line||'');
  if(/^a player casts an instant or sorcery spell$/i.test(condition))return event.kind==='cast'&&/\b(?:Instant|Sorcery)\b/.test(cardFace(card).type_line||'');
  if(/^you cast a noncreature spell$/i.test(condition))return controller===owner&&!/\bCreature\b/.test(cardFace(card).type_line||'');
  if(/^an opponent casts (?:a noncreature spell|a spell)$/i.test(condition))return controller!==owner&&(!/noncreature/i.test(condition)||!/\bCreature\b/.test(cardFace(card).type_line||''));
  if(/^an opponent casts their first noncreature spell each turn$/i.test(condition))return controller!==owner&&event.noncreatureOrdinal===1&&!/\bCreature\b/.test(cardFace(card).type_line||'');
  const categories=condition.match(/^you cast an? ((?:Aura|Equipment|Vehicle)(?:,? (?:or )?(?:Aura|Equipment|Vehicle))*) spell$/i);
  if(categories)return controller===owner&&categories[1].split(/,? (?:or )?/).some(type=>new RegExp('\\b'+type+'\\b','i').test(cardFace(card).type_line||''));
  const cast=condition.match(/^you cast (?:a|an) (?:(green) )?(creature|permanent|artifact|enchantment|instant|sorcery) spell$/i);if(!cast||controller!==owner)return false;
  const face=cardFace(card);return (!cast[1]||(face.colors||[]).includes('G'))&&(cast[2].toLowerCase()==='permanent'?!/\b(?:Instant|Sorcery|Land)\b/.test(face.type_line||''):new RegExp('\\b'+cast[2]+'\\b','i').test(face.type_line||''));
 }
 if(event.kind==='attack'){
  if(/^you attack with one or more non-(\w+) creatures$/i.test(condition)){const subtype=condition.match(/non-(\w+)/i)[1];return controller===owner&&isCreature(card)&&!new RegExp('\\b'+subtype+'\\b','i').test(cardFace(card).type_line||'');}
  if(/^(?:a player|you|an opponent) attacks? (?:a player|one of your opponents|another one of your opponents)$/i.test(condition))return event.defenderTarget?.kind==='player'&&(/^a player /i.test(condition)||/^you /i.test(condition)&&controller===owner||/^an opponent /i.test(condition)&&controller!==owner)&&(!/your opponents/i.test(condition)||event.defender!==owner);
 }
 const another=/^another /i.test(condition);condition=condition.replace(/^another /i,'');if(another&&card?.instance===source.instance)return false;
 if(event.kind==='damage'){
  const match=condition.match(/^(.+?) deals? (combat )?damage to (a player|an opponent|you)$/i);if(!match||match[2]&&event.combat===false||event.target?.kind!=='player')return false;
  return (match[3].toLowerCase()==='a player'||match[3].toLowerCase()==='you'&&event.target.owner===owner||match[3].toLowerCase()==='an opponent'&&event.target.owner!==owner)&&subjectMatches(match[1]);
 }
 const pattern=event.kind==='attack'?/^(.+?) attacks?$/i:event.kind==='block'?/^(.+?) blocks?(?: a creature)?$/i:event.kind==='enter'?/^(.+?) enters?(?: the battlefield)?$/i:event.kind==='leave'?/^(.+?) leaves? the battlefield$/i:event.kind==='die'?/^(.+?) (?:dies|die)$/i:null,match=pattern&&condition.match(pattern);if(!match)return false;
 if(match[1].toLowerCase()==='you'&&event.kind==='attack')return owner===g.active;
 return subjectMatches(match[1].replace(/^one or more /i,''));
 function subjectMatches(subject){
  subject=subject.replace(/^one or more /i,'');
  const keyword=subject.match(/^(.+?) with (deathtouch|lifelink|flying|trample|infect)$/i);if(keyword){if(!(event.keywords||[...keywordSet(g,controller,card)]).includes(keyword[2].toLowerCase()))return false;subject=keyword[1];}
  const either=subject.match(/^(.+?) or another (.+)$/i);
  if(either)return selfSubject(either[1],source)&&card?.instance===source.instance||card?.instance!==source.instance&&combatRecipient(g,either[2],card,controller,source,owner);
  if(!card)return false;if(selfSubject(subject,source))return card.instance===source.instance;
  return combatRecipient(g,subject.replace(/^(?:a|an) /i,'').replace(/^creature$/i,'creatures'),card,controller,source,owner);
 }
}
function interveningCondition(g,text,event,source,owner){
 const match=text.match(/^if (.+?), (.+)$/i);if(!match)return {text,valid:true};
 let valid=false;
 const power=match[1].match(/^you control a creature with power (\d+) or greater$/i);
 const life=match[1].match(/^you have (\d+) or more life$/i);if(life)valid=g.players[owner].life>=Number(life[1]);
 const opponentLife=/^that opponent has more life than another of your opponents$/i.test(match[1]);if(opponentLife)valid=event.defender!==owner&&g.players.some((p,seat)=>seat!==owner&&seat!==event.defender&&g.players[event.defender]?.life>p.life);
 const firstCombat=/^it's the first combat phase of the turn$/i.test(match[1]);if(firstCombat)valid=g.combatsThisTurn?.turn===g.turn+':'+g.active&&g.combatsThisTurn.count===1;
 const main=/^it's your main phase$/i.test(match[1]);if(main)valid=owner===g.active&&[3,9].includes(g.step);
 const sourceZone=match[1].match(/^(.+?) is in the command zone or on the battlefield$/i);
 const onBattlefield=/^it's on the battlefield$/i.test(match[1]);if(onBattlefield){const found=findCard(g,source.instance);valid=found?.zone==='battlefield'&&found.card.battlefieldId===source.battlefieldId;}
 const tapped=match[1].match(/^(.+?) is tapped$/i);if(tapped&&selfSubject(tapped[1],source)){const found=findCard(g,source.instance);valid=found?.zone==='battlefield'&&found.card.battlefieldId===source.battlefieldId?!!found.card.tapped:!!(source.lastKnownTapped??source.tapped);}
 if(sourceZone&&selfSubject(sourceZone[1],source)){const found=findCard(g,source.instance);valid=!!found&&['command','battlefield'].includes(found.zone)&&found.card.zoneChangeId===source.zoneChangeId;}
 if(power)valid=g.players[owner].zones.battlefield.some(c=>isCreature(c)&&Number(combatStats(g,owner,c)?.power)>=Number(power[1]));
 if(/^it doesn't have the same name as another creature you control or a creature card in your graveyard$/i.test(match[1]))valid=!event.card.token&&![...g.players[owner].zones.battlefield.filter(c=>c.instance!==event.card.instance),...g.players[owner].zones.graveyard].some(c=>isCreature(c)&&cardFace(c).name===cardFace(event.card).name);
 // Unknown intervening conditions must remain a manual effect, not disappear.
 return power||life||opponentLife||firstCombat||main||sourceZone||onBattlefield||tapped||/^it doesn't have the same name/.test(match[1])?{text:match[2],valid}:{text,valid:true};
}
export function queueCombatTriggers(g,events,observers=fieldCards(g).map(({card,owner})=>({card:snapshotCard(card),owner}))){
 observers=[...observers,...emblemSources(g).map(({card,owner})=>({card:snapshotCard(card),owner}))];
 events=events.filter(e=>!g.players[e.owner]?.eliminated);
 const queued=[];
 for(const event of events)if(event.kind==='leave'&&event.card.reanimationLink)queued.push(make(event.card,event.card.reanimationLink.abilityOwner,"That creature's controller sacrifices it.",event));
 for(const event of events)if(event.kind==='miracle')queued.push(make(event.card,event.owner,'You may cast this card for its miracle cost.',event));
 const usedDelayed=new Set();for(const event of events)if(['upkeep','end-step'].includes(event.kind))for(const effect of g.delayedTriggers||[])if((effect.kind||'upkeep')===event.kind&&(event.kind!=='upkeep'||effect.afterTurn!==g.turn+':'+g.active)&&!g.players[effect.owner].eliminated){queued.push(make(effect.source,effect.owner,effect.text,event));usedDelayed.add(effect);}
 if(usedDelayed.size)g.delayedTriggers=g.delayedTriggers.filter(e=>!usedDelayed.has(e));
 if(events.some(e=>e.kind==='upkeep')){
  for(const {card:source,owner} of observers)if(owner===g.active&&!source.faceDown)for(const {text} of activeRuleParagraphs(source))if(/^Cumulative upkeep /i.test(text))queued.push(make(source,owner,rulesText({oracle_text:text}),{kind:'upkeep',owner:g.active}));
 }
 if(events.some(e=>e.kind==='end-combat')&&g.combat?.endTriggers){for(const effect of g.combat.endTriggers)queued.push(make(effect.source,effect.owner,'Exile the tokens created by this ability.',{kind:'end-combat',owner:effect.owner,tokens:effect.tokens}));delete g.combat.endTriggers;}
 const observerGame={...g,players:g.players.map((p,owner)=>({...p,zones:{...p.zones,battlefield:observers.filter(f=>f.owner===owner).map(f=>f.card)}}))};
 const sources=[...observers,...events.filter(e=>e.kind==='cycle').map(e=>({card:e.card,owner:e.owner})),...g.players.flatMap((p,owner)=>p.zones.command.filter(card=>!card.faceDown).map(card=>({card:snapshotCard(card),owner,command:true})))];
 for(const event of events)if(event.kind==='spent-mana'&&isCreature(event.card)){
  const types=(cardFace(event.card).type_line?.split('—')[1]||'').trim().split(/\s+/).filter(Boolean);
  const publicCommanders=g.players.flatMap((p,seat)=>['battlefield','command','graveyard','exile'].flatMap(zone=>p.zones[zone].filter(card=>card.commander&&!card.faceDown&&(card.ownerSeat??seat)===event.owner))).concat(g.stack.filter(e=>e.card?.commander&&!e.card.faceDown&&(e.card.ownerSeat??e.owner)===event.owner).map(e=>e.card));
  if(publicCommanders.some(card=>isCreature(card)&&types.some(type=>(cardFace(card).type_line.split('—')[1]||'').trim().split(/\s+/).includes(type))))for(let i=0;i<event.amount;i++)queued.push(make(event.source,event.owner,'Scry 1.',event));
 }
 if(events.some(e=>e.kind==='upkeep'))for(const card of g.players[g.active].zones.exile)if(card.rebound?.owner===g.active&&card.rebound.zoneChangeId===card.zoneChangeId){
  queued.push(make(card,g.active,'You may cast this card from exile without paying its mana cost.',{kind:'rebound',owner:g.active,zoneChangeId:card.zoneChangeId,card:snapshotCard(card)}));delete card.rebound;
 }
 for(const event of events)if(event.kind==='cast'){
  if(g.castHistory?.turn!==g.turn+':'+g.active)g.castHistory={turn:g.turn+':'+g.active,noncreature:g.players.map(()=>0)};
  g.castHistory.total??=0;g.castHistory.instantSorcery??=g.players.map(()=>0);event.spellsBefore=g.castHistory.total++;
  g.castHistory.spells??=g.players.map(()=>0);g.castHistory.instants??=g.players.map(()=>0);event.ownSpellOrdinal=++g.castHistory.spells[event.owner];if(/\bInstant\b/.test(cardFace(event.card).type_line||''))event.instantOrdinal=++g.castHistory.instants[event.owner];
  event.ownSpellsBefore=g.castHistory.instantSorcery[event.owner];if(/\b(?:Instant|Sorcery)\b/.test(cardFace(event.card).type_line||''))g.castHistory.instantSorcery[event.owner]++;
  if(!/\bCreature\b/.test(cardFace(event.card).type_line||''))event.noncreatureOrdinal=++g.castHistory.noncreature[event.owner];
  if(/(?:^|\n)Storm(?:$|[ (\n])/i.test(cardFace(event.card).oracle_text||''))queued.push(make(event.card,event.owner,'Copy this spell for each spell cast before it this turn.',event));
  for(const effect of g.spellCopyEffects||[])if(effect.turn===g.turn+':'+g.active&&(effect.scope==='all'||effect.owner===event.owner)&&/\b(?:Instant|Sorcery)\b/.test(cardFace(event.card).type_line||'')&&!effect.used){queued.push(make(effect.source,event.owner,'Copy that spell. You may choose new targets for the copy.',event));if(effect.mode==='next')effect.used=true;}
 }
 for(const event of events)if(event.kind==='enter'&&isCreature(event.card))for(const {card:source,owner,command} of sources)if(!command&&!source.faceDown&&owner===event.owner&&/(?:^|\n)Soulbond\b/i.test(cardFace(source).oracle_text||'')&&soulbondOptions(g,owner,source,event).length)queued.push(make(source,owner,'You may pair this creature with another creature.',event));

 if(events.some(event=>event.kind==='begin-combat')){
  const phase=g.turnPlan?.steps[g.turnPlan.index];
  for(const effect of phase?.beginEffects||[])queued.push(make(effect.source,effect.owner,effect.text,{kind:'begin-combat',owner:g.active}));
  if(phase?.beginEffects)delete phase.beginEffects;
 }
 for(const {card:source,owner,command} of sources)if(!source.faceDown)for(const {text,index,key} of [...triggeredParagraphs(source),...(!command?grantedAbilities(observerGame,owner,source):[])]){
  if(command&&!/^Eminence — /i.test(text))continue;
  const line=rulesText({oracle_text:text}).replace(/^[A-Za-z ]+ — /,''),trigger=line.match(/^Whenever (you cast .+? spell), (.+)$/i)||line.match(/^(?:When|Whenever|At the beginning of) (.+?), ([^]+)$/i);if(!trigger)continue;
  const matched=events.filter(event=>eventMatches(g,trigger[1],event,source,owner));
  const grouped=matched[0]?.kind==='block'&&!/blocks? a creature$/i.test(trigger[1])?[...new Map(matched.map(e=>[e.card.instance,e])).values()]:/one or more/i.test(trigger[1])&&matched[0]?.kind==='damage'?[...new Map(matched.map(e=>[e.target.owner,e])).values()]:/one or more|^you attacks?$/i.test(trigger[1])?matched.slice(0,1):matched;
  const limited=/ This ability triggers only once each turn\.$/i.test(trigger[2]);
  const effects=trigger[2].replace(/ This ability triggers only once each turn\.$/i,'');
  const playerAttacks=/^(?:a player|you|an opponent) attacks? (?:a player|one of your opponents|another one of your opponents)$/i.test(trigger[1]);
  const selected=playerAttacks?[...new Map(matched.map(e=>[e.defender,e])).values()]:/^you attack with one or more /i.test(trigger[1])?matched.slice(0,1):grouped;
  for(const event of selected)if(interveningCondition(g,effects,event,source,owner).valid&&(!limited||claimTriggerUse(g,source,'trigger:'+String(key??index))))queued.push(make(source,owner,effects,event,{...(limited?{limited:true}:{})}));
 }
 for(const event of events){
  if(event.kind==='exert'){const text=exertAbility(event.card);if(text)queued.push(make(event.card,event.owner,text,event));}
  if(event.kind!=='attack')continue;
  for(let i=0;i<attackKeywordCount(g,event.owner,event.card,'myriad');i++)queued.push(make(event.card,event.owner,'Create myriad copies.',event));
  for(const keyword of ['mentor','melee','battle cry'])for(let i=0;i<attackKeywordCount(g,event.owner,event.card,keyword);i++){
   const text=keyword==='mentor'?'Put a +1/+1 counter on target attacking creature with lesser power.':keyword==='melee'?'This creature gets +1/+1 until end of turn for each opponent you attacked this combat.':'Each other attacking creature gets +1/+0 until end of turn.';
   queued.unshift(make(event.card,event.owner,text,event,{keyword}));
  }
 }
 for(const event of events)if(event.kind==='attack'&&(g.combat?.attackers||[]).filter(a=>!a.enteredAttacking).length===1)for(const {card:source,owner,command} of sources)if(!command&&owner===event.owner&&!source.faceDown)for(const {text} of activeRuleParagraphs(source))if(/^Exalted(?:$|[ (])/i.test(text))queued.push(make(source,owner,'It gets +1/+1 until end of turn.',event));
 for(const event of events)if(event.kind==='die')for(const [keyword,counter] of [['undying','+1/+1'],['persist','-1/-1']])if(new RegExp('(?:^|\\n)'+keyword+'(?:$|[ (])','i').test(rulesText(event.card))&&!event.card.counters?.[counter])queued.push(make(event.card,event.owner,'Return this card to the battlefield with a '+counter+' counter on it.',event,{returnCounter:counter}));
 // Multipliers apply only to permanent abilities caused directly by attacking.
 for(const entry of [...queued])if(entry.combatTrigger.event.kind==='attack'&&!entry.combatTrigger.limited&&observers.some(o=>o.owner===entry.owner&&o.card.instance===entry.source.instance)){for(let i=1;i<attackTriggerCount(observers,entry.owner);i++)queued.push({...structuredClone(entry),id:'trigger-'+crypto.randomUUID()});}
 for(const entry of [...queued])if(!entry.combatTrigger.limited&&observers.some(o=>o.owner===entry.owner&&o.card.instance===entry.source.instance)){for(let i=1;i<spellTriggerCount(observers,entry.owner,entry.combatTrigger.event);i++)queued.push({...structuredClone(entry),id:'trigger-'+crypto.randomUUID()});}
 // A mandatory-target trigger with no legal target cannot remain on the stack.
 // APNAP order and each controller's ordering choice are shared with reflexive triggers.
 stageTriggers(g,queued);for(const entry of queued)note(g,entry.name+' triggers: '+entry.text);return queued;
 function make(source,owner,text,event,extra={}){const power=combatStats(g,owner,source)?.power;return {kind:'ability',id:'trigger-'+crypto.randomUUID(),owner,name:source.name,text,source:{...snapshotCard(source),...(typeof power==='number'?{lastKnownPower:power}:{})},ability:{text,tap:false,output:null},counts:{},combatTrigger:{event:structuredClone(event),...extra}};}
}
export function queueReflexiveTrigger(g,context,text,waiting=[]){
 const entry={kind:'ability',id:'trigger-'+crypto.randomUUID(),owner:context.owner,name:context.name,text,source:context.source,ability:{text,tap:false,output:null},counts:{},combatTrigger:{event:{kind:'reflexive',owner:context.owner,card:context.source}}};stageTriggers(g,[...waiting,entry]);return entry;
}
export function triggerOrderGroup(g){
 for(const first of g.stack.filter(e=>e.orderOpen)){const entries=g.stack.filter(e=>e.orderOpen&&e.orderBatch===first.orderBatch&&e.owner===first.owner);if(entries.length>1)return {owner:first.owner,batch:first.orderBatch,entries:entries.reverse()};}
 return null;
}
export function orderTriggers(g,owner,ids){
 const group=triggerOrderGroup(g);if(!group||group.owner!==owner)throw Error('Another player must order their triggers first.');
 if(!Array.isArray(ids)||ids.length!==group.entries.length||new Set(ids).size!==ids.length||ids.some(id=>!group.entries.some(e=>e.id===id)))throw Error('Order all and only this player’s simultaneous triggers.');
 const entries=new Map(group.entries.map(e=>[e.id,e])),ordered=ids.toReversed().map(id=>entries.get(id));let index=0;
 g.stack=g.stack.map(e=>entries.has(e.id)?ordered[index++]:e);note(g,g.players[owner].name+' changes simultaneous trigger order.');
}
export function confirmTriggerOrder(g,owner){
 const group=triggerOrderGroup(g);if(!group||group.owner!==owner)throw Error('Another player is choosing trigger order.');
 for(const entry of group.entries)delete entry.orderOpen;note(g,g.players[owner].name+' confirms trigger order.');
}
export function closeTriggerOrders(g){for(const entry of g.stack)delete entry.orderOpen;}
export function triggerTargetOptions(g,entry){
 return entry.combatTrigger?effectTargetOptions(g,entry):[];
}
export function triggerNeedsTarget(g){if(g.pendingEffect)return;return g.stack.find(e=>e.combatTrigger&&effectTargetSpec(e.text)&&!e.combatTrigger.targetsChosen&&!e.combatTrigger.target&&triggerTargetOptions(g,e).length);}
export function chooseTriggerTarget(g,id,key){const entry=g.stack.find(e=>e.id===id);if(!entry?.combatTrigger)throw Error('Trigger not found.');const keys=Array.isArray(key)?key:[key],spec=effectTargetSpec(entry.text),options=triggerTargetOptions(g,entry);if(!spec||keys.length>(spec.max||1)||!keys.length&&!spec.optional||new Set(keys).size!==keys.length)throw Error('Choose a legal number of targets.');const targets=keys.map(k=>options.find(t=>t.key===k));if(targets.some(t=>!t)||spec.sameGraveyard&&new Set(targets.map(t=>t.owner)).size>1||spec.perOpponent&&new Set(targets.map(t=>t.owner)).size!==targets.length)throw Error('Choose legal targets from a single graveyard.');entry.combatTrigger.target=targets[0];entry.combatTrigger.targets=targets;entry.combatTrigger.targetsChosen=true;recordPlay(g,{kind:'ability',owner:entry.owner,source:entry.source,text:entry.text,targets,stackId:entry.id});note(g,entry.name+(targets.length?' targets '+targets.map(t=>t.label).join(', ')+'.':' chooses no targets.'));}
function samePermanent(found,source){return found?.zone==='battlefield'&&(found.card.battlefieldId||null)===(source.battlefieldId||null);}
export function resolveCombatTrigger(g,entry){
 if(!entry.combatTrigger)return false;const {event,returnCounter,target}=entry.combatTrigger,source=entry.source;
 if(effectTargetSpec(entry.text)){
  const current=triggerTargetOptions(g,entry),targets=(entry.combatTrigger.targets||[target]).filter(Boolean).filter(t=>current.some(o=>o.key===t.key)&& (t.kind!=='card'||(['graveyard','stack'].includes(t.zone)?(findCard(g,t.id)?.card.zoneChangeId||null)===t.zoneChangeId:samePermanent(findCard(g,t.id),t))));
  if(!targets.length&&(entry.combatTrigger.targets||[target]).filter(Boolean).length)return true;entry={...entry,combatTrigger:{...entry.combatTrigger,target:targets[0],targets}};
 }
 if(returnCounter){const found=findCard(g,event.card.instance);if(found?.zone==='graveyard'&&found.card.zoneChangeId===event.deadZoneId)transfer(g,found.card.instance,'battlefield',found.card.ownerSeat??found.owner,undefined,{entryCounters:{[returnCounter]:1}});return true;}
 const text=entry.text.trim(),found=findCard(g,source.instance),self=samePermanent(found,source)?found:null;
 const condition=interveningCondition(g,text,event,source,entry.owner);if(!condition.valid)return true;
 if(entry.combatTrigger.keyword){
  const keyword=entry.combatTrigger.keyword;
  const recipients=keyword==='mentor'?[findCard(g,entry.combatTrigger.target?.id)].filter(f=>f?.zone==='battlefield'):keyword==='melee'?(self?[self]:[]):(g.combat?.attackers||[]).filter(a=>a.id!==source.instance).map(a=>findCard(g,a.id)).filter(f=>f?.zone==='battlefield');
  if(keyword==='mentor'){applyCounterEvents(g,entry,recipients.map(({card})=>permanentCounterEvent(g,entry.owner,card.instance,{'+1/+1':1})));return true;}
  for(const {card} of recipients){
   const amount=keyword==='melee'?new Set(event.attackedOpponents||[]).size:1;card.temporaryStats??={power:0,toughness:0};card.temporaryStats.power+=amount;if(keyword==='melee')card.temporaryStats.toughness+=amount;
  }return true;
 }
 if(applyOracleEffect(g,entry,condition.text))return true;
 const counter=text.match(/^put (a|an|one|two|three|\d+) ([+\-]\d+\/[+\-]\d+|[a-z][a-z -]*?) counters? on (.+)\.$/i);
 if(counter){const count=number(counter[1]),kind=counter[2].toLowerCase(),subject=counter[3];let recipients;
  if(selfSubject(subject,source))recipients=self?[self]:[];
  else if(/^target creature/i.test(subject))recipients=target?.kind==='card'?[findCard(g,target.id)].filter(Boolean):[];
  else if(/^each /i.test(subject))recipients=fieldCards(g).filter(({card,owner})=>combatRecipient(g,subject.slice(5),card,owner,source,entry.owner));else return false;
  applyCounterEvents(g,entry,recipients.filter(f=>f.zone===undefined||f.zone==='battlefield').map(({card})=>permanentCounterEvent(g,entry.owner,card.instance,{[kind]:count})));return true;
 }
 const drawMatch=text.match(/^(?:you )?draw (a|one|two|three|\d+) cards?\.$/i);if(drawMatch){draw(g,entry.owner,number(drawMatch[1]),{turnAction:false});return true;}
 const gain=text.match(/^(?:you )?gain (\d+) life\.$/i);if(gain){gainLife(g,entry.owner,Number(gain[1]));return true;}
 const drain=text.match(/^(each opponent|target opponent|target player|defending player) loses (\d+) life(?: and you gain (\d+) life)?\.$/i);if(drain){
  const owners=/^each/i.test(drain[1])?g.players.map((_,i)=>i).filter(i=>i!==entry.owner):/^defending/i.test(drain[1])?[event.defender??event.target?.owner]:[target?.owner];for(const owner of owners)if(g.players[owner])g.players[owner].life-=Number(drain[2]);if(drain[3])gainLife(g,entry.owner,Number(drain[3]));return true;
 }
 const pump=text.match(/^(.+?) gets? ([+-]\d+)\/([+-]\d+)(?: and gains? (haste|vigilance|trample|flying|lifelink))? until end of turn\.$/i);
 if(pump){let recipients;if(selfSubject(pump[1],source))recipients=self?[self]:[];else if(/^target creature/i.test(pump[1]))recipients=target?.kind==='card'?[findCard(g,target.id)].filter(Boolean):[];else recipients=fieldCards(g).filter(({card,owner})=>combatRecipient(g,pump[1],card,owner,source,entry.owner));for(const {card} of recipients){card.temporaryStats??={power:0,toughness:0};card.temporaryStats.power+=Number(pump[2]);card.temporaryStats.toughness+=Number(pump[3]);if(pump[4])card.temporaryKeywords=[...new Set([...(card.temporaryKeywords||[]),pump[4].toLowerCase()])];}return true;}
 const output=parseProduction(text);if(output?.fixed&&!output.variable&&/^Add [^.]+\.$/i.test(text)){addMana(g.players[entry.owner],output.fixed,{source:entry.name});return true;}
 const damage=text.match(/^(.+?) deals (\d+) damage to (each opponent|each player|target player|target opponent|target creature|defending player|you)\.$/i);
 if(damage&&selfSubject(damage[1],source)){const scope=damage[3].toLowerCase(),targets=scope.startsWith('target')?[target].filter(Boolean):scope==='you'?[{kind:'player',owner:entry.owner}]:scope==='defending player'?[{kind:'player',owner:event.defender??event.target?.owner}]:g.players.flatMap((_,owner)=>scope==='each opponent'&&owner===entry.owner?[]:[{kind:'player',owner}]);const events=dealDamagePackets(g,targets.filter(t=>g.players[t.owner]).map(target=>({source:{owner:entry.owner,card:source},target,amount:Number(damage[2])})));queueCombatTriggers(g,events);return true;}
 return false;
}
export function deathDestinations(g,owner,card){
 const options=[],selfText=rulesText(card),actualOwner=card.ownerSeat??owner;
 const add=(zone,reason,extra={})=>{if(!options.some(o=>o.zone===zone&&!!o.shuffle===!!extra.shuffle&&!!o.bottom===!!extra.bottom))options.push({zone,reason,...extra});};
 if(graveyardExileReplacement(g,card,actualOwner))add('exile','Temporary graveyard replacement');
 if(card.counters?.finality>0)add('exile','Finality counter');
 for(const {card:source,owner:controller} of fieldCards(g))if(!source.faceDown)for(const {text:raw} of activeRuleParagraphs(source)){
  const text=rulesText({oracle_text:raw});
  if(/^If a card(?: or token)? would be put into a graveyard from anywhere, exile it instead\./i.test(text)&&(!card.token||/or token/i.test(text)))add('exile',source.name);
  if(/^If a card would be put into an opponent's graveyard from anywhere, exile it instead\./i.test(text)&&actualOwner!==controller&&!card.token)add('exile',source.name);
  const die=text.match(/^If (.+?) would die, exile (?:it|that (?:card|creature)) instead\./i);if(die&&combatRecipient(g,die[1].replace(/^(?:a|an) /i,'').replace(/^creature$/i,'creatures'),card,owner,source,controller))add('exile',source.name);
 }
 const selfDie=selfText.match(/(?:^|\n)If (.+?) would (?:die|be put into a graveyard from anywhere), (.+?) instead\./i);
 if(selfDie&&selfSubject(selfDie[1],card)){
  if(/^exile (?:it|this creature)$/i.test(selfDie[2]))add('exile',card.name);
  else if(/shuffle .*into its owner's library/i.test(selfDie[2]))add('library',card.name,{shuffle:true});
  else if(/put .*on (?:the )?(top|bottom) of its owner's library/i.test(selfDie[2]))add('library',card.name,{bottom:/bottom/i.test(selfDie[2])});
 }
 if(!options.length)add('graveyard','Dies');return options;
}
export function moveDeadPermanent(g,owner,card,option){
 const target=card.ownerSeat??owner,id=card.instance;transfer(g,id,option.zone,target,undefined,{deferTriggers:true});if(option.zone==='library'){const library=g.players[target].zones.library;library.splice(library.indexOf(card),1);option.bottom?library.push(card):library.unshift(card);if(option.shuffle)shuffle(library);}return card.zoneChangeId;
}
export function validateCombatTrigger(entry,fail){
 if(entry.orderBatch!==undefined&&typeof entry.orderBatch!=='string'||entry.orderOpen!==undefined&&typeof entry.orderOpen!=='boolean')fail();
 if(!entry.combatTrigger)return;const t=entry.combatTrigger;if(!t.event||!['create-token','leave','miracle','draw','counter-spell','copy','cycle','targeted-spell','reflexive','end-combat','sacrifice','spent-mana','rebound','begin-combat','attack','exert','block','damage','die','enter','cast','activate','upkeep','end-step','receive-damage','tap-mana','graveyard'].includes(t.event.kind)||t.target&&(!['player','card'].includes(t.target.kind)||!Number.isInteger(t.target.owner)||t.target.owner<0||t.target.owner>3)||t.returnCounter!==undefined&&!['+1/+1','-1/-1'].includes(t.returnCounter)||t.keyword!==undefined&&!['mentor','melee','battle cry'].includes(t.keyword))fail();
}
