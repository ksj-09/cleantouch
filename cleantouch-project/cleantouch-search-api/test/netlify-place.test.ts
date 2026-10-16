import test from 'node:test';import assert from 'node:assert/strict';
import {GeminiPlaceChat} from '../src/place-provider.js';
process.env.USAGE_GUARD_MODE='off'; // Existing provider contracts isolate quota infrastructure.
process.env.GEMINI_API_KEY='test-only-netlify';
test('hosted admission fails closed on storage errors and rejects forged device headers before AI',async()=>{
 const {handler}=await import('../netlify/functions/place-chat.mjs'),{postgresUsage}=await import('../dist/usage-guard.js'),{GeminiPlaceChat:Provider}=await import('../dist/place-provider.js');
 const sharp=(await import('sharp')).default,image=(await sharp({create:{width:32,height:32,channels:3,background:'white'}}).jpeg().toBuffer()).toString('base64');
 const original=postgresUsage.reserve,identify=Provider.prototype.identifyProduct;let ai=0,storage=0;
 const before=process.env.USAGE_IDENTITY_SECRET;process.env.USAGE_IDENTITY_SECRET='s'.repeat(32);process.env.USAGE_GUARD_MODE='required';process.env.GEMINI_API_KEY='test-only-netlify';
 Provider.prototype.identifyProduct=async()=>{ai++;return {label:'가방',query:'가방',reason:'visible',confidence:'high',shoppingUrl:''};};
 const event={httpMethod:'POST',path:'/v1/place-chat',headers:{'x-nf-client-connection-ip':'guard-contract'},body:JSON.stringify({task:'product',image,messages:[{role:'user',text:'상품 분석'}]})};
 try{
  postgresUsage.reserve=async()=>{storage++;throw Error('private database failure');};let r=await handler(event);assert.equal(r.statusCode,503);assert.equal(ai,0);assert.equal(storage,1);assert(!r.body.includes('private database'));
  r=await handler({...event,headers:{...event.headers,'x-ct-signature':'forged'}});assert.equal(r.statusCode,401);assert.equal(storage,1);
  postgresUsage.reserve=async()=>({allowed:false,reason:'replay',remaining:0,retry_seconds:0});r=await handler(event);assert.equal(r.statusCode,409);assert.equal(ai,0);
 }finally{postgresUsage.reserve=original;Provider.prototype.identifyProduct=identify;process.env.USAGE_GUARD_MODE='off';if(before===undefined)delete process.env.USAGE_IDENTITY_SECRET;else process.env.USAGE_IDENTITY_SECRET=before;delete process.env.GEMINI_API_KEY;}
});
test('Netlify function contract excludes keys and rejects non-image uploads',async()=>{
 process.env.GEMINI_API_KEY='test-only-netlify';
 // The deployment function imports compiled output; test provider configuration and validation without upstream calls.
 const {handler}=await import('../netlify/functions/place-chat.mjs');
 let result=await handler({httpMethod:'GET',path:'/v1/place-chat/health',headers:{}});assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).configured,true);assert(!result.body.includes('test-only-netlify'));
 result=await handler({httpMethod:'POST',path:'/v1/place-chat',headers:{},body:JSON.stringify({image:Buffer.from('not a photo').toString('base64'),messages:[{role:'user',text:'이 장소 분석해줘'}]})});assert.equal(result.statusCode,400);
 result=await handler({httpMethod:'POST',path:'/v1/place-chat',headers:{},body:'broken'});assert.equal(result.statusCode,400);
 for(const body of ['null','[]',JSON.stringify({image:Buffer.from([255,216,255,0]).toString('base64'),messages:[{role:'user',text:'사진 분석'}]})]){
  result=await handler({httpMethod:'POST',path:'/v1/place-chat',headers:{},body});assert.equal(result.statusCode,400);
 }
 delete process.env.GEMINI_API_KEY;
});
test('AI connection bursts permit normal retries and retain a configurable rate limit',async()=>{
 const originalFetch=globalThis.fetch,oldLimit=process.env.LIVE_CHAT_CONNECTIONS_PER_MINUTE;
 process.env.GEMINI_API_KEY='test-only-netlify';process.env.LIVE_CHAT_CONNECTIONS_PER_MINUTE='3';
 globalThis.fetch=async()=>new Response(JSON.stringify({name:'auth_tokens/test-only'}),{status:200});
 try{const {handler}=await import('../netlify/functions/place-chat.mjs');const event={httpMethod:'POST',path:'/v1/place-chat',headers:{'x-nf-client-connection-ip':'connection-policy-fixture'},body:JSON.stringify({task:'live-token',shoppingTools:true})};
  for(let i=0;i<3;i++){const result=await handler(event);assert.equal(result.statusCode,200,'A normal third connection must not be blocked');}
  const limited=await handler(event),body=JSON.parse(limited.body);assert.equal(limited.statusCode,429);assert(body.retryAfterSeconds>0&&body.retryAfterSeconds<=60);assert(!body.message.includes('화면 공유'));assert(!limited.body.includes('test-only-netlify'));
 }finally{globalThis.fetch=originalFetch;delete process.env.GEMINI_API_KEY;if(oldLimit===undefined)delete process.env.LIVE_CHAT_CONNECTIONS_PER_MINUTE;else process.env.LIVE_CHAT_CONNECTIONS_PER_MINUTE=oldLimit;}
});
test('deployed product route accepts older clients that send an empty optional name',async()=>{
 const {GeminiPlaceChat:DeployedProvider}=await import('../dist/place-provider.js');const sharp=(await import('sharp')).default,original=DeployedProvider.prototype.identifyProduct;let calls=0;process.env.GEMINI_API_KEY='test-only-netlify';
 DeployedProvider.prototype.identifyProduct=async(_image,_signal,target='')=>{assert.equal(target,'');calls++;return {label:'가방',query:'가방',confidence:'high',reason:'사진에서 확인',shoppingUrl:'https://www.google.com/search?tbm=shop&q=bag'};};
 try{const {handler}=await import('../netlify/functions/place-chat.mjs'),image=(await sharp({create:{width:64,height:64,channels:3,background:'white'}}).jpeg().toBuffer()).toString('base64');for(const target of ['',undefined]){const result=await handler({httpMethod:'POST',path:'/v1/place-chat',headers:{'x-nf-client-connection-ip':'product-empty-fixture'},body:JSON.stringify({task:'product',target,image,messages:[{role:'user',text:'선택 상품 분석'}]})});assert.equal(result.statusCode,200,result.body);}assert.equal(calls,2);}finally{DeployedProvider.prototype.identifyProduct=original;delete process.env.GEMINI_API_KEY;}
});
