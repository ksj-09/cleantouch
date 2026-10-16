import {getConnectionString} from '@netlify/database';
import {neon} from '@neondatabase/serverless';
import {AccessError,requestIdentity} from './request-auth.js';
export {AccessError};
type Admission={allowed:boolean;reason:string;remaining:number;retry_seconds:number};
export type UsageStore={reserve(subject:string,network:string,nonce:string,task:string,limits:number[]):Promise<Admission>};
const limit=(name:string,fallback:number)=>{const n=Number(process.env[name]);return Number.isSafeInteger(n)&&n>0?n:fallback;};
export const usageRequired=()=>process.env.USAGE_GUARD_MODE==='required'||Boolean(process.env.NETLIFY)&&process.env.USAGE_GUARD_MODE!=='off';
export const postgresUsage:UsageStore={async reserve(subject,network,nonce,task,limits){
 // One central ledger is shared across deploys as well as function instances.
 // Legacy Functions do not automatically expose the managed DB binding.
 const sql=neon(process.env.USAGE_DATABASE_URL||getConnectionString());
 const rows=await sql.query('SELECT * FROM ct_admit_request($1,$2,$3,$4,$5,$6,$7,$8)',[subject,network,nonce,task,...limits]) as Admission[];
 if(!rows[0]||typeof rows[0].allowed!=='boolean')throw Error('Invalid ledger response');return rows[0];
}};
export async function admitUsage(event:{body?:string;headers?:Record<string,string|undefined>},task:string,store:UsageStore=postgresUsage,required=usageRequired()){
 if(process.env.AI_PAUSED==='true')throw new AccessError(503,'AI 서비스를 잠시 점검하고 있어요.');
 if(!required)return;
 const secret=process.env.USAGE_IDENTITY_SECRET||'';
 if(secret.length<32)throw new AccessError(503,'AI 사용량 보호를 준비 중이에요.');
 const identity=requestIdentity(event,secret,process.env.AI_REQUIRE_SIGNED_REQUESTS==='true');
 const limits=[limit('AI_GLOBAL_DAILY_UNITS',1000),identity.legacy?limit('AI_LEGACY_DAILY_UNITS',100):limit('AI_DEVICE_DAILY_UNITS',300),limit('AI_NETWORK_DAILY_UNITS',600),limit('AI_NETWORK_MINUTE_UNITS',100)];
 let result:Admission;try{result=await store.reserve(identity.subject,identity.network,identity.nonce,task,limits);}catch(error){const e=error as {name?:string;code?:string};console.warn('ct_usage_store_failure',{kind:e.name||'unknown',code:typeof e.code==='string'?e.code.slice(0,20):'unknown'});throw new AccessError(503,'AI 사용량을 확인하지 못해 요청을 멈췄어요. 잠시 후 다시 시도해 주세요.');}
 if(!result.allowed){if(result.reason==='replay')throw new AccessError(409,'이미 처리한 요청이에요. 다시 전송해 주세요.');throw new AccessError(429,result.reason==='global'?'오늘 서비스의 AI 이용 한도에 도달했어요.':'이 기기 또는 네트워크의 AI 이용 한도에 도달했어요.',result.retry_seconds);}
}
