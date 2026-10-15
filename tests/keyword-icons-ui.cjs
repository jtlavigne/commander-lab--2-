const {app,BrowserWindow}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
app.setPath('userData',path.join(__dirname,'..','.qa','keyword-icons-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{contextIsolation:true,sandbox:true,offscreen:true,backgroundThrottling:false}}),errors=[];
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 const run=code=>win.webContents.executeJavaScript(code,true),card='.battlefield .card[data-card="test"]';
 const reload=async()=>{const ready=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await ready;};
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});
  await run(`(async()=>{const {newGame}=await import('./engine.mjs');const g=newGame(2);g.step=3;g.responseMode='hold';const c=(instance,text)=>({instance,name:instance,type_line:'Creature',oracle_text:text,power:'4',toughness:'4',mana_cost:'{4}',face:0,counters:{},tapped:false});g.players[0].zones.battlefield=[{...c('test','Vigilance, deathtouch, lifelink\\nEquip {3}\\nWhen this creature enters, proliferate.\\nCompleated'),counters:{flying:1},tablePosition:{x:.35,y:.4,normalized:true},battlefieldId:'test-board'}];g.players[0].zones.hand=[c('hand','Flash\\nCycling {2}\\nScry 2.')];g.players[0].zones.command=[{...c('commander','Flying, first strike, vigilance, trample, lifelink, haste'),commander:true}];g.players[1].zones.hand=[c('secret','Menace')];localStorage.setItem('commanderLab',JSON.stringify(g));localStorage.setItem('commanderLabHandSeat','0');})()`);await reload();
  assert.deepEqual(await run(`[...document.querySelectorAll('${card} [data-keyword]')].map(n=>n.dataset.keyword)`),['deathtouch','flying','lifelink','vigilance']);
  assert.equal(await run(`document.querySelector('${card} [data-keyword=flying]').title`),'Flying');
  assert.equal(await run("document.querySelector('#dock-items [data-card=hand] [data-keyword=flash]').getAttribute('aria-label')"),'Flash');
  assert.equal(await run("document.querySelectorAll('[data-card=secret] .card-keyword').length"),0);
  assert.equal(await run("document.querySelectorAll('[data-keyword=equip],[data-keyword=proliferate],[data-keyword=compleated],[data-keyword=cycling],[data-keyword=scry]').length"),0);
  assert.equal(await run("document.querySelector('[data-card=commander] .card-keyword-more').textContent"),'+2');
  assert.equal(await run(`(()=>{const icons=document.querySelector('${card} .card-keywords').getBoundingClientRect(),stats=document.querySelector('${card} .card-pt-overlay').getBoundingClientRect(),c=document.querySelector('${card}').getBoundingClientRect();return icons.right<=stats.left&&icons.bottom<=c.bottom&&icons.left>=c.left;})()`),true,'Icons fit beside stats');
  // Existing counter controls update the icon strip immediately, without reload.
  await run(`document.querySelector('${card} [data-counter=flying]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))`);
  assert.equal(await run(`document.querySelector('${card} [data-keyword=flying]')`),null);
  // Badges are part of the card: right-click still taps and dragging still works.
  await run(`document.querySelector('${card} [data-keyword=lifelink]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))`);
  assert.equal(await run(`document.querySelector('${card}').classList.contains('tapped')`),true);
  assert.equal(await run(`(()=>{const n=document.querySelector('${card} [data-keyword=lifelink]'),data=new DataTransfer(),event=new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:data});n.dispatchEvent(event);const id=data.getData('application/x-commander-card');n.dispatchEvent(new DragEvent('dragend',{bubbles:true}));return id;})()`),'test');
  await run(`document.querySelector('${card} [data-keyword=lifelink]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))`);
  await new Promise(r=>setTimeout(r,300));
  // Hover inspection enlarges the same icon strip without hiding its labels.
  await run(`(()=>{const n=document.querySelector('${card}'),r=n.getBoundingClientRect();n.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Alt',code:'AltLeft',altKey:true,bubbles:true}));})()`);
  assert.equal(await run("!!document.querySelector('#card-zoom-preview [data-keyword=lifelink] svg')"),true);
  win.setSize(1501,960);await new Promise(r=>setTimeout(r,180));await fs.mkdir(path.join(__dirname,'..','.qa'),{recursive:true});await fs.writeFile(path.join(__dirname,'..','.qa','keyword-icons.png'),(await win.webContents.capturePage()).toPNG());
  await run("document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'Alt',code:'AltLeft',bubbles:true}));document.querySelector('#players [aria-label=\"Control Player 2\"]').click()");
  assert.equal(await run("document.querySelectorAll('[data-card=hand] .card-keyword').length"),0);
  assert.equal(await run("!!document.querySelector('#dock-items [data-card=secret] [data-keyword=menace]')"),true);
  assert.deepEqual(errors,[]);console.log('Keyword icons passed: board/hand/command previews, overflow, footer layout, counter updates, tap/drag, enlarged preview and hotseat privacy.');win.destroy();app.quit();
 }catch(error){console.error(error);if(errors.length)console.error(errors);app.exit(1);}
}).catch(error=>{console.error(error);app.exit(1);});
