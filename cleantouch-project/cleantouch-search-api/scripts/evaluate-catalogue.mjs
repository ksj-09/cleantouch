import fs from 'node:fs/promises';import path from 'node:path';
import {parseCatalogue,createCatalogueIndex} from '../dist/catalogue.js';
const catalogFile=process.argv[2]||new URL('../test/fixtures/catalogue-test.json',import.meta.url),casesFile=process.argv[3]||new URL('../test/fixtures/catalogue-contract-cases.json',import.meta.url);
const catalogue=parseCatalogue(JSON.parse(await fs.readFile(catalogFile,'utf8'))),dataset=JSON.parse(await fs.readFile(casesFile,'utf8'));
if(dataset.kind!=='catalogue_contract'||!Array.isArray(dataset.cases)||!dataset.cases.length||dataset.cases.length>10000)throw Error('Expected nonempty catalogue_contract cases; image benchmark evaluation is not implemented.');
const index=createCatalogueIndex(catalogue),results=dataset.cases.map(c=>{
 if(typeof c.id!=='string'||!Array.isArray(c.expectedSkus)||typeof c.expectedStatus!=='string'||Boolean(c.lookup)===Boolean(c.resolve))throw Error('Invalid evaluation case');
 const r=c.lookup?index.lookup(catalogue.tenantId,c.lookup):index.resolve(catalogue.tenantId,c.resolve.contentId,c.resolve.time,c.resolve.point,c.resolve.country);
 const skus=r.candidates.map(p=>p.sku).sort(),expected=[...c.expectedSkus].sort();return {id:c.id,passed:r.status===c.expectedStatus&&JSON.stringify(skus)===JSON.stringify(expected),status:r.status,skus,expectedStatus:c.expectedStatus,expectedSkus:expected};
});
const report={kind:'deterministic_catalogue_contract',dataClass:catalogue.dataClass,at:new Date().toISOString(),checks:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,doesNotMeasure:['image_recognition_accuracy','visual_retrieval_recall','live_seller_availability','purchase_conversion'],results};
const folder=path.resolve('../artifacts/verification');await fs.mkdir(folder,{recursive:true});const output=path.join(folder,'catalogue-contract-evaluation.json');await fs.writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({kind:report.kind,checks:report.checks,passed:report.passed,failed:report.failed,output,note:'Contract fixture results are not AI accuracy.'},null,2));if(report.failed)process.exitCode=1;
