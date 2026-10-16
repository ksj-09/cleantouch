(()=>{
 const dialog=document.getElementById('screen-permission');let pending=null,captureAllowed=false,returnFocus=null;
 function finish(allowed){const current=pending;if(!current)return;pending=null;if(allowed)captureAllowed=true;dialog.close();current.resolve(allowed);returnFocus?.focus();}
 function request(kind){if(kind==='capture'&&captureAllowed)return Promise.resolve(true);if(pending)return Promise.resolve(false);
  returnFocus=document.activeElement;const screen=kind==='share';dialog.dataset.kind=kind;
  document.getElementById('permission-title').textContent=screen?'AI와 영상 화면을 공유할까요?':'영상 화면을 살펴볼까요?';
  document.getElementById('permission-description').textContent=screen?'영상 영역의 장면을 Gemini로 계속 보냅니다. 일반 채팅에서는 화면을 보내지 않아요.':'화면을 캡처해 영상 영역의 장면을 이 기기에 임시로 모읍니다. AI 채팅을 열었다는 이유로 이 화면을 AI에 보내지 않아요.';
  document.getElementById('permission-scope').textContent=screen?'영상 영역 · 초당 최대 1장':'현재 모니터를 캡처하고 영상 영역만 장면으로 저장';
  document.getElementById('permission-stop-info').textContent=screen?'공유 종료 또는 대화창 X를 누르면 AI 화면 전송이 멈춥니다.':'수집 일시정지로 장면 저장을 멈추고, 앱을 종료하면 캡처가 끝납니다.';
  document.getElementById('permission-allow').textContent=screen?'허용하고 화면 공유':'허용하고 시작';document.getElementById('permission-deny').textContent=screen?'채팅만 할게요':'취소';
  const promise=new Promise(resolve=>{pending={resolve};});dialog.showModal();document.getElementById('permission-deny').focus();return promise;
 }
 document.getElementById('permission-allow').onclick=()=>finish(true);document.getElementById('permission-deny').onclick=()=>finish(false);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
 window.cleanTouchPermissions={request,cancel:()=>finish(false),revoke(){captureAllowed=false;finish(false);},get pending(){return Boolean(pending);}};
 window.addEventListener('beforeunload',()=>finish(false));
})();
