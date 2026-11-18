import { Readability } from '@mozilla/readability';
export type Status = 'Free article' | 'Possible soft paywall' | 'Hard paywall' | 'Unknown';
export interface Analysis { title:string; publisher:string; url:string; status:Status; reasons:string[]; readable:boolean; }
const subscription = /subscribe to (continue|read|unlock)|subscription required|subscribers?[- ]only|sign in to (continue|read)|purchase (this|the) article|unlock (this|the|full) article|you.{0,12}(reached|used).{0,25}(limit|free articles)/i;
const gateSelector = '[class*="paywall" i], [id*="paywall" i], [class*="subscription-wall" i], [data-paywall], [data-testid*="paywall" i], [role="dialog"], [aria-modal="true"]';
export function visible(el:Element):boolean {
  for(let node:Element|null=el;node;node=node.parentElement){
    const s=node.ownerDocument.defaultView?.getComputedStyle(node);
    if(node.hasAttribute('hidden') || node.getAttribute('aria-hidden')==='true' || node.hasAttribute('inert') || s?.display==='none' || s?.visibility==='hidden' || s?.visibility==='collapse' || s?.getPropertyValue('content-visibility')==='hidden' || (s?.clipPath && s.clipPath!=='none') || (s?.clip && s.clip!=='auto') || s?.opacity==='0' || (s?.filter && s.filter!=='none')) return false;
  } return true;
}
function metadataRestricted(doc:Document):boolean {
  let restricted=false;
  const walk=(value:unknown):void=>{
    if(!value || typeof value!=='object') return;
    for(const [key,v] of Object.entries(value)) {
      if(key==='isAccessibleForFree' && (v===false || v==='false' || v==='False')) restricted=true;
      if(typeof v==='object') walk(v);
    }
  };
  for(const script of doc.querySelectorAll('script[type="application/ld+json"]')) {try{walk(JSON.parse(script.textContent||''));}catch{/* Malformed publisher metadata is ignored. */}}
  for(const meta of doc.querySelectorAll('meta')) {
    const name=meta.getAttribute('property')||meta.getAttribute('name')||'';
    const value=meta.getAttribute('content')||'';
    if((/^isAccessibleForFree$/i.test(name) && /^false$/i.test(value)) || (/^(article:content_tier|content-access)$/i.test(name) && /^(paid|premium|restricted)$/i.test(value)) || (/^cXenseParse:recs:premium$/i.test(name) && /^true$/i.test(value))) restricted=true;
  }
  return restricted;
}
export function analyze(doc:Document):Analysis {
  const root=doc.querySelector('[itemprop="articleBody"]') || doc.querySelector('article') || doc.querySelector('main');
  const title=(doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.querySelector('h1')?.textContent || doc.title).trim().slice(0,500);
  const url=doc.URL;
  const publisher=(doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || new URL(url).hostname).slice(0,200);
  const reasons:string[]=[];
  const restricted=metadataRestricted(doc);
  const gates=[...doc.querySelectorAll(gateSelector)].filter(visible);
  const gate=gates.some(el=>subscription.test(el.textContent||'') || /paywall|subscription-wall/i.test(el.id+' '+el.className));
  const visibleText=[...doc.querySelectorAll('p,h1,h2,h3,div,span')].filter(el=>el.children.length===0 && visible(el)).map(el=>el.textContent).join(' ');
  const message=subscription.test(visibleText);
  const modal=gates.some(el=>el.matches('[aria-modal="true"], [role="dialog"]'));
  const text=root ? [...root.querySelectorAll('p')].filter(visible).map(el=>el.textContent).join(' ') : '';
  const ancestors:Element[]=[];
  for(let el=root?.parentElement;el;el=el.parentElement) ancestors.push(el);
  const clipped=!!root && [root,...root.querySelectorAll('*'),...ancestors].some(el=>{
    if(!visible(el) || (!el.matches('p') && !el.querySelector('p'))) return false;
    const s=doc.defaultView?.getComputedStyle(el);
    return !!s && ((/hidden|clip/.test(s.overflow+s.overflowY) && el.scrollHeight>el.clientHeight+8) || (s.getPropertyValue('-webkit-line-clamp')!=='' && s.getPropertyValue('-webkit-line-clamp')!=='none' && s.getPropertyValue('-webkit-line-clamp')!=='0'));
  });
  if(restricted) reasons.push('Publisher metadata marks content as restricted.');
  if(gate) reasons.push('A visible subscription gate or overlay was detected.');
  if(message) reasons.push('The page contains a subscription or sign-in message.');
  if(modal && !gate) reasons.push('A visible dialog makes access uncertain. Close it on the original page and try again.');
  if(clipped) reasons.push('The article appears visually clipped.');
  if(root && text.length>0 && text.length<650) reasons.push('Only a short article or preview is available.');
  const status:Status=restricted||gate ? 'Hard paywall' : message||clipped||modal||(!!root&&text.length>0&&text.length<650) ? 'Possible soft paywall' : root&&text.length>=650 ? 'Free article' : 'Unknown';
  if(!reasons.length) reasons.push(status==='Free article'?'No common restriction indicators found.':'No clear article body found.');
  return {title,publisher,url,status,reasons,readable:status==='Free article'};
}
export function extract(doc:Document) {
  const info=analyze(doc);
  if(!info.readable) throw new Error('Reader unavailable: access is restricted or uncertain. Read on the publisher’s site or find a legitimate public version.');
  const clone=doc.cloneNode(true) as Document;
  const original=[...doc.querySelectorAll('*')]; const copies=[...clone.querySelectorAll('*')];
  original.forEach((el,i)=>{if(!visible(el)) copies[i]?.remove();});
  clone.querySelectorAll('script,style,noscript,template,iframe,form,button,nav,aside,header,footer,[role="dialog"], [aria-modal="true"]').forEach(el=>el.remove());
  // Never extract from JSON, hidden DOM, network endpoints, or publisher state.
  const article=new Readability(clone).parse();
  if(!article?.content || article.textContent!.trim().length<200) throw new Error('No readable article found. Open the original article instead.');
  return {...info,content:article.content,byline:article.byline||'',excerpt:article.excerpt||''};
}
