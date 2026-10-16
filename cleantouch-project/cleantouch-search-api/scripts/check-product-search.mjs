import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const image=await sharp('../cleantouch-android/app/src/androidTest/assets/bag.png').flatten({background:'#fff'}).resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).jpeg().toBuffer();
const response=await fetch('https://cleantouch-place-ai-20261006.netlify.app/v1/place-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task:'product',image:image.toString('base64'),messages:[{role:'user',text:'선택한 상품 분석'}]}),signal:AbortSignal.timeout(60000)});
const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert(data.label);if(data.query){assert.equal(data.label,data.query);assert.equal(new URL(data.shoppingUrl).searchParams.get('q'),data.label);}
await fs.writeFile('../artifacts/verification/product-search-public.json',JSON.stringify(data,null,2));console.log(JSON.stringify(data));
