const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
const {installMultiplayer}=require('../multiplayer/electron.cjs');
app.setPath('userData',path.join(__dirname,'..','.qa','controller-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const errors=[],network=installMultiplayer({ipcMain,app,bind:'127.0.0.1'});
 const win=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{preload:path.join(__dirname,'..','preload.cjs'),contextIsolation:true,sandbox:true,backgroundThrottling:false,offscreen:true}});
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 ipcMain.handle('cards-batch',()=>({}));ipcMain.handle('card',()=>null);
 const run=code=>win.webContents.executeJavaScript(code,true),click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const state=()=>run("JSON.parse(localStorage.getItem('commanderLab'))");
 async function wait(fn){const start=Date.now();while(!await fn()){if(Date.now()-start>8000)throw Error('Controller UI timeout');await delay(20);}}
 async function reload(){const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;await wait(()=>run("!!document.getElementById('settings')"));}
 async function mock(){await run(`window.__foreground=true;window.__pad={id:'Test controller',index:0,connected:true,mapping:'standard',buttons:Array.from({length:18},()=>({pressed:false,value:0})),axes:[0,0,0,0]};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__pad?[window.__pad]:[]});document.hasFocus=()=>window.__foreground;Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});undefined;`);await delay(100);}
 const setButton=(index,pressed)=>run(`window.__pad.buttons[${index}]={pressed:${pressed},value:${pressed?1:0}}`);
 async function press(index,hold=70){await setButton(index,true);await delay(hold);await setButton(index,false);await delay(70);}
 async function aim(selector){
  await run('document.activeElement?.blur()');
  for(let n=0;n<80;n++){
   const delta=await run(`(()=>{const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(),cursor=document.querySelector('.controller-pointer');return {x:(rect.left+rect.right)/2-(parseFloat(cursor.style.left)||innerWidth/2),y:(rect.top+rect.bottom)/2-(parseFloat(cursor.style.top)||innerHeight/2)};})()`);
   if(Math.abs(delta.x)<6&&Math.abs(delta.y)<6)break;
   const magnitude=value=>Math.abs(value)<4?0:Math.sign(value)*(.22+.78*Math.min(1,Math.abs(value)/80));
   await run(`window.__pad.axes[0]=${magnitude(delta.x)};window.__pad.axes[1]=${magnitude(delta.y)}`);await delay(35);
   if(n===79)throw Error('Could not aim controller pointer');
  }
  await run('window.__pad.axes[0]=0;window.__pad.axes[1]=0');await delay(60);
 }
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});await wait(()=>run("!!document.getElementById('settings')"));
  await run(`(async()=>{const {newGame,transfer}=await import('./engine.mjs');const g=newGame(2);g.step=3;g.responseMode='hold';const c=(instance,extra={})=>({instance,name:instance,type_line:'Basic Land — Forest',oracle_text:'({T}: Add {G}.)',counters:{},face:0,...extra});g.players[0].zones.hand=[c('Hand land')];g.players[0].zones.graveyard=[c('Discarded land')];g.players[0].zones.library=[c('Draw one'),c('Draw two'),c('Draw three')];g.players[0].zones.hand.push(c('Ring',{type_line:'Artifact',oracle_text:'{T}: Add {C}{C}.'}));transfer(g,'Ring','battlefield',0,{x:.4,y:.3});localStorage.setItem('commanderLab',JSON.stringify(g));})()`);await reload();await mock();
  await click('#settings');await wait(()=>run("document.getElementById('controller-status').textContent.includes('Test controller')"));
  const before=(await state()).players[0].zones.hand.length;await click('[data-bind=draw]');await setButton(16,true);await wait(()=>run("JSON.parse(localStorage.getItem('commanderLabController')||'{}').bindings?.draw?.index===16"));
  assert.equal((await state()).players[0].zones.hand.length,before,'Binding must not also draw');await click('#settings-done');await delay(120);assert.equal((await state()).players[0].zones.hand.length,before,'Held input after binding must wait for release');
  await setButton(16,false);await delay(70);await press(16,600);assert.equal((await state()).players[0].zones.hand.length,before+1,'Draw must fire once while held');
  await click('#settings');const step=(await state()).step;await press(9);assert.equal((await state()).step,step,'Gameplay shortcuts must not affect a table behind settings');
  await run("document.getElementById('controller-pointerSpeed').focus()");const speed=await run("Number(document.getElementById('controller-pointerSpeed').value)");await press(15);assert.equal(await run("Number(document.getElementById('controller-pointerSpeed').value)"),speed+50);
  await press(1);assert.equal(await run("document.getElementById('settings-dialog').open"),false);
  await aim('.battlefield [data-card=Ring]');await press(2,500);let g=await state();assert.equal(g.players[0].zones.battlefield[0].tapped,true);assert.equal(g.players[0].mana.reduce((n,l)=>n+l.amount,0),2);
  await setButton(3,true);await wait(()=>run("!document.getElementById('card-zoom-preview').hidden"));await setButton(3,false);await wait(()=>run("document.getElementById('card-zoom-preview').hidden"));
  await press(10);assert.equal(await run("document.querySelector('.controller-pointer').classList.contains('carrying')"),true);
  await run('window.__pad.axes[0]=.7');await delay(180);await run('window.__pad.axes[0]=0');await delay(60);await press(10);g=await state();assert.notEqual(g.players[0].zones.battlefield[0].tablePosition.x,.4);assert.equal(await run("document.querySelector('.controller-pointer').classList.contains('carrying')"),false);
  await run('window.__foreground=false');await setButton(2,true);await delay(100);await run('window.__foreground=true');await delay(120);assert.equal((await state()).players[0].zones.battlefield[0].tapped,true);await setButton(2,false);await delay(70);await press(2);assert.equal((await state()).players[0].zones.battlefield[0].tapped,false);
  await click('#fit-seat');const cameraBefore=await run("document.getElementById('zones').style.left");await run('window.__pad.axes[2]=1');await delay(180);await run('window.__pad.axes[2]=0');assert.notEqual(await run("document.getElementById('zones').style.left"),cameraBefore);
  await press(5);assert.ok(await run("!!document.querySelector('#dock-items .controller-hover')"));await press(0);assert.equal((await state()).players[0].zones.battlefield.some(c=>c.instance==='Hand land'),true,'A activates an affordable hand land');
  await click('.player-mat[data-seat="0"] .pile.graveyard');await aim('#pile-cards [data-card="Discarded land"]');await setButton(3,true);await wait(()=>run("!document.getElementById('card-zoom-preview').hidden"));await setButton(3,false);await delay(70);await press(10);assert.equal(await run("document.querySelector('.controller-pointer').classList.contains('carrying')"),true);await aim('#pile-dialog [data-close]');await press(0);assert.equal(await run("document.getElementById('pile-dialog').open"),false);await aim('.player-mat[data-seat="0"] [data-drop=battlefield]');await press(10);assert.equal((await state()).players[0].zones.battlefield.some(c=>c.instance==='Discarded land'),true);
  await reload();await mock();await click('#settings');assert.match(await run("document.querySelector('[data-bind=draw]').parentElement.querySelector('output').textContent"),/Button 16/);assert.equal(await run("Number(document.getElementById('controller-pointerSpeed').value)"),speed+50);
  await click('[data-clear=draw]');assert.equal(await run("JSON.parse(localStorage.getItem('commanderLabController')).bindings.draw"),null);
  await click('#controller-defaults');assert.equal(await run("JSON.parse(localStorage.getItem('commanderLabController')).bindings.confirm.index"),0);
  await run("document.getElementById('settings-dialog').scrollTop=0");await delay(150);await require('node:fs/promises').writeFile(path.join(__dirname,'..','.qa','controller-settings.png'),(await win.webContents.capturePage()).toPNG());
  await run("window.__pad=null");await wait(()=>run("document.getElementById('controller-status').textContent.includes('No controller')"));
  assert.deepEqual(errors,[]);console.log('Controller Electron passed: settings, live mapping and persistence, held-button protection, modal blocking, value controls, pointer, mana, inspection, card placement, focus recovery, camera and hand navigation.');
  await network.close();win.destroy();app.quit();
 }catch(error){console.error(error);console.error(await run("({status:document.getElementById('controller-status').textContent,active:document.activeElement?.outerHTML,modal:document.querySelector('dialog[open]')?.id,foreground:document.hasFocus(),visible:document.visibilityState,settings:localStorage.getItem('commanderLabController'),pad:window.__pad})"));if(errors.length)console.error(errors);await network.close();win.destroy();app.exit(1);}
}).catch(error=>{console.error(error);app.exit(1);});
