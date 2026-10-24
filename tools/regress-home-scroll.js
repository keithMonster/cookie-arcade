async page=>{
 const origin='http://localhost:18974';
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw Error(JSON.stringify(results));};
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.goto(origin+'/');
 for(const viewport of [{width:390,height:844},{width:768,height:1024}]){
  await page.setViewportSize(viewport);
  for(const slug of ['train','cascade','basket']){
   const tile=page.locator('a[href="games/'+slug+'/"]');await tile.scrollIntoViewIfNeeded();
   const before=await page.evaluate(()=>scrollY);await tile.click();await page.locator('#back').click();await page.waitForURL(origin+'/');await settle();
   const after=await page.evaluate(()=>scrollY);check('游戏返回 '+viewport.width+' '+slug,Math.abs(after-before)<=2,{before,after});
  }
  await page.locator('a[href="games/cascade/"]').scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY);
  await page.locator('a[href="games/cascade/"]').click();await page.goBack();await settle();
  check('浏览器后退 '+viewport.width,Math.abs(await page.evaluate(()=>scrollY)-before)<=2);
  await page.evaluate(()=>scrollTo(0,0));await page.locator('a[href="games/hidecar/"]').click();await page.locator('#back').click();await page.waitForURL(origin+'/');await settle();
  check('顶部仍在顶部 '+viewport.width,await page.evaluate(()=>scrollY)===0);
 }
 // 独立上下文模拟新标签页，不继承旧标签会话存储。
 const other=await page.context().browser().newContext();const tab=await other.newPage();await tab.goto(origin+'/');await tab.waitForLoadState('load');check('独立标签上下文从顶部开始',await tab.evaluate(()=>scrollY)===0);await other.close();
 for(const bad of ['NaN','-10','Infinity','{}','']){
  await page.evaluate(bad=>{sessionStorage.setItem(homeScrollKey,bad);window.dispatchEvent(new PageTransitionEvent('pageshow'));},bad);await settle();check('非法存储不产生异常 '+bad,await page.evaluate(()=>scrollY)===0);
 }
 const blocked=await page.context().browser().newContext();await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
 const tab2=await blocked.newPage();const blockedErrors=[];tab2.on('pageerror',e=>blockedErrors.push(e.message));await tab2.goto(origin+'/');await tab2.locator('a[href="games/cascade/"]').click();await tab2.locator('#back').click();await tab2.waitForURL(origin+'/');check('存储禁用仍能进入返回',blockedErrors.length===0,blockedErrors);await blocked.close();
 check('无页面JS异常',errors.length===0,errors);return results;
}
