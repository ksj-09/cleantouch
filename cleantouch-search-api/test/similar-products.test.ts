import test from 'node:test';import assert from 'node:assert/strict';
import {GeminiPlaceChat} from '../src/place-provider.js';
import {LIVE_SETUP} from '../src/live-token.js';
test('similar recommendations retain only grounded source URLs and omit fabricated links and indexes',async()=>{
 let calls=0;
 const request:typeof fetch=async(_url,init)=>{calls++;const sent=JSON.parse(String(init?.body));assert.equal(sent.contents[0].parts[0].inlineData.data,'YWJj');
  if(calls===1){assert(sent.tools[0].googleSearch);return Response.json({candidates:[{content:{parts:[{text:'검은 사각 숄더백 판매 페이지를 확인했습니다.'}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://shop.example.com/black-bag',title:'검은 숄더백 판매'}},{web:{uri:'javascript:alert(1)',title:'bad'}}]}}]});}
  assert(sent.systemInstruction.parts[0].text.includes('형태가 가까운'));return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({candidates:[{sourceIndex:0,name:'검은 숄더백',features:'검은색 사각형',url:'https://invented.example.com'},{sourceIndex:99,name:'허위 상품',features:'없음'},{sourceIndex:0,name:'중복',features:'중복'}]})}]}}]});};
 const result=await new GeminiPlaceChat('test','model',request).findSimilarProducts(Buffer.from('abc'),'검은 가방');assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].url,'https://shop.example.com/black-bag');assert(result.notice.includes('판매 사진'));assert.equal(calls,2);
});
test('missing grounded results return usable search guidance without inventing products',async()=>{
 let calls=0;const request:typeof fetch=async()=>{calls++;return Response.json({candidates:[{content:{parts:[{text:'명확한 상품 없음'}]}}]});};
 const result=await new GeminiPlaceChat('test','model',request).findSimilarProducts(Buffer.from('abc'),'파란 머그컵');assert.deepEqual(result.candidates,[]);assert(result.notice.includes('Lens'));assert.equal(calls,1);
});
test('Live purchase guidance calls a general-purpose similarity tool without requiring a brand',()=>{
 const setup:any=LIVE_SETUP;const tool=setup.tools[0].functionDeclarations[0];assert.equal(tool.name,'find_similar_products');assert.deepEqual(tool.parameters.required,['query','reason']);assert(setup.systemInstruction.parts[0].text.includes('반드시'));assert(setup.systemInstruction.parts[0].text.includes('유사율 숫자'));
});
