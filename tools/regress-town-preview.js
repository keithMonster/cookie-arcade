async page=>{
 const results=[],check=(name,ok)=>results.push({name,ok});
 if(new URL(page.url()).origin!=='http://127.0.0.1:8786')throw Error('local only');
 const reset=async c=>{await page.evaluate(columns=>localStorage.setItem('cookie-town-v1',JSON.stringify({schema:1,columns})),c);await page.reload();};
 const center=async s=>page.locator(s).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 const session=await page.context().newCDPSession(page),send=(type,points)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 await reset([['block'],[],[],[],[]]);const a=await center('[data-kind="arch"]'),b=await center('[data-piece="block"]'),c=await center('[data-column="0"]');
 await send('touchStart',[{...a,id:1}]);await send('touchMove',[{...c,id:1}]);check('初始可放',await page.locator('.landing').count()===1);
 await send('touchStart',[{...c,id:1},{...b,id:2}]);check('另一指锁列立即禁放',await page.locator('.landing').count()===0&&await page.locator('.blocked-aim').count()===1);
 // 使用实际登记的指针取消其中一指，CDP touch id 与 PointerEvent id 不同。
 await page.evaluate(()=>{const ids=[...pointers.keys()];document.querySelector('#scene').dispatchEvent(new PointerEvent('pointercancel',{pointerId:ids[1],bubbles:true}));});check('单指取消恢复另一个预览',await page.locator('.landing').count()===1&&await page.locator('.aim').count()===1);await send('touchCancel',[]);
 await reset([[],[],[],[],[]]);const m=await center('[data-kind="block"]'),d=await center('[data-column="1"]'),sun=await center('#sun');
 await send('touchStart',[{...m,id:1}]);await send('touchMove',[{...d,id:1}]);await send('touchStart',[{...d,id:1},{...sun,id:2}]);const end={x:sun.x+20,y:sun.y,id:2};await send('touchMove',[{...d,id:1},end]);await send('touchEnd',[end]);check('装饰手指滑动松开保留持物预览',await page.locator('.aim').count()===1&&await page.locator('.landing').count()===1);await send('touchCancel',[]);
 for(const order of [[1,2],[2,1]]){
 await reset([[],[],[],[],[]]);const p=await center('[data-kind="block"]'),q=await center('[data-kind="arch"]'),dest=await center('[data-column="2"]');
 await send('touchStart',[{...p,id:1}]);await send('touchStart',[{...p,id:1},{...q,id:2}]);await send('touchMove',[{...dest,id:1},{x:dest.x+10,y:dest.y,id:2}]);await send('touchEnd',[{...dest,id:order[0]}]);
 check('首指提交后次指预览抬一层 '+order,await page.locator('.landing').evaluate(e=>e.style.bottom.includes('1 *')));await send('touchEnd',[]);check('同列双指均保留 '+order,await page.evaluate(()=>townDebug().columns[2].length===2));
 }
 return{passed:results.filter(r=>r.ok).length,total:results.length,results};
}
