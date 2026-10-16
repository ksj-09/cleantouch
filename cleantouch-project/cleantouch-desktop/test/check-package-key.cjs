const fs = require('node:fs');
const path = require('node:path');

const config = fs.readFileSync(path.resolve(__dirname, '../../cleantouch-search-api/.env'), 'utf8');
const line = config.split(/\r?\n/).find(item => item.startsWith('GEMINI_API_KEY='));
let key = line?.slice('GEMINI_API_KEY='.length).trim();
if (!key) throw new Error('Local key is not configured.');
if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
const { version } = require('../package.json');
for (const file of [`CleanTouch ${version}.exe`, `CleanTouch Setup ${version}.exe`]) {
  if (fs.readFileSync(path.resolve(__dirname, '..', process.env.CLEANTOUCH_BUILD_DIR||'dist', file)).includes(Buffer.from(key))) {
    throw new Error(`${file} contains the local API key.`);
  }
}
console.log('Neither Windows installer contains the local Gemini key.');
