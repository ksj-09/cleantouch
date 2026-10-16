const fs=require('fs');let p='cleantouch-desktop/candidate-policy.js',s=fs.readFileSync(p,'utf8').replace('(function(root){',"(function(root){\n const identity=root.productIdentity||(typeof require==='function'?require('./product-identity'):null);").replaceAll('root.productIdentity?.identityKey','identity?.identityKey');fs.writeFileSync(p,s);
p='cleantouch-desktop/renderer.js';s=fs.readFileSync(p,'utf8');const start=s.indexOf('      const previousKey=productIdentity.identityKey(value.label);'),end=s.indexOf('    }) : null;',start);if(start<0||end<0)throw Error('Duplicate matcher not found');s=s.slice(0,start)+`      if(value.videoKey!==videoKey)return false;
      return candidatePolicy.duplicate(value,product,productAI.cosine(value.embedding,product.embedding),value.sightings.some(s=>s.frame===frame));
`+s.slice(end);
s=s.replace('async function scanFrame(frame, selectedCrop = null) {',`let precisionChecks=0,lastPrecisionCheck=0,precisionBackoff=0;
const precisionCache=[];
async function confirmCandidate(crop,classification,frame,operation){
  const cached=precisionCache.find(item=>item.videoKey===frame.videoKey&&productAI.cosine(item.embedding,classification.embedding)>.985);
  if(cached)return cached.data;
  if(precisionChecks>=8||Date.now()<precisionBackoff)return null;
  const wait=Math.max(0,lastPrecisionCheck+6500-Date.now());
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  if(operation!==scanGeneration)return null;
  precisionChecks++;lastPrecisionCheck=Date.now();ui.detail.textContent='상품 후보를 AI로 재확인하고 있어요. 후보 사진만 전송합니다.';
  try{
    const bitmap=await createImageBitmap(crop);const c=document.createElement('canvas');const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
    const data=await bridge.identifyProduct(c.toDataURL('image/jpeg',.9).split(',')[1]);
    if(operation!==scanGeneration)return null;
    const confirmed=['high','medium'].includes(data.confidence)&&data.query&&data.label!=='종류 미확인'?{...classification,label:data.label,uncertain:data.confidence!=='high',verified:true,reason:data.reason}:null;
    precisionCache.push({videoKey:frame.videoKey,embedding:classification.embedding,data:confirmed});if(precisionCache.length>64)precisionCache.shift();return confirmed;
  }catch{precisionBackoff=Date.now()+60000;return null;}
}
async function scanFrame(frame, selectedCrop = null) {`);
s=s.replace('    for (const region of regions) {\n      const box', '    let frameChecks=0;\n    for (const region of regions) {\n      if(operation!==scanGeneration)return 0;\n      if(!candidatePolicy.quality(region.right-region.left,region.bottom-region.top))continue;\n      const box');
s=s.replace('      const classification = applyGlowColor(await classifyProduct(crop), region);\n      if (classification.uncertain',`      let classification = applyGlowColor(await classifyProduct(crop), region);
      if(classification.category==='unknown')continue;
      const padX=(box[2]-box[0])*.18,padY=(box[3]-box[1])*.18;
      const contextCrop=await cropImage(selectedCrop||frame.blob,[Math.max(0,box[0]-padX),Math.max(0,box[1]-padY),Math.min(1,box[2]+padX),Math.min(1,box[3]+padY)]);
      const contextClass=applyGlowColor(await classifyProduct(contextCrop),region);
      const disagreement=!candidatePolicy.agrees(classification,contextClass)||classification.category!==contextClass.category;
      if(classification.uncertain||contextClass.uncertain||disagreement){
        if(frameChecks>=2)continue;frameChecks++;
        classification=await confirmCandidate(crop,classification,frame,operation);if(!classification)continue;
      }
      if (classification.uncertain`);
s=s.replace("if (classification.uncertain && ['keyboard','mouse'].includes(classification.category)) continue;","if (!classification.verified && classification.uncertain && ['keyboard','mouse'].includes(classification.category)) continue;");
s=s.replace("if (region.glow && (classification.uncertain || (!classification.category.includes('lightsaber') && classification.category !== 'toy-sword'))) continue;", "if (region.glow && !classification.verified && (classification.uncertain || (!classification.category.includes('lightsaber') && classification.category !== 'toy-sword'))) continue;");
s=s.replace('  scanGeneration++;\n  productSearchGeneration++;','  scanGeneration++;\n  precisionChecks=0;precisionCache.length=0;\n  productSearchGeneration++;');fs.writeFileSync(p,s);
p='cleantouch-desktop/package.json';const j=JSON.parse(fs.readFileSync(p));j.build.files.push('candidate-policy.js');fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
