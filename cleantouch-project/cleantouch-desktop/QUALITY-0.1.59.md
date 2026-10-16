# CleanTouch 0.1.59 — Windows verification

## Changes

- Restore Electron display capture: its empty media permission request is accepted only for the main application frame with an explicit, unexpired capture grant. Camera access remains denied. Screen capture is still video only and consumes a single-use grant.
- Enumerate visible browser windows instead of relying on one process MainWindowHandle when finding YouTube or Instagram videos.
- Accept an omitted or empty optional product name for first-time product identification. Invalid target values remain rejected.
- Send an explicitly selected photo into a newly started native voice conversation; ordinary chat does not automatically start screen sharing or microphone access.
- Improve point selection for narrow bright objects with additional local segmentation prompts and person exclusion. This is a geometric hint, not a product-category recognizer.
- Supply the selected object's original image as contextual evidence, with its selection box marked. Uploaded photos never inherit unrelated screen history. Ask the model to use size and context instead of guessing from an isolated shape.
- Remove Electron IPC prefixes from user-facing errors without losing the actual error message.

## Validation

- Desktop unit suite: 126 passed. API suite: 78 passed.
- Native Electron display-capture test: unauthorized capture rejected, camera rejected, explicitly authorized video capture succeeds and its tracks are stopped.
- Electron chat, upload/history, voice input/release, echo gating and selection quality integration checks passed.
- Actual captured YouTube scene processed by the local selection models. The revised selection excludes the person's legs/body at the checked background point; a small clothing fragment remains near the blade. It is not a perfect object silhouette.
- Actual AI request to the deployed 0.1.59 draft, with an empty target and original-image context, returned `빨간색 광선검 장난감`, high confidence, with an identical shopping query. This is one observed example, not a general accuracy benchmark.
- Generated Korean purchase speech was recognized through native Live voice using the actual selected photo and shopping tool. Search produced the correct keyword but seller-candidate retrieval hit an external quota. No verified seller, stock or price was obtained; no purchase was made.
- Packaged ASAR version 0.1.59 matches nine changed desktop runtime files byte for byte.

## Limits

The original browser window became unavailable to desktop automation; an attempt to open a new test browser window was rejected by automatic approval review. Actual public-video still-image analysis and native screen capture were therefore verified separately, not as one uninterrupted live-video flow. No ambient microphone recording was used. Real speaker/microphone acoustics, broad product accuracy and durable public-service authentication/quotas still need further validation. Android was not changed or rebuilt in this patch.
