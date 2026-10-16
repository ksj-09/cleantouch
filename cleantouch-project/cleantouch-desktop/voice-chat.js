(()=>{
 const api=window.cleanTouch,panel=document.getElementById('place-chat'),mic=document.getElementById('chat-microphone'),speaker=document.getElementById('chat-listen'),status=document.getElementById('voice-status'),label=document.getElementById('voice-status-text'),cancelButton=document.getElementById('voice-cancel');
 let state='idle',epoch=0,chatBusy=false,media=null,context=null,node=null,source=null,timer=null,lastActivity=0,output=null,nextAudio=0,liveAudio=false,readAloud=false;
 const playing=new Set();try{readAloud=localStorage.getItem('cleantouch-read-aloud')==='true';}catch{}
 const echo=new cleanTouchVoiceEcho.EchoGuard(),modeTools=document.getElementById('voice-mode-tools'),modeButton=document.getElementById('voice-mode'),holdButton=document.getElementById('voice-hold');let holdMode=false,holding=false;
 try{holdMode=localStorage.getItem('cleantouch-voice-hold')==='true';}catch{}
 function modeControls(){modeTools.hidden=state==='idle';modeButton.textContent=holdMode?'자동 대화로 돌아가기':'주변이 시끄러워요';modeButton.setAttribute('aria-pressed',String(holdMode));holdButton.hidden=!holdMode;holdButton.disabled=state!=='listening';holdButton.setAttribute('aria-pressed',String(holding));holdButton.textContent=holding?'듣고 있어요 · 놓으면 전송 중지':'누르고 말하기';}
 function press(){if(state!=='listening'||!holdMode||holding)return;holding=true;stopPlayback();report('누르고 있는 동안만 AI에 목소리를 보내요.');modeControls();}
 function unpress(){if(!holding)return;holding=false;window.cleanTouchLive?.endAudio?.();report('말씀을 확인하고 답변을 준비하고 있어요.');modeControls();}
 function report(text){status.hidden=!text;label.textContent=text;panel.dataset.voicePhase=/답하고/.test(text)?'speaking':/답변을 준비/.test(text)?'thinking':/연결|허용/.test(text)?'connecting':/듣고/.test(text)?'listening':'idle';}
 function update(){panel.dataset.voiceState=state;panel.dataset.voiceConversation=String(state!=='idle');mic.disabled=state==='idle'&&chatBusy;mic.setAttribute('aria-pressed',String(state!=='idle'));mic.title=state==='idle'?'음성 대화 시작':'음성 대화 종료';mic.setAttribute('aria-label',mic.title);cancelButton.hidden=state==='idle';cancelButton.textContent='대화 종료';speaker.setAttribute('aria-pressed',String(readAloud||state!=='idle'));speaker.title=state!=='idle'?'음성 대화에서는 AI가 소리로 답해요':readAloud?'답변 소리 끄기':'답변을 소리로 듣기';window.cleanTouchPlaceChat?.refreshControls();}
 function stopPlayback(){window.speechSynthesis?.cancel();for(const item of playing){try{item.stop();}catch{}}playing.clear();nextAudio=0;}
 function release(){clearInterval(timer);timer=null;try{source?.disconnect();node?.port.postMessage({type:'stop'});node?.disconnect();}catch{}source=node=null;media?.getTracks().forEach(track=>track.stop());media=null;const old=context;context=null;void old?.close().catch(()=>{});void api.revokeMicrophone?.().catch(()=>{});}
 function cancel(reason=''){epoch++;holding=false;release();state='idle';stopPlayback();echo.clear();liveAudio=false;window.cleanTouchLive?.disableVoice?.();window.cleanTouchPlaceChat?.finishVoiceTurn?.(true);report(reason);update();modeControls();}
 function outputContext(){if(!output||output.state==='closed')output=new AudioContext();void output.resume().catch(()=>{});return output;}
 function receiveAudio(data,mime){
  if(holding||!(readAloud||state==='listening')||typeof data!=='string'||data.length>262144||!/^audio\/pcm(?:;|$)/.test(mime||''))return;
  try{const raw=atob(data),sampleRate=Number(/rate=(\d+)/.exec(mime)?.[1]||24000);if(sampleRate<8000||sampleRate>48000||raw.length<2)return;const ctx=outputContext();if(nextAudio-ctx.currentTime>30)return;const buffer=ctx.createBuffer(1,Math.floor(raw.length/2),sampleRate),channel=buffer.getChannelData(0);for(let i=0;i<channel.length;i++){const value=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);channel[i]=(value>=32768?value-65536:value)/32768;}const item=ctx.createBufferSource();item.buffer=buffer;item.connect(ctx.destination);nextAudio=Math.max(ctx.currentTime+.02,nextAudio);echo.reference(channel,sampleRate,performance.now()+(nextAudio-ctx.currentTime)*1000);item.start(nextAudio);nextAudio+=buffer.duration;playing.add(item);item.onended=()=>playing.delete(item);liveAudio=true;}catch{report('소리를 재생하지 못했어요. 채팅에 표시된 답변을 확인해 주세요.');}
 }
 function replyStarted(){stopPlayback();liveAudio=false;if(readAloud||state==='listening')outputContext();}
 function replyFinished(text){if(!readAloud||liveAudio||state!=='idle'||!text?.trim()||!window.speechSynthesis)return;const voice=speechSynthesis.getVoices().find(v=>v.localService&&/^ko(?:-|_)/i.test(v.lang));if(!voice)return;const utterance=new SpeechSynthesisUtterance(text.slice(0,3000));utterance.voice=voice;utterance.lang='ko-KR';speechSynthesis.speak(utterance);}
 async function start(){
  if(state!=='idle'||chatBusy||panel.hidden)return;const token=++epoch;state='requesting';report('마이크 사용을 허용하면 음성 대화가 시작돼요.');update();
  try{
   const allowed=await api.authorizeMicrophone();if(token!==epoch)return;if(!allowed){cancel('마이크 사용을 취소했어요. 글로도 질문할 수 있어요.');return;}
   const captured=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(token!==epoch){captured.getTracks().forEach(track=>track.stop());return;}media=captured;void api.revokeMicrophone().catch(()=>{});
   context=new AudioContext();await context.audioWorklet.addModule('voice-capture-worklet.js');if(token!==epoch)return;
   report('AI와 음성 대화를 연결하고 있어요…');const connected=await window.cleanTouchPlaceChat.prepareVoice();if(token!==epoch)return;if(!connected)throw Error('AI와 연결하지 못했어요. 잠시 후 다시 시작해 주세요.');outputContext();
   window.cleanTouchLive.enableVoice({
    onInput:text=>{if(token!==epoch)return;lastActivity=Date.now();report('말씀을 확인했어요 · 답변을 준비하고 있어요.');window.cleanTouchPlaceChat.voiceInput(text);},
    onAnswerStart:()=>{if(token!==epoch)return;lastActivity=Date.now();window.cleanTouchPlaceChat.voiceAnswerStart();},
    onText:text=>{if(token===epoch)window.cleanTouchPlaceChat.voiceText(text);},
    onAudio:(data,mime)=>{if(token===epoch){report(holdMode?'AI가 답하고 있어요 · 누르고 말하면 멈추고 들어요.':'AI가 답하고 있어요 · 말씀하시면 다시 들어요.');receiveAudio(data,mime);}},
    onInterrupted:()=>{if(token!==epoch)return;stopPlayback();window.cleanTouchPlaceChat.finishVoiceTurn(true);report('듣고 있어요.');},
    onTurnComplete:()=>{if(token!==epoch)return;window.cleanTouchPlaceChat.finishVoiceTurn();report(holdMode?'다음 질문은 누르고 말하기 버튼을 누른 채 말씀하세요.':'계속 듣고 있어요 · 다음 질문을 말씀하세요.');},
    onStopped:error=>{if(token===epoch)cancel(error?'연결이 끊겨 마이크를 껐어요. 다시 시작해 주세요.':'음성 대화를 종료했어요.');}
   });
   node=new AudioWorkletNode(context,'cleantouch-microphone');source=context.createMediaStreamSource(media);source.connect(node);node.connect(context.destination);const rate=context.sampleRate;
   node.port.onmessage=event=>{if(token!==epoch||state!=='listening'||holdMode&&!holding)return;let data=event.data?.samples;if(!(data instanceof Float32Array)||!data.length)return;try{if(echo.isEcho(data,rate,performance.now()))data=new Float32Array(data.length);let power=0;for(const value of data)power+=value*value;const speaking=Math.sqrt(power/data.length)>.012;const pcm=cleanTouchVoiceAudio.wav([data],rate).subarray(44);if(!cleanTouchLive.sendAudio(cleanTouchVoiceAudio.base64(pcm),speaking))throw Error('음성 연결이 끊겼어요. 다시 시작해 주세요.');}catch(error){cancel(error.message);}};
   await context.resume();if(token!==epoch)return;state='listening';lastActivity=Date.now();report(holdMode?'누르고 말하기 버튼을 누르는 동안만 AI에 음성을 보내요.':'듣고 있어요 · 말이 끝나면 AI가 바로 답해요.');update();modeControls();
   media.getAudioTracks()[0]?.addEventListener('ended',()=>{if(token===epoch)cancel('마이크 연결이 종료됐어요.');},{once:true});timer=setInterval(()=>{if(token===epoch&&Date.now()-lastActivity>120000)cancel('2분 동안 대화가 없어 마이크를 껐어요. 다시 눌러 시작하세요.');},1000);
  }catch(error){if(token===epoch)cancel(error?.name==='NotAllowedError'?'마이크 권한이 꺼져 있어요. Windows 마이크 접근 권한을 확인해 주세요.':error?.name==='NotFoundError'?'연결된 마이크를 찾지 못했어요.':String(error.message||error).replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/,'') );}
 }
 mic.onclick=()=>state==='idle'?start():cancel('음성 대화를 종료했어요.');cancelButton.onclick=()=>cancel('음성 대화를 종료했어요.');
 modeButton.onclick=()=>{unpress();holdMode=!holdMode;try{localStorage.setItem('cleantouch-voice-hold',String(holdMode));}catch{}if(holdMode){window.cleanTouchLive?.endAudio?.();report('누르고 말하기 버튼을 누르는 동안만 AI에 음성을 보내요.');}else report('듣고 있어요 · 말이 끝나면 AI가 바로 답해요.');modeControls();};
 holdButton.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();holdButton.setPointerCapture(event.pointerId);press();};holdButton.onpointerup=holdButton.onpointercancel=holdButton.onlostpointercapture=unpress;holdButton.onblur=unpress;
 holdButton.onkeydown=event=>{if(![' ','Enter'].includes(event.key))return;event.preventDefault();if(!event.repeat)press();};holdButton.onkeyup=event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();unpress();}};
 speaker.onclick=()=>{if(state!=='idle'){cancel('음성 대화를 종료했어요. 글로 대화할 수 있어요.');return;}readAloud=!readAloud;try{localStorage.setItem('cleantouch-read-aloud',String(readAloud));}catch{}if(readAloud){outputContext();report('새 답변을 소리로 읽어드려요.');}else{stopPlayback();report('답변 소리를 껐어요.');}update();};
 document.addEventListener('cleantouch:conversation-change',()=>cancel());window.addEventListener('pagehide',()=>cancel());window.addEventListener('beforeunload',()=>cancel());document.addEventListener('visibilitychange',()=>{if(document.hidden&&state!=='idle')cancel('창을 숨겨 음성 대화를 종료했어요.');});new MutationObserver(()=>{if(panel.hidden&&state!=='idle')cancel();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
 window.cleanTouchVoice={get busy(){return state!=='idle';},get conversation(){return state==='listening';},cancel,start,setChatBusy(value){chatBusy=Boolean(value);mic.disabled=state==='idle'&&chatBusy;},replyStarted,replyFinished,receiveAudio,replyFailed:stopPlayback};update();modeControls();
})();
