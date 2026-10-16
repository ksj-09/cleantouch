(function(root){
 const RATE=4000,SIZE=RATE*40;
 function downsample(samples,rate){const count=Math.floor(samples.length*RATE/rate),out=new Float32Array(count);for(let i=0;i<count;i++){const begin=Math.floor(i*rate/RATE),end=Math.min(samples.length,Math.max(begin+1,Math.floor((i+1)*rate/RATE)));let sum=0;for(let j=begin;j<end;j++)sum+=samples[j];out[i]=sum/(end-begin);}return out;}
 class EchoGuard{
  constructor(){this.values=new Float32Array(SIZE);this.stamps=new Float64Array(SIZE);}
  clear(){this.values.fill(0);this.stamps.fill(0);}
  reference(samples,rate,startMs){const data=downsample(samples,rate),first=Math.floor(startMs*RATE/1000);for(let i=0;i<data.length;i++){const index=first+i,slot=((index%SIZE)+SIZE)%SIZE;this.values[slot]=data[i];this.stamps[slot]=index+1;}}
  isEcho(samples,rate,endMs){
   const data=downsample(samples,rate);if(data.length<32)return false;const first=Math.floor(endMs*RATE/1000)-data.length;let sum=0,power=0;for(const v of data){sum+=v;power+=v*v;}if(power/data.length<.000016)return false;const variance=power-sum*sum/data.length;if(variance<1e-7)return false;
   const score=delay=>{let sy=0,yy=0,xy=0;for(let i=0;i<data.length;i++){const index=first+i-delay,slot=((index%SIZE)+SIZE)%SIZE;if(this.stamps[slot]!==index+1)return 0;const y=this.values[slot];sy+=y;yy+=y*y;xy+=data[i]*y;}if(yy<1e-7||power>yy*3)return 0;const vy=yy-sy*sy/data.length;if(vy<1e-7)return 0;return Math.abs((xy-sum*sy/data.length)/Math.sqrt(variance*vy));};
   let best=0,lag=0;for(let delay=0;delay<=RATE*.4;delay+=4){const value=score(delay);if(value>best){best=value;lag=delay;}}for(let delay=Math.max(0,lag-3);delay<=lag+3;delay++)best=Math.max(best,score(delay));return best>=.9;
  }
 }
 const api={EchoGuard};if(typeof module!=='undefined')module.exports=api;else root.cleanTouchVoiceEcho=api;
})(globalThis);
