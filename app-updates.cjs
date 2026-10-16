const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

// The updater owns downloads in the main process. Renderers get a small status
// snapshot and fixed commands, never a URL or filesystem path to execute.
function createUpdateController({updater, version, supported, unavailableReason, notify = () => {}, confirmInstall = async () => false}) {
 let state = {status: supported ? 'idle' : 'unsupported', currentVersion: version, availableVersion: null, percent: 0,
  message: supported ? 'Check GitHub for a newer testing release.' : unavailableReason};
 let busy = false;
 const snapshot = () => ({...state});
 const publish = patch => {state = {...state, ...patch}; notify(snapshot());};
 const fail = error => {
  // Upstream errors can contain entire HTTP responses. Keep the UI concise.
  const missing = /NO_PUBLISHED_VERSIONS|CHANNEL_FILE_NOT_FOUND|LATEST_VERSION_NOT_FOUND/.test(error?.code || '');
  publish({status: 'error', message: missing
   ? 'No update-ready release was found on GitHub. Try again after the next release is published.'
   : 'Update failed. Check your connection and try again. ' + String(error?.message || error).split('\n')[0].slice(0, 180)});
 };
 if (supported) {
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = true;
  // Use the version's prerelease channel (currently "test"). Never downgrade.
  updater.allowDowngrade = false;
  updater.on('checking-for-update', () => publish({status: 'checking', message: 'Checking GitHub…'}));
  updater.on('update-available', info => publish({status: 'available', availableVersion: info.version, percent: 0, message: `Version ${info.version} is ready to download.`}));
  updater.on('update-not-available', () => publish({status: 'current', availableVersion: null, message: 'You have the latest release on this update channel.'}));
  updater.on('download-progress', info => publish({status: 'downloading', percent: Math.max(0, Math.min(100, Number(info.percent) || 0)), message: 'Downloading update… You can keep playing.'}));
  updater.on('update-downloaded', info => publish({status: 'downloaded', availableVersion: info.version, percent: 100, message: `Version ${info.version} downloaded. Restart when you are finished playing.`}));
  updater.on('error', fail);
 }
 async function command(action) {
  if (!supported || busy) return snapshot();
  const permitted = action === 'check' ? ['idle', 'current', 'available', 'error'].includes(state.status)
   : action === 'download' ? state.status === 'available'
   : action === 'install' && state.status === 'downloaded';
  if (!permitted) return snapshot();
  busy = true;
  try {
   if (action === 'check') {
    publish({status: 'checking', percent: 0, availableVersion: null, message: 'Checking GitHub…'});
    await updater.checkForUpdates();
   } else if (action === 'download') {
    publish({status: 'downloading', percent: 0, message: 'Downloading update… You can keep playing.'});
    await updater.downloadUpdate();
   } else if (await confirmInstall()) {
    publish({status: 'installing', message: 'Closing Commander Lab to install the update…'});
    updater.quitAndInstall(false, true);
   }
  } catch (error) {fail(error);} finally {busy = false;}
  return snapshot();
 }
 return {snapshot, command};
}

function installAppUpdates({app, ipcMain, dialog, getWindow}) {
 const installed = process.platform === 'win32' && app.isPackaged && fs.existsSync(path.join(path.dirname(app.getPath('exe')), 'Uninstall Commander Lab.exe'));
 const controller = createUpdateController({
  updater: installed ? require('electron-updater').autoUpdater : null,
  version: app.getVersion(), supported: installed,
  unavailableReason: app.isPackaged
   ? 'Install Commander Lab using the Windows setup.exe to enable in-app updates. ZIP builds must be replaced manually.'
   : 'This is a source build. In-app updates are available in the installed Windows app; update this checkout through Git.',
  notify: state => {const win = getWindow(); if (win && !win.isDestroyed()) win.webContents.send('app-update-state', state);},
  confirmInstall: async () => {
   const win = getWindow(); if (!win || win.isDestroyed()) return false;
   const result = await dialog.showMessageBox(win, {type: 'question', title: 'Install Commander Lab update?',
    message: 'Restart and install the downloaded update?',
    detail: 'Finish your game and save or export anything you need first. Restarting disconnects this player and ends any room hosted by this app. Your saved decks, settings and cached art are kept.',
    buttons: ['Keep playing', 'Restart & install'], defaultId: 0, cancelId: 0, noLink: true});
   return result.response === 1;
  }
 });
 const allowedFile = pathToFileURL(path.join(__dirname, 'index.html')).href;
 const trusted = event => event.sender === getWindow()?.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === allowedFile;
 for (const action of ['status', 'check', 'download', 'install']) {
  ipcMain.handle('app-update-' + action, event => {
   if (!trusted(event)) return {tableError: 'Untrusted update request.'};
   return action === 'status' ? controller.snapshot() : controller.command(action);
  });
 }
 return controller;
}
module.exports = {createUpdateController, installAppUpdates};
