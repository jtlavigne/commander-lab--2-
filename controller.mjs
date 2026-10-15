// Gamepad interpretation is independent of DOM, Electron and gameplay state.
const button=index=>({kind:'button',index});
const axis=(index,direction)=>({kind:'axis',index,direction});
export const CONTROLLER_ACTIONS=[
 {id:'confirm',label:'Activate / confirm',group:'Interface',binding:button(0)},
 {id:'cancel',label:'Cancel / close',group:'Interface',binding:button(1)},
 {id:'focusPrevious',label:'Previous control',group:'Interface',repeat:true,binding:button(12)},
 {id:'focusNext',label:'Next control',group:'Interface',repeat:true,binding:button(13)},
 {id:'adjustDown',label:'Decrease value / previous option',group:'Interface',repeat:true,binding:button(14)},
 {id:'adjustUp',label:'Increase value / next option',group:'Interface',repeat:true,binding:button(15)},
 {id:'settings',label:'Controller settings',group:'Interface',binding:button(8)},
 {id:'pointerLeft',label:'Pointer left',group:'Pointer',continuous:true,binding:axis(0,-1)},
 {id:'pointerRight',label:'Pointer right',group:'Pointer',continuous:true,binding:axis(0,1)},
 {id:'pointerUp',label:'Pointer up',group:'Pointer',continuous:true,binding:axis(1,-1)},
 {id:'pointerDown',label:'Pointer down',group:'Pointer',continuous:true,binding:axis(1,1)},
 {id:'panLeft',label:'Pan view left',group:'Camera',continuous:true,binding:axis(2,-1)},
 {id:'panRight',label:'Pan view right',group:'Camera',continuous:true,binding:axis(2,1)},
 {id:'panUp',label:'Pan view up',group:'Camera',continuous:true,binding:axis(3,-1)},
 {id:'panDown',label:'Pan view down',group:'Camera',continuous:true,binding:axis(3,1)},
 {id:'zoomOut',label:'Zoom out',group:'Camera',repeat:true,binding:button(6)},
 {id:'zoomIn',label:'Zoom in',group:'Camera',repeat:true,binding:button(7)},
 {id:'fitSeat',label:'Fit my playmat',group:'Camera',binding:button(11)},
 {id:'fitTable',label:'Fit whole table',group:'Camera'},
 {id:'previousSeat',label:'Previous seat',group:'Camera'},
 {id:'nextSeat',label:'Next seat',group:'Camera'},
 {id:'tap',label:'Activate / tap hovered card',group:'Cards',binding:button(2)},
 {id:'manualTap',label:'Tap / corrective untap',group:'Cards'},
 {id:'inspect',label:'Inspect card (hold)',group:'Cards',binding:button(3)},
 {id:'grab',label:'Pick up / place card',group:'Cards',binding:button(10)},
 {id:'previousCard',label:'Previous card in hand',group:'Cards',repeat:true,binding:button(4)},
 {id:'nextCard',label:'Next card in hand',group:'Cards',repeat:true,binding:button(5)},
 {id:'flip',label:'Turn hovered card face down / up',group:'Cards'},
 {id:'cardActions',label:'Hovered card actions',group:'Cards'},
 {id:'draw',label:'Draw a card',group:'Gameplay'},
 {id:'pass',label:'Pass priority',group:'Gameplay'},
 {id:'nextStep',label:'Next step',group:'Gameplay',binding:button(9)},
 {id:'endTurn',label:'End turn',group:'Gameplay'},
 {id:'undo',label:'Undo',group:'Gameplay'},
 {id:'toggleStack',label:'Show / hide stack',group:'Gameplay'}
];
const clamp=(n,min,max,fallback)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
export function validBinding(value){
 if(!value||!Number.isInteger(value.index)||value.index<0||value.index>127)return false;
 return value.kind==='button'||value.kind==='axis'&&[-1,1].includes(value.direction);
}
export const bindingKey=value=>validBinding(value)?value.kind+':'+value.index+(value.kind==='axis'?':'+value.direction:''):'';
export function bindingLabel(value){
 if(!validBinding(value))return 'Unassigned';
 if(value.kind==='axis')return 'Axis '+value.index+' '+(value.direction<0?'−':'+');
 const standard=['A / Cross','B / Circle','X / Square','Y / Triangle','LB / L1','RB / R1','LT / L2','RT / R2','View / Share','Menu / Options','Left stick press','Right stick press','D-pad up','D-pad down','D-pad left','D-pad right'];
 return 'Button '+value.index+(standard[value.index]?' · '+standard[value.index]:'');
}
export function defaultControllerSettings(){
 return {version:1,enabled:true,device:'',deadzone:.22,pointerSpeed:700,panSpeed:700,
  bindings:Object.fromEntries(CONTROLLER_ACTIONS.map(a=>[a.id,a.binding?{...a.binding}:null]))};
}
export function normalizeControllerSettings(value){
 const result=defaultControllerSettings();
 if(!value||value.version!==1)return result;
 result.enabled=typeof value.enabled==='boolean'?value.enabled:result.enabled;
 result.device=typeof value.device==='string'?value.device.slice(0,512):'';
 result.deadzone=clamp(value.deadzone,.08,.6,result.deadzone);
 result.pointerSpeed=clamp(value.pointerSpeed,150,1800,result.pointerSpeed);
 result.panSpeed=clamp(value.panSpeed,150,1800,result.panSpeed);
 const used=new Set();
 for(const action of CONTROLLER_ACTIONS){
  const candidate=Object.hasOwn(value.bindings||{},action.id)?value.bindings[action.id]:result.bindings[action.id];
  const key=bindingKey(candidate);
  result.bindings[action.id]=key&&!used.has(key)?{kind:candidate.kind,index:candidate.index,...(candidate.kind==='axis'?{direction:candidate.direction}:{})}:null;
  if(key)used.add(key);
 }
 return result;
}
export function assignControllerBinding(settings,id,binding){
 if(!CONTROLLER_ACTIONS.some(a=>a.id===id)||binding!==null&&!validBinding(binding))throw Error('Invalid controller binding.');
 const next=normalizeControllerSettings(settings),key=bindingKey(binding);let replaced=null;
 for(const action of CONTROLLER_ACTIONS)if(key&&action.id!==id&&bindingKey(next.bindings[action.id])===key){next.bindings[action.id]=null;replaced=action.label;}
 next.bindings[id]=binding?{...binding}:null;return {settings:next,replaced};
}
function strength(pad,binding,deadzone){
 if(!validBinding(binding))return 0;
 if(binding.kind==='button'){const value=pad.buttons?.[binding.index];return value?.pressed?1:clamp(value?.value,0,1,0);}
 const value=clamp(pad.axes?.[binding.index],-1,1,0)*binding.direction;
 return value>deadzone?(value-deadzone)/(1-deadzone):0;
}
export function createControllerInput(){
 let identity=null,ready=false,previous=new Map(),nextRepeat=new Map(),lastTime=0;
 function reset(){
  const releases=[...previous].filter(([,value])=>value>0).map(([action])=>({action,phase:'release',value:0}));
  ready=false;previous.clear();nextRepeat.clear();lastTime=0;return releases;
 }
 return {reset,sample(pad,settings,time,{active=true}={}){
  if(!active||!settings.enabled||!pad||pad.connected===false){identity=null;return reset();}
  const id=pad.index+':'+pad.id;
  if(identity!==id){const releases=reset();identity=id;return releases;}
  const values=new Map(CONTROLLER_ACTIONS.map(a=>[a.id,strength(pad,settings.bindings[a.id],settings.deadzone)]));
  if(!ready){if([...values.values()].every(v=>v<=.05))ready=true;lastTime=time;return [];}
  const dt=Math.max(0,Math.min(.05,(time-lastTime)/1000));lastTime=time;const events=[];
  for(const action of CONTROLLER_ACTIONS){
   const value=values.get(action.id),before=previous.get(action.id)||0;
   if(action.continuous){if(value>0)events.push({action:action.id,phase:'value',value,dt});previous.set(action.id,value);continue;}
   // Hysteresis prevents jitter around trigger / stick thresholds.
   const pressed=value>=(before ? .1 : .55),was=before>0;
   if(pressed&&!was){events.push({action:action.id,phase:'press',value});nextRepeat.set(action.id,time+400);}
   else if(!pressed&&was)events.push({action:action.id,phase:'release',value:0});
   else if(pressed&&action.repeat&&time>=(nextRepeat.get(action.id)||Infinity)){events.push({action:action.id,phase:'repeat',value});nextRepeat.set(action.id,time+130);}
   previous.set(action.id,pressed?1:0);
  }
  return events;
 }};
}
export function createBindingCapture(pad){
 const buttons=new Set((pad?.buttons||[]).flatMap((b,i)=>b.pressed||b.value>.5?[i]:[])),baseline=[...(pad?.axes||[])];
 return current=>{
  for(const [i,b] of (current?.buttons||[]).entries()){
   if(!b.pressed&&!(b.value>.5))buttons.delete(i);
   else if(!buttons.has(i))return {kind:'button',index:i};
  }
  for(const [index,value] of (current?.axes||[]).entries()){
   if(Math.abs(value)<.3)baseline[index]=value;
   if(Math.abs(value)>.65&&Math.abs(value-(baseline[index]||0))>.65)return {kind:'axis',index,direction:value<0?-1:1};
  }
  return null;
 };
}
