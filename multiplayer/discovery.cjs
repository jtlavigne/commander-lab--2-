const dgram=require('node:dgram'),crypto=require('node:crypto');
const GROUP='239.255.42.99',PORT=32110,PROTOCOL='commander-lab-discovery-v1';
// Multicast queries stay on the local subnet; replies go only to the requester.
async function advertise(getRooms,{port=PORT,group=GROUP}={}){
 const socket=dgram.createSocket({type:'udp4',reuseAddr:true});
 await new Promise((resolve,reject)=>{socket.once('error',reject);socket.bind(port,()=>{socket.off('error',reject);try{socket.addMembership(group);resolve();}catch(e){reject(e);}});}).catch(e=>{socket.close();throw e;});
 socket.on('error',()=>{});const recent=new Map();
 socket.on('message',(bytes,peer)=>{if(bytes.length>512)return;let q;try{q=JSON.parse(bytes);}catch{return;}if(q.protocol!==PROTOCOL||q.type!=='query'||!/^\w{16}$/.test(q.nonce))return;const now=Date.now();if(now-(recent.get(peer.address)||0)<150)return;recent.set(peer.address,now);if(recent.size>512)recent.clear();
  for(const room of getRooms().slice(0,20)){const body=Buffer.from(JSON.stringify({protocol:PROTOCOL,type:'room',nonce:q.nonce,...room}));if(body.length<4096)socket.send(body,peer.port,peer.address,()=>{});}
 });return {close(){socket.close();}};
}
async function discover({duration=1100,port=PORT,group=GROUP}={}){
 const socket=dgram.createSocket('udp4'),nonce=crypto.randomBytes(8).toString('hex'),found=new Map();
 return new Promise((resolve,reject)=>{let timer,done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);socket.close();error?reject(error):resolve([...found.values()].sort((a,b)=>a.name.localeCompare(b.name)));};
  socket.on('error',finish);socket.on('message',(bytes,peer)=>{if(bytes.length>4096)return;let r;try{r=JSON.parse(bytes);}catch{return;}if(r.protocol!==PROTOCOL||r.type!=='room'||r.nonce!==nonce||!/^[A-Za-z0-9_-]{16}$/.test(r.code)||typeof r.name!=='string'||r.name.length>60||!Number.isInteger(r.port)||r.port<1||r.port>65535||![2,3,4].includes(r.capacity)||!Number.isInteger(r.occupied)||r.occupied<0||r.occupied>r.capacity)return;
   if(found.size<100&&(!found.has(r.code)||peer.address!=='127.0.0.1'))found.set(r.code,{code:r.code,name:r.name,format:String(r.format).slice(0,40),capacity:r.capacity,occupied:r.occupied,url:'ws://'+peer.address+':'+r.port});
  });socket.bind(0,()=>{socket.setMulticastTTL(1);socket.setMulticastLoopback(true);socket.setBroadcast(true);const query=Buffer.from(JSON.stringify({protocol:PROTOCOL,type:'query',nonce}));socket.send(query,port,group,()=>{});socket.send(query,port,'127.0.0.1',()=>{});socket.send(query,port,'255.255.255.255',()=>{});timer=setTimeout(()=>finish(),duration);});
 });
}
module.exports={advertise,discover};
