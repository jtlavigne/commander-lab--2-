import {cardFace} from './card-state.mjs';
import {findCard,transfer,shuffle} from './engine.mjs';
import {fieldCards,isCreature} from './creature-rules.mjs';
import {queueCombatTriggers,snapshotCard} from './combat-effects.mjs';

export const POLYMORPH_OPERATIONS=['polymorph','revealPermanents','polymorphReveal','finishPolymorph'];
const number=s=>({a:1,one:1,two:2,three:3}[s?.toLowerCase()]??Number(s));
export function compilePolymorphEffect(text){let m;
 if(/^Exile (?:another )?target (?:planeswalker or creature|creature or planeswalker) you control\. Reveal cards from the top of your library until you reveal a creature or planeswalker card\. Put that card onto the battlefield and the rest on the bottom of your library in a random order\.$/i.test(text))return [{op:'polymorph',scope:'target',types:['Creature','Planeswalker'],destination:'exile',remainder:'random-bottom'}];
 if(/^Put target creature on the bottom of its owner's library\. That creature's controller reveals cards from the top of their library until they reveal a creature card\. The player puts that card onto the battlefield and the rest on the bottom of their library in any order\.$/i.test(text))return [{op:'polymorph',scope:'target',types:['Creature'],destination:'library',recipient:'controller',remainder:'ordered-bottom'}];
 if(/^Exile all creatures you control, then reveal cards from the top of your library until you reveal that many creature cards\. Put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library\.$/i.test(text))return [{op:'polymorph',scope:'all',types:['Creature'],destination:'exile',remainder:'shuffle'}];
 if(/^Exile all creatures you control\. At the beginning of the next end step, reveal cards from the top of your library until you reveal that many creature cards, put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library\.$/i.test(text))return [{op:'polymorph',scope:'all',types:['Creature'],destination:'exile',remainder:'shuffle',delayed:true}];
 // Delayed instructions store the number actually exiled, not a later board count.
 if((m=text.match(/^Reveal cards from the top of your library until you reveal (a|one|two|three|\d+) creature cards?, put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library\.$/i)))return [{op:'revealPermanents',count:number(m[1]),types:['Creature'],remainder:'shuffle'}];
 return null;
}

// Move a simultaneous batch with the pre-move observers, so a creature exiled
// alongside another permanent can still see the same leave event.
function removeForPolymorph(g,affected,destination){
 const observers=fieldCards(g).map(({card,owner})=>({card:snapshotCard(card),owner})),events=[];
 for(const {card,owner} of affected){const snapshot=snapshotCard(card),actualOwner=card.ownerSeat??owner;
  transfer(g,card.instance,destination,actualOwner,undefined,{deferTriggers:true});
  events.push({kind:'leave',owner,card:snapshot});
  // Tokens cannot return after leaving the battlefield (including Staff's
  // library). They still count among creatures exiled by the instruction.
  if(card.token)g.players[actualOwner].zones[destination]=g.players[actualOwner].zones[destination].filter(c=>c.instance!==card.instance);
 }
 queueCombatTriggers(g,events,observers);
}

export function runPolymorphStep(g,context,step,remaining,run){
 const owner=step.owner??context.owner;
 if(step.op==='finishPolymorph'){
  // Remainder movement is a later instruction. In particular, do not shuffle
  // an entering card back into the library while its replacements are pending.
  const rest=step.ids.filter(id=>!step.hits.includes(id)&&findCard(g,id)?.zone==='library');
  if(step.remainder==='ordered-bottom'&&rest.length){run(g,context,[{op:'orderBottomLibrary',owner,ids:rest,min:rest.length,max:rest.length},...remaining]);return 2;}
  const library=g.players[owner].zones.library;
  if(step.remainder==='shuffle')shuffle(library);
  else{const bottom=rest.map(id=>findCard(g,id).card);shuffle(bottom);const ids=new Set(rest);g.players[owner].zones.library=[...library.filter(c=>!ids.has(c.instance)),...bottom];}
  return 1;
 }
 if(step.op==='polymorph'){
  const found=findCard(g,context.target?.id),affected=step.scope==='all'?fieldCards(g).filter(f=>f.owner===owner&&isCreature(f.card)):found?.zone==='battlefield'?[found]:[];
  const recipient=step.recipient==='controller'?found?.owner:owner;
  if(recipient===undefined||step.scope==='target'&&!affected.length)return 1;
  removeForPolymorph(g,affected,step.destination);
  const count=step.scope==='all'?affected.length:1;
  if(step.delayed){(g.delayedTriggers??=[]).push({owner:recipient,source:context.source,kind:'end-step',afterTurn:g.turn+':'+g.active,text:'Reveal cards from the top of your library until you reveal '+count+' creature cards, put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library.'});return 1;}
  run(g,context,[{op:'revealPermanents',owner:recipient,count,types:step.types,remainder:step.remainder},...remaining]);return 2;
 }
 if(step.op==='revealPermanents'){
  const ids=[],hits=[];
  for(const card of g.players[owner].zones.library){if(hits.length>=step.count)break;ids.push(card.instance);if(step.types.some(type=>new RegExp('\\b'+type+'\\b').test(cardFace(card).type_line||'')))hits.push(card.instance);}
  if(!ids.length){if(step.remainder==='shuffle')shuffle(g.players[owner].zones.library);return 1;}
  // Revealed cards are public while this confirmation is pending; no player
  // receives priority in the middle of resolving the spell or ability.
  g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step:{op:'polymorphReveal',owner,ids,hits,remainder:step.remainder,min:0,max:0},remaining,revealed:{owner,ids}};return 2;
 }
 return 0;
}

export function resolvePolymorphChoice(g,pending,run){
 if(pending.step.op!=='polymorphReveal')return false;
 const {step,context,remaining,owner}=pending;
 const requests=step.hits.filter(id=>{const found=findCard(g,id);return found?.zone==='library'&&found.owner===owner;}).map(id=>({id,owner}));
 // All hits share one entry batch. Incoming replacement providers cannot
 // modify companions, while entry triggers see the completed group.
 run(g,context,[{op:'enterPermanents',requests,revealed:{owner,ids:step.ids}},{op:'finishPolymorph',owner,ids:step.ids,hits:step.hits,remainder:step.remainder},...remaining]);return true;
}
