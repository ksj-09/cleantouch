import fs from 'node:fs/promises';
import sharp from 'sharp';
// Saved scenes from the user's public lightsaber short; send video pixels only.
const older=await sharp('../artifacts/verification/live-clean-video.jpg').jpeg({quality:92}).toBuffer();
const target=await sharp('../artifacts/verification/lightsaber-scene.png').extract({left:407,top:214,width:394,height:599}).jpeg({quality:92}).toBuffer();
const response=await fetch('https://cleantouch-place-ai-20261006.netlify.app/v1/place-chat',{
 method:'POST',headers:{'content-type':'application/json'},
 body:JSON.stringify({task:'objects',image:target.toString('base64'),images:[older,target].map(b=>b.toString('base64')),messages:[{role:'user',text:'같은 영상의 주변 장면을 참고해 대상 장면의 실제 상품과 발광 상태를 검증해줘.'}]}),signal:AbortSignal.timeout(55000)});
const data=await response.json();
console.log(JSON.stringify({status:response.status,products:data.products,message:data.message}));
await fs.writeFile('../artifacts/verification/temporal-public-probe.json',JSON.stringify({status:response.status,...data},null,2));
const unlit=[.308,.463,.503,.626];
const falseBlade=(data.products||[]).some(p=>{
 if(!/광선검/.test(p.label))return false;
 if(/흰|하얀|화이트/.test(p.label))return true;
 const b=p.box,overlap=Math.max(0,Math.min(b[2],unlit[2])-Math.max(b[0],unlit[0]))*Math.max(0,Math.min(b[3],unlit[3])-Math.max(b[1],unlit[1]));
 return overlap/((b[2]-b[0])*(b[3]-b[1]))>.6;
});
console.log(JSON.stringify({unlitBladeRejected:!falseBlade}));
if(!response.ok||falseBlade||data.products?.some(p=>!p.temporalVerified))process.exitCode=1;
