let screenOCR;
let screenWatchBusy = false;
async function observeScreenTimeline(video, timeline) {
  if (screenWatchBusy || (video.readyState !== undefined && video.readyState < 2) || !(video.videoWidth || video.width)) return;
  screenWatchBusy = true;
  try {
    if (!screenOCR) screenOCR = Tesseract.createWorker('eng', 1, {
      workerPath: new URL('vendor/screen-ocr/worker.min.js', document.baseURI).href,
      corePath: new URL('vendor/screen-ocr/', document.baseURI).href,
      langPath: new URL('vendor/screen-ocr/', document.baseURI).href,
      workerBlobURL: false, gzip: true,
    }).catch(error => { screenOCR = null; throw error; });
    const worker = await screenOCR;
    const canvas = document.createElement('canvas');
    const width=video.videoWidth||video.width,height=video.videoHeight||video.height;
    const scale = Math.min(1, 960 / Math.max(width, height));
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const result = await worker.recognize(canvas);
    timeline.observe(watchTime.parseScreenText(result.data.text));
  } catch (error) { console.warn('Screen time recognition unavailable:', error.message); }
  finally { screenWatchBusy = false; }
}
