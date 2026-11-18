import type { Analysis } from './article';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let tabId:number; let info:Analysis;
const read=$<HTMLButtonElement>('read');
function error(e:unknown){$('error').textContent=e instanceof Error?e.message:String(e);}
$('theme').addEventListener('click',()=>{const dark=getComputedStyle(document.body).colorScheme!=='dark';document.body.classList.toggle('dark',dark);document.body.classList.toggle('light',!dark);});
async function invoke(action:'analyze'|'extract'){
 const results=await chrome.scripting.executeScript({target:{tabId},func:(operation)=>{
  const api=(globalThis as typeof globalThis & {openArticle:{analyze:()=>unknown;extract:()=>unknown}}).openArticle;
  try{return {ok:true,data:api[operation]()};}catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)};}
 },args:[action]});
 const result=results[0]?.result;
 if(!result?.ok) throw new Error(result?.error||'This page could not be read.');
 return result.data;
}
read.addEventListener('click',async()=>{read.disabled=true;try{
 const article=await invoke('extract');
 const id=crypto.randomUUID();
 await chrome.storage.session.set({[id]:{article,created:Date.now()}});
 try {await chrome.tabs.create({url:chrome.runtime.getURL(`reader.html?id=${id}`)});} catch(e){await chrome.storage.session.remove(id);throw e;}
 window.close();
}catch(e){error(e);read.disabled=false;}});
$('find').addEventListener('click',()=>{
 $('search').hidden=false;const queries=$('queries');queries.replaceChildren();
 const title='"'+info.title.replace(/["\\]/g,'')+'"';
 for(const [label,query] of [['Search exact title',title],['Search publisher-provided versions',`${title} "${info.publisher.replace(/["\\]/g,'')}"`],['Search syndicated copies',`${title} syndicated OR "republished with permission" OR "originally published"`]]){
 const a=document.createElement('a');a.textContent=label+' ↗';a.href='https://www.google.com/search?q='+encodeURIComponent(query);a.target='_blank';a.rel='noopener noreferrer';queries.append(a);
 }
});
(async()=>{try{
 const transfers=await chrome.storage.session.get(null);
 const expired=Object.entries(transfers).filter(([,v])=>!v || typeof (v as {created?:number}).created!=='number' || Date.now()-(v as {created:number}).created>300000).map(([key])=>key);
 if(expired.length) await chrome.storage.session.remove(expired);
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tab?.id || !tab.url || !/^https?:/.test(tab.url)) throw new Error('Open a public HTTP or HTTPS article first. Chrome internal pages and local files are unsupported.');
 tabId=tab.id;
 await chrome.scripting.executeScript({target:{tabId},files:['content.js']});
 info=await invoke('analyze') as Analysis;
 $('publisher').textContent=info.publisher;$('title').textContent=info.title||'Untitled page';$('status').textContent=info.status;
 for(const reason of info.reasons){const li=document.createElement('li');li.textContent=reason;$('reasons').append(li);}
 const original=$<HTMLAnchorElement>('original');original.href=info.url;
 read.disabled=!info.readable;$<HTMLButtonElement>('find').disabled=!info.title;
}catch(e){$('title').textContent='This page is unavailable';$('status').textContent='Unknown';error(e);}})();
