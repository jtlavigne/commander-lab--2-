// One shared queue for imports and restored sessions. Cached cards bypass this queue.
function createCardClient({fetchImpl=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),spacing=1000}={}){
 let queue=Promise.resolve(),nextRequest=0,cooldown=0;
 function retryDelay(response){
  const value=response.headers?.get('retry-after');
  const seconds=value&&/^\d+(\.\d+)?$/.test(value)?Number(value)*1000:Date.parse(value)-now();
  return Math.max(60000,Number.isFinite(seconds)?seconds:0);
 }
 async function request(endpoint,options,label){
  for(let attempt=0;attempt<2;attempt++){
   await sleep(Math.max(0,Math.max(nextRequest,cooldown)-now()));
   nextRequest=now()+spacing;
   const response=await fetchImpl('https://api.scryfall.com'+endpoint,{...options,headers:{'User-Agent':'CommanderLab/0.1 (personal desktop deck tester)','Accept':'application/json','Content-Type':'application/json'}});
   if(response.status===429){
    cooldown=now()+retryDelay(response);
    await response.body?.cancel();
    if(attempt===0)continue;
    throw Error('Scryfall is still rate-limiting card imports. Import stopped. Wait at least '+Math.ceil((cooldown-now())/1000)+' seconds before trying again. Downloaded cards are cached.');
   }
   if(!response.ok)throw Error('Card lookup failed: '+label+' ('+response.status+')');
   return response.json();
  }
 }
 function enqueue(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result;}
 return {
  lookup(name){return enqueue(()=>request('/cards/named?exact='+encodeURIComponent(name),{},name));},
  collection(names){return enqueue(async()=>{
   const unique=[...new Map(names.map(name=>[name.toLowerCase(),name])).values()];const data=[],not_found=[];
   for(let i=0;i<unique.length;i+=75){
    const result=await request('/cards/collection',{method:'POST',body:JSON.stringify({identifiers:unique.slice(i,i+75).map(name=>({name}))})},'deck batch');
    data.push(...result.data);
    for(const identifier of result.not_found||[]){
     const parts=identifier.name?.split(/\s+\/\/\s+/);
     if(parts?.length>1){
      try{
       const card=await request('/cards/named?exact='+encodeURIComponent(parts[0]),{},identifier.name);
       if(parts.every(name=>card.card_faces?.some(face=>face.name.toLowerCase()===name.toLowerCase()))){data.push(card);continue;}
      }catch(error){if(!error.message.endsWith('(404)'))throw error;}
     }
     not_found.push(identifier);
    }
   }
   return {data,not_found};
  });}
 };
}
function matchCard(cards,name){const key=name.trim().toLowerCase();return cards.find(c=>c.name?.toLowerCase()===key||c.card_faces?.some(f=>f.name?.toLowerCase()===key));}
module.exports={createCardClient,matchCard};
