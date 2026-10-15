import {test} from 'node:test';
import assert from 'node:assert/strict';
import discovery from '../multiplayer/discovery.cjs';
test('local network discovery finds rooms without broadcasting hands, credentials or deck data',async t=>{
 const port=39000+Math.floor(Math.random()*1000),code='abcdefghijklmnop',host=await discovery.advertise(()=>[{code,name:'Local table',format:'commander',capacity:3,occupied:1,port:32109}],{port});t.after(()=>host.close());
 const rooms=await discovery.discover({port,duration:350});assert.equal(rooms.length,1);assert.equal(rooms[0].code,code);assert.match(rooms[0].url,/^ws:\/\/[\d.]+:32109$/);assert.equal(rooms[0].capacity,3);assert.deepEqual(Object.keys(rooms[0]).sort(),['capacity','code','format','name','occupied','url']);
});
test('no hosted rooms produces an empty result after a bounded search',async()=>{assert.deepEqual(await discovery.discover({port:39999,duration:100}),[]);});
