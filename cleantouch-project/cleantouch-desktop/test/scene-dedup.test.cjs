const {test}=require('node:test'),assert=require('node:assert/strict');
const {same}=require('../scene-dedup');
function scene(value=100){const pixels=new Uint8ClampedArray(96*96*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=pixels[i+1]=pixels[i+2]=value;pixels[i+3]=255;}return {pixels,aspect:9/16};}
test('small encoding noise is duplicate, not another analysis request',()=>{const a=scene(),b=scene(101);assert(same(a,b));});
test('localized new products and small coloured objects are retained',()=>{
 const a=scene(),b=scene();for(let y=40;y<48;y++)for(let x=40;x<48;x++)b.pixels[(y*96+x)*4]=240;assert(!same(a,b));
 const c=scene();for(let y=15;y<80;y++){c.pixels[(y*96+50)*4]=0;c.pixels[(y*96+50)*4+1]=240;}assert(!same(a,c));
});
test('gradual changes are compared to the saved image and cannot drift forever',()=>{assert(same(scene(),scene(101)));assert(!same(scene(),scene(103)));});
test('geometry changes and unavailable signatures are never suppressed',()=>{assert(!same(scene(),{...scene(),aspect:16/9}));assert(!same(null,scene()));});
