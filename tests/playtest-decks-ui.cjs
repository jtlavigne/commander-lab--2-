const {app,BrowserWindow}=require('electron'),path=require('node:path'),assert=require('node:assert/strict');
const cards=[...require('./fixtures/playtest-decks/atraxa.json').cards,...require('./fixtures/playtest-decks/jace.json').cards];
app.setPath('userData',path.join(__dirname,'..','.qa','playtest-decks-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),errors=[];
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 const run=async code=>{try{return await win.webContents.executeJavaScript(code,true);}catch(error){console.error(code,errors);throw error;}},reload=async()=>{const done=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await done;};
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});
  const fixture=cards.filter(c=>['Jace, Multiverse Architect','Kasmina, Enigma Sage','Nicol Bolas, Dragon-God'].includes(c.name));
  await run(`(async()=>{const {newGame,transfer}=await import('./engine.mjs'),g=newGame(2);g.step=3;g.responseMode='hold';for(const [i,raw] of ${JSON.stringify(fixture)}.entries()){const c={...raw,id:undefined,instance:'walker'+i,counters:{},face:0};g.players[0].zones.hand.push(c);transfer(g,c.instance,'battlefield',0,undefined,{deferTriggers:true});}g.players[0].zones.library=Array.from({length:8},(_,i)=>({instance:'lib'+i,name:'Land '+i,type_line:'Land',oracle_text:'',counters:{},face:0}));localStorage.setItem('commanderLab',JSON.stringify(g));})()`);await reload();
  assert.ok(await run("[...document.querySelectorAll('.battlefield [data-granted-by]')].some(n=>n.dataset.grantedBy==='Kasmina, Enigma Sage'&&n.textContent.includes('Scry'))"));
  await run(`(async()=>{const {applyOracleEffect}=await import('./oracle-effects.mjs'),g=JSON.parse(localStorage.getItem('commanderLab')),source=g.players[0].zones.battlefield.find(c=>c.name==='Jace, Multiverse Architect');applyOracleEffect(g,{owner:0,name:source.name,source,text:'Draw two cards, then put a card from your hand on the bottom of your library.'});localStorage.setItem('commanderLab',JSON.stringify(g));})()`);await reload();
  assert.ok(await run("document.getElementById('mana-dialog').textContent.includes('1 card(s) for the bottom')"));
  await run("document.querySelector('#mana-dialog input[data-choice=lib0]').click();document.getElementById('oracle-confirm').click()");
  const g=await run("JSON.parse(localStorage.getItem('commanderLab'))");assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].zones.library.at(-1).instance,'lib0');assert.equal(g.players[0].zones.hand[0].instance,'lib1');assert.deepEqual(errors,[]);
  console.log('Exact-deck Electron passed: inherited loyalty buttons, resumed private Jace choice, bottom placement and renderer errors.');win.destroy();app.quit();
 }catch(error){console.error(error);win.destroy();app.exit(1);}
});
