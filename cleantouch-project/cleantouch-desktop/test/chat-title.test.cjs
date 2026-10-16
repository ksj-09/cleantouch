const test=require('node:test'),assert=require('node:assert/strict'),title=require('../chat-title.js');
test('a generated topic title is separated from the answer even when the marker streams in pieces',()=>{
 const raw='설명을 도와드릴게요.\n<cleantouch-title>화면 속 앱 알아보기</cleantouch-title>';
 for(let i=raw.indexOf('<');i<=raw.length;i++){const parsed=title.extract(raw.slice(0,i));assert(!parsed.answer.includes('cleantouch'));}
 assert.deepEqual(title.extract(raw),{answer:'설명을 도와드릴게요.',title:'화면 속 앱 알아보기'});
 assert.equal(title.extract('일반 답변입니다.').answer,'일반 답변입니다.');
});
test('malformed titles do not become saved headings and formatting never replaces the question',()=>{
 assert.equal(title.extract('답변<cleantouch-title>'+('가'.repeat(29))+'</cleantouch-title>').title,'');
 assert.equal(title.extract('답변<cleantouch-title>여러\n줄</cleantouch-title>').title,'');
 const question=title.question('이게 뭐야',{photo:true,summarize:true});assert(question.startsWith('이게 뭐야'));assert(question.includes('이번에 사용자가 선택한 사진'));assert(question.includes('첫 질문을 그대로 복사하지 말고'));
 assert.equal(title.question('그다음은?',{}),'그다음은?');
});
test('fallback headings describe conversations without copying their first message',()=>{
 assert.equal(title.fallback([{role:'user',text:'ㅎㅇ'}]),'가벼운 대화');
 assert.equal(title.fallback([{role:'user',text:'이게 뭐야',image:'/9j/'}]),'선택 사진 설명');
 const a=title.fallback([{role:'user',text:'여행 준비물 알려줘'}]),b=title.fallback([{role:'user',text:'친구랑 갈 캠핑 장비 추천해줘'}]);assert.notEqual(a,b);assert(!a.includes('궁금한 내용'));
 assert.equal(title.extract('답변<cleantouch-title>궁금한 내용 알아보기</cleantouch-title>').title,'');
 assert.equal(title.fallback([{role:'model',cards:[{label:'보라색 가방'}]}]),'보라색 가방 살펴보기');
});
