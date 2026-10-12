import fs from 'node:fs/promises';
const image=await fs.readFile('../artifacts/verification/release-0.1.36-video.jpg');
const response=await fetch('https://cleantouch-place-ai-20261006.netlify.app/v1/place-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task:'live-token'}),signal:AbortSignal.timeout(20000)});
const auth=await response.json();if(!response.ok)throw Error(auth.message);
let text='',timer;const socket=new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(auth.token));
await new Promise((resolve,reject)=>{
 timer=setTimeout(()=>reject(Error('Ordered Live probe timed out')),60000);
 socket.onopen=()=>socket.send(JSON.stringify({setup:auth.setup}));
 socket.onmessage=async event=>{try{const value=JSON.parse(typeof event.data==='string'?event.data:await event.data.text());if(value.error){reject(Error(value.error.message));return;}if(value.setupComplete){socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{inlineData:{mimeType:'image/jpeg',data:image.toString('base64')}}]}],turnComplete:false}}));socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:'이 화면에서 가장 눈에 띄는 상품의 종류와 색상을 말해줘. 실제 보이는 근거만 답해줘.'}]}],turnComplete:true}}));}if(value.serverContent?.outputTranscription?.text)text+=value.serverContent.outputTranscription.text;if(value.serverContent?.turnComplete)resolve();}catch(error){reject(error);}};
 socket.onerror=()=>reject(Error('Ordered Live probe connection failed'));
}).finally(()=>{clearTimeout(timer);socket.close();});
console.log(JSON.stringify({orderedImageInput:true,answer:text}));
await fs.writeFile('../artifacts/verification/live-ordered-probe.json',JSON.stringify({orderedImageInput:true,answer:text},null,2));
