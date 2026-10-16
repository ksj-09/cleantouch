const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const asar=require('@electron/asar'),yauzl=require('yauzl');
const root=path.resolve(__dirname,'../..');
const line=fs.readFileSync(path.join(root,'cleantouch-search-api/.env'),'utf8').split(/\r?\n/).find(s=>s.startsWith('GEMINI_API_KEY='));
const key=Buffer.from(line.slice('GEMINI_API_KEY='.length).trim().replace(/^['"]|['"]$/g,''));
assert(key.length>20);
const build=process.env.CLEANTOUCH_BUILD_DIR||'dist';
const archive=path.join(root,'cleantouch-desktop',build,'win-unpacked/resources/app.asar');
let pcFiles=0;
for(const name of asar.listPackage(archive)){const relative=name.replace(/^[/\\]/,'');const stat=asar.statFile(archive,relative);if(stat.files||stat.link||stat.unpacked)continue;const data=asar.extractFile(archive,relative);assert(!data.includes(key),'Secret found in packaged PC file');pcFiles++;}
const endpoint=JSON.parse(asar.extractFile(archive,'chat-endpoint.json'));assert.equal(endpoint.url,'https://cleantouch-place-ai-20261006.netlify.app');
const version=fs.readFileSync(path.join(root,'cleantouch-android/app/build.gradle.kts'),'utf8').match(/versionName = "([^"]+)"/)[1];
const apk=path.join(root,`artifacts/downloads/CleanTouch-Android-${version}-debug.apk`);
let apkFiles=0,hasEndpoint=false;
new Promise((resolve,reject)=>yauzl.open(apk,{lazyEntries:true},(error,zip)=>{
 if(error)return reject(error);zip.on('error',reject);zip.on('end',resolve);
 zip.on('entry',entry=>{if(entry.fileName.endsWith('/')){zip.readEntry();return;}zip.openReadStream(entry,(error,stream)=>{if(error)return reject(error);let tail=Buffer.alloc(0);stream.on('error',reject);stream.on('data',chunk=>{const bytes=Buffer.concat([tail,chunk]);if(bytes.includes(key)){reject(Error('Secret found in APK'));zip.close();}if(bytes.includes(Buffer.from(endpoint.url)))hasEndpoint=true;tail=bytes.subarray(Math.max(0,bytes.length-256));});stream.on('end',()=>{apkFiles++;zip.readEntry();});});});zip.readEntry();
})).then(()=>{assert(hasEndpoint,'APK missing public chat endpoint');console.log(JSON.stringify({pcFiles,apkFiles,publicEndpoint:true,operatorKeyExcluded:true}));}).catch(error=>{console.error(error.message);process.exitCode=1;});
