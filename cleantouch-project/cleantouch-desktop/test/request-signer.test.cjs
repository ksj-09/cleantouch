const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');const {createRequestSigner}=require('../request-signer.cjs');
test('device signing survives restart without storing a plaintext private key and binds exact request bytes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ct-sign-')),file=path.join(dir,'identity.json');
 const codec={encode:s=>Buffer.from('encrypted:'+s).toString('base64'),decode:s=>Buffer.from(s,'base64').toString().slice(10)};
 try{const body='{"task":"product","image":"abc"}',first=await createRequestSigner(file,codec).sign(body),second=await createRequestSigner(file,codec).sign(body);assert.equal(first['x-ct-public-key'],second['x-ct-public-key']);assert.notEqual(first['x-ct-nonce'],second['x-ct-nonce']);
  const data=['POST','/v1/place-chat',first['x-ct-time'],first['x-ct-nonce'],crypto.createHash('sha256').update(body).digest('hex')].join('\n');const publicKey=crypto.createPublicKey({key:Buffer.from(first['x-ct-public-key'],'base64'),type:'spki',format:'der'});assert(crypto.verify(null,Buffer.from(data),publicKey,Buffer.from(first['x-ct-signature'],'base64')));assert(!crypto.verify(null,Buffer.from(data+'changed'),publicKey,Buffer.from(first['x-ct-signature'],'base64')));
  assert(!String(await fs.readFile(file)).includes('PRIVATE KEY'));await fs.writeFile(file,'broken');await assert.rejects(createRequestSigner(file,codec).sign(body),/덮어쓰지/);assert.equal(await fs.readFile(file,'utf8'),'broken');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('missing operating-system encryption does not write an unprotected identity',async()=>{await assert.rejects(createRequestSigner('unused',undefined).sign('{}'),/보안 저장소/);});
