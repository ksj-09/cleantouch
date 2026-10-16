const fs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');
function startVideoRegion(app) {
  let latest={available:false},at=0,pending='',child=null,closed=false,startedAt=0;
  const file=path.join(app.getPath('userData'),'windows-video-region.ps1');
  fs.mkdirSync(app.getPath('userData'),{recursive:true});
  fs.writeFileSync(file,Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),fs.readFileSync(path.join(app.getAppPath(),'windows-video-region.ps1'))]));
  function launch(){
    if(closed)return;
    latest={available:false};at=0;pending='';startedAt=Date.now();
    const worker=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file,'-OwnerProcessId',String(process.pid)],{windowsHide:true,stdio:['ignore','pipe','ignore']});
    child=worker;
    worker.stdout.setEncoding('utf8');worker.stdout.on('data',chunk=>{
      if(closed||child!==worker)return;
      pending+=chunk;if(pending.length>32768)pending='';let end;
      while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);try{const value=JSON.parse(line);if(value&&typeof value.available==='boolean'){latest=value;at=Date.now();}}catch{}}
    });
    const failed=()=>{if(child===worker){child=null;latest={available:false};}};
    worker.on('error',failed);worker.on('exit',failed);
  }
  launch();
  // UI Automation can hang when the browser changes pages. Recover the helper,
  // while the public getter keeps stale rectangles unavailable throughout.
  const watchdog=setInterval(()=>{
    if(closed)return;
    if(!child){if(Date.now()-startedAt>=3000)launch();return;}
    if(Date.now()-(at||startedAt)>20000){const stale=child;child=null;stale.kill();launch();}
  },1000);
  watchdog.unref?.();
  return {get:()=>!closed&&Date.now()-at<2500?latest:{available:false},close:()=>{closed=true;clearInterval(watchdog);const worker=child;child=null;worker?.kill();latest={available:false};}};
}
module.exports={startVideoRegion};
