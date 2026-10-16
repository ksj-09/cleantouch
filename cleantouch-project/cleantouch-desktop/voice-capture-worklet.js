class CleanTouchMicrophone extends AudioWorkletProcessor{
 constructor(){super();this.buffer=new Float32Array(2048);this.used=0;this.active=true;this.port.onmessage=event=>{if(event.data?.type==='stop'){this.flush();this.active=false;this.port.postMessage({type:'stopped'});}};}
 flush(){if(!this.used)return;const samples=this.buffer.slice(0,this.used);this.port.postMessage({type:'samples',samples},[samples.buffer]);this.used=0;}
 process(inputs,outputs){for(const channel of outputs[0]||[])channel.fill(0);if(!this.active)return false;const samples=inputs[0]?.[0];if(samples)for(const sample of samples){this.buffer[this.used++]=sample;if(this.used===this.buffer.length)this.flush();}return true;}
}
registerProcessor('cleantouch-microphone',CleanTouchMicrophone);
