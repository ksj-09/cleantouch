// Update only the local CleanTouch development preview, preserving conversations.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const source=fs.readFileSync('renderer.js','utf8'),dedup=fs.readFileSync('scene-dedup.js','utf8');
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Source marker missing');return source.slice(a,b).trim();}
const methods=[
 ['refresh',part('function refresh()','async function checkServer()')],
 ['captureFrame',part('async function captureFrame(','async function startCapture()')],
 ['startCapture',part('async function startCapture()','async function stopCapture(')],
 ['adjacentSceneFrames',part('function adjacentSceneFrames(','async function temporalSceneEvidence(')],
 ['analyzeAllScenes',part('async function analyzeAllScenes()','function cancelAnalysis()')],
 ['reset',part('async function reset()','ui.start.addEventListener(')],
];
const expression=`(async()=>{
 if(!['capturing','review','idle','complete'].includes(phase)||liveBusy||cleanTouchVoice.busy||cleanTouchLive.sharing||document.getElementById('chat-input').value.length||batchStarting)throw Error('Active interaction preserved');
 if(capturePending)await capturePending;
 ${dedup}
 window.sceneCollector=new cleanTouchSceneDedup.SceneCollector();
 const oldStart=startCapture,oldAll=analyzeAllScenes,oldReset=reset;
 ui.start.removeEventListener('click',oldStart);byId('widget-start').removeEventListener('click',oldStart);ui.analyzeAll.removeEventListener('click',oldAll);ui.widgetAll.removeEventListener('click',oldAll);ui.reset.removeEventListener('click',oldReset);
 ${methods.map(([name,body])=>`${name}=${body};`).join('\n')}
 ui.start.addEventListener('click',startCapture);byId('widget-start').addEventListener('click',startCapture);ui.analyzeAll.addEventListener('click',analyzeAllScenes);ui.widgetAll.addEventListener('click',analyzeAllScenes);ui.reset.addEventListener('click',reset);
 const before=frames.length;frames=cleanTouchSceneDedup.compact(frames,f=>completedFrames.has(f));collectedBytes=frames.reduce((n,f)=>n+cleanTouchSceneDedup.frameBytes(f),0);duplicateFrames+=before-frames.length;
 document.getElementById('collection-help').textContent=${JSON.stringify('화면 변화를 확인해 대표 이미지만 보관합니다. 비슷한 화면은 줄이고, 분석할 때 앞뒤 이미지도 함께 확인합니다.')};
 refresh();return {before,representatives:frames.length,bytes:collectedBytes,phase,temporalEvidence:frames.filter(f=>f.evidenceFrames?.length).length};
})()`;
const result=spawnSync(process.execPath,['test/preview-eval.mjs',expression],{encoding:'utf8',env:{...process.env,CLEANTOUCH_DEBUG_PORT:'9237'},windowsHide:true});
process.stdout.write(result.stdout||result.stderr);process.exitCode=result.status;
