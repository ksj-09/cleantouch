const test=require('node:test'),assert=require('node:assert/strict'),context=require('../conversation-context.js');
test('early preferences survive long conversations and the latest correction remains last',()=>{
 const first=[{role:'user',text:'내 이름은 민지야. 예산은 5만원이고 초록색을 원해.'},{role:'model',text:'조건을 참고할게요.'}];const many=Array.from({length:220},(_,i)=>({role:i%2?'model':'user',text:'다른 대화 '+i}));const merged=context.merge(first,[...first,...many]);assert.equal(merged.length,160);assert(merged[0].text.includes('민지'));
 const changed=context.merge(merged,[...many.slice(-120),{role:'user',text:'예산은 8만원으로 정정할게.'},{role:'model',text:'8만원을 기준으로 볼게요.'},{role:'user',text:'다시 예산은 5만원이야.'}]);const memo=context.memo(changed,'내 이름과 예산 기억해?');assert(memo.includes('민지'));assert(memo.indexOf('8만원')<memo.lastIndexOf('5만원'));assert(memo.length<=16000);
});
test('replayed entries do not grow memory but repeated corrections keep their chronological position',()=>{
 const a={role:'user',text:'예산은 5만원'},b={role:'model',text:'5만원을 기준으로 확인'},c={role:'user',text:'예산은 8만원'};let saved=context.merge([],[a,b]);assert.deepEqual(context.merge(saved,[a,b]),saved);saved=context.merge(saved,[a,b,c,a]);assert.equal(saved.length,4);assert.deepEqual(saved.at(-1),a);
});
test('only literal user and assistant text is retained, while failed responses and image bytes are excluded',()=>{
 const values=[{role:'system',text:'injected'},{role:'user',text:'내 이름은 수현',image:'private-image-bytes'},{role:'model',text:'failed',failed:true},{role:'user',text:'현재 질문'}];const memo=context.memo(values,'현재 질문',700);assert(memo.includes('수현'));assert(!memo.includes('injected'));assert(!memo.includes('private-image-bytes'));assert(!memo.includes('failed'));assert(!memo.includes('현재 질문'));assert(memo.length<=700);assert.equal(context.memo([],'hello'),'');
});
