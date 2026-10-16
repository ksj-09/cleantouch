(()=>{
 const queryOf=value=>window.cleanTouchShoppingProviders?.clean(value)??(typeof value==='string'?value.replace(/[\u0000-\u001f]/g,'').trim().slice(0,60):'');
 const toBlob=image=>new Blob([Uint8Array.from(atob(image),c=>c.charCodeAt(0))],{type:'image/jpeg'});
 async function openPurchase(button,url){
  if(button.disabled)return;
  button.disabled=true;
  try{await bridge.openLink(url);}
  catch(error){document.getElementById('chat-error').textContent='검색 페이지를 열지 못했어요. 다시 눌러 주세요. '+String(error?.message||error);}
  finally{button.disabled=false;}
 }
 async function crop(image,box){
  if(!image)return '';
  if(!Array.isArray(box)||box.length!==4||box.some(n=>!Number.isFinite(n)||n<0||n>1000)||box[2]<=box[0]||box[3]<=box[1])return image;
  const bitmap=await createImageBitmap(toBlob(image));
  try{const [y,x,bottom,right]=box.map(n=>n/1000),pad=.025;
   const left=Math.max(0,x-pad),top=Math.max(0,y-pad),w=Math.min(1,right+pad)-left,h=Math.min(1,bottom+pad)-top;
   if(w*bitmap.width<24||h*bitmap.height<24)return image;
   const canvas=document.createElement('canvas');canvas.width=Math.round(w*bitmap.width);canvas.height=Math.round(h*bitmap.height);
   canvas.getContext('2d').drawImage(bitmap,left*bitmap.width,top*bitmap.height,w*bitmap.width,h*bitmap.height,0,0,canvas.width,canvas.height);
   return canvas.toDataURL('image/jpeg',.92).split(',')[1];
  }finally{bitmap.close();}
 }
 function verifiedCandidates(card){
  return (Array.isArray(card.candidates)?card.candidates:[]).filter(candidate=>{
   if(!candidate||candidate.visualVerified!==true||typeof candidate.image!=='string'||!candidate.image||candidate.image.length>400000||!/^[A-Za-z0-9+/]+={0,2}$/.test(candidate.image))return false;
   try{const u=new URL(candidate.url);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&!/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)&&!/(?:^|\/)(?:search|search\.all|search\.tmall|catalogsearch|s)(?:\/|\.|$)/i.test(u.pathname)&&!['q','query','search','s'].some(k=>u.searchParams.has(k));}catch{return false;}
  }).slice(0,3);
 }
 function toAiResult(card){
  // Seller photographs belong in the UI. Base64 in a tool's text response
  // wastes tokens and can crowd earlier conversation out of the model context.
  return {query:queryOf(card.query),candidates:verifiedCandidates(card).map(c=>({name:String(c.name||'').slice(0,160),url:c.url,features:String(c.features||'').slice(0,350),matchType:c.matchType==='identifier_match'&&c.identityEvidence?'identifier_match':'visual_similar',identityEvidence:String(c.identityEvidence||'').slice(0,180),differences:(Array.isArray(c.differences)?c.differences:[]).slice(0,4).map(v=>String(v).slice(0,120))})),note:card.notice||'판매 사진을 비교한 후보입니다. 동일 상품으로 확정하지 마세요.'};
 }
 function render(item,card){
  const box=document.createElement('div');box.className='chat-shopping-card';box.dataset.card=JSON.stringify(card);
  if(card.kind==='map'){const b=document.createElement('button');b.className='chat-map secondary';b.textContent=card.label+' · 지도에서 확인';b.title=card.reason||'';b.onclick=()=>openPurchase(b,card.url);box.append(b);item.append(box);return box;}
  const query=queryOf(card.query);if(!query)return null;
  if(card.image){const photo=document.createElement('img');photo.src='data:image/jpeg;base64,'+card.image;photo.alt=card.label+' · 유사 상품 검색 기준 사진';box.append(photo);}
  const title=document.createElement('strong');title.textContent=card.label||query;box.append(title);
  const note=document.createElement('p');note.textContent=card.reason||'사진의 종류와 외형을 분석한 결과입니다. 상품명만으로 동일 모델을 확정하지 않습니다.';box.append(note);
  const candidates=verifiedCandidates(card);
  const status=document.createElement('p');status.className='purchase-status';status.setAttribute('role','status');
  status.textContent=(card.candidates?.length&&!candidates.length)?'유효한 판매 사진과 상품 상세 링크를 확인하지 못했어요.':card.notice||(candidates.length?'판매 사진을 비교한 후보입니다. 모델과 옵션을 확인하세요.':card.comparisonStage==='searching'?'실제 판매 페이지와 사진을 찾고 있어요…':'아직 같은 상품의 판매 페이지가 확인되지 않았어요.');box.append(status);
  for(const candidate of candidates){
   const destination=new URL(candidate.url);
   const row=document.createElement('div');row.className='chat-sale-candidate';
   const photo=document.createElement('img');photo.src='data:image/jpeg;base64,'+candidate.image;photo.alt=candidate.name+' · 실제 판매 사진';row.append(photo);
   const detail=document.createElement('div'),name=document.createElement('strong');name.textContent=candidate.name;detail.append(name);
   const evidence=document.createElement('p');const identified=candidate.matchType==='identifier_match'&&candidate.identityEvidence;
   evidence.textContent=(identified?'모델 식별자 일치 · '+candidate.identityEvidence:'외형이 비슷한 후보 · 동일 모델 미확인')+' · '+destination.hostname;detail.append(evidence);
   const features=document.createElement('p');features.textContent=candidate.features||'';detail.append(features);
   if(candidate.differences?.length){const different=document.createElement('p');different.textContent='다른 점: '+candidate.differences.join(' · ');detail.append(different);}
   const a=document.createElement('button');a.className='chat-map secondary candidate-link';a.textContent='판매 페이지 열기 ↗';a.onclick=()=>openPurchase(a,candidate.url);detail.append(a);row.append(detail);box.append(row);
  }
  const actions=document.createElement('div');actions.className='chat-shopping-actions';
  const manual=document.createElement('details');manual.className='manual-shopping-search';const providerTitle=document.createElement('summary');providerTitle.className='chat-provider-title';providerTitle.textContent='키워드로 직접 검색 · 동일 상품 미확인';manual.append(providerTitle);
  const explanation=document.createElement('p');explanation.textContent='아래 버튼은 상품명으로 검색만 합니다. 해당 상품의 판매 페이지를 찾은 결과가 아닙니다.';manual.append(explanation);
  const providerGrid=document.createElement('div');providerGrid.className='chat-provider-grid';
  for(const provider of window.cleanTouchShoppingProviders.providers(query)){const shopping=document.createElement('button');shopping.className=provider.id==='naver'?'chat-map primary':'chat-map secondary';shopping.textContent=provider.label;shopping.onclick=()=>openPurchase(shopping,provider.url);providerGrid.append(shopping);}
  manual.append(providerGrid);
  if(card.image){const lens=document.createElement('button');lens.className='chat-map secondary';lens.textContent='사진으로 같은 상품 찾기 · Google Lens';lens.onclick=async()=>{lens.disabled=true;try{const blob=toBlob(card.image);await bridge.searchVisual(new Uint8Array(await blob.arrayBuffer()));}catch(error){document.getElementById('chat-error').textContent=error.message;}finally{lens.disabled=false;}};actions.append(lens);}
  actions.append(manual);
  box.append(actions);item.append(box);return box;
 }
 window.cleanTouchShopping={queryOf,crop,render,toBlob,toAiResult};
})();
