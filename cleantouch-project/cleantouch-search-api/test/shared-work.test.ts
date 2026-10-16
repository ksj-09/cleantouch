import test from 'node:test';import assert from 'node:assert/strict';
import {SharedWork} from '../src/shared-work.js';
test('concurrent requests share work without sharing individual cancellation',async()=>{
 const tasks=new SharedWork<number>(),one=new AbortController(),two=new AbortController();let calls=0,complete!:(value:number)=>void,shared!:AbortSignal;
 const work=(signal:AbortSignal)=>{calls++;shared=signal;return new Promise<number>(r=>{complete=r;});};
 const first=tasks.run('image-query',work,one.signal),second=tasks.run('image-query',work,two.signal);await Promise.resolve();
 const cancelled=assert.rejects(first);one.abort();await cancelled;assert.equal(shared.aborted,false);complete(42);assert.equal(await second,42);assert.equal(calls,1);
});
test('when every caller cancels, upstream stops and a later call can start fresh',async()=>{
 const tasks=new SharedWork<number>(),controller=new AbortController();let signal!:AbortSignal;
 const request=tasks.run('key',async s=>{signal=s;return new Promise((_r,reject)=>s.addEventListener('abort',()=>reject(s.reason),{once:true}));},controller.signal);await Promise.resolve();
 const rejected=assert.rejects(request);controller.abort();await rejected;assert(signal.aborted);
 assert.equal(await tasks.run('key',async()=>7,AbortSignal.timeout(1000)),7);
});
