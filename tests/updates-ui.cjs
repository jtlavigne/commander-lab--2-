const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {installMultiplayer}=require('../multiplayer/electron.cjs');
const {createUpdateController}=require('../app-updates.cjs');
app.setPath('userData',path.join(__dirname,'..','.qa','updates-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const network=installMultiplayer({ipcMain,app,bind:'127.0.0.1'}),errors=[];
 ipcMain.handle('cards-batch',()=>({}));ipcMain.handle('card',()=>null);
 const win=new BrowserWindow({show:false,width:1400,height:940,webPreferences:{preload:path.join(__dirname,'..','preload.cjs'),contextIsolation:true,sandbox:true,backgroundThrottling:false,offscreen:true}});
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 let accept=false,installed=0,offline=false,finishDownload;
 const updater=new EventEmitter();
 updater.checkForUpdates=async()=>{if(offline)throw Error('Connection unavailable');updater.emit('update-available',{version:'0.1.0-test.3'});};
 updater.downloadUpdate=()=>new Promise(resolve=>{finishDownload=()=>{updater.emit('update-downloaded',{version:'0.1.0-test.3'});resolve();};updater.emit('download-progress',{percent:37});});
 updater.quitAndInstall=()=>installed++;
 const service=createUpdateController({updater,version:'0.1.0-test.2',supported:true,confirmInstall:async()=>accept,notify:state=>win.webContents.send('app-update-state',state)});
 for(const action of ['status','check','download','install'])ipcMain.handle('app-update-'+action,()=>action==='status'?service.snapshot():service.command(action));
 const run=code=>win.webContents.executeJavaScript(code,true),click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
 async function until(expression){for(let i=0;i<200;i++){if(await run(expression))return;await new Promise(r=>setTimeout(r,20));}throw Error('Timeout: '+expression);}
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'));
  await until("!!document.querySelector('#launch-settings') && !document.querySelector('#update-check').disabled");
  await click('#launch-settings');await until("document.querySelector('#settings-dialog').open");
  assert.equal(await run("document.querySelector('#update-version').textContent"),'v0.1.0-test.2');
  offline=true;await click('#update-check');await until("document.querySelector('#update-status').textContent.includes('Connection unavailable')");
  offline=false;await click('#update-check');await until("!document.querySelector('#update-download').hidden");
  await click('#update-download');await until("document.querySelector('#update-progress').value===37");
  assert.equal(await run("document.querySelector('#update-check').disabled"),true);
  await click('#settings-close');await click('#launch-settings');assert.equal(await run("document.querySelector('#update-progress').value"),37);
  finishDownload();await until("!document.querySelector('#update-install').hidden && !document.querySelector('#update-install').disabled");
  await click('#update-install');await until("!document.querySelector('#update-install').disabled");assert.equal(installed,0,'Cancelling must keep app running');
  await until("document.querySelector('#settings-dialog').open");
  await new Promise(r=>setTimeout(r,300));
  const visible=await run("(()=>{const r=document.querySelector('#update-install').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id})()");
  assert.equal(visible,'update-install','Restart control must be visible above the launch screen');
  const fs=require('node:fs/promises');await fs.mkdir(path.join(__dirname,'..','.qa'),{recursive:true});await fs.writeFile(path.join(__dirname,'..','.qa','update-settings.png'),(await win.webContents.capturePage()).toPNG());
  accept=true;await click('#update-install');await until("document.querySelector('#update-status').textContent.includes('Closing Commander Lab')");assert.equal(installed,1);
  assert.deepEqual(errors,[]);console.log('Updates UI passed: launch Settings, offline retry, download progress, reopen, cancel and confirm restart through sandboxed preload.');
 }catch(error){console.error(error);console.error(errors);process.exitCode=1;}
 finally{await network.close();win.destroy();app.exit(process.exitCode||0);}
}).catch(error=>{console.error(error);app.exit(1);});
