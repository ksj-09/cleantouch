const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const root = path.resolve(__dirname, '..');
const revision = 'd15189d7028b43f1d3e65039190477f6af591c2a';
const vendor = path.join(root, 'vendor', 'product-ai');
async function main() {
  fs.mkdirSync(vendor, { recursive: true });
  fs.copyFileSync(path.join(root, 'node_modules', '@huggingface', 'transformers', 'LICENSE'), path.join(vendor, 'TRANSFORMERS-LICENSE.txt'));
  const library = path.join(root, 'node_modules', '@huggingface', 'transformers', 'dist');
  for (const name of ['transformers.min.js', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) {
    fs.copyFileSync(path.join(library, name), path.join(vendor, name));
  }
  const model = path.join(vendor, 'models', 'clip');
  const files = ['config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/text_model_quantized.onnx', 'onnx/vision_model_quantized.onnx'];
  for (const name of files) {
    const destination = path.join(model, name);
    if (fs.existsSync(destination) && fs.statSync(destination).size > 100) continue;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const response = await fetch(`https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/${revision}/${name}`);
    if (!response.ok) throw new Error(`AI model ${name}: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination + '.partial'));
    fs.renameSync(destination + '.partial', destination);
    console.log(`Bundled ${name} (${fs.statSync(destination).size} bytes)`);
  }
  fs.writeFileSync(path.join(model, 'SOURCE.txt'), `Xenova/clip-vit-base-patch32\nRevision: ${revision}\nUpstream model: openai/clip-vit-base-patch32\nLicense: MIT\nhttps://huggingface.co/Xenova/clip-vit-base-patch32\n`);
  const license = path.join(vendor, 'CLIP-LICENSE.txt');
  if (!fs.existsSync(license)) {
    const response = await fetch('https://raw.githubusercontent.com/openai/CLIP/main/LICENSE');
    if (!response.ok) throw new Error('Could not bundle the CLIP license');
    fs.writeFileSync(license, await response.text());
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
