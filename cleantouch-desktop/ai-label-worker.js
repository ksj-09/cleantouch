import { AutoTokenizer, AutoProcessor, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage, env } from './vendor/product-ai/transformers.min.js';
import './ai-categories.js';
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = new URL('./vendor/product-ai/models/', import.meta.url).href;
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/product-ai/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;
let loading;
async function load() {
  if (!loading) loading = (async () => {
    const options = { dtype: 'q8', device: 'wasm', local_files_only: true };
    const tokenizer = await AutoTokenizer.from_pretrained('clip', options);
    const processor = await AutoProcessor.from_pretrained('clip', options);
    const textModel = await CLIPTextModelWithProjection.from_pretrained('clip', options);
    let textEmbeddings;
    try {
      const input = tokenizer(productAI.categories.map(item => `This is a photo of ${item[2]}.`), { padding: true, truncation: true });
      const output = await textModel(input);
      const width = output.text_embeds.dims[1];
      textEmbeddings = productAI.categories.map((_, i) => Array.from(output.text_embeds.data.slice(i * width, (i + 1) * width)));
    } finally { await textModel.dispose(); }
    const visionModel = await CLIPVisionModelWithProjection.from_pretrained('clip', options);
    return { processor, visionModel, textEmbeddings };
  })().catch(error => { loading = null; throw error; });
  return loading;
}
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.catch(() => {}).then(async () => {
    try {
      const model = await load();
      if (!data.blob) { self.postMessage({ id: data.id, ready: true }); return; }
      // Transparent cut-outs need a neutral background rather than black pixels
      // where alpha was removed, particularly for black bags and straps.
      const bitmap=await createImageBitmap(data.blob);
      const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
      const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0);bitmap.close();
      const image = await RawImage.fromBlob(await canvas.convertToBlob({type:'image/png'}));
      const input = await model.processor(image);
      const output = await model.visionModel(input);
      const embedding = Array.from(output.image_embeds.data);
      const scores = model.textEmbeddings.map(vector => productAI.cosine(vector, embedding));
      self.postMessage({ id: data.id, ...productAI.selectLabel(scores), embedding });
    } catch (error) { self.postMessage({ id: data.id, error: error.message || String(error) }); }
  });
};
