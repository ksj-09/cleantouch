# Representative-frame collection engine — Windows 0.1.61

## Problem and changes

The old counter represented captured images, not detected cinematic scenes. Automatic one-second collection and fresh screen reads requested by chat/selection both appended work. Exact/near-exact duplicate filtering removed stationary images, but ordinary motion remained a new analysis job.

- Fresh screen reads now update the current image only. They do not append archive jobs or compute archive fingerprints/signatures. Screen sharing and the recent high-rate buffer remain separate from archive sampling.
- A local SceneCollector selects representatives using color/pixel differences, localized change and image detail. Ordinary motion gets a representative about every four seconds. Cuts/localized changes can use a bounded three-credit burst budget refilled once per three seconds. This is heuristic image sampling, not semantic AI scene or product detection.
- A sharper image can replace an unprocessed representative. Completed frames and frames in a running batch cannot be replaced.
- Keep up to two neighboring evidence images within 2.2 seconds for temporal validation; these are not separate full analysis jobs. Evidence cannot cross video identities, cannot recursively retain other evidence and counts toward the memory budget. Evidence images can still contribute to an AI request's image/token cost.
- Before batch analysis, compact older captured-image archives using the same selection policy. Completed frame objects retain their identity and results.
- Do not invalidate completed analysis merely because another neighboring image was collected. Counters now say representative images instead of implying each image is a distinct scene.

## Verification

- 138 unit tests passed, including 80 fresh screen reads adding no archive jobs, stationary/looped images, continuous motion, rapid cuts, localized new objects, sharper replacement, protected completed/in-flight frames, old-archive compaction, temporal evidence and memory accounting.
- Synthetic one-minute motion sequences produced 10–16 representatives; rapid changes at ten inputs/second stayed within 23 representatives in the tested first minute. These are policy tests, not product recall or token-cost benchmarks.
- Electron integration passed: analysis pauses collection, uses a finite queue, resumes while preserving scenes, cancels immediately and rejects stale operations.
- Electron product selection and scene grounding integration passed. Temporal tests reject duplicate bytes and other video identities; supported families included shirts, pants, shoes, handbags, phones and chairs.
- Existing live preview archive compacted from 85 images to 34 representatives; 29 retained supporting evidence. During a subsequent actual public YouTube fullscreen playback observation, 30,005 ms added nine representatives; capture was unblocked and memory accounting matched the retained frames plus evidence.
- Packaged 0.1.61 renderer and collection module match source byte for byte. The running development preview was updated without deleting conversations or restarting its capture stream.

## Limits

Sampling cannot guarantee every briefly visible product survives selection. Color/detail heuristics are not semantic understanding; lighting, motion and compression can affect grouping and sharpness ranking. Local capture itself does not incur Gemini tokens; costs occur on AI requests, including optional evidence. No measured billing reduction or real seller retrieval claim is made. This patch does not change the model, public API quota, seller-search availability or Android.
