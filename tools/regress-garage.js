// 本机隔离 Playwright CLI run-code；无生产或付费调用。
async page => {
 if(new URL(page.url()).origin!=='http://127.0.0.1:8775')throw Error('仅本地8775');
 const root='http://127.0.0.1:8775',out='/Users/xuke/githubProject/monster/output/cookie-arcade/garage-drag-20261007';
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw Error(name);};
 const state=()=>page.evaluate(()=>({round,phase,fault:{...fault},selected,misses,held:pointers.size,ghosts:document.querySelectorAll('.ghost').length,needed:needs()}));
 const setup=async n=>{await page.evaluate(n=>{round=n;newRound();},n);await page.waitForTimeout(800);};
 const use=async(tool,target)=>{await page.locator(`#${tool}`).click();await page.locator(`#${target}`).click();};
 const center=async id=>{const b=await page.locator(`#${id}`).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
 const drag=async(id,target)=>{const a=await center(id),b=await center(target);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();};
 try {
 await page.goto(root+'/games/garage/');await page.reload();await page.waitForTimeout(900);
 // 状态前置只用于枚举布局；全部修理和试车由浏览器输入完成。
 for(let variant=0;variant<4;variant++){
  await setup(variant);let s=await state();const target=s.fault.side+'-wheel';
  await use('pump',target);s=await state();check(`布局${variant} 打气依赖`,variant===1?s.fault.air===1:s.fault.air===(variant===2?3:0),s);
  await page.locator('#horn').click();check(`布局${variant} 未修好不发车`,(await state()).phase==='play');
  await setup(variant);s=await state();
  // 泥巴可以先擦，不被轮胎依赖锁住。
  if(s.fault.mud){await use('sponge','body-hit');await page.locator('#body-hit').click();await page.locator('#body-hit').click();check(`布局${variant} 独立擦泥`,(await state()).fault.mud===0);}
  s=await state();if(s.fault.missing){await drag('tire',target);check(`布局${variant} 拖轮胎装上但未拧紧`,!(await state()).fault.missing&&!(await state()).fault.tight);await use('pump',target);check(`布局${variant} 未拧紧不打气`,(await state()).fault.air===s.fault.air);await use('wrench',target);}
  s=await state();if(s.fault.air<3){await use('pump',target);for(let i=s.fault.air+1;i<3;i++)await page.locator(`#${target}`).click();}
  s=await state();check(`布局${variant} 完整修好但等待孩子出发`,!s.needed&&s.phase==='play',s);
  await page.locator('#body-hit').click();check(`布局${variant} 主动试车`,(await state()).phase==='drive');
  const old=s.round;await page.waitForFunction(r=>round>r,old);check(`布局${variant} 自动新车恢复`,(await state()).phase==='play'&&(await state()).held===0);
 }
 await setup(0);await use('pump','left-wheel');await page.locator('#left-wheel').click();let s=await state();
 check('错两次只提示不装轮',s.misses===2&&s.fault.missing&&await page.locator('#tire').evaluate(el=>el.classList.contains('hint')),s);
 await setup(0);await page.locator('#tire').focus();await page.keyboard.press('Enter');await page.locator('#left-wheel').focus();await page.keyboard.press('Space');
 check('键盘选择和放下',!(await state()).fault.missing&&!(await state()).fault.tight);
 await page.keyboard.press('2');await page.keyboard.press('ArrowLeft');check('数字与方向快捷输入',(await state()).fault.tight);
 await setup(0);await page.locator('#tire').tap();await page.locator('#left-wheel').tap();check('真实触摸tap装轮',!(await state()).fault.missing);
 for(const [w,h] of [[320,568],[390,844],[844,390],[768,1024],[1024,768]]){
  await page.setViewportSize({width:w,height:h});await setup(0);
  const boxes=await page.locator('button,#back').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,w:r.width,h:r.height,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
  check(`${w}×${h} 热区>=44且在屏内`,boxes.every(b=>b.w>=44&&b.h>=44&&b.x>=0&&b.y>=0&&b.x+b.w<=w+1&&b.y+b.h<=h+1),boxes);
  check(`${w}×${h} 热区中心不遮挡`,boxes.every(b=>b.hit),boxes);await page.screenshot({path:`${out}/layout-${w}x${h}.png`});
 }
 await page.setViewportSize({width:1024,height:768});await setup(0);
 for(const id of ['sun','cloud','cat','sign','driver','horn','left-wheel','right-wheel','body-hit',...['tire','wrench','pump','sponge']]){
  await page.locator(`#${id}`).click();check(`${id} 点按可见反馈`,await page.locator(`#${id}`).evaluate(el=>el.classList.contains('pop')||el.classList.contains('wobble')));
 }
 // 每个触点实际走浏览器触摸分发；CDP 只连自身隔离 context。
 const cdp=await page.context().newCDPSession(page);
 const send=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});await page.waitForTimeout(60);};
 await setup(0);let a=await center('tire'),b=await center('sun'),t=await center('left-wheel');
 await send('touchStart',[{...a,id:1}]);await send('touchMove',[{x:a.x,y:a.y-70,id:1}]);
 await send('touchStart',[{x:a.x,y:a.y-70,id:1},{...b,id:2}]);await send('touchEnd',[{...b,id:2}]);
 check('一指持轮胎另一指太阳有回应',(await state()).held===1&&await page.locator('#sun').evaluate(el=>el.classList.contains('pop')));
 await send('touchMove',[{...t,id:1}]);await send('touchEnd',[{...t,id:1}]);check('副指结束后原指仍可放轮胎',!(await state()).fault.missing&&(await state()).held===0);
 for(const order of [[1,2],[2,1]]){
  await setup(0);a=await center('tire');b=await center('sponge');t=await center('left-wheel');const body=await center('body-hit');
  await send('touchStart',[{...a,id:1}]);await send('touchStart',[{...a,id:1},{...b,id:2}]);
  await send('touchMove',[{...t,id:1},{...body,id:2}]);check(`双工具持有 ${order}`, (await state()).held===2&&(await state()).ghosts===2,await state());
  const end={1:t,2:body};for(const id of order)await send('touchEnd',[{...end[id],id}]);
  s=await state();check(`松手顺序 ${order} 各自提交`,!s.fault.missing&&s.fault.mud<3&&!s.held&&!s.ghosts,s);
 }
 await setup(0);a=await center('tire');b=await center('sponge');
 await send('touchStart',[{...a,id:1}]);await send('touchStart',[{...a,id:1},{...b,id:2}]);
 await send('touchMove',[{x:a.x,y:a.y-60,id:1},{x:b.x,y:b.y-60,id:2}]);
 await page.evaluate(()=>{const p=[...pointers.values()].find(p=>p.tool==='tire');p.el.dispatchEvent(new PointerEvent('pointercancel',{pointerId:p.id,bubbles:true}));});
 check('取消一指保留另一指',(await state()).held===1&&(await state()).ghosts===1&&[...(await page.evaluate(()=>[...pointers.values()].map(p=>p.tool)))][0]==='sponge');
 await send('touchCancel',[]);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));check('失焦清空所有归属',(await state()).held===0&&(await state()).ghosts===0);
 await setup(0);a=await center('tire');await send('touchStart',[{...a,id:1}]);await send('touchStart',[{...a,id:1},{x:a.x+5,y:a.y+5,id:2}]);check('同工具不能抢占',(await state()).held===1);await send('touchCancel',[]);
 await setup(0);await page.locator('#sponge').click();a=await center('sponge');b=await center('body-hit');
 await send('touchStart',[{...a,id:1}]);await send('touchMove',[{x:a.x,y:a.y-60,id:1}]);await send('touchStart',[{x:a.x,y:a.y-60,id:1},{...b,id:2}]);await send('touchEnd',[{...b,id:2}]);
 check('手持海绵不能被另一指点击遥控',!(await state()).selected&&(await state()).fault.mud===3);await send('touchCancel',[]);
 await setup(0);a=await center('tire');b=await center('sponge');t=await center('left-wheel');
 await send('touchStart',[{...a,id:1}]);await send('touchMove',[{x:a.x,y:a.y-60,id:1}]);await send('touchStart',[{x:a.x,y:a.y-60,id:1},{...b,id:2}]);await send('touchEnd',[{...b,id:2}]);
 await send('touchMove',[{...t,id:1}]);await send('touchEnd',[{...t,id:1}]);check('另一指点击选择不被拖放清除',(await state()).selected==='sponge'&&!(await state()).fault.missing);await cdp.detach();
 await setup(0);await page.evaluate(()=>{window.oldPlay=voice.play;voice.play=()=>Promise.reject(Error('blocked'));});await use('tire','left-wheel');await use('wrench','left-wheel');check('声音拒播不阻断玩法',(await state()).fault.tight);await page.evaluate(()=>voice.play=window.oldPlay);
 await setup(0);a=await center('tire');await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(a.x,a.y-80);await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await page.mouse.up();check('页面恢复无残留拖动',(await state()).held===0&&(await state()).ghosts===0&&(await state()).fault.missing);
 await page.evaluate(()=>{fault={missing:false,tight:true,air:3,mud:0,side:'left'};render();});await page.locator('#body-hit').click();await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});check('出发中页面恢复可玩',(await state()).phase==='play'&&!!(await state()).needed);
 const audio=await page.evaluate(async()=>{voice.pause();voice.src='audio/done.mp3';return new Promise(resolve=>{const timeout=setTimeout(()=>resolve({ended:false,error:voice.error?.message}),9000);voice.onended=()=>{clearTimeout(timeout);resolve({ended:true,duration:voice.duration});};voice.play().catch(e=>{clearTimeout(timeout);resolve({ended:false,error:String(e)});});});});check('本地语音实际ended',audio.ended,audio);
 check('无脚本异常',errors.length===0,errors);
 return {passed:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results,limitations:['Chromium触屏模拟不等于iPad扬声器或Cookie试玩','bfcache异常恢复使用合成persisted事件']};
 } catch(e) { return {error:String(e),passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results,state:await state()}; }
}
