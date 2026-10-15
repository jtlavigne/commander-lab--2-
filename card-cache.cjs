const fs=require('node:fs/promises');
const path=require('node:path');
const {matchCard}=require('./card-client.cjs');

function imageSources(card){
 const best=uris=>uris?.png||uris?.large||uris?.normal||null;
 if(best(card.image_uris))return [best(card.image_uris)];
 return (card.card_faces||[]).map(face=>best(face.image_uris));
}
function imageType(bytes){
 if(bytes[0]===0xff&&bytes[1]===0xd8)return 'image/jpeg';
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 throw Error('The server did not return a supported card image.');
}
function createCardCache({directory,client,fetchImpl=fetch}){
 let queue=Promise.resolve();
 const cacheFile=name=>path.join(directory,Buffer.from(name.trim().toLowerCase()).toString('hex')+'.json');
 async function cached(name){try{return JSON.parse(await fs.readFile(cacheFile(name),'utf8'));}catch{return null;}}
 async function save(card,name=card.name){await fs.writeFile(cacheFile(name),JSON.stringify(card));}
 async function loadArtwork(card){
  const sources=imageSources(card),errors=[],previous=card.localImages||[];card.localImages=Array(sources.length).fill(null);
  for(let face=0;face<sources.length;face++){
   if(!sources[face])continue;
   const safeId=String(card.id||card.name).replace(/[^a-z0-9_-]/gi,'_');
   // Separate high-resolution files from the older normal-size JPEG cache.
   const imageFile=path.join(directory,safeId+'-'+face+'-hd.img');
   try{
    let bytes;
    try{bytes=await fs.readFile(imageFile);imageType(bytes);}catch{
     const response=await fetchImpl(sources[face],{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'CommanderLab/0.1 (personal desktop deck tester)','Accept':'image/*'}});
     if(!response.ok)throw Error('HTTP '+response.status);
     bytes=Buffer.from(await response.arrayBuffer());imageType(bytes);
     await fs.writeFile(imageFile,bytes);
    }
    card.localImages[face]='data:'+imageType(bytes)+';base64,'+bytes.toString('base64');
   }catch(error){
    errors.push('Face '+(face+1)+': '+error.message);
    try{const fallback=await fs.readFile(path.join(directory,safeId+'-'+face+'.jpg'));card.localImages[face]='data:'+imageType(fallback)+';base64,'+fallback.toString('base64');}
    catch{if(typeof previous[face]==='string'&&previous[face].startsWith('data:image/'))card.localImages[face]=previous[face];}
   }
  }
  if(errors.length)card.artworkError=errors.join(' · ');else delete card.artworkError;
  card.artworkVersion=errors.length?1:2;
  await save(card);return card;
 }
 function lookupBatch(names,onProgress=()=>{}){
  if(!Array.isArray(names)||names.length>250||names.some(n=>typeof n!=='string'||!n.trim()||n.length>200))return Promise.reject(Error('Invalid card names'));
  const task=queue.then(async()=>{
   await fs.mkdir(directory,{recursive:true});
   const unique=[...new Map(names.map(n=>[n.trim().toLowerCase(),n.trim()])).values()],records={},missing=[];
   onProgress({stage:'metadata',completed:0,total:unique.length});
   for(const name of unique){const card=await cached(name);if(card)records[name]=card;else missing.push(name);}
   if(missing.length){
    const result=await client.collection(missing);for(const card of result.data)await save(card);
    const unresolved=[];
    for(const name of missing){const card=matchCard(result.data,name);if(card)records[name]=card;else unresolved.push(name);}
    if(unresolved.length)throw Error('Cards not found: '+unresolved.join(', ')+'. Check the exact English card names. Other downloaded cards have been cached.');
   }
   let completed=0;const artwork=new Map();
   for(const name of unique){
    const card=records[name],key=card.id||card.name;
    onProgress({stage:'images',completed,total:unique.length,name:card.name});
    if(!artwork.has(key))artwork.set(key,await loadArtwork(card));
    records[name]=artwork.get(key);await save(records[name],name);completed++;
    onProgress({stage:'images',completed,total:unique.length,name:card.name});
   }
   return records;
  });
  queue=task.catch(()=>{});return task;
 }
 return {lookupBatch};
}
module.exports={createCardCache,imageSources};
