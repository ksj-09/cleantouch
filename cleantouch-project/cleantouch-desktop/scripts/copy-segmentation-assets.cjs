const fs = require('node:fs');
const path = require('node:path');

const desktopRoot = path.resolve(__dirname, '..');
const packageRoot = path.join(desktopRoot, 'node_modules', '@mediapipe', 'tasks-vision');
const androidModel = path.resolve(desktopRoot, '..', 'cleantouch-android', 'app', 'src', 'main', 'assets', 'interactive_segmentation.task');
const androidDetector = path.resolve(desktopRoot, '..', 'cleantouch-android', 'app', 'src', 'main', 'assets', 'product_detector.tflite');
const assetRoot = path.join(desktopRoot, 'vendor', 'tasks-vision');
const wasmRoot = path.join(assetRoot, 'wasm');
const modelRoot = path.join(assetRoot, 'models');

fs.mkdirSync(wasmRoot, { recursive: true });
fs.mkdirSync(modelRoot, { recursive: true });
fs.copyFileSync(path.join(packageRoot, 'vision_bundle.js'), path.join(assetRoot, 'vision_bundle.js'));
for (const file of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  fs.copyFileSync(path.join(packageRoot, 'wasm', file), path.join(wasmRoot, file));
}
if (!fs.existsSync(androidModel)) throw new Error(`Bundled segmentation model is missing: ${androidModel}`);
fs.copyFileSync(androidModel, path.join(modelRoot, 'interactive_segmentation.task'));
if (!fs.existsSync(androidDetector)) throw new Error(`Bundled product detector is missing: ${androidDetector}`);
fs.copyFileSync(androidDetector, path.join(modelRoot, 'product_detector.tflite'));
console.log('Staged the local MediaPipe runtime, product detector, and MagicTouch model for Windows builds.');
