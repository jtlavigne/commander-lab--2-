import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {createUpdateController,installAppUpdates}=require('../app-updates.cjs');

function fixture(options={}) {
 const updater=new EventEmitter(),calls=[],updates=[];
 updater.checkForUpdates=async()=>{calls.push('check');updater.emit('update-available',{version:'0.1.0-test.3'});};
 updater.downloadUpdate=async()=>{calls.push('download');updater.emit('download-progress',{percent:42});updater.emit('update-downloaded',{version:'0.1.0-test.3'});};
 updater.quitAndInstall=(...args)=>calls.push(['install',...args]);
 const controller=createUpdateController({updater,version:'0.1.0-test.2',supported:true,notify:s=>updates.push(s),confirmInstall:async()=>true,...options});
 return {updater,calls,updates,...controller};
}
test('updates require separate check, download and confirmed installation; no auto-install on exit',async()=>{
 const f=fixture();
 assert.equal(f.updater.autoDownload,false);assert.equal(f.updater.autoInstallOnAppQuit,false);
 assert.equal(f.updater.allowPrerelease,true);assert.equal(f.updater.allowDowngrade,false);
 await f.command('install');await f.command('download');assert.deepEqual(f.calls,[]);
 assert.equal((await f.command('check')).status,'available');assert.deepEqual(f.calls,['check']);
 assert.equal((await f.command('download')).status,'downloaded');assert.equal(f.updates.find(s=>s.percent===42).status,'downloading');
 await f.command('check');assert.deepEqual(f.calls,['check','download'],'pending installer must not be replaced by another check');
 assert.equal((await f.command('install')).status,'installing');assert.deepEqual(f.calls.at(-1),['install',false,true]);
 await f.command('install');assert.equal(f.calls.length,3);
});
test('cancelled restart leaves update ready and can be confirmed later',async()=>{
 let accept=false;const f=fixture({confirmInstall:async()=>accept});
 await f.command('check');await f.command('download');await f.command('install');
 assert.equal(f.snapshot().status,'downloaded');assert.equal(f.calls.length,2);
 accept=true;await f.command('install');assert.equal(f.calls.length,3);
});
test('offline, missing metadata, and failed downloads can be retried',async()=>{
 const f=fixture();f.updater.checkForUpdates=async()=>{throw Object.assign(Error('missing'),{code:'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'});};
 assert.match((await f.command('check')).message,/update-ready release/);
 f.updater.checkForUpdates=async()=>f.updater.emit('update-available',{version:'0.1.0-test.3'});
 await f.command('check');f.updater.downloadUpdate=async()=>{throw Error('offline');};
 assert.equal((await f.command('download')).status,'error');assert.match(f.snapshot().message,/offline/);
 f.updater.checkForUpdates=async()=>f.updater.emit('update-not-available');
 assert.equal((await f.command('check')).status,'current');
});
test('duplicate commands do not start overlapping requests',async()=>{
 const f=fixture();let finish;f.updater.checkForUpdates=()=>new Promise(resolve=>{f.calls.push('check');finish=resolve;});
 const first=f.command('check');await f.command('check');await f.command('download');assert.equal(f.calls.length,1);
 f.updater.emit('update-available',{version:'0.1.0-test.3'});finish();await first;
 assert.equal(f.snapshot().status,'available');
});
test('unsupported builds never contact updater; returned snapshots cannot mutate controller',async()=>{
 const f=fixture({supported:false,unavailableReason:'Use setup.exe'});
 for(const action of ['check','download','install'])assert.equal((await f.command(action)).status,'unsupported');
 assert.deepEqual(f.calls,[]);const copy=f.snapshot();copy.status='downloaded';assert.equal(f.snapshot().status,'unsupported');
});
test('update IPC rejects other windows and embedded frames',async()=>{
 const handlers=new Map(),frame={url:new URL('../index.html',import.meta.url).href},sender={mainFrame:frame};
 installAppUpdates({app:{isPackaged:false,getVersion:()=> '0.1.0-test.2'},ipcMain:{handle:(id,fn)=>handlers.set(id,fn)},dialog:{},getWindow:()=>({webContents:sender})});
 const status=handlers.get('app-update-status');
 assert.equal(status({sender,senderFrame:frame}).status,'unsupported');
 assert.match(status({sender:{mainFrame:frame},senderFrame:frame}).tableError,/Untrusted/);
 assert.match(status({sender,senderFrame:{url:frame.url}}).tableError,/Untrusted/);
 frame.url='https://example.com';assert.match(status({sender,senderFrame:frame}).tableError,/Untrusted/);
});

test('real GitHub provider selects test releases and their installer metadata; versions never downgrade',async()=>{
 const {GitHubProvider}=require('electron-updater/out/providers/GitHubProvider');
 const {AppUpdater}=require('electron-updater/out/AppUpdater');
 const yaml=require('js-yaml');
 const config=yaml.load(readFileSync(new URL('../electron-builder.yml',import.meta.url),'utf8')).publish;
 const requests=[],version='0.1.0-test.3',filename=`Commander-Lab-${version}-windows-x64-setup.exe`;
 const feed='<feed>'+['0.2.0-beta.1',version,'0.1.0-test.2'].map(v=>`<entry><title>Build ${v}</title><link href="https://github.com/${config.owner}/${config.repo}/releases/tag/v${v}"/><content>Testing</content></entry>`).join('')+'</feed>';
 const updater={allowPrerelease:true,allowDowngrade:false,currentVersion:'0.1.0-test.2',isUpdateSupported:()=>true,isUserWithinRollout:()=>true};
 const provider=new GitHubProvider(config,updater,{platform:'win32',executor:{request:async options=>{
  requests.push(options.path);return options.path.endsWith('.atom')?feed:yaml.dump({version,files:[{url:filename,sha512:'test-checksum'}]});
 }}});
 const info=await provider.getLatestVersion();assert.equal(info.version,version);
 assert.ok(requests[1].includes(`/releases/download/v${version}/test.yml`),requests[1]);
 assert.equal(provider.resolveFiles(info)[0].url.href,`https://github.com/${config.owner}/${config.repo}/releases/download/v${version}/${filename}`);
 assert.equal(await AppUpdater.prototype.isUpdateAvailable.call(updater,info),true);
 assert.equal(await AppUpdater.prototype.isUpdateAvailable.call(updater,{version:'0.1.0-test.2'}),false);
 assert.equal(await AppUpdater.prototype.isUpdateAvailable.call(updater,{version:'0.1.0-test.1'}),false);
});
