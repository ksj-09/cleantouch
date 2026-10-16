const {app,BrowserWindow,ipcMain,protocol}=require('electron'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');app.setPath('userData',path.resolve(root,'../.local/scene-grounding-test-profile'));
protocol.registerSchemesAsPrivileged([{scheme:'cleantouch',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
app.whenReady().then(async()=>{ipcMain.handle('place:cancel',()=>{});try{
 protocol.handle('cleantouch',async request=>{const url=new URL(request.url),file=url.pathname==='/scene.jpg'?path.resolve(root,'../artifacts/verification/live-clean-video.jpg'):path.join(root,url.pathname.slice(1));return new Response(await fs.readFile(file),{headers:{'content-type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream'}});});
 for(const name of ['get','activity'])ipcMain.handle('updates:'+name,()=>({status:'unsupported'}));ipcMain.handle('video:time',()=>({available:false}));ipcMain.handle('capture:geometry',()=>({}));
 let calls=0;ipcMain.handle('place:chat',(_e,payload)=>{calls++;assert.equal(payload.task,'objects');assert.equal(Buffer.from(payload.image,'base64')[0],255);return {products:[{label:'빨간색 광선검',confidence:'high',temporalVerified:true,box:[.1,.15,.4,.8]},{label:'흰색 티셔츠',confidence:'high',box:[.5,.1,.9,.9]},{label:'운동화',confidence:'high',box:[.1,.15,.4,.8]}]};});
 const window=new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'preload.cjs'),sandbox:true,contextIsolation:true}});await window.loadURL('cleantouch://app/index.html');
 const result=await window.webContents.executeJavaScript(`(async()=>{classifyProduct=async()=>({label:'광선검',category:'lightsaber',embedding:[1,0,0,0],uncertain:false});getProductObjectDetector=async()=>({detect:()=>({detections:[]})});glowingObjectRegions=()=>[];const blob=await(await fetch('cleantouch://app/scene.jpg')).blob();const first={blob,videoOnly:true,videoKey:'actual-video',seconds:10,capturedAt:1000};await scanFrame(first);lastPrecisionCheck=0;await scanFrame({...first,seconds:25,capturedAt:2000});const p=[...found.values()][0],bitmap=await createImageBitmap(p.imageBlob);return {products:found.size,label:p.label,seconds:p.sightings.map(s=>s.seconds),type:p.imageBlob.type,width:bitmap.width,height:bitmap.height,box:p.box};})()`);
 assert.equal(calls,1); // Exact scene bytes reuse verified results for a new timestamp.
 assert.equal(result.products,1);assert.equal(result.label,'빨간색 광선검');assert.deepEqual(result.seconds,[10,25]);assert.equal(result.type,'image/jpeg');assert(result.width>24&&result.height>48);assert.deepEqual(result.box,[.1,.15,.4,.8]);
 const multiView=await window.webContents.executeJavaScript(`(async()=>{
 found=new Map();productAI.cosine=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
 const make=async sharp=>{const c=document.createElement('canvas');c.width=160;c.height=160;const ctx=c.getContext('2d');if(sharp){for(let y=0;y<160;y+=8)for(let x=0;x<160;x+=8){ctx.fillStyle=(x+y)%16?'#fff':'#000';ctx.fillRect(x,y,8,8);}}else{const g=ctx.createLinearGradient(0,0,160,0);g.addColorStop(0,'#777');g.addColorStop(1,'#aaa');ctx.fillStyle=g;ctx.fillRect(0,0,160,160);}return new Promise(r=>c.toBlob(r,'image/jpeg',.95));};
 const blur=await make(false),sharp=await make(true),box=[.1,.1,.3,.8];
 const add=async(embedding,imageBlob,at)=>{const frame={blob:imageBlob,videoKey:'multi-view',seconds:at,capturedAt:at*1000};await recordProducts({body:{local:true,products:[{label:'보라색 광선검',embedding,imageBlob,box,verified:true}]}},frame);};
 await add([1,0],blur,1);await add([.9,Math.sqrt(1-.9**2)],sharp,2);await add([.65,Math.sqrt(1-.65**2)],blur,3);
 const p=[...found.values()][0];if(p.sourceFrame?.blob!==sharp)throw Error('Product context no longer matches the retained sharp frame');
 let sent;const originalIdentify=cleanTouchPlaceChat.identify;cleanTouchPlaceChat.identify=async(...args)=>{sent=args;};
 await identifyRecordedProduct(p);cleanTouchPlaceChat.identify=originalIdentify;
 if(sent?.[0]!==sharp||!sent?.[3]?.length)throw Error('Recorded purchase action lost selected image or original scene context');
 return {count:found.size,sightings:p.sightings.length,keptSharp:p.imageBlob===sharp,originalContextSent:true};
 })()`);
 assert.deepEqual(multiView,{count:1,sightings:3,keptSharp:true,originalContextSent:true});
 const grouping=await window.webContents.executeJavaScript(`(async()=>{
 found=new Map();const image=await(await fetch('cleantouch://app/scene.jpg')).blob();
 const left=[.1,.1,.3,.8],right=[.65,.1,.9,.8];
 const add=async(frame,label,embedding,box)=>recordProducts({body:{local:true,products:[{label,embedding,box,imageBlob:image,verified:true}]}},frame);
 const a={blob:image,videoKey:'grouping',seconds:1,capturedAt:1000},b={...a,seconds:8,capturedAt:8000};
 await add(a,'빨간색 광선검',[1,0],left);await add(b,'빨간색 광선검',[0,1],right);
 if(found.size!==2)throw Error('Unrelated appearances merged by label alone');
 await add(b,'초록색 광선검',[1,0],left);if(found.size!==3)throw Error('Different colours merged');
 await add(b,'빨간색 광선검',[0,1],left);if(found.size!==4)throw Error('Separate same-colour objects merged in one scene');
 await add({...a,videoKey:'other-video'},'빨간색 광선검',[1,0],left);if(found.size!==5)throw Error('Different videos merged');
 return {weakViewsSeparate:true,differentColoursSeparate:true,cooccurringObjectsSeparate:true,differentVideosSeparate:true};
 })()`);
 const temporal=await window.webContents.executeJavaScript(`(async()=>{
 const blob=await(await fetch('cleantouch://app/scene.jpg')).blob();const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;const ctx=canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,16,16);const other=await new Promise(r=>canvas.toBlob(r,'image/jpeg'));
 const current={blob,videoKey:'temporal',capturedAt:1000},copy={blob:new Blob([await blob.arrayBuffer()],{type:blob.type}),videoKey:'temporal',capturedAt:0};
 frames=[copy,current];if((await temporalSceneEvidence(current)).length!==1)throw Error('Duplicate bytes established temporal evidence');
 frames.push({blob:other,videoKey:'other-video',capturedAt:2000});if((await temporalSceneEvidence(current)).length!==1)throw Error('Different video supplied evidence');
 frames.push({blob:other,videoKey:'temporal',capturedAt:2000});if((await temporalSceneEvidence(current)).length!==2)throw Error('Next distinct scene missing');
 const oldGlow=glowingObjectRegions;glowingObjectRegions=c=>c.width===16?[{color:'green',left:0,top:0,right:16,bottom:16}]:[{color:'red',left:0,top:0,right:c.width,bottom:c.height}];
 const bitmap=await createImageBitmap(blob);const red={color:'red',left:0,top:0,right:bitmap.width,bottom:bitmap.height};
 if(await hasTemporalGlowEvidence(current,red,bitmap.width,bitmap.height))throw Error('Duplicate paused frame falsely confirmed a transient colour');
 bitmap.close();glowingObjectRegions=oldGlow;
 return {duplicateBytesRejected:true,differentVideosRejected:true,adjacentScenesIncluded:true,duplicateCannotConfirmColour:true};
 })()`);
 const generalTemporal=await window.webContents.executeJavaScript(`(async()=>{
 const blob=await(await fetch('cleantouch://app/scene.jpg')).blob(),bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();canvas.getContext('2d').fillStyle='#123456';canvas.getContext('2d').fillRect(0,0,2,2);const previousBlob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.92));
 const originalClassify=classifyProduct,matched=[];
 for(const category of ['shirt','pants','shoe','handbag','phone','chair']){
  const current={blob,videoKey:'general-'+category,capturedAt:1000},previous={blob:previousBlob,videoKey:current.videoKey,capturedAt:0};frames=[previous,current];
  const classification={label:category,category,embedding:[1,0],uncertain:false};classifyProduct=async()=>classification;
  if(!await hasTemporalProductEvidence(current,[0,0,1,1],classification))throw Error('General product did not receive temporal support: '+category);matched.push(category);
  const differentPrevious={...previous};frames=[differentPrevious,current];classifyProduct=async()=>({...classification,category:'unknown',uncertain:true});
  if(await hasTemporalProductEvidence(current,[0,0,1,1],classification))throw Error('Uncertain neighbour confirmed '+category);
 }
 classifyProduct=originalClassify;return {matched,uncertainNeighboursRejected:true};
 })()`);
 assert.equal(generalTemporal.matched.length,6);
 const noEmbedding=await window.webContents.executeJavaScript(`(async()=>{found=new Map();const blob=await(await fetch('cleantouch://app/scene.jpg')).blob(),frame={blob,videoKey:'novel-products',seconds:0,capturedAt:0};await recordProducts({body:{local:true,products:[{label:'커피 드리퍼',box:[.1,.1,.3,.5]},{label:'커피 드리퍼',box:[.6,.1,.9,.5]}]}},frame);return found.size;})()`);
 assert.equal(noEmbedding,2,'Different objects without local embeddings must not overwrite each other');
 const budget=await window.webContents.executeJavaScript(`(async()=>{const c=document.createElement('canvas');c.width=1600;c.height=1200;const x=c.getContext('2d'),pixels=x.createImageData(c.width,c.height);let seed=17;for(let i=0;i<pixels.data.length;i++){seed=(seed*1664525+1013904223)>>>0;pixels.data[i]=i%4===3?255:seed>>>24;}x.putImageData(pixels,0,0);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const encoded=await cleanTouchImage.encode(blob,{maxChars:120000});return encoded.length;})()`);
 assert(budget<=120000,'Complex images must stay under the upload budget');
 const purchaseCards=await window.webContents.executeJavaScript(`(()=>{
 const host=document.createElement('div');document.body.append(host);
 const base={kind:'product',query:'bag',label:'bag',candidates:[]};
 let box=cleanTouchShopping.render(host,{...base,comparisonStage:'searching'});
 if(!box.querySelector('.purchase-status').textContent.includes('찾고 있어요'))throw Error('Pending search appeared complete');
 if(box.querySelector('details').open)throw Error('Keyword search is not optional');
 box=cleanTouchShopping.render(host,{...base,candidates:[{name:'invented',url:'https://shop.example.com/products/123',image:'c2VsbGVy',visualVerified:false},{name:'search',url:'https://www.google.com/search?q=bag',image:'c2VsbGVy',visualVerified:true}]});
 if(box.querySelector('.candidate-link'))throw Error('Unverified or keyword link rendered as a seller');
 if(!box.querySelector('.purchase-status').textContent.includes('확인하지 못'))throw Error('Invalid candidates reported success');
 const sale={name:'real bag',url:'https://shop.example.com/products/123',image:'c2VsbGVy',visualVerified:true,matchType:'visual_similar',differences:['strap differs']};
 box=cleanTouchShopping.render(host,{...base,candidates:[sale]});
 if(!box.querySelector('.candidate-link')||!box.textContent.includes('동일 모델 미확인')||!box.textContent.includes('strap differs'))throw Error('Visual similarity not distinguished');
 box=cleanTouchShopping.render(host,{...base,candidates:[{...sale,matchType:'identifier_match',identityEvidence:'ACME CT12345',differences:[]}]});
 if(!box.textContent.includes('모델 식별자 일치'))throw Error('Identifier evidence missing');
 host.remove();return {pending:true,invalidSellersRejected:true,similarityLabel:true,identifierLabel:true,keywordSearchOptional:true};
 })()`);
 console.log(JSON.stringify({verifiedBox:true,wrongFamilyRejected:true,wholeCropPreserved:true,cacheRetainsDistinctTimes:true,multiView,grouping,temporal,generalTemporal,purchaseCards,...result}));app.exit(0);
 }catch(e){console.error(e);app.exit(1);}});
