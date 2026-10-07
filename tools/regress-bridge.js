// 隔离 Playwright CLI run-code；只在本地8775验证，不调用生产或付费接口。
async page => {
 if(new URL(page.url()).origin!=='http://127.0.0.1:8775')throw Error('仅本地8775');
 const out='/Users/xuke/githubProject/monster/output/cookie-arcade/bridge-20261007';
 const results=[],errors=[],badResponses=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/attribute|path|SVG/.test(m.text()))errors.push(m.text());});
 page.on('response',r=>{if(r.url().includes('/games/bridge/')&&r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
 const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw Error(name);};
 const state=()=>page.evaluate(()=>({round,phase,selected,misses,slots:{short:boards.short.slot,long:boards.long.slot},held:pointers.size,ghosts:document.querySelectorAll('.ghost').length,done:complete()}));
 const center=async id=>page.locator('#'+id).evaluate(async el=>{await Promise.all(el.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));const b=el.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};});
 const cdp=await page.context().newCDPSession(page),touchIds=new Set();
 const send=async(type,points)=>{
  if((type==='touchCancel'||type==='touchEnd')&&!touchIds.size)return;
  await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  if(type==='touchStart')points.forEach(p=>touchIds.add(p.id));
  if(type==='touchEnd'){if(points.length)points.forEach(p=>touchIds.delete(p.id));else touchIds.clear();}
  if(type==='touchCancel')touchIds.clear();
  if(type==='touchStart'||type==='touchMove')await page.waitForFunction(ps=>ps.every(p=>Object.values(window.__bridgeTouch||{}).some(v=>Math.abs(v.x-p.x)<1&&Math.abs(v.y-p.y)<1)),points,{timeout:2000});
  else await page.waitForTimeout(240);
 };
 const setup=async n=>{await send('touchCancel',[]);await page.evaluate(async n=>{round=n;newRound();document.querySelector('#scene').getBoundingClientRect();await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));},n);await page.waitForTimeout(250);};
 const layout=()=>page.evaluate(()=>({wide:gaps[0].width>gaps[1].width?0:1,narrow:gaps[0].width<gaps[1].width?0:1}));
 const drag=async(id,slot)=>{const a=await center(id),b=await center('gap-'+slot);await send('touchStart',[{...a,id:1}]);await send('touchMove',[{...b,id:1}]);await send('touchEnd',[]);};
 const tapPlace=async(id,slot)=>{await page.locator('#'+id).tap();await page.locator('#gap-'+slot).tap();};
 try {
  await page.goto('http://127.0.0.1:8775/games/bridge/');await page.reload();await page.waitForTimeout(350);
  await page.evaluate(()=>{window.__bridgeTouch={};for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>{if(type==='pointerup'||type==='pointercancel')delete window.__bridgeTouch[e.pointerId];else window.__bridgeTouch[e.pointerId]={x:e.clientX,y:e.clientY};},true);});
  check('本轮代码与两河实际渲染',await page.evaluate(()=>typeof commitPlace==='function'&&document.querySelectorAll('#rivers path').length===4&&document.querySelector('#rivers path').getBBox().width>90));
  check('无可见文字UI',!(await page.locator('body').innerText()).trim());
  for(let n=0;n<4;n++){
   await setup(n);const {wide,narrow}=await layout();
   await drag('short',wide);await drag('short',wide);let s=await state();
   check(`布局${n} 短板不跨宽河且提示不代做`,s.slots.short===null&&s.slots.long===null&&s.misses===2&&await page.locator('#long').evaluate(el=>el.classList.contains('hint')),s);
   await drag('long',narrow);s=await state();check(`布局${n} 长板搭窄河合法`,s.slots.long===narrow&&!s.done,s);
   await drag('short',wide);s=await state();check(`布局${n} 材料不足真实保留`,s.slots.long===narrow&&s.slots.short===null,s);
   await drag('long',wide);await drag('short',narrow);s=await state();check(`布局${n} 能重排解开`,s.slots.long===wide&&s.slots.short===narrow&&s.done&&s.phase==='build',s);
   const before=s.round;await page.locator('#car').tap();check(`布局${n} 主动点车才出发`,(await state()).phase==='drive');
   await page.waitForFunction(r=>round>r,before,{timeout:5500});s=await state();check(`布局${n} 换轮无残留`,s.phase==='build'&&s.slots.short===null&&s.slots.long===null&&s.held===0&&s.ghosts===0,s);
  }
  // 点选等价，并能把已搭的木板拿回托盘。
  await setup(0);let {wide,narrow}=await layout();await tapPlace('long',wide);await tapPlace('short',narrow);check('点选与拖放等价',(await state()).done);
  let a=await center('long');const tray=await page.locator('#scene').boundingBox();let b={x:tray.x+tray.width*.71,y:tray.y+tray.height*.87};
  await send('touchStart',[{...a,id:1}]);await send('touchMove',[{...b,id:1}]);await send('touchEnd',[]);let s=await state();check('已放木板能拿回再用',s.slots.long===null&&s.slots.short===narrow&&!s.done,s);
  await drag('long',wide);check('托盘长板重新搭到宽河',(await state()).slots.long===wide);a=await center('long');b=await center('gap-'+narrow);await send('touchStart',[{...a,id:1}]);await send('touchMove',[{...b,id:1}]);await send('touchEnd',[]);s=await state();check('占用冲突不覆盖也不丢板',s.slots.long===wide&&s.slots.short===narrow,s);
  // 手持已搭好的板，另一指点车也不能出发。
  a=await center('long');b=await center('car');await send('touchStart',[{...a,id:1}]);await send('touchMove',[{x:a.x,y:a.y-30,id:1}]);
  await send('touchStart',[{x:a.x,y:a.y-30,id:1},{...b,id:2}]);await send('touchEnd',[{...b,id:2}]);s=await state();check('持桥时另一指不能发车',s.phase==='build'&&s.held===1,s);await send('touchCancel',[]);
  s=await state();check('取消保留原桥位',s.done&&s.held===0&&s.ghosts===0,s);
  // 两指分别放置和争同一河，两种松手顺序都走实际触摸分发。
  for(const same of [false,true])for(const order of [[1,2],[2,1]]){
   await setup(0);const p1=await center('short'),p2=await center('long'),t1=await center('gap-'+narrow),t2=await center('gap-'+(same?narrow:wide));
   await send('touchStart',[{...p1,id:1}]);await send('touchStart',[{...p1,id:1},{...p2,id:2}]);await send('touchMove',[{...t1,id:1},{...t2,id:2}]);
   s=await state();check(`双持有 same=${same} order=${order}`,s.held===2&&s.ghosts===2,s);
   const ends={1:t1,2:t2};for(const id of order)await send('touchEnd',[{...ends[id],id}]);s=await state();
   check(`释放不丢板 same=${same} order=${order}`,s.held===0&&s.ghosts===0&&(same?Object.values(s.slots).filter(x=>x!==null).length===1:s.done),s);
   if(same)check(`同河先落者保留 ${order}`,order[0]===1?s.slots.short===narrow&&s.slots.long===null:s.slots.long===narrow&&s.slots.short===null,s);
  }
  await setup(0);a=await center('short');b=await center('long');await send('touchStart',[{...a,id:1}]);await send('touchStart',[{...a,id:1},{...b,id:2}]);await send('touchMove',[{x:a.x,y:a.y-40,id:1},{x:b.x,y:b.y-40,id:2}]);
  await page.evaluate(()=>{const p=[...pointers.values()].find(p=>p.board==='short');p.el.dispatchEvent(new PointerEvent('pointercancel',{pointerId:p.id,bubbles:true}));});s=await state();check('取消单指保留另一指',s.held===1&&s.ghosts===1&&s.slots.short===null&&s.slots.long===null,s);await send('touchCancel',[]);
  await setup(0);a=await center('short');await send('touchStart',[{...a,id:1}]);await send('touchStart',[{...a,id:1},{x:a.x+5,y:a.y+4,id:2}]);check('同板不能被两指复制',(await state()).held===1);await send('touchCancel',[]);
  await setup(0);a=await center('long');b=await center('short');const target=await center('gap-'+wide);await send('touchStart',[{...a,id:1}]);await send('touchMove',[{...target,id:1}]);await send('touchStart',[{...target,id:1},{...b,id:2}]);await send('touchEnd',[{...b,id:2}]);await send('touchEnd',[{...target,id:1}]);s=await state();check('另一指选择不被当前放置清掉',s.selected==='short'&&s.slots.long===wide,s);
  await page.locator('#gap-'+narrow).tap();check('保留的选择仍可放下',(await state()).done);
  // 丢到场外应回原位，失焦/转屏/恢复也不能留下占用。
  await setup(0);await drag('long',wide);a=await center('long');await send('touchStart',[{...a,id:1}]);await send('touchMove',[{x:5,y:5,id:1}]);await send('touchEnd',[]);s=await state();check('拖偏保留原位',s.slots.long===wide&&s.slots.short===null,s);
  for(const event of ['blur','pagehide']){
   a=await center('long');await send('touchStart',[{...a,id:1}]);await send('touchMove',[{x:a.x,y:a.y-40,id:1}]);await page.evaluate(type=>window.dispatchEvent(new Event(type)),event);await send('touchEnd',[]);s=await state();check(`${event} 清归属保留桥`,s.held===0&&s.ghosts===0&&s.slots.long===wide,s);
  }
  // 五种屏幕尺寸：比例真实、热区可见、完整触摸解题。
  for(const [w,h] of [[320,568],[390,844],[844,390],[768,1024],[1024,768]]){
   await page.setViewportSize({width:w,height:h});await setup(0);
   const boxes=await page.locator('button,#back').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,w:r.width,h:r.height,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
   check(`${w}x${h} 44像素热区与边界`,boxes.every(b=>b.w>=43.9&&b.h>=43.9&&b.x>=-1&&b.y>=-1&&b.x+b.w<=w+1&&b.y+b.h<=h+1),boxes);
   check(`${w}x${h} 触点无遮挡`,boxes.every(b=>b.hit),boxes);
   const ratio=await page.evaluate(()=>document.querySelector('#long').getBoundingClientRect().width/document.querySelector('#short').getBoundingClientRect().width);check(`${w}x${h} 真实长度比例`,Math.abs(ratio-280/152)<.02,ratio);
   await drag('short',narrow);await drag('long',wide);check(`${w}x${h} 实际拖动可完成`,(await state()).done);
   await page.screenshot({path:`${out}/layout-${w}x${h}.png`});
  }
  await setup(0);await page.evaluate(()=>{window.originalPlay=voice.play;voice.play=()=>Promise.reject(Error('blocked'));});await tapPlace('short',narrow);await tapPlace('long',wide);check('语音拒播不阻断规则',(await state()).done);await page.evaluate(()=>voice.play=window.originalPlay);
  const old=(await state()).round;await page.locator('#car').tap();await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});s=await state();check('出发中恢复不会永久卡住',s.phase==='build'&&s.round>old&&!s.done,s);
  for(const id of ['sun','cloud','tree','friend','fish','car']){await page.locator('#'+id).tap();check(`${id} 有可见反馈`,await page.locator('#'+id).evaluate(el=>el.classList.contains('pop')||el.classList.contains('wobble')));}
  const audio=await page.evaluate(async()=>{voice.pause();clearTimeout(voiceTimer);voice.src='audio/ready.mp3';return new Promise(resolve=>{const t=setTimeout(()=>resolve({ended:false}),8000);voice.onended=()=>{clearTimeout(t);resolve({ended:true,duration:voice.duration});};voice.play().catch(e=>{clearTimeout(t);resolve({ended:false,error:String(e)});});});});check('本地语音实际播放结束',audio.ended,audio);
  check('无页面或SVG错误',errors.length===0,errors);check('游戏资源无404',badResponses.length===0,badResponses);
  return {passed:results.length,failed:0,results,limitations:['Chromium触屏模拟，不代表Cookie试玩或iPad Safari扬声器实证','单指取消与页面生命周期包含合成事件']};
 }catch(e){return {error:String(e),passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results,state:await state()};}finally{await cdp.detach();}
}
