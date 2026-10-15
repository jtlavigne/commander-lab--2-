import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import cacheModule from '../card-cache.cjs';
const {createCardCache}=cacheModule;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
const imageResponse=(status=200,bytes=png)=>({ok:status===200,status,arrayBuffer:async()=>bytes});
const forest={id:'forest-id',name:'Forest',image_uris:{normal:'https://images.test/forest.jpg'}};
async function directory(t){
 const root=fileURLToPath(new URL('../.qa/',import.meta.url));await fs.mkdir(root,{recursive:true});
 const dir=await fs.mkdtemp(path.join(root,'images-test-'));
 t.after(async()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(root));assert.ok(path.basename(dir).startsWith('images-test-'));await fs.rm(dir,{recursive:true,force:true});});
 return dir;
}
test('artwork downloads once per card and subsequent imports reuse disk images',async t=>{
 let metadataCalls=0,imageCalls=0;const progress=[];
 const cache=createCardCache({directory:await directory(t),client:{collection:async()=>{metadataCalls++;return {data:[structuredClone(forest)]};}},fetchImpl:async()=>{imageCalls++;return imageResponse();}});
 const result=await cache.lookupBatch(['Forest','Forest'],event=>progress.push(event));
 assert.match(result.Forest.localImages[0],/^data:image\/png;base64,/);assert.equal(imageCalls,1);
 const repeated=await cache.lookupBatch(['Forest']);assert.equal(repeated.Forest.localImages[0],result.Forest.localImages[0]);assert.equal(imageCalls,1);assert.equal(metadataCalls,1);
 assert.deepEqual(progress.at(-1),{stage:'images',completed:1,total:1,name:'Forest'});
});
test('legacy metadata cached without artwork downloads missing images',async t=>{
 const dir=await directory(t);await fs.writeFile(path.join(dir,Buffer.from('forest').toString('hex')+'.json'),JSON.stringify({...forest,localImages:[]}));
 let imageCalls=0;const cache=createCardCache({directory:dir,client:{collection:async()=>{throw Error('Cached metadata should not be fetched again');}},fetchImpl:async()=>{imageCalls++;return imageResponse();}});
 assert.ok((await cache.lookupBatch(['Forest'])).Forest.localImages[0]);assert.equal(imageCalls,1);
});
test('failed front artwork keeps face order and retries without downloading the successful back again',async t=>{
 const card={id:'double-id',name:'Front // Back',card_faces:[{name:'Front',image_uris:{normal:'https://images.test/front.jpg'}},{name:'Back',image_uris:{normal:'https://images.test/back.jpg'}}]};
 let failFront=true;const calls=[];
 const cache=createCardCache({directory:await directory(t),client:{collection:async()=>({data:[structuredClone(card)]})},fetchImpl:async url=>{calls.push(url);return imageResponse(failFront&&url.endsWith('front.jpg')?404:200);}});
 const first=(await cache.lookupBatch(['Front'])).Front;assert.equal(first.localImages[0],null);assert.ok(first.localImages[1]);assert.match(first.artworkError,/HTTP 404/);
 failFront=false;const second=(await cache.lookupBatch(['Front'])).Front;assert.ok(second.localImages.every(Boolean));assert.equal(second.artworkError,undefined);assert.equal(calls.filter(url=>url.endsWith('back.jpg')).length,1);
});
test('an HTML error response is reported rather than stored as a card image',async t=>{
 const cache=createCardCache({directory:await directory(t),client:{collection:async()=>({data:[structuredClone(forest)]})},fetchImpl:async()=>imageResponse(200,Buffer.from('<html>error</html>'))});
 const result=(await cache.lookupBatch(['Forest'])).Forest;assert.equal(result.localImages[0],null);assert.match(result.artworkError,/supported card image/);
});
test('high-resolution PNG replaces the older normal-image cache',async t=>{
 const dir=await directory(t),card={...forest,image_uris:{normal:'https://images.test/normal.jpg',large:'https://images.test/large.jpg',png:'https://images.test/full.png'}};
 await fs.writeFile(path.join(dir,Buffer.from('forest').toString('hex')+'.json'),JSON.stringify(card));await fs.writeFile(path.join(dir,'forest-id-0.jpg'),png);
 const calls=[],cache=createCardCache({directory:dir,client:{collection:async()=>{throw Error('Use cached metadata');}},fetchImpl:async url=>{calls.push(url);return imageResponse();}});
 const result=(await cache.lookupBatch(['Forest'])).Forest;assert.deepEqual(calls,['https://images.test/full.png']);assert.equal(result.artworkVersion,2);assert.ok((await fs.stat(path.join(dir,'forest-id-0-hd.img'))).size>0);
});
test('an offline quality upgrade preserves existing artwork and remains retryable',async t=>{
 const dir=await directory(t);await fs.writeFile(path.join(dir,Buffer.from('forest').toString('hex')+'.json'),JSON.stringify(forest));await fs.writeFile(path.join(dir,'forest-id-0.jpg'),png);
 const cache=createCardCache({directory:dir,client:{collection:async()=>{throw Error('Use cached metadata');}},fetchImpl:async()=>{throw Error('Offline');}});
 const result=(await cache.lookupBatch(['Forest'])).Forest;assert.ok(result.localImages[0]);assert.equal(result.artworkVersion,1);assert.match(result.artworkError,/Offline/);
});

test('token imports use related IDs, Oracle fallback and disk artwork without name collisions',async t=>{
 const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/token-catalog.json',import.meta.url))),book=fixture.tokens.find(c=>c.name==="Tamiyo's Notebook"),warrior=fixture.warriors[0];
 const maker={id:'maker',name:'Warrior maker',oracle_text:'Create a 1/1 green Elf Warrior creature token.'},cards=[fixture.cards[0],maker],tokens=[...fixture.tokens,warrior];let lookups=0,searches=0,images=0;
 const cache=createCardCache({directory:await directory(t),client:{collection:async()=>({data:structuredClone(cards)}),byId:async id=>{lookups++;return structuredClone(tokens.find(c=>c.id===id));},searchTokens:async query=>{searches++;assert.match(query,/Elf Warrior.*pow:1 tou:1 c=G/);return [structuredClone(warrior)];}},fetchImpl:async()=>{images++;return imageResponse();}});
 await cache.lookupBatch(cards.map(c=>c.name));const first=await cache.lookupTokens(cards.map(c=>c.name));
 assert.deepEqual(first.warnings,[]);assert.equal(first.tokens.length,3);assert.ok(first.tokens.every(c=>c.localImages[0]));
 const before={lookups,searches,images};await cache.lookupTokens(cards.map(c=>c.name));assert.deepEqual({lookups,searches,images},before);
 assert.equal((await cache.lookupIds([book.id]))[book.id].name,book.name);assert.deepEqual({lookups,searches,images},before);
});
test('missing token art retains a text template and reports a retryable warning',async t=>{
 const maker={name:'Maker',oracle_text:'Create a 1/1 green Warrior creature token.'};
 const cache=createCardCache({directory:await directory(t),client:{collection:async()=>({data:[maker]}),searchTokens:async()=>[]},fetchImpl:async()=>imageResponse()});
 await cache.lookupBatch(['Maker']);const reserve=await cache.lookupTokens(['Maker']);assert.equal(reserve.tokens[0].name,'Warrior');assert.match(reserve.warnings.join(' '),/text template/);
});
