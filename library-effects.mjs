import {transfer,shuffle,findCard,placeInLibrary} from './engine.mjs';
import {grantExilePlay} from './permission-effects.mjs';
import {cardFace,manaValue} from './card-state.mjs';

const count=text=>({a:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7}[text?.toLowerCase()]??Number(text));
export const LIBRARY_OPERATIONS=['mill','libraryPosition','iteration','iterationHand','iterationBottom','spouts','spoutsTop','surveil','putHandTop','lookOrderTop','shuffleLibrary','windfall','discardUnlessAttacked','lookSelect','selectLook','finishLook','orderBottomLibrary','viewHand','factReveal','chooseOpponent','dividePiles','choosePile'];
export const LIBRARY_CHOICES=['iterationHand','iterationBottom','spoutsTop','surveil','putHandTop','selectLook','finishLook','orderBottomLibrary','viewHand','chooseOpponent','dividePiles','choosePile'];
export function compileLibraryEffect(text){let m;
 if((m=text.match(/^(Target player|Each opponent|Each player|You) mills? (a|one|two|three|four|five|six|seven|\d+) cards?\.$/i)))return [{op:'mill',scope:m[1].toLowerCase(),amount:count(m[2])}];
 if((m=text.match(/^Put target (?:nonland )?permanent into its owner's library (second|third|fourth) from the top\.$/i)))return [{op:'libraryPosition',position:({second:2,third:3,fourth:4}[m[1].toLowerCase()])}];
 if(/^Look at the top three cards of your library\. Put one of them into your hand, put one of them on the bottom of your library, and exile one of them\. You may play the exiled card this turn\.$/i.test(text))return [{op:'iteration'}];
 if(/^For each attacking creature, its owner puts it on their choice of the top or bottom of their library\.$/i.test(text))return [{op:'spouts'}];
 if((m=text.match(/^Surveil (\d+)\.$/i)))return [{op:'surveil',amount:Number(m[1])}];
 if((m=text.match(/^Draw (a|one|two|three|four|five|six|seven|\d+) cards?, then put (a|one|two|three|four|\d+) cards? from your hand on (?:the )?(top|bottom) of your library(?: in any order)?\.$/i)))return [{op:'draw',amount:m[1]},{op:'putHandTop',min:count(m[2]),max:count(m[2]),placement:m[3].toLowerCase()}];
 if((m=text.match(/^Look at the top (three|\d+) cards of your library, then put them back in any order\. You may shuffle\.\s*Draw a card\.$/i)))return [{op:'lookOrderTop',amount:count(m[1])},{op:'optional',label:'Shuffle your library',then:[{op:'shuffleLibrary'}]},{op:'draw',amount:'a'}];
 if((m=text.match(/^Scry (\d+), then draw a card\.$/i)))return [{op:'scry',amount:m[1]},{op:'draw',amount:'a'}];
 if(/^Look at target player's hand\.$/i.test(text))return [{op:'viewHand',min:0,max:0}];
 if((m=text.match(/^Draw (a|one|two|three|X|\d+) cards?, then discard (a|one|two|three|\d+) cards?\.$/i)))return [{op:'draw',amount:m[1]},{op:'discard',max:count(m[2])}];
 if(/^Then discard a card unless you attacked this turn\.$/i.test(text))return [{op:'discardUnlessAttacked'}];
 if(/^Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way\.$/i.test(text))return [{op:'windfall'}];
 if((m=text.match(/^Look at the top (three|four|five|six|seven|\d+) cards of your library\. Put (one|two|\d+) of them into your hand and the rest on the bottom of your library in any order\.$/i)))return [{op:'lookSelect',amount:count(m[1]),take:count(m[2])}];
 if((m=text.match(/^Look at the top (three|four|five|six|seven|\d+) cards of your library\. You may reveal a noncreature, nonland card from among them and put it into your hand\. Put the rest on the bottom of your library in a random order\.$/i)))return [{op:'lookSelect',amount:count(m[1]),take:1,optional:true,filter:'noncreature-nonland',reveal:true,remainder:'random-bottom'}];
 if(/^Look at the top card of your library\. You may reveal that card and put it into your hand\. If you do, you lose life equal to its mana value\.$/i.test(text))return [{op:'lookSelect',amount:1,take:1,optional:true,reveal:true,remainder:'top',loseLife:true}];
 if(/^Reveal the top five cards of your library\. An opponent separates those cards into two piles\. Put one pile into your hand and the other into your graveyard\.$/i.test(text))return [{op:'factReveal',amount:5}];
 return null;
}
function pending(g,context,step,remaining,owner=context.owner,revealed){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining,...(revealed?{revealed}:{})};}
// 0 = another instruction family; 1 = completed synchronously; 2 = paused.
export function runLibraryStep(g,context,step,remaining,run){
 const owner=step.owner??context.owner,player=g.players[owner];
 // Milling consumes only existing top cards; it is not a draw or a search.
 // Zone movement applies live graveyard replacements without opening priority.
 if(step.op==='mill'){
  const seats=step.scope==='target player'?(context.targets||[]).filter(t=>t.kind==='player').map(t=>t.owner):step.scope==='you'?[owner]:g.players.flatMap((p,i)=>p.eliminated||step.scope==='each opponent'&&i===owner?[]:[i]);
  for(const seat of new Set(seats))for(const card of g.players[seat].zones.library.slice(0,step.amount))transfer(g,card.instance,'graveyard',card.ownerSeat??seat);
  return 1;
 }
 if(step.op==='libraryPosition'){for(const target of context.targets||[]){const found=findCard(g,target.id);if(found?.zone!=='battlefield'||(found.card.battlefieldId||null)!==target.battlefieldId)continue;const recipient=found.card.ownerSeat??found.owner;placeInLibrary(g,target.id,recipient,Math.min(step.position,g.players[recipient].zones.library.length+1));}return 1;}
 if(step.op==='iteration'){const ids=player.zones.library.slice(0,3).map(c=>c.instance);if(ids.length)pending(g,context,{op:'iterationHand',ids,min:1,max:1},remaining);return ids.length?2:1;}
 if(step.op==='spouts'){const groups=new Map();for(const attack of g.combat?.attackers||[]){const found=findCard(g,attack.id);if(found?.zone==='battlefield'){const owner=found.card.ownerSeat??found.owner;groups.set(owner,[...(groups.get(owner)||[]),attack.id]);}}run(g,context,[...[...groups].sort(([a],[b])=>(a-g.active+g.players.length)%g.players.length-(b-g.active+g.players.length)%g.players.length).map(([owner,ids])=>({op:'spoutsTop',owner,ids,min:0,max:ids.length})),...remaining]);return 2;}
 if(step.op==='spoutsTop'){pending(g,context,step,remaining,owner);return 2;}
 if(step.op==='orderBottomLibrary'){pending(g,context,step,remaining,owner);return 2;}
 if(step.op==='shuffleLibrary'){shuffle(player.zones.library);return 1;}
 if(step.op==='windfall'){const players=g.players.flatMap((p,seat)=>p.eliminated?[]:[{p,seat,hand:[...p.zones.hand]}]),amount=Math.max(0,...players.map(p=>p.hand.length));for(const {seat,hand} of players)for(const c of hand)transfer(g,c.instance,'graveyard',c.ownerSeat??seat);run(g,context,[...players.map(({seat})=>({op:'draw',owner:seat,amount:String(amount)})),...remaining]);return 2;}
 if(step.op==='discardUnlessAttacked'){if(g.attackDeclarations?.turn!==g.turn+':'+g.active||!g.attackDeclarations.owners.includes(owner))run(g,context,[{op:'discard',max:1},...remaining]);else run(g,context,remaining);return 2;}
 if(step.op==='lookOrderTop'){const ids=player.zones.library.slice(0,step.amount).map(c=>c.instance);run(g,context,[...(ids.length?[{op:'orderTop',ids,min:ids.length,max:ids.length}]:[]),...remaining]);return 2;}
 if(step.op==='surveil'){const ids=player.zones.library.slice(0,step.amount).map(c=>c.instance);if(!ids.length)return 1;pending(g,context,{...step,ids,min:0,max:ids.length},remaining);return 2;}
 if(step.op==='lookSelect'){const ids=player.zones.library.slice(0,step.amount).map(c=>c.instance),take=Math.min(step.take,ids.length);if(!ids.length)return 1;pending(g,context,{...step,op:'selectLook',ids,min:step.optional?0:take,max:take},remaining);return 2;}
 if(step.op==='factReveal'){const ids=player.zones.library.slice(0,step.amount).map(c=>c.instance);if(!ids.length)return 1;pending(g,context,{op:'chooseOpponent',ids,min:1,max:1},remaining,owner,{owner,ids});return 2;}
 if(step.op==='viewHand'){pending(g,context,{...step,target:context.target.owner},remaining);return 2;}
 if(step.op==='putHandTop'){pending(g,context,step,remaining);return 2;}
 return 0;
}
export function libraryChoiceOptions(g,p){const {step,owner,context}=p;
 if(step.op==='viewHand'||step.op==='finishLook')return [];
 if(step.op==='chooseOpponent')return g.players.flatMap((player,seat)=>seat===context.owner||player.eliminated?[]:[{key:String(seat),label:player.name}]);
 if(step.op==='choosePile')return step.piles.map((ids,i)=>({key:String(i),label:'Pile '+(i+1)+': '+(ids.map(id=>findCard(g,id)?.card.name).join(', ')||'empty')}));
 const zone=step.op==='putHandTop'?'hand':'library',cards=step.op==='putHandTop'?g.players[owner].zones.hand:step.ids?.map(id=>findCard(g,id)?.card).filter(Boolean);
 if(!LIBRARY_CHOICES.includes(step.op))return null;
 return (cards||[]).filter(c=>step.filter!=='noncreature-nonland'||! /\b(?:Creature|Land)\b/.test(cardFace(c).type_line||'')).map(c=>({key:c.instance,label:c.name,zone}));
}
// "Put into your hand" is not drawing. Reveal only the chosen card, and keep
// it public until acknowledged so remote clients can actually see the reveal.
function finishLook(g,p,keys,run){
 const {step,owner,context,remaining}=p;
 for(const id of keys){const card=findCard(g,id)?.card;if(!card)continue;const loss=step.loseLife?manaValue(card):0;transfer(g,id,'hand',owner);g.players[owner].life-=loss;}
 const rest=step.ids.filter(id=>!keys.includes(id));
 if(step.remainder==='random-bottom'){const library=g.players[owner].zones.library,bottom=library.filter(c=>rest.includes(c.instance));shuffle(bottom);g.players[owner].zones.library=[...library.filter(c=>!rest.includes(c.instance)),...bottom];}
 else if(step.remainder!=='top'&&rest.length){pending(g,context,{op:'orderBottomLibrary',ids:rest,min:rest.length,max:rest.length},remaining);return;}
 run(g,context,remaining);
}
export function resolveLibraryChoice(g,p,keys,run){const {step,context,remaining,owner,revealed}=p;
 if(!LIBRARY_CHOICES.includes(step.op))return false;
 if(step.op==='iterationHand'){for(const id of keys)transfer(g,id,'hand',owner);const ids=step.ids.filter(id=>!keys.includes(id));if(ids.length){pending(g,context,{op:'iterationBottom',ids,min:1,max:1},remaining);return true;}}
 if(step.op==='iterationBottom'){const bottom=keys.map(id=>findCard(g,id).card),library=g.players[owner].zones.library;g.players[owner].zones.library=[...library.filter(c=>!keys.includes(c.instance)),...bottom];for(const id of step.ids.filter(id=>!keys.includes(id))){const found=findCard(g,id);if(found?.zone==='library'){transfer(g,id,'exile',owner);grantExilePlay(g,found.card,owner);}}}
 if(step.op==='spoutsTop'){const ids=step.ids.filter(id=>findCard(g,id)?.zone==='battlefield'),top=keys.filter(id=>ids.includes(id)),bottom=ids.filter(id=>!top.includes(id));for(const id of ids)transfer(g,id,'library',owner);run(g,context,[...(top.length?[{op:'orderTop',owner,ids:top,min:top.length,max:top.length}]:[]),...(bottom.length?[{op:'orderBottomLibrary',owner,ids:bottom,min:bottom.length,max:bottom.length}]:[]),...remaining]);return true;}
 if(step.op==='surveil'){for(const id of keys)transfer(g,id,'graveyard',owner);const top=step.ids.filter(id=>!keys.includes(id));run(g,context,[...(top.length>1?[{op:'orderTop',ids:top,min:top.length,max:top.length}]:[]),...remaining]);return true;}
 if(step.op==='putHandTop'){const chosen=keys.map(id=>findCard(g,id).card);for(const id of keys)transfer(g,id,'library',owner);const ids=new Set(keys),rest=g.players[owner].zones.library.filter(c=>!ids.has(c.instance));g.players[owner].zones.library=step.placement==='bottom'?[...rest,...chosen]:[...chosen,...rest];}
 if(step.op==='selectLook'){
  if(step.reveal&&keys.length)pending(g,context,{...step,op:'finishLook',selected:keys,min:0,max:0},remaining,owner,{owner,ids:keys});
  else finishLook(g,p,keys,run);return true;
 }
 if(step.op==='finishLook'){finishLook(g,p,step.selected,run);return true;}
 if(step.op==='orderBottomLibrary'){const bottom=keys.map(id=>findCard(g,id).card),ids=new Set(keys),library=g.players[owner].zones.library;g.players[owner].zones.library=[...library.filter(c=>!ids.has(c.instance)),...bottom];}
 if(step.op==='chooseOpponent'){pending(g,context,{op:'dividePiles',ids:step.ids,min:0,max:step.ids.length},remaining,Number(keys[0]),revealed);return true;}
 if(step.op==='dividePiles'){pending(g,context,{op:'choosePile',piles:[keys,step.ids.filter(id=>!keys.includes(id))],min:1,max:1},remaining,context.owner,revealed);return true;}
 if(step.op==='choosePile')for(const [i,ids] of step.piles.entries())for(const id of ids)transfer(g,id,i===Number(keys[0])?'hand':'graveyard',context.owner);
 run(g,context,remaining);return true;
}
