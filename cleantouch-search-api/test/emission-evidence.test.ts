import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {whiteEmissionEvidence,colouredEmissionEvidence} from '../src/emission-evidence.js';
import {GeminiPlaceChat} from '../src/place-provider.js';

test('the real unlit blade that fooled Gemini has no confirmed emission evidence',async()=>{
 const frame=await sharp(await fs.readFile('../artifacts/verification/lightsaber-scene.png')).extract({left:407,top:214,width:394,height:599}).jpeg({quality:92}).toBuffer();
 assert.equal(whiteEmissionEvidence(frame,[463,308,626,503]),false);
 assert.equal(colouredEmissionEvidence(frame,[463,308,626,503]),false);
 const request:typeof fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({products:[
  {label:'흰색 광선검',confidence:'high',appearance:'stable',lightState:'lit',box:[463,308,626,503]},
  {label:'광선검',confidence:'high',appearance:'stable',lightState:'lit',box:[463,308,626,503]}
 ]})}]}}]}));
 const older=await fs.readFile('../artifacts/verification/live-clean-video.jpg');
 const result=await new GeminiPlaceChat('test','model',request).locateProducts(frame,undefined,[older]);
 assert.equal(result.products.length,0);
});
test('elongated clipped core and surrounding bright light provide positive evidence; a bright white patch does not',async()=>{
 const data=Buffer.alloc(100*100*3,20);
 for(let y=10;y<90;y++)for(let x=46;x<54;x++){
  const v=x>=49&&x<=51?255:240,i=(y*100+x)*3;data[i]=data[i+1]=data[i+2]=v;
 }
 const lit=await sharp(data,{raw:{width:100,height:100,channels:3}}).jpeg({quality:100}).toBuffer();
 assert(whiteEmissionEvidence(lit,[0,0,1000,1000]));
 const patch=await sharp({create:{width:100,height:100,channels:3,background:'white'}}).jpeg().toBuffer();
 assert.equal(whiteEmissionEvidence(patch,[0,0,1000,1000]),false);
 const request:typeof fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({products:[{label:'흰색 광선검',confidence:'high',appearance:'stable',lightState:'lit',box:[0,0,990,800]}]})}]}}]}));
 const neighbour=await sharp(data,{raw:{width:100,height:100,channels:3}}).jpeg({quality:99}).toBuffer();
 const result=await new GeminiPlaceChat('test','model',request).locateProducts(lit,undefined,[neighbour]);
 assert.equal(result.products[0]?.label,'흰색 광선검');assert(result.products[0].temporalVerified);
});
