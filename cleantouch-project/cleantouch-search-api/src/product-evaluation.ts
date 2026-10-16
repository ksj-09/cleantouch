type Case={id:string;groupId:string;split:'development'|'holdout';category:string;targetPresent:boolean;expectedProductIds:string[];conditions:string[]};
type Prediction={caseId:string;status:'ok'|'error';productIds:string[]};
const ratio=(n:number,d:number)=>d?n/d:null;
export function evaluateIdentifications(cases:(Omit<Case,'expectedProductIds'>&{expectedLabels:string[]})[],predictions:{caseId:string;status:'ok'|'error';label:string;abstained?:boolean}[],split:'development'|'holdout'='holdout'){
 const normalize=(v:string)=>v.normalize('NFKC').replace(/\s+/g,'').toLowerCase();
 for(const c of cases)if(!Array.isArray(c.expectedLabels)||c.expectedLabels.some(v=>typeof v!=='string'||!v.trim())||c.targetPresent!==Boolean(c.expectedLabels.length))throw Error('Invalid identification ground truth');
 for(const p of predictions)if(typeof p.label!=='string')throw Error('Invalid identification prediction');
 const result=evaluateProducts(cases.map(c=>({...c,expectedProductIds:c.targetPresent?['expected-label']:[]})),predictions.map(p=>({caseId:p.caseId,status:p.status,productIds:p.status==='error'||p.abstained||!p.label.trim()?[]:[cases.find(c=>c.id===p.caseId)?.expectedLabels.some(v=>normalize(v)===normalize(p.label))?'expected-label':'wrong-label']})),split);
 return {task:'identification',...result,notice:'사람이 정한 상품명 허용 표현과 비교한 종류·색상 인식 평가입니다. SKU 식별/실제 구매처 검색 성공률과 별개입니다. '+result.notice};
}
export function evaluateProducts(cases:Case[],predictions:Prediction[],split:'development'|'holdout'='holdout'){
 if(!Array.isArray(cases)||!Array.isArray(predictions))throw Error('Evaluation arrays required');
 const ids=new Set<string>(),groups=new Map<string,string>();
 for(const c of cases){
  if(!c||!c.id||ids.has(c.id)||!c.groupId||!['development','holdout'].includes(c.split)||!c.category||typeof c.targetPresent!=='boolean'||!Array.isArray(c.expectedProductIds)||c.expectedProductIds.some(x=>typeof x!=='string'||!x)||!Array.isArray(c.conditions)||c.conditions.some(x=>typeof x!=='string')||c.targetPresent!==Boolean(c.expectedProductIds.length))throw Error('Invalid or duplicated ground truth');
  ids.add(c.id);if(groups.has(c.groupId)&&groups.get(c.groupId)!==c.split)throw Error('Related images leak across development and holdout');groups.set(c.groupId,c.split);
 }
 const outputs=new Map<string,Prediction>();
 for(const p of predictions){if(!p||!ids.has(p.caseId)||outputs.has(p.caseId)||!['ok','error'].includes(p.status)||!Array.isArray(p.productIds)||p.productIds.some(id=>typeof id!=='string'||!id)||new Set(p.productIds).size!==p.productIds.length||p.status==='error'&&p.productIds.length)throw Error('Invalid or duplicated predictions');outputs.set(p.caseId,p);}
 const selected=cases.filter(c=>c.split===split);
 function summarize(rows:Case[]){
  let returned=0,correct=0,found=0,positive=0,negative=0,falsePositive=0,errors=0,abstained=0;
  for(const c of rows){const p=outputs.get(c.id);if(c.targetPresent)positive++;else negative++;
   if(!p||p.status==='error'){errors++;continue;}
   if(!p.productIds.length)abstained++;
   returned+=p.productIds.length;const matches=p.productIds.filter(id=>c.expectedProductIds.includes(id)).length;correct+=matches;
   if(c.targetPresent&&matches)found++;if(!c.targetPresent&&p.productIds.length)falsePositive++;
  }
  return {cases:rows.length,positiveCases:positive,negativeCases:negative,returned,correct,wrong:returned-correct,errors,abstained,precision:ratio(correct,returned),recall:ratio(found,positive),negativeFalsePositiveRate:ratio(falsePositive,negative),errorRate:ratio(errors,rows.length),abstentionRate:ratio(abstained,rows.length)};
 }
 const metrics=summarize(selected),categories=[...new Set(selected.map(c=>c.category))],conditions=[...new Set(selected.flatMap(c=>c.conditions))],groupCount=new Set(selected.map(c=>c.groupId)).size;
 const sufficient=split==='holdout'&&metrics.positiveCases>=30&&metrics.negativeCases>=30&&categories.length>=5&&groupCount>=20;
 const pass=sufficient&&metrics.precision!==null&&metrics.precision>=.95&&metrics.recall!==null&&metrics.recall>=.8&&metrics.negativeFalsePositiveRate===0&&metrics.errorRate!==null&&metrics.errorRate<=.05;
 return {split,status:!sufficient?'insufficient_data':pass?'pass':'fail',metrics,independentGroups:groupCount,byCategory:Object.fromEntries(categories.map(k=>[k,summarize(selected.filter(c=>c.category===k))])),byCondition:Object.fromEntries(conditions.map(k=>[k,summarize(selected.filter(c=>c.conditions.includes(k)))])),policy:{minimumPositive:30,minimumNegative:30,minimumCategories:5,minimumIndependentGroups:20,minimumPrecision:.95,minimumRecall:.8,maximumNegativeFalsePositiveRate:0,maximumErrorRate:.05},notice:'상품 ID 정답과 비교한 평가입니다. 품질 기준은 초기 내부 통과 조건이며 일반 상품 전체의 정확도를 보장하지 않습니다. 같은 원본의 변형 사진은 독립 표본이 아닙니다.'};
}
