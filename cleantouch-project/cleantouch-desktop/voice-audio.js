(function(root){
 function wav(chunks,inputRate){
  if(!Number.isFinite(inputRate)||inputRate<8000||inputRate>192000)throw Error('마이크 샘플 속도를 확인할 수 없어요.');
  const total=chunks.reduce((n,c)=>n+c.length,0),source=new Float32Array(total);let offset=0;
  for(const chunk of chunks){source.set(chunk,offset);offset+=chunk.length;}
  const length=Math.min(480000,Math.floor(total*16000/inputRate)),bytes=new Uint8Array(44+length*2),view=new DataView(bytes.buffer);
  const text=(at,value)=>{for(let n=0;n<value.length;n++)bytes[at+n]=value.charCodeAt(n);};
  text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
  // Average each source interval before reducing the rate, retaining quiet
  // speech while avoiding sample-dropping aliasing.
  for(let i=0;i<length;i++){const start=Math.floor(i*inputRate/16000),end=Math.max(start+1,Math.floor((i+1)*inputRate/16000));let sum=0,count=0;for(let j=start;j<Math.min(total,end);j++){sum+=Number.isFinite(source[j])?source[j]:0;count++;}const sample=Math.max(-1,Math.min(1,sum/Math.max(1,count)));view.setInt16(44+i*2,Math.round(sample*(sample<0?32768:32767)),true);}
  return bytes;
 }
 function base64(bytes){let binary='';for(let n=0;n<bytes.length;n+=8192)binary+=String.fromCharCode(...bytes.subarray(n,n+8192));return btoa(binary);}
 const api={wav,base64};if(typeof module!=='undefined')module.exports=api;else root.cleanTouchVoiceAudio=api;
})(globalThis);
