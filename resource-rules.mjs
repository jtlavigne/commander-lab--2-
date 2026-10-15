import {normalizeRules,activeRuleParagraphs} from './ability-effects.mjs';

// Each replacement is applied once to a draw event and its descendants. Each
// resulting card is drawn separately, so a draw-step exception can change
// between the first and second card produced by another replacement.
export function drawWithReplacements(g,owner,count,take,work){
 const stamp=g.turn+':'+g.active;
 if(g.drawHistory?.turn!==stamp)g.drawHistory={turn:stamp,counts:g.players.map(()=>0)};
 const history=g.drawHistory,step=stamp+':'+(g.drawStepSerial||0);
 if(history.step!==step){history.step=step;history.stepCounts=g.players.map(()=>0);}
 history.stepCounts??=g.players.map(()=>0);
 const effects=g.players[owner].zones.battlefield.flatMap(card=>card.faceDown?[]:activeRuleParagraphs(card).flatMap(({text,index})=>{
  const match=normalizeRules(text).match(/^If you would draw a card( except the first one you draw in each of your draw steps)?, draw two cards instead\.$/i);
  return match?[{id:card.instance+':'+index,exceptFirst:!!match[1]}]:[];
 }));
 let drawn=0;const queue=work?structuredClone(work):[{count,applied:[]}];
 while(queue.length){
  const task=queue[0];if(task.count<=0){queue.shift();continue;}task.count--;
  if(!g.players[owner].zones.library.length){take();break;}
  const replacement=effects.find(e=>!task.applied.includes(e.id)&&(!e.exceptFirst||g.step!==2||g.active!==owner||history.stepCounts[owner]>0));
  if(replacement){queue.unshift({count:2,applied:[...task.applied,replacement.id]});continue;}
  const result=take();if(!result?.card)continue;
  drawn++;history.counts[owner]++;if(g.step===2&&g.active===owner)history.stepCounts[owner]++;
  if(result.pause)return {drawn,work:queue.filter(t=>t.count>0),paused:result.card};
 }
 return {drawn,work:[]};
}
export function gainLife(g,owner,amount){
 if(amount<=0){g.players[owner].life+=amount;return amount;}
 for(const card of g.players[owner].zones.battlefield)if(!card.faceDown)for(const {text} of activeRuleParagraphs(card))if(/^If you would gain life, you gain twice that much life instead\.$/i.test(normalizeRules(text)))amount*=2;
 g.players[owner].life+=amount;return amount;
}
