import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readdir,writeFile,readFile} from 'node:fs/promises';
import yaml from 'js-yaml';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Stream large installers instead of loading each Electron bundle into memory.
const directory=process.argv[2]?pathToFileURL(path.resolve(process.argv[2])+path.sep):new URL('../release/',import.meta.url);
const names=await readdir(directory);
const downloads=names.filter(name=>/^Commander-Lab-.*\.(exe|zip)$/.test(name)).sort();
if(downloads.length!==2)throw Error('Expected one Windows installer and one ZIP; start with a clean release directory.');
// Fail the build before publishing an installer whose update feed is missing or
// points at a different release. GitHub needs these files alongside setup.exe.
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const channel=version.split('-')[1]?.split('.')[0]||'latest';
const metadata=yaml.load(await readFile(new URL(channel+'.yml',directory),'utf8'));
if(metadata.version!==version)throw Error('Update metadata version does not match package.json.');
const installer=downloads.find(name=>name.endsWith('-setup.exe'));
const entry=metadata.files?.find(file=>file.url===installer);
if(!entry?.sha512)throw Error('Update metadata does not reference the Windows installer.');
const installerHash=createHash('sha512');
for await(const chunk of createReadStream(new URL(installer,directory)))installerHash.update(chunk);
if(installerHash.digest('base64')!==entry.sha512)throw Error('Installer checksum does not match update metadata.');
if(!names.includes(installer+'.blockmap'))throw Error('Installer blockmap is missing.');
const files=[...downloads,...names.filter(name=>/^(latest|test|alpha|beta)\.yml$/.test(name)||name.endsWith('.blockmap'))].sort();
const lines=[];
for(const name of files){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(new URL(name,directory)))hash.update(chunk);
 lines.push(hash.digest('hex')+'  '+name);
}
await writeFile(new URL('SHA256SUMS.txt',directory),lines.join('\n')+'\n');
console.log(lines.join('\n'));
