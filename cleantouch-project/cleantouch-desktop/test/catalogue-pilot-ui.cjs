const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{once}=require('node:events');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'cleantouch-catalogue-ui-')));
app.whenReady().then(async()=>{let server,win;try{
 const api=path.resolve(__dirname,'../../cleantouch-search-api'),{createCataloguePilot}=await import(require('node:url').pathToFileURL(path.join(api,'dist/catalogue-pilot.js')).href);
 server=createCataloguePilot(fs.readFileSync(path.join(api,'public/catalogue-pilot.html'),'utf8'),JSON.parse(fs.readFileSync(path.join(api,'test/fixtures/catalogue-test.json'),'utf8'))).listen(0,'127.0.0.1');await once(server,'listening');
 win=new BrowserWindow({show:false,width:1280,height:1000,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:true}});const failures=[];win.webContents.on('console-message',(_event,level,message)=>{if(level>=3)failures.push(message);});
 await win.loadURL('http://127.0.0.1:'+server.address().port);
 const result=await win.webContents.executeJavaScript(`(async()=>{
  const get=id=>document.getElementById(id);async function wait(check){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}throw Error('UI state timed out: '+get('error').textContent);}
  if(get('catalogue-status').dataset.loaded)throw Error('Real catalogue was loaded automatically');get('fixture').click();await wait(()=>get('catalogue-status').dataset.loaded==='test');
  get('lookup').dispatchEvent(new Event('submit',{cancelable:true}));await wait(()=>get('answer').dataset.result==='options_required');
  get('lookup').elements.color.value='검정';get('lookup').elements.size.value='M';get('lookup').dispatchEvent(new Event('submit',{cancelable:true}));await wait(()=>get('answer').dataset.result==='identifier_match');
  if(get('answer').querySelector('a'))throw Error('Fictional data became a purchase link');
  get('resolve').dispatchEvent(new Event('submit',{cancelable:true}));await wait(()=>get('answer').dataset.result==='publisher_mapped');
  get('sdk').click();await wait(()=>!get('sdk-data').hidden);const sdk=JSON.parse(get('sdk-data').textContent);if(sdk.products[0]?.id!=='bag-a-black-m')throw Error('SDK lost the registered SKU');
  if(!get('answer').textContent.includes('bag-a-black-m')||get('answer').getBoundingClientRect().height<50)throw Error('Result is not visibly laid out');
  return {testDataExplicit:true,optionsRequired:true,skuLookup:true,noFictionalPurchaseLinks:true,registeredVideoSku:true,sdkData:true};
 })()`,true);
 assert(Object.values(result).every(Boolean));assert.equal(failures.length,0,failures.join('\n'));
 await new Promise(r=>setTimeout(r,250));const folder=path.resolve(__dirname,'../../artifacts/verification');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'catalogue-pilot-desktop.png'),(await win.webContents.capturePage()).toPNG());
 await win.setSize(430,900);await new Promise(r=>setTimeout(r,150));const layout=await win.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth');assert(layout,'Pilot layout overflows on small screens');fs.writeFileSync(path.join(folder,'catalogue-pilot-small.png'),(await win.webContents.capturePage()).toPNG());
 console.log(JSON.stringify({...result,smallLayout:true}));
 }catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();if(server)await new Promise(r=>server.close(r));app.exit(process.exitCode||0);}});
