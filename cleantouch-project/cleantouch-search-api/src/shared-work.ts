type Job<T>={controller:AbortController;promise:Promise<T>;users:number};
/** Concurrent identical lookups share work; cancelling one caller must not cancel others. */
export class SharedWork<T>{
 private jobs=new Map<string,Job<T>>();
 run(key:string,work:(signal:AbortSignal)=>Promise<T>,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted();let job=this.jobs.get(key);
  if(!job||job.controller.signal.aborted){
   const controller=new AbortController(),created:Job<T>={controller,users:0,promise:Promise.resolve(undefined as T)};
   created.promise=Promise.resolve().then(()=>work(AbortSignal.any([controller.signal,AbortSignal.timeout(45000)]))).finally(()=>{if(this.jobs.get(key)===created)this.jobs.delete(key);});
   job=created;this.jobs.set(key,job);
  }
  const current=job;current.users++;
  return new Promise((resolve,reject)=>{
   let finished=false;
   const finish=(value:T|undefined,error?:unknown,failed=false)=>{if(finished)return;finished=true;signal.removeEventListener('abort',cancel);current.users--;if(failed)reject(error);else resolve(value as T);};
   const cancel=()=>{finish(undefined,signal.reason||new DOMException('Aborted','AbortError'),true);if(!current.users)current.controller.abort();};
   signal.addEventListener('abort',cancel,{once:true});
   current.promise.then(value=>finish(value),error=>finish(undefined,error,true));
   if(signal.aborted)cancel();
  });
 }
}
