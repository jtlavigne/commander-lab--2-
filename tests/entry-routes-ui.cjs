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
 async function seed(body,count=2){
  await run(`(async()=>{const {newGame,transfer,changeStep}=await import('./engine.mjs'),{applyOracleEffect}=await import('./oracle-effects.mjs'),{activateMana,resolveTop}=await import('./casting.mjs'),{activatedAbilities,addMana}=await import('./mana.mjs'),g=newGame(${count});g.step=3;g.responseMode='hold';const records=${JSON.stringify(records)},real=(name,id)=>({...structuredClone(records.find(c=>c.name===name)),instance:id,counters:{}}),enter=(c,owner=0)=>{g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner,undefined,{deferTriggers:true});return c;},creature=id=>({instance:id,name:id,type_line:'Creature',power:'0',toughness:'0',oracle_text:'This creature enters with two +1/+1 counters on it.',counters:{}});${body};localStorage.setItem('commanderLab',JSON.stringify(g));localStorage.setItem('commanderLabHandSeat','0');})()`);await reload();
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
  // Myriad uses the same pre-entry choices and preserves independent
  // doubled-token defenders and counter ordering across reloads.
  await seed("enter(real('Doubling Season','double'));enter(real(\"Lae'zel, Vlaakith's Champion\",'add'));enter({instance:'walker',name:'Defending walker',type_line:'Planeswalker',loyalty:'5',oracle_text:'',counters:{}},2);const source=enter({...creature('myriad'),keywords:['Myriad'],oracle_text:'Myriad\\nThis creature enters with two +1/+1 counters on it.'});source.summoningSick=false;const {setAttacker,confirmAttackers}=await import('./combat.mjs');changeStep(g,5);setAttacker(g,source.instance,'player:1');confirmAttackers(g);resolveTop(g)",3);
  assert.equal((await state()).pendingEffect.step.op,'myriad');
  await click('#mana-dialog input[data-choice="player:2"]');await click('#oracle-confirm');
  assert.equal((await state()).pendingEffect.step.op,'myriadDefenders');
  assert.equal((await state()).players[0].zones.battlefield.filter(c=>c.token).length,0);await reload();
  await click('#mana-dialog input[data-choice="card:walker"]');await click('#oracle-confirm');
  assert.equal((await state()).pendingEffect.kind,'counter-choice');await reload();await replacement('Lae');
  assert.equal((await state()).players[0].zones.battlefield.filter(c=>c.token).length,0);await replacement('Doubling Season');
  g=await state();assert.deepEqual(g.players[0].zones.battlefield.filter(c=>c.token).map(c=>c.counters['+1/+1']),[6,5]);
  assert.deepEqual(g.combat.attackers.filter(a=>a.enteredAttacking).map(a=>a.defender.key),['player:2','card:walker']);
  assert.equal(g.combat.endTriggers[0].tokens.length,2);assert.equal(g.pendingEffect,undefined);
  // Play a real land through the pinned hand, preserving its one land play
  // while counter replacements are pending outside the battlefield.
  await seed("enter(real('Doubling Season','double'));enter(real('Vorinclex, Monstrous Raider','half'),1);g.players[0].zones.hand=[real('Blast Zone','played'),real('Forest','next-land')]");
  await click('#dock-items [data-card=played]');g=await state();assert.equal(g.pendingEffect.kind,'counter-choice');assert.equal(g.players[0].landsPlayed,1);assert.ok(g.players[0].zones.hand.some(c=>c.instance==='played'));await reload();await replacement('Doubling Season');
  g=await state();assert.equal(g.players[0].zones.battlefield.find(c=>c.instance==='played').counters.charge,1);assert.equal(g.players[0].landsPlayed,1);assert.equal(await run("document.querySelector('#dock-items [data-card=next-land]').dataset.playable"),'false');

  // A corrective graveyard drag uses the same entry path. Repositioning a
  // permanent already on the battlefield must keep the existing counters.
  await seed("enter(real('Doubling Season','double'));enter(real(\"Lae'zel, Vlaakith's Champion\",'add'));g.players[0].zones.graveyard=[creature('manual-visitor')]");
  const drag=()=>run(`(()=>{const source=document.querySelector('.player-mat[data-seat="0"] .pile.graveyard'),target=document.querySelector('.player-mat[data-seat="0"] .battlefield .cards'),data=new DataTransfer(),s=source.getBoundingClientRect(),t=target.getBoundingClientRect();source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:data,clientX:s.x+10,clientY:s.y+10}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,shiftKey:true,dataTransfer:data,clientX:t.x+t.width*.4,clientY:t.y+t.height*.4}));})()`);
  await drag();assert.equal((await state()).pendingEffect.kind,'counter-choice');assert.equal((await state()).players[0].zones.graveyard[0].instance,'manual-visitor');await reload();await replacement('Lae');
  g=await state();assert.equal(g.players[0].zones.battlefield.find(c=>c.instance==='manual-visitor').counters['+1/+1'],6);assert.equal(g.players[0].zones.graveyard.length,0);assert.equal(g.players[0].landsPlayed,0);
  assert.deepEqual(errors,[]);console.log('Entry routes UI passed: searches, delayed returns, polymorph, Myriad, land plays and corrective graveyard drags through saved entry choices.');win.destroy();app.quit();
 }catch(error){console.error(error,errors);win.destroy();app.exit(1);}
});
