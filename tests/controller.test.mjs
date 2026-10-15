import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CONTROLLER_ACTIONS,defaultControllerSettings,normalizeControllerSettings,assignControllerBinding,bindingKey,createControllerInput,createBindingCapture} from '../controller.mjs';

const pad=()=>({id:'Test controller',index:0,connected:true,buttons:Array.from({length:18},()=>({pressed:false,value:0})),axes:[0,0,0,0]});
const down=(p,i,value=1)=>p.buttons[i]={pressed:value>=.5,value};
function ready(settings=defaultControllerSettings()){const input=createControllerInput(),p=pad();input.sample(p,settings,0);input.sample(p,settings,16);return {input,p,settings};}

test('controller defaults have unique bindings and corrupt settings recover safely',()=>{
 const defaults=defaultControllerSettings(),keys=Object.values(defaults.bindings).map(bindingKey).filter(Boolean);assert.equal(new Set(keys).size,keys.length);
 assert.deepEqual(normalizeControllerSettings({version:99}),defaults);
 const next=normalizeControllerSettings({version:1,enabled:false,deadzone:100,pointerSpeed:-5,bindings:{draw:{kind:'button',index:-1},tap:null}});
 assert.equal(next.enabled,false);assert.equal(next.deadzone,.6);assert.equal(next.pointerSpeed,150);assert.equal(next.bindings.draw,null);assert.equal(next.bindings.tap,null);
 assert.ok(CONTROLLER_ACTIONS.some(a=>a.id==='pass'));
});

test('rebinding an input clears its previous action while opposite stick directions remain distinct',()=>{
 const original=defaultControllerSettings(),{settings,replaced}=assignControllerBinding(original,'draw',{kind:'button',index:0});
 assert.equal(replaced,'Activate / confirm');assert.equal(settings.bindings.confirm,null);assert.equal(original.bindings.confirm.index,0);
 const axis=assignControllerBinding(settings,'draw',{kind:'axis',index:0,direction:1}).settings;
 assert.equal(axis.bindings.pointerRight,null);assert.equal(axis.bindings.pointerLeft.direction,-1);
 assert.throws(()=>assignControllerBinding(settings,'unknown',null));
});

test('gameplay buttons fire once per press and never repeat a held turn action',()=>{
 const {input,p,settings}=ready();down(p,9);assert.equal(input.sample(p,settings,32).filter(e=>e.action==='nextStep'&&e.phase==='press').length,1);
 for(const time of [48,500,1000])assert.equal(input.sample(p,settings,time).length,0);
 down(p,9,0);assert.equal(input.sample(p,settings,1100)[0].phase,'release');down(p,9);assert.equal(input.sample(p,settings,1200)[0].phase,'press');
});

test('navigation repeats after a delay, without affecting unrelated actions',()=>{
 const {input,p,settings}=ready();down(p,13);assert.equal(input.sample(p,settings,32)[0].phase,'press');assert.equal(input.sample(p,settings,400).length,0);
 assert.equal(input.sample(p,settings,432)[0].phase,'repeat');assert.equal(input.sample(p,settings,450).length,0);assert.equal(input.sample(p,settings,562)[0].phase,'repeat');
});

test('stick deadzones suppress drift and continuous movement scales with magnitude and time',()=>{
 const {input,p,settings}=ready();p.axes[0]=.15;assert.deepEqual(input.sample(p,settings,32),[]);
 p.axes[0]=.61;const event=input.sample(p,settings,48).find(e=>e.action==='pointerRight');assert.ok(Math.abs(event.value-.5)<.001);assert.equal(event.dt,.016);
 p.axes[0]=-1;const opposite=input.sample(p,settings,500).find(e=>e.action==='pointerLeft');assert.equal(opposite.value,1);assert.equal(opposite.dt,.05);
});

test('connecting or regaining focus with a held button requires release before gameplay',()=>{
 const input=createControllerInput(),p=pad(),settings=defaultControllerSettings();down(p,9);
 for(const t of [0,16,32])assert.deepEqual(input.sample(p,settings,t),[]);
 down(p,9,0);input.sample(p,settings,48);down(p,9);assert.equal(input.sample(p,settings,64)[0].action,'nextStep');
 input.sample(p,settings,80,{active:false});assert.deepEqual(input.sample(p,settings,96),[]);assert.deepEqual(input.sample(p,settings,112),[]);
 down(p,9,0);input.sample(p,settings,128);down(p,9);assert.equal(input.sample(p,settings,144)[0].phase,'press');
});

test('disconnect and disabling input release held inspection and reset state',()=>{
 const {input,p,settings}=ready();down(p,3);input.sample(p,settings,32);
 assert.ok(input.sample(null,settings,48).some(e=>e.action==='inspect'&&e.phase==='release'));
 input.sample(p,settings,64);down(p,3,0);input.sample(p,settings,80);down(p,3);input.sample(p,settings,96);
 assert.ok(input.sample(p,{...settings,enabled:false},112).some(e=>e.action==='inspect'&&e.phase==='release'));
});

test('button capture ignores the control already held when binding began',()=>{
 const p=pad();down(p,0);const capture=createBindingCapture(p);assert.equal(capture(p),null);down(p,0,0);assert.equal(capture(p),null);
 down(p,0);assert.deepEqual(capture(p),{kind:'button',index:0});
});

test('axis capture ignores returning to center and supports unmoving nonstandard axes',()=>{
 const p=pad();p.axes=[.9,0,-1,0];const capture=createBindingCapture(p);p.axes[0]=0;assert.equal(capture(p),null);
 p.axes[0]=-.85;assert.deepEqual(capture(p),{kind:'axis',index:0,direction:-1});
 const other=pad();other.axes[2]=-1;const buttons=createBindingCapture(other);down(other,16);assert.deepEqual(buttons(other),{kind:'button',index:16});
});

test('missing controls and nonfinite samples never generate actions',()=>{
 const {input,p,settings}=ready();p.buttons=[];p.axes=[NaN,Infinity];assert.deepEqual(input.sample(p,settings,32),[]);
 p.connected=false;assert.deepEqual(input.sample(p,settings,48),[]);
});
