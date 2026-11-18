import DOMPurify from 'dompurify';
export function sanitize(content:string,base:string):DocumentFragment {
 const fragment=DOMPurify.sanitize(content,{RETURN_DOM_FRAGMENT:true,ALLOWED_TAGS:['p','h1','h2','h3','h4','h5','h6','blockquote','ul','ol','li','strong','em','b','i','a','img','figure','figcaption','br','hr','pre','code','table','thead','tbody','tr','td','th','sup','sub','div','span'],ALLOWED_ATTR:['href','src','alt','title'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false});
 for(const el of fragment.querySelectorAll('a,img')) {
  const attr=el.tagName==='A'?'href':'src'; const value=el.getAttribute(attr);el.removeAttribute(attr);
  if(!value) continue;
  try{const url=new URL(value,base);if(!/^https?:$/.test(url.protocol)) continue;
   if(attr==='src'){el.setAttribute('data-image-url',url.href);el.setAttribute('loading','lazy');el.setAttribute('referrerpolicy','no-referrer');}
   else {el.setAttribute('href',url.href);el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer');}
  }catch{/* Invalid URLs are omitted. */}
 }
 return fragment;
}
