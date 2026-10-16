import test from 'node:test';import assert from 'node:assert/strict';import {evaluateProducts} from '../src/product-evaluation.js';
import {evaluateIdentifications} from '../src/product-evaluation.js';
test('an observed wrong category remains a recognition failure; uncertainty is a missed result, not a correct SKU',()=>{
 const cases=[{id:'crop',groupId:'original',split:'development' as const,category:'toy',targetPresent:true,expectedLabels:['빨간색 광선검'],conditions:['no-context']}];
 const wrong=evaluateIdentifications(cases,[{caseId:'crop',status:'ok',label:'빨간색 칫솔'}],'development');assert.equal(wrong.metrics.wrong,1);assert.equal(wrong.metrics.recall,0);
 const uncertain=evaluateIdentifications(cases,[{caseId:'crop',status:'ok',label:'종류 미확인',abstained:true}],'development');assert.equal(uncertain.metrics.wrong,0);assert.equal(uncertain.metrics.abstained,1);assert.equal(uncertain.metrics.recall,0);assert.equal(uncertain.task,'identification');
});
const truth=[{id:'one',groupId:'video-one',split:'holdout' as const,category:'bag',targetPresent:true,expectedProductIds:['SKU1'],conditions:['blur']},{id:'two',groupId:'video-two',split:'holdout' as const,category:'shoe',targetPresent:false,expectedProductIds:[],conditions:['occlusion']}];
test('wrong products, misses, no-match decisions and missing output have separate measurable outcomes',()=>{
 let r=evaluateProducts(truth,[{caseId:'one',status:'ok',productIds:['SKU1','WRONG']},{caseId:'two',status:'ok',productIds:['SHOE']}]);assert.equal(r.metrics.precision,1/3);assert.equal(r.metrics.recall,1);assert.equal(r.metrics.negativeFalsePositiveRate,1);assert.equal(r.status,'insufficient_data');
 r=evaluateProducts(truth,[{caseId:'one',status:'ok',productIds:[]}]);assert.equal(r.metrics.precision,null);assert.equal(r.metrics.recall,0);assert.equal(r.metrics.errors,1);assert.equal(r.metrics.abstained,1);assert.equal(r.byCondition.blur.cases,1);
});
test('related frames cannot leak across evaluation splits and duplicates cannot inflate precision',()=>{
 assert.throws(()=>evaluateProducts([...truth,{...truth[0],id:'leak',split:'development'}],[]),/leak/);
 assert.throws(()=>evaluateProducts(truth,[{caseId:'one',status:'ok',productIds:['SKU1','SKU1']}]),/duplicated/);
});
test('empty or development-only data never passes a release quality gate',()=>{assert.equal(evaluateProducts([],[]).status,'insufficient_data');assert.equal(evaluateProducts(truth.map(c=>({...c,split:'development'})),[], 'development').status,'insufficient_data');});
