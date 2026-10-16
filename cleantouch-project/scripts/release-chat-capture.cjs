const fs=require('node:fs');const file='cleantouch-desktop/place-chat.js';let code=fs.readFileSync(file,'utf8');
code=code.replace("generation++;window.cleanTouchLive?.stop();cleanTouchPermissions.cancel();","generation++;window.cleanTouchLive?.stop();if(shareOwnsCapture){shareOwnsCapture=false;void stopCapture(true);}cleanTouchPermissions.cancel();");
code=code.replace("window.cleanTouchLive?.stop();liveState('off');busy=false;productSearchGeneration++;","window.cleanTouchLive?.stop();if(shareOwnsCapture){shareOwnsCapture=false;await stopCapture(true);}liveState('off');busy=false;productSearchGeneration++;");
fs.writeFileSync(file,code);
