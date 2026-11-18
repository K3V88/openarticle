import {chromium} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory=new URL('../assets/icons/',import.meta.url);
const svg=await readFile(new URL('openarticle.svg',directory),'utf8');
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:'chromium',headless:true});
try {
 for(const size of [16,32,48,128]) {
  const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
  await page.setContent(`<html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style></head><body>${svg}</body></html>`);
  await page.screenshot({path:fileURLToPath(new URL(`icon-${size}.png`,directory)),omitBackground:true});
  await page.close();
 }
} finally {await browser.close();}
console.log('Generated Chrome PNG icons at 16, 32, 48 and 128 pixels.');
