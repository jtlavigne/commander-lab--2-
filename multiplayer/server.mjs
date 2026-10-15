import {WebSocketServer,WebSocket} from 'ws';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {validateSession,newGame} from '../engine.mjs';
import {reduceAction,canRebaseAction} from './actions.mjs';
import {PROTOCOL,cleanData,projectGame,compactView,diff,digest,MAX_PACKET} from './protocol.mjs';
const secret=()=>randomBytes(24).toString('base64url');
export async function createGameServer({host='127.0.0.1',port=0,checkpointDirectory,heartbeatMs=15000}={}){
 const rooms=new Map(),wss=new WebSocketServer({host,port,maxPayload:2*1024*1024,perMessageDeflate:false});
 await new Promise((resolve,reject)=>{wss.once('listening',resolve);wss.once('error',reject);});
 wss.on('error',()=>{});
 function send(ws,packet){if(ws.readyState!==WebSocket.OPEN)return;if(ws.bufferedAmount>2*1024*1024){ws.terminate();return;}const encoded=JSON.stringify({v:PROTOCOL,...packet});if(Buffer.byteLength(encoded)>MAX_PACKET){ws.close(1009,'Table too large');return;}ws.send(encoded);}
 function presence(room){return room.game.players.map((p,seat)=>({seat,name:p.name,connected:[...room.connections].some(c=>c.session.seat===seat&&c.ws.readyState===WebSocket.OPEN),reserved:[...room.sessions.values()].some(s=>s.seat===seat)}));}
 function viewFor(room,seat){return compactView(projectGame(room.game,seat,{log:room.log,automatic:room.automatic,epoch:room.lastResetRevision||0}));}
 function snapshot(conn){const {room}=conn,{state,assets}=viewFor(room,conn.session.seat);conn.view=state;conn.sentAssets=new Set(Object.keys(assets));send(conn.ws,{type:'snapshot',revision:room.revision,state,assets,hash:digest(state),seat:conn.session.seat,host:conn.session.host,code:room.code,presence:presence(room)});}
 function publish(room,actionId){for(const conn of room.connections){const {state,assets}=viewFor(room,conn.session.seat),fresh=Object.fromEntries(Object.entries(assets).filter(([id])=>!conn.sentAssets.has(id)));for(const id of Object.keys(fresh))conn.sentAssets.add(id);send(conn.ws,{type:'update',from:room.revision-1,revision:room.revision,changes:diff(conn.view,state),assets:fresh,hash:digest(state),actionId,presence:presence(room)});conn.view=state;}}
 async function save(room,overrides={}){
  if(!checkpointDirectory)return;await fs.mkdir(checkpointDirectory,{recursive:true});const file=path.join(checkpointDirectory,room.code+'.json'),next=file+'.tmp';
  const record={version:1,code:room.code,game:room.game,revision:room.revision,lastResetRevision:room.lastResetRevision||0,automatic:room.automatic,log:room.log,sessions:[...room.sessions].map(([token,s])=>({token,seat:s.seat,host:s.host,receipts:[...s.receipts]})),...overrides};
  await fs.writeFile(next,JSON.stringify(record),'utf8');await fs.rename(next,file);
 }
 async function createRoom(game,{automatic=false,restoreCode}={}){
  let room,hostToken;
  if(restoreCode){if(!checkpointDirectory||!/^[A-Za-z0-9_-]{16}$/.test(restoreCode))throw Error('Invalid saved room.');const value=JSON.parse(await fs.readFile(path.join(checkpointDirectory,restoreCode+'.json'),'utf8'));if(value.version!==1||value.code!==restoreCode)throw Error('Unsupported saved room.');validateSession(value.game);room={...value,sessions:new Map(value.sessions.map(s=>[s.token,{seat:s.seat,host:s.host,receipts:new Map(s.receipts||[])}]))};hostToken=[...room.sessions].find(([,s])=>s.host)?.[0];if(!hostToken)throw Error('Saved host seat is missing.');}
  else{const code=randomBytes(12).toString('base64url');hostToken=secret();room={code,game:validateSession(cleanData(game)),revision:0,lastResetRevision:0,automatic:!!automatic,log:['Shared table ready.'],sessions:new Map([[hostToken,{seat:0,host:true,receipts:new Map()}]])};}
  // Materialize legacy room defaults once; later settings belong to each seat.
  for(const player of room.game.players)player.automatic??=!!room.automatic;
  if(rooms.has(room.code))throw Error('Room is already hosted.');room.connections=new Set();room.queue=Promise.resolve();room.history=[];rooms.set(room.code,room);await save(room);return {code:room.code,hostToken,port:wss.address().port};
 }
 wss.on('connection',ws=>{
  const conn={ws,alive:true,session:null,room:null,view:null,sentAssets:new Set(),window:Date.now(),messages:0};let incoming=Promise.resolve();const deadline=setTimeout(()=>{if(!conn.session)ws.close(1008,'Join timeout');},10000);deadline.unref();
  ws.on('pong',()=>{conn.alive=true;});
  ws.on('message',data=>{incoming=incoming.then(async()=>{
   if(Date.now()-conn.window>10000){conn.window=Date.now();conn.messages=0;}if(++conn.messages>120){ws.close(1008,'Too many requests');return;}
   let p;try{p=JSON.parse(data.toString());}catch{ws.close(1008,'Invalid JSON');return;}if(!p||p.v!==PROTOCOL){ws.close(1008,'Protocol version mismatch');return;}
   if(!conn.session){
    if(p.type!=='join'||typeof p.code!=='string'){ws.close(1008,'Join first');return;}const room=rooms.get(p.code);if(!room){send(ws,{type:'error',message:'Room not found.'});ws.close(1008,'Room not found');return;}
    room.queue=room.queue.then(async()=>{let token=p.token,session=token&&room.sessions.get(token);
    if(token&&!session){send(ws,{type:'error',message:'This reconnect credential is no longer valid.'});ws.close(1008,'Invalid session');return;}
    if(!session){const occupied=new Set([...room.sessions.values()].map(s=>s.seat)),seat=Number.isInteger(p.seat)?p.seat:room.game.players.findIndex((_,i)=>!occupied.has(i));if(seat<1||seat>=room.game.players.length||occupied.has(seat)){send(ws,{type:'error',message:'That seat is occupied or the table is full.'});ws.close(1008,'Seat unavailable');return;}token=secret();session={seat,host:false,receipts:new Map()};room.sessions.set(token,session);await save(room);}
    for(const other of room.connections)if(other.session===session){other.ws.close(4001,'Session resumed elsewhere');room.connections.delete(other);}
    conn.room=room;conn.session=session;room.connections.add(conn);clearTimeout(deadline);send(ws,{type:'welcome',token,seat:session.seat,host:session.host,code:room.code});snapshot(conn);for(const other of room.connections)if(other!==conn)send(other.ws,{type:'presence',presence:presence(room)});
    }).catch(error=>{send(ws,{type:'error',message:error.message});ws.close(1011,'Could not join');});await room.queue;return;
   }
   const room=conn.room;if(p.type==='resync'){await room.queue;snapshot(conn);return;}
   if(p.type!=='action'||typeof p.id!=='string'||!p.id.length||p.id.length>100){send(ws,{type:'error',message:'Invalid packet.'});return;}
   if(!p.action||typeof p.action!=='object'||Array.isArray(p.action)||!Number.isSafeInteger(p.baseRevision)||p.baseRevision<0){send(ws,{type:'reject',id:p.id,reason:'Invalid action packet.'});return;}
   room.queue=room.queue.then(async()=>{
    if(!room.connections.has(conn)||![...room.sessions.values()].includes(conn.session)){send(ws,{type:'reject',id:p.id,reason:'You no longer own this seat.'});return;}
    const fingerprint=digest(p.action),previous=conn.session.receipts.get(p.id);
    if(previous){send(ws,previous.fingerprint===fingerprint?previous.ack:{type:'reject',id:p.id,reason:'Action ID already used.'});return;}
    if(p.baseRevision>room.revision||p.baseRevision<room.revision&&(p.baseRevision<(room.lastResetRevision||0)||!canRebaseAction(room.game,p.action))){send(ws,{type:'reject',id:p.id,reason:'The table changed. Review the updated state and try again.',stale:true});snapshot(conn);return;}
    try{
     let result,automatic=room.automatic,history,nextSessions=room.sessions,releaseSeat;
     if(room.game.lobby?.status==='waiting'&&['undo'].includes(p.action.type))throw Error('Finish lobby setup before changing the table.');
     if(p.action?.type==='lobbySettings'&&p.action.count<room.game.players.length&&[...room.sessions.values()].some(s=>s.seat>=p.action.count))throw Error('An occupied seat cannot be removed.');
     if(p.action?.type==='lobbyStart'&&presence(room).some(p=>!p.connected))throw Error('Every player must be connected before starting.');
     if(p.action?.type==='undo'){
      const last=room.history.at(-1);if(room.game.opening?.status==='choosing'||last?.game.opening?.status==='choosing')throw Error('Opening-hand decisions cannot be undone.');if(!last||last.actor!==conn.session.seat&&!conn.session.host)throw Error('Only your most recent action can be undone.');result={game:structuredClone(last.game),description:'Last shared action undone.'};automatic=last.automatic;history=room.history.slice(0,-1);

     }else if(p.action?.type==='releaseSeat'){
      releaseSeat=p.action.seat;if(!conn.session.host||!Number.isInteger(releaseSeat)||releaseSeat<1||releaseSeat>=room.game.players.length)throw Error('Only the host can release another seat.');nextSessions=new Map([...room.sessions].filter(([,s])=>s.seat!==releaseSeat));const game=structuredClone(room.game);if(game.lobby?.status==='waiting'){game.players[releaseSeat]=newGame(game.players.length).players[releaseSeat];game.lobby.ready[releaseSeat]=false;game.lobby.acknowledged[releaseSeat]=false;game.lobby.decks[releaseSeat]=null;}result={game,description:'Host released seat '+(releaseSeat+1)+'.'};
     }else result=reduceAction(room.game,p.action,conn.session.seat,{host:conn.session.host,automatic});
     const revision=room.revision+1,lastResetRevision=['reset','undo'].includes(p.action.type)?revision:(room.lastResetRevision||0),log=[result.description,...room.log].slice(0,200),ack={type:'ack',id:p.id,revision},receipts=new Map(conn.session.receipts);receipts.set(p.id,{fingerprint,ack});if(receipts.size>256)receipts.delete(receipts.keys().next().value);
     const sessions=[...nextSessions].map(([token,s])=>({token,seat:s.seat,host:s.host,receipts:[...(s===conn.session?receipts:s.receipts)]}));
     await save(room,{game:result.game,revision,lastResetRevision,automatic,log,sessions});
     room.history=history||[...room.history,{game:room.game,actor:conn.session.seat,automatic:room.automatic}].slice(-30);room.game=result.game;room.automatic=automatic;room.revision=revision;room.lastResetRevision=lastResetRevision;room.log=log;room.sessions=nextSessions;conn.session.receipts=receipts;if(releaseSeat!==undefined)for(const peer of room.connections)if(peer.session.seat===releaseSeat){room.connections.delete(peer);peer.ws.close(4001,'The host released this seat.');}publish(room,p.id);send(ws,ack);
    }catch(error){send(ws,{type:'reject',id:p.id,reason:error.code?'The host could not save this action. No changes were committed.':error.message});}
   }).catch(()=>send(ws,{type:'error',message:'Could not commit the action. Reconnect to resynchronize.'}));await room.queue;
  }).catch(error=>{send(ws,{type:'error',message:error.message});});});
  ws.on('error',()=>{});ws.on('close',()=>{clearTimeout(deadline);if(conn.room){conn.room.connections.delete(conn);for(const peer of conn.room.connections)send(peer.ws,{type:'presence',presence:presence(conn.room)});}});
 });
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){const connAlive=ws.__alive;if(connAlive===false){ws.terminate();continue;}ws.__alive=false;ws.once('pong',()=>{ws.__alive=true;});ws.ping();}},heartbeatMs);heartbeat.unref();
 return {createRoom,port:wss.address().port,rooms,async close(){clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();await Promise.all([...rooms.values()].map(r=>r.queue));await new Promise(resolve=>wss.close(resolve));}};
}
