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
  const xSpell=cards.find(c=>c.name==="White Sun's Twilight");
  await run(`(async()=>{const {createEmblem}=await import('./rule-sources.mjs'),{addMana}=await import('./mana.mjs'),g=JSON.parse(localStorage.getItem('commanderLab'));createEmblem(g,0,{name:'Tamiyo, Field Researcher'},'You may cast spells from your hand without paying their mana costs.');g.players[0].zones.hand=[{...${JSON.stringify(xSpell)},id:undefined,instance:'x-spell',counters:{},face:0}];addMana(g.players[0],{W:10});localStorage.setItem('commanderLab',JSON.stringify(g));})()`);await reload();
  assert.ok(await run("[...document.querySelectorAll('.emblem-status')].some(n=>n.textContent.includes('Tamiyo'))"));
  await run("document.querySelector('#dock-items [data-card=\"x-spell\"]').click()");
  assert.equal(await run("document.getElementById('cast-free-emblem').checked"),true);
  await run("document.getElementById('cast-x').value='3';document.getElementById('cast-x').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await run("document.getElementById('cast-confirm').disabled"),true);
  await run("document.getElementById('cast-free-emblem').click()");assert.equal(await run("document.getElementById('cast-confirm').disabled"),false);
  await run("document.getElementById('cast-confirm').click()");const cast=await run("JSON.parse(localStorage.getItem('commanderLab'))");assert.equal(cast.stack.at(-1).castX,3);assert.equal(cast.players[0].mana.reduce((sum,lot)=>sum+lot.amount,0),5);assert.deepEqual(errors,[]);
  await run(`(async()=>{const {newGame,transfer}=await import('./engine.mjs'),{applyOracleEffect}=await import('./oracle-effects.mjs'),g=newGame(2);g.step=3;g.responseMode='hold';const source={name:'Identity Echo',instance:'echo',type_line:'Enchantment',oracle_text:'',counters:{}},victim={name:'Soldier',instance:'victim',type_line:'Token Creature',token:true,power:'1',toughness:'1',oracle_text:'',counters:{}};g.players[0].zones.hand.push(victim);transfer(g,victim.instance,'battlefield',0);g.players[0].zones.library=[{name:'Island',instance:'peek-land',type_line:'Basic Land',oracle_text:'',counters:{}},{name:'Revealed creature',instance:'peek-hit',type_line:'Creature',power:'3',toughness:'3',oracle_text:'',counters:{}}];applyOracleEffect(g,{owner:0,name:source.name,source,targets:[{kind:'card',id:victim.instance,owner:0,zone:'battlefield',battlefieldId:victim.battlefieldId,zoneChangeId:victim.zoneChangeId}],text:'Exile target creature or planeswalker you control. Reveal cards from the top of your library until you reveal a creature or planeswalker card. Put that card onto the battlefield and the rest on the bottom of your library in a random order.'});localStorage.setItem('commanderLab',JSON.stringify(g));})()`);await reload();
  assert.equal(await run("document.querySelectorAll('#mana-dialog .oracle-card-choices .card').length"),2);
  assert.ok(await run("document.getElementById('mana-dialog').textContent.includes('revealed to everyone')"));
  await run("document.getElementById('oracle-confirm').click()");assert.equal(await run("JSON.parse(localStorage.getItem('commanderLab')).players[0].zones.battlefield[0].instance"),'peek-hit');assert.deepEqual(errors,[]);
  console.log('Exact-deck Electron passed: inherited loyalty, private Jace choice, emblem payment controls and persisted public polymorph reveal.');win.destroy();app.quit();
 }catch(error){console.error(error);win.destroy();app.exit(1);}
});
