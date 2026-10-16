import {pathToFileURL} from 'node:url';import path from 'node:path';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import crypto from 'node:crypto';import pg from 'pg';
const cli=process.env.NETLIFY_CLI_MODULE_ROOT;if(!cli)throw Error('Set NETLIFY_CLI_MODULE_ROOT to the installed netlify-cli directory');
const {connectRawClient}=await import(pathToFileURL(path.join(cli,'dist/commands/database/util/db-connection.js')));
// A dedicated LOCAL test database. Never accepts a production URL.
const local=path.resolve('../.local/usage-ledger-test');
await fs.mkdir(local,{recursive:true});
await fs.writeFile(path.join(local,'netlify.toml'),'[build]\nbase = "."\n');
const {client,connectionString,cleanup}=await connectRawClient(local);
const pool=new pg.Pool({connectionString,max:12});
try{
 await client.query(await fs.readFile('db/usage.sql','utf8'));
 await client.query('TRUNCATE ct_request_nonce,ct_usage_bucket');
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),subject=hash('one-device'),network=hash('one-network');
 const reserve=(nonce,limits=[20,100,200,100])=>pool.query('SELECT * FROM ct_admit_request($1,$2,$3,$4,$5,$6,$7,$8)',[subject,network,nonce,'product',...limits]);
 const results=await Promise.all(Array.from({length:30},(_,i)=>reserve(hash('parallel-'+i))));
 assert.equal(results.filter(r=>r.rows[0].allowed).length,10);
 assert.equal(Number((await client.query("SELECT used FROM ct_usage_bucket WHERE key LIKE 'global:%'")).rows[0].used),20);
 await client.query('TRUNCATE ct_request_nonce,ct_usage_bucket');
 const nonce=hash('replay');assert((await reserve(nonce)).rows[0].allowed);assert.equal((await reserve(nonce)).rows[0].reason,'replay');
 assert.equal(Number((await client.query("SELECT used FROM ct_usage_bucket WHERE key LIKE 'global:%'")).rows[0].used),2);
 const limit=(await reserve(hash('per-device'),[100,2,200,100])).rows[0];assert.equal(limit.reason,'device');assert(limit.retry_seconds>0);
 assert.equal(Number((await client.query("SELECT used FROM ct_usage_bucket WHERE key LIKE 'global:%'")).rows[0].used),2);
 console.log(JSON.stringify({postgres:true,parallelRequests:30,admitted:10,globalUnits:20,replayBlocked:true,denialDoesNotSpend:true,noCredentialsPrinted:true}));
}finally{await pool.end();await client.end();await cleanup();}
