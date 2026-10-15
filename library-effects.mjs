import {transfer,shuffle,findCard} from './engine.mjs';
import {grantExilePlay} from './permission-effects.mjs';

const count=text=>({a:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7}[text?.toLowerCase()]??Number(text));
export const LIBRARY_OPERATIONS=['iteration','iterationHand','iterationBottom','spouts','spoutsTop','surveil','putHandTop','lookOrderTop','shuffleLibrary','windfall','discardUnlessAttacked','lookSelect','selectLook','orderBottomLibrary','viewHand','factReveal','chooseOpponent','dividePiles','choosePile'];
export const LIBRARY_CHOICES=['iterationHand','iterationBottom','spoutsTop','surveil','putHandTop','selectLook','orderBottomLibrary','viewHand','chooseOpponent','dividePiles','choosePile'];
export function compileLibraryEffect(text){let m;
 if(/^Look at the top three cards of your library\. Put one of them into your hand, put one of them on the bottom of your library, and exile one of them\. You may play the exiled card this turn\.$/i.test(text))return [{op:'iteration'}];
 if(/^For each attacking creature, its owner puts it on their choice of the top or bottom of their library\.$/i.test(text))return [{op:'spouts'}];
 if((m=text.match(/^Surveil (\d+)\.$/i)))return [{op:'surveil',amount:Number(m[1])}];
 if(/^Draw three cards, then put two cards from your hand on top of your library in any order\.$/i.test(text))return [{op:'draw',amount:'three'},{op:'putHandTop',min:2,max:2}];
 if((m=text.match(/^Look at the top (three|\d+) cards of your library, then put them back in any order\. You may shuffle\.\s*Draw a card\.$/i)))return [{op:'lookOrderTop',amount:count(m[1])},{op:'optional',label:'Shuffle your library',then:[{op:'shuffleLibrary'}]},{op:'draw',amount:'a'}];
 if((m=text.match(/^Scry (\d+), then draw a card\.$/i)))return [{op:'scry',amount:m[1]},{op:'draw',amount:'a'}];
 if(/^Look at target player's hand\.$/i.test(text))return [{op:'viewHand',min:0,max:0}];
 if((m=text.match(/^Draw (a|one|two|three|X|\d+) cards?, then discard (a|one|two|three|\d+) cards?\.$/i)))return [{op:'draw',amount:m[1]},{op:'discard',max:count(m[2])}];
 if(/^Then discard a card unless you attacked this turn\.$/i.test(text))return [{op:'discardUnlessAttacked'}];
 if(/^Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way\.$/i.test(text))return [{op:'windfall'}];
 if((m=text.match(/^Look at the top (seven|\d+) cards of your library\. Put (two|\d+) of them into your hand and the rest on the bottom of your library in any order\.$/i)))return [{op:'lookSelect',amount:count(m[1]),take:count(m[2])}];
 if(/^Reveal the top five cards of your library\. An opponent separates those cards into two piles\. Put one pile into your hand and the other into your graveyard\.$/i.test(text))return [{op:'factReveal',amount:5}];
 return null;
}
function pending(g,context,step,remaining,owner=context.owner,revealed){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining,...(revealed?{revealed}:{})};}
// 0 = another instruction family; 1 = completed synchronously; 2 = paused.
export function runLibraryStep(g,context,step,remaining,run){
 const owner=step.owner??context.owner,player=g.players[owner];
 if(step.op==='iteration'){const ids=player.zones.library.slice(0,3).map(c=>c.instance);if(ids.length)pending(g,context,{op:'iterationHand',ids,min:1,max:1},remaining);return ids.length?2:1;}
 if(step.op==='spouts'){const groups=new Map();for(const attack of g.combat?.attackers||[]){const found=findCard(g,attack.id);if(found?.zone==='battlefield'){const owner=found.card.ownerSeat??found.owner;groups.set(owner,[...(groups.get(owner)||[]),attack.id]);}}run(g,context,[...[...groups].sort(([a],[b])=>(a-g.active+g.players.length)%g.players.length-(b-g.active+g.players.length)%g.players.length).map(([owner,ids])=>({op:'spoutsTop',owner,ids,min:0,max:ids.length})),...remaining]);return 2;}
 if(step.op==='spoutsTop'){pending(g,context,step,remaining,owner);return 2;}
 if(step.op==='orderBottomLibrary'){pending(g,context,step,remaining,owner);return 2;}
 if(step.op==='shuffleLibrary'){shuffle(player.zones.library);return 1;}
 if(step.op==='windfall'){const players=g.players.flatMap((p,seat)=>p.eliminated?[]:[{p,seat,hand:[...p.zones.hand]}]),amount=Math.max(0,...players.map(p=>p.hand.length));for(const {seat,hand} of players)for(const c of hand)transfer(g,c.instance,'graveyard',c.ownerSeat??seat);run(g,context,[...players.map(({seat})=>({op:'draw',owner:seat,amount:String(amount)})),...remaining]);return 2;}
 if(step.op==='discardUnlessAttacked'){if(g.attackDeclarations?.turn!==g.turn+':'+g.active||!g.attackDeclarations.owners.includes(owner))run(g,context,[{op:'discard',max:1},...remaining]);else run(g,context,remaining);return 2;}
 if(step.op==='lookOrderTop'){const ids=player.zones.library.slice(0,step.amount).map(c=>c.instance);run(g,context,[...(ids.length?[{op:'orderTop',ids,min:ids.length,max:ids.length}]:[]),...remaining]);return 2;}
 if(step.op==='surveil'){const ids=player.zones.library.slice(0,step.amount).map(c=>c.instance);if(!ids.length)return 1;pending(g,context,{...step,ids,min:0,max:ids.length},remaining);return 2;}
 if(step.op==='lookSelect'){const ids=player.zones.library.slice(0,step.amount).map(c=>c.instance),take=Math.min(step.take,ids.length);if(!ids.length)return 1;pending(g,context,{op:'selectLook',ids,min:take,max:take},remaining);return 2;}
 if(step.op==='factReveal'){const ids=player.zones.library.slice(0,step.amount).map(c=>c.instance);if(!ids.length)return 1;pending(g,context,{op:'chooseOpponent',ids,min:1,max:1},remaining,owner,{owner,ids});return 2;}
 if(step.op==='viewHand'){pending(g,context,{...step,target:context.target.owner},remaining);return 2;}
 if(step.op==='putHandTop'){pending(g,context,step,remaining);return 2;}
 return 0;
}
export function libraryChoiceOptions(g,p){const {step,owner,context}=p;
 if(step.op==='viewHand')return [];
 if(step.op==='chooseOpponent')return g.players.flatMap((player,seat)=>seat===context.owner||player.eliminated?[]:[{key:String(seat),label:player.name}]);
 if(step.op==='choosePile')return step.piles.map((ids,i)=>({key:String(i),label:'Pile '+(i+1)+': '+(ids.map(id=>findCard(g,id)?.card.name).join(', ')||'empty')}));
 const zone=step.op==='putHandTop'?'hand':'library',cards=step.op==='putHandTop'?g.players[owner].zones.hand:step.ids?.map(id=>findCard(g,id)?.card).filter(Boolean);
 if(!LIBRARY_CHOICES.includes(step.op))return null;
 return (cards||[]).map(c=>({key:c.instance,label:c.name,zone}));
}
export function resolveLibraryChoice(g,p,keys,run){const {step,context,remaining,owner,revealed}=p;
 if(!LIBRARY_CHOICES.includes(step.op))return false;
 if(step.op==='iterationHand'){for(const id of keys)transfer(g,id,'hand',owner);const ids=step.ids.filter(id=>!keys.includes(id));if(ids.length){pending(g,context,{op:'iterationBottom',ids,min:1,max:1},remaining);return true;}}
 if(step.op==='iterationBottom'){const bottom=keys.map(id=>findCard(g,id).card),library=g.players[owner].zones.library;g.players[owner].zones.library=[...library.filter(c=>!keys.includes(c.instance)),...bottom];for(const id of step.ids.filter(id=>!keys.includes(id))){const found=findCard(g,id);if(found?.zone==='library'){transfer(g,id,'exile',owner);grantExilePlay(g,found.card,owner);}}}
 if(step.op==='spoutsTop'){const ids=step.ids.filter(id=>findCard(g,id)?.zone==='battlefield'),top=keys.filter(id=>ids.includes(id)),bottom=ids.filter(id=>!top.includes(id));for(const id of ids)transfer(g,id,'library',owner);run(g,context,[...(top.length?[{op:'orderTop',owner,ids:top,min:top.length,max:top.length}]:[]),...(bottom.length?[{op:'orderBottomLibrary',owner,ids:bottom,min:bottom.length,max:bottom.length}]:[]),...remaining]);return true;}
 if(step.op==='surveil'){for(const id of keys)transfer(g,id,'graveyard',owner);const top=step.ids.filter(id=>!keys.includes(id));run(g,context,[...(top.length>1?[{op:'orderTop',ids:top,min:top.length,max:top.length}]:[]),...remaining]);return true;}
 if(step.op==='putHandTop'){const top=keys.map(id=>findCard(g,id).card);for(const id of keys)transfer(g,id,'library',owner);const ids=new Set(keys);g.players[owner].zones.library=[...top,...g.players[owner].zones.library.filter(c=>!ids.has(c.instance))];}
 if(step.op==='selectLook'){for(const id of keys)transfer(g,id,'hand',owner);const rest=step.ids.filter(id=>!keys.includes(id));if(rest.length){pending(g,context,{op:'orderBottomLibrary',ids:rest,min:rest.length,max:rest.length},remaining);return true;}}
 if(step.op==='orderBottomLibrary'){const bottom=keys.map(id=>findCard(g,id).card),ids=new Set(keys),library=g.players[owner].zones.library;g.players[owner].zones.library=[...library.filter(c=>!ids.has(c.instance)),...bottom];}
 if(step.op==='chooseOpponent'){pending(g,context,{op:'dividePiles',ids:step.ids,min:0,max:step.ids.length},remaining,Number(keys[0]),revealed);return true;}
 if(step.op==='dividePiles'){pending(g,context,{op:'choosePile',piles:[keys,step.ids.filter(id=>!keys.includes(id))],min:1,max:1},remaining,context.owner,revealed);return true;}
 if(step.op==='choosePile')for(const [i,ids] of step.piles.entries())for(const id of ids)transfer(g,id,i===Number(keys[0])?'hand':'graveyard',context.owner);
 run(g,context,remaining);return true;
}
