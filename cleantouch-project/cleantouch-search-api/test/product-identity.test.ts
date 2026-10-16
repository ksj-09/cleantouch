import {createHash} from 'node:crypto';
const ref=(url:string)=>'seller_'+createHash('sha256').update(url).digest('hex').slice(0,16);
import test from 'node:test';import assert from 'node:assert/strict';
import {cleanProductIdentity,matchingIdentifier,detailPageUrl} from '../src/product-identity.js';
import {sellerIdentity} from '../src/seller-photo.js';
import {GeminiPlaceChat} from '../src/place-provider.js';
test('visible identifiers require complete tokens and retain Korean brand distinctions',()=>{
 const prefix=cleanProductIdentity({brand:'ACME',modelCode:'CT12345',visibleText:'ACME CT123450'});assert.equal(prefix.modelCode,'');
 const embedded=cleanProductIdentity({brand:'ACME',modelCode:'CT12345',visibleText:'NOTACME CT12345'});assert.equal(embedded.brand,'');
 const actual=cleanProductIdentity({brand:'삼성',modelCode:'SM-S931N',visibleText:'삼성 SM-S931N'});assert.equal(actual.brand,'삼성');assert.equal(actual.modelCode,'SM-S931N');
 assert.equal(matchingIdentifier(actual,{brand:'샘성',mpn:'SM-S931N'}),'');
});

test('a cold server instance recovers visible identity only after obtaining real seller metadata',async()=>{
 let calls=0;
 const request:typeof fetch=async()=>{
  calls++;
  if(calls===1)return Response.json({candidates:[{groundingMetadata:{groundingChunks:[{web:{uri:'https://shop.example.com/products/12345',title:'bag'}}]}}]});
  if(calls===2)return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({label:'가방',query:'가방',confidence:'high',reason:'photo',identity:{visibleText:'ACME CT12345',brand:'ACME',modelCode:'CT12345'}})}]}}]});
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({candidates:[{sourceId:ref('https://shop.example.com/products/12345'),name:'bag',features:'same buckle',matchLevel:'high',categoryMatch:'yes',structureMatch:'yes',variantMatch:'yes',differences:[]}]})}]}}]});
 };
 const provider=new GeminiPlaceChat('test','model',request,async()=>({pageUrl:'https://shop.example.com/products/12345',title:'ACME seller title',bytes:Buffer.from('seller'),preview:'c2VsbGVy',identity:{brand:'ACME',mpn:'CT12345'}}));
 const result=await provider.findSimilarProducts(Buffer.from('cold target'),'가방');assert.equal(result.candidates[0]?.matchType,'identifier_match');assert.equal(calls,3);
});
test('inferred model numbers and brands without visible text do not establish identity',()=>{
 const absent=cleanProductIdentity({brand:'ACME',modelCode:'CT-12345',visibleText:'',features:['curved handle']});assert.equal(absent.brand,'');assert.equal(absent.modelCode,'');
 const actual=cleanProductIdentity({brand:'ACME',modelCode:'CT-12345',visibleText:'ACME CT-12345'});assert.equal(actual.modelCode,'CT-12345');assert.equal(matchingIdentifier(actual,{brand:'ACME',mpn:'CT12345'}),'ACME CT-12345');
 assert.equal(matchingIdentifier(actual,{brand:'OTHER',mpn:'CT12345'}),'');assert.equal(matchingIdentifier(actual,{brand:'ACME',mpn:'CT12346'}),'');
});
test('only a single product detail record can supply seller identity',()=>{
 const record={type:'ignored','@type':'Product',brand:{name:'ACME'},mpn:'CT12345',model:'CT-12345'};
 const html=(v:unknown)=>'<script type="application/ld+json">'+JSON.stringify(v)+'</script>';
 assert.equal(sellerIdentity(html(record)).mpn,'CT12345');assert.deepEqual(sellerIdentity(html([record,{...record,mpn:'OTHER'}])),{});
 for(const url of ['https://www.coupang.com/np/search?q=bag','https://www.google.com/search?q=bag','https://search.shopping.naver.com/search/all?query=bag'])assert.equal(detailPageUrl(url),false);
 assert(detailPageUrl('https://shop.example.com/products/12345'));
});
test('matching appearance alone never becomes a matching model; IDs also require matching variant evidence',async()=>{
 async function find(variantMatch:string,differences:string[]){
  let calls=0;const request:typeof fetch=async()=>{calls++;
   if(calls===1)return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({label:'검은 가방',query:'검은 가방',confidence:'high',reason:'photo',identity:{visibleText:'ACME CT12345',brand:'ACME',modelCode:'CT12345',features:['metal buckle']}})}]}}]});
   if(calls===2)return Response.json({candidates:[{groundingMetadata:{groundingChunks:[{web:{uri:'https://shop.example.com/products/12345',title:'bag'}}]}}]});
   return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({candidates:[{sourceId:ref('https://shop.example.com/products/12345'),name:'bag',features:'matching structure',matchLevel:'high',categoryMatch:'yes',structureMatch:'yes',variantMatch,differences}]})}]}}]});
  };
  const provider=new GeminiPlaceChat('test','model',request,async()=>({pageUrl:'https://shop.example.com/products/12345',title:'ACME actual product title',bytes:Buffer.from('seller'),preview:'c2VsbGVy',identity:{brand:'ACME',mpn:'CT12345'}}));
  await provider.identifyProduct(Buffer.from('target'));return provider.findSimilarProducts(Buffer.from('target'),'검은 가방');
 }
 const match=await find('yes',[]);assert.equal(match.candidates[0]?.matchType,'identifier_match');assert.equal(match.candidates[0]?.name,'ACME actual product title');
 assert.equal((await find('unknown',[])).candidates[0]?.matchType,'visual_similar');
 assert.equal((await find('yes',['strap differs'])).candidates[0]?.matchType,'visual_similar');
});
