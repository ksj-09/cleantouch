import fs from 'node:fs/promises';import {GeminiPlaceChat} from '../dist/place-provider.js';
const bytes=await fs.readFile('../artifacts/verification/release-0.1.36-video.jpg');
const diagnostics=[];
const request=async(url,init)=>{const r=await fetch(url,init);const body=await r.clone().json();diagnostics.push({status:r.status,errorCode:body.error?.status,error:body.error?.message?.replaceAll(process.env.GEMINI_API_KEY||'NO_KEY','[key]').replace(/\d{7,}/g,'[id]').slice(0,600),toolUnsupported:/not supported|unsupported/i.test(body.error?.message||''),billingRequired:/billing|paid/i.test(body.error?.message||''),answer:body.candidates?.[0]?.content?.parts?.filter(p=>!p.thought&&p.text).map(p=>p.text).join('').slice(0,300),groundingSources:body.candidates?.[0]?.groundingMetadata?.groundingChunks?.length||0});return r;};
const result=await new GeminiPlaceChat(undefined,undefined,request).findSimilarProducts(bytes,'빨간색 광선검 장난감');
await fs.writeFile('../artifacts/verification/similar-provider-probe.json',JSON.stringify({diagnostics,result},null,2));console.log(JSON.stringify({diagnostics,result}));
