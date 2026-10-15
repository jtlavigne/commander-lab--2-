import {validateOpeningHands} from './opening-hand.mjs';
export const STEPS=['Untap','Upkeep','Draw','Precombat main','Beginning of combat','Declare attackers','Declare blockers','Combat damage','End of combat','Postcombat main','End step','Cleanup'];
export const ZONES=['library','hand','battlefield','graveyard','exile','command'];
import {initializePermanent,cardFace} from './card-state.mjs';
import {drawWithReplacements} from './resource-rules.mjs';
import {refreshPairs} from './soulbond.mjs';
import {graveyardExileReplacement} from './grave-casting.mjs';
import {clearMana,validateMana,validateManaSettings,validateManaActivation} from './mana.mjs';
import {validateLoyaltyState} from './planeswalker.mjs';
import {pendingEntry} from './life-effects.mjs';
import {assertCombatStep,enterCombatStep,cleanTurnDamage,beginControllerTurn,validateCombat} from './combat.mjs';
import {validateCombatTrigger,queueCombatTriggers,snapshotCard} from './combat-effects.mjs';
import {validateOracleChoice} from './oracle-effects.mjs';
import {nextTurnStep,commitTurnStep,selectTurnStep,validateTurnPlan} from './turn-plan.mjs';
import {combatStats} from './creature-rules.mjs';
import {refreshLinkedCards} from './linked-cards.mjs';
import {validatePlayEvents} from './play-events.mjs';
import {attachPermanent} from './attachments.mjs';
import {validateLobby,startingLife} from './lobby.mjs';
import {validateOutcome,nextLivingSeat} from './game-outcome.mjs';
import {automaticFor} from './turn-settings.mjs';
import {responseModeFor,validResponseMode} from './response-settings.mjs';
// ---- Table construction and basic turn actions ----
export function newGame(playerCount=4){if(![2,3,4].includes(playerCount))throw Error('Choose 2, 3, or 4 players.');return {version:1,turn:1,active:0,step:0,stack:[],log:[],players:Array.from({length:playerCount},(_,i)=>({name:'Player '+(i+1),life:40,poison:0,damage:Array(playerCount).fill(0),casts:0,mana:[],landsPlayed:0,extraLandPlays:0,zones:Object.fromEntries(ZONES.map(z=>[z,[]]))}))};}
export function note(g,text){g.log.unshift(text);g.log=g.log.slice(0,200);}
export function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}
export function draw(g,p,n=1,{turnAction=true,opening=false,work}={}){
 if(g.pendingEffect)throw Error('Finish the pending effect before drawing.');
 if(opening){let drawn=0;for(let i=0;i<n&&g.players[p].zones.library.length;i++){transfer(g,g.players[p].zones.library[0].instance,'hand',p);drawn++;}return drawn;}
 const events=[],result=drawWithReplacements(g,p,n,()=>{const card=g.players[p].zones.library[0];if(card){transfer(g,card.instance,'hand',p);events.push({kind:'draw',owner:p});return {card,pause:g.drawHistory.counts[p]===0&&/(?:^|\n)Miracle (?:\{[^}]+\})+/.test(cardFace(card).oracle_text||'')};}g.players[p].failedDraw=true;note(g,g.players[p].name+' cannot draw: library empty.');},work),drawn=result.drawn;
 if(result.paused){const card=result.paused,cost=cardFace(card).oracle_text.match(/(?:^|\n)Miracle ((?:\{[^}]+\})+)/)[1];g.resolutionInProgress=true;g.pendingEffect={kind:'oracle-choice',owner:p,name:'First drawn card',context:{owner:p,name:'Draw',source:{instance:'draw-'+crypto.randomUUID(),name:'Draw'}},step:{op:'miracleReveal',id:card.instance,zoneChangeId:card.zoneChangeId,cost,min:1,max:1},remaining:[{op:'resumeDraw',owner:p,work:result.work}]};}
 if(turnAction&&g.step===2&&p===g.active&&n>0)g.turnDrawStamp=g.turn+':'+g.active;
 queueCombatTriggers(g,events);note(g,g.players[p].name+' draws '+drawn+'.');return drawn;
}
export function advance(g,{automatic=true}={}){if(g.stack.length||g.pendingEffect||pendingEntry(g))throw Error('Resolve the stack and pending effects before advancing.');const planned=nextTurnStep(g),next=planned.step;assertCombatStep(g,next);clearMana(g,{endOfTurn:g.step===STEPS.length-1});delete g.priority;commitTurnStep(g,planned);g.step=next;if(g.step===2)g.drawStepSerial=(g.drawStepSerial||0)+1;if(g.step===0){cleanTurnDamage(g);{const previous=g.active;g.active=nextLivingSeat(g,g.active);if(g.active<=previous)g.turn++;}g.players[g.active].landsPlayed=0;g.players[g.active].extraLandPlays=0;beginControllerTurn(g);}if(g.step===11)cleanTurnDamage(g);if(automaticFor(g,g.active,automatic)&&g.step===0)untap(g,g.active);if(automaticFor(g,g.active,automatic)&&g.step===2)draw(g,g.active);enterCombatStep(g,g.step);note(g,g.players[g.active].name+': '+STEPS[g.step]);}
export function changeStep(g,step){if(g.stack.length||g.pendingEffect||pendingEntry(g))throw Error('Resolve the stack and pending effects before changing steps.');if(!Number.isInteger(step)||step<0||step>=STEPS.length)throw Error('Unknown step.');assertCombatStep(g,step);if(step!==g.step){clearMana(g);delete g.priority;selectTurnStep(g,step);g.step=step;if(step===2)g.drawStepSerial=(g.drawStepSerial||0)+1;if(step===11)cleanTurnDamage(g);enterCombatStep(g,step);}note(g,g.players[g.active].name+': '+STEPS[g.step]+' (manual step selection).');}
export function untap(g,p){
 g.players[p].zones.battlefield.forEach(c=>{if(c.skipNextUntap){delete c.skipNextUntap;return;}c.tapped=false;delete c.manaActivation;delete c.tapAbility;});
 if(g.step===0&&p===g.active){g.turnUntapStamp=g.turn+':'+g.active;for(const [owner,player] of g.players.entries())if(owner!==p)for(const source of player.zones.battlefield)if(!source.faceDown){const scope=cardFace(source).oracle_text?.match(/^Untap all (artifacts|creatures|lands|permanents) you control during each other player's untap step\./im)?.[1];if(scope)for(const card of player.zones.battlefield)if(scope==='permanents'||new RegExp('\\b'+scope.replace(/s$/,'')+'\\b','i').test(cardFace(card).type_line||'')){card.tapped=false;delete card.manaActivation;delete card.tapAbility;}}}
 note(g,g.players[p].name+' untaps their battlefield.');
}
export function endTurn(g,{automatic=false}={}){if(g.stack.length||g.pendingEffect||pendingEntry(g))throw Error('Resolve the stack and pending effects before ending the turn.');assertCombatStep(g,0);clearMana(g,{endOfTurn:true});cleanTurnDamage(g);delete g.priority;delete g.turnPlan;g.step=0;{const previous=g.active;g.active=nextLivingSeat(g,g.active);if(g.active<=previous)g.turn++;}g.players[g.active].landsPlayed=0;g.players[g.active].extraLandPlays=0;beginControllerTurn(g);if(automaticFor(g,g.active,automatic))untap(g,g.active);note(g,'Turn '+g.turn+': '+g.players[g.active].name);}
export function findCard(g,id){for(let owner=0;owner<g.players.length;owner++)for(const zone of ZONES){const card=g.players[owner].zones[zone].find(c=>c.instance===id);if(card)return {card,owner,zone};}const entry=g.stack.find(e=>e.card?.instance===id);return entry?{card:entry.card,owner:entry.owner,zone:'stack'}:null;}
export function commandersFor(g,owner){return [...ZONES.flatMap(zone=>g.players[owner].zones[zone]),...g.stack.filter(entry=>entry.owner===owner).map(entry=>entry.card)].filter(card=>card?.commander).sort((a,b)=>(a.commandSlot??0)-(b.commandSlot??0));}
// ---- Zone transitions and permanent identity ----
// Rules effects and manual transfers share cleanup and leave/entry events.
// Current controller (`target`) can differ from the card's persistent ownerSeat.
export function transfer(g,id,to,target,position,{deferTriggers=false,entryCounters={},entryTapped=false,attachTo}={}){
 if(!ZONES.includes(to)&&to!=='stack')throw Error('Unknown zone');
 const found=findCard(g,id);if(!found)throw Error('Card not found');
 const {card,owner,zone}=found;target??=owner;
 // Casting decisions live on the stack object, never on a card that could
 // leave and return later. Capture them before removing that stack entry.
 const spell=zone==='stack'?g.stack.find(e=>e.card?.instance===id):null;
 const cast=spell&&!spell.manualPlacement?{x:spell.castX||0,phyrexianLife:spell.castPayment?.phyrexianLife||0,colors:spell.copy?[]:spell.castPayment?.colors||[]}:undefined;
 if(zone==='graveyard'&&to==='graveyard'&&owner===target)return card;
 if(to==='graveyard'&&graveyardExileReplacement(g,card,target))to='exile';
 if(zone==='stack'&&g.stack.find(e=>e.card?.instance===id)?.flashback&&to!=='stack')to='exile';
 if(zone==='stack'&&g.stack.find(e=>e.card?.instance===id)?.graveyardExile&&to==='graveyard'&&target===owner)to='exile';
 if(!Number.isInteger(target)||target<0||target>=g.players.length)throw Error('Unknown seat');
 if(position&&(!Number.isFinite(position.x)||!Number.isFinite(position.y)))throw Error('Invalid card position');
 if(zone==='battlefield'&&to!=='battlefield'){
  const power=combatStats(g,owner,card)?.power;
  for(const entry of [...g.stack,...(g.deferredTriggers||[])])if(entry.source?.instance===id&&(entry.source.battlefieldId||null)===(card.battlefieldId||null)){if(typeof power==='number')entry.source.lastKnownPower=power;entry.source.lastKnownTapped=!!card.tapped;}
 }
 if(zone==='battlefield'&&to!=='battlefield'){if(g.battlefieldDepartures?.turn!==g.turn+':'+g.active)g.battlefieldDepartures={turn:g.turn+':'+g.active,counts:g.players.map(()=>0)};g.battlefieldDepartures.counts[owner]++;const stats=combatStats(g,owner,card);card.lastBattlefield={id:card.battlefieldId||null,power:typeof stats?.power==='number'?stats.power:0,toughness:typeof stats?.toughness==='number'?stats.toughness:0,counters:structuredClone(card.counters||{})};}
 // Leave/death triggers see the old characteristics and observers, even when
 // the card's counters, attachments and battlefield identity are cleared below.
 const departure=zone==='battlefield'&&to!=='battlefield'&&!deferTriggers?{card:snapshotCard(card),observers:g.players.flatMap((p,owner)=>p.zones.battlefield.map(card=>({card:snapshotCard(card),owner})))}:null;
 card.ownerSeat??=owner;
 if(zone==='battlefield'&&(to!=='battlefield'||owner!==target)&&g.combat){g.combat.attackers=g.combat.attackers.filter(a=>a.id!==id);g.combat.blocks=g.combat.blocks.filter(b=>b.blocker!==id);delete g.combat.assignments.first;delete g.combat.assignments.normal;}
 if(zone==='battlefield'&&to!=='battlefield')for(const player of g.players)for(const permanent of player.zones.battlefield){if(permanent.loyaltyAttachment===id)delete permanent.loyaltyAttachment;if(permanent.attachedTo===id){delete permanent.attachedTo;delete permanent.attachedBattlefieldId;}}
 if(to==='command'){
  card.commander=true;const others=commandersFor(g,target).filter(c=>c!==card),used=new Set(others.map(c=>c.commandSlot??0));
  if(!Number.isInteger(card.commandSlot)||used.has(card.commandSlot)){card.commandSlot=0;while(used.has(card.commandSlot))card.commandSlot++;}
  card.commandCasts??=others.length?0:g.players[target].casts;
 }
 if(card.manifested&&to!=='battlefield'){delete card.manifested;card.faceDown=false;card.face=0;}
 if(to==='graveyard'||to==='exile'||card.commander&&!card.manifested){card.faceDown=false;if(card.commander)card.face=0;}
 if(card.layout==='transform'&&to!=='battlefield'&&to!=='stack')card.face=0;
 if(zone===to&&owner===target){if(to==='battlefield'&&position)card.tablePosition={x:Math.max(0,Math.min(1,position.x)),y:Math.max(0,Math.min(1,position.y)),normalized:true};return card;}
 if(zone==='stack')g.stack.splice(g.stack.findIndex(e=>e.card?.instance===id),1);
 else g.players[owner].zones[zone].splice(g.players[owner].zones[zone].indexOf(card),1);
 if(to!=='battlefield')card.tapped=false;
 if(to==='stack'){g.stack.push({card,owner:target,manualPlacement:true});g.priority={seat:target,passes:0};if(card.commander&&zone==='command'){card.commandCasts=(card.commandCasts??g.players[owner].casts)+1;g.players[owner].casts++;}}
 else{if(to!=='battlefield'){delete card.armorChoice;delete card.animatedCreature;delete card.exileLinks;delete card.linkedExileCount;card.counters={};delete card.tablePosition;}g.players[target].zones[to].push(card);}
 if(to!=='battlefield'){delete card.armorChoice;delete card.animatedCreature;delete card.exileLinks;delete card.linkedExileCount;card.counters={};delete card.tablePosition;delete card.battlefieldStats;delete card.entryChoices;delete card.entryLife;delete card.entryCondition;delete card.manaActivation;delete card.tapAbility;delete card.loyaltyActivations;delete card.loyaltyExtra;delete card.loyaltyAttachment;delete card.attachedTo;delete card.attachedBattlefieldId;delete card.attachedZoneChangeId;delete card.attachmentMode;delete card.reanimationLink;delete card.classLevel;delete card.markedDamage;delete card.deathtouchDamage;delete card.temporaryStats;delete card.temporaryKeywords;delete card.lostKeywords;delete card.summoningSick;delete card.battlefieldId;}
 card.zoneChangeId=crypto.randomUUID();
 if(to!=='battlefield'||zone!=='battlefield'||owner!==target)delete card.pairedWith;
 delete card.playPermission;delete card.flashbackGrant;delete card.graveCastGrant;
 delete card.rebound;
 if(to!=='battlefield'){delete card.skipNextUntap;delete card.attackHistory;delete card.exertedTurn;delete card.imprintLink;delete card.imprintProfile;delete card.abilityUses;delete card.triggerUses;delete card.graveCastUses;delete card.goadedBy;delete card.combatDamageHistory;}
 if(to==='battlefield'){
  if(zone==='stack'&&card.spellCopy){delete card.spellCopy;card.token=true;}
  if(zone!=='stack'&&zone!=='battlefield')card.castKicks=0;
  if(zone!=='battlefield')initializePermanent(card,g,target,{forceTapped:entryTapped,cast});else if(owner!==target)card.summoningSick=true;
  if(attachTo&&!attachPermanent(g,id,attachTo))throw Error('This permanent cannot attach to that recipient.');
  if(zone!=='battlefield')for(const [kind,n] of Object.entries(entryCounters)){if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid entering counters.');card.counters[kind]=(card.counters[kind]||0)+n;}
  if(/power and toughness are each equal to the number of lands you control/i.test(card.oracle_text||''))delete card.entryChoices;
  if(position)card.tablePosition={x:Math.max(0,Math.min(1,position.x)),y:Math.max(0,Math.min(1,position.y)),normalized:true};
  else delete card.tablePosition;
  if(zone!=='battlefield'&&!deferTriggers)queueCombatTriggers(g,[{kind:'enter',owner:target,card:snapshotCard(card)}]);
 }
 refreshLinkedCards(g);
 refreshPairs(g);
 if(zone==='stack'&&card.spellCopy&&to!=='stack'&&to!=='battlefield'){const cards=g.players[target].zones[to];cards.splice(cards.indexOf(card),1);}
 if(departure){const event={card:departure.card,owner,deadZoneId:card.zoneChangeId};queueCombatTriggers(g,[{...event,kind:'leave'},...(to==='graveyard'?[{...event,kind:'graveyard'},...(/\bCreature\b/.test(departure.card.type_line||'')?[{...event,kind:'die'}]:[])]:[])],departure.observers);}
 note(g,g.players[target].name+': '+card.name+' → '+to);return card;
}
export function move(g,p,id,to){const found=findCard(g,id);if(!found||found.owner!==p||found.zone==='stack')throw Error('Card not found');return transfer(g,id,to,p);}
export function resolve(g,to){const entry=g.stack.at(-1);if(!entry)return;if(g.pendingEffect||pendingEntry(g))throw Error('Finish pending effects before resolving another object.');if(!entry.card)throw Error('Use Resolve mana for this ability.');if(!ZONES.includes(to))throw Error('Unknown zone');transfer(g,entry.card.instance,to,entry.owner);delete g.priority;note(g,'Resolved '+entry.card.name+' → '+to);}
// ---- Deck text import ----
export function parseDeck(text){
 const cards=new Map();
 for(const line of text.split(/\r?\n/)){
  const value=line.trim();if(!value||value.startsWith('//')||value.startsWith('#'))continue;
  // Keep names such as "1000-Year Storm" and "Xantcha" intact.
  const prefix=value.match(/^(\d+)(?:[x×]\s*|\s+[x×]\s+|\s+)(.+)$/i);
  const suffix=prefix?null:value.match(/^(.+?)\s+[x×]\s*(\d+)$/i);
  const count=prefix?Number(prefix[1]):suffix?Number(suffix[2]):1;
  const name=(prefix?prefix[2]:suffix?suffix[1]:value).replace(/\s+\([A-Za-z0-9]+\)\s+\S+.*$/,'').trim();
  if(!Number.isSafeInteger(count)||count<1||count>500)throw Error('Invalid quantity for '+name+': use 1–500 copies.');
  const key=name.toLowerCase(),existing=cards.get(key);
  if(existing)existing.count+=count;else cards.set(key,{count,name});
 }
 return [...cards.values()];
}
// ---- Canonical save validation and normalization ----
// Used on imports and on reduced commands. Pending choices are part of saved
// game state, including their continuation, rather than renderer-only dialogs.
export function validateSession(value){
 const fail=()=>{throw Error('Invalid session file');};
 if(!value||value.version!==1||!Array.isArray(value.players)||![2,3,4].includes(value.players.length)||!Array.isArray(value.stack)||!Array.isArray(value.log)||value.log.some(t=>typeof t!=='string')||!Number.isInteger(value.turn)||value.turn<1||!Number.isInteger(value.active)||value.active<0||value.active>=value.players.length||!Number.isInteger(value.step)||value.step<0||value.step>=STEPS.length)fail();
 const ids=new Set();
 if(value.resolutionInProgress!==undefined&&typeof value.resolutionInProgress!=='boolean'||value.deferredTriggers!==undefined&&(!Array.isArray(value.deferredTriggers)||value.deferredTriggers.length>2000))fail();
 for(const entry of value.deferredTriggers||[]){if(entry.kind!=='ability'||!Number.isInteger(entry.owner)||entry.owner<0||entry.owner>=value.players.length)fail();validateCombatTrigger(entry,fail);}
 if(value.temporaryManaRules&&(!Array.isArray(value.temporaryManaRules)||value.temporaryManaRules.length>1000||value.temporaryManaRules.some(t=>!t||!Number.isInteger(t.owner)||t.owner<0||t.owner>=value.players.length||!['Land','Plains','Island','Swamp','Mountain','Forest'].includes(t.scope)||!['W','U','B','R','G','C'].includes(t.color)||!t.source||typeof t.source.instance!=='string'||typeof t.source.name!=='string')))fail();
 if(value.attackDeclarations&&(!/^\d+:[0-3]$/.test(value.attackDeclarations.turn)||!Array.isArray(value.attackDeclarations.owners)||value.attackDeclarations.owners.some(n=>!Number.isInteger(n)||n<0||n>=value.players.length)))fail();
 if(value.delayedTriggers&&(!Array.isArray(value.delayedTriggers)||value.delayedTriggers.length>1000||value.delayedTriggers.some(t=>!t||!Number.isInteger(t.owner)||t.owner<0||t.owner>=value.players.length||!/^\d+:[0-3]$/.test(t.afterTurn)||t.kind!==undefined&&!['upkeep','end-step'].includes(t.kind)||typeof t.text!=='string'||!t.source||typeof t.source.instance!=='string'||typeof t.source.name!=='string')))fail();
 if(value.spellCopyEffects&&(!Array.isArray(value.spellCopyEffects)||value.spellCopyEffects.length>1000||value.spellCopyEffects.some(e=>!e||!Number.isInteger(e.owner)||e.owner<0||e.owner>=value.players.length||!/^\d+:[0-3]$/.test(e.turn)||!['next','each'].includes(e.mode)||!['controller','all'].includes(e.scope)||e.used!==undefined&&typeof e.used!=='boolean'||!e.source||typeof e.source.instance!=='string'||typeof e.source.name!=='string')))fail();
 if(value.temporaryGraveyardRules&&(!Array.isArray(value.temporaryGraveyardRules)||value.temporaryGraveyardRules.length>1000||value.temporaryGraveyardRules.some(e=>!e||!Number.isInteger(e.owner)||!value.players[e.owner]||!/^\d+:[0-3]$/.test(e.turn)||!['play','exile'].includes(e.kind)||!e.source||typeof e.source.instance!=='string'||typeof e.source.name!=='string')))fail();
 if(value.drawStepSerial!==undefined&&(!Number.isSafeInteger(value.drawStepSerial)||value.drawStepSerial<0))fail();
 if(value.drawHistory&&(!/^\d+:[0-3]$/.test(value.drawHistory.turn)||['counts','stepCounts'].some(k=>value.drawHistory[k]!==undefined&&(!Array.isArray(value.drawHistory[k])||value.drawHistory[k].length!==value.players.length||value.drawHistory[k].some(n=>!Number.isSafeInteger(n)||n<0)))||!Array.isArray(value.drawHistory.counts)||value.drawHistory.step!==undefined&&typeof value.drawHistory.step!=='string'))fail();
 if(value.castHistory&&['spells','instants'].some(key=>value.castHistory[key]!==undefined&&(!Array.isArray(value.castHistory[key])||value.castHistory[key].length!==value.players.length||value.castHistory[key].some(n=>!Number.isSafeInteger(n)||n<0))))fail();
 if(value.castHistory&&(!/^\d+:[0-3]$/.test(value.castHistory.turn)||!Array.isArray(value.castHistory.noncreature)||value.castHistory.noncreature.length!==value.players.length||value.castHistory.noncreature.some(n=>!Number.isSafeInteger(n)||n<0)))fail();
 if(value.castHistory&&(value.castHistory.total!==undefined&&(!Number.isSafeInteger(value.castHistory.total)||value.castHistory.total<0)||value.castHistory.instantSorcery!==undefined&&(!Array.isArray(value.castHistory.instantSorcery)||value.castHistory.instantSorcery.length!==value.players.length||value.castHistory.instantSorcery.some(n=>!Number.isSafeInteger(n)||n<0))))fail();
 const checkCard=(card,zone)=>{
  if(['spellCopy','cardCopy'].some(k=>card?.[k]!==undefined&&typeof card[k]!=='boolean'))fail();
  if(card?.pairedWith&&(!card.pairedWith||typeof card.pairedWith.id!=='string'||typeof card.pairedWith.battlefieldId!=='string'||zone!=='battlefield'))fail();
  if(card?.graveCastUses&&(!/^\d+:[0-3]$/.test(card.graveCastUses.turn)||!Array.isArray(card.graveCastUses.ids)||card.graveCastUses.ids.some(id=>typeof id!=='string')||zone!=='battlefield'))fail();
  if(card?.attachmentMode!==undefined&&(card.attachmentMode!=='reanimated'||zone!=='battlefield'))fail();
  if(card?.attachedZoneChangeId!==undefined&&card.attachedZoneChangeId!==null&&typeof card.attachedZoneChangeId!=='string')fail();
  if(card?.reanimationLink&&(!card.reanimationLink||typeof card.reanimationLink.id!=='string'||typeof card.reanimationLink.battlefieldId!=='string'||!Number.isInteger(card.reanimationLink.abilityOwner)||!value.players[card.reanimationLink.abilityOwner]||zone!=='battlefield'))fail();
  if(card?.manifested!==undefined&&(card.manifested!==true||!card.faceDown||zone!=='battlefield'))fail();
  if(!card||typeof card.name!=='string'||typeof card.instance!=='string'||!card.instance||ids.has(card.instance)||card.counters&&(typeof card.counters!=='object'||Array.isArray(card.counters)||Object.values(card.counters).some(n=>!Number.isFinite(n)))||card.tablePosition&&(!Number.isFinite(card.tablePosition.x)||!Number.isFinite(card.tablePosition.y)))fail();
  if(card.armorChoice&&(!card.armorChoice||typeof card.armorChoice.id!=='string'||card.armorChoice.battlefieldId!==null&&typeof card.armorChoice.battlefieldId!=='string'))fail();
  if(card.animatedCreature!==undefined&&typeof card.animatedCreature!=='boolean'||card.linkedExileCount!==undefined&&(!Number.isSafeInteger(card.linkedExileCount)||card.linkedExileCount<0)||card.exileLinks!==undefined&&(!Array.isArray(card.exileLinks)||card.exileLinks.length>2000||card.exileLinks.some(link=>!link||typeof link.id!=='string'||typeof link.zoneChangeId!=='string')))fail();
  if(zone!=='battlefield'){delete card.armorChoice;delete card.animatedCreature;delete card.exileLinks;delete card.linkedExileCount;}
  if(card.lostKeywords&&(!Array.isArray(card.lostKeywords)||card.lostKeywords.length>50||card.lostKeywords.some(k=>typeof k!=='string')))fail();
  ids.add(card.instance);card.counters??={};card.face=Number.isInteger(card.face)&&card.face>=0?card.face:0;
  if(card.ownerSeat!==undefined&&(!Number.isInteger(card.ownerSeat)||card.ownerSeat<0||card.ownerSeat>3)||card.zoneChangeId!==undefined&&typeof card.zoneChangeId!=='string')fail();
  if(card.castKicks!==undefined&&(!Number.isSafeInteger(card.castKicks)||card.castKicks<0||card.castKicks>100))fail();
  if(card.graveCastGrant&&(!Number.isInteger(card.graveCastGrant.owner)||!value.players[card.graveCastGrant.owner]||!/^\d+:[0-3]$/.test(card.graveCastGrant.turn)||card.graveCastGrant.zoneChangeId!==null&&typeof card.graveCastGrant.zoneChangeId!=='string'||zone!=='graveyard'))fail();
  if(card.flashbackGrant&&(!Number.isInteger(card.flashbackGrant.owner)||card.flashbackGrant.owner<0||card.flashbackGrant.owner>=value.players.length||!/^\d+:[0-3]$/.test(card.flashbackGrant.turn)||card.flashbackGrant.zoneChangeId!==null&&typeof card.flashbackGrant.zoneChangeId!=='string'||typeof card.flashbackGrant.cost!=='string'||card.flashbackGrant.cost.length>1000||zone!=='graveyard'))fail();
  if(card.playPermission&&(['free','spellsOnly'].some(k=>card.playPermission[k]!==undefined&&typeof card.playPermission[k]!=='boolean')||!Number.isInteger(card.playPermission.owner)||card.playPermission.owner<0||card.playPermission.owner>=value.players.length||!/^\d+:[0-3]$/.test(card.playPermission.turn)||typeof card.playPermission.zoneChangeId!=='string'))fail();
  if(card.rebound&&(!Number.isInteger(card.rebound.owner)||card.rebound.owner<0||card.rebound.owner>=value.players.length||typeof card.rebound.zoneChangeId!=='string'))fail();
  validateManaSettings(card.manaSettings);
  validateLoyaltyState(value,card);
  if(zone==='battlefield')validateManaActivation(card.manaActivation);else delete card.manaActivation;
  if(card.tapAbility!==undefined&&typeof card.tapAbility!=='boolean')fail();if(zone!=='battlefield')delete card.tapAbility;
  if(card.lastBattlefield&&(typeof card.lastBattlefield.id!=='string'&&card.lastBattlefield.id!==null||![card.lastBattlefield.power,card.lastBattlefield.toughness].every(Number.isSafeInteger)||!card.lastBattlefield.counters||Object.values(card.lastBattlefield.counters).some(n=>!Number.isSafeInteger(n)||n<0)))fail();
  if(card.triggerUses&&(!card.triggerUses||typeof card.triggerUses.turn!=='string'||!Array.isArray(card.triggerUses.ids)||card.triggerUses.ids.length>100||card.triggerUses.ids.some(id=>typeof id!=='string')))fail();
  if(card.battlefieldStats&&(!Number.isInteger(card.battlefieldStats.face)||Object.entries(card.battlefieldStats).some(([key,n])=>!['face','power','toughness'].includes(key)||!Number.isSafeInteger(n))))fail();
  if(card.entryChoices&&(!Array.isArray(card.entryChoices)||card.entryChoices.length>40||card.entryChoices.some(c=>!c||typeof c.key!=='string'||!(/^(?:power|toughness|counter:.{1,80})$/).test(c.key)||typeof c.label!=='string'||!Number.isSafeInteger(c.suggested)||!Number.isSafeInteger(c.min))))fail();
  if(card.entryLife!==undefined&&(!card.entryLife||typeof card.entryLife!=='object'||!Number.isSafeInteger(card.entryLife.amount)||card.entryLife.amount<1||card.entryLife.amount>999999||typeof card.entryLife.forcedTapped!=='boolean'))fail();
  if(card.entryCondition!==undefined&&(typeof card.entryCondition!=='string'||!card.entryCondition.length||card.entryCondition.length>2000))fail();
  if(card.loyaltyLayout&&(typeof card.loyaltyLayout!=='object'||Array.isArray(card.loyaltyLayout)||Object.values(card.loyaltyLayout).some(positions=>!Array.isArray(positions)||positions.length>20||positions.some(p=>!p||![p.x,p.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1)))))fail();
  if(zone!=='battlefield'){delete card.battlefieldStats;delete card.entryChoices;delete card.entryLife;delete card.entryCondition;delete card.loyaltyActivations;delete card.loyaltyExtra;delete card.loyaltyAttachment;delete card.classLevel;}
  if(zone!=='battlefield')card.tapped=false;
  if(zone==='command')card.commander=true;
  if(zone==='graveyard'||zone==='exile'||card.commander)card.faceDown=false;
  if(card.layout==='transform'&&zone!=='battlefield'&&zone!=='stack')card.face=0;
  if(card.commander){card.face=0;if(card.commandCasts!==undefined&&(!Number.isSafeInteger(card.commandCasts)||card.commandCasts<0))fail();}
  if(card.commandSlot!==undefined&&(!Number.isInteger(card.commandSlot)||card.commandSlot<0||card.commandSlot>499))fail();
 };
 const checkPlayer=(player,damageCount)=>{
  if(player?.automatic!==undefined&&typeof player.automatic!=='boolean')fail();
  if(player?.responseMode!==undefined&&!validResponseMode(player.responseMode))fail();
  if(player?.failedDraw!==undefined&&typeof player.failedDraw!=='boolean')fail();
  if(!player||typeof player.name!=='string'||![player.life,player.poison,player.casts].every(Number.isFinite)||!Array.isArray(player.damage)||player.damage.length!==damageCount||player.damage.some(n=>!Number.isFinite(n))||!player.zones||!ZONES.every(zone=>Array.isArray(player.zones[zone])))fail();
  if(player.counters!==undefined&&(!player.counters||typeof player.counters!=='object'||Array.isArray(player.counters)||Object.keys(player.counters).length>100||Object.entries(player.counters).some(([kind,n])=>!kind||kind.length>80||kind==='poison'||!Number.isSafeInteger(n)||n<0||n>999999)))fail();
  if(player.commanderDamage!==undefined&&(!player.commanderDamage||typeof player.commanderDamage!=='object'||Array.isArray(player.commanderDamage)||Object.values(player.commanderDamage).some(n=>!Number.isSafeInteger(n)||n<0||n>999999)))fail();
  if(player.eliminated&&(!player.eliminated||typeof player.eliminated.reason!=='string'||player.eliminated.reason.length>300))fail();
  player.landsPlayed??=0;player.extraLandPlays??=0;if(![player.landsPlayed,player.extraLandPlays].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=999999))fail();
  validateMana(player);for(const zone of ZONES)player.zones[zone].forEach(card=>checkCard(card,zone));
  if(player.noncreatureLock!==undefined&&(typeof player.noncreatureLock!=='string'||!/^\d+:[0-3]$/.test(player.noncreatureLock)))fail();
 };
 for(const player of value.players)checkPlayer(player,value.players.length);
 if(value.inactivePlayers!==undefined){if(!Array.isArray(value.inactivePlayers)||value.inactivePlayers.length>4-value.players.length||new Set(value.inactivePlayers.map(p=>p.seat)).size!==value.inactivePlayers.length)fail();for(const reserve of value.inactivePlayers){if(!Number.isInteger(reserve.seat)||reserve.seat<value.players.length||reserve.seat>3)fail();checkPlayer(reserve.player,4);}}
 if(value.departedCards!==undefined){if(!Array.isArray(value.departedCards)||value.departedCards.length>10000)fail();for(const item of value.departedCards){if(!item||!Number.isInteger(item.seat)||!value.players[item.seat])fail();checkCard(item.card,'exile');}}
 for(const entry of value.stack){if(!entry||!Number.isInteger(entry.owner)||entry.owner<0||entry.owner>=value.players.length)fail();
  if(entry.castX!==undefined&&(!Number.isSafeInteger(entry.castX)||entry.castX<0||entry.castX>999999))fail();
  if(entry.castPayment!==undefined){const payment=entry.castPayment;if(!payment||!Number.isSafeInteger(payment.phyrexianLife)||payment.phyrexianLife<0||payment.phyrexianLife>999999||payment.phyrexianLife%2||!Array.isArray(payment.colors)||payment.colors.some(color=>!['W','U','B','R','G'].includes(color))||new Set(payment.colors).size!==payment.colors.length)fail();}
  if(entry.kind==='mana'||entry.kind==='ability'){
  if(typeof entry.name!=='string'||typeof entry.id!=='string'||!entry.source||typeof entry.source.name!=='string'||!entry.ability||typeof entry.ability.text!=='string'||typeof entry.ability.tap!=='boolean'||entry.kind==='mana'&&(!entry.ability.output||typeof entry.ability.output.clause!=='string')||!entry.counts||Object.entries(entry.counts).some(([t,n])=>!['W','U','B','R','G','C'].includes(t)||!Number.isSafeInteger(n)||n<0||n>999999))fail();
 }else{checkCard(entry.card,'stack');if(entry.spellText!==undefined&&(typeof entry.spellText!=='string'||entry.spellText.length>20000)||entry.mode!==undefined&&(!Number.isInteger(entry.mode)||entry.mode<0||entry.mode>20)||entry.resolving!==undefined&&typeof entry.resolving!=='boolean'||entry.flashback!==undefined&&typeof entry.flashback!=='boolean'||entry.graveyardExile!==undefined&&typeof entry.graveyardExile!=='boolean'||entry.castFrom!==undefined&&!['hand','command','graveyard','exile','library'].includes(entry.castFrom)||entry.castStep!==undefined&&(!Number.isInteger(entry.castStep)||entry.castStep<0||entry.castStep>=STEPS.length))fail();if(entry.division!==undefined&&(!Array.isArray(entry.division)||entry.division.length>100||new Set(entry.division.map(d=>d.key)).size!==entry.division.length||entry.division.some(d=>!d||typeof d.key!=='string'||!Number.isSafeInteger(d.amount)||d.amount<1)))fail();if(entry.targets!==undefined&&(!Array.isArray(entry.targets)||entry.targets.length>100||entry.targets.some(t=>!t||!['card','player'].includes(t.kind)||!Number.isInteger(t.owner)||t.owner<0||t.owner>=value.players.length||typeof t.key!=='string'||t.kind==='card'&&(typeof t.id!=='string'||!['battlefield','graveyard','stack'].includes(t.zone)))))fail();}validateCombatTrigger(entry,fail);}
 if(value.priority&&(!Number.isInteger(value.priority.seat)||value.priority.seat<0||value.priority.seat>=value.players.length||!Number.isInteger(value.priority.passes)||value.priority.passes<0||value.priority.passes>=value.players.length))fail();
 if(value.responseMode!==undefined&&!['auto','hold'].includes(value.responseMode))fail();
 if(value.battlefieldDepartures&&(typeof value.battlefieldDepartures.turn!=='string'||!Array.isArray(value.battlefieldDepartures.counts)||value.battlefieldDepartures.counts.length!==value.players.length||value.battlefieldDepartures.counts.some(n=>!Number.isSafeInteger(n)||n<0)))fail();
 validateLoyaltyState(value);validateTurnPlan(value,fail);
 if(value.pendingEffect&&(!['proliferate','counter-choice','combat-manual','oracle-choice','destruction-choice'].includes(value.pendingEffect.kind)||!Number.isInteger(value.pendingEffect.owner)||value.pendingEffect.owner<0||value.pendingEffect.owner>=value.players.length||typeof value.pendingEffect.name!=='string'||value.pendingEffect.kind==='combat-manual'&&typeof value.pendingEffect.text!=='string'))fail();
 validateOracleChoice(value.pendingEffect,fail,value.players.length);
 if(value.pendingEffect?.context?.spellId&&!value.stack.some(entry=>entry.card?.instance===value.pendingEffect.context.spellId&&entry.resolving))fail();
 validateCombat(value,fail);
 validatePlayEvents(value,fail);
 for(let owner=0;owner<value.players.length;owner++){const used=new Set();for(const [index,card] of commandersFor(value,owner).entries()){if(card.commandSlot===undefined||used.has(card.commandSlot)){card.commandSlot=0;while(used.has(card.commandSlot))card.commandSlot++;}used.add(card.commandSlot);card.commandCasts??=index===0?Math.max(0,Math.floor(value.players[owner].casts)):0;}}
 validateOutcome(value);validateLobby(value);validateOpeningHands(value);refreshLinkedCards(value);return value;
}
// ---- Clean-game reset and seat-count changes ----
// Rebuild physical cards by ownership, preserve decks/names/preferences, and
// discard turn-specific state. Token and spell-copy objects are not deck cards.
export function resetGame(g){
 const fresh=newGame(g.players.length);fresh.responseMode=g.responseMode;if(g.inactivePlayers)fresh.inactivePlayers=structuredClone(g.inactivePlayers);
 if(g.lobby)fresh.lobby=structuredClone(g.lobby);fresh.players.forEach(p=>p.life=startingLife(fresh));
 for(const [seat,player] of g.players.entries()){fresh.players[seat].name=player.name;fresh.players[seat].responseMode=responseModeFor(g,seat);if(player.automatic!==undefined)fresh.players[seat].automatic=player.automatic;}
 const cards=[...g.players.flatMap((p,seat)=>ZONES.flatMap(zone=>p.zones[zone].map(card=>({card,seat})))),...g.stack.filter(e=>e.card).map(e=>({card:e.card,seat:e.owner})),...(g.departedCards||[])];
 for(const {card,seat} of cards)if(!card.token&&!card.spellCopy&&!card.cardCopy){const owner=card.ownerSeat??seat,c=structuredClone(card);for(const key of ['tablePosition','battlefieldStats','entryChoices','entryLife','entryCondition','manaActivation','tapAbility','loyaltyActivations','loyaltyExtra','loyaltyAttachment','classLevel','markedDamage','deathtouchDamage','temporaryStats','temporaryKeywords','lostKeywords','summoningSick','battlefieldId','zoneChangeId','manaSettings','attachedTo','attachedBattlefieldId','attachedZoneChangeId','attachmentMode','reanimationLink','pairedWith','skipNextUntap','attackHistory','exertedTurn','playPermission','flashbackGrant','graveCastGrant','rebound','imprintLink','imprintProfile','lastBattlefield','abilityUses','triggerUses','graveCastUses','goadedBy','combatDamageHistory','castKicks','armorChoice','animatedCreature','exileLinks','linkedExileCount'])delete c[key];c.counters={};c.tapped=false;c.faceDown=false;c.face=0;c.ownerSeat=owner;if(c.commander)c.commandCasts=0;fresh.players[owner].zones[c.commander?'command':'library'].push(c);}
 for(const [owner,p] of fresh.players.entries()){shuffle(p.zones.library);draw(fresh,owner,Math.min(7,p.zones.library.length),{opening:true});}note(fresh,'Game reset. Imported decks and player names kept.');return fresh;
}
export function changePlayerCount(g,count){
 if(![2,3,4].includes(count))throw Error('Choose 2, 3, or 4 players.');if(count===g.players.length)return g;
 const all=newGame(4);g.players.forEach((p,i)=>all.players[i]=p);for(const reserve of g.inactivePlayers||[])all.players[reserve.seat]=reserve.player;all.stack=g.stack;if(g.departedCards)all.departedCards=g.departedCards;all.responseMode=g.responseMode;
 const fresh=resetGame(all),players=fresh.players;fresh.players=players.slice(0,count);for(const p of fresh.players)p.damage=p.damage.slice(0,count);fresh.inactivePlayers=players.slice(count).map((player,i)=>({seat:count+i,player}));note(fresh,count+'-player game. Unused seats’ decks are saved.');return fresh;
}
