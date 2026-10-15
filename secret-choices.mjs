import {transfer} from './engine.mjs';
import {dealDamagePackets} from './combat.mjs';
import {queueCombatTriggers} from './combat-effects.mjs';
import {recordPlay} from './play-events.mjs';

export const SECRET_OPERATIONS=['secretNumbers','secretNumber','wheelNumbers','wheelDraw'];
export function compileSecretChoiceEffect(text){
 if(/^Each player secretly chooses a number 0 or greater, then all players reveal those numbers simultaneously and determine the highest and lowest numbers revealed this way\. [^.]+ deals damage equal to the highest number to each player who chose that number\. Each player who didn't choose the lowest number discards their hand, then draws seven cards\.$/i.test(text))return [{op:'secretNumbers'}];
 if(/^Each player discards their hand, then draws seven cards\.$/i.test(text))return [{op:'wheelDraw',amount:7}];
 return null;
}
export function runSecretStep(g,context,step,remaining,run){
 const participants=g.players.flatMap((p,owner)=>p.eliminated?[]:[owner]).sort((a,b)=>(a-g.active+g.players.length)%g.players.length-(b-g.active+g.players.length)%g.players.length);
 if(step.op==='secretNumbers'){g.pendingEffect={kind:'oracle-choice',owner:participants[0],name:context.name,context,step:{op:'secretNumber',participants,index:0,values:{},min:1,max:1},remaining};return 2;}
 if(step.op==='wheelDraw'||step.op==='wheelNumbers'){
  let wheeling=participants;
  if(step.op==='wheelNumbers'){
   const values=Object.values(step.values),low=Math.min(...values),high=Math.max(...values);wheeling=participants.filter(owner=>step.values[owner]!==low);
   recordPlay(g,{kind:'ability',owner:context.owner,source:context.source,text:'Revealed choices: '+participants.map(owner=>g.players[owner].name+' chose '+step.values[owner]).join('; ')+'.'});
   const events=dealDamagePackets(g,participants.filter(owner=>step.values[owner]===high).map(owner=>({source:{owner:context.owner,card:context.source},target:{kind:'player',owner},amount:high})));queueCombatTriggers(g,events);
  }
  for(const owner of wheeling)for(const c of [...g.players[owner].zones.hand])transfer(g,c.instance,'graveyard',owner);
  run(g,context,[...wheeling.map(owner=>({op:'draw',owner,amount:String(step.amount||7)})),...remaining]);return 2;
 }
 return 0;
}
export function resolveSecretNumber(g,pending,keys,run){
 if(pending.step.op!=='secretNumber')return false;
 if(keys.length!==1||typeof keys[0]!=='string'||!/^\d+$/.test(keys[0])||!Number.isSafeInteger(Number(keys[0]))||Number(keys[0])>999999)throw Error('Choose a whole number from 0 to 999999.');
 const {step,context,remaining,owner}=pending,values={...step.values,[owner]:Number(keys[0])},index=step.index+1;
 if(index<step.participants.length)g.pendingEffect={...pending,owner:step.participants[index],step:{...step,index,values}};
 else{delete g.pendingEffect;run(g,context,[{op:'wheelNumbers',values},...remaining]);}
 return true;
}
