import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import sharp from 'sharp';
import {safePublicUrl} from './request-policy.js';
import {detailPageUrl,type SellerIdentity} from './product-identity.js';

export type SellerPhoto={pageUrl:string;title:string;bytes:Buffer;preview:string;identity?:SellerIdentity};
export type SellerPhotoLoader=(url:string,signal:AbortSignal)=>Promise<SellerPhoto|null>;
export function publicAddress(address:string){
 if(isIP(address)===4){const n=address.split('.').map(Number);return !([0,10,127].includes(n[0]!)||n[0]!>=224||n[0]===169&&n[1]===254||n[0]===172&&n[1]!>=16&&n[1]!<=31||n[0]===192&&n[1]===168||n[0]===100&&n[1]!>=64&&n[1]!<=127||n[0]===198&&(n[1]===18||n[1]===19));}
 // Public global-unicast IPv6 only. Reject mapped/compatible IPv4, loopback,
 // local, multicast, documentation and transition addresses.
 return isIP(address)===6&&/^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:(?:db8|0):|^2002:/i.test(address);
}
export async function download(url:string,signal:AbortSignal,maxBytes:number,redirects=0):Promise<{url:string;type:string;bytes:Buffer}>{
 const safe=safePublicUrl(url);if(!safe||redirects>3)throw Error('Invalid public URL');
 const parsed=new URL(safe);if(parsed.port&&parsed.port!=='443')throw Error('Unsupported port');
 signal.throwIfAborted();const addresses=await lookup(parsed.hostname,{all:true});signal.throwIfAborted();
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('Private address');
 // Pin the validated DNS address for this connection. Every redirect is
 // revalidated, and no automatic redirects or credential forwarding occur.
 const pinned=addresses[0]!;
 return new Promise((resolve,reject)=>{
  const request=https.get(parsed,{signal,headers:{'user-agent':'CleanTouch/1.0 product-photo-check','accept':'text/html,image/*'},lookup:((_host:any,options:any,callback:any)=>options?.all?callback(null,[pinned]):callback(null,pinned.address,pinned.family)) as any},response=>{
   if([301,302,303,307,308].includes(response.statusCode||0)&&response.headers.location){response.resume();download(new URL(response.headers.location,parsed).href,signal,maxBytes,redirects+1).then(resolve,reject);return;}
   if(response.statusCode!==200){response.resume();reject(Error('Page unavailable'));return;}
   if(Number(response.headers['content-length'])>maxBytes){response.destroy();reject(Error('Page too large'));return;}
   const chunks:Buffer[]=[];let total=0;
   response.on('data',chunk=>{total+=chunk.length;if(total>maxBytes){response.destroy(Error('Page too large'));return;}chunks.push(chunk);});
   response.on('error',reject);response.on('end',()=>resolve({url:parsed.href,type:String(response.headers['content-type']||'').split(';')[0]!,bytes:Buffer.concat(chunks)}));
  });
  request.setTimeout(4000,()=>request.destroy(Error('Page timeout')));request.on('error',reject);
 });
}
function entity(text:string){return text.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_m,n)=>String.fromCodePoint(Math.min(0x10ffff,Number(n))));}
export function productPhoto(html:string,pageUrl:string):{url:string;title:string}|null{
 if(!detailPageUrl(pageUrl))return null;
 const meta=new Map<string,string>();
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attributes=new Map<string,string>();for(const a of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attributes.set(a[1]!.toLowerCase(),entity(a[2]??a[3]??''));const key=attributes.get('property')||attributes.get('name');if(key)meta.set(key.toLowerCase(),attributes.get('content')||'');}
 let image='',title='',isProduct=false,productCount=0;
 function walk(value:any,depth=0){if(!value||depth>8)return;if(Array.isArray(value)){value.slice(0,30).forEach(v=>walk(v,depth+1));return;}if(typeof value!=='object')return;const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];if(types.some((t:any)=>typeof t==='string'&&/(?:^|\/)Product(?:Group)?$/.test(t))){productCount++;isProduct=true;title=typeof value.name==='string'?value.name:title;const img=Array.isArray(value.image)?value.image[0]:value.image;image=typeof img==='string'?img:typeof img?.url==='string'?img.url:image;}if(value['@graph'])walk(value['@graph'],depth+1);if(value.mainEntity)walk(value.mainEntity,depth+1);}
 for(const tag of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(tag[1]!));}catch{}}
 isProduct ||= /product/i.test(meta.get('og:type')||'')||meta.has('product:price:amount');
 if(!isProduct||productCount>1)return null;image=image||meta.get('og:image:secure_url')||meta.get('og:image')||'';title ||= meta.get('og:title')||'';
 try{const url=safePublicUrl(new URL(entity(image),pageUrl).href);return url&&image?{url,title:title.slice(0,180)}:null;}catch{return null;}
}
export const loadSellerPhoto:SellerPhotoLoader=async(url,signal)=>{
 try{
  // Real storefronts commonly exceed 1 MB even before their product metadata.
  // Keep a hard bound, but do not silently exclude normal 1–4 MB detail pages.
  const page=await download(url,signal,4_000_000);if(!['text/html','application/xhtml+xml'].includes(page.type))return null;
  const photo=productPhoto(page.bytes.toString('utf8'),page.url);if(!photo)return null;
  const file=await download(photo.url,signal,2_000_000);if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))return null;
  const raster=sharp(file.bytes,{limitInputPixels:12_000_000,failOn:'error'});const metadata=await raster.metadata();if(!metadata.width||!metadata.height||Math.min(metadata.width,metadata.height)<80||Math.max(metadata.width,metadata.height)<256)return null;
  const bytes=await raster.rotate().resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:88}).toBuffer();
  const preview=(await sharp(bytes).resize({width:240,height:240,fit:'inside',withoutEnlargement:true}).jpeg({quality:78}).toBuffer()).toString('base64');
  return {pageUrl:page.url,title:photo.title,bytes,preview,identity:sellerIdentity(page.bytes.toString('utf8'))};
 }catch{return null;}
};
export function sellerIdentity(html:string):SellerIdentity{
 const products:any[]=[];
 function walk(v:any,depth=0){if(!v||depth>8)return;if(Array.isArray(v)){v.slice(0,30).forEach(x=>walk(x,depth+1));return;}if(typeof v!=='object')return;
  const types=Array.isArray(v['@type'])?v['@type']:[v['@type']];if(types.some((t:any)=>typeof t==='string'&&/(?:^|\/)Product(?:Group)?$/.test(t)))products.push(v);
  if(v['@graph'])walk(v['@graph'],depth+1);if(v.mainEntity)walk(v.mainEntity,depth+1);
 }
 for(const tag of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{walk(JSON.parse(tag[1]!));}catch{}
 // Multiple products on a listing cannot establish one selected product's ID.
 if(products.length!==1)return {};
 const p=products[0],clean=(v:any)=>typeof v==='string'?v.trim().slice(0,100):'';
 const types=Array.isArray(p['@type'])?p['@type']:[p['@type']];if(types.some((t:any)=>typeof t==='string'&&/ProductGroup$/.test(t))||p.hasVariant)return {};
 return {brand:clean(typeof p.brand==='object'?p.brand?.name:p.brand),model:clean(p.model),mpn:clean(p.mpn),gtin:clean(p.gtin14||p.gtin13||p.gtin12||p.gtin)};
}
