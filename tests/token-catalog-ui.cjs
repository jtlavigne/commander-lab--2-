// Exercise the real preload/import/cache path with deterministic Scryfall data.
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
const fixture=require('./fixtures/token-catalog.json'),{createCardCache}=require('../card-cache.cjs');
app.setPath('userData',path.join(__dirname,'..','.qa','token-catalog-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
 const maker={id:'e4a5cf56-1111-4111-8111-111111111111',name:'Warrior maker',type_line:'Sorcery',oracle_text:'Create two 1/1 green Elf Warrior creature tokens.'},cards=[fixture.cards[0],maker],tokens=[...fixture.tokens,...fixture.warriors];
 const cache=createCardCache({directory:path.join(app.getPath('userData'),'cards'),client:{collection:async names=>({data:structuredClone(cards.filter(c=>names.includes(c.name)))}),byId:async id=>structuredClone(tokens.find(c=>c.id===id)),searchTokens:async()=>structuredClone(fixture.warriors)},fetchImpl:async()=>({ok:true,arrayBuffer:async()=>png})});
 ipcMain.handle('table-get',()=>null);
 ipcMain.handle('cards-batch',(_,names)=>cache.lookupBatch(names));ipcMain.handle('cards-tokens',(_,names)=>cache.lookupTokens(names));ipcMain.handle('cards-by-id',(_,ids)=>cache.lookupIds(ids));
 const win=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{preload:path.join(__dirname,'..','preload.cjs'),contextIsolation:true,sandbox:true,backgroundThrottling:false}}),errors=[];
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 const run=code=>win.webContents.executeJavaScript(code,true),state=()=>run("JSON.parse(localStorage.getItem('commanderLab'))");
 const wait=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out');};
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});
  await run(`document.getElementById('openimport').click();document.getElementById('deck').value=${JSON.stringify("1 Tamiyo, Compleated Sage\n1 Warrior maker")};document.getElementById('import-form').requestSubmit()`);
  await wait(async()=>!await run("document.getElementById('import-dialog').open"));
  let g=await state();assert.equal(g.players[0].tokenCatalog.length,3);assert.equal(g.players[0].zones.hand.length,2);assert.equal(g.players[0].zones.battlefield.length,0);
  await run("document.getElementById('token').click();const s=document.getElementById('token-template');s.value=[...s.options].find(o=>o.text.includes('Elf Warrior')).value;s.onchange();document.getElementById('token-count').value=2;document.getElementById('token-form').requestSubmit()");
  g=await state();assert.equal(g.players[0].zones.battlefield.length,2);assert.equal(g.players[0].tokenCatalog.length,3);assert.equal(g.players[0].zones.battlefield[0].id,fixture.warriors[0].id);
  assert.equal(await run("[...document.querySelectorAll('.battlefield .card img')].filter(n=>n.src.startsWith('data:image/')).length"),2);
  const loaded=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await loaded;
  await wait(async()=>await run("[...document.querySelectorAll('.battlefield .card img')].filter(n=>n.src.startsWith('data:image/')).length===2"));
  assert.equal((await state()).players[0].tokenCatalog.length,3);assert.deepEqual(errors,[]);
  console.log('Token UI passed: real import/cache IPC, hidden reserve, manual copies, correct art and reload hydration.');win.destroy();app.quit();
 }catch(error){console.error(error);win.destroy();app.exit(1);}
});
