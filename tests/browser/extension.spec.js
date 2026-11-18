import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {launchExtension} from '../helpers/extension.mjs';
let app,context,server,origin;
test.beforeAll(async()=>{
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname.slice(1);if(!/^[a-z-]+\.(html|svg)$/.test(name)){res.writeHead(404);res.end();return;}const data=await readFile(resolve('tests/fixtures',name));res.setHeader('Content-Type',name.endsWith('.svg')?'image/svg+xml':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
 app=await launchExtension();context=app.context;
});
test.afterAll(async()=>{await app?.close();if(server)await new Promise(r=>server.close(r));});
async function openPopup(fixture){const source=await context.newPage();await source.goto(`${origin}/${fixture}.html`);const popup=await app.openPopup(source);return {source,popup};}
const status=p=>p.evaluate(()=>document.querySelector('#status')?.textContent);
const click=(p,id)=>p.evaluate(id=>{setTimeout(()=>document.getElementById(id).click(),0);},id);
test('real toolbar grants activeTab with the unchanged production manifest',async()=>{
 const {source,popup}=await openPopup('public');await expect.poll(()=>status(popup)).toBe('Free article');
 const permissions=await popup.evaluate(()=>chrome.permissions.getAll());expect(permissions.origins||[]).toEqual([]);expect(permissions.permissions.sort()).toEqual(['activeTab','scripting','storage']);
 expect(await popup.evaluate(()=>document.querySelector('#error').textContent)).toBe('');
 await popup.close();await source.close();
});
test('public reader preserves source, headings, images, controls and progress',async()=>{
 const {source,popup}=await openPopup('public');const before=await source.locator('html').innerHTML();await expect.poll(()=>status(popup)).toBe('Free article');
 const next=context.waitForEvent('page');await click(popup,'read');const reader=await next;popup.dispose();
 await expect(reader.locator('#title')).toHaveText('A railway yard becomes a community garden');await expect(reader.locator('#article h2')).toHaveText('A place to grow');await expect(reader.locator('#article')).not.toContainText('HIDDEN SECRET');
 const image=reader.locator('#article img');await expect(image).not.toHaveAttribute('src');await reader.locator('#images').click();await expect(image).toHaveAttribute('src',`${origin}/garden.svg`);await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
 await reader.locator('#larger').click();await expect(reader.locator('html')).toHaveCSS('--size','22px');await reader.locator('#smaller').click();await expect(reader.locator('html')).toHaveCSS('--size','20px');
 const background=await reader.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);await reader.locator('#theme').click();expect(await reader.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe(background);
 await reader.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await expect(reader.locator('#progress')).toHaveAttribute('aria-valuenow','100');
 expect(await source.locator('html').innerHTML()).toBe(before);
 await reader.reload();await expect(reader.locator('#error')).toContainText('expired');await reader.close();await source.close();
});
for(const [name,expected] of [['subscription','Hard paywall'],['metadata','Hard paywall'],['incomplete','Possible soft paywall'],['subscription-message','Possible soft paywall'],['unknown','Unknown']])test(`toolbar blocks reader on ${name}`,async()=>{
 const {source,popup}=await openPopup(name);await expect.poll(()=>status(popup)).toBe(expected);expect(await popup.evaluate(()=>document.querySelector('#read').disabled)).toBe(true);await popup.close();await source.close();
});
test('syndicated search opens the encoded query without claiming verified access',async()=>{
 const {source,popup}=await openPopup('syndicated');await expect.poll(()=>status(popup)).toBe('Free article');await click(popup,'find');
 expect(await popup.evaluate(()=>document.querySelector('#search').textContent)).toContain('unverified');const links=await popup.evaluate(()=>[...document.querySelectorAll('#queries a')].map(a=>a.href));expect(links).toHaveLength(3);
 for(const href of links){const url=new URL(href);expect(url.origin).toBe('https://www.google.com');expect(url.searchParams.get('q')).toContain('A railway yard becomes a community garden');}
 // Avoid sending a real search in a deterministic regression test.
 await context.route('https://www.google.com/search?*',route=>route.fulfill({contentType:'text/html',body:'<h1>Test search destination</h1>'}));
 const next=context.waitForEvent('page');await popup.evaluate(()=>{setTimeout(()=>document.querySelector('#queries a').click(),0);});const search=await next;await expect(search).toHaveURL(links[0]);await search.close();await context.unroute('https://www.google.com/search?*');await popup.close();await source.close();
});
test('Open Original Article opens the original URL',async()=>{
 const {source,popup}=await openPopup('public');await expect.poll(()=>status(popup)).toBe('Free article');const next=context.waitForEvent('page');await click(popup,'original');const original=await next;await expect(original).toHaveURL(source.url());await original.close();await popup.close();await source.close();
});
