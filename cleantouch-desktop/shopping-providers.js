(()=>{
 const clean=value=>String(value||'')
  .normalize('NFKC')
  .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ')
  .replace(/https?:\/\/\S+/gi,' ')
  .replace(/(?:이전|위|시스템|개발자)\s*(?:지시|명령).{0,60}(?:무시|따라|공개)/gi,' ')
  .replace(/\s+/g,' ').trim().slice(0,60);
 const providers=query=>{
  const q=clean(query),encoded=encodeURIComponent(q);
  if(!q)return [];
  return [
   {id:'naver',label:'네이버쇼핑',url:`https://search.shopping.naver.com/search/all?query=${encoded}`},
   {id:'coupang',label:'쿠팡',url:`https://www.coupang.com/np/search?q=${encoded}`},
   {id:'11st',label:'11번가',url:`https://search.11st.co.kr/Search.tmall?kwd=${encoded}`},
   {id:'gmarket',label:'G마켓',url:`https://browse.gmarket.co.kr/search?keyword=${encoded}`},
   {id:'google',label:'Google 쇼핑',url:`https://www.google.com/search?tbm=shop&q=${encoded}`},
  ];
 };
 window.cleanTouchShoppingProviders={clean,providers};
})();
