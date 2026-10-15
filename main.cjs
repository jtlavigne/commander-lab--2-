const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
const {createCardClient}=require('./card-client.cjs');
const {createCardCache}=require('./card-cache.cjs');
const {installMultiplayer}=require('./multiplayer/electron.cjs');
const {launchProfile}=require('./launch-profile.cjs');
// Keep development and installed builds on the same saved-data directory.
if(app.isPackaged)app.setPath('userData',path.join(app.getPath('appData'),'commander-lab'));
const profile=launchProfile(process.argv.slice(app.isPackaged?1:2),app.getPath('userData'));
if(profile){require('node:fs').mkdirSync(profile.directory,{recursive:true});app.setPath('userData',profile.directory);}
const client=createCardClient();
let mainWindow=null;
function revealWindow(){
 if(!mainWindow||mainWindow.isDestroyed())return;
 if(mainWindow.isMinimized())mainWindow.restore();
 mainWindow.show();mainWindow.focus();
}
if(!app.requestSingleInstanceLock()){
 console.log('Commander Lab is already running; showing its window.');
 app.quit();
}else{
app.on('second-instance',()=>{if(app.isReady())revealWindow();else app.whenReady().then(revealWindow);});
app.whenReady().then(()=>{
 installMultiplayer({ipcMain,app});
 ipcMain.handle('app-exit',event=>{if(event.sender===mainWindow?.webContents){app.quit();return true;}return {tableError:'Untrusted window.'};});

 const cache=createCardCache({directory:path.join(app.getPath('userData'),'cards'),client});
 ipcMain.handle('cards-tokens',(_,names)=>cache.lookupTokens(names));
 ipcMain.handle('cards-by-id',(_,ids)=>cache.lookupIds(ids));
 ipcMain.handle('cards-batch',(event,names)=>cache.lookupBatch(names,progress=>{if(!event.sender.isDestroyed())event.sender.send('cards-progress',progress);}));
 ipcMain.handle('card',async(_,name)=>{const result=await cache.lookupBatch([name]);return result[name.trim()];});
 const win=new BrowserWindow({width:1500,height:960,minWidth:1000,minHeight:760,show:false,backgroundColor:'#111615',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 mainWindow=win;
 win.on('page-title-updated',event=>{event.preventDefault();win.setTitle('Commander Lab v'+app.getVersion()+(profile?' - '+profile.name:''));});
 win.once('ready-to-show',revealWindow);
 win.on('closed',()=>{mainWindow=null;});
 win.webContents.on('did-fail-load',(_event,code,description)=>console.error('Commander Lab failed to load:',code,description));
 win.webContents.on('render-process-gone',(_event,details)=>console.error('Commander Lab renderer stopped:',details.reason));
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',e=>e.preventDefault());
 return win.loadFile(path.join(__dirname,'index.html')).then(revealWindow);
}).catch(error=>{console.error('Commander Lab startup failed:',error);app.exit(1);});
app.on('activate',revealWindow);
}
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
