function createMicrophoneGate(getWindow,now=Date.now){
 let grant=null,epoch=0;
 function trusted(sender,frame){const win=getWindow();return Boolean(win&&!win.isDestroyed()&&sender===win.webContents&&frame===sender.mainFrame&&frame.url==='cleantouch://app/index.html');}
 return {
  async authorize(sender,frame,ask){if(!trusted(sender,frame))throw Error('이 창에서는 마이크를 사용할 수 없어요.');const token=++epoch;grant=null;if(!await ask()||token!==epoch||!trusted(sender,frame))return false;grant={sender,frame,until:now()+15000};return true;},
  allows(sender,type,details={}){return Boolean(grant&&grant.sender===sender&&trusted(sender,grant.frame)&&now()<grant.until&&type==='audio'&&details.isMainFrame!==false&&(!details.requestingUrl||details.requestingUrl==='cleantouch://app/index.html'));},
  revoke(){epoch++;grant=null;},
 };
}
module.exports={createMicrophoneGate};
