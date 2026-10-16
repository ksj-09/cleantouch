// Uses an existing Netlify login. Never prints connection strings, tokens or secrets.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cli=process.env.NETLIFY_CLI_MODULE_ROOT&&path.join(process.env.NETLIFY_CLI_MODULE_ROOT,'bin/run.js');if(!cli)throw Error('Set NETLIFY_CLI_MODULE_ROOT');
const site='618a8428-221c-4a3e-983b-89e689ef0a1e';
function command(args){const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',windowsHide:true,timeout:90000});if(r.status!==0){const safe=args.join(' ').includes('USAGE_IDENTITY_SECRET')?'secret operation output withheld':String(r.stderr||r.error?.code||'').replace(/(?:postgres(?:ql)?|https?):\/\/\S+/gi,'[endpoint]').slice(-300);throw Error('Netlify '+args[1]+' failed ('+r.status+'): '+safe);}return r.stdout;}
(async()=>{
 const created=JSON.parse(command(['api','createSiteDatabase','--data',JSON.stringify({site_id:site,database:{}})]));
 if(!created.connection_string)throw Error('Database credential was not provided');
 const applyAt=process.argv.indexOf('--apply-deploy');
 if(applyAt!==-1){const deploy=process.argv[applyAt+1];if(!/^[a-f0-9]{24}$/.test(deploy||''))throw Error('Invalid deploy ID');command(['api','runSiteDatabaseMigrations','--data',JSON.stringify({site_id:site,deploy_id:deploy,migrations:{dry_run:false}})]);}
 const {neon}=await import('@neondatabase/serverless');const sql=neon(created.connection_string);
 const check=await sql.query("SELECT to_regprocedure('ct_admit_request(text,text,text,text,integer,integer,integer,integer)') IS NOT NULL AS ready",[]);
 const ready=check[0]?.ready===true;console.log(JSON.stringify({databaseReady:true,schemaReady:ready,credentialsPrinted:false}));
 if(!ready&&!process.argv.includes('--prepare'))throw Error('Deploy the Netlify database migration before enabling the guard');
 if(process.argv.includes('--configure')){
  // Do not rotate an existing salt: that would reset network identities.
  const info=JSON.parse(command(['api','getSite','--data',JSON.stringify({site_id:site})]));
  const scope={accountId:info.account_slug,siteId:site};
  const env=JSON.parse(command(['api','getEnvVars','--data',JSON.stringify(scope)]));
  const values={USAGE_GUARD_MODE:'required',AI_REQUIRE_SIGNED_REQUESTS:'false',USAGE_DATABASE_URL:created.connection_string,...(!env.some(v=>v.key==='USAGE_IDENTITY_SECRET')?{USAGE_IDENTITY_SECRET:crypto.randomBytes(32).toString('hex')}:{})};
  for(const [key,value]of Object.entries(values)){const exists=env.some(v=>v.key===key);const body={key,scopes:['builds','functions','runtime','post_processing'],values:[{context:'all',value}]};command(['api',exists?'updateEnvVar':'createEnvVars','--data',JSON.stringify({...scope,...(exists?{key,body}:{body:[body]})})]);}
  const verified=JSON.parse(command(['api','getEnvVars','--data',JSON.stringify(scope)]));if(!verified.some(v=>v.key==='USAGE_GUARD_MODE'&&v.values.some(x=>x.value==='required'))||!verified.some(v=>v.key==='USAGE_IDENTITY_SECRET'))throw Error('Server guard configuration was not persisted');
  console.log(JSON.stringify({guardConfigured:true,legacyCompatibility:true,credentialsPrinted:false}));
 }
})().catch(error=>{console.error(JSON.stringify({setupFailed:true,name:error.name,code:error.code,reason:String(error.message).replace(/(?:postgres(?:ql)?|https?):\/\/\S+/gi,'[endpoint redacted]').slice(0,220)}));process.exitCode=1;});
