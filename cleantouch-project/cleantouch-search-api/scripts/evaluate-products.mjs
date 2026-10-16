import fs from 'node:fs/promises';import {evaluateProducts,evaluateIdentifications} from '../dist/product-evaluation.js';
const [truthFile,predictionFile,outputFile]=process.argv.slice(2).filter(v=>!v.startsWith('--'));
if(!truthFile||!predictionFile||!outputFile)throw Error('Usage: evaluate-products.mjs truth.json predictions.json output.json [--development] [--strict]');
const truth=JSON.parse(await fs.readFile(truthFile,'utf8')),predictions=JSON.parse(await fs.readFile(predictionFile,'utf8'));
const evaluate=truth.task==='identification'?evaluateIdentifications:evaluateProducts;
const result=evaluate(truth.cases,predictions.predictions,process.argv.includes('--development')?'development':'holdout');
await fs.writeFile(outputFile,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(process.argv.includes('--strict')&&result.status!=='pass')process.exitCode=1;
