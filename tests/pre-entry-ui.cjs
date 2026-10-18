const {app,BrowserWindow}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
const records=[...require('./fixtures/commander/oracle/atraxa_praetors_voice.json').cards,...require('./fixtures/playtest-decks/atraxa.json').cards];
app.setPath('userData',path.join(__dirname,'..','.qa','pre-entry-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),errors=[];
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 const run=code=>win.webContents.executeJavaScript(code,true),click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`),state=()=>run("JSON.parse(localStorage.getItem('commanderLab'))");
 const reload=async()=>{const done=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await done;};
 async function seed(body){
  await run(`(async()=>{const {newGame,transfer}=await import('./engine.mjs'),{enterPermanents}=await import('./oracle-effects.mjs'),{createTokenCopies}=await import('./tokens.mjs'),g=newGame(2);g.step=3;g.responseMode='hold';const records=${JSON.stringify(records)},real=(name,id)=>({...structuredClone(records.find(c=>c.name===name)),instance:id,counters:{}}),enter=(c,owner=0)=>{g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;},variable=(id,extra={})=>({instance:id,name:id,type_line:'Creature',power:'0',toughness:'0',oracle_text:'This creature enters with that many +1/+1 counters on it.',counters:{},...extra});${body};localStorage.setItem('commanderLab',JSON.stringify(g));localStorage.setItem('commanderLabHandSeat','0');})()`);await reload();
 }
 const values=answer=>run(`for(const [key,value] of Object.entries(${JSON.stringify(answer)}))document.querySelector('#entry-fields [data-choice="'+key+'"]').value=value;document.getElementById('entry-form').requestSubmit()`);
 const replacement=()=>run("[...document.querySelectorAll('[data-counter-replacement]')].find(b=>b.textContent.includes('Lae')).click()");
 const selectOrder=(id,kind)=>run(`(()=>{const select=document.querySelector('dialog[open] [data-entry-order]');select.value=[...select.options].find(o=>o.dataset.entryCard===${JSON.stringify(id)}&&o.dataset.entryKind===${JSON.stringify(kind)}).value;select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});
  await seed("enter(real('Doubling Season','double'));enter(real(\"Lae'zel, Vlaakith's Champion\",'add'));const c=variable('chosen',{power:'*',toughness:'*'});g.players[0].zones.hand=[c];enterPermanents(g,{owner:0,name:'Variable entry',source:{instance:'entry',name:'Entry'}},[{id:c.instance,owner:0}])");
  assert.equal(await run("document.getElementById('entry-dialog').open"),true);assert.equal(await run("document.getElementById('entry-later').disabled"),true);assert.equal((await state()).players[0].zones.battlefield.length,2);
  await values({power:7,toughness:8,'counter:+1/+1':3});assert.equal((await state()).pendingEffect.kind,'counter-choice');await reload();await replacement();
  let g=await state(),c=g.players[0].zones.battlefield.find(c=>c.instance==='chosen');assert.deepEqual(c.battlefieldStats,{face:0,power:7,toughness:8});assert.equal(c.counters['+1/+1'],8);assert.equal(c.entryChoices,undefined);assert.equal(g.pendingEffect,undefined);

  await seed("enter(real('Doubling Season','double'));enter(real(\"Lae'zel, Vlaakith's Champion\",'add'));const source=enter(variable('source'));delete source.entryChoices;source.counters={'+1/+1':9};createTokenCopies(g,0,source)");
  assert.equal((await state()).pendingEffect.entries.length,2);await values({'counter:+1/+1':3});assert.equal((await state()).players[0].zones.battlefield.filter(c=>c.token).length,0);await reload();await values({'counter:+1/+1':4});
  assert.equal((await state()).pendingEffect.kind,'counter-choice');await replacement();assert.equal((await state()).players[0].zones.battlefield.filter(c=>c.token).length,0);await replacement();
  assert.deepEqual((await state()).players[0].zones.battlefield.filter(c=>c.token).map(c=>c.counters['+1/+1']),[8,10]);

  await seed("g.players[0].life=3;g.players[0].zones.hand=[real('Hallowed Fountain','shock')]");await click('#dock-items [data-card=shock]');
  g=await state();assert.equal(g.pendingEffect.kind,'entry-choice');assert.equal(g.players[0].zones.battlefield.length,0);assert.equal(g.players[0].landsPlayed,1);await reload();await click('#entry-life-pay');
  g=await state();assert.equal(g.players[0].life,1);assert.equal(g.players[0].zones.battlefield[0].tapped,false);assert.equal(g.pendingEffect,undefined);await reload();assert.equal((await state()).players[0].life,1);
  await seed("g.players[0].life=1;g.players[0].zones.hand=[real('Breeding Pool','poor')]");await click('#dock-items [data-card=poor]');assert.equal(await run("document.getElementById('entry-life-pay').disabled"),true);await click('#entry-life-tapped');assert.equal((await state()).players[0].zones.battlefield[0].tapped,true);

  await seed("const c=real('Breeding Pool','condition');c.oracle_text+='\\nThis land enters tapped unless you control a silver-bordered permanent.';g.players[0].zones.hand=[c]");await click('#dock-items [data-card=condition]');
  assert.equal((await state()).players[0].zones.battlefield.length,0);await click('#entry-condition-untapped');await reload();await click('#entry-life-pay');g=await state();assert.equal(g.players[0].zones.battlefield[0].tapped,false);assert.equal(g.players[0].life,38);assert.equal(g.pendingEffect,undefined);
  await seed("enter(real('Doubling Season','double'));enter(real(\"Lae'zel, Vlaakith's Champion\",'add'));const c=variable('first'),land=real('Hallowed Fountain','last');g.players[0].life=3;g.players[0].zones.hand=[c,land];enterPermanents(g,{owner:0,name:'Batch',source:{instance:'batch',name:'Batch'}},[{id:c.instance,owner:0},{id:land.instance,owner:0}])");
  assert.equal(await run("document.getElementById('entry-dialog').open"),true);await selectOrder('last','life');assert.equal((await state()).pendingEffect.entryKind,'life');await reload();await click('#entry-life-pay');
  assert.equal((await state()).players[0].life,1);assert.equal((await state()).players[0].zones.battlefield.length,2);await values({'counter:+1/+1':3});await replacement();g=await state();assert.equal(g.players[0].zones.battlefield.find(c=>c.instance==='last').tapped,false);assert.equal(g.players[0].zones.battlefield.find(c=>c.instance==='first').counters['+1/+1'],8);

  await seed("const c=real('Breeding Pool','life-first');c.oracle_text+='\\nThis land enters tapped unless you control a silver-bordered permanent.';g.players[0].zones.hand=[c]");await click('#dock-items [data-card=life-first]');await selectOrder('life-first','life');
  assert.match(await run("document.getElementById('entry-life-pay').textContent"),/finish the entry condition/);await click('#entry-life-pay');await reload();await click('#entry-condition-untapped');g=await state();assert.equal(g.players[0].zones.battlefield[0].tapped,false);assert.equal(g.players[0].life,38);assert.equal(g.pendingEffect,undefined);
  assert.deepEqual(errors,[]);console.log('Pre-entry UI passed: values, token/counter choices, life/conditions, choosing a different pending decision across dialog types, saved selection and no replayed payments.');
 }catch(error){console.error(error,errors);process.exitCode=1;}
 finally{win.destroy();app.exit(process.exitCode||0);}
}).catch(error=>{console.error(error);app.exit(1);});
