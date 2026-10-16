// Isolated renderer checks for mandatory non-targeted keyword choices.
const {app,BrowserWindow}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
app.setPath('userData',path.join(__dirname,'..','.qa','keyword-actions-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1440,height:960,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),errors=[];
 win.webContents.on('console-message',(_event,level,message)=>{if(level>=2&&!message.includes('Electron Security Warning'))errors.push(message);});
 const run=code=>win.webContents.executeJavaScript(code,true),reload=async()=>{const done=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await done;};
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});
  await run(`(async()=>{const {newGame,transfer}=await import('./engine.mjs'),{applyOracleEffect}=await import('./oracle-effects.mjs');const g=newGame(2);g.step=3;g.responseMode='hold';for(const [instance,toughness,token] of [['small','1',false],['token','3',true]]){const c={instance,name:instance,type_line:'Creature',power:'1',toughness,oracle_text:'Shroud',counters:{},token};g.players[0].zones.hand.push(c);transfer(g,instance,'battlefield',0,undefined,{deferTriggers:true});}applyOracleEffect(g,{owner:0,name:'Keyword choices',source:{instance:'test',name:'Keyword choices'},text:'Bolster 2. Populate. Investigate.'});localStorage.setItem('commanderLab',JSON.stringify(g));})()`);await reload();
  assert.ok(await run("document.getElementById('mana-dialog').textContent.includes('lowest toughness')"));
  assert.equal(await run("document.querySelectorAll('#mana-dialog input[data-choice]').length"),1);
  assert.equal(await run("document.getElementById('oracle-confirm').disabled"),true);
  await run("document.querySelector('#mana-dialog input[data-choice=small]').click();document.getElementById('oracle-confirm').click()");
  await reload();assert.ok(await run("document.getElementById('mana-dialog').textContent.includes('creature token you control to copy')"));
  assert.equal(await run("document.querySelectorAll('#mana-dialog input[data-choice]').length"),1);
  await run("document.querySelector('#mana-dialog input[data-choice=token]').click();document.getElementById('oracle-confirm').click()");
  const g=await run("JSON.parse(localStorage.getItem('commanderLab'))");assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].zones.battlefield.length,4);assert.equal(g.players[0].zones.battlefield.find(c=>c.instance==='small').counters['+1/+1'],2);assert.equal(g.players[0].zones.battlefield.filter(c=>c.name==='Clue').length,1);assert.deepEqual(errors,[]);
  await run(`(async()=>{const {newGame}=await import('./engine.mjs'),g=newGame(2);g.step=3;g.responseMode='hold';g.players[0].zones.hand=[{instance:'support',name:'Support test',type_line:'Instant',mana_cost:'{0}',oracle_text:'Support 2.',counters:{}}];g.players[1].zones.battlefield=[{instance:'eligible',name:'Eligible',type_line:'Creature',power:'2',toughness:'2',oracle_text:'',counters:{}},{instance:'protected',name:'Protected',type_line:'Creature',power:'2',toughness:'2',oracle_text:'Hexproof',counters:{}}];localStorage.setItem('commanderLab',JSON.stringify(g));})()`);await reload();
  await run("document.querySelector('#dock-items [data-card=support]').click();document.getElementById('cast-pick-targets').click()");
  assert.equal(await run("document.querySelector('.battlefield [data-card=eligible]').classList.contains('board-target-valid')"),true);
  assert.equal(await run("document.querySelector('.battlefield [data-card=protected]').classList.contains('board-target-valid')"),false);
  await run("document.querySelector('.battlefield [data-card=eligible]').click();document.querySelector('#board-target-picker .board-pick-confirm').click();document.getElementById('cast-confirm').click()");
  const cast=await run("JSON.parse(localStorage.getItem('commanderLab'))");assert.equal(cast.stack[0].targets[0].id,'eligible');assert.deepEqual(cast.players[1].zones.battlefield[0].counters,{});assert.deepEqual(errors,[]);
  console.log('Keyword action UI passed: non-targeted choices, mandatory confirmation, saved continuation, Populate, Investigate and Support board targets.');win.destroy();app.quit();
 }catch(error){console.error(error);win.destroy();app.exit(1);}
});
