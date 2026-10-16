import test from 'node:test';import assert from 'node:assert/strict';
import {productPhoto,publicAddress,loadSellerPhoto} from '../src/seller-photo.js';
import {sellerIdentity} from '../src/seller-photo.js';
test('a product photo cannot be paired with unrelated listing metadata or a different preview',()=>{
 const html=(v:unknown)=>'<script type="application/ld+json">'+JSON.stringify(v)+'</script>';
 const product={'@type':'Product',name:'bag',image:'/actual-product.jpg',brand:'ACME',mpn:'CT12345'};
 assert.equal(productPhoto(html([product,{...product,name:'other'}]),'https://shop.example.com/products/1'),null);
 const preview='<meta property="og:image" content="https://cdn.example.com/unrelated.jpg">';
 assert.equal(productPhoto(preview+html(product),'https://shop.example.com/products/1')?.url,'https://shop.example.com/actual-product.jpg');
 assert.deepEqual(sellerIdentity(html({...product,'@type':'ProductGroup',hasVariant:[product]})),{});
 assert.equal(productPhoto(html(product),'https://shop.example.com/?q=bag'),null);
});
test('only product metadata supplies a seller image, not an article or video preview',()=>{
 assert.equal(productPhoto('<meta property="og:image" content="https://cdn.example.com/blog.jpg">','https://shop.example.com/p'),null);
 assert.deepEqual(productPhoto('<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"검은 가방","image":["/p.jpg"]}]}</script>','https://shop.example.com/p'),{url:'https://shop.example.com/p.jpg',title:'검은 가방'});
 assert.deepEqual(productPhoto('<meta content="product" property="og:type"><meta property="og:image" content="https://cdn.example.com/p.jpg?a=1&amp;b=2"><meta property="og:title" content="상품">','https://shop.example.com/p'),{url:'https://cdn.example.com/p.jpg?a=1&b=2',title:'상품'});
});
test('private addresses and metadata images cannot enter the server fetcher',async()=>{
 for(const address of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','100.100.100.200','::1','::ffff:127.0.0.1','fe80::1','fc00::1','2001:db8::1'])assert.equal(publicAddress(address),false,address);
 assert(publicAddress('8.8.8.8'));assert(publicAddress('2606:4700:4700::1111'));
 assert.equal(productPhoto('<meta property="og:type" content="product"><meta property="og:image" content="https://127.0.0.1/secret">','https://shop.example.com/p'),null);
 assert.equal(await loadSellerPhoto('https://localhost/secret',AbortSignal.timeout(1000)),null);
});
