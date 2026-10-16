const {spawn}=require('node:child_process');
const path=require('node:path');
const script=process.argv[2];
if(!script)throw Error('Specify an Electron test file.');
const child=spawn(require('electron'),[...process.argv.slice(3),path.resolve(script)],{
 cwd:path.resolve(__dirname,'..'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:process.env,
});
child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);
const timer=setTimeout(()=>{
 process.stderr.write('Electron test exceeded its time limit.\n');
 if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
 else child.kill('SIGKILL');
},Number(process.env.CLEANTOUCH_TEST_TIMEOUT||120000));
child.on('error',error=>{clearTimeout(timer);process.stderr.write(error.message+'\n');process.exitCode=1;});
child.on('close',code=>{clearTimeout(timer);process.exitCode=code??1;});
