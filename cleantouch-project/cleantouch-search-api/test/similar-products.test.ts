import {createHash} from 'node:crypto';
const ref=(url:string)=>'seller_'+createHash('sha256').update(url).digest('hex').slice(0,16);
import test from 'node:test';import assert from 'node:assert/strict';
import {GeminiPlaceChat} from '../src/place-provider.js';
import {LIVE_SETUP} from '../src/live-token.js';
test('seller references bind results to the correct photo even when the model reorders candidates',async()=>{
 const urls=['https://shop.example.com/products/black','https://shop.example.com/products/white'];
 const discovery={discover:async()=>({state:'ready' as const,sources:urls.map(uri=>({uri,title:uri})),findings:''})};
 const provider=new GeminiPlaceChat('key','model',async(_url,init)=>{
  const payload=JSON.parse(String(init?.body));assert.deepEqual(payload.generationConfig.responseJsonSchema.properties.candidates.items.properties.sourceId.enum,urls.map(ref));
  const evidence={name:'bag',features:'matching structure',matchLevel:'high',categoryMatch:'yes',structureMatch:'yes',variantMatch:'yes',differences:[]};
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({candidates:[{...evidence,sourceId:ref(urls[1])},{...evidence,sourceId:'seller_1',sourceIndex:1},{...evidence,sourceId:ref(urls[0])}]})}]}}]});
 },async url=>({pageUrl:url,title:url,bytes:Buffer.from(url),preview:Buffer.from(url).toString('base64')}),discovery);
 const result=await provider.findSimilarProducts(Buffer.from('target'),'bag');assert.deepEqual(result.candidates.map(c=>c.url),[urls[1],urls[0]]);for(const c of result.candidates)assert.equal(Buffer.from(c.image!,'base64').toString(),c.url);
});
test('a high rating cannot override conflicting category, structure or product options',async()=>{
 const controls=[{categoryMatch:'no',structureMatch:'yes',variantMatch:'yes'},{categoryMatch:'yes',structureMatch:'unknown',variantMatch:'yes'},{categoryMatch:'yes',structureMatch:'yes',variantMatch:'no'},{categoryMatch:'yes',structureMatch:'yes',variantMatch:'unknown'}];
 for(const evidence of controls){
  const request:typeof fetch=async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({candidates:[{sourceId:ref('https://shop.example.com/products/1'),name:'bag',features:'same colour',matchLevel:'high',differences:[],...evidence}]})}]}}]});
  const discovery={discover:async()=>({state:'ready' as const,sources:[{uri:'https://shop.example.com/products/1',title:'bag'}],findings:''})};
  const provider=new GeminiPlaceChat('test','vision-model',request,async()=>({pageUrl:'https://shop.example.com/products/1',title:'bag',bytes:Buffer.from('seller'),preview:'c2VsbGVy'}),discovery);
  const result=await provider.findSimilarProducts(Buffer.from('target'),'bag');assert.equal(result.candidates.length,evidence.variantMatch==='unknown'?1:0,JSON.stringify(evidence));
 }
});
test('configured search model does not change the model used to compare actual photographs',async()=>{
 const original=process.env.SIMILAR_SEARCH_MODEL;process.env.SIMILAR_SEARCH_MODEL='search-only-model';
 try{
  const provider=new GeminiPlaceChat('key','vision-model',async url=>{assert(String(url).includes('vision-model'));return Response.json({candidates:[{content:{parts:[{text:'{"candidates":[]}'}]}}]});},async()=>({pageUrl:'https://shop.example.com/products/1',title:'bag',bytes:Buffer.from('seller'),preview:'c2VsbGVy'}),{discover:async()=>({state:'ready',sources:[{uri:'https://shop.example.com/products/1',title:'bag'}],findings:''})});
  await provider.findSimilarProducts(Buffer.from('target'),'bag');
 }finally{if(original===undefined)delete process.env.SIMILAR_SEARCH_MODEL;else process.env.SIMILAR_SEARCH_MODEL=original;}
});
test('similar recommendations retain only grounded source URLs and omit fabricated links and indexes',async()=>{
 let calls=0;
 const request:typeof fetch=async(_url,init)=>{calls++;const sent=JSON.parse(String(init?.body));assert.equal(sent.contents[0].parts.find((p:any)=>p.inlineData).inlineData.data,'YWJj');
  if(calls===1){assert(sent.tools[0].googleSearch);return Response.json({candidates:[{content:{parts:[{text:'검은 사각 숄더백 판매 페이지를 확인했습니다.'}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://shop.example.com/black-bag',title:'검은 숄더백 판매'}},{web:{uri:'javascript:alert(1)',title:'bad'}}]}}]});}
  assert(sent.systemInstruction.parts[0].text.includes('실제 사진 비교'));assert.equal(sent.contents[0].parts.filter((p:any)=>p.inlineData).length,2);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({candidates:[{sourceId:ref('https://shop.example.com/black-bag'),name:'검은 숄더백',features:'검은색 사각형',matchLevel:'high',categoryMatch:'yes',structureMatch:'yes',variantMatch:'unknown',differences:[],url:'https://invented.example.com'},{sourceId:'invented_ref',name:'허위 상품',features:'없음',matchLevel:'high',categoryMatch:'yes',structureMatch:'yes',variantMatch:'unknown',differences:[]},{sourceId:ref('https://shop.example.com/black-bag'),name:'중복',features:'중복',matchLevel:'high',categoryMatch:'yes',structureMatch:'yes',variantMatch:'unknown',differences:[]}]})}]}}]});};
 const photo=async()=>({pageUrl:'https://shop.example.com/black-bag',title:'검은 숄더백',bytes:Buffer.from('seller'),preview:'c2VsbGVy'});
 const result=await new GeminiPlaceChat('test','model',request,photo).findSimilarProducts(Buffer.from('abc'),'검은 가방');assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].url,'https://shop.example.com/black-bag');assert.equal(result.candidates[0].visualVerified,true);assert.equal(result.candidates[0].image,'c2VsbGVy');assert(result.notice.includes('판매 사진'));assert.equal(calls,2);
});

