// 浏览器真实捕获 + 合成双指归属；独立于布局与音频夹具。
async page=>{
 const origin=new URL(page.url()).origin;
 if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('仅限本地测试');
 await page.evaluate(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();});await page.goto('about:blank');
 const results=[];const check=(name,ok,detail)=>results.push({name,ok:!!ok,detail});
 for(const game of ['basket','sort','helper']){
  await page.goto(`${origin}/games/${game}/?maintenance=${Date.now()}`);
  const selector=await page.evaluate(game=>{
   if(game==='helper'){phase='give';taskSpeaking=false;heldItem=target.item;heldEl.textContent=heldItem.emoji;handEl.classList.add('full');return '#held';}
   phase='play';return game==='basket'?'.fruit':'.item';
  },game);
  const el=game==='helper'?page.locator('#hand .held'):page.locator(selector).first();
  // 用实际DOM id寻找手中物件，避免假定固定结构。
  const actual=game==='helper'?await page.evaluate(()=>heldEl.id):null;
  const target=actual?page.locator('#'+actual):el;
  await target.evaluate(e=>{e.style.animation='none';e.addEventListener('pointerdown',p=>window.__testPointer=p.pointerId);});
  const r=await target.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+35,r.y+r.height/2-20);
  check(game+': 真实浏览器已捕获',await target.evaluate(e=>e.hasPointerCapture(window.__testPointer)));
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  check(game+': blur主动释放真实捕获',await target.evaluate(e=>!e.hasPointerCapture(window.__testPointer)&&!e.classList.contains('lift')));
  await page.mouse.up();await page.waitForTimeout(500);
  const r2=await target.boundingBox();await page.mouse.move(r2.x+r2.width/2,r2.y+r2.height/2);await page.mouse.down();await page.mouse.move(r2.x+r2.width/2+20,r2.y+r2.height/2);
  await target.evaluate(e=>e.releasePointerCapture(window.__testPointer));await page.mouse.move(r2.x+r2.width/2+25,r2.y+r2.height/2);
  check(game+': 真实lostcapture清理',await target.evaluate(e=>!e.classList.contains('lift')));await page.mouse.up();
  if(game==='helper')continue;
  for(const order of [[11,12],[12,11]]){
   await page.reload();
   const detail=await page.evaluate(({game,order})=>{
    phase='play';const els=[...document.querySelectorAll(game==='basket'?'.fruit':'.item')].slice(0,2);
    const send=(i,type,id)=>{const r=els[i].getBoundingClientRect();els[i].dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,clientX:r.x+10,clientY:r.y+10}));};
    els.forEach((e,i)=>send(i,'pointerdown',11+i));const both=els.every(e=>e.classList.contains('lift'));
    send(order[0]-11,'pointercancel',order[0]);const otherHeld=els[order[1]-11].classList.contains('lift');
    send(order[1]-11,'pointercancel',order[1]);return {both,otherHeld,cleared:els.every(e=>!e.classList.contains('lift'))};
   },{game,order});
   check(game+': 双指取消顺序 '+order.join(','),detail.both&&detail.otherHeld&&detail.cleared,detail);
  }
 }
 return {passed:results.filter(r=>r.ok).length,total:results.length,results};
}
