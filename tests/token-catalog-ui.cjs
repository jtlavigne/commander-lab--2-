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
 const run=async code=>{try{return await win.webContents.executeJavaScript(code,true);}catch(error){throw new Error('Renderer check failed: '+code.slice(0,180),{cause:error});}},state=()=>run("JSON.parse(localStorage.getItem('commanderLab'))");
 const wait=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out');};
 const reload=async()=>{const loaded=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await loaded;};
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
  // Copy a real permanent through the card menu, then use the new token's
  // ability through the same controls as an ordinary card after reloading.
  await run(`(async()=>{const {newGame,transfer}=await import('./engine.mjs'),g=newGame(2);g.step=3;g.responseMode='hold';const source={instance:'copy-source',name:'Copyable rock',type_line:'Artifact',mana_cost:'{2}',oracle_text:'{T}: Add {G}.',counters:{},localImages:['data:image/png;base64,${png.toString('base64')}']};g.players[0].zones.hand=[source];transfer(g,source.instance,'battlefield',0);g.players[1].zones.battlefield=[{instance:'opponent-creature',name:'Opponent creature',type_line:'Creature',power:'2',toughness:'2',oracle_text:'Flying',counters:{}}];g.players[0].tokenCatalog=[{tokenTemplate:true,name:'Copy',type_line:'Token',oracle_text:"This token can represent a copy of a permanent."}];localStorage.setItem('commanderLab',JSON.stringify(g));})()`);
  await reload();
  await wait(async()=>await run("!!document.querySelector('.battlefield [data-card=copy-source] .card-actions-toggle')"));
  await run("document.querySelector('.battlefield [data-card=copy-source] .card-actions-toggle').click();document.querySelector('#card-actions-menu [data-action=copy-token]').click()");
  assert.equal(await run("document.getElementById('token-template').value"),'copy:copy-source');assert.equal(await run("[...document.getElementById('token-template').options].some(o=>o.value==='0')"),false);
  await run("document.getElementById('token-count').value=2;document.getElementById('token-form').requestSubmit()");
  g=await state();const copy=g.players[0].zones.battlefield.find(c=>c.token);assert.equal(g.players[0].zones.battlefield.length,3);assert.equal(copy.oracle_text,'{T}: Add {G}.');assert.deepEqual(copy.localImages,g.players[0].zones.battlefield[0].localImages);
  await reload();
  await wait(async()=>await run(`!!document.querySelector('.battlefield [data-card="${copy.instance}"] .card-actions-toggle')`));
  await run(`document.querySelector('.battlefield [data-card="${copy.instance}"] .card-actions-toggle').click();document.querySelector('#card-actions-menu [data-action=mana]').click();document.querySelector('#mana-dialog .mana-option').click()`);
  g=await state();assert.equal(g.players[0].mana[0].type,'G');assert.equal(g.players[0].zones.battlefield.find(c=>c.instance===copy.instance).tapped,true);
  await run("document.getElementById('token').click();document.getElementById('token-template').value='copy:opponent-creature';document.getElementById('token-template').onchange();document.getElementById('token-count').value=1;document.getElementById('token-form').requestSubmit()");
  g=await state();assert.equal(g.players[0].zones.battlefield.at(-1).oracle_text,'Flying');assert.equal(g.players[1].zones.battlefield.length,1);assert.deepEqual(errors,[]);
  console.log('Token UI passed: import/cache, reserves, art, card-menu copies, copied activation after reload and copying an opponent permanent.');win.destroy();app.quit();
 }catch(error){console.error(error);win.destroy();app.exit(1);}
});
