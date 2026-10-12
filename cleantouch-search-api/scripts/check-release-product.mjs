import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const photo=await sharp('../artifacts/verification/bag-whole-mask.png').flatten({background:'#fff'}).jpeg({quality:92}).toBuffer();
const response=await fetch('https://cleantouch-place-ai-20261006.netlify.app/v1/place-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task:'product',image:photo.toString('base64'),messages:[{role:'user',text:'선택한 상품 분석'}]}),signal:AbortSignal.timeout(55000)});
const body=await response.json();assert.equal(response.status,200,body.message);assert.match(body.label,/가방|백/);assert.equal(body.confidence==='low',false);assert.equal(body.query,body.label);assert.equal(new URL(body.shoppingUrl).searchParams.get('q'),body.label);
await fs.writeFile('../artifacts/verification/release-0.1.36-product.json',JSON.stringify(body,null,2));console.log(JSON.stringify({product:body.label,confidence:body.confidence,shoppingMatchesDisplayedName:true}));
