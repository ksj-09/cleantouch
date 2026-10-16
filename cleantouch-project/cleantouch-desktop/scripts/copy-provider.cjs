const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../../cleantouch-search-api/dist');
const target = path.resolve(__dirname, '../vendor');
fs.mkdirSync(target, { recursive: true });
for (const name of ['gemini-provider.js', 'rate-limit.js', 'provider-errors.js']) {
  fs.copyFileSync(path.join(source, name), path.join(target, name));
}
fs.writeFileSync(path.join(target, 'package.json'), '{"type":"module"}\n');
