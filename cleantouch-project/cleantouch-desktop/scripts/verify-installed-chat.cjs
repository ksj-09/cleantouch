const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const installed=path.join(process.env.LOCALAPPDATA,'Programs/CleanTouch/resources/app.asar');
const {version}=require('../package.json');
const built=path.resolve(__dirname,'..',process.env.CLEANTOUCH_BUILD_DIR||`dist-${version}-final`,'win-unpacked/resources/app.asar');
const files=['main.cjs','preload.cjs','index.html','styles.css','renderer.js','place-chat.js','live-screen.js','chat-store.cjs','chat-memory.js','chat-title.js','chat-title-service.cjs','conversation-context.js','shopping-cards.js','capture-consent.cjs','share-permission.js','tutorial.js','package.json'];
for(const file of files){const actual=asar.extractFile(installed,file);assert(actual.equals(asar.extractFile(built,file)),file+' differs from final package');if(file!=='package.json')assert(actual.equals(fs.readFileSync(path.join(__dirname,'..',file))),file+' differs from source');}
assert.equal(JSON.parse(asar.extractFile(installed,'package.json')).version,version);
console.log(JSON.stringify({installedVersion:version,sourceAndPackageMatch:true,checkedFiles:files.length,chatHistoryFile:fs.existsSync(path.join(process.env.APPDATA,'cleantouch-desktop/conversations.json'))}));
