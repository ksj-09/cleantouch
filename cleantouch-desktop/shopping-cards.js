(()=>{
 const queryOf=value=>window.cleanTouchShoppingProviders?.clean(value)??(typeof value==='string'?value.replace(/[\u0000-\u001f]/g,'').trim().slice(0,60):'');
 const toBlob=image=>new Blob([Uint8Array.from(atob(image),c=>c.charCodeAt(0))],{type:'image/jpeg'});
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
 function render(item,card){
  const box=document.createElement('div');box.className='chat-shopping-card';box.dataset.card=JSON.stringify(card);
  if(card.kind==='map'){const b=document.createElement('button');b.className='chat-map secondary';b.textContent=card.label+' · 지도에서 확인';b.title=card.reason||'';b.onclick=()=>bridge.openLink(card.url);box.append(b);item.append(box);return box;}
  const query=queryOf(card.query);if(!query)return null;
  if(card.image){const photo=document.createElement('img');photo.src='data:image/jpeg;base64,'+card.image;photo.alt=card.label+' · 유사 상품 검색 기준 사진';box.append(photo);}
  const title=document.createElement('strong');title.textContent=card.label||query;box.append(title);
  const note=document.createElement('p');note.textContent=card.reason||'보이는 색·형태를 기준으로 찾습니다. 동일 상품인지는 판매 사진으로 확인하세요.';box.append(note);
  for(const candidate of card.candidates||[]){const a=document.createElement('button');a.className='chat-map secondary candidate-link';a.textContent=candidate.name+' ↗';a.title=candidate.features||candidate.sourceTitle||'';a.onclick=()=>bridge.openLink(candidate.url);box.append(a);}
  const actions=document.createElement('div');actions.className='chat-shopping-actions';
  const providerTitle=document.createElement('span');providerTitle.className='chat-provider-title';providerTitle.textContent='여러 쇼핑몰에서 비교';actions.append(providerTitle);
  const providerGrid=document.createElement('div');providerGrid.className='chat-provider-grid';
  for(const provider of window.cleanTouchShoppingProviders.providers(query)){const shopping=document.createElement('button');shopping.className=provider.id==='naver'?'chat-map primary':'chat-map secondary';shopping.textContent=provider.label;shopping.onclick=()=>bridge.openLink(provider.url);providerGrid.append(shopping);}
  actions.append(providerGrid);
  if(card.image){const lens=document.createElement('button');lens.className='chat-map secondary';lens.textContent='사진으로 비교 · Lens';lens.onclick=async()=>{lens.disabled=true;try{const blob=toBlob(card.image);await bridge.searchVisual(new Uint8Array(await blob.arrayBuffer()));}catch(error){document.getElementById('chat-error').textContent=error.message;}finally{lens.disabled=false;}};actions.append(lens);}
  box.append(actions);item.append(box);return box;
 }
 window.cleanTouchShopping={queryOf,crop,render,toBlob};
})();
