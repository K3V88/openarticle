import {launchExtension} from '../tests/helpers/extension.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts/live',{recursive:true});
const report={checkedAt:new Date().toISOString(),browser:'Chromium, actual toolbar action, unchanged production manifest',pages:[]};
const app=await launchExtension();
const urls=[
 ['nasa','https://www.nasa.gov/centers-and-facilities/johnson/the-international-space-station-marks-25-years-of-continuous-human-presence/'],
 ['syndicated','https://www.unsw.edu.au/newsroom/news/2026/10/we-must-prepare-entire-cities-for-extreme-heat-our-new-study-reveals-how']
];
try {
 for(const [name,url] of urls){
  const result={name,url};report.pages.push(result);const source=await app.context.newPage();let popup;
  try {
   const response=await source.goto(url,{waitUntil:'domcontentloaded',timeout:45000});result.httpStatus=response?.status();
   await source.locator('h1').first().waitFor({timeout:15000});
   await source.waitForFunction(()=>[...document.querySelectorAll('main p,article p')].filter(p=>p.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})).reduce((n,p)=>n+(p.textContent?.length||0),0)>650,{},{timeout:15000});
   if(name==='syndicated') {
    const essential=source.getByRole('button',{name:'Accept only essential',exact:true}).first();
    try {await essential.waitFor({state:'visible',timeout:5000});await essential.click();await essential.waitFor({state:'hidden'});result.cookieConsent='Accepted only essential cookies using the publisher button';} catch(error){if(error.name!=='TimeoutError')throw error;}
   }
   popup=await app.openPopup(source);
   let snapshot;
   for(let n=0;n<100;n++){
    snapshot=await popup.evaluate(()=>({title:document.querySelector('#title')?.textContent,status:document.querySelector('#status')?.textContent,reasons:[...document.querySelectorAll('#reasons li')].map(e=>e.textContent),error:document.querySelector('#error')?.textContent,readDisabled:document.querySelector('#read')?.disabled}));
    if(typeof snapshot.status==='string'&&snapshot.status!=='Analyzing')break;
    await new Promise(r=>setTimeout(r,50));
   }
   Object.assign(result,snapshot);
   if(name==='syndicated'){
    const licensing=await source.evaluate(()=>{
     const text=document.body.innerText;const match=text.match(/This article is republished from[^.]*Creative Commons[^.]*\./i);
     const original=[...document.querySelectorAll('a[href]')].find(a=>/original article/i.test(a.textContent||''));
     return {republishingNotice:match?.[0]||null,originalUrl:original?.href||null};
    });result.licensing=licensing;
   }
   if(snapshot.status!=='Free article')throw new Error('Live reader not available: '+snapshot.status+' '+snapshot.reasons.join(' '));
   const next=app.context.waitForEvent('page');await popup.evaluate(()=>document.querySelector('#read').click());const reader=await next;popup.dispose();popup=null;
   await reader.locator('#article p').first().waitFor({timeout:10000});
   const extraction=await reader.evaluate(()=>({title:document.querySelector('#title').textContent,paragraphs:document.querySelectorAll('#article p').length,headings:document.querySelectorAll('#article h2,#article h3').length,images:document.querySelectorAll('#article img').length,characters:document.querySelector('#article').textContent.length,source:document.querySelector('#original').href}));
   assert.ok(extraction.characters>650);assert.equal(extraction.source,source.url());assert.equal(extraction.title,snapshot.title);result.reader=extraction;
   const theme=await reader.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);await reader.locator('#theme').click();assert.notEqual(await reader.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),theme);
   await reader.locator('#larger').click();assert.equal(await reader.locator('html').evaluate(e=>getComputedStyle(e).getPropertyValue('--size')),'22px');
   await reader.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await reader.waitForFunction(()=>document.querySelector('#progress').getAttribute('aria-valuenow')==='100');result.controls='theme, font size and progress passed';
   await reader.screenshot({path:`artifacts/live/${name}-reader.png`});await reader.close();result.outcome='passed';
  } catch(error){result.outcome='blocked or failed';result.failure=error.message;process.exitCode=1;}
  finally{await popup?.close();await source.close();}
  console.log(JSON.stringify(result,null,2));
 }
}finally{await app.close();await writeFile('artifacts/live/report.json',JSON.stringify(report,null,2)+'\n');}
