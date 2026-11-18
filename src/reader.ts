import { sanitize } from './sanitize';
const $=(id:string)=>document.getElementById(id)!;
let size=20;
$('smaller').addEventListener('click',()=>{size=Math.max(14,size-2);document.documentElement.style.setProperty('--size',size+'px');update();});
$('larger').addEventListener('click',()=>{size=Math.min(32,size+2);document.documentElement.style.setProperty('--size',size+'px');update();});
$('theme').addEventListener('click',()=>{const dark=getComputedStyle(document.body).colorScheme!=='dark';document.body.classList.toggle('dark',dark);document.body.classList.toggle('light',!dark);});
function update(){const max=document.documentElement.scrollHeight-innerHeight;const percent=max>0?Math.min(100,Math.max(0,scrollY/max*100)):100;$('progress').style.width=percent+'%';$('progress').setAttribute('aria-valuenow',String(Math.round(percent)));}
addEventListener('scroll',update,{passive:true});addEventListener('resize',update);new ResizeObserver(update).observe(document.body);
$('images').addEventListener('click',()=>{for(const img of document.querySelectorAll<HTMLImageElement>('img[data-image-url]')){img.src=img.dataset.imageUrl!;delete img.dataset.imageUrl;}$('images').hidden=true;});
(async()=>{try{
 const id=new URL(location.href).searchParams.get('id');if(!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Open an article using the extension popup.');
 const stored=(await chrome.storage.session.get(id))[id] as {created:number;article:{content:string;url:string;title:string;publisher:string;byline:string}}|undefined;await chrome.storage.session.remove(id);
 if(!stored || Date.now()-stored.created>300000) throw new Error('This reader session expired. Reopen the article from the popup.');
 const a=stored.article;if(!a || typeof a.content!=='string' || !/^https?:/.test(a.url)) throw new Error('Invalid article data.');
 document.title=a.title+' — OpenArticle';$('title').textContent=a.title;$('publisher').textContent=a.publisher;$('byline').textContent=a.byline;
 ($('original') as HTMLAnchorElement).href=a.url;
 $('article').replaceChildren(sanitize(a.content,a.url));
 const images=!!document.querySelector('img[data-image-url]');$('images').hidden=!images;$('image-notice').hidden=!images;update();
}catch(e){$('title').textContent='Article unavailable';$('error').textContent=e instanceof Error?e.message:String(e);}})();
