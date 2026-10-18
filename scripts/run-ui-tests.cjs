const {readdirSync} = require('node:fs');
const {spawn} = require('node:child_process');
const path = require('node:path');

// Each check gets a fresh process, in sequence, so Electron profiles and test
// ports cannot collide. New *-ui.cjs checks automatically join the full suite.
const root = path.resolve(__dirname, '..');
const tests = readdirSync(path.join(root, 'tests'))
 .filter(name => name === 'ui.cjs' || name.endsWith('-ui.cjs'))
 .sort();
const electronFlags = process.argv.includes('--reduced-motion') ? ['--force-prefers-reduced-motion'] : [];
let child;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child?.kill(signal));

async function main() {
 for (const name of tests) {
  console.log('\nUI check: ' + name);
  // This check launches multiple Electron processes itself from Node.
  const args = name === 'launch-profiles-ui.cjs'
   ? [path.join('tests', name)] : ['launch.cjs', ...electronFlags, path.join('tests', name)];
  const code = await new Promise((resolve, reject) => {
   child = spawn(process.execPath, args, {cwd: root, stdio: 'inherit', windowsHide: true});
   child.once('error', reject);
   child.once('exit', code => resolve(code ?? 1));
  });
  if (code !== 0) {process.exitCode = code; return;}
 }
 console.log('\nAll ' + tests.length + ' UI checks passed.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
