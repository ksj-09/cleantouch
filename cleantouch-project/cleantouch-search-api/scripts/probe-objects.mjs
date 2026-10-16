import fs from 'node:fs/promises';
const image=(await fs.readFile('../artifacts/verification/live-fix-scene.jpg')).toString('base64');
const response=await fetch('https://cleantouch-place-ai-20261006.netlify.app/v1/place-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task:'objects',image,messages:[{role:'user',text:'영상 상품 위치 분석'}]}),signal:AbortSignal.timeout(55000)});
const body=await response.json();console.log(JSON.stringify({status:response.status,...body}));if(!response.ok)process.exitCode=1;
if(response.ok)await fs.writeFile('../artifacts/verification/live-fix-objects.json',JSON.stringify(body,null,2));
