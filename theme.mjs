const STORAGE_KEY='commanderLabTheme';
const DEFAULT={hue:149,saturation:35};

function normalize(value){
 if(!value||!Number.isFinite(value.hue)||!Number.isFinite(value.saturation))return null;
 return {hue:Math.round((value.hue%360+360)%360)%360,saturation:Math.round(Math.max(0,Math.min(100,value.saturation)))};
}
function apply(theme){
 const root=document.documentElement;
 if(!theme){delete root.dataset.theme;root.style.removeProperty('--theme-hue');root.style.removeProperty('--theme-saturation');return;}
 root.style.setProperty('--theme-hue',theme.hue);
 root.style.setProperty('--theme-saturation',theme.saturation+'%');root.dataset.theme='custom';
}
let selected=null;
if(typeof document!=='undefined'){
 try{selected=normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{}
 apply(selected);
}

export function createThemeSettings(dialog){
 const section=document.createElement('section');section.className='theme-settings';section.setAttribute('aria-labelledby','theme-heading');
 section.innerHTML=`<h3 id="theme-heading">Appearance</h3><p>Choose a color for the menus, controls and table felt.</p><div class="theme-editor"><div id="theme-wheel" class="theme-wheel" role="slider" tabindex="0" aria-label="Theme hue" aria-valuemin="0" aria-valuemax="359" aria-valuenow="149" aria-describedby="theme-help"><span class="theme-marker" aria-hidden="true"></span></div><div class="theme-controls"><div class="theme-preview"><span class="theme-swatch" aria-hidden="true"></span><span id="theme-value"></span></div><label for="theme-saturation">Color intensity</label><input id="theme-saturation" type="range" min="0" max="100" step="1"><div class="theme-presets" role="group" aria-label="Theme presets"></div><button type="button" id="theme-default">Restore default theme</button></div></div><p id="theme-help" class="panel-caption">Drag around the wheel for hue, or toward the center for a softer color. Keyboard: left/right change hue; up/down change intensity.</p><p id="theme-status" role="status" aria-live="polite"></p>`;
 dialog.querySelector('.dialog-heading').after(section);
 const q=id=>section.querySelector('#'+id),wheel=q('theme-wheel'),marker=wheel.firstElementChild,slider=q('theme-saturation');
 function render(){
  const {hue,saturation}=selected||DEFAULT,angle=hue*Math.PI/180,radius=saturation*.46;
  marker.style.left=(50+Math.cos(angle)*radius)+'%';marker.style.top=(50+Math.sin(angle)*radius)+'%';
  wheel.setAttribute('aria-valuenow',String(hue));wheel.setAttribute('aria-valuetext',`${hue} degrees, ${saturation}% intensity`);slider.value=saturation;
  section.style.setProperty('--theme-preview',selected?`hsl(${hue} ${saturation}% 78%)`:'#a9d6bf');
  q('theme-value').textContent=selected?`Hue ${hue}\u00b0 \u00b7 ${saturation}%`:'Default theme';
  for(const button of section.querySelectorAll('[data-theme-preset]'))button.setAttribute('aria-pressed',String(!!selected&&selected.hue===Number(button.dataset.themePreset)&&selected.saturation===55));
 }
 function save(value){
  selected=normalize(value);apply(selected);render();
  try{if(selected)localStorage.setItem(STORAGE_KEY,JSON.stringify(selected));else localStorage.removeItem(STORAGE_KEY);q('theme-status').textContent='';}
  catch{q('theme-status').textContent='Theme applied for this session. Preferences could not be saved.';}
 }
 function point(event){
  const rect=wheel.getBoundingClientRect(),x=event.clientX-rect.left-rect.width/2,y=event.clientY-rect.top-rect.height/2,distance=Math.hypot(x,y);
  save({hue:distance<1?(selected||DEFAULT).hue:Math.atan2(y,x)*180/Math.PI,saturation:Math.min(100,distance/(rect.width*.46)*100)});
 }
 wheel.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();wheel.focus();wheel.setPointerCapture(event.pointerId);point(event);});
 wheel.addEventListener('pointermove',event=>{if(wheel.hasPointerCapture(event.pointerId))point(event);});
 wheel.addEventListener('pointerup',event=>{if(wheel.hasPointerCapture(event.pointerId)){point(event);wheel.releasePointerCapture(event.pointerId);}});
 wheel.addEventListener('keydown',event=>{
  const value={...(selected||DEFAULT)},step=event.shiftKey?10:1;
  if(event.key==='ArrowLeft')value.hue-=step;else if(event.key==='ArrowRight')value.hue+=step;
  else if(event.key==='ArrowUp')value.saturation+=step;else if(event.key==='ArrowDown')value.saturation-=step;
  else if(event.key==='Home')value.hue=0;else if(event.key==='End')value.hue=359;else return;
  event.preventDefault();event.stopPropagation();save(value);
 });
 slider.addEventListener('input',()=>save({...selected||DEFAULT,saturation:Number(slider.value)}));
 for(const [name,hue] of [['Ember',15],['Gold',45],['Forest',140],['Ocean',205],['Violet',275]]){
  const button=document.createElement('button');button.type='button';button.textContent=name;button.dataset.themePreset=hue;button.style.setProperty('--swatch',`hsl(${hue} 55% 78%)`);button.onclick=()=>save({hue,saturation:55});section.querySelector('.theme-presets').append(button);
 }
 q('theme-default').onclick=()=>save(null);render();
}
