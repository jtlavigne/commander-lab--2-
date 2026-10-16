// Exercise the actual ASAR/executable, not an unpackaged test BrowserWindow.
const {spawn,execFileSync}=require('node:child_process');
const path=require('node:path');
const assert=require('node:assert/strict');
const WebSocket=require('ws');
const version=require('../package.json').version;
const directory=path.resolve(process.argv[2]||'release');
const yaml=require('js-yaml'),fs=require('node:fs');
const updateConfig=yaml.load(fs.readFileSync(path.join(directory,'win-unpacked/resources/app-update.yml'),'utf8'));
assert.equal(updateConfig.provider,'github');assert.equal(updateConfig.owner,'jtlavigne');assert.equal(updateConfig.repo,'commander-lab--2-');assert.equal(updateConfig.channel,'test');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const profile='qa-release-'+Date.now();
const child=spawn(path.join(directory,'win-unpacked/Commander Lab.exe'),['--profile='+profile,'--remote-debugging-port=0'],{env,windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket;
const deadline=setTimeout(()=>{child.kill();console.error('Packaged app smoke test timed out');process.exitCode=1;},30000);
const endpoint=new Promise((resolve,reject)=>{
 let output='';child.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match)resolve(match[1]);});
 child.once('error',reject);child.once('exit',code=>reject(Error('App exited before debugger startup: '+code)));
});
(async()=>{
 try{
  const url=await endpoint;socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  let serial=0;const pending=new Map();socket.on('message',raw=>{const message=JSON.parse(raw);const waiter=pending.get(message.id);if(waiter){pending.delete(message.id);message.error?waiter.reject(Error(message.error.message)):waiter.resolve(message.result);}});
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,sessionId}));});
  let page;
  for(let i=0;i<100&&!page;i++){page=(await send('Target.getTargets')).targetInfos.find(t=>t.type==='page'&&t.url.startsWith('file:'));if(!page)await new Promise(r=>setTimeout(r,100));}
  assert.ok(page,'Packaged renderer opened');const {sessionId}=await send('Target.attachToTarget',{targetId:page.targetId,flatten:true});
  let loaded;
  for(let i=0;i<100&&!loaded;i++){
   const result=await send('Runtime.evaluate',{expression:"Boolean(document.querySelector('#launch-screen')?.open && document.querySelector('#launch-local') && window.desktopApp)",returnByValue:true},sessionId);
   loaded=result.result.value;if(!loaded)await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(loaded,true,'Launch screen and sandboxed preload are present');
  const title=execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${child.pid}).MainWindowTitle`],{encoding:'utf8',windowsHide:true});
  assert.ok(title.includes('v'+version)&&title.includes(profile),'Versioned native title and packaged profile flag: '+title);
  const result=await send('Runtime.evaluate',{expression:"new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth>0);img.onerror=()=>resolve(false);img.src='./assets/commander-lab-card-back.png';})",awaitPromise:true,returnByValue:true},sessionId);assert.equal(result.result.value,true,'Bundled card artwork loads');
  const update=await send('Runtime.evaluate',{expression:"window.appUpdates.status()",awaitPromise:true,returnByValue:true},sessionId);
  assert.equal(update.result.value.currentVersion,version);assert.equal(update.result.value.status,'unsupported');assert.match(update.result.value.message,/setup.exe/);
  console.log('Packaged Windows smoke passed: ASAR renderer, launch menu, preload, version, profile, bundled art, update configuration and ZIP guidance.');
 }finally{clearTimeout(deadline);socket?.close();child.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});

