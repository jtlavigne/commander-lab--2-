const path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {createGameClient}=require('./client.cjs');
const {advertise,discover}=require('./discovery.cjs');
function installMultiplayer({ipcMain,app,directory=path.join(app.getPath('userData'),'multiplayer'),allowedFile=path.join(__dirname,'..','index.html'),bind='0.0.0.0'}={}){
 const clients=new Map();let server=null,lastHost=null,advertiser=null;
 const allowed=pathToFileURL(path.resolve(allowedFile)).href;
 const emit=(sender,channel,data)=>{if(!sender.isDestroyed())sender.send(channel,data);};
 async function write(name,value){await fs.mkdir(directory,{recursive:true});const file=path.join(directory,name);await fs.writeFile(file+'.tmp',JSON.stringify(value),'utf8');await fs.rename(file+'.tmp',file);}
 async function read(name){try{return JSON.parse(await fs.readFile(path.join(directory,name),'utf8'));}catch{return null;}}
 async function connect(sender,options,extra={}){
  clients.get(sender.id)?.client.close();const slot={client:null,status:{connection:'connecting'},...extra};clients.set(sender.id,slot);
  const client=await createGameClient({...options,onState:state=>{slot.snapshot={...state,...extra};emit(sender,'table-state',slot.snapshot);},onStatus:status=>{slot.status={...status,...extra};emit(sender,'table-status',slot.status);},onCredential:credential=>{slot.credential=credential;slot.save=(slot.save||Promise.resolve()).then(()=>write('client-'+sender.id+'.json',credential)).catch(()=>{});}});slot.client=client;
  try{await client.joined;}catch(error){client.close();clients.delete(sender.id);throw error;}return slot.snapshot;
 }
 function handle(name,fn){ipcMain.handle(name,async(event,args)=>{try{const url=(event.senderFrame?.url||event.sender.getURL()).split(/[?#]/)[0];if(url!==allowed)throw Error('Untrusted multiplayer IPC caller.');return await fn(event.sender,args||{});}catch(error){return {tableError:error.message};}});}
 handle('table-discover',()=>discover());
 handle('table-host',async(sender,{game,port=32109,automatic=false,resume=false})=>{
  if(clients.has(sender.id))throw Error('Leave the current table before hosting another.');
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('Choose a port from 1 to 65535.');if(server)throw Error('This app already hosts a table. Leave it before hosting another.');
  const saved=resume&&await read('last-host.json');if(resume&&!saved)throw Error('No hosted checkpoint is available.');
  const {createGameServer}=await import('./server.mjs');server=await createGameServer({host:bind,port:saved?.port??port,checkpointDirectory:path.join(directory,'rooms')});
  try{const hosted=await server.createRoom(game,{automatic,restoreCode:saved?.code});lastHost=hosted;await write('last-host.json',{code:hosted.code,port:server.port});
   const addresses=[...new Set(Object.values(os.networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal).map(a=>'ws://'+a.address+':'+server.port))];if(!addresses.length)addresses.push('ws://127.0.0.1:'+server.port);
   let discoveryWarning='';try{advertiser=await advertise(()=>[...server.rooms.values()].filter(r=>r.game.lobby?.status==='waiting').map(r=>({code:r.code,name:r.game.lobby.name,format:r.game.lobby.format,capacity:r.game.players.length,occupied:r.sessions.size,port:server.port})));}catch{discoveryWarning='Network discovery is unavailable. Friends can still join using the invite address and code.';}
   return await connect(sender,{url:'ws://127.0.0.1:'+server.port,code:hosted.code,token:hosted.hostToken},{addresses,hosting:true,discoveryWarning});
  }catch(error){advertiser?.close();advertiser=null;await server.close();server=null;throw error;}
 });
 handle('table-join',(sender,options)=>{if(clients.get(sender.id)?.hosting)throw Error('Stop hosting before joining another table.');return connect(sender,options);});
 handle('table-reconnect',async sender=>{const credential=await read('client-'+sender.id+'.json');if(!credential)throw Error('No saved connection for this window.');const old=clients.get(sender.id);return connect(sender,credential,old?.hosting?{hosting:true,addresses:old.addresses}:{});});
 handle('table-get',sender=>{const slot=clients.get(sender.id);return {snapshot:slot?.snapshot||null,status:slot?.status||{connection:'offline'},hasHostedCheckpoint:!!lastHost};});
 handle('table-action',(sender,action)=>{const slot=clients.get(sender.id);if(!slot?.client)throw Error('No shared table is connected.');return slot.client.send(action);});
 handle('table-leave',async sender=>{const slot=clients.get(sender.id);slot?.client.close();clients.delete(sender.id);if(slot?.hosting&&server){advertiser?.close();advertiser=null;await server.close();server=null;}return {connection:'offline'};});
 const close=async()=>{for(const slot of clients.values())slot.client?.close();clients.clear();advertiser?.close();advertiser=null;if(server){await server.close();server=null;}};
 app.on('before-quit',()=>{for(const slot of clients.values())slot.client?.close();});
 return {close,get server(){return server;}};
}
module.exports={installMultiplayer};
