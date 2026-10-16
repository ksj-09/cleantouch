// Operator-only connectivity check. Prints status/reason, never keys or account IDs.
import fs from 'node:fs/promises';
import {GroundedSellerDiscovery,VisionSellerDiscovery} from '../dist/seller-discovery.js';
const image=await fs.readFile('../artifacts/verification/real-video-shopping-0.1.59.jpg');
const model=process.env.SIMILAR_SEARCH_MODEL||process.env.PLACE_CHAT_MODEL||'gemini-3.1-flash-lite';
const providers=[...(process.env.GOOGLE_VISION_API_KEY?[['vision',new VisionSellerDiscovery(process.env.GOOGLE_VISION_API_KEY)]]:[]),...(process.env.GEMINI_API_KEY?[['grounding',new GroundedSellerDiscovery(process.env.GEMINI_API_KEY,model)]]:[])];
const results=[];for(const [name,provider] of providers){try{const r=await provider.discover(image,'lightsaber toy',undefined,AbortSignal.timeout(25000));results.push({provider:name,state:r.state,sourceCount:r.sources.length,retryAfterSeconds:r.retryAfterSeconds});}catch{results.push({provider:name,state:'connection_failed',sourceCount:0});}}
const report={time:new Date().toISOString(),model,results,sourceRetrievalReady:results.some(r=>r.state==='ready'),secretValuesIncluded:false};
await fs.writeFile('../artifacts/verification/purchase-0.1.63-operator-access.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
