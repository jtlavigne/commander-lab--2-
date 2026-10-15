const path=require('node:path');

// A separate user-data directory also gives Electron a separate instance lock.
function launchProfile(args,defaultDirectory){
 const flags=args.filter(arg=>arg==='--profile'||arg.startsWith('--profile='));
 if(!flags.length)return null;
 if(flags.length!==1||!/^--profile=[a-z0-9][a-z0-9_-]{0,31}$/i.test(flags[0]))throw new Error('Use --profile=NAME with 1-32 letters, numbers, underscores or hyphens.');
 const name=flags[0].slice('--profile='.length).toLowerCase();
 return {name,directory:path.join(defaultDirectory,'profiles',name)};
}
module.exports={launchProfile};
