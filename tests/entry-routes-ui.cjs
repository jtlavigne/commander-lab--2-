const {app,BrowserWindow}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
const records=[...require('./fixtures/commander/oracle/atraxa_praetors_voice.json').cards,...require('./fixtures/playtest-decks/jace.json').cards];
app.setPath('userData',path.join(__dirname,'..','.qa','entry-routes-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1500,height:960,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),errors=[];
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('Electron Security Warning'))errors.push(event.message);});
 const run=async code=>{try{return await win.webContents.executeJavaScript(code,true);}catch(error){throw new Error('Renderer step failed: '+code.slice(0,160),{cause:error});}};
 const click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`),state=()=>run("JSON.parse(localStorage.getItem('commanderLab'))");
 const reload=async()=>{const done=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await done;};
 const pass=async()=>{for(let i=0;i<2;i++)await click('#play-priority-controls [data-priority-pass]');};
 const replacement=name=>run(`[...document.querySelectorAll('[data-counter-replacement]')].find(b=>b.textContent.includes(${JSON.stringify(name)})).click()`);
 async function seed(body){
  await run(`(async()=>{const {newGame,transfer,changeStep}=await import('./engine.mjs'),{applyOracleEffect}=await import('./oracle-effects.mjs'),{activateMana,resolveTop}=await import('./casting.mjs'),{activatedAbilities,addMana}=await import('./mana.mjs'),g=newGame(2);g.step=3;g.responseMode='hold';const records=${JSON.stringify(records)},real=(name,id)=>({...structuredClone(records.find(c=>c.name===name)),instance:id,counters:{}}),enter=(c,owner=0)=>{g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;},creature=id=>({instance:id,name:id,type_line:'Creature',power:'0',toughness:'0',oracle_text:'This creature enters with two +1/+1 counters on it.',counters:{}});${body};localStorage.setItem('commanderLab',JSON.stringify(g));localStorage.setItem('commanderLabHandSeat','0');})()`);await reload();
 }
 try{
  await win.webContents.session.clearStorageData();await win.loadFile(path.join(__dirname,'..','index.html'),{hash:'table'});
  // Choose a land through the private search list, then resume entry ordering
  // after reloading. The later draw cannot run while this choice is pending.
  await seed("enter(real('Doubling Season','double'));enter(real('Vorinclex, Monstrous Raider','half'),1);g.players[0].zones.library=[real('Blast Zone','land'),real('Forest','forest'),real('Island','island')];g.players[0].zones.hand=[{instance:'search',name:'Search then draw',type_line:'Sorcery',mana_cost:'{0}',oracle_text:'Search your library for a land card, put it onto the battlefield tapped, then shuffle. Draw a card.',counters:{}}]");
  await click('#dock-items [data-card=search]');await click('#cast-confirm');await pass();await click('#mana-dialog input[data-choice=land]');await click('#oracle-confirm');
  assert.equal((await state()).pendingEffect.kind,'counter-choice');assert.equal((await state()).players[0].zones.hand.length,0);assert.equal((await state()).players[0].zones.library.length,3);await reload();await replacement('Doubling Season');
  let g=await state();assert.equal(g.players[0].zones.battlefield.find(c=>c.instance==='land').counters.charge,1);assert.equal(g.players[0].zones.battlefield.find(c=>c.instance==='land').tapped,true);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.players[0].zones.library.length,1);assert.equal(g.pendingEffect,undefined);

  // The delayed trigger remains responseable; its counter choices belong to
  // the returning owner even when another seat controlled the blink effect.
  await seed("enter(real('Doubling Season','double'),1);enter(real(\"Lae'zel, Vlaakith's Champion\",'add'),1);const visitor=enter({...creature('visitor'),ownerSeat:1}),oath=enter(real('Oath of Teferi','oath'));applyOracleEffect(g,{owner:0,name:oath.name,source:oath,text:real('Oath of Teferi','text').oracle_text.split('\\n')[0].replace(/^When Oath of Teferi enters, /,'').replace(/^exile/,'Exile'),targets:[{kind:'card',id:visitor.instance,owner:0,battlefieldId:visitor.battlefieldId}]});transfer(g,oath.instance,'graveyard',0);changeStep(g,10)");
  assert.equal((await state()).stack.length,1);await pass();assert.equal((await state()).pendingEffect.owner,1);assert.equal((await state()).players[1].zones.exile[0].instance,'visitor');await reload();await replacement('Lae');g=await state();assert.equal(g.players[1].zones.battlefield.find(c=>c.instance==='visitor').counters['+1/+1'],6);assert.equal(g.pendingEffect,undefined);

  // Actual Proteus Staff resolution: public reveal, saved entry ordering, then
  // ordering the remainder through the same focus controls as a normal search.
  await seed("enter(real('Doubling Season','double'));enter(real(\"Lae'zel, Vlaakith's Champion\",'add'));const staff=enter(real('Proteus Staff','staff')),victim=enter({...creature('victim'),power:'1',toughness:'1',oracle_text:''});g.players[0].zones.library=[real('Island','first'),real('Sol Ring','second'),creature('hit'),real('Plains','rest')];addMana(g.players[0],{U:1,C:2});activateMana(g,staff.instance,activatedAbilities(g,0,staff).find(a=>!a.output).id,{targets:['card:'+victim.instance]});resolveTop(g)");
  assert.equal((await state()).pendingEffect.step.op,'polymorphReveal');await click('#oracle-confirm');assert.equal((await state()).pendingEffect.kind,'counter-choice');await reload();await replacement('Lae');assert.equal((await state()).pendingEffect.step.op,'orderBottomLibrary');await click('#mana-dialog input[data-choice=second]');await click('#mana-dialog input[data-choice=first]');await click('#oracle-confirm');g=await state();assert.deepEqual(g.players[0].zones.library.map(c=>c.instance),['rest','victim','second','first']);assert.equal(g.players[0].zones.battlefield.find(c=>c.instance==='hit').counters['+1/+1'],6);assert.equal(g.pendingEffect,undefined);
  assert.deepEqual(errors,[]);console.log('Entry routes UI passed: library search before shuffle/draw, delayed owner-return responses, public polymorph reveal, entry choices and ordered remainder across reload.');win.destroy();app.quit();
 }catch(error){console.error(error,errors);win.destroy();app.exit(1);}
});
