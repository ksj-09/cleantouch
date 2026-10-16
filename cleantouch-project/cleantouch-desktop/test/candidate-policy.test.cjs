const {test}=require('node:test'),assert=require('node:assert/strict');
const p=require('../candidate-policy'),{categories,selectLabel}=require('../ai-categories');
test('different names require strong visual evidence and preserve separate objects',()=>{
 const a={label:'반바지',box:[.1,.2,.4,.8]},b={label:'운동용 반바지',box:[.12,.22,.42,.82]};
 assert.equal(p.duplicate(a,b,.98,true),true);
 assert.equal(p.duplicate(a,{...b,box:[.6,.2,.9,.8]},.99,true),false);
 assert.equal(p.duplicate(a,b,.8,false),false);
 assert.equal(p.duplicate({label:'운동화'},{label:'흰색 운동화'},.98,false),true);
});
test('open vocabulary and uncertain local labels cannot reject a verified AI product',()=>{
 assert.equal(p.conflictsWithTarget('흰색 티셔츠',{category:'unknown',label:'상품 후보',uncertain:true}),false);
 assert.equal(p.conflictsWithTarget('커피 드리퍼',{category:'shirt',label:'티셔츠',uncertain:false}),false);
 assert.equal(p.conflictsWithTarget('흰색 티셔츠',{category:'shoe',label:'운동화',uncertain:true}),false);
 assert.equal(p.conflictsWithTarget('흰색 티셔츠',{category:'shoe',label:'운동화',uncertain:false}),true);
});
test('lighting colour changes merge strongly matching shorts and drop conflicting colour from the name',()=>{const a={label:'회색 반바지',box:[.1,.2,.4,.9]},b={label:'검은색 반바지',box:a.box};assert.equal(p.duplicate(a,b,.96,true),true);assert.equal(p.duplicate(a,b,.98,false),true);assert.equal(p.reconcileLabel(a.label,b.label),'반바지');assert.equal(p.duplicate(a,{...b,box:[.6,.2,.9,.9]},.99,true),false);assert.equal(p.duplicate(a,{...b,label:'검은색 청바지'},.99,false),false);assert.equal(p.duplicate(a,b,.8,false),false);});
test('yellow and pink swords never merge with red swords',()=>{const a={label:'노란색 광선검',box:[.1,.1,.3,.8]};assert.equal(p.duplicate(a,{label:'빨간색 광선검',box:a.box},.99,false),false);assert.equal(p.duplicate(a,{label:'분홍색 광선검',box:a.box},.99,false),false);});
test('continuous motion merges a matching product but distinct positions in one frame remain separate',()=>{const a={label:'파란색 광선검',box:[.1,.1,.3,.8]},b={label:a.label,box:[.25,.1,.45,.8]};assert.equal(p.trackDuplicate(a,b,.92,1000,false),true);assert.equal(p.trackDuplicate(a,b,.92,1000,true),false);assert.equal(p.trackDuplicate(a,b,.92,10000,false),false);assert.equal(p.trackDuplicate(a,b,.7,1000,false),false);});
test('a selected SUV cannot become a lightsaber purchase',()=>{
 assert.equal(p.targetMatches('흰색 SUV','분홍색 광선검'),false);
 assert.equal(p.targetMatches('흰색 SUV','흰색 자동차'),true);
});
test('overlapping shirt crops merge but adjacent people do not',()=>{
 const a={label:'흰색 긴팔 티셔츠',box:[.1,.1,.5,.9]};
 assert.equal(p.duplicate(a,{label:a.label,box:[.3,.1,.6,.9]},.9,true),true);
 assert.equal(p.duplicate(a,{label:a.label,box:[.6,.1,.9,.9]},.99,true),false);
});
test('background winning or almost tied never receives a product noun',()=>{
 for(const background of [.26,.239]){const s=categories.map(([id])=>id==='background'?background:id==='keyboard'?.24:.1);assert.equal(selectLabel(s).category,'unknown');}
});
test('insufficient crops and background labels are rejected, real labels retained',()=>{
 assert.equal(p.quality(12,300),false);assert.equal(p.quality(48,120),true);
 assert.equal(p.quality(46,35,32),true);assert.equal(p.quality(12,46,32),false);
 for(const label of ['벽','창틀','글자','종류 미확인'])assert.equal(p.productLabel(label),false);
 assert.equal(p.productLabel('창문형 에어컨'),true);assert.equal(p.productLabel('보라색 광선검'),true);
});
test('conflicting visual families do not agree',()=>{
 assert.equal(p.agrees({category:'keyboard'},{category:'lightsaber'}),false);
 assert.equal(p.agrees({category:'jeans'},{category:'pants'}),true);
});
test('repeated swords merge without merging different colours or separate objects',()=>{
 const a={label:'빨간색 광선검',box:[.1,.1,.3,.8]};
 assert.equal(p.duplicate(a,{label:'광선검',box:[.11,.12,.31,.81]},.9,false),true);
 assert.equal(p.duplicate(a,{label:'파란색 광선검',box:a.box},.99,false),false);
 assert.equal(p.duplicate(a,{label:a.label,box:[.7,.1,.9,.8]},.99,true),false);
});

test('same coloured moving swords merge across distant crops but not separate objects in one scene',()=>{const a={label:'빨간색 광선검',box:[.1,.1,.3,.8]},b={label:a.label,box:[.6,.2,.9,.9]};assert.equal(p.duplicate(a,b,.9,false),true);assert.equal(p.duplicate(a,b,.9,true),false);assert.equal(p.duplicate(a,b,.7,false),false);assert.equal(p.duplicate(a,{...b,label:'초록색 광선검'},.99,false),false);});
test('shoe and cutting-board boxes must agree with the crop rather than a nearby blade or street',()=>{
 assert.equal(p.targetMatches('운동화','광선검'),false);
 assert.equal(p.targetMatches('흰색 운동화','흰색 스니커즈'),true);
 assert.equal(p.targetMatches('우드 도마','길거리 바닥'),false);
});
test('smooth blurry gradients fail while detailed images retain evidence',()=>{
 const w=48,h=48,pixels=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=x*5;pixels[i+3]=255;}
 assert.equal(p.usableRaster(p.rasterQuality(pixels,w,h)),false);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=(x+y)%2?220:30;}
 assert.equal(p.usableRaster(p.rasterQuality(pixels,w,h)),true);
});
test('green naming variants represent the same blade',()=>{const a={label:'녹색 광선검',box:[.1,.1,.3,.8]},b={label:'초록색 광선검',box:[.6,.2,.9,.9]};assert.equal(p.duplicate(a,b,.9,false),true);assert.equal(p.duplicate(a,{...b,label:'파란색 광선검'},.99,false),false);});
