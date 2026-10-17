// 隔离浏览器故障注入：不联网、不写生产；返回逐项证据。
async page => {
 const origin = new URL(page.url()).origin;
 if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('仅限本地测试');
 await page.evaluate(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();});
 await page.goto('about:blank');
 await page.goto(origin+'/games/basket/');
 const results = [];
 const check = (name, ok, detail) => results.push({name, ok:!!ok, detail});
 for (const game of ['basket','sort','helper']) {
  for (const event of ['blur','resize','pagehide','lostpointercapture','visibilitychange']) {
   await page.goto(`${origin}/games/${game}/?maintenance=${Date.now()}`);
   const result = await page.evaluate(async ({game,event}) => {
    const wait = ms => new Promise(r=>setTimeout(r,ms));
    let el;
    if(game==='helper'){phase='give';taskSpeaking=false;heldItem=target.item;heldEl.textContent=heldItem.emoji;handEl.classList.add('full');el=heldEl;}
    else {phase='play';el=document.querySelector(game==='basket'?'.fruit':'.item');}
    const send=(type,id,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y}));
    const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    const before=game==='basket'?missStreak:game==='sort'?el.dataset.wrong:heldItem;
    send('pointerdown',71,x,y);send('pointermove',71,x+60,y-40);
    send('pointercancel',99,x,y);send('lostpointercapture',99,x,y);
    const foreignPreserved=el.classList.contains('lift');
    if(event==='visibilitychange'){
     Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event(event));
     delete document.hidden;
    }else if(event==='lostpointercapture')send(event,71,x+60,y-40);else window.dispatchEvent(new Event(event));
    const cleared=!el.classList.contains('lift')&&el.dataset.dragging!=='1';
    send('pointerup',71,x+60,y-40);
    await wait(510);
    const r2=el.getBoundingClientRect();send('pointerdown',72,r2.x+10,r2.y+10);
    const grabbed=el.classList.contains('lift');send('pointercancel',72,r2.x+10,r2.y+10);
    const after=game==='basket'?missStreak:game==='sort'?el.dataset.wrong:heldItem;
    return {cleared,grabbed,foreignPreserved,noPenalty:before===after};
   },{game,event});
   check(`${game}: ${event}释放并能再抓`,result.cleared&&result.grabbed&&result.noPenalty&&result.foreignPreserved,result);
  }
 }
 await page.goto(`${origin}/games/basket/?maintenance=${Date.now()}`);
 const before=await page.evaluate(()=>{
  phase='play';vEl.play=()=>Promise.resolve();
  fruitEls.forEach(flyIn);return fruit.key;
 });
 await page.waitForTimeout(15000);
 const after=await page.evaluate(()=>({phase,key:fruit.key,inCount}));
 check('basket: 媒体不发结束或错误事件仍换轮',after.key!==before&&after.inCount===0,after);
 await page.goto(`${origin}/games/basket/?maintenance=${Date.now()}`);
 const duplicate=await page.evaluate(async()=>{
  let n=0;vEl.play=()=>Promise.reject(Error('blocked'));
  playVoice('audio/count_1.mp3',()=>n++);vEl.dispatchEvent(new Event('error'));
  await new Promise(r=>setTimeout(r,650));return n;
 });
 check('basket: reject与error同时发生只回调一次',duplicate===1,duplicate);
 return {passed:results.filter(x=>x.ok).length,total:results.length,results};
}
