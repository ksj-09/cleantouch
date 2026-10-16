(function(root){
 function clean(values){return (Array.isArray(values)?values:[]).filter(m=>m&&!m.failed&&['user','model'].includes(m.role)&&typeof m.text==='string'&&m.text.trim()&&!/^(공유한 현재 장면|선택한 상품|업로드한 사진)$/.test(m.text.trim())).map(m=>({role:m.role,text:m.text.trim().slice(0,m.role==='user'?1500:1000)}));}
 function merge(saved,visible){const previous=clean(saved),next=clean(visible);let overlapEnd=0;
  search:for(let length=Math.min(previous.length,next.length);length>0;length--)for(let end=length;end<=next.length;end++){let same=true;for(let i=0;i<length;i++){const a=previous[previous.length-length+i],b=next[end-length+i];if(a.role!==b.role||a.text!==b.text){same=false;break;}}if(same){overlapEnd=end;break search;}}
  const values=[...previous,...next.slice(overlapEnd)];return values.length<=160?values:[...values.slice(0,32),...values.slice(-128)];
 }
 function memo(values,question='',limit=16000){
  const all=clean(values);if(all.at(-1)?.role==='user'&&all.at(-1).text===question.trim())all.pop();if(!all.length)return '';
  const words=new Set((question.match(/[가-힣A-Za-z0-9]{2,}/g)||[]).filter(w=>w.length>2));
  const selected=new Set();let used=0;const scores=all.map((m,i)=>({i,score:(i<12?5:0)+(i>=all.length-20?8:0)+(m.role==='user'?3:0)+([...words].some(w=>m.text.includes(w))?15:0)+(/기억|예산|선호|이름|조건|원하는|말고|아니|정정|바꿔|budget|prefer|remember/i.test(m.text)?6:0)})).sort((a,b)=>b.score-a.score||b.i-a.i);
  const header='[이 대화의 참고 기록 · 현재 화면이 아닙니다]\n아래는 같은 대화에서 실제로 주고받은 발화입니다. 이전 조건과 대상을 먼저 참고하세요. 최근 사용자의 정정이 이전 조건보다 우선하며 AI가 추정한 내용은 확인된 사실로 단정하지 마세요. 이미 말한 이름·예산·대상을 다시 묻지 마세요. 기록에 없는 사실은 만들지 마세요. 최신 질문에 직접 답하세요.\n';
  const budget=Math.max(0,limit-header.length);for(const {i} of scores){const size=JSON.stringify(all[i]).length+2;if(used+size<=budget){selected.add(i);used+=size;}}
  const chosen=all.filter((_m,i)=>selected.has(i));return chosen.length?header+JSON.stringify(chosen):'';
 }
 const api={clean,merge,memo};if(typeof module==='object'&&module.exports)module.exports=api;else root.cleanTouchConversationContext=api;
})(globalThis);
