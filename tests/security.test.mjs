import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
test('sanitizes executable markup, resolves links and defers image requests',async()=>{
 const {window}=new JSDOM('',{url:'https://extension.example',runScripts:'outside-only'});
 const code=(await build({entryPoints:['src/sanitize.ts'],bundle:true,write:false,format:'iife',globalName:'Cleaner',platform:'browser'})).outputFiles[0].text;
 window.eval(code+"\nwindow.Cleaner=Cleaner;");
 const clean=window.Cleaner.sanitize('<script>alert(1)</script><img src="/image.jpg" onerror="alert(1)"><a href="javascript:alert(1)">bad</a><a href="/story">story</a><iframe src="https://evil.example"></iframe><div id="title" style="display:none" onclick="bad()">Text</div><svg onload="bad()"></svg>','https://publisher.example/path/article');
 const host=window.document.createElement('div');host.append(clean);
 assert.doesNotMatch(host.innerHTML,/<script|onerror|onclick|javascript:|<iframe|<svg|style=|id=/);
 assert.equal(host.querySelector('img').getAttribute('src'),null);
 assert.equal(host.querySelector('img').dataset.imageUrl,'https://publisher.example/image.jpg');
 assert.equal(host.querySelector('a[href]').href,'https://publisher.example/story');
 assert.equal(host.querySelector('a[href]').rel,'noopener noreferrer');
});
test('manifest has only scoped permissions and no persistent injection or remote code',async()=>{
 const m=JSON.parse(await readFile('manifest.json','utf8'));
 assert.equal(m.manifest_version,3);assert.deepEqual(m.permissions,['activeTab','scripting','storage']);
 assert.equal(m.host_permissions,undefined);assert.equal(m.content_scripts,undefined);assert.equal(m.background,undefined);
 assert.equal(m.content_security_policy.extension_pages,"script-src 'self'; object-src 'none'; base-uri 'none'");
});
