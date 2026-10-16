const fs=require('node:fs');const file='cleantouch-desktop/place-chat.js';let source=fs.readFileSync(file,'utf8');
source=source.replace("image=btoa(binary);\n  await open();const p=message('user','공유한 현재 장면');","image=btoa(binary);importedBlob=cleanTouchShopping.toBlob(image);el('chat-source').querySelector('option[value=import]').disabled=false;el('chat-source').value='import';panel.dataset.chatMode='photo';\n  await open();const p=message('user','공유한 현재 장면');");
source=source.replace("image=data.image;el('chat-import-image')","image=data.image;panel.dataset.chatMode='photo';el('chat-import-image')");
fs.writeFileSync(file,source);
const live='cleantouch-desktop/live-screen.js';let code=fs.readFileSync(live,'utf8');code=code.replaceAll('화면 공유 연결','AI 연결').replaceAll('화면 공유를 다시 연결','AI와 다시 연결').replaceAll('화면 공유가 종료됐어요.','AI 연결이 종료됐어요.');fs.writeFileSync(live,code);
