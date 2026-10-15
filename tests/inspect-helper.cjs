const assert=require('node:assert/strict');

// Real Chromium input verifies hit testing through inert artwork, disabled
// choices and modal top layers, without clicking or changing a selection.
module.exports=async function inspect(win,selector,{name,modal=false,screenshot}={}){
 const run=code=>win.webContents.executeJavaScript(code,true),debug=win.webContents.debugger;
 if(!debug.isAttached())debug.attach('1.3');
 const before=await run("localStorage.getItem('commanderLab')");
 const point=await run(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.scrollIntoView({block:'nearest'});const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height*.35};})()`);
 await debug.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
 await debug.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Alt',code:'AltLeft',location:1,windowsVirtualKeyCode:18,modifiers:1});
 assert.equal(await run("document.getElementById('card-zoom-preview').matches(':popover-open')"),true,'Alt opens preview: '+selector);
 if(name)assert.equal(await run("document.querySelector('#inspector h2').textContent"),name);
 if(modal){
  assert.equal(await run("!!document.getElementById('card-zoom-preview').closest('dialog[open]')"),true);
  assert.equal(await run("document.querySelectorAll('#inspector button,#inspector input,#card-zoom-preview [data-counter-control]').length"),0,'Focused choice inspection cannot mutate cards');
 }
 if(screenshot){win.setSize(win.getSize()[0]+1,win.getSize()[1]);win.webContents.invalidate();await new Promise(r=>setTimeout(r,250));assert.equal(await run("document.getElementById('card-zoom-preview').matches(':popover-open')"),true,'Preview survives a focused view refresh');await require('node:fs/promises').writeFile(screenshot,(await win.webContents.capturePage()).toPNG());}
 await debug.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Alt',code:'AltLeft',location:1,windowsVirtualKeyCode:18,modifiers:0});
 await debug.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:2,y:2});
 assert.equal(await run("document.getElementById('card-zoom-preview').hidden"),true);
 assert.equal(await run("localStorage.getItem('commanderLab')"),before,'Inspection preserves game state');
};
