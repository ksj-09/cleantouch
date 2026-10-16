import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,sign} from 'node:crypto';
import {requestIdentity,requestDigest} from '../src/request-auth.js';import {admitUsage} from '../src/usage-guard.js';
function request(body='{"task":"product"}'){
 const keys=generateKeyPairSync('ed25519'),stamp=String(Date.now()),nonce='ab'.repeat(16),publicKey=keys.publicKey.export({format:'der',type:'spki'}).toString('base64');
 const signature=sign(null,Buffer.from(['POST','/v1/place-chat',stamp,nonce,requestDigest(body)].join('\n')),keys.privateKey).toString('base64');
 return {body,headers:{'x-ct-public-key':publicKey,'x-ct-time':stamp,'x-ct-nonce':nonce,'x-ct-signature':signature,'x-nf-client-connection-ip':'192.0.2.1'}};
}
test('signed device identity binds the body and rejects stale or forged requests',()=>{
 const event=request(),secret='s'.repeat(32),identity=requestIdentity(event,secret,true);assert.equal(identity.legacy,false);assert.equal(identity.subject.length,64);assert(!JSON.stringify(identity).includes('192.0.2.1'));
 assert.throws(()=>requestIdentity({...event,body:'changed'},secret,true));assert.throws(()=>requestIdentity(event,secret,true,Date.now()+70000));assert.throws(()=>requestIdentity({body:event.body,headers:{}},secret,true));
});
test('invalid signature fields never reach the usage store; store failure stops AI admission',async()=>{
 const before={mode:process.env.USAGE_GUARD_MODE,secret:process.env.USAGE_IDENTITY_SECRET,required:process.env.AI_REQUIRE_SIGNED_REQUESTS};
 process.env.USAGE_GUARD_MODE='required';process.env.USAGE_IDENTITY_SECRET='s'.repeat(32);process.env.AI_REQUIRE_SIGNED_REQUESTS='true';let calls=0;
 const store={reserve:async()=>{calls++;throw Error('database password must not leak');}};
 try{await assert.rejects(admitUsage({headers:{}},'product',store),/업데이트/);assert.equal(calls,0);await assert.rejects(admitUsage(request(),'product',store),/사용량을 확인하지 못해/);assert.equal(calls,1);}
 finally{for(const [name,value]of [['USAGE_GUARD_MODE',before.mode],['USAGE_IDENTITY_SECRET',before.secret],['AI_REQUIRE_SIGNED_REQUESTS',before.required]])if(value===undefined)delete process.env[name!];else process.env[name!]=value;}
});
