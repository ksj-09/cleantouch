const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'browser-extension', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!manifest.key) {
  manifest.key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
const directory = path.join(root, 'vendor', 'timeline-host');
fs.mkdirSync(directory, { recursive: true });
execFileSync(path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/optimize+', '/target:exe', '/out:' + path.join(directory, 'CleanTouchVideoHost.exe'), path.join(root, 'native', 'VideoTimeHost.cs')], { windowsHide: true, stdio: 'inherit' });
console.log('Bundled Windows native video timeline host.');
