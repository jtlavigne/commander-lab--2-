import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readdir,writeFile} from 'node:fs/promises';

// Stream large installers instead of loading each Electron bundle into memory.
const directory=new URL('../release/',import.meta.url);
const files=(await readdir(directory)).filter(name=>/^Commander-Lab-.*\.(exe|zip)$/.test(name)).sort();
if(files.length!==2)throw Error('Expected one Windows installer and one ZIP; start with a clean release directory.');
const lines=[];
for(const name of files){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(new URL(name,directory)))hash.update(chunk);
 lines.push(hash.digest('hex')+'  '+name);
}
await writeFile(new URL('SHA256SUMS.txt',directory),lines.join('\n')+'\n');
console.log(lines.join('\n'));
