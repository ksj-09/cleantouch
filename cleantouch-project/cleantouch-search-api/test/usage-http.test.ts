import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {generateKeyPairSync,sign,createHmac} from 'node:crypto';import sharp from 'sharp';
import {createApp} from '../src/app.js';import {postgresUsage} from '../src/usage-guard.js';import {requestDigest} from '../src/request-auth.js';
test('Express verifies exact JSON bytes and ignores spoofed platform IP headers',async()=>{
 const before={mode:process.env.USAGE_GUARD_MODE,secret:process.env.USAGE_IDENTITY_SECRET};process.env.USAGE_GUARD_MODE='required';process.env.USAGE_IDENTITY_SECRET='s'.repeat(32);
 const reserve=postgresUsage.reserve;let calls=0,network='';postgresUsage.reserve=async(_s,n)=>{network=n;return {allowed:true,reason:'ok',remaining:10,retry_seconds:0};};
 const provider={configured:true,search:async()=>({queryLabel:'test',matches:[]})},chat={configured:true,reply:async()=>({answer:'ok',places:[]}),identifyProduct:async()=>{calls++;return {label:'가방',query:'가방',reason:'photo',confidence:'high' as const,shoppingUrl:''};}};
 const server=createApp(provider,chat).listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const image=(await sharp({create:{width:32,height:32,channels:3,background:'red'}}).jpeg().toBuffer()).toString('base64'),body=JSON.stringify({task:'product',image,messages:[{role:'user',text:'분석'}]},null,2);
  const keys=generateKeyPairSync('ed25519'),stamp=String(Date.now()),nonce='ab'.repeat(16),signature=sign(null,Buffer.from(['POST','/v1/place-chat',stamp,nonce,requestDigest(body)].join('\n')),keys.privateKey).toString('base64');
  const headers={'content-type':'application/json','x-ct-time':stamp,'x-ct-nonce':nonce,'x-ct-public-key':keys.publicKey.export({type:'spki',format:'der'}).toString('base64'),'x-ct-signature':signature,'x-nf-client-connection-ip':'spoofed-address'};
  const url='http://127.0.0.1:'+(server.address() as any).port+'/v1/place-chat';let r=await fetch(url,{method:'POST',headers,body});assert.equal(r.status,200,await r.text());assert.equal(calls,1);assert.notEqual(network,createHmac('sha256','s'.repeat(32)).update('network\0spoofed-address').digest('hex'));
  r=await fetch(url,{method:'POST',headers,body:body+' '});assert.equal(r.status,401);assert.equal(calls,1);
 }finally{postgresUsage.reserve=reserve;for(const [k,v]of [['USAGE_GUARD_MODE',before.mode],['USAGE_IDENTITY_SECRET',before.secret]])if(v===undefined)delete process.env[k!];else process.env[k!]=v;await new Promise<void>(r=>server.close(()=>r()));}
});
test('the emergency switch also blocks legacy multipart scan calls before paid recognition',async()=>{
 const before=process.env.AI_PAUSED;process.env.AI_PAUSED='true';let calls=0;
 const server=createApp({configured:true,search:async()=>{calls++;return {queryLabel:'test',matches:[]};}}).listen(0,'127.0.0.1');await once(server,'listening');
 try{const image=await sharp({create:{width:32,height:32,channels:3,background:'red'}}).jpeg().toBuffer(),form=new FormData();form.set('image',new Blob([new Uint8Array(image)],{type:'image/jpeg'}),'test.jpg');const r=await fetch('http://127.0.0.1:'+(server.address() as any).port+'/v1/scans',{method:'POST',body:form});assert.equal(r.status,503);assert.equal(calls,0);}
 finally{if(before===undefined)delete process.env.AI_PAUSED;else process.env.AI_PAUSED=before;await new Promise<void>(r=>server.close(()=>r()));}
});
