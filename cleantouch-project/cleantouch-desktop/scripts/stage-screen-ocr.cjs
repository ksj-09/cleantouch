const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const root = path.resolve(__dirname, '..'); const destination = path.join(root, 'vendor', 'screen-ocr');
  fs.mkdirSync(destination, { recursive: true });
  for (const file of ['tesseract.min.js', 'worker.min.js']) fs.copyFileSync(path.join(root, 'node_modules/tesseract.js/dist', file), path.join(destination, file));
  const core = path.join(root, 'node_modules/tesseract.js-core');
  for (const name of fs.readdirSync(core).filter(name => /\.wasm(?:\.js)?$/.test(name))) fs.copyFileSync(path.join(core, name), path.join(destination, name));
  const language = path.join(destination, 'eng.traineddata.gz');
  if (!fs.existsSync(language)) {
    const response = await fetch('https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast/eng.traineddata.gz');
    if (!response.ok) throw new Error('Could not bundle screen text recognition');
    fs.writeFileSync(language, Buffer.from(await response.arrayBuffer()));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
