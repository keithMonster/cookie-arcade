async page => {
 const origin='http://127.0.0.1:18974';
 if(new URL(page.url()).origin!==origin)throw Error('local only');
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok)=>{results.push({name,ok:!!ok});if(!ok)throw Error(JSON.stringify(results));};
 const state=()=>page.evaluate(()=>hidecarDebug());
 const center=sel=>page.locator(sel).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height*.8};});
 const ptr=(type,id,sel,x,y)=>page.evaluate(({type,id,sel,x,y})=>document.querySelector(sel).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,clientX:x,clientY:y})),{type,id,sel,x,y});
 const cdp=await page.context().newCDPSession(page);
 const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p});
 for(const [width,height] of [[390,844],[844,390],[768,1024]]){
  await page.setViewportSize({width,height});await page.goto(origin+'/games/hidecar/');
  await page.waitForFunction(()=>hidecarDebug().phase==='showing');let s=await state();const initial=s.order[s.target];
  await page.waitForFunction(()=>hidecarDebug().phase==='shuffling');
  check('换位时隐藏 '+width,(await state()).carHidden);
  await page.waitForFunction(()=>hidecarDebug().phase==='searching');s=await state();
  check('目标确实换位置 '+width,s.order[s.target]!==initial);
  check('三个车库同色 '+width,await page.locator('.garage').evaluateAll(ds=>new Set(ds.map(d=>getComputedStyle(d).getPropertyValue('--color'))).size===1));
  const sel='[data-door="'+s.target+'"]',p=await center(sel);
  await touch('touchStart',[{...p,id:1}]);await touch('touchMove',[{x:p.x,y:p.y-20,id:1}]);
  check('门随手指移动 '+width,await page.locator(sel+' .door').evaluate(d=>d.style.transform.includes('20px')));
  await touch('touchEnd',[]);check('短拖不打开 '+width,(await state()).phase==='searching');
  await ptr('pointerdown',21,sel,p.x,p.y);await ptr('pointermove',21,sel,p.x,p.y-60);await ptr('pointercancel',21,sel,p.x,p.y-60);
  check('取消复位 '+width,(await state()).held===0&&(await state()).phase==='searching'&&await page.locator(sel+' .door').evaluate(d=>!d.style.transform));
  await touch('touchStart',[{...p,id:1}]);await touch('touchMove',[{x:p.x,y:p.y-65,id:1}]);await touch('touchEnd',[]);
  check('真实触屏拖门找到 '+width,(await state()).phase==='found');await page.waitForTimeout(550);
  const car=await center('#car'),road=await center('#road');
  await touch('touchStart',[{...car,id:1}]);await touch('touchMove',[{...road,id:1}]);await touch('touchEnd',[]);
  check('真实拖车出库 '+width,(await state()).phase==='leaving');
 }
 await page.goto(origin+'/games/hidecar/');await page.waitForFunction(()=>hidecarDebug().phase==='searching');
 let s=await state(),wrong=[0,1,2].filter(i=>i!==s.target);
 for(const i of wrong)await page.locator('[data-door="'+i+'"]').click();
 s=await state();check('错两次只提示',s.phase==='searching'&&s.doors[s.target].hint&&s.carHidden);
 await page.locator('[data-door="'+s.target+'"]').click();check('点击仍可找到',(await state()).phase==='found');
 await page.waitForTimeout(550);await page.locator('#car').click();await page.locator('#road').click();check('点选出库',(await state()).phase==='leaving');
 await page.goto(origin+'/games/hidecar/');await page.waitForFunction(()=>hidecarDebug().phase==='shuffling');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 check('换位失焦恢复可玩',(await state()).phase==='searching'&&(await state()).carHidden);
 s=await state();const sel='[data-door="'+s.target+'"]',p=await center(sel),cloud=await center('#cloud');
 await ptr('pointerdown',31,sel,p.x,p.y);await ptr('pointermove',31,sel,p.x,p.y-65);await ptr('pointerdown',32,'#cloud',cloud.x,cloud.y);
 await ptr('pointercancel',32,'#cloud',cloud.x,cloud.y);check('取消另一指保留拖门',(await state()).held===1);
 await ptr('pointerup',31,sel,p.x,p.y-65);check('多指开门正常',(await state()).phase==='found'&&(await state()).held===0);
 for(const [width,height] of [[320,568],[667,375],[1024,768]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(600);
  check('热区边界 '+width,await page.locator('#back,#sun,#cloud,#bird,.garage,#road,#car').evaluateAll(ds=>ds.filter(d=>!d.hidden).every(d=>{const r=d.getBoundingClientRect();return r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&r.width>=44&&r.height>=44;})));
 }
 await page.screenshot({path:'/Users/xuke/githubProject/cookie-arcade/output/hidecar-20261024/screen.png'});
 check('无JS异常',errors.length===0);return results;
}
