const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../cleantouch-desktop');let p=path.join(base,'index.html'),s=fs.readFileSync(p,'utf8');s=s.replace("connect-src 'self'","connect-src 'self' wss://generativelanguage.googleapis.com");s=s.replace('>현재 화면 공유</button>','>실시간 화면 공유</button>');s=s.replace('id="chat-reset"','id="chat-live-stop" class="secondary" hidden>공유 종료</button><button id="chat-reset"');s=s.replace('id="chat-live-stop" class="secondary" hidden>공유 종료</button><button id="chat-reset" class="secondary"','id="chat-live-stop" class="secondary" hidden>공유 종료</button><button id="chat-reset" class="secondary"');fs.writeFileSync(p,s);
p=path.join(base,'place-chat.js');s=fs.readFileSync(p,'utf8');s=s.replace('function reset(){generation++;','function reset(){window.cleanTouchLive?.stop();generation++;');s=s.replace("el('chat-close').onclick=async()=>{generation++","el('chat-close').onclick=async()=>{window.cleanTouchLive?.stop();el('chat-live-stop').hidden=true;generation++");
const marker="el('chat-form').onsubmit=event=>{event.preventDefault();const value=input.value.trim();";
s=s.replace(marker,marker+"if(value&&cleanTouchLive.active){message('user',value);input.value='';try{cleanTouchLive.ask(value);}catch(error){el('chat-error').textContent=error.message;}return;}");
s=s.replace("el('chat-place').onclick=analyze;",`el('chat-place').onclick=async()=>{
 if(el('chat-source').value==='import'){await analyze();return;}
 try{
  reset();if(!stream)await startCapture();if(!stream)throw Error('화면 공유를 시작해 주세요.');
  await open();returnWidget=document.body.classList.contains('widget-mode');if(returnWidget){document.body.classList.add('floating-chat');ui.widget.hidden=true;await bridge.setWindowLayout('widget-panel');}
  let answer=null;el('chat-live-stop').hidden=false;
  await cleanTouchLive.start({onStatus:text=>{el('chat-error').textContent=text;if(!cleanTouchLive.active){input.disabled=true;el('chat-send').disabled=true;}},onReady:()=>{input.disabled=false;el('chat-send').disabled=false;input.focus();},onText:(text,done)=>{if(done){answer=null;return;}if(!answer)answer=message('model','');answer.textContent+=text;log.scrollTop=log.scrollHeight;}});
 }catch(error){el('chat-error').textContent=error.message;el('chat-live-stop').hidden=true;}
};el('chat-live-stop').onclick=()=>{cleanTouchLive.stop();el('chat-live-stop').hidden=true;el('chat-error').textContent='실시간 화면 공유를 종료했습니다.';controls();};`);
fs.writeFileSync(p,s);
fs.appendFileSync(path.join(base,'styles.css'),"\n.place-chat .chat-tools #chat-live-stop:not([hidden]){grid-column:span 3}#chat-live-stop[hidden]{display:none}\n");
