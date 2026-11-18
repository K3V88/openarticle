import { build } from 'esbuild';
import { mkdir, copyFile, rm, cp } from 'node:fs/promises';
await rm('dist', { recursive:true, force:true });
await mkdir('dist');
await build({entryPoints:['src/content.ts','src/popup.ts','src/reader.ts'],outdir:'dist',bundle:true,format:'iife',target:'chrome102',legalComments:'eof'});
for(const file of ['manifest.json','popup.html','popup.css','reader.html','reader.css']) await copyFile(file,`dist/${file}`);
await copyFile('THIRD_PARTY_NOTICES.md','dist/THIRD_PARTY_NOTICES.md');
await cp('licenses','dist/licenses',{recursive:true});
console.log('Load the dist/ directory as an unpacked Chrome extension.');
