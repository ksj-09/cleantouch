export type ProductIdentity={visibleText:string;brand:string;modelCode:string;features:string[]};
export type SellerIdentity={brand?:string;model?:string;mpn?:string;gtin?:string};
const text=(v:unknown,max:number)=>typeof v==='string'?v.normalize('NFKC').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,max):'';
export const identityCode=(v:unknown)=>text(v,160).toUpperCase().replace(/[^\p{L}\p{N}]/gu,'');
function visiblyContains(fragment:string,visibleText:string){
 const wanted=identityCode(fragment),tokens=visibleText.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean).map(identityCode);
 for(let start=0;start<tokens.length;start++){let joined='';for(let end=start;end<Math.min(start+6,tokens.length);end++){joined+=tokens[end];if(joined===wanted)return true;if(joined.length>wanted.length)break;}}
 return false;
}
export function cleanProductIdentity(value:unknown):ProductIdentity{
 const v=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const visibleText=text(v.visibleText,240);
 let brand=text(v.brand,70),modelCode=text(v.modelCode,80);const code=identityCode(modelCode);
 if(!brand||identityCode(brand).length<2||!visiblyContains(brand,visibleText))brand='';
 // A generic category or an inferred brand is not a model identifier. Require
 // the identifier to occur verbatim (apart from separators) in visible text.
 if(code.length<5||!(/(?=.*[A-Z])(?=.*\d)/.test(code)||/^\d{12,14}$/.test(code))||!visiblyContains(modelCode,visibleText))modelCode='';
 const features=(Array.isArray(v.features)?v.features:[]).map(f=>text(f,100)).filter(Boolean).slice(0,6);
 return {visibleText,brand,modelCode,features};
}
export function matchingIdentifier(target:ProductIdentity|undefined,seller:SellerIdentity|undefined){
 if(!target?.brand||!target.modelCode||!seller?.brand)return '';
 if(identityCode(target.brand)!==identityCode(seller.brand))return '';
 const code=identityCode(target.modelCode);
 return [seller.model,seller.mpn,seller.gtin].some(v=>v&&identityCode(v)===code)?`${target.brand} ${target.modelCode}`:'';
}
export function detailPageUrl(value:string){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&!/(?:^|\/)(?:search|search\.all|search\.tmall|catalogsearch|s)(?:\/|\.|$)/i.test(u.pathname)&&!['q','query','search','s'].some(k=>u.searchParams.has(k));}catch{return false;}
}
