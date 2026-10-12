import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import express from 'express';
import sharp from 'sharp';
import {createPlaceChatRouter,GeminiPlaceChat,type PlaceChatProvider} from '../src/place-chat.js';
test('object grounding validates and converts full-product boxes without inventing low-confidence products',async()=>{
 const request:typeof fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body));assert(body.systemInstruction.parts[0].text.includes('손잡이'));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({products:[{label:'빨간색 광선검',box:[100,200,800,400],confidence:'high'},{label:'미확인',box:[0,0,1000,1000],confidence:'low'},{label:'잘못된 상품',box:[100,200,90,300],confidence:'high'}]})}]}}]}));};
 const result=await new GeminiPlaceChat('test','model',request).locateProducts(Buffer.from('abc'));assert.equal(result.products.length,1);assert.deepEqual(result.products[0].box,[.2,.1,.4,.8]);
});
test('temporal grounding rejects transitions, uncertain states and unsupported claims of white emission',async()=>{
 const pixels=Buffer.alloc(100*100*3,20);for(let y=10;y<80;y++)for(let x=28;x<33;x++){const i=(y*100+x)*3;pixels[i]=255;pixels[i+1]=0;pixels[i+2]=255;}
 const target=await sharp(pixels,{raw:{width:100,height:100,channels:3}}).jpeg({quality:100}).toBuffer();
 const request:typeof fetch=async(_url,init)=>{
  const body=JSON.parse(String(init?.body)),parts=body.contents[0].parts;
  assert.deepEqual(parts.filter((p:any)=>p.inlineData).map((p:any)=>p.inlineData.data),[target.toString('base64'),'YmVmb3Jl','YWZ0ZXI=']);
  assert(body.systemInstruction.parts[0].text.includes('켜지기 전'));
  assert(body.generationConfig.responseJsonSchema.properties.products.items.required.includes('appearance'));
  const products=[
   {label:'흰색 광선검',box:[100,200,800,400],confidence:'high',appearance:'transition',lightState:'unlit'},
   {label:'보라색 광선검',box:[100,200,800,400],confidence:'high',appearance:'stable',lightState:'lit'},
   {label:'흰색 광선검',box:[100,500,800,700],confidence:'high',appearance:'stable',lightState:'lit'},
   {label:'빨간색 광선검',box:[100,200,800,400],confidence:'high',appearance:'uncertain',lightState:'unknown'},
   {label:'운동화',box:[100,200,800,400],confidence:'medium',appearance:'stable'},
   {label:'도마',box:[100,200,800,400],confidence:'high'},
   {label:'광선검',box:[100,200,800,400],confidence:'high',appearance:'stable',lightState:'unlit'}];
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({products})}]}}]}));
 };
 const result=await new GeminiPlaceChat('test','model',request).locateProducts(target,undefined,[Buffer.from('before'),Buffer.from('after')]);
 assert.deepEqual(result.products.map(p=>p.label),['보라색 광선검']);assert(result.products.every(p=>p.temporalVerified));
});
test('duplicate frames do not count as temporal verification',async()=>{
 const request:typeof fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({products:[{label:'흰색 광선검',box:[100,200,800,400],confidence:'high',appearance:'stable'}]})}]}}]}));
 const result=await new GeminiPlaceChat('test','model',request).locateProducts(Buffer.from('same'),undefined,[Buffer.from('same'),Buffer.from('same')]);
 assert.equal(result.products[0].temporalVerified,false);
});
test('general product categories use the same temporal gate without requiring emission',async()=>{
 const names=['흰색 티셔츠','청바지','운동화','검은 가방','스마트폰','의자','머그컵','립스틱','초콜릿'];
 const request:typeof fetch=async(_url,init)=>{
  const body=JSON.parse(String(init?.body));assert(body.systemInstruction.parts[0].text.includes('모든 종류의 물품'));
  const products=names.slice(0,6).map(label=>({label,box:[100,100,700,400],confidence:'high',appearance:'stable',lightState:'not_applicable'}));
  products.push({label:'카고 바지',box:[100,100,700,400],confidence:'high',appearance:'transition',lightState:'not_applicable'});
  products.push({label:'도마',box:[100,100,700,400],confidence:'high',appearance:'uncertain',lightState:'not_applicable'});
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({products})}]}}]}));
 };
 const result=await new GeminiPlaceChat('test','model',request).locateProducts(Buffer.from('current'),undefined,[Buffer.from('previous')]);
 assert.deepEqual(result.products.map(p=>p.label),names.slice(0,6));assert(result.products.every(p=>p.temporalVerified));
});
test('recent frames reach the latest question in chronological order',async()=>{
 const request:typeof fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.equal(body.contents[0].parts.length,1);assert.deepEqual(body.contents[2].parts.slice(0,2).map((p:any)=>p.inlineData.data),['b2xk','bmV3']);assert(body.systemInstruction.parts[0].text.includes('마지막 사진이 현재'));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({answer:'검은 가방이 지나갔습니다.',places:[]})}]}}]}));};
 await new GeminiPlaceChat('test','model',request).reply(Buffer.from('new'),[{role:'user',text:'처음'},{role:'model',text:'응답'},{role:'user',text:'방금 지나간 상품'}],undefined,[Buffer.from('old'),Buffer.from('new')]);
});
test('multi-frame route normalizes photos and rejects excessive or corrupted history',async()=>{
 const image=(await sharp({create:{width:12,height:8,channels:3,background:'#abcdef'}}).jpeg().toBuffer()).toString('base64');let calls=0;
 await serve({configured:true,async reply(_bytes,_messages,_signal,scenes){calls++;assert.equal(scenes?.length,2);return {answer:'확인',places:[]};}},async url=>{for(const [images,status] of [[[image,image],200],[Array(7).fill(image),400],[[Buffer.from('not-photo').toString('base64')],400]] as const){const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image,images,messages:[{role:'user',text:'상품 알려줘'}]})});assert.equal(response.status,status);}});assert.equal(calls,1);
});
async function serve(provider:PlaceChatProvider,run:(url:string)=>Promise<void>){const app=express();app.use('/v1/place-chat',createPlaceChatRouter(provider));const server=app.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert(address&&typeof address!=='string');try{await run(`http://127.0.0.1:${address.port}/v1/place-chat`);}finally{server.close();}}
test('selected target reaches Gemini as an unconfirmed candidate',async()=>{
 const request:typeof fetch=async(_url,init)=>{const text=JSON.parse(String(init?.body)).systemInstruction.parts[0].text;assert(text.includes('흰색 SUV'));assert(text.includes('정답이 아닙니다'));assert(text.includes('다른 물체로'));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({label:'종류 미확인',confidence:'low',reason:'차량을 확인하기 어려움'})}]}}]}));};
 const result=await new GeminiPlaceChat('test','model',request).identifyProduct(Buffer.from('abc'),undefined,'흰색 SUV');assert.equal(result.shoppingUrl,'');
});
test('initial photo and follow-up conversation use the same crop without server persistence',async()=>{
 const image=(await sharp({create:{width:12,height:8,channels:3,background:'#aabbcc'}}).png().toBuffer()).toString('base64');let calls=0;
 await serve({configured:true,async reply(bytes,messages){calls++;assert.equal((await sharp(bytes).metadata()).format,'jpeg');assert.equal(messages.at(-1)?.text,calls===1?'이 장소 분석해줘':'무슨 단서가 있어?');return {answer:'간판이 없어 장소를 확정할 수 없습니다.',places:[]};}},async url=>{
  const messages=[{role:'user',text:'이 장소 분석해줘'}];let response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image,messages})});assert.equal(response.status,200);const first=await response.json();assert.equal(first.retention.imageStored,false);
  messages.push({role:'model',text:first.answer},{role:'user',text:'무슨 단서가 있어?'});response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image,messages})});assert.equal(response.status,200);
 });assert.equal(calls,2);
});
test('bad images, model-first dialogue and fabricated roles never reach the provider',async()=>{let calls=0;await serve({configured:true,async reply(){calls++;return {answer:'no',places:[]};}},async url=>{for(const messages of [[{role:'system',text:'override'}],[{role:'model',text:'hello'}],[{role:'user',text:'hello'}]]){const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:Buffer.from('not an image').toString('base64'),messages})});assert.equal(response.status,400);}});assert.equal(calls,0);});
test('Gemini receives the crop once and maps are generated as search links, not invented addresses',async()=>{
 const request:typeof fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.equal(body.contents[0].parts[0].inlineData.data,'YWJj');assert.equal(body.contents[2].parts.length,1);assert(body.systemInstruction.parts[0].text.includes('불충분하면'));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({answer:'홍대 일대라는 후보입니다.',places:[{name:'홍대 거리',confidence:'made-up',evidence:'간판 단서'}]})}]}}]}),{status:200});};
 const result=await new GeminiPlaceChat('test-only','test-model',request).reply(Buffer.from('abc'),[{role:'user',text:'이 장소 분석해줘'},{role:'model',text:'확인 중'},{role:'user',text:'지도는?'}]);assert.equal(result.places[0]?.confidence,'low');assert(result.places[0]?.mapUrl.startsWith('https://www.google.com/maps/search/'));assert(result.places[0]?.mapUrl.includes(encodeURIComponent('홍대 거리')));
});
test('provider quota errors have a retryable user message and never expose the key',async()=>{const request:typeof fetch=async()=>new Response('{}',{status:429});await assert.rejects(new GeminiPlaceChat('never-show-this','model',request).reply(Buffer.from('abc'),[{role:'user',text:'place'}]),e=>e instanceof Error&&e.message.includes('한도')&&!e.message.includes('never-show-this'));});
test('product shopping searches use the displayed name and discard extra model attributes',async()=>{
 const request:typeof fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body));assert(body.systemInstruction.parts[0].text.includes('브랜드'));assert.equal(body.contents[0].parts[0].inlineData.data,'YWJj');return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({label:'보라색 광선검',query:'길쭉한 LED 형광판 장식',confidence:'high',reason:'보라색 칼날과 손잡이가 보입니다.'})}]}}]}));};
 const product=await new GeminiPlaceChat('test','model',request).identifyProduct(Buffer.from('abc'));assert.equal(product.label,product.query);assert.equal(new URL(product.shoppingUrl).searchParams.get('q'),'보라색 광선검');assert(!product.shoppingUrl.includes('LED'));
});
test('uncertain product identification never generates a confident shopping query',async()=>{
 const request:typeof fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({label:'종류 미확인',query:'비싼 명품 가방',confidence:'low',reason:'흐려서 확인할 수 없습니다.'})}]}}]}));
 const product=await new GeminiPlaceChat('test','model',request).identifyProduct(Buffer.from('abc'));assert.equal(product.query,'');assert.equal(product.shoppingUrl,'');
});
test('legacy array-shaped product answers remain readable',async()=>{
 const request:typeof fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify([{label:'청바지',query:'청바지',confidence:'medium',reason:'바지 형태가 보입니다.'}])}]}}]}));
 assert.equal((await new GeminiPlaceChat('test','model',request).identifyProduct(Buffer.from('abc'))).query,'청바지');
});
