import {createHash,createPublicKey,verify,createHmac,randomUUID} from 'node:crypto';
export class AccessError extends Error{constructor(public status:number,message:string,public retryAfterSeconds?:number){super(message);}}
export const requestDigest=(body:string)=>createHash('sha256').update(body).digest('hex');
export function requestIdentity(event:{body?:string;headers?:Record<string,string|undefined>},secret:string,required=false,now=Date.now()){
 const headers=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 const network=createHmac('sha256',secret).update('network\0'+(headers['x-nf-client-connection-ip']||'unknown')).digest('hex');
 const supplied=['x-ct-public-key','x-ct-time','x-ct-nonce','x-ct-signature'].some(k=>headers[k]!==undefined);
 if(!supplied){if(required)throw new AccessError(401,'앱을 최신 버전으로 업데이트해 주세요.');return {subject:createHmac('sha256',secret).update('legacy\0'+network).digest('hex'),network,nonce:requestDigest(randomUUID()),legacy:true};}
 try{
  const keyText=headers['x-ct-public-key']||'',stamp=headers['x-ct-time']||'',nonce=headers['x-ct-nonce']||'',signature=headers['x-ct-signature']||'';
  if(!/^\d{13}$/.test(stamp)||Math.abs(now-Number(stamp))>60000||!/^[a-f0-9]{32}$/.test(nonce)||!/^[A-Za-z0-9+/]{59}=$/.test(keyText)||!/^[A-Za-z0-9+/]{86}==$/.test(signature))throw Error('invalid signature fields');
  const publicKey=createPublicKey({key:Buffer.from(keyText,'base64'),type:'spki',format:'der'});
  if(publicKey.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(['POST','/v1/place-chat',stamp,nonce,requestDigest(event.body||'')].join('\n')),publicKey,Buffer.from(signature,'base64')))throw Error('invalid signature');
  return {subject:requestDigest(keyText),network,nonce:requestDigest(keyText+'\0'+nonce),legacy:false};
 }catch{throw new AccessError(401,'요청 인증을 확인하지 못했어요. 앱을 다시 실행해 주세요.');}
}
