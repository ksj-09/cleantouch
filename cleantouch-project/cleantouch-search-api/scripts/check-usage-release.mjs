import fs from 'node:fs/promises';import crypto from 'node:crypto';import assert from 'node:assert/strict';import sharp from 'sharp';
const base=process.argv[2],label=process.argv[3]||'draft';if(!/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(base||'')||!/^[a-z0-9.-]+$/i.test(label))throw Error('Invalid deployment/report');
const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{createRequestSigner}=require('../../cleantouch-desktop/request-signer.cjs');
const {tmpdir}=await import('node:os'),path=await import('node:path');const folder=await fs.mkdtemp(path.join(tmpdir(),'ct-auth-probe-'));
// Test-only encrypted identity. The encryption key remains in memory.
const key=crypto.randomBytes(32),codec={encode:s=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([c.update(s,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),encrypted]).toString('base64');},decode:s=>{const b=Buffer.from(s,'base64'),d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString();}};
const signer=createRequestSigner(path.join(folder,'identity.json'),codec);
try{
 const health=await(await fetch(base+'/v1/place-chat/health')).json();assert.equal(health.usageGuard,'required');
 const image=(await sharp('../artifacts/verification/real-video-selected-0.1.59.png').flatten({background:'#fff'}).jpeg({quality:91}).toBuffer()).toString('base64');
 const body=JSON.stringify({task:'product',image,messages:[{role:'user',text:'선택한 상품의 종류만 알려줘.'}]}),headers=await signer.sign(body);
 async function send(bodyText,signatures){const r=await fetch(base+'/v1/place-chat',{method:'POST',headers:{'content-type':'application/json',...signatures},body:bodyText,signal:AbortSignal.timeout(65000)});return {status:r.status,data:await r.json()};}
 const first=await send(body,headers),repeat=await send(body,headers),tampered=await send(body.replace('종류만','특징만'),headers),forged=await send(body,{...headers,'x-ct-signature':'x'.repeat(86)+'=='});
 const report={time:new Date().toISOString(),base,health,signedStatus:first.status,label:first.data.label,message:first.data.message,replayStatus:repeat.status,tamperedStatus:tampered.status,forgedStatus:forged.status};
 await fs.writeFile('../artifacts/verification/usage-0.1.64-'+label+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.equal(first.status,200);assert.equal(repeat.status,409);assert.equal(tampered.status,401);assert.equal(forged.status,401);
}finally{if(path.dirname(path.resolve(folder))!==path.resolve(tmpdir())||!path.basename(folder).startsWith('ct-auth-probe-'))throw Error('Unsafe test cleanup path');await fs.rm(folder,{recursive:true,force:true});key.fill(0);}
