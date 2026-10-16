const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'../cleantouch-desktop');
function edit(name,fn){const file=path.join(root,name);fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8')));}
function replace(s,from,to){if(!s.includes(from))throw Error('Missing edit: '+from.slice(0,75));return s.replace(from,to);}
edit('index.html',s=>replace(s,'src="chat-memory.js"','src="chat-title.js"></script><script defer src="chat-memory.js"'));
edit('place-chat.js',s=>{
 s=replace(s,"liveAnswerElement=null,connectionMode=", "liveAnswerElement=null,liveAnswerRaw='',connectionMode=");
 s=replace(s,"const data=await bridge.placeChat({_requestGroup:'chat:'+token,image,messages:history});", "const messages=history.slice(-13).map((m,i,a)=>i===a.length-1?{...m,text:cleanTouchChatTitle.question(m.text,{photo:true,summarize:cleanTouchChatMemory.needsSummary})}:m);const data=await bridge.placeChat({_requestGroup:'chat:'+token,image,messages});");
 s=replace(s,"history.push({role:'model',text:data.answer.slice(0,3000)});item.classList.remove('pending');item.textContent=data.answer;", "const parsed=cleanTouchChatTitle.extract(data.answer);if(parsed.title)cleanTouchChatMemory.setSummary(parsed.title);history.push({role:'model',text:parsed.answer.slice(0,3000)});item.classList.remove('pending');item.textContent=parsed.answer;");
 s=replace(s,"body.textContent+=text;log.scrollTop=log.scrollHeight;", "liveAnswerRaw+=text;body.textContent=cleanTouchChatTitle.extract(liveAnswerRaw).answer;log.scrollTop=log.scrollHeight;");
 const start=s.indexOf(' async function selectImport()'),end=s.indexOf(' async function chooseImport(',start);if(start<0||end<0)throw Error('Upload function missing');
 s=s.slice(0,start)+` async function selectImport(){
  const token=++importGeneration;importLoading=true;controls();
  try{
   const data=await bridge.loadImage(el('chat-import-list').value);if(token!==importGeneration)return;
   cleanTouchLive.stop();bridge.cancelPlaceRequests?.('chat:'+generation).catch(()=>{});generation++;liveAnswerElement=null;shareStarting=false;failedLiveQuestion='';pendingProduct=null;pendingTarget='';
   if(shareOwnsCapture){shareOwnsCapture=false;await stopCapture(true);if(token!==importGeneration)return;}
   connectionMode='text';liveState('off');
   importedBlob=cleanTouchShopping.toBlob(data.image);image=data.image;panel.dataset.chatMode='photo';
   el('chat-source').querySelector('option[value=import]').disabled=false;el('chat-source').value='import';el('chat-import-preview').hidden=false;el('chat-import-image').src='data:image/jpeg;base64,'+data.image;
   const entry=message('user','업로드한 사진');const photo=document.createElement('img');photo.src='data:image/jpeg;base64,'+data.image;photo.alt=data.name||'이 대화에 업로드한 사진';entry.prepend(photo);
   el('chat-error').textContent='이 대화에 사진을 첨부했어요. 질문을 보낼 때 선택한 사진만 AI에 전달됩니다.';await cleanTouchChatMemory.commit();
  }catch(e){if(token===importGeneration)el('chat-error').textContent=e.message;}
  finally{if(token===importGeneration)importLoading=false;controls();}
 }
`+s.slice(end);
 s=replace(s,"el('chat-source').value='import';el('chat-import-preview').hidden=false;await selectImport();", "await selectImport();");
 s=replace(s,"liveAnswerElement=answer;controls();cleanTouchChatMemory.commit();", "liveAnswerElement=answer;liveAnswerRaw='';controls();cleanTouchChatMemory.commit();");
 s=replace(s,"await cleanTouchLive.ask(value);if(token!==generation)return;const body=", "await cleanTouchLive.ask(cleanTouchChatTitle.question(value,{summarize:cleanTouchChatMemory.needsSummary}));if(token!==generation)return;const parsed=cleanTouchChatTitle.extract(liveAnswerRaw);if(parsed.title)cleanTouchChatMemory.setSummary(parsed.title);const body=");
 return s;
});
edit('chat-memory.js',s=>replace(s,"if(id===chat.id){hooks.clear();id='';}","if(id===chat.id){hooks.clear();id='';summary='';}"));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));pkg.version='0.1.39';pkg.build.files.push('chat-title.js');fs.writeFileSync(path.join(root,'package.json'),JSON.stringify(pkg,null,2)+'\n');
edit('package-lock.json',s=>{const data=JSON.parse(s);data.version='0.1.39';data.packages[''].version='0.1.39';return JSON.stringify(data,null,2)+'\n';});
