async page=>{
 const root='http://127.0.0.1:8786/';if(new URL(page.url()).origin!==new URL(root).origin)throw Error('local only');
 await page.evaluate(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();});await page.goto('about:blank');await page.goto(root+'games/town/');
 const results=[],check=(name,ok,detail)=>results.push({name,ok,detail});
 const state=()=>page.evaluate(()=>townDebug());
 const reset=async columns=>{await page.evaluate(c=>localStorage.setItem('cookie-town-v1',JSON.stringify({schema:1,columns:c})),columns);await page.reload();};
 const tap=async s=>{const r=await page.locator(s).boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);};
 const empty=()=>[[],[],[],[],[]];
 await reset(empty());await tap('#sun');check('太阳切换夜晚',(await state()).night);await page.screenshot({path:'output/town-play-20261018/night.png'});await tap('#sun');check('月亮切回白天',!(await state()).night);
 await tap('#cloud');check('云开启雨与花朵',(await state()).raining&&await page.locator('.rain-drop').count()===16);await page.screenshot({path:'output/town-play-20261018/rain.png'});await tap('#cloud');check('再次点击停止雨',!(await state()).raining&&await page.locator('.rain-drop').count()===0);
 await tap('#cloud');await page.waitForTimeout(6100);check('雨自行结束',!(await state()).raining);
 check('天气不改变作品',(await state()).columns.every(c=>!c.length));await tap('#cloud');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));check('离开清理天气',!(await state()).raining);
 await reset([['arch','block'],[],[],[],[]]);await tap('[data-col="0"][data-row="1"]');check('顶部可选',!!(await state()).selected);await tap('[data-col="0"][data-row="1"]');check('同件再点取消',!(await state()).selected);
 await reset([['roof'],[],[],[],[]]);const mat=await page.locator('[data-kind="block"]').boundingBox(),dest=await page.locator('[data-column="1"]').boundingBox(),bad=await page.locator('[data-column="0"]').boundingBox();
 await page.mouse.move(mat.x+mat.width/2,mat.y+mat.height/2);await page.mouse.down();await page.mouse.move(dest.x+dest.width/2,dest.y+dest.height-20,{steps:5});check('可放位置显示预览',await page.locator('[data-column="1"] .landing').count()===1);await page.screenshot({path:'output/town-play-20261018/preview.png'});
 await page.mouse.move(bad.x+bad.width/2,bad.y+bad.height-20,{steps:5});check('屋顶上拒绝预览',await page.locator('.landing').count()===0&&await page.locator('.blocked-aim').count()===1);await page.mouse.up();check('无效释放保留作品',(await state()).columns[0].join()==='roof'&&(await state()).columns[1].length===0);
 await reset([['arch','block','roof'],[],[],[],[]]);await tap('#car');check('出发不提前招手',(await state()).greeted.length===0);await page.waitForTimeout(650);check('经过后住客回应',(await state()).greeted.includes(0));await page.screenshot({path:'output/town-play-20261018/welcome.png'});
 await reset(empty());await tap('#car');await tap('[data-kind="block"]');await page.waitForTimeout(650);check('中断行车取消延迟招手',(await state()).greeted.length===0&&(await state()).carPhase==='idle');
 await reset(empty());await tap('[data-kind="block"]');check('首次选材料不打断开场',await page.evaluate(()=>document.querySelector('#scene')&&!townDebug().selected?.source)&&await page.evaluate(()=>{return townDebug().introActive;}));
 await page.waitForTimeout(6500);check('开场保护有超时',!(await state()).introActive);
 return {passed:results.filter(r=>r.ok).length,total:results.length,results};
}
