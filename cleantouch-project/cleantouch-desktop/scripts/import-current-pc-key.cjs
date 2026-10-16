const { app, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const source = path.resolve(__dirname, '../../cleantouch-search-api/.env');
app.setPath('userData', path.join(app.getPath('appData'), 'cleantouch-desktop'));

app.whenReady().then(async () => {
  const config = await fs.readFile(source, 'utf8');
  const line = config.split(/\r?\n/).find(value => /^GEMINI_API_KEY=/.test(value));
  const key = line?.slice('GEMINI_API_KEY='.length).trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!key) throw new Error('Local Gemini key is not configured.');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows encryption is unavailable.');
  const target = path.join(app.getPath('userData'), 'gemini-key.bin');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, safeStorage.encryptString(key), { mode: 0o600 });
  console.log('Gemini key imported into encrypted local storage.');
  app.quit();
}).catch(error => { console.error(error.message); app.exit(1); });
