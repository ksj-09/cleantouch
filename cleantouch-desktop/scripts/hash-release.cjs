const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),pc=require('../package.json').version;
const mobile=fs.readFileSync(path.join(root,'cleantouch-android/app/build.gradle.kts'),'utf8').match(/versionName = "([^"]+)"/)[1];
const folder=path.join(root,'artifacts/downloads');
const names=[`CleanTouch-Setup-${pc}.exe`,`CleanTouch-Portable-${pc}.exe`,`CleanTouch-Android-${mobile}-debug.apk`];
(async()=>{const lines=[];for(const name of names){const hash=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(path.join(folder,name)))hash.update(bytes);lines.push(`${hash.digest('hex')}  ${name}`);}fs.writeFileSync(path.join(folder,`SHA256-${pc}-${mobile}.txt`),lines.join('\n')+'\n');console.log('Release checksums written.');})().catch(error=>{console.error(error.message);process.exitCode=1;});
