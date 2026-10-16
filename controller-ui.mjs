import {CONTROLLER_ACTIONS,defaultControllerSettings,normalizeControllerSettings,assignControllerBinding,bindingLabel,createControllerInput,createBindingCapture} from './controller.mjs';
import {createThemeSettings} from './theme.mjs';
import {createUpdateSettings} from './update-ui.mjs';

const STORAGE_KEY='commanderLabController';
const interfaceActions=new Set(['confirm','cancel','focusPrevious','focusNext','adjustDown','adjustUp','settings']);
export function createControllerUI({onAction,onPan,onDrop,setStatus}){
 const make=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const button=(text,fn)=>{const node=make('button',text);node.type='button';node.onclick=fn;return node;};
 let settings=defaultControllerSettings();
 try{settings=normalizeControllerSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{}
 const input=createControllerInput(),dialog=make('dialog'),open=button('Settings',()=>show());open.id='settings';open.title='Appearance and controller settings';
 document.querySelector('.header-actions').insertBefore(open,document.getElementById('help'));dialog.id='settings-dialog';
 dialog.innerHTML='<div class="dialog-heading"><h2>Settings</h2><button id="settings-close" class="icon-button" aria-label="Close settings">×</button></div><h3>Controller</h3><p id="controller-status" role="status"></p><label class="controller-enable"><input id="controller-enabled" type="checkbox"> Enable controller input</label><label for="controller-device">Controller</label><select id="controller-device"></select><p class="panel-caption">Press a button on your controller if it is not listed. Mappings are saved on this computer. Labels below describe standard Xbox / PlayStation layouts; other controllers may use different button numbers.</p><div class="controller-tuning"><label>Stick deadzone<input id="controller-deadzone" type="range" min="0.08" max="0.6" step="0.01"><output id="controller-deadzone-value"></output></label><label>Pointer speed<input id="controller-pointerSpeed" type="range" min="150" max="1800" step="50"><output id="controller-pointerSpeed-value"></output></label><label>Camera speed<input id="controller-panSpeed" type="range" min="150" max="1800" step="50"><output id="controller-panSpeed-value"></output></label></div><p id="controller-message" role="status" aria-live="polite">Choose Bind, then press a controller button or move a stick. Reusing an input clears its previous action.</p><button id="controller-cancel-bind" hidden>Cancel binding</button><div id="controller-bindings"></div><div class="dialog-actions"><button id="controller-defaults">Restore defaults</button><button id="settings-done" class="primary">Done</button></div><p class="panel-caption">Left stick: pointer · Right stick: pan · A/Cross: activate · X/Square: tap · Hold Y/Triangle: inspect · Stick press: pick up/place · D-pad: controls and values. Text entry still uses the keyboard.</p>';
 document.body.append(dialog);
 createThemeSettings(dialog);
 createUpdateSettings(dialog);
 const css=make('link');css.rel='stylesheet';css.href=new URL('./controller.css',import.meta.url).href;document.head.append(css);
 const cursor=make('div',undefined,'controller-pointer');cursor.hidden=true;cursor.setAttribute('aria-hidden','true');document.body.append(cursor);
 const q=id=>dialog.querySelector('#'+id),rows=new Map();
 let capture=null,pads=[],pad=null,lastDevices='',point={x:innerWidth/2,y:innerHeight/2},focusMode=false,carried=null,lastModal=null,inspecting=false;
 const message=text=>q('controller-message').textContent=text;
 const currentModal=()=>[...document.querySelectorAll('dialog[open]')].at(-1);
 function inspect(held){if(inspecting===held)return;inspecting=held;onAction('inspect',{phase:held?'press':'release',point});}
 function release(){inspect(false);carried=null;cursor.classList.remove('carrying');cursor.hidden=true;document.querySelectorAll('.controller-hover').forEach(n=>n.classList.remove('controller-hover'));}
 function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));}catch{message('Settings work for this session, but could not be saved.');}}
 function resetInput(){for(const event of input.reset())if(event.action==='inspect')inspect(false);}
 function renderBindings(){
  for(const action of CONTROLLER_ACTIONS){
   const row=rows.get(action.id),binding=settings.bindings[action.id],listening=capture?.id===action.id;
   row.querySelector('output').textContent=listening?'Press a button / move a stick…':bindingLabel(binding);
   row.querySelector('[data-bind]').textContent=listening?'Cancel':'Bind';
   row.querySelector('[data-clear]').disabled=!binding;
  }
 }
 function updateFields(){
  q('controller-enabled').checked=settings.enabled;
  for(const name of ['deadzone','pointerSpeed','panSpeed']){q('controller-'+name).value=settings[name];q('controller-'+name+'-value').textContent=name==='deadzone'?Math.round(settings[name]*100)+'%':settings[name]+' px/s';}
  renderBindings();lastDevices='';
 }
 function show(){if(!dialog.open){release();resetInput();dialog.showModal();}}
 function stopCapture(text){capture=null;q('controller-cancel-bind').hidden=true;resetInput();renderBindings();if(text)message(text);}
 function close(){stopCapture();dialog.close();resetInput();}
 q('settings-close').onclick=q('settings-done').onclick=close;
 dialog.addEventListener('cancel',()=>stopCapture());dialog.addEventListener('close',()=>{stopCapture();release();});
 q('controller-cancel-bind').onclick=()=>stopCapture('Binding cancelled.');
 q('controller-enabled').onchange=()=>{settings.enabled=q('controller-enabled').checked;resetInput();release();save();lastDevices='';};
 q('controller-device').onchange=()=>{settings.device=q('controller-device').value;stopCapture();resetInput();release();save();lastDevices='';};
 for(const name of ['deadzone','pointerSpeed','panSpeed'])q('controller-'+name).oninput=()=>{settings[name]=Number(q('controller-'+name).value);updateFields();resetInput();save();};
 q('controller-defaults').onclick=()=>{settings=defaultControllerSettings();stopCapture('Default controller settings restored.');release();updateFields();save();};
 for(const group of [...new Set(CONTROLLER_ACTIONS.map(a=>a.group))]){
  const section=make('section');section.className='controller-group';section.append(make('h3',group));
  for(const action of CONTROLLER_ACTIONS.filter(a=>a.group===group)){
   const row=make('div',undefined,'controller-binding'),label=make('span',action.label),value=make('output');
   const bind=button('Bind',()=>{
    if(capture?.id===action.id){stopCapture('Binding cancelled.');return;}
    if(!pad){message('Connect a controller and press one of its buttons first.');return;}
    resetInput();release();capture={id:action.id,index:pad.index,read:createBindingCapture(pad),expires:performance.now()+20000};
    renderBindings();
    message('Binding '+action.label+': release the current control, then press a button or move a stick.');q('controller-cancel-bind').hidden=false;
   });bind.dataset.bind=action.id;bind.setAttribute('aria-label','Bind '+action.label);
   const clear=button('Clear',()=>{settings=assignControllerBinding(settings,action.id,null).settings;stopCapture();renderBindings();save();message(action.label+' is unassigned.');});clear.dataset.clear=action.id;clear.setAttribute('aria-label','Clear '+action.label);
   row.append(label,value,bind,clear);rows.set(action.id,row);section.append(row);
  }q('controller-bindings').append(section);
 }
 function updateDevices(){
  const key=JSON.stringify([pads.map(p=>[p.index,p.id,p.mapping]),settings.device,settings.enabled]);if(key===lastDevices)return;lastDevices=key;
  q('controller-device').replaceChildren();const auto=make('option','First available controller');auto.value='';q('controller-device').append(auto);
  for(const device of pads){const option=make('option',device.id+' · '+(device.index+1));option.value=device.id;q('controller-device').append(option);}
  if(settings.device&&!pads.some(p=>p.id===settings.device)){const missing=make('option',settings.device+' · disconnected');missing.value=settings.device;q('controller-device').append(missing);}
  q('controller-device').value=settings.device;
  q('controller-status').textContent=typeof navigator.getGamepads!=='function'?'Gamepad input is unavailable in this runtime.':!pad?'No controller detected. Connect one, then press a button.':(settings.enabled?'Connected: ':'Input disabled: ')+pad.id+(pad.mapping==='standard'?'':' · custom layout: check your bindings');
 }
 function movePointer(x,y){
  point={x:Math.max(1,Math.min(innerWidth-2,x)),y:Math.max(1,Math.min(innerHeight-2,y))};
  const host=document.querySelector(':popover-open')||currentModal()||document.body;if(cursor.parentElement!==host)host.append(cursor);
  cursor.style.left=point.x+'px';cursor.style.top=point.y+'px';cursor.hidden=false;
  const hit=document.elementFromPoint(point.x,point.y),card=hit?.closest('.card[data-card]');
  document.querySelectorAll('.controller-hover').forEach(node=>{if(node!==card)node.classList.remove('controller-hover');});card?.classList.add('controller-hover');
  hit?.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:point.x,clientY:point.y,pointerType:'mouse',pointerId:909}));
 }
 const available=node=>!node.disabled&&node.getAttribute('aria-disabled')!=='true'&&node.tabIndex>=0&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden';
 function focusControl(direction){
  const root=currentModal()||document.querySelector(':popover-open')||document.body;
  const nodes=[...root.querySelectorAll('button,input:not([type=hidden]),select,textarea,[tabindex="0"]')].filter(available);
  if(!nodes.length)return;const index=nodes.indexOf(document.activeElement),next=nodes[index<0?(direction<0?nodes.length-1:0):(index+direction+nodes.length)%nodes.length];
  next.focus({preventScroll:true});next.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});focusMode=true;
 }
 function handCard(direction){
  const nodes=[...document.querySelectorAll('#dock-items .card[data-card]')];if(!nodes.length)return;
  const hit=document.elementFromPoint(point.x,point.y)?.closest('.card[data-card]'),index=nodes.indexOf(hit);
  const next=nodes[index<0?(direction<0?nodes.length-1:0):(index+direction+nodes.length)%nodes.length];next.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});next.focus({preventScroll:true});
  const rect=next.getBoundingClientRect();movePointer((rect.left+rect.right)/2,(rect.top+rect.bottom)/2);focusMode=false;
 }
 function target(){return focusMode&&document.activeElement!==document.body?document.activeElement:document.elementFromPoint(point.x,point.y);}
 function adjust(direction){
  const node=target();if(!node)return;
  if(node.matches('select')){const options=[...node.options].filter(o=>!o.disabled),index=options.indexOf(node.selectedOptions[0]);node.value=options[Math.max(0,Math.min(options.length-1,index+direction))]?.value||'';}
  else if(node.matches('input[type=number],input[type=range]')){try{direction>0?node.stepUp():node.stepDown();}catch{return;}}
  else return;
  node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function cancel(){
  if(capture){stopCapture('Binding cancelled.');return;}
  if(carried){release();setStatus('Card placement cancelled.');return;}
  inspect(false);
  const popover=document.querySelector(':popover-open');if(popover){popover.hidePopover();return;}
  const modal=currentModal();if(modal){const event=new Event('cancel',{cancelable:true});if(modal.dispatchEvent(event))modal.close();return;}
  document.activeElement?.blur();
 }
 function handle(event){
  const {action,phase}=event;
  if(action==='inspect'&&phase==='release'){inspect(false);return;}
  if(phase==='release')return;
  const modal=currentModal(),editing=document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  const pileAction=modal?.id==='pile-dialog'&&['grab','inspect'].includes(action);
  if((modal||editing)&&!interfaceActions.has(action)&&!pileAction)return;
  if(action==='settings'){dialog.open?close():show();return;}
  if(action==='cancel'){cancel();return;}
  if(action==='focusPrevious'||action==='focusNext'){focusControl(action==='focusPrevious'?-1:1);return;}
  if(action==='adjustDown'||action==='adjustUp'){adjust(action==='adjustDown'?-1:1);return;}
  if(action==='confirm'){
   const node=target()?.closest('button,input,select,textarea,.card,[role=button]');
   if(node&&!node.disabled&&node.getAttribute('aria-disabled')!=='true'){node.focus({preventScroll:true});node.click();}return;
  }
  if(action==='previousCard'||action==='nextCard'){handCard(action==='previousCard'?-1:1);return;}
  if(action==='grab'){
   if(carried){const drop=document.elementFromPoint(point.x,point.y)?.closest('[data-drop]');if(drop){onDrop(carried,drop,point);carried=null;cursor.classList.remove('carrying');}else setStatus('Point at a card zone to place the card.');}
   else{const node=document.elementFromPoint(point.x,point.y)?.closest('.card[data-card]');if(node?.draggable){carried=node.dataset.card;cursor.classList.add('carrying');setStatus('Card picked up. Point at a zone and press Pick up / place again, or Cancel.');}}return;
  }
  if(action==='inspect')inspect(true);else onAction(action,{...event,point});
 }
 let previousTime=0;
 function frame(time){
  try{
   pads=Array.from(navigator.getGamepads?.()||[]).filter(p=>p&&p.connected!==false);
   pad=pads.find(p=>!settings.device||p.id===settings.device)||null;updateDevices();
   const active=document.hasFocus()&&document.visibilityState!=='hidden';
   if(capture){
    input.sample(null,settings,time,{active:false});
    if(!active||!pad||pad.index!==capture.index)stopCapture('Binding cancelled: controller or window lost focus.');
    else if(time>=capture.expires)stopCapture('Binding timed out. Choose Bind to try again.');
    else{const binding=capture.read(pad);if(binding){const id=capture.id,result=assignControllerBinding(settings,id,binding);settings=result.settings;stopCapture();renderBindings();save();message('Bound '+CONTROLLER_ACTIONS.find(a=>a.id===id).label+' to '+bindingLabel(binding)+(result.replaced?'. Cleared '+result.replaced+'.':'.'));}}
   }else{
    const events=input.sample(pad,settings,time,{active}),modal=currentModal();
    if(modal!==lastModal){lastModal=modal;focusMode=!!modal;if(modal&&carried)release();}
    if(!active||!pad||!settings.enabled)release();
    const dt=Math.max(0,Math.min(.05,(time-(previousTime||time))/1000));let dx=0,dy=0,px=0,py=0;
    for(const event of events){
     if(event.phase==='value'){
      if(event.action.startsWith('pointer')){if(event.action==='pointerLeft')dx-=event.value;if(event.action==='pointerRight')dx+=event.value;if(event.action==='pointerUp')dy-=event.value;if(event.action==='pointerDown')dy+=event.value;}
      else if(!modal&&!document.activeElement?.matches('input,textarea,select')){if(event.action==='panLeft')px+=event.value;if(event.action==='panRight')px-=event.value;if(event.action==='panUp')py+=event.value;if(event.action==='panDown')py-=event.value;}
     }else handle(event);
    }
    if(dx||dy){focusMode=false;movePointer(point.x+dx*settings.pointerSpeed*dt,point.y+dy*settings.pointerSpeed*dt);}
    if(px||py){onPan(px*settings.panSpeed*dt,py*settings.panSpeed*dt);movePointer(point.x,point.y);}
   }
  }catch(error){release();resetInput();q('controller-status').textContent='Controller input unavailable: '+error.message;}
  previousTime=time;requestAnimationFrame(frame);
 }
 document.addEventListener('pointermove',event=>{if(event.isTrusted){cursor.hidden=true;focusMode=false;document.querySelectorAll('.controller-hover').forEach(n=>n.classList.remove('controller-hover'));}},true);
 window.addEventListener('blur',()=>{stopCapture();resetInput();release();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCapture();resetInput();release();}});
 updateFields();requestAnimationFrame(frame);
 return {show};
}
