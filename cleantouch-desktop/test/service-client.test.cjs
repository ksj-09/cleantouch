const {test}=require('node:test');
const assert=require('node:assert/strict');
const {requestAi}=require('../service-client.cjs');
test('AI relay handles success and preserves a useful quota wait without exposing an HTML error',async()=>{
 assert.deepEqual(await requestAi('https://example.test/',{task:'product'},{request:async(url,options)=>{
  assert.equal(url,'https://example.test/v1/place-chat');assert.equal(JSON.parse(options.body).task,'product');
  return new Response(JSON.stringify({answer:'ok'}));
 }}),{answer:'ok'});
 await assert.rejects(requestAi('https://example.test',{}, {request:async()=>new Response('<html>proxy details</html>',{status:502})}),error=>/지연/.test(error.message)&&!error.message.includes('html'));
 await assert.rejects(requestAi('https://example.test',{}, {request:async()=>new Response(JSON.stringify({message:'잠시 기다려 주세요.',retryAfterSeconds:45}),{status:429})}),/45초/);
 await assert.rejects(requestAi('https://example.test',{}, {request:async()=>new Response('null')}),/읽지 못/);
});
test('AI relay distinguishes cancellation, network failure, and timeout',async()=>{
 const controller=new AbortController();controller.abort();
 const fail=async()=>{throw new TypeError('connection details');};
 await assert.rejects(requestAi('https://example.test',{}, {signal:controller.signal,request:fail}),/취소/);
 await assert.rejects(requestAi('https://example.test',{}, {request:fail}),/인터넷/);
 await assert.rejects(requestAi('https://example.test',{}, {request:async()=>{throw new DOMException('timeout','TimeoutError');}}),/늦어/);
});
