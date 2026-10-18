const {app,BrowserWindow}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
const records=[...require('./fixtures/commander/oracle/atraxa_praetors_voice.json').cards,...require('./fixtures/playtest-decks/jace.json').cards];
app.setPath('userData',path.join(__dirname,'..','.qa','entry-copy-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),errors=[];
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 const run=code=>win.webContents.executeJavaScript(code,true),click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`),state=()=>run("JSON.parse(localStorage.getItem('commanderLab'))");
 const reload=async()=>{const done=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await done;};
 async function seed(body){
  await run(`(async()=>{const {newGame,transfer,changeStep}=await import('./engine.mjs'),{enterPermanents}=await import('./oracle-effects.mjs'),g=newGame(2);g.step=3;g.responseMode='hold';const records=${JSON.stringify(records)},real=(name,id)=>({...structuredClone(records.find(c=>c.name===name)),instance:id,counters:{}}),enter=(c,owner=0)=>{g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;},stage=c=>{g.players[0].zones.hand.push(c);enterPermanents(g,{owner:0,name:c.name,source:c},[{id:c.instance,owner:0}]);};${body};localStorage.setItem('commanderLab',JSON.stringify(g));localStorage.setItem('commanderLabHandSeat','0');})()`);await reload();
 }
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});
  await seed("enter(real('Doubling Season','double'));enter(real(\"Lae'zel, Vlaakith's Champion\",'add'));enter(real('Ichormoon Gauntlet','gauntlet'));enter(real('Teferi, Hero of Dominaria','source'));stage(real('Spark Double','spark'))");
  assert.equal((await state()).pendingEffect.entryKind,'copy');assert.equal(await run("document.querySelector('#board-target-picker').hidden"),false);
  assert.equal(await run("[...document.querySelectorAll('#board-target-picker button')].some(b=>b.textContent==='Cancel')"),false);
  assert.equal(await run("!!document.querySelector('.player-mat [data-card=source].board-target-valid')"),true);
  await reload();await click('.player-mat [data-card=source]');await click('#board-target-picker .board-pick-confirm');
  assert.equal((await state()).pendingEffect.kind,'counter-choice');assert.equal(await run("document.querySelector('.player-mat [data-card=spark][data-card-zone=battlefield]')"),null);
  await run("[...document.querySelectorAll('[data-counter-replacement]')].find(b=>b.textContent.includes('Lae')).click()");
  let g=await state(),spark=g.players[0].zones.battlefield.find(c=>c.instance==='spark');assert.equal(spark.counters.loyalty,12);
  assert.equal(await run("document.querySelector('.player-mat [data-card=spark]').title"),'Teferi, Hero of Dominaria');
  assert.equal(await run("document.querySelectorAll('.player-mat [data-card=spark] [data-granted-by]').length"),2);
  await reload();assert.equal(await run("document.querySelector('.player-mat [data-card=spark]').title"),'Teferi, Hero of Dominaria');

  await seed("enter({instance:'mana-source',name:'Mana creature',type_line:'Creature',power:'2',toughness:'2',oracle_text:'{T}: Add {G}.',counters:{}});stage(real('Cursed Mirror','mirror'))");
  await click('.player-mat [data-card=mana-source]');await click('#board-target-picker .board-pick-confirm');
  assert.equal(await run("document.querySelector('.player-mat [data-card=mirror]').title"),'Mana creature');
  await click('.player-mat [data-card=mirror]');await run("document.querySelector('.player-mat [data-card=mirror]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))");
  g=await state();assert.equal(g.players[0].mana[0].type,'G');assert.equal(g.players[0].zones.battlefield.find(c=>c.instance==='mirror').tapped,true);
  await click('#steps button:nth-child(12)');assert.equal(await run("document.querySelector('.player-mat [data-card=mirror]').title"),'Cursed Mirror');
  assert.equal((await state()).players[0].zones.battlefield.find(c=>c.instance==='mirror').copyEffects,undefined);

  await seed("const hidden=enter({instance:'hidden-source',name:'Private identity',type_line:'Creature',power:'8',toughness:'8',oracle_text:'Flying',counters:{}},1);hidden.faceDown=true;stage(real('Cursed Mirror','hidden-copy'))");
  await click('.player-mat [data-card=hidden-source]');assert.equal(await run("document.querySelector('#board-target-picker').textContent.includes('Private identity')"),false);await click('#board-target-picker .board-pick-confirm');
  assert.equal(await run("document.querySelector('.player-mat [data-card=hidden-copy]').title"),'Face-down creature');

  await seed("stage(real('Spark Double','decline'))");assert.match(await run("document.querySelector('#board-target-picker .board-pick-confirm').textContent"),/without copying/);await click('#board-target-picker .board-pick-confirm');
  assert.equal((await state()).players[0].zones.graveyard[0].name,'Spark Double');assert.equal((await state()).pendingEffect,undefined);
  assert.deepEqual(errors,[]);console.log('As-enters copy UI passed: board choices, reload, mandatory confirmation, counter replacement, loyalty grants, copied mana/haste and cleanup restoration.');
 }catch(error){console.error(error,errors);process.exitCode=1;}
 finally{win.destroy();app.exit(process.exitCode||0);}
}).catch(error=>{console.error(error);app.exit(1);});