test('a grounded text description without a real sale image never becomes a visually verified product',async()=>{
 let calls=0;const request:typeof fetch=async()=>{calls++;return Response.json({candidates:[{groundingMetadata:{groundingChunks:[{web:{uri:'https://shop.example.com/p',title:'상품'}}]}}]});};
 const result=await new GeminiPlaceChat('test','model',request,async()=>null).findSimilarProducts(Buffer.from('abc'),'검은 가방');assert.equal(calls,1);assert.deepEqual(result.candidates,[]);
});

test('visually weak or different sale photos are excluded even if a search description sounds convincing',async()=>{
 let calls=0;const request:typeof fetch=async()=>++calls===1?Response.json({candidates:[{groundingMetadata:{groundingChunks:[{web:{uri:'https://shop.example.com/p',title:'비슷한 상품'}}]}}]}):Response.json({candidates:[{content:{parts:[{text:JSON.stringify({candidates:[{sourceId:ref('https://shop.example.com/black-bag'),name:'다른 가방',features:'색이 다름',matchLevel:'medium'}]})}]}}]});
 const result=await new GeminiPlaceChat('test','model',request,async()=>({pageUrl:'https://shop.example.com/p',title:'상품',bytes:Buffer.from('seller'),preview:''})).findSimilarProducts(Buffer.from('abc'),'검은 가방');assert.deepEqual(result.candidates,[]);
});

test('product identification compares the selected image against optional nearby scenes',async()=>{
 const request:typeof fetch=async(_url,init)=>{const sent=JSON.parse(String(init?.body));const photos=sent.contents[0].parts.filter((p:any)=>p.inlineData);assert.deepEqual(photos.map((p:any)=>p.inlineData.data),['c2VsZWN0ZWQ=','Y29udGV4dA==','bmVpZ2hib3Vy']);assert(sent.contents[0].parts.at(-1).text.includes('첫 사진의 상품만'));return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({label:'가방',query:'임의 추가',confidence:'high',reason:'확인'})}]}}]});};
 const result=await new GeminiPlaceChat('test','model',request).identifyProduct(Buffer.from('selected'),undefined,'',[Buffer.from('context'),Buffer.from('neighbour')]);assert.equal(result.query,'가방');
});
test('missing grounded results return usable search guidance without inventing products',async()=>{
 let calls=0;const request:typeof fetch=async()=>{calls++;return Response.json({candidates:[{content:{parts:[{text:'명확한 상품 없음'}]}}]});};
 const result=await new GeminiPlaceChat('test','model',request).findSimilarProducts(Buffer.from('abc'),'파란 머그컵');assert.deepEqual(result.candidates,[]);assert(result.notice.includes('판매 페이지를 확인하지 못'));assert.equal(calls,1);
});

test('repeated image and search reuse the result while a different image still gets checked',async()=>{
 let calls=0;const provider=new GeminiPlaceChat('test','model',async()=>{calls++;return Response.json({candidates:[]});});
 await provider.findSimilarProducts(Buffer.from('one'),'가방');await provider.findSimilarProducts(Buffer.from('one'),'가방');assert.equal(calls,1);
 await provider.findSimilarProducts(Buffer.from('two'),'가방');assert.equal(calls,2);
});
test('Live purchase guidance calls a general-purpose similarity tool without requiring a brand',()=>{
 const setup:any=LIVE_SETUP;const tool=setup.tools[0].functionDeclarations[0];assert.equal(tool.name,'find_similar_products');assert.deepEqual(tool.parameters.required,['query','reason']);assert(setup.systemInstruction.parts[0].text.includes('반드시'));assert(setup.systemInstruction.parts[0].text.includes('유사율 숫자'));
});
