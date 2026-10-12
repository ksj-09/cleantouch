import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const cli=process.argv[2];if(!cli||!process.env.GEMINI_API_KEY)throw Error('Netlify CLI and operator key are required');
const temporary=path.resolve('../.local/cleantouch-netlify.env');
fs.writeFileSync(temporary,`GEMINI_API_KEY=${process.env.GEMINI_API_KEY}\nPLACE_CHAT_MODEL=gemini-3.1-flash-lite\nPLACE_CHAT_DAILY_LIMIT=500\n`,{mode:0o600});
try{
 const result=spawnSync(process.execPath,[cli,'env:import',temporary],{encoding:'utf8',timeout:90000});
 if(result.status!==0){console.error(String(result.stderr||result.stdout||'Netlify environment import failed').replaceAll(process.env.GEMINI_API_KEY,'[redacted]'));process.exitCode=1;}
 else console.log('Operator Gemini key registered on Netlify; no key printed.');
}finally{fs.unlinkSync(temporary);}
