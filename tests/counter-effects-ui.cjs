/* Actual renderer controls for saved counter replacement/proliferate choices. */
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const records=require('./fixtures/commander/oracle/atraxa_praetors_voice.json').cards;
const examples=require('./fixtures/spell-resolution.json').cards;
app.setPath('userData',path.join(__dirname,'..','.qa','counter-effects-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false,offscreen:true}}),errors=[];
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 const run=s=>win.webContents.executeJavaScript(s,true),click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`),state=()=>run("JSON.parse(localStorage.getItem('commanderLab'))");
 const reload=async()=>{const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;};
 const pass=async()=>{for(let i=0;i<4;i++)await click('#play-priority-controls [data-priority-pass]');};
 async function seed(body){await run(`(async()=>{const {newGame,transfer}=await import('./engine.mjs');const g=newGame(4);g.step=3;g.responseMode='hold';const records=${JSON.stringify([...records,...examples])},c=(name,instance)=>({...structuredClone(records.find(c=>c.name===name)),instance,counters:{}}),enter=(name,id,owner=0)=>{const card=c(name,id);g.players[owner].zones.hand.push(card);transfer(g,id,'battlefield',owner);return card;};g.players[0].zones.library=[c('Forest','Draw')];g.players[0].mana=[{type:'U',amount:2}];${body};localStorage.setItem('commanderLab',JSON.stringify(g));localStorage.setItem('commanderLabHandSeat','0');})()`);await reload();}
 const apply=()=>run("[...document.querySelectorAll('#mana-dialog button')].find(b=>b.textContent.startsWith('Apply selected')).click()");
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});
  await seed("enter('Doubling Season','Season');const target=enter('Winding Constrictor','Snake');target.counters={charge:1,oil:1};enter('Tekuthal, Inquiry Dominus','Tekuthal');g.players[0].zones.hand=[c('Contentious Plan','Plan')]");
  await click('#dock-items [data-card=Plan]');await click('#cast-confirm');await pass();assert.equal((await state()).pendingEffect.kind,'proliferate');await click('#mana-dialog input[data-card=Snake]');await apply();assert.equal((await state()).pendingEffect.kind,'counter-choice');assert.equal(await run("document.querySelectorAll('[data-counter-replacement]').length"),2);assert.deepEqual((await state()).players[0].zones.battlefield.find(c=>c.instance==='Snake').counters,{charge:1,oil:1});await reload();assert.equal((await state()).pendingEffect.kind,'counter-choice');await click('[data-counter-replacement="Snake:0"]');assert.equal((await state()).pendingEffect.kind,'proliferate');assert.deepEqual((await state()).players[0].zones.battlefield.find(c=>c.instance==='Snake').counters,{charge:5,oil:5});assert.equal((await state()).players[0].zones.hand.length,0);await apply();assert.equal((await state()).pendingEffect,undefined);assert.equal((await state()).players[0].zones.hand[0].instance,'Draw');assert.equal((await state()).stack.length,0);
  // Loyalty counter replacements are activation costs, not resolved effects.
  await seed("enter(\"Elspeth, Sun's Champion\",'Walker');enter('Vorinclex, Monstrous Raider','Vorinclex');enter(\"Lae'zel, Vlaakith's Champion\",'Laezel')");
  const before=(await state()).players[0].zones.battlefield.find(c=>c.instance==='Walker').counters.loyalty;
  await click('.battlefield [data-card=Walker] .card-loyalty-ability');assert.equal((await state()).pendingEffect.kind,'counter-choice');assert.equal((await state()).stack.length,1);
  await reload();const add=await run("[...document.querySelectorAll('[data-counter-replacement]')].find(b=>b.textContent.includes(\"Lae'zel\")).dataset.counterReplacement");await click('[data-counter-replacement="'+add+'"]');
  assert.equal((await state()).pendingEffect,undefined);assert.equal((await state()).players[0].zones.battlefield.find(c=>c.instance==='Walker').counters.loyalty,before+4);assert.equal((await state()).players[0].zones.battlefield.filter(c=>c.token).length,0);await pass();assert.equal((await state()).players[0].zones.battlefield.filter(c=>c.token).length,3);
  // A distributed counter cost and Phyrexian payment are chosen before priority.
  await seed("enter('Tekuthal, Inquiry Dominus','Tekuthal');enter(\"Elspeth, Sun's Champion\",'Donor').counters.loyalty=3;g.players[0].mana=[{type:'C',amount:1}]");
  await click('.battlefield [data-card=Tekuthal] .card-actions-toggle');await click('#card-actions-menu [data-action=mana]');await click('#mana-dialog [data-ability="action:2"]');
  assert.equal(await run("document.getElementById('activation-confirm').disabled"),true);assert.equal(await run("document.getElementById('activation-phyrexian-life').checked"),true);
  await run("const input=document.querySelector('[data-counter-cost-card=Donor]');input.value='3';input.dispatchEvent(new Event('input'))");
  assert.equal(await run("document.getElementById('activation-confirm').disabled"),false);assert.match(await run("document.getElementById('activation-cost-summary').textContent"),/Pay 4 life/);
  // Capture the actual offscreen paint rather than racing capturePage against
  // Chromium's compositor after resizing a hidden window.
  const screenshot=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{win.webContents.removeListener('paint',paint);reject(new Error('Counter dialog did not paint'));},5000);function paint(_event,_dirty,image){clearTimeout(timer);resolve(image);}win.webContents.once('paint',paint);win.webContents.invalidate();});
  await fs.writeFile(path.join(__dirname,'..','.qa','tekuthal-cost.png'),screenshot.toPNG());
  await click('#activation-confirm');assert.equal((await state()).players[0].life,36);assert.ok((await state()).players[0].zones.graveyard.some(c=>c.instance==='Donor'));assert.equal((await state()).players[0].zones.battlefield.find(c=>c.instance==='Tekuthal').counters.indestructible,undefined);
  await reload();assert.equal((await state()).stack.length,1);await pass();assert.equal((await state()).players[0].zones.battlefield.find(c=>c.instance==='Tekuthal').counters.indestructible,1);
  // Compleated reads the saved casting payment only when the spell resolves.
  for(const [name,mana,expected] of [["Tamiyo, Compleated Sage",[{type:'C',amount:2},{type:'G',amount:1},{type:'U',amount:1}],3],["Vraska, Betrayal's Sting",[{type:'C',amount:4},{type:'B',amount:1}],4]]){
   await seed(`g.players[0].zones.hand=[c(${JSON.stringify(name)},'Compleated')];g.players[0].mana=${JSON.stringify(mana)}`);
   await click('#dock-items [data-card=Compleated]');assert.equal(await run("document.getElementById('cast-life').checked"),true);await click('#cast-confirm');assert.equal((await state()).players[0].life,38);assert.equal((await state()).stack[0].castPayment.phyrexianLife,2);assert.equal((await state()).players[0].zones.battlefield.length,0);
   await reload();await pass();assert.equal((await state()).players[0].zones.battlefield[0].counters.loyalty,expected);assert.equal(await run("document.querySelector('.battlefield [data-card=Compleated] .card-loyalty-overlay').textContent"),String(expected));assert.equal(await run("document.getElementById('entry-dialog').open"),false);
  }
  // The spell's controller stays in its context while the affected player
  // receives the choice and the pinned hand switches for local hotseat play.
  await seed("enter('Vorinclex, Monstrous Raider','Vorinclex');enter('Winding Constrictor','OpponentSnake',1);g.players[0].zones.hand=[c('Prologue to Phyresis','Prologue')]");await click('#dock-items [data-card=Prologue]');await click('#cast-confirm');await pass();assert.equal((await state()).pendingEffect.owner,1);assert.equal(await run("document.getElementById('dock-player').value"),'1');assert.equal((await state()).players[1].poison,0);assert.equal((await state()).players[2].poison,0);await click('[data-counter-replacement="OpponentSnake:1"]');assert.equal((await state()).players[1].poison,4);assert.equal((await state()).players[2].poison,2);assert.equal((await state()).players[3].poison,2);assert.equal((await state()).players[0].zones.hand[0].instance,'Draw');assert.equal((await state()).pendingEffect,undefined);assert.deepEqual(errors,[]);console.log('Counter UI passed: loyalty cost order before responses, replacement order, saved choices, independent doubled proliferates, delayed draw, and affected-player hotseat handoff.');win.destroy();app.quit();
 }catch(e){console.error(e);console.error(errors);console.error(await run("({status:document.getElementById('status').textContent,dialog:document.getElementById('mana-dialog').textContent})"));app.exit(1);}
}).catch(e=>{console.error(e);app.exit(1);});
