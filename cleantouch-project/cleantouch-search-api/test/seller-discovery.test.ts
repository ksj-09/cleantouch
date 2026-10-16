import test from 'node:test';import assert from 'node:assert/strict';
import {GroundedSellerDiscovery,VisionSellerDiscovery,SellerDiscoveryChain,discoveryFailure,type SellerDiscovery} from '../src/seller-discovery.js';
const signal=()=>AbortSignal.timeout(5000);
test('search and visual comparison use separate model capabilities',async()=>{
 const discovery=new GroundedSellerDiscovery('test-key','gemini-2.5-flash',async(url,init)=>{
  assert(String(url).includes('gemini-2.5-flash'));assert.equal(new Headers(init?.headers).get('x-goog-api-key'),'test-key');
  const payload=JSON.parse(String(init?.body));assert.equal(payload.generationConfig.thinkingConfig.thinkingBudget,0);
  return Response.json({candidates:[{content:{parts:[{text:'not a verified purchase'}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://shop.example.com/products/1',title:'bag'}},{web:{uri:'https://shop.example.com/products/1'}},{web:{uri:'https://127.0.0.1/p'}}]}}]});
 });
 const found=await discovery.discover(Buffer.from('image'),'bag',undefined,signal());assert.equal(found.state,'ready');assert.equal(found.sources.length,1);
});
test('web image matches return page sources, never CDN photographs as purchase links',async()=>{
 const found=await new VisionSellerDiscovery('key',async(_url,init)=>{
  const payload=JSON.parse(String(init?.body));assert.equal(payload.requests[0].features[0].type,'WEB_DETECTION');
  return Response.json({responses:[{webDetection:{pagesWithMatchingImages:[{url:'https://shop.example.com/partial',partialMatchingImages:[{}]},{url:'https://shop.example.com/full',fullMatchingImages:[{url:'https://cdn.example.com/p.jpg'}]}],visuallySimilarImages:[{url:'https://cdn.example.com/other.jpg'}]}}]});
 }).discover(Buffer.from('image'),'bag',undefined,signal());
 assert.deepEqual(found.sources.map(s=>s.uri),['https://shop.example.com/full','https://shop.example.com/partial']);assert.equal(found.state,'ready');
});
test('provider billing, retired models and temporary quotas have distinct diagnoses',()=>{
 assert.equal(discoveryFailure(403,{error:{details:[{reason:'BILLING_DISABLED'}]}}).state,'billing_required');
 assert.equal(discoveryFailure(404,{}).state,'configuration_required');
 assert.equal(discoveryFailure(429,{},new Headers({'retry-after':'120'})).retryAfterSeconds,120);
 assert.equal(discoveryFailure(429,{},new Headers({'retry-after':'nonsense'})).retryAfterSeconds,60);
});
test('provider failure cooldown covers different photos, expires, and an alternative still runs',async()=>{
 let clock=0,calls=0,second=0;
 const limited:SellerDiscovery={discover:async()=>{calls++;return {state:'rate_limited',sources:[],findings:'',retryAfterSeconds:60};}};
 const available:SellerDiscovery={discover:async()=>{second++;return {state:'ready',sources:[{uri:'https://shop.example.com/p',title:'bag'}],findings:''};}};
 const chain=new SellerDiscoveryChain([limited,available],()=>clock);
 for(const image of ['a','b'])assert.equal((await chain.discover(Buffer.from(image),'bag',undefined,signal())).state,'ready');
 assert.equal(calls,1);assert.equal(second,2);clock=61000;await chain.discover(Buffer.from('c'),'bag',undefined,signal());assert.equal(calls,2);
});
test('an ordinary empty search is not misreported as failed because another provider needs billing',async()=>{
 const chain=new SellerDiscoveryChain([{discover:async()=>({state:'billing_required',sources:[],findings:'',retryAfterSeconds:300})},{discover:async()=>({state:'no_sources',sources:[],findings:''})}]);
 assert.equal((await chain.discover(Buffer.from('a'),'bag',undefined,signal())).state,'no_sources');
});
test('cancellation stops provider fallback instead of sending a second request',async()=>{
 const controller=new AbortController();let second=0;
 const chain=new SellerDiscoveryChain([{discover:async()=>{controller.abort();throw Error('cancelled');}},{discover:async()=>{second++;return {state:'no_sources',sources:[],findings:''};}}]);
 await assert.rejects(chain.discover(Buffer.from('a'),'bag',undefined,controller.signal));assert.equal(second,0);
});
