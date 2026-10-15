const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {installMultiplayer}=require('../multiplayer/electron.cjs');
app.setPath('userData',path.join(__dirname,'..','.qa','theme-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const network=installMultiplayer({ipcMain,app,bind:'127.0.0.1'}),errors=[];
 ipcMain.handle('cards-batch',()=>({}));ipcMain.handle('card',()=>null);
 const win=new BrowserWindow({show:false,width:1400,height:940,webPreferences:{preload:path.join(__dirname,'..','preload.cjs'),contextIsolation:true,sandbox:true,backgroundThrottling:false,offscreen:true}});
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 const run=code=>win.webContents.executeJavaScript(code,true),click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`),delay=ms=>new Promise(r=>setTimeout(r,ms));
 const color=s=>run(`getComputedStyle(document.querySelector(${JSON.stringify(s)})).backgroundColor`);
 async function ready(){for(let i=0;i<200;i++){if(await run("!!document.getElementById('launch-settings')"))return;await delay(20);}throw Error('Theme UI timeout');}
 async function reload(){await win.reload();await new Promise(r=>win.webContents.once('did-finish-load',r));await ready();}
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'));await ready();
  const original=await color('.app-header');await click('#launch-settings');assert.equal(await run("document.getElementById('settings-dialog').open"),true);
  const rect=await run("(()=>{const r=document.getElementById('theme-wheel').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,r:r.width*.46}})()");
  // Native Chromium pointer events exercise capture while dragging.
  win.webContents.debugger.attach('1.3');
  const mouse=event=>win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',event);
  await mouse({type:'mouseMoved',x:rect.x+rect.r,y:rect.y});
  await mouse({type:'mousePressed',x:rect.x+rect.r,y:rect.y,button:'left',buttons:1,clickCount:1});
  await mouse({type:'mouseMoved',x:rect.x,y:rect.y-rect.r,button:'left',buttons:1});
  await mouse({type:'mouseReleased',x:rect.x,y:rect.y-rect.r,button:'left',buttons:0,clickCount:1});await delay(70);
  assert.deepEqual(await run("JSON.parse(localStorage.getItem('commanderLabTheme'))"),{hue:270,saturation:100});
  assert.notEqual(await color('.app-header'),original);assert.match(await run("getComputedStyle(document.querySelector('.player-mat')).backgroundImage"),/rgb/);
  await run("document.getElementById('theme-wheel').focus()");win.webContents.sendInputEvent({type:'keyDown',keyCode:'Right',modifiers:['shift']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Right',modifiers:['shift']});await delay(30);
  assert.equal(await run("document.getElementById('theme-wheel').getAttribute('aria-valuenow')"),'280');
  await run("document.getElementById('theme-saturation').value=45;document.getElementById('theme-saturation').dispatchEvent(new Event('input'))");
  assert.deepEqual(await run("JSON.parse(localStorage.getItem('commanderLabTheme'))"),{hue:280,saturation:45});
  // All saturated hues keep readable normal text and accent buttons.
  for(const hue of [0,60,120,180,240,300]){
   await run(`document.documentElement.style.setProperty('--theme-hue',${hue});document.documentElement.style.setProperty('--theme-saturation','100%')`);
   const ratios=await run(`(()=>{const luminance=color=>{const v=color.match(/[\\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return v[0]*.2126+v[1]*.7152+v[2]*.0722},ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)},panel=getComputedStyle(document.getElementById('settings-dialog')),p=getComputedStyle(document.querySelector('.theme-settings p')),primary=getComputedStyle(document.getElementById('settings-done'));return [ratio(panel.color,panel.backgroundColor),ratio(p.color,panel.backgroundColor),ratio(primary.color,primary.backgroundColor)]})()`);
   assert.ok(ratios.every(v=>v>=4.5),`Hue ${hue} contrast ${ratios}`);
  }
  await click('[data-theme-preset="205"]');assert.equal(await run("document.querySelector('[data-theme-preset=\"205\"]').getAttribute('aria-pressed')"),'true');
  assert.equal(await run("document.getElementById('theme-value').textContent"),'Hue 205'+String.fromCharCode(176)+' '+String.fromCharCode(183)+' 55%');const blue=await color('.app-header');await delay(250);await fs.mkdir(path.join(__dirname,'..','.qa'),{recursive:true});await fs.writeFile(path.join(__dirname,'..','.qa','theme-settings.png'),(await win.webContents.capturePage()).toPNG());
  await reload();assert.equal(await color('.app-header'),blue);await click('#launch-settings');assert.equal(await run("document.getElementById('theme-saturation').value"),'55');
  await click('#theme-default');assert.equal(await run("localStorage.getItem('commanderLabTheme')"),null);assert.equal(await color('.app-header'),original);
  await reload();assert.equal(await color('.app-header'),original);
  await run("localStorage.setItem('commanderLabTheme','{invalid')");await reload();assert.equal(await color('.app-header'),original);
  assert.deepEqual(errors,[]);console.log('Theme Electron passed: pointer wheel, keyboard hue, intensity, presets, contrast, reload persistence, default restoration and invalid preferences.');
 }catch(error){console.error(error);console.error(errors);process.exitCode=1;}
 finally{await network.close();win.destroy();app.exit(process.exitCode||0);}
}).catch(error=>{console.error(error);app.exit(1);});
