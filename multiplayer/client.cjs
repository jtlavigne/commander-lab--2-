const {WebSocket}=require('ws');
const {randomUUID}=require('node:crypto');
async function createGameClient({url,code,token,seat,onState=()=>{},onStatus=()=>{},onCredential=()=>{},reconnectMs=500}={}){
 const {PROTOCOL,MAX_PACKET,applyPatch,digest,expandView,cleanData}=await import('./protocol.mjs');
 const endpoint=new URL(url);if(!['ws:','wss:'].includes(endpoint.protocol)||endpoint.username||endpoint.password||endpoint.hash)throw Error('Use a ws:// or wss:// table address.');
 let socket,closed=false,timer,attempt=0,state=null,assets={},revision=-1,assignedSeat,host=false,presence=[],ready=false,inflight=null,queue=[],joinResolve,joinReject,joinTimer;
 const joined=new Promise((resolve,reject)=>{joinResolve=resolve;joinReject=reject;});
 function status(connection,message){onStatus({connection,message,seat:assignedSeat,host,code,url:endpoint.href,revision,presence,pending:!!inflight});}
 function publish(){onState({game:expandView(state,assets),revision,seat:assignedSeat,host,code,url:endpoint.href,presence});}
 function pump(){if(!ready||inflight||!queue.length)return;inflight=queue.shift();inflight.packet={v:PROTOCOL,type:'action',id:inflight.id,baseRevision:revision,action:inflight.action};socket.send(JSON.stringify(inflight.packet));status('connected');}
 function connect(){
  if(closed)return;ready=false;status(attempt?'reconnecting':'connecting');socket=new WebSocket(endpoint,{maxPayload:MAX_PACKET,perMessageDeflate:false,handshakeTimeout:10000});
  socket.on('open',()=>socket.send(JSON.stringify({v:PROTOCOL,type:'join',code,token,seat})));
  socket.on('message',data=>{
   try{const p=JSON.parse(data.toString());if(p.v!==PROTOCOL)throw Error('Protocol mismatch.');
    if(p.type==='welcome'){token=p.token;assignedSeat=p.seat;host=p.host;onCredential({url:endpoint.href,code,token,seat:assignedSeat});return;}
    if(p.type==='snapshot'){
     if(digest(p.state)!==p.hash)throw Error('Snapshot checksum failed.');state=p.state;assets={...p.assets};revision=p.revision;assignedSeat=p.seat;host=p.host;presence=p.presence;ready=true;attempt=0;clearTimeout(joinTimer);publish();status('connected');joinResolve();if(inflight)socket.send(JSON.stringify(inflight.packet));else pump();return;
    }
    if(p.type==='update'){
     if(!ready||p.from!==revision){ready=false;socket.send(JSON.stringify({v:PROTOCOL,type:'resync'}));status('synchronizing');return;}
     const next=applyPatch(state,p.changes);if(digest(next)!==p.hash){ready=false;socket.send(JSON.stringify({v:PROTOCOL,type:'resync'}));status('synchronizing');return;}
     state=next;assets={...assets,...p.assets};revision=p.revision;presence=p.presence;publish();status('connected');return;
    }
    if(p.type==='ack'||p.type==='reject'){
     if(inflight?.id===p.id){const item=inflight;inflight=null;if(p.type==='ack')item.resolve({revision:p.revision});else item.reject(Error(p.reason));if(p.stale){ready=false;status('synchronizing',p.reason);}else{status('connected',p.type==='reject'?p.reason:undefined);pump();}}return;
    }
    if(p.type==='presence'){presence=p.presence;status('connected');return;}
    if(p.type==='error'){status('error',p.message);if(!ready)joinReject(Error(p.message));}
   }catch(error){status('error',error.message);socket.close(1008,'Invalid update');}
  });
  socket.on('error',error=>status('reconnecting',error.message));
  socket.on('close',(code,reason)=>{
   ready=false;for(const item of queue.splice(0))item.reject(Error('Connection interrupted. Review the table before trying again.'));if(closed)return;
   if(code===1008||code===4001){closed=true;const error=Error(reason.toString()||'Connection rejected.');joinReject(error);inflight?.reject(error);inflight=null;status('error',error.message);return;}
   status('reconnecting','Connection lost; reconnecting.');timer=setTimeout(connect,Math.min(15000,reconnectMs*2**Math.min(attempt++,5)));
  });
 }
 joinTimer=setTimeout(()=>{if(!ready){joinReject(Error('Could not join the table. Check the address and room code.'));}},12000);joinTimer.unref();connect();
 const api={joined,get snapshot(){return state?{game:expandView(state,assets),revision,seat:assignedSeat,host,code,url:endpoint.href,presence}:null;},get credential(){return {url:endpoint.href,code,token,seat:assignedSeat};},send(action){if(!ready||closed)return Promise.reject(Error('Wait until the table is connected and synchronized.'));if(queue.length>=32)return Promise.reject(Error('Too many pending actions.'));return new Promise((resolve,reject)=>{queue.push({id:randomUUID(),action:cleanData(action),resolve,reject});pump();});},close(){closed=true;ready=false;clearTimeout(timer);clearTimeout(joinTimer);const error=Error('Left the shared table.');joinReject(error);inflight?.reject(error);for(const item of queue)item.reject(error);inflight=null;queue=[];socket?.close();status('offline');},disconnectForTest(){socket?.terminate();}};
 return api;
}
module.exports={createGameClient};
