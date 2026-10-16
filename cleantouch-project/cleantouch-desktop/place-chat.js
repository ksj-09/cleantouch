(()=>{
 const el=id=>document.getElementById(id),panel=el('place-chat'),log=el('chat-messages'),input=el('chat-input');
 const similarCache=new Map();let pendingEvidence=[],photoEvidence=[];
 let image='',history=[],busy=false,generation=0,returnWidget=false,liveCompanion=false,imageUrl='',pendingProduct=null,pendingTarget='',importedBlob=null,importGeneration=0,importLoading=false;
 function message(role,body){const p=document.createElement('div');p.className=`chat-message ${role}`;p.textContent=body;log.append(p);requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight;});return p;}
 let failedLiveQuestion='',shareStarting=false,liveAnswerElement=null,liveAnswerRaw='',liveQuestion='',pendingContinue=false,connectionMode='text',shareOwnsCapture=false;
 panel.dataset.chatMode='text';panel.dataset.liveState='off';
 function liveState(phase){panel.dataset.liveState=phase;el('chat-live-stop').hidden=phase==='off'||connectionMode!=='screen';panel.dataset.chatMode=connectionMode;controls();}
 function controls(){
  const retry=history.at(-1)?.role==='user'||failedLiveQuestion,voiceBusy=Boolean(window.cleanTouchVoice?.busy),locked=busy||importLoading||shareStarting||voiceBusy;
  for(const id of ['chat-upload','chat-source','chat-import-list','chat-pick-import','chat-place','chat-product'])el(id).disabled=locked;
  if(window.cleanTouchVoice?.conversation)el('chat-place').disabled=busy||importLoading||shareStarting;
  input.disabled=locked||Boolean(pendingProduct&&!image);el('chat-send').disabled=input.disabled||panel.dataset.liveState==='reconnecting';el('chat-reset').disabled=false;el('chat-retry').hidden=locked||(!pendingProduct&&!retry);
  el('chat-welcome').hidden=Boolean(history.length||log.querySelector('.chat-message.user')||image||el('chat-source').value==='screen');
  window.cleanTouchVoice?.setChatBusy(busy||importLoading||shareStarting||panel.hidden);
 }
 function closeMore(){el('chat-more-menu').hidden=true;el('chat-more').setAttribute('aria-expanded','false');}
 function conversationText(){return history.map(m=>`${m.role==='user'?'나':'CleanTouch AI'}: ${m.text}`).join('\n\n').trim();}
 async function open(){if(panel.hidden){returnWidget=document.body.classList.contains('widget-mode');if(returnWidget){document.body.classList.remove('compact-widget');document.body.classList.add('floating-chat');ui.widget.hidden=false;await bridge.setWindowLayout('widget-panel');}panel.hidden=false;}if(!log.children.length)message('model','안녕하세요! 편하게 물어보세요. 화면은 공유 버튼을 눌러 허용할 때만 AI에 전송돼요.');controls();}
 function reset(preserveRecord=false){document.dispatchEvent(new Event('cleantouch:conversation-change'));if(!preserveRecord){cleanTouchChatMemory.commit();cleanTouchChatMemory.newConversation();}bridge.cancelPlaceRequests?.('chat:'+generation).catch(()=>{});generation++;window.cleanTouchLive?.stop();if(shareOwnsCapture){shareOwnsCapture=false;void stopCapture(true);}cleanTouchPermissions.cancel();connectionMode='text';panel.dataset.chatMode='text';panel.dataset.liveState='off';el('chat-live-stop').hidden=true;shareStarting=false;liveAnswerElement=null;importGeneration++;importLoading=false;busy=false;failedLiveQuestion='';pendingProduct=null;pendingTarget='';photoEvidence=[];pendingEvidence=[];input.value='';image='';history=[];if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl='';log.replaceChildren();el('chat-error').textContent='';controls();}
 async function keepConversation(){document.dispatchEvent(new Event('cleantouch:conversation-change'));bridge.cancelPlaceRequests?.('chat:'+generation).catch(()=>{});generation++;cleanTouchLive.stop();if(shareOwnsCapture){shareOwnsCapture=false;await stopCapture(true);}connectionMode='text';shareStarting=false;liveAnswerElement=null;busy=false;failedLiveQuestion='';pendingProduct=null;pendingTarget='';pendingContinue=false;liveState('off');}
 async function reply(){if(busy||!image||history.at(-1)?.role!=='user')return;panel.dataset.chatMode='photo';busy=true;controls();el('chat-error').textContent='사진과 질문을 분석하고 있어요…';const token=generation,item=message('model','생각하고 있어요…');item.classList.add('pending');
  try{const memo=cleanTouchChatMemory.memo(history.at(-1)?.text||'',1100);const messages=history.slice(-13).map((m,i,a)=>i===a.length-1?{...m,text:cleanTouchChatTitle.question(m.text,{photo:true,summarize:cleanTouchChatMemory.needsSummary})}:{...m});if(memo&&messages.length)messages[0].text=memo+'\n'+messages[0].text.slice(0,2999-memo.length);const photoImage=photoEvidence.length&&importedBlob?await cleanTouchImage.encode(importedBlob,{maxChars:550000,maxEdge:1200}):image;if(token!==generation)return;const data=await bridge.placeChat({_requestGroup:'chat:'+token,image:photoImage,...(photoEvidence.length?{images:[photoEvidence[0],photoImage]}:{}),messages});if(token!==generation)return;if(typeof data?.answer!=='string'||!data.answer.trim())throw Error('AI가 답변을 보내지 않았어요. 다시 시도해 주세요.');const parsed=cleanTouchChatTitle.extract(data.answer);if(parsed.title)cleanTouchChatMemory.setSummary(parsed.title);history.push({role:'model',text:parsed.answer.slice(0,3000)});item.classList.remove('pending');item.textContent=parsed.answer;window.cleanTouchVoice?.replyFinished(parsed.answer);for(const place of data.places||[])cleanTouchShopping.render(item,{kind:'map',label:place.name,url:place.mapUrl,reason:place.evidence});for(const product of data.products||[]){const card={kind:'product',label:product.query,query:product.query,reason:product.reason,image};const rendered=cleanTouchShopping.render(item,card);if(rendered)void compareProduct(item,card,token,rendered);}el('chat-error').textContent=data.disclaimer||'사진에서 확인한 내용을 바탕으로 답변했어요.';
  }catch(error){if(token===generation){const detail=String(error.message||error).replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/,'');el('chat-error').textContent=detail;item.classList.remove('pending');item.classList.add('failed');item.textContent='답변을 받지 못했어요. 다시 시도하거나 질문을 바꿔 주세요.';}}
  finally{if(token===generation){busy=false;cleanTouchChatMemory.commit();controls();input.focus();}}
 }
 async function analyze(){if(busy)return;try{
  let freshFrame=null;if(el('chat-source').value!=='import'&&stream){freshFrame=await captureFrame(true);if(!capturePlan?.linked||capturePlan.blocked||!freshFrame?.videoOnly)throw Error(capturePlan?.reason||'먼저 유튜브 영상을 화면에 띄워 주세요. 영상 영역만 보냅니다.');}
  if(el('chat-source').value==='import'&&!importedBlob)throw Error('먼저 사진 파일이나 폴더를 선택해 주세요.');if(el('chat-source').value!=='import'&&!currentFrame?.videoOnly)throw Error('영상 장면이 없어요. 화면 살펴보기를 시작하고 영상에서 장소 분석을 눌러 주세요.');
  const frame=el('chat-source').value==='import'?{blob:importedBlob}:(freshFrame||currentFrame);reset();const token=generation,bytes=new Uint8Array(await frame.blob.arrayBuffer());if(token!==generation)return;let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));image=btoa(binary);importedBlob=cleanTouchShopping.toBlob(image);el('chat-source').querySelector('option[value=import]').disabled=false;el('chat-source').value='import';panel.dataset.chatMode='photo';
  await open();const p=message('user','공유한 현재 장면');const photo=document.createElement('img');imageUrl=URL.createObjectURL(frame.blob);photo.onload=()=>{log.scrollTop=log.scrollHeight;};photo.src='data:image/jpeg;base64,'+image;photo.alt='분석에 전송하는 영상 장면';p.prepend(photo);history=[];message('model','이 화면에서 궁금한 상품이나 장소를 물어보세요. 예: 이 가방 찾아줘, 여기는 어디야?');el('chat-error').textContent='장면이 준비됐어요. 질문을 보내면 AI에 함께 전달됩니다.';cleanTouchChatMemory.commit();controls();input.focus();
 }catch(error){await open();el('chat-error').textContent=error.message;controls();}}
 async function openAssistant(){await open();input.focus();}
 el('ai-launcher').onclick=openAssistant;el('widget-place').onclick=openAssistant;
 el('chat-more').onclick=event=>{event.stopPropagation();const menu=el('chat-more-menu'),opening=menu.hidden;menu.hidden=!opening;el('chat-more').setAttribute('aria-expanded',String(opening));};
 el('chat-share-copy').onclick=async()=>{const text=conversationText();if(!text){el('chat-error').textContent='복사할 대화가 아직 없어요.';closeMore();return;}try{await bridge.copyText(text);el('chat-error').textContent='대화 내용을 클립보드에 복사했어요.';}catch(error){el('chat-error').textContent=error.message;}closeMore();};
 el('chat-share-screen').onclick=()=>{closeMore();startScreenShare();};
 el('chat-share-photo').onclick=()=>{closeMore();chooseImport('files');};
 el('chat-privacy').onclick=()=>{closeMore();el('chat-error').textContent='화면 공유는 직접 허용한 동안만 작동하며 영상 소리와 위치는 전송하지 않습니다. 음성 대화를 별도로 허용하면 마이크 소리를 Gemini에 실시간으로 전송합니다. 대화 종료·창 숨김·연결 끊김 또는 2분간 대화가 없으면 마이크가 꺼집니다. 서버에 분석 사진이나 음성 파일을 저장하지 않습니다. 대화 기록은 Windows 사용자 암호화로 이 PC에 저장됩니다.';};
 document.addEventListener('click',event=>{if(!el('chat-more-menu').hidden&&!el('chat-more-menu').contains(event.target)&&event.target!==el('chat-more'))closeMore();});
 async function connectAi(mode='text',clearConversation=false){
  if(shareStarting)return;
  const startedFromWidget=liveCompanion?false:document.body.classList.contains('widget-mode');
  if(clearConversation)reset();const token=generation;connectionMode=mode;shareStarting=true;liveState('connecting');
  if(mode==='screen'&&!returnWidget&&!startedFromWidget)liveCompanion=true;
  try{
   if(mode==='screen'){if(!stream&&phase!=='idle'){phase='idle';refresh();}if(token!==generation)return;if(!stream){shareOwnsCapture=true;await startCapture();if(token!==generation){shareOwnsCapture=false;await stopCapture(true);return;}shareOwnsCapture=Boolean(stream);}if(token!==generation)return;if(!stream)throw Error(ui.detail.textContent||'화면 캡처를 시작하지 못했어요.');}
   await open();if(token!==generation)return;if(clearConversation)returnWidget=startedFromWidget;if(mode==='screen'&&!returnWidget)liveCompanion=true;if(mode==='screen'&&(returnWidget||liveCompanion)){document.body.classList.remove('compact-widget');document.body.classList.add('widget-mode','floating-chat');ui.widget.hidden=false;await bridge.setWindowLayout('live-chat');}
   if(token!==generation)return;
   await cleanTouchLive.waitForIdle?.();if(token!==generation)return;
   if(cleanTouchLive.active){if(mode==='screen')await cleanTouchLive.enableSharing();return;}
   await cleanTouchLive.start({mode,getHistory:()=>history,getVoiceReferenceImage:()=>el('chat-source').value==='import'?image:'',onAudio:(data,mime)=>{if(token===generation&&liveAnswerElement)window.cleanTouchVoice?.receiveAudio(data,mime);},getContext:()=>cleanTouchChatMemory.memo(failedLiveQuestion||liveQuestion),getReferenceImage:()=>{const cards=[...log.querySelectorAll('.chat-shopping-card')].map(n=>JSON.parse(n.dataset.card));return cards.at(-1)?.image||'';},onShopping:(args,frame)=>makeShopping(args,frame,token),onStatus:text=>{if(token!==generation)return;el('chat-error').textContent=text;controls();},onState:({phase,mode})=>{if(token!==generation)return;connectionMode=mode||connectionMode;if(phase==='connected'||phase==='off')shareStarting=false;liveState(phase);},onReady:()=>{if(token!==generation)return;shareStarting=false;controls();input.focus();},onText:(text,done)=>{if(token!==generation||!liveAnswerElement)return;if(done){liveAnswerElement.classList.remove('pending');return;}let body=liveAnswerElement.querySelector('.chat-answer-text');if(!body){for(const node of [...liveAnswerElement.childNodes])if(node.nodeType===3)node.remove();body=document.createElement('span');body.className='chat-answer-text';liveAnswerElement.prepend(body);}liveAnswerRaw+=text;body.textContent=cleanTouchChatTitle.extract(liveAnswerRaw).answer;log.scrollTop=log.scrollHeight;}});
  }catch(error){if(token===generation){if(shareOwnsCapture&&!cleanTouchLive.sharing){shareOwnsCapture=false;await stopCapture(true);}el('chat-error').textContent=String(error.message||error).replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/,'');connectionMode=cleanTouchLive.sharing?'screen':'text';liveState(cleanTouchLive.active?'connected':'off');}}
  finally{if(token===generation){shareStarting=false;controls();}}
 }
 async function startScreenShare(){if(busy||shareStarting)return;const token=generation;if(!await cleanTouchPermissions.request('share')||token!==generation)return;image='';el('chat-source').value='screen';el('chat-import-preview').hidden=true;await connectAi('screen');}
 el('chat-place').onclick=startScreenShare;
 el('chat-live-stop').onclick=async()=>{if(busy){bridge.cancelPlaceRequests?.('chat:'+generation).catch(()=>{});generation++;if(liveAnswerElement?.classList.contains('pending')){liveAnswerElement.classList.remove('pending');liveAnswerElement.textContent='화면 공유를 종료했어요.';}liveAnswerElement=null;}cleanTouchLive.disableSharing();if(shareOwnsCapture){shareOwnsCapture=false;await stopCapture(true);}busy=false;shareStarting=false;connectionMode='text';el('chat-source').value='none';liveState(cleanTouchLive.active?'connected':'off');el('chat-error').textContent='화면 공유를 종료했어요. 이제 텍스트로만 대화합니다.';cleanTouchChatMemory.commit();controls();};
  el('chat-close').onclick=async()=>{document.dispatchEvent(new Event('cleantouch:conversation-change'));cleanTouchChatMemory.commit();cleanTouchPermissions.cancel();importGeneration++;importLoading=false;bridge.cancelPlaceRequests?.('chat:'+generation).catch(()=>{});generation++;shareStarting=false;liveAnswerElement=null;window.cleanTouchLive?.stop();if(shareOwnsCapture){shareOwnsCapture=false;await stopCapture(true);}liveState('off');busy=false;productSearchGeneration++;controls();panel.hidden=true;document.body.classList.remove('floating-chat');if(returnWidget){document.body.classList.add('widget-mode');ui.widget.hidden=false;await bridge.setWindowLayout(document.getElementById('widget-results').open?'widget-panel':'widget');}else if(liveCompanion){document.body.classList.remove('widget-mode','compact-widget');ui.widget.hidden=true;await bridge.setWindowLayout('dashboard');}liveCompanion=false;};
 el('chat-reset').onclick=()=>{reset();importedBlob=null;el('chat-source').value='none';el('chat-source').querySelector('option[value=import]').disabled=true;el('chat-import-preview').hidden=true;message('model','안녕하세요! 편하게 물어보세요. 화면은 공유 버튼을 눌러 허용할 때만 AI에 전송돼요.');};el('chat-retry').onclick=async()=>{if(failedLiveQuestion){const question=failedLiveQuestion;if(!cleanTouchLive.active)await connectAi('text');if(cleanTouchLive.active)await sendLive(question,false);return;}if(pendingProduct)identify(pendingProduct,pendingTarget,pendingContinue,pendingEvidence);else reply();};
 el('chat-form').onsubmit=async event=>{
  window.cleanTouchVoice?.replyStarted();
  event.preventDefault();const value=input.value.trim(),token=generation;if(busy||shareStarting||!value)return;
  if(image&&el('chat-source').value==='import'){if(history.at(-1)?.role==='user')history.pop();history=history.slice(-12);history.push({role:'user',text:value});message('user',value);input.value='';cleanTouchChatMemory.commit();await reply();return;}
  if(!cleanTouchLive.active)await connectAi('text');if(token!==generation)return;
  if(!cleanTouchLive.active){failedLiveQuestion=value;message('user',value);input.value='';message('model','AI와 연결하지 못했어요. '+el('chat-error').textContent);cleanTouchChatMemory.commit();controls();return;}
  await sendLive(value,true);
 };
 async function showProduct(blob,data,continueConversation=false,evidence=[]){if(busy)return;if(continueConversation)await keepConversation();else reset();const token=generation;
  image=await cleanTouchImage.encode(blob);if(token!==generation)return;photoEvidence=evidence.filter(v=>typeof v==='string'&&v.length<=350000).slice(0,1);
  importedBlob=cleanTouchShopping.toBlob(image);el('chat-source').querySelector('option[value=import]').disabled=false;el('chat-source').value='import';panel.dataset.chatMode='photo';await open();const p=message('user','선택한 상품');const photo=document.createElement('img');imageUrl=URL.createObjectURL(blob);photo.src='data:image/jpeg;base64,'+image;photo.alt='AI로 분석한 선택 상품';p.prepend(photo);
  const answer=`${data.label} · ${data.reason}`;const item=message('model',answer);window.cleanTouchVoice?.replyFinished(answer);const card={kind:'product',query:data.query,label:data.label,reason:data.reason,image};if(data.query){cleanTouchShopping.render(item,card);void compareProduct(item,card,token);}
  if(continueConversation&&history.at(-1)?.role==='user')history.pop();history=[...(continueConversation?history.slice(-38):[]),{role:'user',text:'이 선택 상품을 분석하고 검색을 도와줘.'},{role:'model',text:answer}];el('chat-error').textContent='상품 이미지가 Gemini에 전송됐어요. 상품명은 AI 추정이며 실제 가격·재고는 판매 페이지에서 확인하세요.';cleanTouchChatMemory.commit();controls();
 }
 async function compareProduct(item,card,token,initialCard=null){
  const current=initialCard||item.querySelector('.chat-shopping-card');if(!current)return;
  card.comparisonStage='searching';const status=current.querySelector('.purchase-status');if(status)status.textContent='실제 판매 페이지와 사진을 찾고 있어요…';current.dataset.card=JSON.stringify(card);
  try{
   const bytes=cleanTouchShopping.toBlob(card.image);const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await bytes.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
   if(token!==generation||!item.isConnected)return;
   const key=digest+':'+card.query,cached=similarCache.get(key);let result=cached&&cached.until>Date.now()?cached.answer:null;
   if(!result){result=await bridge.placeChat({_requestGroup:'chat:'+token,task:'similar',image:card.image,target:card.query,messages:[{role:'user',text:'선택한 상품과 실제 판매 사진을 비교해 외형이 가까운 상품만 찾아줘.'}]});if(token!==generation)return;similarCache.set(key,{until:Date.now()+(result.candidates?.length?300000:60000),answer:result});if(similarCache.size>16)similarCache.delete(similarCache.keys().next().value);}
   if(token!==generation||!item.isConnected)return;
   card.candidates=result.candidates||[];card.comparisonStage=result.comparisonStage||'checked';card.notice=result.notice||'';current.remove();cleanTouchShopping.render(item,card);cleanTouchChatMemory.commit();
  }catch(error){if(token===generation&&item.isConnected){card.candidates=[];card.comparisonStage='error';card.notice='판매 사진 비교를 완료하지 못했어요. 현재 확인된 구매처가 없습니다.';current.remove();cleanTouchShopping.render(item,card);cleanTouchChatMemory.commit();}}
 }
 async function identify(blob,target='',continueConversation=false,evidence=[]){if(busy)return;if(continueConversation)await keepConversation();else reset();pendingContinue=continueConversation;pendingProduct=blob;pendingTarget=target;pendingEvidence=evidence;const token=generation;busy=true;await open();el('chat-error').textContent='선택한 상품을 분석하고 있어요…';controls();try{const encoded=await cleanTouchImage.encode(blob);if(token!==generation)return;const data=await bridge.identifyProduct(encoded,target,'chat:'+token,evidence);if(token!==generation)return;if(target&&!candidatePolicy.targetMatches(target,data.label))throw Error('선택한 '+target+' 대신 다른 상품이 인식됐어요. 상품 영역을 다시 선택해 주세요.');if(data.confidence==='low')throw Error('선택한 상품을 확인하기 어려워요. 상품 영역을 다시 선택해 주세요.');busy=false;await showProduct(blob,data,continueConversation,evidence);}catch(e){if(token===generation)el('chat-error').textContent=String(e.message||e).replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/,'');}finally{if(token===generation){busy=false;controls();}}}
 el('chat-product').onclick=async()=>{if(busy||importLoading)return;if(el('chat-source').value==='import'){if(importedBlob)await identify(importedBlob,'',true,photoEvidence);else el('chat-error').textContent='먼저 사진을 선택해 주세요.';return;}if(phase!=='capturing'&&!currentFrame){el('chat-error').textContent='먼저 화면 스캔을 시작해 주세요.';return;}panel.hidden=true;focusChatProduct=true;if(phase==='capturing')await beginFocusPick();else{focusReturnLayout=document.body.classList.contains('widget-mode')?'widget':'dashboard';await showFrameInPicker(currentFrame,true);}if(ui.focusPicker.hidden){focusChatProduct=false;await open();el('chat-error').textContent=ui.widgetStatus.textContent;return;}ui.submitFocus.textContent='이 상품 알아보기';};

 async function selectImport(){
  const token=++importGeneration;importLoading=true;controls();
  try{
   const data=await bridge.loadImage(el('chat-import-list').value);if(token!==importGeneration)return;
   cleanTouchLive.stop();bridge.cancelPlaceRequests?.('chat:'+generation).catch(()=>{});generation++;liveAnswerElement=null;shareStarting=false;failedLiveQuestion='';pendingProduct=null;pendingTarget='';
   if(shareOwnsCapture){shareOwnsCapture=false;await stopCapture(true);if(token!==importGeneration)return;}
   connectionMode='text';liveState('off');
   photoEvidence=[];importedBlob=cleanTouchShopping.toBlob(data.image);image=data.image;panel.dataset.chatMode='photo';
   el('chat-source').querySelector('option[value=import]').disabled=false;el('chat-source').value='import';el('chat-import-preview').hidden=false;el('chat-import-image').src='data:image/jpeg;base64,'+data.image;
   const entry=message('user','업로드한 사진');const photo=document.createElement('img');photo.src='data:image/jpeg;base64,'+data.image;photo.alt=data.name||'이 대화에 업로드한 사진';entry.prepend(photo);
   el('chat-error').textContent='이 대화에 사진을 첨부했어요. 질문을 보낼 때 선택한 사진만 AI에 전달됩니다.';await cleanTouchChatMemory.commit();
  }catch(e){if(token===importGeneration)el('chat-error').textContent=e.message;}
  finally{if(token===importGeneration)importLoading=false;controls();}
 }
 async function chooseImport(kind){if(busy||importLoading)return;const token=++importGeneration;importLoading=true;controls();try{const data=await bridge.chooseImages(kind);if(token!==importGeneration||data.canceled)return;const list=el('chat-import-list');list.replaceChildren();for(const item of data.items){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;list.append(option);}el('chat-source').querySelector('option[value=import]').disabled=false;await selectImport();}catch(e){if(token===importGeneration)el('chat-error').textContent=e.message;}finally{if(token===importGeneration)importLoading=false;controls();}}
 el('chat-upload').onclick=()=>chooseImport('files');el('chat-import-list').onchange=selectImport;
 el('chat-source').onchange=async()=>{if(busy||shareStarting)return;const selected=el('chat-source').value;if(selected==='screen'){if(!cleanTouchLive.sharing){el('chat-source').value=image?'import':'none';await startScreenShare();}return;}if(cleanTouchLive.sharing)el('chat-live-stop').onclick();else cleanTouchLive.stop();if(selected==='import'&&importedBlob){const bytes=new Uint8Array(await importedBlob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));image=btoa(binary);el('chat-source').value='import';panel.dataset.chatMode='photo';el('chat-error').textContent='선택한 사진과 함께 질문합니다. 현재 화면은 공유하지 않아요.';}else{image='';el('chat-source').value='none';connectionMode='text';liveState('off');}controls();};
 el('chat-pick-import').onclick=async()=>{if(!importedBlob||busy||importLoading)return;panel.hidden=true;focusChatProduct=true;focusReturnLayout=document.body.classList.contains('widget-mode')?'widget':'dashboard';await showFrameInPicker({blob:importedBlob,seconds:0},true);ui.submitFocus.textContent='이 상품 알아보기';};
 
 for(const button of document.querySelectorAll('[data-chat-start]'))button.onclick=async()=>{
  if(busy||shareStarting||importLoading)return;
  const action=button.dataset.chatStart;
  if(action==='voice'){el('chat-microphone').click();return;}
  if(action==='screen'){await startScreenShare();if(!cleanTouchLive.sharing)return;}
  else if(action==='upload'){await chooseImport('files');if(!image||el('chat-source').value!=='import')return;}
  input.value='이 상품의 특징을 알려주고 비슷한 상품을 찾아줘.';controls();if(!el('chat-send').disabled)el('chat-form').requestSubmit();
 };
 let voiceUser=null,voiceModel=null,voiceQuestion='',voiceReply='';
 async function prepareVoice(){if(busy||importLoading||shareStarting)return false;await cleanTouchLive.waitForIdle?.();if(!cleanTouchLive.active)await connectAi('text');if(!cleanTouchLive.active){const detail=el('chat-error').textContent;el('chat-error').textContent='';throw Error(detail||'AI와 연결하지 못했어요. 잠시 후 다시 시작해 주세요.');}return true;}
 function voiceInput(text){if(!voiceUser){voiceUser=message('user','');if(voiceModel)log.insertBefore(voiceUser,voiceModel);}voiceQuestion+=text;voiceUser.textContent=voiceQuestion;el('chat-welcome').hidden=true;}
 function voiceAnswerStart(){if(voiceModel)return;voiceModel=message('model','');liveAnswerElement=voiceModel;}
 function voiceText(text){voiceAnswerStart();voiceReply+=text;let body=voiceModel.querySelector('.chat-answer-text');if(!body){body=document.createElement('span');body.className='chat-answer-text';voiceModel.prepend(body);}body.textContent=voiceReply;log.scrollTop=log.scrollHeight;}
 function finishVoiceTurn(interrupted=false){if(!voiceUser&&!voiceModel&&!voiceQuestion&&!voiceReply)return;if(voiceQuestion.trim())history.push({role:'user',text:voiceQuestion.slice(0,3000)});if(voiceReply.trim())history.push({role:'model',text:voiceReply.slice(0,3000)});if(interrupted&&voiceModel){const note=document.createElement('small');note.className='voice-interruption';note.textContent='음성 답변 중단';voiceModel.append(note);}if(voiceModel&&!voiceReply.trim()&&!voiceModel.querySelector('.chat-shopping-card'))voiceModel.remove();voiceUser=voiceModel=null;voiceQuestion=voiceReply='';liveAnswerElement=null;history=history.slice(-40);cleanTouchChatMemory.commit();controls();}
 window.cleanTouchPlaceChat={analyze,open,showProduct,identify,reset,refreshControls:controls,prepareVoice,voiceInput,voiceAnswerStart,voiceText,finishVoiceTurn};controls();
 cleanTouchChatMemory.attach({open,snapshot:()=>({image,history,evidence:photoEvidence,source:el('chat-source').value}),clear:()=>{reset(true);message('model','안녕하세요! 편하게 물어보세요. 화면은 공유 버튼을 눌러 허용할 때만 AI에 전송돼요.');},restore:async saved=>{
  reset(true);image=saved.image||'';history=saved.history||[];photoEvidence=saved.evidence||[];el('chat-source').value=image?'import':'none';panel.dataset.chatMode=image?'photo':'text';el('chat-source').querySelector('option[value=import]').disabled=!image;el('chat-import-preview').hidden=true;
  if(image)importedBlob=cleanTouchShopping.toBlob(image);else importedBlob=null;
  for(const entry of saved.entries||[]){const p=message(entry.role,entry.text);if(entry.failed)p.classList.add('failed');if(entry.image){const photo=document.createElement('img');photo.src='data:image/jpeg;base64,'+entry.image;photo.alt='이 대화에서 선택한 사진';p.prepend(photo);}for(const card of entry.cards||[])cleanTouchShopping.render(p,card);}
  el('chat-error').textContent=image?'이전에 선택한 사진과 대화를 이어갈 수 있어요.':'이전 대화를 불러왔어요. 화면 공유는 꺼져 있고, 텍스트로 이어갈 수 있어요.';controls();
 }});
 async function makeShopping(args,frame,token){
  if(!frame)return {needImage:true,note:'현재 화면 공유가 꺼져 있습니다. 사용자가 사진을 업로드하거나 화면 공유를 직접 허용해야 사진 기반 상품 비교가 가능합니다. 화면이 보인다고 말하지 마세요.'};const query=cleanTouchShopping.queryOf(args.query),item=liveAnswerElement;if(!query||!item||token!==generation)return {error:'찾을 상품의 종류와 색상을 확인해 주세요.'};
  const cropped=await cleanTouchShopping.crop(frame,args.box);if(token!==generation||liveAnswerElement!==item)return {error:'대화가 종료됐어요.'};
  const card={kind:'product',query,label:query,image:cropped,comparisonStage:'searching',reason:String(args.reason||'화면에 보이는 종류·색·형태 기준입니다. 동일 상품인지는 판매 사진으로 확인하세요.').slice(0,350)};
  let box=cleanTouchShopping.render(item,card);log.scrollTop=log.scrollHeight;
  try{const result=await bridge.placeChat({_requestGroup:'chat:'+token,task:'similar',image:cropped,target:query,messages:[{role:'user',text:query+'와 색·형태가 가까운 구매 가능한 상품을 찾아줘.'}]});if(token!==generation||liveAnswerElement!==item)return {error:'대화가 종료됐어요.'};
   card.candidates=result.candidates||[];card.comparisonStage=result.comparisonStage||'checked';card.notice=result.notice||'';box?.remove();box=cleanTouchShopping.render(item,card);log.scrollTop=log.scrollHeight;
   return cleanTouchShopping.toAiResult(card);
  }catch(error){
   if(token===generation&&item.isConnected){card.candidates=[];card.comparisonStage='error';card.notice='판매 사진 비교를 완료하지 못했어요. 현재 확인된 구매처가 없습니다.';box?.remove();cleanTouchShopping.render(item,card);cleanTouchChatMemory.commit();}
   return {query,candidates:[],note:'판매처를 확인하지 못했습니다. 구매처를 찾았다고 말하거나 브랜드·가격을 만들지 마세요. 별도의 사진 검색 버튼은 제공했습니다.'};
  }
 }
 async function sendLive(value,append){
  if(busy)return;if(append)message('user',value);
  if(history.at(-1)?.role==='user')history.pop();history.push({role:'user',text:value});
  input.value='';busy=true;failedLiveQuestion='';const token=generation,answer=message('model','생각하고 있어요…');answer.classList.add('pending');liveAnswerElement=answer;liveAnswerRaw='';liveQuestion=value;controls();cleanTouchChatMemory.commit();
  try{await cleanTouchLive.ask(cleanTouchChatTitle.question(value,{summarize:cleanTouchChatMemory.needsSummary}));if(token!==generation)return;const parsed=cleanTouchChatTitle.extract(liveAnswerRaw);if(parsed.title)cleanTouchChatMemory.setSummary(parsed.title);const body=answer.querySelector('.chat-answer-text')?.textContent||'';if(body.trim()){history.push({role:'model',text:body.slice(0,3000)});window.cleanTouchVoice?.replyFinished(body);}history=history.slice(-40);}
  catch(error){if(token===generation){window.cleanTouchVoice?.replyFailed();failedLiveQuestion=value;const detail=String(error.message||error);el('chat-error').textContent=detail;answer.classList.remove('pending');answer.classList.add('failed');const text=answer.querySelector('.chat-answer-text');if(text)text.textContent=`답변을 마치지 못했어요. ${detail}`;else answer.prepend(document.createTextNode(`답변을 마치지 못했어요. ${detail}`));}}
  finally{if(token===generation){liveAnswerElement=null;busy=false;cleanTouchChatMemory.commit();controls();input.focus();}}
 }
})();


