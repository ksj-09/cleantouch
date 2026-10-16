import {safePublicUrl} from './request-policy.js';

export type Offer={url:string;country:string;currency:string;price?:number;availability:'in_stock'|'out_of_stock'|'unknown';checkedAt:string};
export type Variant={sku:string;color?:string;size?:string;gtin?:string;images:string[];offers:Offer[]};
export type Product={id:string;title:string;brand:string;modelCode:string;category:string;variants:Variant[]};
export type Keyframe={time:number;x:number;y:number;width:number;height:number};
export type TaggedProduct={sku:string;activeFrom:number;activeTo:number;keyframes:Keyframe[]};
export type Catalogue={schemaVersion:1;dataClass:'test'|'merchant';tenantId:string;source:{id:string;permissionReference:string;updatedAt:string};products:Product[];contents:{id:string;title:string;products:TaggedProduct[]}[]};
export class CatalogueError extends Error{}
const fail=(message:string):never=>{throw new CatalogueError(message);};
const object=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v)?v:fail('객체 형식이 필요합니다.');
const text=(v:any,max=160)=>typeof v==='string'&&v.trim()&&v.length<=max&&!/[\u0000-\u001f<>]/.test(v)?v.trim():fail('필수 문자열이 비어 있거나 너무 길어요.');
const id=(v:any)=>{const s=text(v,100);return /^[a-zA-Z0-9_-]+$/.test(s)?s:fail('ID는 영문·숫자·밑줄·하이픈만 사용하세요.');};
const array=(v:any,max:number)=>Array.isArray(v)&&v.length<=max?v:fail('목록 형식 또는 항목 수를 확인해 주세요.');
const date=(v:any)=>{const s=text(v,40);return /^\d{4}-\d{2}-\d{2}T/.test(s)&&/(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s))?s:fail('시각은 시간대가 포함된 ISO 날짜로 입력하세요.');};
const number=(v:any,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:fail('숫자 범위를 확인해 주세요.');
export const normalized=(v:string)=>v.normalize('NFKC').toLocaleUpperCase('en-US').replace(/[\s_-]/g,'');
function publicUrl(v:any){const s=text(v,3000),safe=safePublicUrl(s);if(!safe)fail('공개 HTTPS 주소가 필요합니다.');const host=new URL(safe).hostname;if(/\.(?:local|internal|localhost)$/i.test(host)||/^[\d.]+$/.test(host)||host.includes(':'))fail('공개 판매처의 도메인 주소가 필요합니다.');return safe;}
function productUrl(v:any){const s=publicUrl(v),u=new URL(s);if(/(?:^|\/)(?:search|s|search\.tmall)(?:\/|\.|$)/i.test(u.pathname))fail('검색 결과가 아닌 상품 상세 URL을 입력하세요.');return s;}
export function validGtin(value:string){
 if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value))return false;
 let sum=0;for(let i=value.length-2,weight=3;i>=0;i--,weight=weight===3?1:3)sum+=Number(value[i])*weight;
 return (10-sum%10)%10===Number(value.at(-1));
}
export function parseCatalogue(input:unknown):Catalogue{
 const c=object(input);if(c.schemaVersion!==1||!['test','merchant'].includes(c.dataClass))fail('schemaVersion=1과 dataClass(test/merchant)가 필요합니다.');
 const source=object(c.source),skus=new Set<string>(),productIds=new Set<string>();
 const products:Product[]=array(c.products,5000).map((raw:any)=>{
  const p=object(raw),pid=id(p.id);if(productIds.has(pid))fail('상품 ID가 중복됐어요.');productIds.add(pid);
  const variants:Variant[]=array(p.variants,200).map((raw:any)=>{
   const v=object(raw),sku=id(v.sku);if(skus.has(sku))fail('SKU는 카탈로그 안에서 고유해야 합니다.');skus.add(sku);
   const gtin=v.gtin===undefined?undefined:text(v.gtin,14);if(gtin&&!validGtin(gtin))fail('GTIN 자릿수 또는 검증 숫자가 틀렸어요.');
   const offers:Offer[]=array(v.offers,30).map((raw:any)=>{const o=object(raw);if(!/^[A-Z]{2}$/.test(o.country)||!/^[A-Z]{3}$/.test(o.currency)||!['in_stock','out_of_stock','unknown'].includes(o.availability))fail('국가·통화·재고 상태를 확인하세요.');return {url:productUrl(o.url),country:o.country,currency:o.currency,...(o.price!==undefined?{price:number(o.price)}:{}),availability:o.availability,checkedAt:date(o.checkedAt)};});
   const images=array(v.images,8).map(publicUrl);if(!images.length)fail('SKU별 참조 이미지가 하나 이상 필요합니다.');
   return {sku,...(v.color!==undefined?{color:text(v.color,60)}:{}),...(v.size!==undefined?{size:text(v.size,60)}:{}),...(gtin?{gtin}:{}),images,offers};
  });
  if(!variants.length)fail('상품별 SKU가 하나 이상 필요합니다.');return {id:pid,title:text(p.title),brand:p.brand?text(p.brand,80):'',modelCode:p.modelCode?text(p.modelCode,80):'',category:p.category?text(p.category,80):'',variants};
 });
 const contentIds=new Set<string>();
 const contents=array(c.contents??[],2000).map((raw:any)=>{const content=object(raw),cid=id(content.id);if(contentIds.has(cid))fail('영상 ID가 중복됐어요.');contentIds.add(cid);
  return {id:cid,title:text(content.title),products:array(content.products,500).map((raw:any)=>{
   const p=object(raw),sku=id(p.sku);if(!skus.has(sku))fail('영상 태그의 SKU가 카탈로그에 없어요.');const from=number(p.activeFrom),to=number(p.activeTo);if(to<=from)fail('상품 노출 종료는 시작보다 늦어야 합니다.');
   const keyframes:Keyframe[]=array(p.keyframes,1000).map((raw:any)=>{const f=object(raw),time=number(f.time,from,to),x=number(f.x,0,100),y=number(f.y,0,100),width=number(f.width,.01,100),height=number(f.height,.01,100);if(x+width>100||y+height>100)fail('태그 영역이 영상 밖으로 나갔어요.');return {time,x,y,width,height};});
   if(!keyframes.length||keyframes.some((f,i)=>i>0&&f.time<=keyframes[i-1]!.time))fail('키프레임은 시간순이며 중복 시각이 없어야 합니다.');return {sku,activeFrom:from,activeTo:to,keyframes};
  })};
 });
 return {schemaVersion:1,dataClass:c.dataClass,tenantId:id(c.tenantId),source:{id:id(source.id),permissionReference:text(source.permissionReference,300),updatedAt:date(source.updatedAt)},products,contents};
}
export function regionAt(tag:TaggedProduct,time:number){
 const frames=tag.keyframes;if(time<=frames[0]!.time)return frames[0]!;if(time>=frames.at(-1)!.time)return frames.at(-1)!;
 const n=frames.findIndex(f=>f.time>=time),a=frames[n-1]!,b=frames[n]!,ratio=(time-a.time)/(b.time-a.time),blend=(x:number,y:number)=>x+(y-x)*ratio;
 return {time,x:blend(a.x,b.x),y:blend(a.y,b.y),width:blend(a.width,b.width),height:blend(a.height,b.height)};
}
type Evidence={brand?:string;modelCode?:string;gtin?:string;color?:string;size?:string;country:string};
export function createCatalogueIndex(catalogue:Catalogue,now=()=>Date.now()){
 const snapshot=structuredClone(catalogue),rows=snapshot.products.flatMap(product=>product.variants.map(variant=>({product,variant})));
 function summary(){return {dataClass:snapshot.dataClass,tenantId:snapshot.tenantId,source:snapshot.source,products:snapshot.products.length,variants:rows.length,contents:snapshot.contents.length};}
 function result(status:string,matches:typeof rows,reason:string,country:string){
  return {status,dataClass:snapshot.dataClass,sourceId:snapshot.source.id,reason,candidates:matches.map(({product,variant})=>({productId:product.id,title:product.title,brand:product.brand,modelCode:product.modelCode,sku:variant.sku,color:variant.color,size:variant.size,images:variant.images,offers:variant.offers.filter(o=>o.country===country).map(o=>{const age=now()-Date.parse(o.checkedAt),fresh=age>=0&&age<=86400000;return {...o,dataFresh:fresh,availability:fresh?o.availability:'unknown',purchaseConfirmed:false};})})),notice:'판매자 제공 자료의 식별자 또는 등록 태그를 조회한 결과입니다. 이미지 AI 정확도나 실시간 재고·결제 완료를 확인한 결과가 아닙니다.'};
 }
 function scope(tenantId:string,country:string){if(tenantId!==snapshot.tenantId)fail('허용된 고객 카탈로그가 아닙니다.');if(!/^[A-Z]{2}$/.test(country))fail('국가 코드는 대문자 두 글자입니다.');}
 function lookup(tenantId:string,evidence:Evidence){
  scope(tenantId,evidence.country);for(const k of ['brand','modelCode','gtin','color','size'] as const)if(evidence[k]!==undefined&&(typeof evidence[k]!=='string'||evidence[k]!.length>100))fail('식별 단서 형식을 확인하세요.');
  if(evidence.gtin&&!validGtin(evidence.gtin))fail('유효한 GTIN을 입력하세요.');
  if(!evidence.gtin&&!(evidence.brand?.trim()&&evidence.modelCode?.trim()))return result('needs_evidence',[],'브랜드와 모델번호 또는 GTIN이 필요해요. 색·종류만으로 동일 상품을 확정하지 않습니다.',evidence.country);
  let matching=rows.filter(({product,variant})=>evidence.gtin?variant.gtin===evidence.gtin:normalized(product.brand)===normalized(evidence.brand!)&&normalized(product.modelCode)===normalized(evidence.modelCode!));
  if(evidence.brand)matching=matching.filter(r=>normalized(r.product.brand)===normalized(evidence.brand!));
  if(evidence.modelCode)matching=matching.filter(r=>normalized(r.product.modelCode)===normalized(evidence.modelCode!));
  if(evidence.color)matching=matching.filter(r=>r.variant.color&&normalized(r.variant.color)===normalized(evidence.color!));
  if(evidence.size)matching=matching.filter(r=>r.variant.size&&normalized(r.variant.size)===normalized(evidence.size!));
  if(!matching.length)return result('not_found',[],'제공된 카탈로그에서 해당 식별자와 옵션을 찾지 못했어요.',evidence.country);
  const inCountry=matching.filter(r=>r.variant.offers.some(o=>o.country===evidence.country));
  if(!inCountry.length)return result('region_unavailable',matching,'입력 국가의 판매 링크가 등록되지 않았어요.',evidence.country);
  return result(inCountry.length===1?'identifier_match':'options_required',inCountry,inCountry.length===1?'입력한 식별자와 옵션에 해당하는 SKU입니다. 사진의 상품과 같은지는 별도 확인이 필요합니다.':'여러 옵션이 있어 색상·사이즈를 더 선택해 주세요.',evidence.country);
 }
 function resolve(tenantId:string,contentId:string,time:number,point:{x:number;y:number},country:string){
  scope(tenantId,country);number(time);number(point?.x,0,1);number(point?.y,0,1);
  const content=snapshot.contents.find(c=>c.id===contentId);if(!content)return result('content_not_found',[],'등록된 영상이 아닙니다.',country);
  const selected=content.products.filter(t=>{if(time<t.activeFrom||time>t.activeTo)return false;const b=regionAt(t,time);return point.x*100>=b.x&&point.x*100<=b.x+b.width&&point.y*100>=b.y&&point.y*100<=b.y+b.height;});
  const matches=rows.filter(r=>selected.some(t=>t.sku===r.variant.sku));
  return result(matches.length===1?'publisher_mapped':matches.length?'ambiguous':'not_found',matches,matches.length===1?'판매자가 이 영상 구간과 위치에 등록한 상품입니다. AI의 추측으로 연결한 상품이 아닙니다.':matches.length?'여러 상품 영역이 겹칩니다. 상품을 다시 선택해 주세요.':'이 시각·위치에 등록된 상품이 없어요.',country);
 }
 function sdkContent(tenantId:string,contentId:string,country:string){
  scope(tenantId,country);const content=snapshot.contents.find(c=>c.id===contentId);if(!content)return null;
  const omittedSkus:string[]=[];
  const products=content.products.flatMap(t=>{const r=rows.find(r=>r.variant.sku===t.sku)!,offer=r.variant.offers.find(o=>o.country===country);if(!offer||offer.price===undefined){omittedSkus.push(t.sku);return [];}return [{id:r.variant.sku,name:r.product.title,price:offer.price,currency:offer.currency,image:r.variant.images[0],productUrl:offer.url,activeFrom:t.activeFrom,activeTo:t.activeTo,keyframes:t.keyframes,metadata:{catalogueProductId:r.product.id,sku:r.variant.sku,dataClass:snapshot.dataClass,purchaseConfirmed:false}}];});
  return {contentId,products,omittedSkus,notice:omittedSkus.length?'국가별 판매 링크나 가격이 없는 SKU는 기존 SDK에서 0원으로 표시되지 않도록 제외했습니다.':''};
 }
 return {summary,lookup,resolve,sdkContent};
}
