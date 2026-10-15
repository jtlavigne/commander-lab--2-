const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('cards',{
 lookupTokens:names=>ipcRenderer.invoke('cards-tokens',names),lookupIds:ids=>ipcRenderer.invoke('cards-by-id',ids),
 lookup:name=>ipcRenderer.invoke('card',name),lookupBatch:names=>ipcRenderer.invoke('cards-batch',names),
 onProgress(callback){const listener=(_event,progress)=>callback(progress);ipcRenderer.on('cards-progress',listener);return ()=>ipcRenderer.removeListener('cards-progress',listener);}
});
const tableCall=(channel,args)=>ipcRenderer.invoke(channel,args).then(value=>{if(value?.tableError)throw Error(value.tableError);return value;});
contextBridge.exposeInMainWorld('tableNetwork',{
 discover:()=>tableCall('table-discover'),
 host:options=>tableCall('table-host',options),join:options=>tableCall('table-join',options),reconnect:()=>tableCall('table-reconnect'),get:()=>tableCall('table-get'),send:action=>tableCall('table-action',action),leave:()=>tableCall('table-leave'),
 onState(callback){const listener=(_event,state)=>callback(state);ipcRenderer.on('table-state',listener);return ()=>ipcRenderer.removeListener('table-state',listener);},
 onStatus(callback){const listener=(_event,status)=>callback(status);ipcRenderer.on('table-status',listener);return ()=>ipcRenderer.removeListener('table-status',listener);}
});
contextBridge.exposeInMainWorld('desktopApp',{exit:()=>tableCall('app-exit')});
