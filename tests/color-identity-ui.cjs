const {app,BrowserWindow,ipcMain,nativeImage}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
const {installMultiplayer}=require('../multiplayer/electron.cjs');
const records=require('./fixtures/commander/color-identity-regressions.json').cards;
app.setPath('userData',path.join(__dirname,'..','.qa','color-identity-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const network=installMultiplayer({ipcMain,app}),windows=[],errors=[],art=nativeImage.createFromBitmap(Buffer.alloc(8*12*4,170),{width:8,height:12}).toDataURL();
 ipcMain.handle('cards-tokens',()=>({tokens:[],warnings:[]}));
 ipcMain.handle('cards-batch',(_event,names)=>Object.fromEntries(names.map(name=>[name,{...records.find(c=>c.name===name),localImages:[art],artworkVersion:2}])));
 const run=(w,s)=>w.webContents.executeJavaScript(s,true),click=(w,s)=>run(w,`document.querySelector(${JSON.stringify(s)}).click()`),snapshot=w=>run(w,'window.tableNetwork.get().then(v=>v.snapshot)');
 async function wait(fn){const start=Date.now();while(!await fn()){if(Date.now()-start>8000)throw Error('Color identity UI timed out');await new Promise(r=>setTimeout(r,15));}}
 async function make(name){const w=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{preload:path.join(__dirname,'..','preload.cjs'),partition:'persist:'+name,contextIsolation:true,sandbox:true,backgroundThrottling:false,offscreen:true}});windows.push(w);w.webContents.on('console-message',(_e,level,message)=>{if(level>=2&&!message.includes('Electron Security Warning'))errors.push(message);});await w.webContents.session.clearStorageData();await w.loadFile(path.join(__dirname,'..','index.html'));await wait(()=>run(w,"!!document.getElementById('launch-screen')"));return w;}
 try{
  const host=await make('color-host'),peer=await make('color-peer');
  await run(host,`(async()=>{const {lobbyGame}=await import('./lobby.mjs'),g=lobbyGame({count:2}),records=${JSON.stringify(records)},card=name=>({...structuredClone(records.find(c=>c.name===name)),instance:crypto.randomUUID(),counters:{}});for(const [i,name] of ['Niv-Mizzet, Parun','Zedruu the Greathearted'].entries()){g.players[i].zones.command=[{...card(name),commander:true}];g.players[i].zones.library=[card('Nihil Spellbomb')];g.lobby.decks[i]={count:2,issues:['Saved generic warning']};}await window.tableNetwork.host({game:g,port:0});})()`);
  await wait(async()=>!!await snapshot(host));const connection=await snapshot(host);await run(peer,`window.tableNetwork.join({url:${JSON.stringify(connection.url)},code:${JSON.stringify(connection.code)}})`);await wait(async()=>!!await snapshot(peer));
  await click(host,'#lobby-recheck-0');await wait(async()=>!!(await snapshot(host)).game.lobby.decks[0].identityNotes);await wait(async()=>!!(await snapshot(peer)).game.lobby.decks[0].issues.some(s=>s.includes('outside its commander')));
  await click(peer,'#lobby-recheck-1');await wait(async()=>!!(await snapshot(peer)).game.lobby.decks[1].identityNotes);await wait(async()=>(await snapshot(host)).revision===(await snapshot(peer)).revision);
  const text=(w,seat)=>run(w,`document.querySelector('[data-lobby-seat="${seat}"]').textContent`);
  assert.match(await text(host,0),/Nihil Spellbomb: black; commander identity: blue \/ red/);assert.match(await text(peer,1),/Nihil Spellbomb: black; commander identity: white \/ blue \/ red/);
  assert.ok(!(await text(host,1)).includes('Nihil Spellbomb'));assert.ok(!(await text(peer,0)).includes('Nihil Spellbomb'));assert.equal((await snapshot(host)).game.lobby.decks[1].identityNotes,undefined);assert.equal((await snapshot(peer)).game.lobby.decks[0].identityNotes,undefined);
  const loaded=new Promise(resolve=>peer.webContents.once('did-finish-load',resolve));peer.webContents.reload();await loaded;await wait(()=>run(peer,"!!document.querySelector('[data-lobby-seat=\"1\"]')"));assert.match(await text(peer,1),/Nihil Spellbomb: black/);assert.ok(!(await text(peer,0)).includes('Nihil Spellbomb'));assert.deepEqual(errors,[]);
  console.log('Color identity UI passed: actual Niv-Mizzet/Zedruu/Spellbomb metadata, rechecking saved reports, exact card/color diagnostics, private packets/labels and reload persistence.');
 }catch(e){console.error(e);console.error(errors);process.exitCode=1;}
 finally{await network.close();windows.forEach(w=>w.destroy());app.exit(process.exitCode||0);}
}).catch(e=>{console.error(e);app.exit(1);});
