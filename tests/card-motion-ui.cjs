const {app,BrowserWindow}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
app.setPath('userData',path.join(__dirname,'..','.qa','card-motion-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{contextIsolation:true,sandbox:true,offscreen:true,backgroundThrottling:false}}),errors=[];
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 const run=code=>win.webContents.executeJavaScript(code,true),delay=ms=>new Promise(r=>setTimeout(r,ms)),card='.battlefield .card[data-card="bear"]';
 async function reload(){const ready=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await ready;}
 const animations=()=>run(`document.querySelector(${JSON.stringify(card)}).getAnimations().filter(a=>a.id==='card-motion-transform').map(a=>a.effect.getKeyframes().map(f=>f.transform))`);
 const tap=()=>run(`document.querySelector(${JSON.stringify(card)}).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))`);
 const flip=()=>run(`(()=>{const n=document.querySelector(${JSON.stringify(card)}),r=n.getBoundingClientRect();n.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}));})()`);
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});
  await run(`(async()=>{const {newGame}=await import('./engine.mjs');const g=newGame(2);g.step=3;g.responseMode='hold';const c=(instance,name)=>({instance,name,type_line:'Creature',oracle_text:'',mana_cost:'{2}',power:'2',toughness:'2',counters:{},face:0,tapped:false});g.players[0].zones.battlefield=[{...c('bear','Motion Bear'),tablePosition:{x:.3,y:.3,normalized:true},battlefieldId:'bear-on-board',layout:'transform',card_faces:[{name:'Motion Bear',type_line:'Creature',power:'2',toughness:'2'},{name:'Motion Wolf',type_line:'Creature',power:'3',toughness:'3'}]}];g.players[1].zones.hand=[c('secret','Opponent secret')];localStorage.setItem('commanderLab',JSON.stringify(g));})()`);await reload();
  win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  assert.deepEqual(await animations(),[],'Reload does not animate existing cards');
  await tap();let frames=(await animations())[0];assert.match(frames[0],/rotate\(0deg\)/);assert.match(frames.at(-1),/rotate\(90deg\)/);
  assert.equal(await run(`getComputedStyle(document.querySelector(${JSON.stringify(card+' .card-tap-indicator')})).pointerEvents`),'none');
  // An unrelated state update rebuilds the table without losing the animation.
  await run("document.querySelector('.pinned-player .life-control button').click()");assert.equal((await animations()).length,1);
  await delay(300);assert.deepEqual(await animations(),[]);assert.equal(await run(`!!document.querySelector(${JSON.stringify(card+' .card-tap-indicator')})`),true);
  await fs.mkdir(path.join(__dirname,'..','.qa'),{recursive:true});await fs.writeFile(path.join(__dirname,'..','.qa','tapped-card.png'),(await win.webContents.capturePage()).toPNG());
  await tap();frames=(await animations())[0];assert.match(frames[0],/rotate\(90deg\)/);assert.match(frames.at(-1),/rotate\(0deg\)/);await delay(280);
  assert.equal(await run(`!!document.querySelector(${JSON.stringify(card+' .card-tap-indicator')})`),false);
  await flip();frames=(await animations())[0];assert.ok(frames.some(f=>f.includes('rotateY(90deg)')));assert.equal(await run(`document.querySelector(${JSON.stringify(card)}).dataset.displayFace`),'back');
  assert.equal(await run(`document.querySelector(${JSON.stringify(card+' .card-flip-face')}).inert`),true);await delay(480);
  assert.equal(await run("!!document.querySelector('.card-flip-face')"),false);assert.equal(await run(`!!document.querySelector(${JSON.stringify(card+' .card-back-design')})`),true);
  await flip();assert.equal((await animations()).length,1);await delay(480);
  // Switching the printed face uses the same animation as turning a card over.
  await run(`(()=>{const n=document.querySelector(${JSON.stringify(card)}),r=n.getBoundingClientRect();n.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Alt',code:'AltLeft',altKey:true,bubbles:true}));[...document.querySelectorAll('#inspector button')].find(b=>b.textContent==='Flip card face').click();document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'Alt',code:'AltLeft',bubbles:true}));})()`);
  assert.equal(await run(`document.querySelector(${JSON.stringify(card)}).dataset.displayFace`),'1');assert.ok((await animations())[0].some(f=>f.includes('rotateY(90deg)')));await delay(480);
  // Rapid reversal leaves the authoritative final tap state and cleans up.
  await tap();await tap();await delay(300);assert.equal(await run(`document.querySelector(${JSON.stringify(card)}).classList.contains('tapped')`),false);
  await flip();await run("document.querySelector('#players [aria-label=\"Control Player 2\"]').click()");assert.equal(await run("!!document.querySelector('.card-flip-face')"),false,'Seat changes discard old visible faces');
  assert.equal(await run("document.querySelector('.player-mat[data-seat=\"0\"] .hand').textContent.includes('Opponent secret')"),false);
  await run("document.querySelector('#players [aria-label=\"Control Player 1\"]').click()");
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await tap();assert.deepEqual(await animations(),[]);assert.equal(await run(`!!document.querySelector(${JSON.stringify(card+' .card-tap-indicator')})`),true);
  await flip();assert.deepEqual(await animations(),[]);await reload();assert.deepEqual(await animations(),[]);assert.equal(await run(`!!document.querySelector(${JSON.stringify(card+' .card-tap-indicator')})`),true);
  assert.deepEqual(errors,[]);console.log('Card motion passed: tap/untap, persistent badge, face flips, redraw continuity, rapid reversal, seat privacy, reduced motion and reload.');win.destroy();app.quit();
 }catch(error){console.error(error);if(errors.length)console.error(errors);app.exit(1);}
}).catch(error=>{console.error(error);app.exit(1);});
