import {chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// Test the shipped manifest. Chrome's toolbar action grants activeTab; no extra
// host permissions or test-only manifest modifications are necessary.
export async function launchExtension() {
 const profile=await mkdtemp(join(tmpdir(),'openarticle-test-'));
 const context=await chromium.launchPersistentContext(profile,{
  channel:'chromium',headless:process.env.OPENARTICLE_HEADED!=='1',
  ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']
 });
 const cdp=await context.browser().newBrowserCDPSession();
 const {id}=await cdp.send('Extensions.loadUnpacked',{path:resolve('dist')});
 for(let n=0;n<50;n++) {
  const {extensions}=await cdp.send('Extensions.getExtensions');
  if(extensions.some(e=>e.id===id&&e.enabled)) break;
  await new Promise(r=>setTimeout(r,50));
 }
 async function openPopup(source) {
  await source.bringToFront();
  const {targetInfos:tabs}=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false},{exclude:true}]});
  const tab=tabs.find(t=>t.url===source.url());
  if(!tab) throw new Error('No browser tab target found for '+source.url());
  await cdp.send('Extensions.triggerAction',{id,targetId:tab.targetId});
  let target;
  for(let n=0;n<100;n++) {
   const {targetInfos}=await cdp.send('Target.getTargets');
   target=targetInfos.find(t=>t.url===`chrome-extension://${id}/popup.html`);
   if(target) break;
   await new Promise(r=>setTimeout(r,50));
  }
  if(!target) throw new Error('Chrome did not open the toolbar popup');
  // Browser toolbar popups are not tabs; Playwright deliberately excludes them
  // from context.pages(). Attach directly to their real DevTools targets.
  const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
  let counter=0;const pending=new Map();
  const receive=({sessionId:session,message})=>{
   if(session!==sessionId)return;
   const reply=JSON.parse(message);const call=pending.get(reply.id);
   if(call){pending.delete(reply.id);clearTimeout(call.timeout);reply.error?call.reject(new Error(reply.error.message)):call.resolve(reply.result);}
  };
  cdp.on('Target.receivedMessageFromTarget',receive);
  function send(method,params={}) {
   return new Promise((resolve,reject)=>{
    const requestId=++counter;
    const timeout=setTimeout(()=>{pending.delete(requestId);reject(new Error(`Popup ${method} timed out`));},10000);
    pending.set(requestId,{resolve,reject,timeout});
    cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:requestId,method,params})}).catch(error=>{clearTimeout(timeout);pending.delete(requestId);reject(error);});
   });
  }
  return {
   async evaluate(fn,arg) {
    const result=await send('Runtime.evaluate',{expression:`(${fn.toString()})(${JSON.stringify(arg)??'undefined'})`,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.text+': '+result.exceptionDetails.exception?.description);
    return result.result.value;
   },
   async screenshot(path){const {data}=await send('Page.captureScreenshot',{format:'png'});const {writeFile}=await import('node:fs/promises');await writeFile(path,Buffer.from(data,'base64'));},
   async close(){cdp.off('Target.receivedMessageFromTarget',receive);await cdp.send('Target.closeTarget',{targetId:target.targetId}).catch(()=>{});},
   dispose(){cdp.off('Target.receivedMessageFromTarget',receive);}
  };
 }
 return {context,id,cdp,openPopup,async close(){await context.close();await rm(profile,{recursive:true,force:true});}};
}
