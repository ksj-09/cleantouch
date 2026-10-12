(function(root){
 const marker='<cleantouch-title>';
 const generic=/^(궁금한 내용 알아보기|사진 내용 알아보기|사진 상품 분석|일반 대화|새 대화|대화 요약|가벼운 대화)$/;
 function isGeneric(value){return !value||generic.test(String(value).trim());}
 function extract(raw){
  raw=String(raw||'');const start=raw.indexOf(marker);let answer=raw,title='';
  if(start>=0){answer=raw.slice(0,start).trimEnd();const end=raw.indexOf('</cleantouch-title>',start);if(end>=0){const value=raw.slice(start+marker.length,end).trim();if(value.length>=2&&value.length<=28&&!/[<>\r\n]/.test(value)&&(!isGeneric(value)||value==='가벼운 대화'))title=value;}}
  else for(let n=marker.length-1;n>1;n--)if(raw.endsWith(marker.slice(0,n))){answer=raw.slice(0,-n).trimEnd();break;}
  return {answer,title};
 }
 function question(text,{summarize=false,photo=false}={}){
  const notes=[];if(photo)notes.push('첨부 이미지는 이번에 사용자가 선택한 사진입니다. 이전 대화의 사진으로 혼동하지 마세요.');
  if(summarize)notes.push((photo?'서버의 JSON 응답 형식을 유지하고 answer 문자열 안의 마지막 줄에만 ':'답변을 먼저 작성한 뒤 마지막 줄에 ')+'대화 목록용 짧은 한국어 제목을 <cleantouch-title>제목</cleantouch-title> 형식으로 덧붙이세요. 제목은 질문과 답변의 주제를 2~6단어, 28자 이내로 요약하세요. 첫 질문을 그대로 복사하지 말고, 인사뿐이면 가벼운 대화로 정하세요. 별도의 설명이나 질문은 붙이지 마세요.');
  return String(text)+(notes.length?'\n\n[앱 표시 형식 안내]\n'+notes.join('\n'):'');
 }
 function fallback(messages){
  const meaningful=messages.filter(m=>m.role==='user'&&m.text&&!/^(공유한 현재 장면|선택한 상품|업로드한 사진)$/.test(m.text));
  const relevant=meaningful.find(m=>!/^(ㅎㅇ|하이|안녕(?:하세요)?|hello|hi|hey)[!?.\s]*$/i.test(m.text.trim()));
  const card=messages.flatMap(m=>m.cards||[]).find(c=>c.label||c.query);if(card)return String(card.label||card.query).slice(0,24)+' 살펴보기';
  if(!relevant&&meaningful.length)return '가벼운 대화';
  const stop=new Set(['이게뭐야','이거','저거','그거','이것','저것','그것','뭐야','무엇','어떤','어떻게','왜','그냥','조금','지금','현재','해당','사진','화면','영상','내용','알려줘','설명해줘','찾아줘','가능','있어요','있습니다','아니요','안녕하세요','사용자','사용자가','제가','저는','나는','나랑','그리고','하지만','그래서','위해서','통해','대한','대해','함께','먼저','있으면','있다면','질문','질문을','답변','답변을','선택한','업로드한','공유한']);
  stop.add('이게');stop.add('저게');stop.add('그게');
  function words(text){return (String(text||'').match(/[가-힣A-Za-z0-9][가-힣A-Za-z0-9+.-]*/g)||[]).map(w=>w.replace(/(에서는|에서도|에서|으로|처럼|에게|하고|에는|이랑|을|를|은|는|이|가)$/,'')).filter(w=>w.length>1&&!stop.has(w)&&!/^(도와|궁금|확인|물어|말씀|드릴|주세요|보이|알아|할까|할까요|있을|싶어|입니다)/.test(w));}
  const user=meaningful.flatMap(m=>words(m.text)),assistant=messages.filter(m=>m.role==='model'&&!m.failed).flatMap(m=>words(m.text));
  const candidates=[...new Set(user.length?user:assistant)].slice(0,4);let topic=candidates.join(' ');while(topic.length>22&&candidates.length>1){candidates.pop();topic=candidates.join(' ');}if(topic)return topic.slice(0,22)+' 이야기';
  return messages.some(m=>m.image)?'선택 사진 설명':'인사 나누기';
 }
 const api={extract,question,fallback,isGeneric};if(typeof module==='object'&&module.exports)module.exports=api;else root.cleanTouchChatTitle=api;
})(globalThis);
