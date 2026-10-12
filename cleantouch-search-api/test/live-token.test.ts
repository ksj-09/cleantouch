import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveToken,LIVE_MODEL,LIVE_SETUP} from '../src/live-token.js';

test('Live token locks continuous video, transcription, compression, and session resumption to the model',async()=>{
 let sent:any;
 const request:typeof fetch=async(_url,init)=>{sent=JSON.parse(String(init?.body));assert.equal(new Headers(init?.headers).get('x-goog-api-key'),'private-test-key');return new Response(JSON.stringify({name:'auth_tokens/temporary'}),{status:200});};
 const token=await createLiveToken(request,'private-test-key','',true);
 assert.equal(token.token,'auth_tokens/temporary');assert.equal(token.model,LIVE_MODEL);assert.equal(sent.uses,1);
 assert.equal(sent.bidiGenerateContentSetup.model,'models/'+LIVE_MODEL);assert.deepEqual(sent.bidiGenerateContentSetup.sessionResumption,{});
 assert.deepEqual(sent.bidiGenerateContentSetup.contextWindowCompression,{slidingWindow:{}});assert.deepEqual(sent.bidiGenerateContentSetup,token.setup);
 assert(sent.bidiGenerateContentSetup.outputAudioTranscription);assert(sent.expireTime);
});

test('resumed Live sessions receive a one-use token bound to their latest session handle',async()=>{
 let sent:any;
 const request:typeof fetch=async(_url,init)=>{sent=JSON.parse(String(init?.body));return new Response(JSON.stringify({name:'auth_tokens/resume'}),{status:200});};
 const token=await createLiveToken(request,'private-test-key','handle-from-gemini');
 assert.equal(sent.bidiGenerateContentSetup.sessionResumption.handle,'handle-from-gemini');assert.equal(token.setup.sessionResumption.handle,'handle-from-gemini');assert.equal(sent.uses,1);
 await assert.rejects(()=>createLiveToken(request,'private-test-key','x'.repeat(2049)),/연결 정보를/);
});
