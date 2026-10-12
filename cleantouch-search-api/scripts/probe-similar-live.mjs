import fs from 'node:fs/promises';import path from 'node:path';
const endpoint='https://cleantouch-place-ai-20261006.netlify.app/v1/place-chat';
const image=(await fs.readFile(path.resolve('../artifacts/verification/release-0.1.36-video.jpg'))).toString('base64');
async function call(body){const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.message);return data;}
const auth=await call({task:'live-token',shoppingTools:true});
const ws=new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(auth.token));
let text='',tools=[],sources=[];
const result=await new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(Error('Live similarity response timed out')),65000);
 ws.addEventListener('open',()=>ws.send(JSON.stringify({setup:auth.setup})));
 ws.addEventListener('error',()=>reject(Error('Live connection failed')));
 ws.addEventListener('message',async event=>{try{const data=JSON.parse(typeof event.data==='string'?event.data:await event.data.text());if(data.error)throw Error(data.error.message);
  if(data.setupComplete){ws.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{inlineData:{data:image,mimeType:'image/jpeg'}}]}],turnComplete:false}}));ws.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:'저 빨간색 상품과 색·모양이 최대한 비슷한 상품을 사고 싶어. 실제 구매처나 검색 버튼을 알려줘.'}]}],turnComplete:true}}));}
  for(const fn of data.toolCall?.functionCalls||[]){tools.push({name:fn.name,args:fn.args});const found=await call({task:'similar',image,target:fn.args.query,messages:[{role:'user',text:'비슷한 상품 구매처를 찾아줘.'}]});sources.push(found);ws.send(JSON.stringify({toolResponse:{functionResponses:[{id:fn.id,name:fn.name,response:found}]}}));}
  text+=data.serverContent?.outputTranscription?.text||'';
  if(data.serverContent?.turnComplete){clearTimeout(timer);resolve({text,tools,sources});}
 }catch(error){clearTimeout(timer);reject(error);}});
});
ws.close();await fs.writeFile(path.resolve('../artifacts/verification/similar-live-probe.json'),JSON.stringify(result,null,2));
if(!result.text.trim()||!result.tools.some(t=>t.name==='find_similar_products'))throw Error('Purchase question did not reach similarity search');
console.log(JSON.stringify(result));
