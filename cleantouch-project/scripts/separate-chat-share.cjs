const fs=require('node:fs');const file='cleantouch-desktop/place-chat.js';let code=fs.readFileSync(file,'utf8');
function replace(old,next){if(!code.includes(old))throw Error('Missing source: '+old.slice(0,70));code=code.replace(old,next);}
replace("let failedLiveQuestion='',shareStarting=false,liveAnswerElement=null;","let failedLiveQuestion='',shareStarting=false,liveAnswerElement=null,connectionMode='text';");
replace("el('chat-live-stop').hidden=phase==='off';","el('chat-live-stop').hidden=phase==='off'||connectionMode!=='screen';panel.dataset.chatMode=connectionMode;");
replace("const available=image||window.cleanTouchLive?.active||el('chat-source').value==='screen'","const available=true");
code=code.replaceAll('현재 화면을 공유하거나 사진을 업로드한 뒤 궁금한 내용을 물어보세요.','안녕하세요! 편하게 물어보세요. 화면은 공유 버튼을 눌러 허용할 때만 AI에 전송돼요.');
replace("generation++;window.cleanTouchLive?.stop();panel.dataset.liveState='off';","generation++;window.cleanTouchLive?.stop();cleanTouchPermissions.cancel();connectionMode='text';panel.dataset.chatMode='text';panel.dataset.liveState='off';");
replace("async function reply(){if(busy||!image||history.at(-1)?.role!=='user')return;","async function reply(){if(busy||!image||history.at(-1)?.role!=='user')return;panel.dataset.chatMode='photo';");
replace("async function openAssistant(){await open();if(el('chat-source').value==='import'&&!image&&importedBlob)await analyze();else if(stream&&!image&&!cleanTouchLive.active)await el('chat-place').onclick();}","async function openAssistant(){await open();input.focus();}");
replace("async function startScreenShare(clearConversation=false){","async function connectAi(mode='text',clearConversation=false){");
replace("if(clearConversation)reset();const token=generation;shareStarting=true;liveState('connecting');","if(clearConversation)reset();const token=generation;connectionMode=mode;shareStarting=true;liveState('connecting');");
replace("if(!stream)await startCapture();if(token!==generation)return;if(!stream)throw Error('화면 공유를 시작해 주세요.');","if(mode==='screen'){if(!stream&&phase!=='idle')await reset();if(token!==generation)return;if(!stream)await startCapture();if(token!==generation)return;if(!stream)throw Error('화면 캡처를 시작하지 못했어요.');}");
replace("if(returnWidget||liveCompanion){document.body.classList.remove('compact-widget');","if(mode==='screen'&&(returnWidget||liveCompanion)){document.body.classList.remove('compact-widget');");
replace("await cleanTouchLive.start({getHistory:","await cleanTouchLive.start({mode,getHistory:");
const oldStart="el('chat-place').onclick=async()=>{if(el('chat-source').value==='import'){if(image){el('chat-error').textContent='선택한 사진에 대해 질문해 주세요.';return;}await analyze();return;}await startScreenShare(false);};";
replace(oldStart,"async function startScreenShare(){if(busy||shareStarting)return;const token=generation;if(!await cleanTouchPermissions.request('share')||token!==generation)return;image='';el('chat-source').value='screen';el('chat-import-preview').hidden=true;await connectAi('screen');}\n el('chat-place').onclick=startScreenShare;");
replace("el('chat-live-stop').onclick=()=>{generation++;","el('chat-live-stop').onclick=()=>{bridge.cancelPlaceRequests?.('chat:'+generation).catch(()=>{});generation++;");
replace("cleanTouchLive.stop();liveState('off');el('chat-error').textContent='화면 공유를 종료했어요. 질문하면 다시 연결할 수 있어요.';","cleanTouchLive.stop();connectionMode='text';el('chat-source').value='none';liveState('off');el('chat-error').textContent='화면 공유를 종료했어요. 이제 텍스트로만 대화합니다.';");
replace("cleanTouchChatMemory.commit();importGeneration++;importLoading=false;","cleanTouchChatMemory.commit();cleanTouchPermissions.cancel();importGeneration++;importLoading=false;");
replace("if(!cleanTouchLive.active)await startScreenShare(false);if(cleanTouchLive.active)await sendLive(question,false);","if(!cleanTouchLive.active)await connectAi('text');if(cleanTouchLive.active)await sendLive(question,false);");
const start=code.indexOf(" el('chat-form').onsubmit="),end=code.indexOf(' async function showProduct',start);if(start<0||end<0)throw Error('Submit handler missing');
code=code.slice(0,start)+` el('chat-form').onsubmit=async event=>{
  event.preventDefault();const value=input.value.trim(),token=generation;if(busy||shareStarting||!value)return;
  if(image&&el('chat-source').value==='import'){if(history.at(-1)?.role==='user')history.pop();history=history.slice(-12);history.push({role:'user',text:value});message('user',value);input.value='';cleanTouchChatMemory.commit();await reply();return;}
  if(!cleanTouchLive.active)await connectAi('text');if(token!==generation)return;
  if(!cleanTouchLive.active){failedLiveQuestion=value;message('user',value);input.value='';message('model','AI와 연결하지 못했어요. '+el('chat-error').textContent);cleanTouchChatMemory.commit();controls();return;}
  await sendLive(value,true);
 };
`+code.slice(end);
replace("await open();const p=message('user','선택한 상품');","importedBlob=cleanTouchShopping.toBlob(image);el('chat-source').querySelector('option[value=import]').disabled=false;el('chat-source').value='import';panel.dataset.chatMode='photo';await open();const p=message('user','선택한 상품');");
code=code.replaceAll("el('chat-source').options[1]","el('chat-source').querySelector('option[value=import]')");
const sourceOld="el('chat-source').onchange=async()=>{reset();el('chat-import-preview').hidden=el('chat-source').value!=='import';if(el('chat-source').value==='import')await selectImport();else await openAssistant();};";
replace(sourceOld,"el('chat-source').onchange=async()=>{if(busy||shareStarting)return;const selected=el('chat-source').value;if(selected==='screen'){if(!cleanTouchLive.sharing){el('chat-source').value=image?'import':'none';await startScreenShare();}return;}if(cleanTouchLive.sharing)el('chat-live-stop').onclick();else cleanTouchLive.stop();if(selected==='import'&&importedBlob){const bytes=new Uint8Array(await importedBlob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));image=btoa(binary);el('chat-source').value='import';panel.dataset.chatMode='photo';el('chat-error').textContent='선택한 사진과 함께 질문합니다. 현재 화면은 공유하지 않아요.';}else{image='';el('chat-source').value='none';connectionMode='text';liveState('off');}controls();};");
replace("el('chat-source').value=image?'import':'screen';","el('chat-source').value=image?'import':'none';panel.dataset.chatMode=image?'photo':'text';");
replace("이전 대화를 불러왔어요. 질문하면 현재 영상과 함께 이어집니다.","이전 대화를 불러왔어요. 화면 공유는 꺼져 있고, 텍스트로 이어갈 수 있어요.");
replace("const query=cleanTouchShopping.queryOf(args.query),item=liveAnswerElement;if(!query||!item||token!==generation)","if(!frame)return {needImage:true,note:'현재 화면 공유가 꺼져 있습니다. 사용자가 사진을 업로드하거나 화면 공유를 직접 허용해야 사진 기반 상품 비교가 가능합니다. 화면이 보인다고 말하지 마세요.'};const query=cleanTouchShopping.queryOf(args.query),item=liveAnswerElement;if(!query||!item||token!==generation)");
fs.writeFileSync(file,code);
