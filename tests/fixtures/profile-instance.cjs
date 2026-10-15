// Exercise the real desktop entry point without showing QA windows.
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
const root=path.join(__dirname,'..','..','.qa','launch-profiles');require('node:fs').mkdirSync(root,{recursive:true});app.setPath('userData',root);
app.disableHardwareAcceleration();
BrowserWindow.prototype.show=function(){};
BrowserWindow.prototype.focus=function(){};
app.on('browser-window-created',(_event,win)=>{
 win.webContents.once('did-finish-load',()=>process.send({ready:true,directory:app.getPath('userData')}));
 process.on('message',async message=>{
  if(message.quit){app.quit();return;}
  try{const result=await win.webContents.executeJavaScript(message.script);process.send({id:message.id,result});}catch(error){process.send({id:message.id,error:error.message});}
 });
});
require('../../main.cjs');
