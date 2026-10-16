(function(root){
 const identity=root.productIdentity||(typeof require==='function'?require('./product-identity'):null);
 function family(category){
  if(String(category).includes('lightsaber'))return 'lightsaber';
  if(['pants','jeans','shorts'].includes(category))return 'pants';
  if(['handbag','backpack','suitcase'].includes(category))return 'bag';
  if(['shirt','tshirt'].includes(category))return 'shirt';
  return category;
 }
 function quality(width,height,minimumLongEdge=48){return Number.isFinite(width)&&Number.isFinite(height)&&Math.min(width,height)>=24&&Math.max(width,height)>=minimumLongEdge;}
 function agrees(a,b){return a?.category!=='unknown'&&b?.category!=='unknown'&&family(a?.category)===family(b?.category);}
 function productLabel(label){return typeof label==='string'&&label.trim().length>0&&!/^(종류 미확인|상품 후보|배경|벽|창틀|창문|자막|글자|텍스트|사람|얼굴|손|팔|다리)$/.test(label.trim());}
 function garmentKey(label){
  if(!/반바지|바지|청바지|팬츠|티셔츠|셔츠|재킷|코트|후드티|니트|원피스|치마/.test(label))return '';
  return identity.identityKey(label).replace(/검은색|검은|검정|블랙|회색|그레이|하양|흰색|하얀|보라|빨강|파랑|초록|노랑|분홍|주황|네이비|남색|베이지|아이보리|갈색|브라운/g,'').replace(/\s+/g,' ').trim();
 }
 function reconcileLabel(a,b){const x=garmentKey(a),y=garmentKey(b);return x&&x===y&&identity.identityKey(a)!==identity.identityKey(b)?x:a;}
 function duplicate(a,b,similarity,sameFrame){
  const keyA=identity?.identityKey(a.label),keyB=identity?.identityKey(b.label);
  if(!keyA||!keyB)return false;
  const sword=keyA.includes('광선검')&&keyB.includes('광선검');
  const colours=['보라','빨강','파랑','초록','하양','검정','노랑','분홍','주황'];
  const ca=colours.find(c=>keyA.includes(c)),cb=colours.find(c=>keyB.includes(c));
  if(sword&&ca&&cb&&ca!==cb)return false;
  const garment=garmentKey(a.label)&&garmentKey(a.label)===garmentKey(b.label);
  const semanticFamily=labelFamily(a.label),sameFamily=semanticFamily&&semanticFamily===labelFamily(b.label)&&!['sword','background'].includes(semanticFamily);
  // Different names require both visual evidence and a matching kind of object.
  const cut=label=>/반바지/.test(label)?'shorts':/청바지/.test(label)?'jeans':/긴팔/.test(label)?'longSleeve':/반팔/.test(label)?'shortSleeve':'';
  const cutA=cut(a.label),cutB=cut(b.label);
  const semantic=sameFamily&&similarity>=.95&&!(cutA&&cutB&&cutA!==cutB);
  if(keyA!==keyB&&!(sword&&(!ca||!cb))&&!garment&&!semantic)return false;
  if(garment&&keyA!==keyB&&similarity<.92)return false;
  const x=a.box,y=b.box;
  // A coloured blade changes its crop drastically with motion; keep the colour guard above.
  if(!sameFrame&&similarity>=(sword&&ca&&ca===cb?.88:garment&&keyA!==keyB?.97:semantic?.97:.94))return true;
  if(!Array.isArray(x)||!Array.isArray(y))return false;
  const areaX=(x[2]-x[0])*(x[3]-x[1]),areaY=(y[2]-y[0])*(y[3]-y[1]);
  if(areaX<=0||areaY<=0)return false;
  const overlap=Math.max(0,Math.min(x[2],y[2])-Math.max(x[0],y[0]))*Math.max(0,Math.min(x[3],y[3])-Math.max(x[1],y[1]));
  return (sameFrame||similarity>=.86)&&overlap/Math.min(areaX,areaY)>(sameFrame?.45:.65);
 }
 function trackDuplicate(a,b,similarity,gap,sameFrame){
  if(sameFrame||!Number.isFinite(gap)||gap<=0||gap>2200||similarity<.9||identity?.identityKey(a.label)!==identity?.identityKey(b.label))return false;
  const x=a.box,y=b.box;if(!Array.isArray(x)||!Array.isArray(y))return false;
  const areaX=(x[2]-x[0])*(x[3]-x[1]),areaY=(y[2]-y[0])*(y[3]-y[1]);
  return areaX>0&&areaY>0&&Math.min(areaX,areaY)/Math.max(areaX,areaY)>.45&&Math.hypot((x[0]+x[2]-y[0]-y[2])/2,(x[1]+x[3]-y[1]-y[3])/2)<.35;
 }
 function labelFamily(label){
  if(/광선검|라이트세이버/.test(label))return 'sword';
  if(/SUV|자동차|승용차|차량|트럭|버스/i.test(label))return 'car';
  if(/티셔츠|셔츠|상의|맨투맨/.test(label))return 'shirt';
  if(/가방|백팩|숄더백|호보백/.test(label))return 'bag';
  if(/바지|청바지|팬츠/.test(label))return 'pants';
  if(/운동화|신발|스니커즈|구두|부츠|샌들|슬리퍼/.test(label))return 'shoe';
  if(/도마/.test(label))return 'board';
  if(/바닥|도로|길거리|벽|배경/.test(label))return 'background';
  return '';
 }
 function targetMatches(target,label){const a=labelFamily(target),b=labelFamily(label);return !a||(a===b);}
 function conflictsWithTarget(target,classification){
  // Closed-set local labels cannot disprove a product outside their vocabulary.
  const a=labelFamily(target),b=labelFamily(classification?.label);
  return Boolean(a&&b&&a!==b&&classification?.category!=='unknown'&&!classification?.uncertain);
 }
 function rasterQuality(pixels,width,height){
  let sum=0,squared=0,edges=0,count=0;
  const luma=(x,y)=>{const i=(y*width+x)*4;return pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114;};
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
   const v=luma(x,y);sum+=v;squared+=v*v;count++;
   edges+=Math.abs(4*v-luma(x-1,y)-luma(x+1,y)-luma(x,y-1)-luma(x,y+1));
  }
  if(!count)return {detail:0,contrast:0};
  return {detail:edges/count,contrast:Math.sqrt(Math.max(0,squared/count-(sum/count)**2))};
 }
 function usableRaster(q){return Number.isFinite(q?.detail)&&Number.isFinite(q?.contrast)&&q.detail>=2&&q.contrast>=12;}
 function colourGroup(label){
  const key=identity.identityKey(label);
  if(!key.includes('광선검'))return '';
  const colour=['보라','빨강','파랑','초록','하양','검정','노랑','분홍','주황'].find(c=>key.includes(c));
  return colour?'lightsaber:'+colour:'';
 }
 function representativeScore(q,whole){
  if(!usableRaster(q))return 0;
  const shortEdge=Math.min(q.width,q.height),longEdge=Math.max(q.width,q.height);
  const coverage=(.4+.6*Math.min(1,shortEdge/96))*(.4+.6*Math.min(1,shortEdge/longEdge*5));
  return q.detail*Math.log2(2+q.width*q.height)*Math.min(2,q.contrast/32)*coverage*(whole?1.5:1);
 }
 const api={family,quality,agrees,productLabel,duplicate,trackDuplicate,targetMatches,conflictsWithTarget,reconcileLabel,rasterQuality,usableRaster,colourGroup,representativeScore};if(typeof module!=='undefined')module.exports=api;else root.candidatePolicy=api;
})(globalThis);
