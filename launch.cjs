// Launch Electron with a clean child environment, including from Node-based hosts.
const {spawn}=require('node:child_process');
const env={...process.env};
delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(require('electron'),process.argv.slice(2),{stdio:'inherit',env,windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=code??1;if(signal)console.error('Electron exited with '+signal);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
