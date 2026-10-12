const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {version}=require('../package.json');const file=path.join(process.env.APPDATA,'cleantouch-desktop/conversations.json'),baseline=path.resolve(__dirname,`../../artifacts/verification/release-${version}-title-baseline.json`);
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
(async()=>{
 const chats=JSON.parse(await fs.readFile(file,'utf8')).chats;
 if(process.argv.includes('--before')){await fs.writeFile(baseline,JSON.stringify(chats.map(c=>({id:c.id,entries:digest(c.entries),history:digest(c.history),image:digest(c.image),updatedAt:c.updatedAt})),null,2));console.log(JSON.stringify({baselineRecords:chats.length}));return;}
 const before=JSON.parse(await fs.readFile(baseline,'utf8'));let result;
 for(let i=0;i<50;i++){const current=JSON.parse(await fs.readFile(file,'utf8')).chats;const retained=before.every(b=>{const c=current.find(c=>c.id===b.id);return c&&digest(c.entries)===b.entries&&digest(c.history)===b.history&&digest(c.image)===b.image&&c.updatedAt===b.updatedAt;});const repaired=current.filter(c=>before.some(b=>b.id===c.id)).every(c=>c.titleGenerated&&!/^궁금한 내용 알아보기$/.test(c.title));result={records:before.length,contentPreserved:retained,allGenerated:repaired,distinctTitles:new Set(current.map(c=>c.title)).size};if(retained&&repaired){await fs.writeFile(path.resolve(__dirname,`../../artifacts/verification/release-${version}-installed-title-repair.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result));return;}await new Promise(r=>setTimeout(r,500));}
 console.log(JSON.stringify(result));process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
