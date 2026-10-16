(function(root){
 async function encode(blob,{maxEdge=1280,maxChars=550000,quality=.92}={}){
  const bitmap=await createImageBitmap(blob);
  try{
   let edge=maxEdge;
   while(edge>=160){
    const canvas=document.createElement('canvas'),scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    // Preserve detail through reasonable JPEG quality, then reduce dimensions.
    for(let q=quality;q>=.64;q-=.08){const data=canvas.toDataURL('image/jpeg',q).split(',')[1];if(data.length<=maxChars)return data;}
    edge=Math.floor(edge*.8);
   }
   throw Error('사진 용량을 줄이지 못했어요. 다른 사진을 선택해 주세요.');
  }finally{bitmap.close();}
 }
 root.cleanTouchImage={encode};
})(globalThis);
