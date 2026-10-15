const {fork}=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const children=[];
function launch(name){
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=fork(path.join(__dirname,'fixtures','profile-instance.cjs'),['--profile='+name],{execPath:require('electron'),env,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});children.push(child);
 const exited=new Promise(resolve=>child.once('exit',code=>resolve(code)));
 const ready=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Profile startup timed out: '+name)),15000);child.once('message',message=>{clearTimeout(timeout);resolve(message);});child.once('error',reject);child.once('exit',()=>{clearTimeout(timeout);resolve(null);});});
 let id=0;
 const run=script=>new Promise((resolve,reject)=>{const key=++id,timeout=setTimeout(()=>{child.off('message',listen);reject(Error('Profile renderer timed out'));},5000),listen=message=>{if(message.id!==key)return;clearTimeout(timeout);child.off('message',listen);message.error?reject(Error(message.error)):resolve(message.result);};child.on('message',listen);child.send({id:key,script});});
 return {child,ready,exited,run};
}
(async()=>{
 try{
  const one=launch('qa-player1'),first=await one.ready;assert.ok(first?.ready);
  const two=launch('qa-player2'),second=await two.ready;assert.ok(second?.ready);assert.notEqual(first.directory,second.directory);
  await one.run("localStorage.setItem('profile-test','one')");await two.run("localStorage.setItem('profile-test','two')");assert.equal(await one.run("localStorage.getItem('profile-test')"),'one');assert.equal(await two.run("localStorage.getItem('profile-test')"),'two');
  const duplicate=launch('qa-player2');assert.equal(await duplicate.ready,null);assert.equal(await duplicate.exited,0);assert.equal(await two.run("localStorage.getItem('profile-test')"),'two');
  one.child.send({quit:true});two.child.send({quit:true});await Promise.all([one.exited,two.exited]);console.log('Desktop profiles passed: two actual app processes open together, independent storage, and duplicate-profile instance locking.');
 }finally{for(const child of children)if(child.exitCode===null)child.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
