const {spawnSync}=require('node:child_process');
const cli='C:/Users/first2000/AppData/Local/npm-cache/_npx/da5c1b6ea715e8b4/node_modules/netlify-cli/bin/run.js';
const publish=process.argv[2]==='publish';
const deployId=process.argv[3];if(publish&&!/^[a-f0-9]{24}$/.test(deployId||''))throw Error('Specify the verified deployment ID to publish');
const result=spawnSync(process.execPath,[cli,'api',publish?'restoreSiteDeploy':'getSite','--data',JSON.stringify({site_id:'618a8428-221c-4a3e-983b-89e689ef0a1e',...(publish?{deploy_id:deployId}:{})})],{encoding:'utf8',windowsHide:true});
if(result.status!==0){console.log(JSON.stringify({status:result.status,forbidden:result.stderr.includes('Forbidden')}));process.exitCode=1;}
else{try{const site=JSON.parse(result.stdout);console.log(JSON.stringify({state:site.state,publishAttempt:publish,deployId:publish?site.id:undefined,accountType:site.account_type,processing:site.processing_settings?.skip,deployLocked:site.published_deploy?.locked,publishedState:site.published_deploy?.state,capabilities:site.capabilities}));}catch{console.log('Could not read deployment metadata');process.exitCode=1;}}
