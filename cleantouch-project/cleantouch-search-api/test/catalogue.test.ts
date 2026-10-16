import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {once} from 'node:events';
import {parseCatalogue,createCatalogueIndex,validGtin} from '../src/catalogue.js';
import {createCataloguePilot} from '../src/catalogue-pilot.js';
const fixture=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/catalogue-test.json',import.meta.url),'utf8'));
const index=()=>createCatalogueIndex(parseCatalogue(fixture()),()=>Date.parse('2026-10-15T12:00:00Z'));
test('identifier search separates same model names under different brands and resolves options explicitly',()=>{
 const i=index();assert.equal(i.lookup('demo-merchant',{brand:'CleanTouchDemo',modelCode:'BAG-A100',country:'KR'}).status,'options_required');
 const r=i.lookup('demo-merchant',{brand:'CleanTouchDemo',modelCode:'bag a100',color:'검정',size:'M',country:'KR'});assert.equal(r.status,'identifier_match');assert.deepEqual(r.candidates.map(c=>c.sku),['bag-a-black-m']);assert.equal(r.candidates[0]?.offers[0]?.url,'https://shop.example.com/products/bag-a-black-m');assert.equal(r.candidates[0]?.offers[0]?.purchaseConfirmed,false);
 assert.equal(i.lookup('demo-merchant',{brand:'OtherDemo',modelCode:'BAG-A100',country:'KR'}).candidates[0]?.sku,'bag-b-black');
});
test('colour or category guesses cannot produce exact-item candidates; unknown models stay unknown',()=>{
 assert.equal(index().lookup('demo-merchant',{color:'검정',country:'KR'}).status,'needs_evidence');assert.equal(index().lookup('demo-merchant',{brand:'Unknown',modelCode:'BAG-A100',country:'KR'}).status,'not_found');
 assert.equal(index().lookup('demo-merchant',{brand:'CleanTouchDemo',modelCode:'BAG-A100',color:'보라',country:'KR'}).status,'not_found');
});
test('catalogue scope is enforced and imported objects cannot mutate the active snapshot',()=>{
 const c=parseCatalogue(fixture()),i=createCatalogueIndex(c);c.products[0]!.title='changed';assert.notEqual(i.lookup('demo-merchant',{brand:'CleanTouchDemo',modelCode:'BAG-A100',country:'KR'}).candidates[0]?.title,'changed');assert.throws(()=>i.lookup('other-tenant',{brand:'CleanTouchDemo',modelCode:'BAG-A100',country:'KR'}),/고객/);
});
test('offers are country-specific and stale or future stock records are unknown',()=>{
 const i=index();assert.equal(i.lookup('demo-merchant',{brand:'CleanTouchDemo',modelCode:'TOY-L200',country:'KR'}).status,'region_unavailable');assert.equal(i.lookup('demo-merchant',{brand:'CleanTouchDemo',modelCode:'TOY-L200',country:'US'}).candidates[0]?.offers[0]?.currency,'USD');
 for(const clock of ['2026-10-17T00:00:00Z','2026-10-14T00:00:00Z']){const raw=fixture();raw.products[0].variants[0].offers[0].availability='in_stock';const c=createCatalogueIndex(parseCatalogue(raw),()=>Date.parse(clock));const offer=c.lookup('demo-merchant',{brand:'CleanTouchDemo',modelCode:'BAG-A100',color:'검정',country:'KR'}).candidates[0]?.offers[0];assert.equal(offer?.availability,'unknown');assert.equal(offer?.dataFresh,false);}
});
test('GTIN check digits are validated and conflicting identity evidence is not ignored',()=>{
 assert(validGtin('4006381333931'));assert(!validGtin('4006381333932'));const raw=fixture();raw.products[0].variants[0].gtin='4006381333931';const c=createCatalogueIndex(parseCatalogue(raw));assert.equal(c.lookup('demo-merchant',{gtin:'4006381333931',country:'KR'}).candidates[0]?.sku,'bag-a-black-m');assert.equal(c.lookup('demo-merchant',{gtin:'4006381333931',brand:'OtherDemo',country:'KR'}).status,'not_found');
});
test('registered video mapping interpolates SDK keyframes and uses bounded time and point',()=>{
 const i=index(),r=i.resolve('demo-merchant','demo-video',8,{x:.45,y:.4},'KR');assert.equal(r.status,'publisher_mapped');assert.equal(r.candidates[0]?.sku,'bag-a-black-m');assert.equal(i.resolve('demo-merchant','demo-video',13.01,{x:.45,y:.4},'KR').status,'not_found');assert.equal(i.resolve('demo-merchant','demo-video',8,{x:.99,y:.99},'KR').status,'not_found');assert.equal(i.resolve('demo-merchant','unknown',8,{x:.45,y:.4},'KR').status,'content_not_found');assert.throws(()=>i.resolve('demo-merchant','demo-video',8,{x:NaN,y:0},'KR'));
});
test('overlapping product tags require user disambiguation rather than choosing a seller',()=>{
 const raw=fixture();raw.contents[0].products.push({...raw.contents[0].products[0],sku:'bag-a-navy-m'});assert.equal(createCatalogueIndex(parseCatalogue(raw)).resolve('demo-merchant','demo-video',8,{x:.45,y:.4},'KR').status,'ambiguous');
});
test('SDK output reuses known SKU URLs and does not invent zero prices for missing values',()=>{
 const i=index(),content=i.sdkContent('demo-merchant','demo-video','KR')!;assert.equal(content.products[0]?.id,'bag-a-black-m');assert.equal(content.products[0]?.productUrl,'https://shop.example.com/products/bag-a-black-m');
 const raw=fixture();delete raw.products[0].variants[0].offers[0].price;const output=createCatalogueIndex(parseCatalogue(raw)).sdkContent('demo-merchant','demo-video','KR')!;assert.equal(output.products.length,0);assert.deepEqual(output.omittedSkus,['bag-a-black-m']);
});
test('unbranded merchandise can still use publisher-owned SKU tags without inferring a brand',()=>{
 const raw=fixture();delete raw.products[0].brand;delete raw.products[0].modelCode;const c=createCatalogueIndex(parseCatalogue(raw));assert.equal(c.resolve('demo-merchant','demo-video',8,{x:.45,y:.4},'KR').status,'publisher_mapped');assert.equal(c.resolve('demo-merchant','demo-video',8,{x:.45,y:.4},'KR').candidates[0]?.brand,'');
});
test('catalogue import rejects duplicate SKUs, unsafe/search URLs, unknown tags and invalid geometry',()=>{
 const bad=[(c:any)=>c.products[1].variants[0].sku='bag-a-black-m',(c:any)=>c.products[0].variants[0].offers[0].url='https://127.0.0.1/secret',(c:any)=>c.products[0].variants[0].offers[0].url='https://shop.example.com/search?q=bag',(c:any)=>c.contents[0].products[0].sku='missing',(c:any)=>c.contents[0].products[0].keyframes[0].x=99,(c:any)=>c.source.updatedAt='2026-10-15T12:00:00',(c:any)=>c.products[0].variants[0].offers[0].price=-1];
 for(const mutate of bad){const c=fixture();mutate(c);assert.throws(()=>parseCatalogue(c));}
});
test('local pilot rejects foreign-origin mutation and invalid imports preserve the previous catalogue',async()=>{
 const app=createCataloguePilot('<html>__CSRF__</html>',fixture()),server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as any).port;
 try{const page=await fetch(base),html=await page.text(),token=html.match(/[a-f0-9]{64}/)![0];assert(page.headers.get('content-security-policy')?.includes('nonce-'));
 const call=(path:string,body:any,origin=base)=>fetch(base+'/v1/'+path,{method:'POST',headers:{origin,'content-type':'application/json','x-pilot-token':token},body:JSON.stringify(body)});
 assert.equal((await call('fixture',{},'https://evil.example.com')).status,403);assert.equal((await call('lookup',{})).status,409);assert.equal((await call('fixture',{})).status,200);assert.equal((await call('import',{products:[]})).status,400);
 const r=await call('lookup',{brand:'CleanTouchDemo',modelCode:'BAG-A100',color:'검정',country:'KR',tenantId:'other'});assert.equal(r.status,200);assert.equal((await r.json() as any).candidates[0].sku,'bag-a-black-m');
 assert.equal((await call('resolve',{contentId:'demo-video',time:8,point:{x:.45,y:.4},country:'KR'})).status,200);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
