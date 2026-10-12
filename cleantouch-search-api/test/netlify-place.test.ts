import test from 'node:test';import assert from 'node:assert/strict';
import {GeminiPlaceChat} from '../src/place-provider.js';
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
