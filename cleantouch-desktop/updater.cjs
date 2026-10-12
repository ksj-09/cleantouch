// Installation is opt-in and blocked while capture or analysis is active.
function createUpdateController(updater, { supported = true, notify = () => {}, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let state = { status: supported ? 'idle' : 'unsupported', version: '', percent: 0, queued: false, busy: false };
  let timer;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  const send = patch => { state = { ...state, ...patch }; notify({ ...state }); return { ...state }; };
  function maybeInstall() {
    if (timer) cancel(timer);
    timer = undefined;
    if (!state.queued || state.busy || state.status !== 'downloaded') return;
    timer = schedule(() => {
      timer = undefined;
      if (!state.queued || state.busy || state.status !== 'downloaded') return;
      send({ status: 'installing', queued: false });
      updater.quitAndInstall(false, true);
    }, 1500);
  }
  updater.on('checking-for-update', () => send({ status: 'checking' }));
  updater.on('update-available', info => send({ status: 'available', version: info.version, queued: false }));
  updater.on('update-not-available', () => send({ status: 'current', queued: false }));
  updater.on('download-progress', progress => send({ status: 'downloading', percent: Math.round(progress.percent) }));
  updater.on('update-downloaded', info => { send({ status: 'downloaded', version: info.version, percent: 100 }); maybeInstall(); });
  updater.on('error', () => { if (timer) cancel(timer); timer = undefined; send({ status: 'error', queued: false }); });
  return {
    get: () => ({ ...state }),
    async check() {
      if (!supported || ['checking', 'downloading', 'downloaded', 'installing'].includes(state.status)) return { ...state };
      send({ status: 'checking' });
      try { await updater.checkForUpdates(); } catch { send({ status: 'error', queued: false }); }
      return { ...state };
    },
    async download() {
      if (!supported || state.status !== 'available') return { ...state };
      send({ status: 'downloading', percent: 0 });
      try { await updater.downloadUpdate(); } catch { send({ status: 'error', queued: false }); }
      return { ...state };
    },
    install() {
      if (supported && state.status === 'downloaded') { send({ queued: true }); maybeInstall(); }
      return { ...state };
    },
    defer() { if (timer) cancel(timer); timer = undefined; return send({ queued: false }); },
    activity(busy) {
      if (state.status === 'installing' || state.busy === Boolean(busy)) return { ...state };
      send({ busy: Boolean(busy) }); maybeInstall(); return { ...state };
    },
  };
}
module.exports = { createUpdateController };
