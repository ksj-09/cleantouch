import fs from 'node:fs/promises';import path from 'node:path';
import {parseCatalogue,createCatalogueIndex} from '../dist/catalogue.js';
const file=process.argv[2]||new URL('../test/fixtures/catalogue-test.json',import.meta.url);
const parsed=parseCatalogue(JSON.parse(await fs.readFile(file,'utf8')));console.log(JSON.stringify({...createCatalogueIndex(parsed).summary(),note:'Format validation only. Image availability, rights, AI accuracy and live stock are not verified.'},null,2));
