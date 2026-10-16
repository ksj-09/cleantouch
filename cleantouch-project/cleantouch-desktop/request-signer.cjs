const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function createRequestSigner(file,codec){
 let loading;
 async function identity(){
  if(!codec?.encode||!codec?.decode)throw Error('Windows 보안 저장소를 사용할 수 없어 AI 연결을 멈췄어요.');
  let stored;
  try{const stat=await fs.stat(file);if(stat.size>4000)throw Error('Invalid identity');stored=JSON.parse(await fs.readFile(file,'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw Error('기기 인증 정보를 읽지 못했어요. 기존 정보는 덮어쓰지 않았습니다.');
   const keys=crypto.generateKeyPairSync('ed25519');stored={version:1,privateKey:codec.encode(keys.privateKey.export({type:'pkcs8',format:'der'}).toString('base64'))};
   await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(stored),{encoding:'utf8',mode:0o600});await fs.rename(file+'.tmp',file);
  }
  const key=crypto.createPrivateKey({key:Buffer.from(codec.decode(stored.privateKey),'base64'),format:'der',type:'pkcs8'});
  if(stored.version!==1||key.asymmetricKeyType!=='ed25519')throw Error('기기 인증 형식이 올바르지 않아요.');
  return {key,publicKey:crypto.createPublicKey(key).export({format:'der',type:'spki'}).toString('base64')};
 }
 return {async sign(body){loading||=identity().catch(error=>{loading=null;throw error;});const {key,publicKey}=await loading;
  const stamp=String(Date.now()),nonce=crypto.randomBytes(16).toString('hex'),digest=crypto.createHash('sha256').update(body).digest('hex');
  const signature=crypto.sign(null,Buffer.from(['POST','/v1/place-chat',stamp,nonce,digest].join('\n')),key).toString('base64');
  return {'x-ct-public-key':publicKey,'x-ct-time':stamp,'x-ct-nonce':nonce,'x-ct-signature':signature};
 }};
}
module.exports={createRequestSigner};
