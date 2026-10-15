import {activeRuleParagraphs,normalizeRules} from './ability-effects.mjs';
import {effectTargetSpec,effectTargetOptions} from './effect-targets.mjs';

// Additional triggers are created at the event, not copied later from the stack.
// Each applicable provider contributes independently; removing it afterward
// doesn't remove an already-created ability.
export function attackTriggerCount(observers,owner){
 let count=1;
 for(const source of observers)if(source.owner===owner&&!source.card.faceDown)for(const {text} of activeRuleParagraphs(source.card)){
  const match=normalizeRules(text).match(/^If a creature attacking causes a triggered ability of a permanent you control to trigger, that ability triggers an additional (time|two times|three times)\.$/i);
  if(match)count+=({'time':1,'two times':2,'three times':3}[match[1].toLowerCase()]);
 }
 return count;
}

export function claimTriggerUse(g,source,key){
 const card=g.players.flatMap(p=>p.zones.battlefield).find(c=>c.instance===source.instance&&(c.battlefieldId||null)===(source.battlefieldId||null));
 if(!card)return false;
 const turn=g.turn+':'+g.active;
 if(card.triggerUses?.turn!==turn)card.triggerUses={turn,ids:[]};
 if(card.triggerUses.ids.includes(key))return false;
 card.triggerUses.ids.push(key);return true;
}

export function triggeredParagraphs(card){
 const result=[];
 for(const paragraph of activeRuleParagraphs(card))if(/^• /.test(paragraph.text)&&result.length&&/—/.test(result.at(-1).text))result.at(-1).text+='\n'+paragraph.text;else result.push({...paragraph});
 return result;
}

export function enqueueTriggers(g,entries){
 entries=entries.filter(entry=>{const spec=effectTargetSpec(entry.text);return !spec||spec.optional||effectTargetOptions(g,entry).length;});
 entries.sort((a,b)=>(a.owner-g.active+g.players.length)%g.players.length-(b.owner-g.active+g.players.length)%g.players.length);
 const batch=crypto.randomUUID();for(const entry of entries)if(entries.filter(e=>e.owner===entry.owner).length>1){entry.orderBatch=batch;entry.orderOpen=true;}
 g.stack.push(...entries);if(entries.length)g.priority={seat:g.active,passes:0};return entries;
}
export function stageTriggers(g,entries){if(g.resolutionInProgress)(g.deferredTriggers??=[]).push(...entries);else enqueueTriggers(g,entries);return entries;}
export function finishResolutionTriggers(g){
 if(g.pendingEffect)return;
 delete g.resolutionInProgress;const entries=g.deferredTriggers||[];delete g.deferredTriggers;
 if(!g.result)enqueueTriggers(g,entries.filter(e=>!g.players[e.owner].eliminated));
}
