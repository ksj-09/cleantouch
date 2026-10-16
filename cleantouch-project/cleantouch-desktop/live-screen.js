(()=>{
 const ENDPOINT='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=';
 const FRAME_INTERVAL=1000,RESUME_INTERVAL=8*60_000,ANSWER_TIMEOUT=55000;
 let generation=0,active=false,ready=false,busy=false,callbacks=null,socket=null,startPromise=null,retryWaitCancel=null;
 let frameTimer=null,resumeTimer=null,pendingAnswer=null,cancelConnection=null;
 let sessionHandle='',frameJob=null,lastFrameAt=0,reconnecting=false,retryCount=0;
 let lastImage='',cancelledTools=new Set(),screenMode=true,voiceCallbacks=null,voiceAnswer=null,voiceNeedsDrain=false,voiceDrain=null,finishDrain=null;
 function endVoice(error){const handler=voiceCallbacks;voiceCallbacks=null;voiceAnswer=null;handler?.onStopped?.(error);}
 function enableVoice(next){if(!active||!ready||pendingAnswer)throw Error('AI 연결을 마친 뒤 음성 대화를 시작해 주세요.');voiceCallbacks=next;const reference=!screenMode?callbacks?.getVoiceReferenceImage?.():'';if(typeof reference==='string'&&reference.length&&reference.length<=1400000){socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:'이 사진은 사용자가 현재 선택한 사진입니다. 이어지는 음성 질문은 이 사진과 함께 확인하세요.'},{inlineData:{data:reference,mimeType:'image/jpeg'}}]}],turnComplete:false}}));lastImage=reference;}socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:'지금부터 사용자가 마이크를 직접 허용하고 음성 대화를 시작했습니다. 이어지는 목소리를 듣고 한국어로 자연스럽게 짧게 답하세요. 말이 끝나면 답하고 다음 말을 계속 들으세요. 화면 공유는 '+(screenMode?'켜져 있습니다.':'꺼져 있습니다. 현재 화면이 보인다고 말하지 마세요.')+' 이전 텍스트 전용 안내보다 현재 음성 대화 상태를 따릅니다.'}]}],turnComplete:false}}));}
 function sendAudio(data,speaking=true){if(!voiceCallbacks||!active||!ready||socket?.readyState!==1)return false;if(socket.bufferedAmount>262144)throw Error('음성 연결이 지연되어 마이크를 껐어요. 다시 시작해 주세요.');if(speaking)voiceNeedsDrain=true;socket.send(JSON.stringify({realtimeInput:{audio:{data,mimeType:'audio/pcm;rate=16000'}}}));return true;}
 function endAudio(){if(voiceCallbacks&&ready&&socket?.readyState===1)socket.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));}
 function disableVoice(){if(!voiceCallbacks)return;const needsDrain=voiceNeedsDrain||Boolean(voiceAnswer);if(ready&&socket?.readyState===1)socket.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));endVoice();voiceNeedsDrain=false;
  if(!needsDrain)return;
  // Keep the established session when possible. While the last spoken turn
  // finishes, suppress its output and wait before accepting another question.
  voiceDrain=new Promise(resolve=>{const timeout=setTimeout(()=>{finishDrain?.();discardConnection();sessionHandle='';active=false;clearTimers();state('off');},8000);finishDrain=()=>{clearTimeout(timeout);finishDrain=null;voiceDrain=null;resolve();};});
 }

 function status(text){callbacks?.onStatus?.(text);}
 function state(phase){callbacks?.onState?.({phase,ready:active&&ready,mode:screenMode?'screen':'text'});}
 function watchingStatus(){return !screenMode?'텍스트로 대화 중이에요 · 화면은 전송하지 않습니다.':videoTime?.paused?'AI가 마지막 장면을 보고 있어요 · 재생하면 화면 공유가 이어져요.':'AI와 화면을 함께 보고 있어요 · 궁금한 내용을 물어보세요.';}
 function clearTimers(){clearInterval(frameTimer);clearTimeout(resumeTimer);frameTimer=resumeTimer=null;}
 function closeSocket(ws){if(!ws)return;ws.onopen=ws.onmessage=ws.onerror=ws.onclose=null;try{ws.close(1000,'CleanTouch sharing stopped');}catch{}}
 function settleAnswer(error){
  const answer=pendingAnswer;if(!answer)return;pendingAnswer=null;clearTimeout(answer.timer);
  callbacks?.onText?.('',true);
  if(error)answer.reject(error);else answer.resolve();
 }
 function discardConnection(error){
  finishDrain?.();
  endVoice(error);
  ready=false;const cancel=cancelConnection;cancelConnection=null;cancel?.(error||Error('AI 연결이 종료됐어요.'));
  const old=socket;socket=null;closeSocket(old);
 }
 function stop(){
  retryWaitCancel?.();startPromise=null;
  endVoice();
  generation++;active=false;ready=false;busy=false;frameJob=null;reconnecting=false;
  sessionHandle='';lastImage='';cancelledTools.clear();lastFrameAt=0;retryCount=0;voiceNeedsDrain=false;clearTimers();
  settleAnswer(Error('AI 연결이 종료됐어요.'));discardConnection();state('off');callbacks=null;
 }
 async function readEvent(event){const value=event?.data;return JSON.parse(typeof value==='string'?value:await value.text());}
 async function captureImage(){
  await updateCapturePlan();
  if(!capturePlan?.linked)throw Error('영상 화면을 찾고 있어요. Edge나 Chrome에서 영상을 띄워 주세요.');
  if(capturePlan.blocked)throw Error(capturePlan.reason||'영상이 다른 창에 가려져 있어요.');
  const video=ui.video;
  if(!stream||!video||video.readyState<2||!capturePlan.source?.width||!capturePlan.source?.height)throw Error('영상 화면 연결이 끊겼어요. 화면 공유를 다시 시작해 주세요.');
  const scale=Math.min(1,960/Math.max(capturePlan.source.width,capturePlan.source.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(capturePlan.source.width*scale));canvas.height=Math.max(1,Math.round(capturePlan.source.height*scale));
  sceneCapture.drawFrame(canvas.getContext('2d'),video,capturePlan,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.86).split(',')[1];
 }
 function sendImage(image,token){
  if(!screenMode||token!==generation||!active||!ready||!socket||socket.readyState!==1)return false;
  // Typed screen questions need deterministic vision context. Ordered image
  // updates keep the frame ahead of its question and avoid mixing Live input
  // channels, whose preprocessing can otherwise finish out of order.
  socket.send(JSON.stringify(voiceCallbacks?{realtimeInput:{video:{data:image,mimeType:'image/jpeg'}}}:{clientContent:{turns:[{role:'user',parts:[{inlineData:{data:image,mimeType:'image/jpeg'}}]}],turnComplete:false}}));lastImage=image;lastFrameAt=Date.now();return true;
 }
 async function transmitFrame(token,{allowPaused=false,strict=false}={}){
  if(!screenMode||token!==generation||!active||!ready)return false;
  if(busy&&!strict)return false;
  if(frameJob){if(strict)await frameJob;return false;}
  if(!allowPaused&&videoTime?.paused){if(!busy)status(watchingStatus());return false;}
  if(Date.now()-lastFrameAt<FRAME_INTERVAL)return false;
  const job=(async()=>{
   try{
    const image=await captureImage();if(token!==generation)return false;
    if(!sendImage(image,token))throw Error('AI와 다시 연결하고 있어요. 잠시 뒤 질문해 주세요.');
    if(!busy)status(watchingStatus());return true;
   }catch(error){if(token!==generation)return false;if(strict)throw error;status(String(error.message||error));return false;}
  })();
  frameJob=job;try{return await job;}finally{if(frameJob===job)frameJob=null;}
 }
 function scheduleFrames(token){clearInterval(frameTimer);frameTimer=setInterval(()=>{void transmitFrame(token);},FRAME_INTERVAL);}
 function scheduleResume(token,delay=RESUME_INTERVAL){
  clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>{void resumeSession(token);},delay);
 }
 function handleServerMessage(data,token){
  for(const id of data.toolCallCancellation?.ids||[])cancelledTools.add(id);
  if(data.toolCall?.functionCalls){if(voiceCallbacks&&!pendingAnswer){if(!voiceAnswer)voiceAnswer={image:lastImage};voiceCallbacks.onAnswerStart?.();}void respondToTools(data.toolCall.functionCalls,token);}
  const update=data.sessionResumptionUpdate;
  if(update?.resumable===false)sessionHandle='';
  else if(update?.newHandle||update?.new_handle)sessionHandle=update.newHandle||update.new_handle;
  if(data.error){settleAnswer(Error(data.error.message||'AI 연결에 문제가 생겼어요. 다시 질문해 주세요.'));return;}
  const content=data.serverContent;
  if(voiceDrain){if(content?.turnComplete){finishDrain?.();status(watchingStatus());}return;}
  if(voiceCallbacks&&!pendingAnswer){
   if(content?.interrupted){voiceCallbacks.onInterrupted?.();voiceAnswer=null;}
   const question=content?.inputTranscription?.text;
   if(question){if(!voiceAnswer)voiceAnswer={image:lastImage};voiceCallbacks.onInput?.(question);}
   const text=content?.outputTranscription?.text||content?.modelTurn?.parts?.filter(part=>!part.thought&&typeof part.text==='string').map(part=>part.text).join('')||'';
   if(text||content?.modelTurn?.parts?.length){if(!voiceAnswer)voiceAnswer={image:lastImage};voiceCallbacks.onAnswerStart?.();}
   if(text)voiceCallbacks.onText?.(text);
   for(const part of content?.modelTurn?.parts||[])if(part.inlineData?.data&&/^audio\/pcm(?:;|$)/.test(part.inlineData.mimeType||''))voiceCallbacks.onAudio?.(part.inlineData.data,part.inlineData.mimeType);
   if(content?.turnComplete){voiceNeedsDrain=false;voiceCallbacks.onTurnComplete?.();voiceAnswer=null;}
  }
  if(content?.interrupted&&pendingAnswer)settleAnswer(Error('답변이 중단됐어요. 다시 시도해 주세요.'));
  if(pendingAnswer){
   for(const part of content?.modelTurn?.parts||[])if(part.inlineData?.data&&/^audio\/pcm(?:;|$)/.test(part.inlineData.mimeType||''))callbacks?.onAudio?.(part.inlineData.data,part.inlineData.mimeType);
   const text=content?.outputTranscription?.text||content?.modelTurn?.parts?.filter(part=>!part.thought&&typeof part.text==='string').map(part=>part.text).join('')||'';
   if(text){pendingAnswer.text+=text;callbacks?.onText?.(text,false);}
   if(content?.turnComplete){
    const empty=!pendingAnswer.text.trim();settleAnswer(empty?Error('AI가 답변을 보내지 않았어요. 다시 시도해 주세요.'):null);
    if(!empty)status(watchingStatus());
   }
  }
  if(data.goAway&&token===generation)scheduleResume(token,1500);
 }
 async function respondToTools(calls,token){
  const answer=pendingAnswer||voiceAnswer,ws=socket;if(!answer||!ws)return;
  const responses=[];
  for(const call of calls.slice(0,3)){
   if(token!==generation||(pendingAnswer||voiceAnswer)!==answer||cancelledTools.has(call.id))return;
   let result={error:'지원하지 않는 요청입니다.'};
   if(call.name==='find_similar_products'){
    try{result=await callbacks?.onShopping?.(call.args||{},answer.image)||{error:'검색 버튼을 만들지 못했어요.'};}
    catch(error){result={error:String(error.message||error)};}
   }
   if(token!==generation||(pendingAnswer||voiceAnswer)!==answer||cancelledTools.has(call.id)||socket!==ws)return;
   responses.push({id:call.id,name:call.name,response:result});
  }
  if(responses.length&&ws.readyState===1)ws.send(JSON.stringify({toolResponse:{functionResponses:responses}}));
 }
 function connect(auth,token){
  if(!auth?.token||!auth?.setup)throw Error('AI 연결 정보를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  return new Promise((resolve,reject)=>{
   const ws=new WebSocket(ENDPOINT+encodeURIComponent(auth.token));socket=ws;let completed=false;
   const finish=error=>{if(completed)return;completed=true;clearTimeout(timer);if(cancelConnection===cancel)cancelConnection=null;if(error)reject(error);else resolve();};
   const cancel=error=>{finish(error);closeSocket(ws);};
   const timer=setTimeout(()=>cancel(Error('AI 연결이 지연되고 있어요. 인터넷 연결을 확인해 주세요.')),20000);
   cancelConnection=cancel;
   const current=()=>token===generation&&active&&socket===ws;
   ws.onopen=()=>{if(!current()){cancel(Error('AI 연결이 종료됐어요.'));return;}try{ws.send(JSON.stringify({setup:auth.setup}));}catch(error){cancel(error);}};
   ws.onmessage=async event=>{
    if(!current())return;
    try{
     const data=await readEvent(event);if(!current())return;
     if(data.error){
      const error=Error(data.error.message||'AI 연결에 문제가 생겼어요.');
      if(!completed){cancel(error);return;}
      handleServerMessage(data,token);discardConnection(error);scheduleResume(token,30000);state('reconnecting');status('AI 연결을 복구하고 있어요 · 30초 뒤 다시 연결합니다.');return;
     }
     if(data.setupComplete&&!completed){ready=true;finish();}
     handleServerMessage(data,token);
    }catch(error){if(current()){settleAnswer(Error('AI 응답을 읽지 못했어요. 다시 시도해 주세요.'));status('AI 응답을 읽지 못했어요. 다시 시도해 주세요.');}}
   };
   ws.onerror=()=>{if(!completed)cancel(Error('화면 공유에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.'));};
   ws.onclose=()=>{
    const wasReady=completed;finish(Error('AI 연결이 끊겼어요.'));
    if(!current())return;socket=null;ready=false;endVoice(Error('AI 연결이 끊겼어요.'));
    settleAnswer(Error('연결이 끊겨 답변이 중단됐어요. 다시 연결한 뒤 시도해 주세요.'));
    if(wasReady){state('reconnecting');status('AI와 다시 연결하고 있어요…');scheduleResume(token,1500);}
   };
  });
 }
 async function establish(token,resume){
  let auth;
  for(let attempt=0;attempt<3;attempt++){
   try{auth=await bridge.getLiveToken(resume?sessionHandle:'');break;}
   catch(error){
    if(token!==generation||!active)return;
    const wait=Number(error?.retryAfterSeconds||String(error.message||'').match(/\((\d+)초 뒤/)?.[1]||0);
    if(attempt===2||wait>60||!wait&&!/연결|인터넷|지연/.test(String(error.message)))throw error;
    const delay=wait?wait*1000:1000*(attempt+1);const until=Date.now()+delay;
    await new Promise(resolve=>{const done=()=>{clearInterval(tick);clearTimeout(timeout);if(retryWaitCancel===done)retryWaitCancel=null;resolve();};const tick=setInterval(()=>status(`AI와 연결 중이에요 · ${Math.max(1,Math.ceil((until-Date.now())/1000))}초 후 자동으로 다시 시도해요.`),1000);const timeout=setTimeout(done,delay);retryWaitCancel=done;status('AI와 연결 중이에요 · 잠시만 기다려 주세요.');});
    if(token!==generation||!active)return;
   }
  }
  if(token!==generation||!active)return;
  await connect(auth,token);if(token!==generation||!active)return;
  if(!resume){
   const history=(callbacks?.getHistory?.()||[]).slice(-40).filter(m=>['user','model'].includes(m?.role)&&typeof m.text==='string'&&m.text.trim()).map(m=>({role:m.role,parts:[{text:m.text.slice(0,3000)}]}));
   while(history.length&&history[0].role!=='user')history.shift();
   if(history.length)socket.send(JSON.stringify({clientContent:{turns:history,turnComplete:false}}));
   if(!screenMode)socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:'현재 연결은 텍스트 채팅 전용입니다. 화면 공유는 꺼져 있고 사진·영상·마이크·소리를 보내지 않습니다. 현재 화면을 보고 있다고 말하지 마세요. 과거 대화의 상품은 과거 문맥으로만 참고하세요. 일반 질문에는 자연스럽게 답하고, 실시간 화면을 확인해야 하는 질문이면 사용자가 화면 공유 버튼을 눌러 허용하거나 사진을 업로드해야 한다고 안내하세요.'}]}],turnComplete:false}}));
   const reference=screenMode?callbacks?.getReferenceImage?.():'';
   if(typeof reference==='string'&&reference.length&&reference.length<=1400000)socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:'이 사진은 이전 대화에서 찾던 상품입니다. 이어지는 현재 화면과 구분해서 기억하세요.'},{inlineData:{data:reference,mimeType:'image/jpeg'}}]}],turnComplete:false}}));
  }
  // A newly obscured video does not discard a working AI connection. No unrelated screen is sent.
  try{if(screenMode){const image=await captureImage();if(token!==generation)return;if(!sendImage(image,token))throw Error('영상 장면을 보내지 못했어요.');}status(watchingStatus());}
  catch(error){if(token!==generation)return;status(String(error.message||error));}
  if(token!==generation||!active)return;
  retryCount=0;if(screenMode)scheduleFrames(token);scheduleResume(token);state('connected');callbacks?.onReady?.();
 }
 async function resumeSession(token){
  if(token!==generation||!active||reconnecting)return;
  // Let the current answer finish before a planned renewal so it cannot be stranded.
  if((busy||voiceCallbacks||voiceDrain)&&ready){scheduleResume(token,2000);return;}
  reconnecting=true;clearTimers();discardConnection();state('reconnecting');status('AI와 다시 연결하고 있어요…');
  const hadHandle=Boolean(sessionHandle);
  try{await establish(token,hadHandle);}
  catch(error){
   if(token!==generation||!active)return;
   discardConnection(error);
   // A rejected handle must not trap every subsequent attempt on the same old session.
   if(hadHandle)sessionHandle='';
   retryCount++;
   const retrySeconds=Number(error?.retryAfterSeconds||String(error?.message||'').match(/\((\d+)초 뒤/)?.[1]||0);
   if(retrySeconds>120){active=false;settleAnswer(error);state('off');status(String(error.message||error));return;}
   if(retryCount>=3){active=false;settleAnswer(error);state('off');status('AI 연결을 복구하지 못했어요. 인터넷 연결을 확인한 뒤 화면 함께 보기를 눌러 주세요.');return;}
   const delay=Math.max(retrySeconds*1000,Math.min(60000,30000*retryCount));
   status(`AI 연결이 지연돼요 · ${Math.ceil(delay/1000)}초 뒤 다시 연결합니다.`);scheduleResume(token,delay);
  }finally{if(token===generation)reconnecting=false;}
 }
 async function enableSharing(){
  if(!active||!ready||busy)throw Error('AI 연결을 준비한 뒤 다시 공유해 주세요.');
  const token=generation;let image='',error=null;
  for(let attempt=0;attempt<8;attempt++){if(token!==generation||!active||!ready)throw Error('AI 연결이 종료됐어요.');try{image=await captureImage();error=null;break;}catch(reason){error=reason;}if(attempt<7)await new Promise(resolve=>setTimeout(resolve,350));}
  if(error)throw error;if(token!==generation||!active||!ready)throw Error('AI 연결이 종료됐어요.');
  screenMode=true;lastFrameAt=0;sendImage(image,token);scheduleFrames(token);state('connected');status(watchingStatus());
 }
 function disableSharing(){
  if(busy){stop();return false;}
  screenMode=false;lastImage='';clearInterval(frameTimer);frameTimer=null;
  if(active&&ready&&socket?.readyState===1)socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:'화면 공유를 종료했습니다. 지금부터 새 화면은 보내지 않습니다. 이전 장면과 현재 화면을 구분하고, 현재 화면을 보고 있다고 말하지 마세요. 텍스트 대화를 이어갑니다.'}]}],turnComplete:false}}));
  state(active&&ready?'connected':'off');status(watchingStatus());return active&&ready;
 }
 function start(next){if(startPromise)return startPromise;const operation=startSession(next);startPromise=operation;void operation.then(()=>{if(startPromise===operation)startPromise=null;},()=>{if(startPromise===operation)startPromise=null;});return operation;}
 async function startSession(next){
  stop();callbacks=next;screenMode=next?.mode!=='text';active=true;const token=generation;state('connecting');
  try{
   if(screenMode&&!stream)throw Error('영상 화면을 먼저 선택해 주세요.');
   status(screenMode?'영상 위치를 확인하고 AI와 연결하고 있어요…':'AI와 연결하고 있어요 · 화면 공유는 꺼져 있습니다.');
   let error=null;
   for(let attempt=0;screenMode&&attempt<8;attempt++){
    if(token!==generation)return;
    try{await captureImage();error=null;break;}catch(reason){error=reason;}
    if(attempt<7)await new Promise(resolve=>setTimeout(resolve,350));
   }
   if(token!==generation)return;if(error)throw error;
   await establish(token,false);
  }catch(error){if(token!==generation)return;active=false;ready=false;clearTimers();discardConnection(error);state('off');throw error;}
 }
 async function ask(value){
  if(voiceDrain)await voiceDrain;
  const text=String(value||'').trim();if(!text)throw Error('질문을 입력해 주세요.');
  if(text.length>3000)throw Error('질문을 3,000자 이내로 줄여 주세요.');
  if(voiceCallbacks)throw Error('음성 대화를 종료한 뒤 글로 질문해 주세요.');
  if(!ready||!active||busy)throw Error(busy?'이전 질문을 분석하고 있어요.':'화면 함께 보기를 연결한 뒤 질문해 주세요.');
  const token=generation;busy=true;
  try{
   if(screenMode){await updateCapturePlan();if(token!==generation)throw Error('AI 연결이 종료됐어요.');
   if(!capturePlan?.linked||capturePlan.blocked)throw Error(capturePlan?.reason||'영상 화면을 확인하지 못했어요. 영상을 화면에 띄워 주세요.');
   await transmitFrame(token,{allowPaused:true,strict:true});}if(token!==generation)throw Error('AI 연결이 종료됐어요.');
   if(!ready||!socket||socket.readyState!==1)throw Error('AI와 다시 연결하고 있어요. 잠시 뒤 질문해 주세요.');
   const context=callbacks?.getContext?.(text);if(typeof context==='string'&&context.trim()&&context.length<=18000)socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:context}]}],turnComplete:false}}));
   status(screenMode?'함께 본 화면을 바탕으로 답변하고 있어요…':'질문에 답변하고 있어요 · 화면은 전송하지 않습니다.');
   await new Promise((resolve,reject)=>{
    const answer={resolve,reject,text:'',image:lastImage,timer:null};pendingAnswer=answer;
    answer.timer=setTimeout(()=>{
     if(pendingAnswer!==answer||token!==generation)return;
     settleAnswer(Error('답변이 지연돼요. 다시 시도해 주세요.'));
     // Reconnect before retrying: a late answer from this turn must not become the next answer.
     discardConnection();scheduleResume(token,1500);state('reconnecting');
    },ANSWER_TIMEOUT);
    try{socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text}]}],turnComplete:true}}));}
    catch(error){settleAnswer(error);}
   });
  }finally{if(token===generation)busy=false;}
 }
 window.cleanTouchLive={start,stop,ask,enableVoice,sendAudio,endAudio,disableVoice,waitForIdle:async()=>{if(voiceDrain)await voiceDrain;},enableSharing,disableSharing,get active(){return active&&ready;},get sharing(){return active&&screenMode;},get mode(){return screenMode?'screen':'text';}};
 window.addEventListener('beforeunload',stop);
})();
