const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../cleantouch-desktop');
function edit(file,from,to){const target=path.join(root,file);let s=fs.readFileSync(target,'utf8');if(!s.includes(from))throw Error('Missing edit: '+from.slice(0,60));fs.writeFileSync(target,s.replace(from,to));}
edit('index.html','<script defer src="chat-title.js">','<script defer src="conversation-context.js"></script><script defer src="chat-title.js">');
edit('chat-memory.js',"if(id===chat.id){hooks.clear();id='';summary='';}","if(id===chat.id){hooks.clear();id='';summary='';contextMessages=[];}");
edit('place-chat.js',"mode,getHistory:()=>history,", "mode,getHistory:()=>history,getContext:()=>cleanTouchChatMemory.memo(input.value),");
// The callback runs after the input is cleared. Use the plain question passed by sendLive instead.
edit('place-chat.js',"getContext:()=>cleanTouchChatMemory.memo(input.value)","getContext:()=>cleanTouchChatMemory.memo(failedLiveQuestion||liveQuestion)");
edit('place-chat.js',"liveAnswerRaw='',connectionMode=", "liveAnswerRaw='',liveQuestion='',pendingContinue=false,connectionMode=");
edit('place-chat.js',"liveAnswerRaw='';controls();", "liveAnswerRaw='';liveQuestion=value;controls();");
edit('place-chat.js',"const messages=history.slice(-13).map", "const memo=cleanTouchChatMemory.memo(history.at(-1)?.text||'',1100);const messages=history.slice(-13).map");
edit('place-chat.js',"m);const data=await bridge.placeChat", "i===0&&memo?{...m,text:memo+'\\n'+m.text.slice(0,1800)}:m);const data=await bridge.placeChat");
const file=path.join(root,'place-chat.js');let s=fs.readFileSync(file,'utf8');const location=s.indexOf(' async function reply()');if(location<0)throw Error('Reply missing');
s=s.slice(0,location)+` async function keepConversation(){bridge.cancelPlaceRequests?.('chat:'+generation).catch(()=>{});generation++;cleanTouchLive.stop();if(shareOwnsCapture){shareOwnsCapture=false;await stopCapture(true);}connectionMode='text';shareStarting=false;liveAnswerElement=null;busy=false;pendingProduct=null;pendingTarget='';pendingContinue=false;liveState('off');}
`+s.slice(location);fs.writeFileSync(file,s);
edit('place-chat.js',"async function showProduct(blob,data){if(busy)return;reset();", "async function showProduct(blob,data,continueConversation=false){if(busy)return;if(continueConversation)await keepConversation();else reset();");
edit('place-chat.js',"history=[{role:'user',text:'이 선택 상품을 분석하고 검색을 도와줘.'}","history=[...(continueConversation?history.slice(-38):[]),{role:'user',text:'이 선택 상품을 분석하고 검색을 도와줘.'}");
edit('place-chat.js',"async function identify(blob,target=''){if(busy)return;reset();pendingProduct=blob;", "async function identify(blob,target='',continueConversation=false){if(busy)return;if(continueConversation)await keepConversation();else reset();pendingContinue=continueConversation;pendingProduct=blob;");
edit('place-chat.js',"await showProduct(blob,data);", "await showProduct(blob,data,continueConversation);");
edit('place-chat.js',"if(importedBlob)await identify(importedBlob);", "if(importedBlob)await identify(importedBlob,'',true);");
edit('place-chat.js',"identify(pendingProduct,pendingTarget);", "identify(pendingProduct,pendingTarget,pendingContinue);");
edit('renderer.js',"await closeFocusPicker();\r\n      await window.cleanTouchPlaceChat.identify(image);", "const continueConversation=focusChatProduct;\r\n      await closeFocusPicker();\r\n      await window.cleanTouchPlaceChat.identify(image,'',continueConversation);");
const pkgFile=path.join(root,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgFile,'utf8'));pkg.version='0.1.41';pkg.build.files.push('conversation-context.js');fs.writeFileSync(pkgFile,JSON.stringify(pkg,null,2)+'\n');
const lockFile=path.join(root,'package-lock.json'),lock=JSON.parse(fs.readFileSync(lockFile,'utf8'));lock.version=pkg.version;lock.packages[''].version=pkg.version;fs.writeFileSync(lockFile,JSON.stringify(lock,null,2)+'\n');
