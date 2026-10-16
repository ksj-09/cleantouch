function createCaptureGate(getWindow,now=Date.now){
 let grant=null;
 return {
  allowsDisplayPermission(sender,details={}){const window=getWindow();return Boolean(grant&&window&&!window.isDestroyed()&&sender===window.webContents&&grant.frame===sender.mainFrame&&grant.frame.url==='cleantouch://app/index.html'&&now()<grant.until&&details.isMainFrame!==false&&(!details.requestingUrl||details.requestingUrl==='cleantouch://app/index.html'));},
  authorize(sender,frame){const window=getWindow();if(!window||window.isDestroyed()||sender!==window.webContents||frame!==sender.mainFrame||frame.url!=='cleantouch://app/index.html')throw Error('이 창에서는 화면 캡처를 허용할 수 없어요.');grant={frame,until:now()+15000};return true;},
  consume(request){const allowed=grant;grant=null;const window=getWindow();return Boolean(allowed&&window&&!window.isDestroyed()&&request.frame===allowed.frame&&request.frame===window.webContents.mainFrame&&now()<allowed.until&&request.videoRequested&&!request.audioRequested);},
  revoke(){grant=null;}
 };
}
module.exports={createCaptureGate};
