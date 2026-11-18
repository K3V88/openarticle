import {mkdir,writeFile} from 'node:fs/promises';
import {launchExtension} from '../tests/helpers/extension.mjs';

const input=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
const extractionRequested=process.argv.includes('--extract');
if(!input) throw new Error('Usage: npm run inspect:access -- https://publisher.example/article');
const url=new URL(input);
if(!/^https?:$/.test(url.protocol)||url.username||url.password) throw new Error('Provide an HTTP/HTTPS URL without embedded credentials.');
const report={url:url.href,checkedAt:new Date().toISOString(),profile:'Isolated, signed out',scope:extractionRequested?'Run the existing guarded extractor and report success or refusal; no hidden-content disclosure, access-control changes, alternate endpoints, or crawler impersonation.':'Observation only; no article extraction, hidden-content disclosure, access-control changes, alternate endpoints, or crawler impersonation.'};
const app=await launchExtension();let popup;
try {
 const page=await app.context.newPage();
 const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});
 report.httpStatus=response?.status()??null;
 const headers=response?.headers()||{};
 report.responseHeaders=Object.fromEntries(['server','content-type','cf-mitigated'].filter(key=>headers[key]).map(key=>[key,headers[key]]));
 report.observedPage=await page.evaluate(()=>{
  const visible=el=>{for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);if(n.hidden||n.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false;}return true;};
  let restrictedMetadata=false;
  const walk=value=>{if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){if(key==='isAccessibleForFree'&&(v===false||v==='false'))restrictedMetadata=true;if(v&&typeof v==='object')walk(v);}};
  for(const el of document.querySelectorAll('script[type="application/ld+json"]')){try{walk(JSON.parse(el.textContent||''));}catch{}}
  const gateCount=[...document.querySelectorAll('[class*="paywall" i],[id*="paywall" i],[data-paywall]')].filter(visible).length;
  const dialogCount=[...document.querySelectorAll('[role="dialog"],[aria-modal="true"]')].filter(visible).length;
  return {documentTitle:document.title.slice(0,180),restrictedJsonLd:restrictedMetadata,visibleGateCount:gateCount,visibleDialogCount:dialogCount,articleElementPresent:!!document.querySelector('article,[itemprop="articleBody"]')};
 });
 popup=await app.openPopup(page);
 for(let n=0;n<100;n++){
  const observation=await popup.evaluate(()=>({status:document.querySelector('#status')?.textContent,reasons:[...document.querySelectorAll('#reasons li')].map(el=>el.textContent),error:document.querySelector('#error')?.textContent}));
  if(observation.status&&observation.status!=='Analyzing'){report.extension=observation;break;}
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 if(extractionRequested) {
  report.extraction=await popup.evaluate(async()=>{
   const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
   const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
    try {
     const article=globalThis.openArticle.extract();
     const parsed=new DOMParser().parseFromString(article.content,'text/html');
     return {attempted:true,succeeded:true,title:article.title,textCharacters:(parsed.body.textContent||'').trim().length,paragraphs:parsed.querySelectorAll('p').length};
    } catch(error){return {attempted:true,succeeded:false,textCharacters:0,error:error.message};}
   }});
   return results[0]?.result||{attempted:false,succeeded:false,error:'No script result returned'};
  });
 }
 report.interpretation=report.httpStatus===403
  ? 'The HTTP response refused this request before a usable article page was available. This does not establish whether the cause is bot filtering, subscription checks, location policy, or another server rule. The subscription mechanism and server-side article delivery remain unverified.'
  : report.httpStatus===200
   ? 'The server returned a document. Visible markers and restricted metadata are evidence for a heuristic classification, not proof of the subscription implementation or your entitlement. A signed-out test cannot establish what a subscriber receives.'
   : 'The response does not establish the publisher’s subscription mechanism. Check the status and observed page before interpreting the extension result.';
} catch(error){report.error=error.message;process.exitCode=1;}
finally {
 await popup?.close();await app.close();
 await mkdir('artifacts/access',{recursive:true});
 await writeFile('artifacts/access/report.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
