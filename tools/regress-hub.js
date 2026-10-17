// 35款入口冒烟：只证明加载、基本触摸与返回，不代替逐款通关和真机。
async page => {
 const origin=new URL(page.url()).origin;
 if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('仅限本地测试');
 const touch=await page.evaluate(()=>navigator.maxTouchPoints>0);
 await page.goto(origin+'/');
 const links=await page.locator('a[href^="games/"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
 const games=[...new Set(links)];const results=[];
 for(const href of games){
  const errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
  const bad=[];const onResponse=r=>{if(r.status()>=400)bad.push(r.url()+':'+r.status());};page.on('response',onResponse);
  await page.goto(origin+'/'+href);await page.waitForTimeout(100);
  const layout=await page.evaluate(()=>{
   const b=document.querySelector('#back'),r=b?.getBoundingClientRect();
   return {back:!!r&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  if(touch)await page.touchscreen.tap(200,280);
  else {await page.mouse.click(200,280);await page.mouse.move(160,330);await page.mouse.down();await page.mouse.move(230,390,{steps:5});await page.mouse.up();}
  if(touch)await page.locator('#back').tap({timeout:3000});else await page.locator('#back').click({timeout:3000});
  await page.waitForURL(origin+'/');await page.waitForLoadState('load');
  const returned=new URL(page.url()).pathname==='/';
  results.push({game:href,ok:layout.back&&!layout.overflow&&returned&&!errors.length&&!bad.length,layout,returned,errors,bad});
  page.off('pageerror',onError);page.off('response',onResponse);
 }
 return {input:touch?'touchscreen':'mouse',viewport:page.viewportSize(),passed:results.filter(r=>r.ok).length,total:results.length,results};
}
