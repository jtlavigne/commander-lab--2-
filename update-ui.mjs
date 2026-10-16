// Updates are independent of game state. Reopening Settings keeps download
// progress, and only the native confirmation can restart the application.
export function createUpdateSettings(dialog, bridge = window.appUpdates) {
 const section = document.createElement('section');
 section.className = 'update-settings';
 section.innerHTML = `<h3>App updates <small id="update-version"></small></h3>
  <p id="update-status" role="status" aria-live="polite">Loading update status…</p>
  <progress id="update-progress" max="100" value="0" aria-label="Update download progress" hidden></progress>
  <div class="update-actions"><button type="button" id="update-check" disabled>Check for updates</button>
   <button type="button" id="update-download" hidden>Download update</button>
   <button type="button" id="update-install" hidden>Restart &amp; install</button></div>`;
 dialog.querySelector('.dialog-heading').after(section);
 const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./update-ui.css', import.meta.url).href; document.head.append(css);
 const q = id => section.querySelector('#update-' + id);
 function render(state) {
  q('version').textContent = state.currentVersion ? 'v' + state.currentVersion : '';
  q('status').textContent = state.message;
  q('check').disabled = !['idle', 'current', 'available', 'error'].includes(state.status);
  q('download').hidden = state.status !== 'available';
  q('install').hidden = state.status !== 'downloaded';
  q('progress').hidden = state.status !== 'downloading';
  q('progress').value = state.percent || 0;
  if (state.status === 'downloading') q('status').textContent += ' ' + Math.floor(state.percent || 0) + '%';
 }
 async function run(action) {
  for (const name of ['check', 'download', 'install']) q(name).disabled = true;
  try {render(await bridge[action]());}
  catch {render({status: 'unsupported', message: 'Updates are unavailable in this build. Use the Windows installer from GitHub Releases.'});}
  finally {q('download').disabled = false; q('install').disabled = false;}
 }
 for (const action of ['check', 'download', 'install']) q(action).onclick = () => run(action);
 if (bridge) {bridge.onState(render); void run('status');}
 else render({status: 'unsupported', message: 'In-app updates are available in the installed Windows app.'});
}
