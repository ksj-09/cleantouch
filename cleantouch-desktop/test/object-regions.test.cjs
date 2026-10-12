const {test}=require('node:test'),assert=require('node:assert/strict');
const {select}=require('../object-regions');
test('whole bag wins over a stronger clipped strap observation',()=>{
 const whole={left:10,top:10,right:110,bottom:210,category:'handbag',score:.6,fullFrame:true};
 const strap={left:20,top:10,right:70,bottom:130,category:'handbag',score:.95,clipped:true};
 assert.deepEqual(select([strap,whole]),[whole]);
});
test('separate adjacent products are retained',()=>{
 const a={left:0,top:0,right:100,bottom:100,category:'handbag',score:.7,fullFrame:true};
 const b={...a,left:80,right:180};assert.equal(select([a,b]).length,2);
});
test('complete tile detection is retained when there is no full-frame detection',()=>{
 const a={left:10,top:10,right:110,bottom:110,category:'handbag',score:.7};
 assert.deepEqual(select([a]),[a]);
});
