// 隔离本地 Playwright CLI：真实 tap/CDP touch + 取消事件；不访问生产。
async page => {
 const origin='http://127.0.0.1:18973',out='/Users/xuke/githubProject/monster/output/cookie-arcade/pair-20261023';
 if(new URL(page.url()).origin!==origin)throw Error('local only');
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw Error(JSON.stringify(results));};
 const tap=async s=>{const p=await page.locator(s).evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!el.contains(document.elementFromPoint(x,y)))throw Error('blocked hit '+el.id);return{x,y};});await page.touchscreen.tap(p.x,p.y);};
 const h=()=>page.evaluate(()=>hidecarDebug()),m=()=>page.evaluate(()=>marketDebug());
 const center=s=>page.locator(s).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 const pointer=async(type,id,sel)=>page.evaluate(({type,id,sel})=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2}));},{type,id,sel});
 let cdp;try{cdp=await page.context().newCDPSession(page);}catch{}
 const send=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p});
 const drag=async(a,b)=>{const x=await center(a),y=await center(b);if(cdp){await send('touchStart',[{...x,id:1}]);await send('touchMove',[{...y,id:1}]);await send('touchEnd',[]);}else{await pointer('pointerdown',31,a);await pointer('pointermove',31,b);await pointer('pointerup',31,b);}};
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/games/hidecar/');
 await page.waitForFunction(()=>hidecarDebug().phase==='searching');
 check('藏车无文字UI',!(await page.locator('#scene').innerText()).trim());
 let s=await h();const wrong=[0,1,2].filter(i=>i!==s.target);
 for(const i of wrong)await tap('[data-door="'+i+'"]');
 s=await h();check('两次空门仅提示',s.phase==='searching'&&s.doors[s.target].hint&&s.carHidden);
 await tap('[data-door="'+s.target+'"]');await page.waitForTimeout(550);
 check('找到不自动出发',(await h()).phase==='found');
 await tap('#car');await pointer('pointerdown',71,'#car');await tap('#road');check('一指持车另一指不能代出发',(await h()).phase==='found');await pointer('pointercancel',71,'#car');
 check('取消清除归属',(await h()).held===0&&(await h()).carOwner===null);
 await drag('#car','#road');check('拖车出发',(await h()).phase==='leaving');
 for(let i=0;i<8;i++){
  await page.waitForFunction(()=>hidecarDebug().phase==='searching');s=await h();await tap('[data-door="'+s.target+'"]');await page.waitForTimeout(550);await tap('#car');await tap('#road');check('找车连续轮 '+i,(await h()).phase==='leaving');
 }
 await page.waitForFunction(()=>hidecarDebug().phase==='searching');s=await h();await tap('[data-door="'+s.target+'"]');await page.waitForTimeout(550);
 for(const order of [[81,82],[82,81]]){
  await pointer('pointerdown',81,'#car');await pointer('pointermove',81,'#road');await pointer('pointerdown',82,'#cloud');
  for(const id of order)await pointer('pointerup',id,id===81?'#road':'#cloud');
  check('持车与装饰两松手次序 '+order,(await h()).phase==='leaving'&&(await h()).held===0);
  await page.waitForFunction(()=>hidecarDebug().phase==='searching');s=await h();await tap('[data-door="'+s.target+'"]');await page.waitForTimeout(550);
 }
 await pointer('pointerdown',91,'#car');await pointer('pointermove',91,'#road');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));check('藏车失焦不出发',(await h()).phase==='found'&&(await h()).held===0);
 for(const [w,hh] of [[320,568],[390,844],[667,375],[844,390],[768,1024],[1024,768]]){
  await page.setViewportSize({width:w,height:hh});await page.waitForTimeout(1300);
  const boxes=await page.locator('#back,#sun,#cloud,#bird,.garage,#road,#car').evaluateAll(es=>es.filter(e=>!e.hidden).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.dataset.door,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}));
  check('藏车热区 '+w+'x'+hh,boxes.every(r=>r.x>=-1&&r.y>=-1&&r.right<=w+1&&r.bottom<=hh+1&&r.w>=44&&r.h>=44),boxes);
  await page.screenshot({path:out+'/hidecar-'+w+'x'+hh+'.png'});
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/games/market/');
 const add=async k=>{await tap('[data-fruit="'+k+'"]');await tap('#basket');};
 const give=async()=>{await tap('#basket-handle');await tap('#customer');};
 const remove=async p=>{await tap('[data-id="'+p.id+'"]');await tap('[data-fruit="'+p.fruit+'"]');};
 check('水果铺无文字UI',!(await page.locator('#scene').innerText()).trim());
 await give();check('空篮不能交付',!(await m()).celebrating);
 await add('pear');await give();check('错水果保留可改',(await m()).state.basket[0].fruit==='pear'&&!(await m()).celebrating);
 await remove((await m()).state.basket[0]);await add('apple');await add('apple');await give();check('多拿保留可改',(await m()).state.basket.length===2&&!(await m()).celebrating);
 await remove((await m()).state.basket[0]);await give();check('正确才交付',(await m()).celebrating);await page.waitForFunction(()=>!marketDebug().celebrating);
 for(let i=0;i<10;i++){const q=(await m()).state;for(let j=0;j<q.count;j++)await add(q.fruit);await give();check('水果连续轮 '+i,(await m()).celebrating);await page.waitForFunction(()=>!marketDebug().celebrating);}
 await page.reload();await drag('[data-fruit="apple"]','#basket');check('真实拖水果入篮',(await m()).state.basket.length===1);await drag('[data-id="'+(await m()).state.basket[0].id+'"]','[data-fruit="apple"]');check('真实拖回水果',(await m()).state.basket.length===0);
 await pointer('pointerdown',21,'[data-fruit="apple"]');await pointer('pointermove',21,'#basket');await pointer('pointercancel',21,'#basket');check('水果取消不提交',(await m()).state.basket.length===0&&(await m()).held.length===0);
 for(const order of [[41,42],[42,41]]){
  await page.reload();await pointer('pointerdown',41,'[data-fruit="apple"]');await pointer('pointermove',41,'#basket');await pointer('pointerdown',42,'[data-fruit="pear"]');await pointer('pointermove',42,'#basket');
  for(const id of order)await pointer('pointerup',id,'#basket');
  check('双指装不同水果 '+order,(await m()).state.basket.length===2&&(await m()).held.length===0);
 }
 await page.reload();await add('apple');let p=(await m()).state.basket[0];await pointer('pointerdown',51,'[data-id="'+p.id+'"]');await pointer('pointermove',51,'[data-fruit="apple"]');await add('pear');check('装新水果不丢持有旧水果',(await m()).held.some(x=>x.id===51));await pointer('pointerup',51,'[data-fruit="apple"]');check('旧水果可继续归还',(await m()).state.basket.length===1&&(await m()).state.basket[0].fruit==='pear');
 await pointer('pointerdown',61,'[data-fruit="apple"]');await pointer('pointermove',61,'#basket');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));check('水果失焦清理',(await m()).held.length===0&&await page.locator('.ghost').count()===0);
 await page.reload();for(let i=0;i<5;i++)await add('apple');check('容量最多四个',(await m()).state.basket.length===4);
 for(const [w,hh] of [[320,568],[390,844],[667,375],[844,390],[768,1024],[1024,768]]){
  await page.setViewportSize({width:w,height:hh});await page.waitForTimeout(800);
  const boxes=await page.locator('#back,#sun,#cloud,#bell,#customer,#card,.stock,#basket,.piece').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}));
  check('水果热区 '+w+'x'+hh,boxes.every(r=>r.x>=-1&&r.y>=-1&&r.right<=w+1&&r.bottom<=hh+1&&r.w>=44&&r.h>=44),boxes);await page.screenshot({path:out+'/market-'+w+'x'+hh+'.png'});
 }
 await page.reload();await page.evaluate(()=>{HTMLMediaElement.prototype.play=()=>Promise.reject(Error('blocked'));});await add('apple');await give();check('音频拒绝不阻塞水果',(await m()).celebrating);
 check('零JS运行异常',!errors.length,errors);return results;
}
