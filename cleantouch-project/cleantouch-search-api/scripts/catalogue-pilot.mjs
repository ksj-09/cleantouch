import fs from 'node:fs/promises';
import {createCataloguePilot} from '../dist/catalogue-pilot.js';
const html=await fs.readFile(new URL('../public/catalogue-pilot.html',import.meta.url),'utf8'),fixture=JSON.parse(await fs.readFile(new URL('../test/fixtures/catalogue-test.json',import.meta.url),'utf8'));
const port=Number(process.env.CLEANTOUCH_CATALOGUE_PORT||8792);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local pilot port');
const server=createCataloguePilot(html,fixture).listen(port,'127.0.0.1',()=>console.log(`CleanTouch local catalogue pilot: http://127.0.0.1:${port}\nNo real merchant catalogue is loaded. Test data is explicitly marked.`));
server.on('error',()=>{console.error('Cannot start local catalogue pilot. The port may already be in use.');process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
