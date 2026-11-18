import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
const code=(await build({entryPoints:['src/article.ts'],bundle:true,write:false,format:'esm',platform:'node'})).outputFiles[0].text;
const {analyze,extract}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
async function fixture(name){return new JSDOM(await readFile(`tests/fixtures/${name}.html`,'utf8'),{url:'https://journal.example/news/garden'}).window.document;}
for(const [name,status] of [['public','Free article'],['syndicated','Free article'],['subscription','Hard paywall'],['metadata','Hard paywall'],['incomplete','Possible soft paywall'],['subscription-message','Possible soft paywall'],['unknown','Unknown']]) {
 test(`classifies ${name}: ${status}`,async()=>{const info=analyze(await fixture(name));assert.equal(info.status,status);assert.equal(info.readable,status==='Free article');assert.ok(info.reasons.length);});
}
test('unknown nonarticle page',()=>{const doc=new JSDOM('<h1>Welcome</h1>',{url:'https://example.com'}).window.document;assert.equal(analyze(doc).status,'Unknown');});
test('extracts visible headings, paragraphs and images without mutating the page',async()=>{const doc=await fixture('public');const before=doc.documentElement.outerHTML;const result=extract(doc);assert.match(result.content,/A place to grow/);assert.match(result.content,/<img/);assert.doesNotMatch(result.content,/HIDDEN SECRET|PRIVATE DRAFT/);assert.equal(doc.documentElement.outerHTML,before);});
// Each blocked source is checked at extraction time, independently of the popup.
for(const name of ['subscription','metadata','incomplete','subscription-message']) test(`blocks extraction: ${name}`,async()=>{const doc=await fixture(name);assert.throws(()=>extract(doc),/restricted or uncertain/);});
test('hidden gates do not block a freely displayed article',async()=>{const doc=await fixture('public');doc.body.insertAdjacentHTML('beforeend','<div hidden class="paywall">Subscribe to continue</div>');assert.equal(analyze(doc).status,'Free article');});
test('nested restricted JSON-LD is detected without extracting articleBody',async()=>{const doc=await fixture('public');const script=doc.createElement('script');script.type='application/ld+json';script.textContent=JSON.stringify({'@graph':[{'isAccessibleForFree':'false',articleBody:'PRIVATE'}]});doc.head.append(script);assert.equal(analyze(doc).status,'Hard paywall');assert.throws(()=>extract(doc));});
test('signs of visual clipping block reading',async()=>{const doc=await fixture('public');const article=doc.querySelector('article');article.style.overflow='hidden';Object.defineProperty(article,'scrollHeight',{value:900});Object.defineProperty(article,'clientHeight',{value:100});assert.equal(analyze(doc).status,'Possible soft paywall');assert.throws(()=>extract(doc));});
test('hidden ancestor content is excluded',async()=>{const doc=await fixture('public');doc.querySelector('article').insertAdjacentHTML('beforeend','<section style="opacity:0"><p>INVISIBLE CONTENT TO EXCLUDE</p></section>');assert.doesNotMatch(extract(doc).content,/INVISIBLE CONTENT/);});

test('explicit free metadata does not cause a false restriction',async()=>{const doc=await fixture('public');doc.head.insertAdjacentHTML('beforeend','<meta name="isAccessibleForFree" content="true">');assert.equal(analyze(doc).status,'Free article');});
test('paid content tier metadata blocks reader',async()=>{const doc=await fixture('public');doc.head.insertAdjacentHTML('beforeend','<meta property="article:content_tier" content="paid">');assert.equal(analyze(doc).status,'Hard paywall');assert.throws(()=>extract(doc));});

test('an unrecognized visible modal makes access uncertain',async()=>{const doc=await fixture('public');doc.body.insertAdjacentHTML('beforeend','<div role="dialog" aria-modal="true">Become a member</div>');assert.equal(analyze(doc).status,'Possible soft paywall');assert.throws(()=>extract(doc));});

test('screen reader clipping does not flag a public article',async()=>{const doc=await fixture('public');const span=doc.querySelector('span');Object.defineProperty(span,'scrollHeight',{value:100});Object.defineProperty(span,'clientHeight',{value:1});assert.equal(analyze(doc).status,'Free article');assert.doesNotMatch(extract(doc).content,/Screen reader navigation label/);});
test('article body takes priority over clipped unrelated content in main',async()=>{const doc=await fixture('public');const article=doc.querySelector('article');const main=doc.createElement('main');article.replaceWith(main);main.append(article);const card=doc.createElement('p');card.textContent='Unrelated teaser';card.style.overflow='hidden';Object.defineProperty(card,'scrollHeight',{value:100});Object.defineProperty(card,'clientHeight',{value:1});main.prepend(card);assert.equal(analyze(doc).status,'Free article');});

test('a clipped ancestor around the article still blocks extraction',async()=>{const doc=await fixture('public');const article=doc.querySelector('article');const wrapper=doc.createElement('div');wrapper.style.overflow='hidden';Object.defineProperty(wrapper,'scrollHeight',{value:900});Object.defineProperty(wrapper,'clientHeight',{value:100});article.replaceWith(wrapper);wrapper.append(article);assert.equal(analyze(doc).status,'Possible soft paywall');assert.throws(()=>extract(doc));});
