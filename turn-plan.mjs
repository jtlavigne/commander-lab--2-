// CR 500.8: insert extra phases after their anchor; the newest insertion at
// the same anchor happens first. Ordinary sessions need no expanded plan.
const stamp=g=>g.turn+':'+g.active;
const phase=step=>step>=4&&step<=8?'combat':step===3||step===9?'main':'step';
function ensurePlan(g){
 if(!g.turnPlan||g.turnPlan.turn!==stamp(g)||g.turnPlan.steps[g.turnPlan.index]?.step!==g.step)g.turnPlan={turn:stamp(g),index:g.step,steps:Array.from({length:12},(_,step)=>({step,phase:(step>=4&&step<=8?'base-combat':'base-'+step),kind:phase(step)}))};
 return g.turnPlan;
}
export function nextTurnStep(g){
 const plan=g.turnPlan;if(!plan||plan.turn!==stamp(g))return {step:(g.step+1)%12};
 const index=plan.index+1;return {step:plan.steps[index]?.step??0,index:index<plan.steps.length?index:undefined};
}
export function commitTurnStep(g,next){if(!g.turnPlan)return;if(next.index===undefined)delete g.turnPlan;else g.turnPlan.index=next.index;}
export function selectTurnStep(g,step){
 if(!g.turnPlan)return;const plan=ensurePlan(g),index=plan.steps.findIndex((entry,i)=>i>=plan.index&&entry.step===step);
 if(index>=0)plan.index=index;else delete g.turnPlan;
}
export function addCombatPhase(g,{mainAfter=false,mainOnly=false,source='Effect',beginEffect,afterSecondMain=false}={}){
 if(mainOnly&&![3,9].includes(g.step))return false;
 const plan=ensurePlan(g);if(plan.steps.length>1990)throw Error('Too many scheduled phases; finish or reset this turn.');
 const anchor=plan.steps[plan.index].phase;let after=plan.index;while(plan.steps[after+1]?.phase===anchor)after++;
 if(afterSecondMain){const ordinary=plan.steps.findLastIndex(entry=>entry.step===9&&!entry.extra);if(ordinary>=plan.index)after=ordinary;}
 const id=crypto.randomUUID(),steps=[4,5,6,7,8].map(step=>({step,phase:id,kind:'combat',extra:true,source}));
 if(beginEffect)steps[0].beginEffects=[structuredClone(beginEffect)];
 if(mainAfter)steps.push({step:9,phase:id+'-main',kind:'main',extra:true,source});
 plan.steps.splice(after+1,0,...steps);return true;
}
export function validateTurnPlan(g,fail){
 const plan=g.turnPlan;if(plan===undefined)return;
 if(!plan||plan.turn!==stamp(g)||!Array.isArray(plan.steps)||plan.steps.length<12||plan.steps.length>2000||!Number.isInteger(plan.index)||plan.index<0||plan.index>=plan.steps.length||plan.steps[plan.index]?.step!==g.step)fail();
 for(const entry of plan.steps)if(!entry||!Number.isInteger(entry.step)||entry.step<0||entry.step>11||typeof entry.phase!=='string'||!['main','combat','step'].includes(entry.kind)||entry.kind!==phase(entry.step)||entry.source!==undefined&&typeof entry.source!=='string')fail();
 for(const entry of plan.steps)if(entry.beginEffects!==undefined&&(!Array.isArray(entry.beginEffects)||entry.beginEffects.length>20||entry.beginEffects.some(effect=>!effect||!Number.isInteger(effect.owner)||effect.owner<0||effect.owner>=g.players.length||typeof effect.text!=='string'||!effect.source||typeof effect.source.instance!=='string'||typeof effect.source.name!=='string')))fail();
}
