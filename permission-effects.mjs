import {findCard,transfer} from './engine.mjs';
import {cardFace,manaValue} from './card-state.mjs';
import {recordPlay} from './play-events.mjs';

export function grantExilePlay(g,card,owner,{free=false,spellsOnly=false}={}){card.playPermission={owner,turn:g.turn+':'+g.active,zoneChangeId:card.zoneChangeId,free,spellsOnly};}
export function offeredCast(pending,card,zone){return pending?.kind==='oracle-choice'&&['castOffered','castExiled'].includes(pending.step.op)&&pending.step.id===card.instance&&(pending.step.zoneChangeId||null)===(card.zoneChangeId||null)&&(zone===undefined||zone===(pending.step.zone||'exile'));}
export function offeredCardAllowed(card,step){
 const faces=['split','modal_dfc'].includes(card.layout)?card.card_faces.map((_,face)=>({...card,face})):[card];
 return faces.some(c=>!/\bLand\b/.test(cardFace(c).type_line||'')&&(!step.scope||step.scope==='instant or sorcery'&&/\b(?:Instant|Sorcery)\b/.test(cardFace(c).type_line||''))&&(step.manaValue===undefined||manaValue(c,{onStack:true})<=step.manaValue));
}
export const PERMISSION_OPERATIONS=['castGraveTargets','copyOfferedSpells','orderCopies','chooseGraveCast','exilePlay','copyGraveSpells','epicExile','exileSelfSpell','ceaseCopies','graveExiled','handMana','freeHand','revealCastTop','revealedToHand','miracleCast','temporaryGraveyard'];
export function compilePermissionEffect(text){let m;
 if(/^You may cast up to one target instant card and\/or up to one target sorcery card from your graveyard each with mana value X or less without paying their mana costs\. If a spell cast this way would be put into your graveyard, exile it instead\. If X is 10 or more, copy each of those spells twice\. You may choose new targets for the copies\.$/i.test(text))return [{op:'castGraveTargets'},{op:'copyOfferedSpells',threshold:10,amount:2}];
 if(/^Surveil 2, then choose an instant or sorcery card in your graveyard\. You may cast it this turn\. If that spell would be put into your graveyard, exile it instead\.$/i.test(text))return [{op:'surveil',amount:2},{op:'chooseGraveCast',min:1,max:1}];
 if(/^you may play lands and cast spells from your graveyard until end of turn\.$/i.test(text))return [{op:'temporaryGraveyard',kind:'play'}];
 if(/^If a card would be put into your graveyard from anywhere this turn, exile that card instead\.$/i.test(text))return [{op:'temporaryGraveyard',kind:'exile'}];
 if(text==='You may cast this card for its miracle cost.')return [{op:'miracleCast'}];
 if(/^reveal the top card of your library\. You may cast it without paying its mana cost if it's a spell with lesser mana value\. If you don't cast it, put it into your hand\.$/i.test(text))return [{op:'revealCastTop'}];
 if((m=text.match(/^Exile the top (three|seven|\d+) cards of your library\. (?:You may play them this turn|Until end of turn, you may cast spells from among them)\.$/i)))return [{op:'exilePlay',amount:{three:3,seven:7}[m[1].toLowerCase()]??Number(m[1]),spellsOnly:/cast spells/i.test(text)}];
 if(/^Shuffle your library\. Then exile the top card of your library\. Until end of turn, you may play that card without paying its mana cost\.$/i.test(text))return [{op:'shuffleLibrary'},{op:'exilePlay',amount:1,free:true}];
 if(/^Exile (target|each) card that's an instant or sorcery from your graveyard\. For each card exiled this way, copy it, and you may cast the copy without paying its mana cost\. Exile [^.]+\.$/i.test(text))return [{op:'copyGraveSpells',all:/^Exile each/i.test(text)},{op:'exileSelfSpell'}];
 if(/^Exile the top X cards of your library\. You may cast instant and sorcery spells with mana value X or less from among them without paying their mana costs\. Then put all cards exiled this way that weren't cast into your graveyard\.$/i.test(text))return [{op:'epicExile'}];
 if(/^If this spell was cast from your hand, add ten mana of any one color\.$/i.test(text))return [{op:'handMana',amount:10}];
 if(/^You may cast a spell with mana value X or less from your hand without paying its mana cost\.$/i.test(text))return [{op:'freeHand'}];
 return null;
}
export function runPermissionStep(g,context,step,remaining,run){const owner=context.owner;
 if(step.op==='castGraveTargets'){const available=(context.targets||[]).flatMap(t=>{const found=findCard(g,t.id);return found?.zone==='graveyard'&&found.owner===owner&&(found.card.zoneChangeId||null)===t.zoneChangeId?[{id:t.id,zoneChangeId:t.zoneChangeId}]:[];}),cards=[...new Map(available.map(ref=>[ref.id,ref])).values()];context.offeredSpells=[];run(g,context,[{op:'chooseExiled',zone:'graveyard',cards,scope:'instant or sorcery',graveyardExile:true,trackForCopies:true,min:0,max:1},...remaining]);return 2;}
 if(step.op==='copyOfferedSpells'){context.copyOrder=[];run(g,context,[...(context.x>=step.threshold?(context.offeredSpells||[]).map(target=>({op:'copySpell',target,amount:step.amount,trackOrder:true})):[]),{op:'orderCopies'},...remaining]);return 2;}
 if(step.op==='orderCopies'){const copies=copyEntries(g,context),different=new Set(copies.map(e=>JSON.stringify([e.card.name,e.card.face,e.spellText,e.castX,e.mode,e.targets])));if(different.size>1)g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step:{op:'orderCopies',min:copies.length,max:copies.length},remaining};else run(g,context,remaining);return 2;}
 if(step.op==='chooseGraveCast'){if(graveCastChoices(g,owner).length)g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining};else run(g,context,remaining);return 2;}
 if(step.op==='temporaryGraveyard'){(g.temporaryGraveyardRules??=[]).push({owner,turn:g.turn+':'+g.active,source:context.source,kind:step.kind});return 1;}
 if(step.op==='miracleCast'){const event=context.event,found=findCard(g,event?.card?.instance);if(found?.zone==='hand'&&found.owner===owner&&found.card.zoneChangeId===event.card.zoneChangeId)g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step:{op:'castOffered',zone:'hand',id:found.card.instance,zoneChangeId:found.card.zoneChangeId,cost:event.cost,min:0,max:0},remaining};else run(g,context,remaining);return 2;}
 if(step.op==='revealCastTop'){
  const card=g.players[owner].zones.library[0];if(!card)return 1;
  recordPlay(g,{kind:'reveal',owner,source:card,text:context.name+' reveals '+card.name+'.'});
  const ref={id:card.instance,zoneChangeId:card.zoneChangeId||null},limit=manaValue(context.event?.card||{},{x:context.event?.x||0,onStack:true})-1;
  const next=[{op:'revealedToHand',...ref},...remaining];
  if(limit>=0&&offeredCardAllowed(card,{manaValue:limit}))g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step:{op:'castOffered',zone:'library',...ref,manaValue:limit,min:0,max:0},remaining:next,revealed:{owner,ids:[card.instance]}};
  else run(g,context,next);
  return 2;
 }
 if(step.op==='revealedToHand'){const found=findCard(g,step.id);if(found?.zone==='library'&&(found.card.zoneChangeId||null)===step.zoneChangeId)transfer(g,step.id,'hand',owner);return 1;}
 if(step.op==='exilePlay'){for(const card of [...g.players[owner].zones.library.slice(0,step.amount)]){transfer(g,card.instance,'exile',owner);grantExilePlay(g,card,owner,step);}return 1;}
 if(step.op==='exileSelfSpell'){const found=findCard(g,context.spellId);if(found?.zone==='stack')transfer(g,found.card.instance,'exile',found.card.ownerSeat??owner);return 1;}
 if(step.op==='freeHand'){run(g,context,[{op:'freeCast',max:1,manaValue:context.x},...remaining]);return 2;}
 if(step.op==='handMana'){if(context.castFrom==='hand')run(g,context,[{op:'chooseManaColor',amount:step.amount,min:1,max:1},...remaining]);else run(g,context,remaining);return 2;}
 if(step.op==='ceaseCopies'){for(const ref of step.cards){const found=findCard(g,ref.id);if(found&&found.zone!=='stack'&&found.card.cardCopy)g.players[found.owner].zones[found.zone]=g.players[found.owner].zones[found.zone].filter(c=>c.instance!==ref.id);}return 1;}
 if(step.op==='graveExiled'){for(const ref of step.cards){const found=findCard(g,ref.id);if(found?.zone==='exile'&&found.card.zoneChangeId===ref.zoneChangeId)transfer(g,ref.id,'graveyard',found.card.ownerSeat??found.owner);}return 1;}
 if(step.op==='copyGraveSpells'){
  const originals=step.all?g.players[owner].zones.graveyard.filter(c=>/\b(?:Instant|Sorcery)\b/.test(cardFace(c).type_line||'')):(context.targets||[]).map(t=>findCard(g,t.id)).filter(f=>f?.zone==='graveyard').map(f=>f.card),cards=[];
  for(const original of [...originals]){transfer(g,original.instance,'exile',original.ownerSeat??owner);const card={...structuredClone(original),instance:crypto.randomUUID(),zoneChangeId:crypto.randomUUID(),ownerSeat:owner,cardCopy:true,spellCopy:true,counters:{},face:0};for(const key of ['commander','commandSlot','commandCasts','playPermission','flashbackGrant','lastBattlefield','castKicks'])delete card[key];g.players[owner].zones.exile.push(card);cards.push({id:card.instance,zoneChangeId:card.zoneChangeId});}
  run(g,context,[{op:'chooseExiled',cards,min:0,max:1},{op:'ceaseCopies',cards},...remaining]);return 2;
 }
 if(step.op==='epicExile'){
  const cards=[];for(const card of [...g.players[owner].zones.library.slice(0,context.x)]){transfer(g,card.instance,'exile',owner);cards.push({id:card.instance,zoneChangeId:card.zoneChangeId});}
  run(g,context,[{op:'chooseExiled',cards,scope:'instant or sorcery',manaValue:context.x,min:0,max:1},{op:'graveExiled',cards},...remaining]);return 2;
 }
 return 0;
}
function graveCastChoices(g,owner){return g.players[owner].zones.graveyard.filter(c=>/\b(?:Instant|Sorcery)\b/.test(cardFace(c).type_line||''));}
function copyEntries(g,context){return g.stack.filter(e=>e.card&&(context.copyOrder||[]).some(ref=>ref.id===e.card.instance&&ref.zoneChangeId===e.card.zoneChangeId));}
export function permissionChoiceOptions(g,pending){
 if(pending.step.op==='orderCopies')return copyEntries(g,pending.context).map(e=>({key:e.card.instance,label:e.card.name+(e.targets?.length?' - '+e.targets.map(t=>t.label).join(', '):'')}));
 return pending.step.op==='chooseGraveCast'?graveCastChoices(g,pending.owner).map(c=>({key:c.instance,label:c.name,zone:'graveyard'})):null;
}
export function resolvePermissionChoice(g,pending,keys,run){
 if(pending.step.op==='orderCopies'){const copies=new Map(copyEntries(g,pending.context).map(e=>[e.card.instance,e])),ordered=keys.toReversed().map(id=>copies.get(id));let i=0;g.stack=g.stack.map(e=>copies.has(e.card?.instance)?ordered[i++]:e);run(g,pending.context,pending.remaining);return true;}
 if(pending.step.op!=='chooseGraveCast')return false;
 const found=findCard(g,keys[0]);if(found?.zone==='graveyard'&&found.owner===pending.owner)found.card.graveCastGrant={owner:pending.owner,turn:g.turn+':'+g.active,zoneChangeId:found.card.zoneChangeId||null};
 run(g,pending.context,pending.remaining);return true;
}
