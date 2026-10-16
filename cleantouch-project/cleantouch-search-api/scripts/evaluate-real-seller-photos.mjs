// Controlled verification of REAL merchant photographs, independently of search.
// Candidate URLs are supplied by this evaluation, never installed in production.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import sharp from 'sharp';
import {GeminiPlaceChat} from '../dist/place-provider.js';import {loadSellerPhoto} from '../dist/seller-photo.js';
const urls=['https://www.soundcore.com/products/liberty-4-a3953z11','https://www.soundcore.com/products/liberty-4-a3953z21'];
const photos=new Map();for(const url of urls){const p=await loadSellerPhoto(url,AbortSignal.timeout(20000));assert(p,'Real merchant photo unavailable: '+url);photos.set(url,p);}
const source=photos.get(urls[0]);
const target=await sharp(source.bytes).extract({left:55,top:80,width:300,height:470}).resize({width:360}).jpeg({quality:90}).toBuffer();
const discovery={discover:async()=>({state:'ready',sources:urls.map(uri=>({uri,title:photos.get(uri).title})),findings:'Candidate URLs supplied by a controlled evaluation. Validate using the actual photographs only.'})};
const responses=[];
const request=async(...args)=>{const r=await fetch(...args);const body=await r.clone().json();responses.push({status:r.status,finishReason:body.candidates?.[0]?.finishReason,text:body.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text).join(''),usage:body.usageMetadata});return r;};
const provider=new GeminiPlaceChat(undefined,undefined,request,async url=>photos.get(url)||null,discovery);
const positive=await provider.findSimilarProducts(target,'검은 무선 이어폰');
await fs.writeFile('../artifacts/verification/purchase-0.1.63-real-comparison-debug.json',JSON.stringify({responses,stage:positive.comparisonStage,notice:positive.notice},null,2));
assert(positive.candidates.some(c=>c.url===urls[0]),'Matching real photograph was not retained');
assert(!positive.candidates.some(c=>c.url===urls[1]),'A different colour option was retained');
assert(positive.candidates.every(c=>c.matchType==='visual_similar'),'Appearance alone became an identified model');
const negative=await sharp('../artifacts/verification/real-video-selected-0.1.59.png').flatten({background:'#fff'}).jpeg({quality:91}).toBuffer();
const absent=await provider.findSimilarProducts(negative,'빨간색 광선검');assert.equal(absent.candidates.length,0,'Unrelated category retained');
const strip=value=>({...value,candidates:value.candidates.map(({image,...c})=>({...c,sellerPhotoPresent:Boolean(image)}))});
const report={time:new Date().toISOString(),scope:'Controlled real-photograph verification with candidate URLs supplied by the evaluator. This does not prove live search access or general accuracy.',sourceUrls:urls,samePhotoRetained:true,wrongColourRejected:true,wrongCategoryRejected:true,unreadableModelNotInvented:true,positive:strip(positive),negative:strip(absent)};
await fs.writeFile('../artifacts/verification/purchase-0.1.63-real-comparison.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
