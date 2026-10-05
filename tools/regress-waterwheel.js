// Playwright CLI run-code；仅本机隔离浏览器，不调用生产或外部服务。
async (page) => {
  if (new URL(page.url()).origin !== 'http://127.0.0.1:8772') throw Error('仅允许本地静态服务器');
  const results=[],errors=[],evidence='/Users/xuke/githubProject/monster/output/cookie-arcade/waterwheel-20261005';
  const check=(name,ok,detail)=>results.push({name,ok:Boolean(ok),detail});
  page.on('pageerror',e=>errors.push(e.message));
  const state=()=>page.evaluate(()=>({round,layout,orientation,angle,phase,misses,drag:drag?{...drag}:null,hint:document.querySelector('#board').classList.contains('hint'),success:document.querySelector('#board').classList.contains('success'),outlet:document.querySelector('#outlet-water').style.opacity}));
  const setup=async(l,q)=>page.evaluate(([l,q])=>{round=l;dealRound();orientation=q;angle=q*90;renderAngle();renderFlow();},[l,q]);
  const center=async()=>{const b=await page.locator('#dial').boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2,r:b.width*.38};};
  const point=(c,a)=>({x:c.x+c.r*Math.cos(a*Math.PI/180),y:c.y+c.r*Math.sin(a*Math.PI/180)});
  const move=async p=>page.mouse.move(p.x,p.y);
  const rotate=async(start,end)=>{const c=await center();await move(point(c,start));await page.mouse.down();for(let a=start+5;a<=end;a+=5)await move(point(c,a));await move(point(c,end));await page.mouse.up();};
  await page.reload();await page.waitForSelector('#dial');
  const answer=[0,1,2,3];
  // 用真实方向键提交每个朝向；预设仅隔离前置状态，判定与DOM均由输入驱动。
  for(let l=0;l<4;l++)for(let q=0;q<4;q++){
    await setup(l,(q+3)%4);await page.keyboard.press('ArrowRight');const s=await state();
    check(`布局${l} 朝向${q}真实提交`,s.orientation===q&&s.phase===(q===answer[l]?'celebrate':'play')&&s.success===(q===answer[l])&&s.outlet===(q===answer[l]?'1':'0'),s);
  }
  for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768]]){
    await page.setViewportSize({width,height});await setup(0,2);
    const boxes=await page.locator('#back,#dial,#source,#wheel').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,w:r.width,h:r.height,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
    check(`${width}×${height} 目标可见且44px`,boxes.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=width+1&&b.y+b.h<=height+1&&b.w>=44&&b.h>=44),boxes);
    check(`${width}×${height} 无遮挡`,boxes.every(b=>b.hit),boxes);
    await page.screenshot({path:`${evidence}/regression-${width}x${height}.png`});
  }
  await page.setViewportSize({width:768,height:1024});
  await setup(0,3);await page.locator('#dial').click();check('真实鼠标点击一格成功',(await state()).phase==='celebrate');
  await setup(1,0);await rotate(0,90);check('真实鼠标旋转一格成功',(await state()).orientation===1&&(await state()).phase==='celebrate',await state());
  await setup(1,0);await rotate(170,260);check('真实鼠标跨±180°无跳变',(await state()).orientation===1&&(await state()).phase==='celebrate',await state());
  await setup(2,1);await page.locator('#dial').tap();check('真实触摸tap一格成功',(await state()).orientation===2&&(await state()).phase==='celebrate',await state());
  await setup(3,2);await page.locator('#dial').focus();await page.keyboard.press('Enter');check('键盘Enter成功',(await state()).phase==='celebrate');
  await setup(0,1);await page.locator('#dial').focus();await page.keyboard.press('Space');check('键盘Space转一格',(await state()).orientation===2&&(await state()).misses===1);
  await setup(0,1);await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');let s=await state();
  check('两次错误仅照亮接口不代答',s.phase==='play'&&s.orientation===3&&s.misses===2&&s.hint&&!s.success,s);
  // 真实鼠标拖动后注入取消事件，验证异常分支而非伪造成功输入。
  for(const kind of ['pointercancel','lostpointercapture','blur']){
    await setup(0,2);const c=await center();await move(point(c,0));await page.mouse.down();await move(point(c,60));
    await page.evaluate(kind=>{if(kind==='blur')window.dispatchEvent(new Event('blur'));else document.dispatchEvent(new PointerEvent(kind,{pointerId:drag.id,isPrimary:true,bubbles:true}));},kind);
    await page.mouse.up();s=await state();check(`${kind} 恢复原方向不计错`,!s.drag&&s.orientation===2&&s.angle===180&&s.misses===0,s);
  }
  await setup(0,2);let c=await center();await move(point(c,0));await page.mouse.down();await move(point(c,60));
  await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerup',{pointerId:drag.id+100,isPrimary:false,bubbles:true})));
  check('副指释放不提交主拖动',Boolean((await state()).drag)&&(await state()).misses===0);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();
  // CDP只绑定当前隔离上下文；通过浏览器触摸输入链验证旋转。
  let cdp;
  try{
    cdp=await page.context().newCDPSession(page);await setup(1,0);c=await center();
    const send=async(type,a)=>{const p=point(c,a);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:p.x,y:p.y,id:1}]});};
    await send('touchStart',170);for(let a=180;a<=260;a+=10)await send('touchMove',a);await send('touchEnd',260);
    s=await state();check('隔离CDP真实触摸跨180°旋转成功',s.orientation===1&&s.phase==='celebrate',s);
  }catch(e){check('隔离CDP真实触摸旋转可执行',false,String(e));}finally{await cdp?.detach();}
  await setup(0,3);await page.evaluate(()=>{window.savedPlay=voice.play;voice.play=()=>Promise.reject(Error('blocked'));});
  await page.locator('#dial').click();check('媒体拒播仍成功',(await state()).phase==='celebrate');const old=(await state()).round;
  await page.waitForFunction(r=>round>r,old,{timeout:8000});check('媒体拒播仍自动换轮',(await state()).phase==='play');
  await page.evaluate(()=>{voice.play=window.savedPlay;});
  await setup(0,3);await page.locator('#dial').click();
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  check('bfcache persisted生命周期庆祝恢复',(await state()).phase==='play'&&!(await state()).success,await state());
  await setup(0,2);c=await center();await move(point(c,0));await page.mouse.down();await move(point(c,50));
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await page.mouse.up();
  s=await state();check('bfcache persisted生命周期拖动恢复',!s.drag&&s.angle===180&&s.misses===0,s);
  const observed=[];for(let i=0;i<20;i++){await page.evaluate(()=>dealRound());s=await state();observed.push(s);}
  check('20轮开局都未完成',observed.every(s=>s.orientation!==answer[s.layout]&&s.phase==='play'&&!s.success),observed);
  check('多轮四布局循环',observed.every((s,i)=>i===0||s.layout===(observed[i-1].layout+1)%4));
  for(const name of ['intro','turn','join','source','goal','done','again']){
    const response=await page.request.get(`http://127.0.0.1:8772/games/waterwheel/audio/${name}.mp3`);
    check(`本地语音 ${name}`,response.status()===200&&(await response.body()).length>1024);
  }
  await setup(0,3);await page.locator('#dial').click();
  await page.evaluate(()=>{window.restoreEvents=[];window.addEventListener('pageshow',event=>window.restoreEvents.push(event.persisted));});
  await page.goto('http://127.0.0.1:8772/');await page.goBack();await page.waitForSelector('#dial');
  s=await state();const navigation=await page.evaluate(()=>({events:window.restoreEvents??null,type:performance.getEntriesByType('navigation')[0]?.type}));
  check('真实后退导航恢复可玩',s.phase==='play'&&!s.success&&!s.drag&&s.orientation!==answer[s.layout],{state:s,navigation});
  check('无页面脚本异常',errors.length===0,errors);
  return {passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results,limitations:['bfcache检查使用persisted生命周期事件，未声称浏览器真实缓存命中','桌面隔离Chromium不能替代iPad扬声器或Cookie试玩']};
}
