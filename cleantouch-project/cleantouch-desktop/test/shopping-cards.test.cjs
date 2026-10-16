const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{},URL,Blob,atob};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../shopping-cards.js'),'utf8'),sandbox);
const {toAiResult}=sandbox.window.cleanTouchShopping;
test('Live shopping results preserve seller evidence without sending base64 photographs as text',()=>{
 const candidate={name:'Actual bag',url:'https://shop.example.com/products/1',image:'c2VsbGVy'.repeat(20000),visualVerified:true,matchType:'identifier_match',identityEvidence:'ACME CT12345',features:'metal buckle',differences:['strap differs']};
 const source={query:'bag',image:'dGFyZ2V0',candidates:[candidate],notice:'Photo compared'};
 const result=toAiResult(source);assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].url,candidate.url);assert.equal(result.candidates[0].identityEvidence,'ACME CT12345');assert.equal(result.candidates[0].differences[0],'strap differs');assert(JSON.stringify(result).length<1000);assert(!('image' in result.candidates[0]));assert.equal(source.candidates[0].image,candidate.image);
});
test('unverified photos and keyword search URLs cannot become seller claims in Live',()=>{
 const base={name:'bag',url:'https://shop.example.com/products/1',image:'c2VsbGVy',visualVerified:true};
 const result=toAiResult({query:'bag',candidates:[null,{...base,visualVerified:false},{...base,url:'https://shop.example.com/?q=bag'},{...base,url:'https://127.0.0.1/products/1'},{...base,url:'https://search.shopping.naver.com/search/all?query=bag'}]});assert.equal(result.candidates.length,0);
});
