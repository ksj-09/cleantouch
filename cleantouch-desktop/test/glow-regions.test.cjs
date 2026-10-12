const {test}=require('node:test');const assert=require('node:assert/strict');
const {findGlowRegions}=require('../glow-regions');
test('locates distinct red and green glowing shafts without treating white browser background as a prop',()=>{
  const width=160,height=120,pixels=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++)pixels[i*4+3]=255;
  function paint(left,top,right,bottom,r,g,b){for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const i=(y*width+x)*4;pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;}}
  paint(0,0,160,35,255,255,255);paint(30,45,35,105,255,20,20);paint(90,40,95,105,20,255,20);
  const regions=findGlowRegions(pixels,width,height);
  assert.equal(regions.length,2);assert(regions.some(r=>r.color==='red'));assert(regions.some(r=>r.color==='green'));
});
test('colored round buttons are not glowing product shafts',()=>{
  const width=100,height=100,pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;pixels[i+3]=255;if((x-50)**2+(y-50)**2<12**2)pixels[i]=255;}
  assert.equal(findGlowRegions(pixels,width,height).length,0);
});
test('narrow bright window edges never become glowing prop candidates',()=>{
  const width=100,height=120,pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;pixels[i+3]=255;if(x>=40&&x<45&&y>10&&y<105)pixels[i]=pixels[i+1]=pixels[i+2]=245;}
  assert.equal(findGlowRegions(pixels,width,height).length,0);
});
