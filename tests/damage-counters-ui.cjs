const {app,BrowserWindow}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
const records=require('./fixtures/commander/oracle/atraxa_praetors_voice.json').cards;
app.setPath('userData',path.join(__dirname,'..','.qa','damage-counters-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),errors=[];
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 const run=code=>win.webContents.executeJavaScript(code,true),click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`),state=()=>run("JSON.parse(localStorage.getItem('commanderLab'))");
 const reload=async()=>{const done=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await done;};
 async function seed(body){await run(`(async()=>{const {newGame,transfer,changeStep}=await import('./engine.mjs'),c=await import('./combat.mjs'),g=newGame(2);g.step=3;g.responseMode='hold';const records=${JSON.stringify(records)},real=(name,id)=>({...structuredClone(records.find(c=>c.name===name)),instance:id,counters:{}}),enter=(card,owner=0)=>{g.players[owner].zones.hand.push(card);transfer(g,card.instance,'battlefield',owner,undefined,{deferTriggers:true});card.summoningSick=false;return card;};${body};localStorage.setItem('commanderLab',JSON.stringify(g));localStorage.setItem('commanderLabHandSeat','0');})()`);await reload();}
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});
  await seed("const source=enter({instance:'source',name:'Wither lifelink',type_line:'Creature',power:'3',toughness:'10',oracle_text:'Wither, lifelink',counters:{}}),target=enter({instance:'target',name:'Blocker',type_line:'Creature',power:'1',toughness:'12',oracle_text:'',counters:{}},1);enter(real('Vorinclex, Monstrous Raider','double'));enter(real('Winding Constrictor','add'),1);changeStep(g,4);changeStep(g,5);c.setAttacker(g,source.instance,'player:1');c.confirmAttackers(g);changeStep(g,6);c.setBlocker(g,1,target.instance,source.instance);c.confirmBlockers(g,1)");
  assert.match(await run("document.querySelector('#combat-preview').textContent"),/replacement order/);assert.equal(await run("document.querySelector('#combat-to-damage').disabled"),false);
  await click('#combat-to-damage');await click('#combat-apply-damage');let g=await state();assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.pendingEffect.owner,1);assert.equal(g.players[0].life,40);assert.deepEqual(g.players[1].zones.battlefield.find(c=>c.instance==='target').counters,{});assert.equal(g.combat.normalDone,false);
  await reload();await run("[...document.querySelectorAll('[data-counter-replacement]')].find(b=>b.textContent.includes('Winding')).click()");
  g=await state();assert.equal(g.pendingEffect,undefined);assert.equal(g.players[0].life,43);assert.equal(g.players[1].zones.battlefield.find(c=>c.instance==='target').counters['-1/-1'],8);assert.equal(g.players[0].zones.battlefield.find(c=>c.instance==='source').markedDamage,1);assert.equal(g.combat.normalDone,true);
  await reload();assert.equal((await state()).players[0].life,43);
  await seed("const a=enter(real('Bloated Contaminator','toxic'));enter(real('Vorinclex, Monstrous Raider','double'));changeStep(g,4);changeStep(g,5);c.setAttacker(g,a.instance,'player:1');c.confirmAttackers(g);changeStep(g,6);c.confirmBlockers(g,1);changeStep(g,7)");
  await click('#combat-apply-damage');g=await state();assert.equal(g.players[1].life,36);assert.equal(g.players[1].poison,2);assert.equal(g.stack.length,1);assert.match(g.stack[0].text,/proliferate/i);
  assert.deepEqual(errors,[]);console.log('Damage-counter UI passed: uncertain preview remains playable, affected-seat replacement choice/reload, simultaneous lifelink/damage/counters, no replay and toxic response trigger.');
 }catch(error){console.error(error,errors);process.exitCode=1;}
 finally{win.destroy();app.exit(process.exitCode||0);}
}).catch(error=>{console.error(error);app.exit(1);});
