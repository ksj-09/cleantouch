const { app, BrowserWindow } = require('electron');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
  try {
    await window.loadURL('https://www.google.com/imghp?hl=ko');
    await window.webContents.executeJavaScript(`document.querySelector('[aria-label="이미지로 검색"]').click()`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log(JSON.stringify(await window.webContents.executeJavaScript(`({url: location.href, inputs: [...document.querySelectorAll('input')].map(x=>({type:x.type,accept:x.accept,name:x.name})),buttons:[...document.querySelectorAll('[role=button],button')].map(x=>({label:x.getAttribute('aria-label'),text:x.innerText.slice(0,100)}))})`)));
  } catch (e) { console.log(e.message); }
  app.quit();
});
