// 同一夹具用于Chromium/WebKit；真触屏点击与鼠标PointerEvent拖动，不依赖CDP。
async page=>{
 const base='http://127.0.0.1:8786/games/town/';if(!page.url().startsWith(base))await page.goto(base);
 await page.evaluate(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();});await page.goto('about:blank');await page.goto(base);
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok,detail)=>results.push({name,ok:!!ok,detail});
 const state=()=>page.evaluate(()=>townDebug());
 const reset=async(c=[[],[],[],[],[]])=>{await page.goto(base);await page.evaluate(c=>localStorage.setItem('cookie-town-v1',JSON.stringify({schema:1,columns:c})),c);await page.reload();};
 const tap=async s=>page.locator(s).tap();
 const place=async(k,i)=>{await tap(`[data-kind="${k}"]`);await page.locator(`[data-column="${i}"]`).tap({position:{x:10,y:10}});};
 const center=async s=>page.locator(s).first().evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 const drag=async(a,b,cancel=false)=>{const p=await center(a),q=await center(b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:8});if(cancel)await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();};
 await reset([['roof'],[],[],[],[]]);await place('block',0);await page.locator('[data-column="0"]').tap({position:{x:10,y:10}});
 check('两次无效放置后提示保持可见',await page.locator('.column.hint').count()>0,await state());
 await reset([['arch','block'],[],[],[],[]]);await tap('[data-piece="arch"]');await tap('[data-piece="arch"]');check('拿下层时提示最顶块',await page.locator('[data-piece="block"].hint').count()===1);
 await reset();await place('roof',2);await drag('[data-kind="block"]','[data-column="2"]');check('屋顶上不能叠块',(await state()).columns[2].join()==='roof');
 await drag('[data-piece="roof"]','#basket');check('屋顶可回收',(await state()).columns[2].length===0);
 await reset([['arch','block'],[],[],[],[]]);await tap('[data-piece="block"]');await page.locator('[data-column="2"]').tap({position:{x:10,y:10}});check('点选搬顶块',(await state()).columns[0].join()==='arch'&&(await state()).columns[2].join()==='block');
 await tap('[data-piece="block"]');await tap('#basket');check('点选回收',(await state()).columns[2].length===0);
 await drag('[data-kind="block"]','[data-column="1"]',true);check('失焦中止拖动不落盘',(await state()).held===0&&(await state()).columns[1].length===0&&await page.locator('.ghost').count()===0);
 let p=await center('[data-kind="arch"]');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y-80);await page.setViewportSize({width:844,height:390});await page.mouse.up();check('横竖切换中止拖动',(await state()).held===0&&await page.locator('.ghost').count()===0);
 await reset();await tap('#car');await page.waitForFunction(()=>townDebug().carColumn>=1);await drag('[data-kind="block"]','[data-column="0"]');await tap('#car');check('行驶中改建后重新判断道路',(await state()).carPhase==='blocked');check('堵车列持续发光',await page.locator('[data-column="0"].hint').count()===1);
 await reset([['arch'],[],[],[],[]]);await tap('#car');await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));check('页面缓存恢复不遗留行驶状态',(await state()).carPhase==='idle');await tap('#car');await page.waitForFunction(()=>townDebug().carPhase==='arrived');check('恢复后可再次完成试车',true);await page.setViewportSize({width:320,height:568});await reset();await tap('#car');await page.waitForFunction(()=>townDebug().carPhase==='arrived');await page.waitForTimeout(550);check('小屏到达后车完整可见',await page.locator('#car').evaluate(e=>{const r=e.getBoundingClientRect(),s=document.querySelector('#scene').getBoundingClientRect();return r.right<=s.right&&r.left>=s.left;}));
 for(const value of ['broken','null','{"schema":2,"columns":[[],[],[],[],[]]}','{"schema":1,"columns":[["wrong"],[],[],[],[]]}','{"schema":1,"columns":[["roof","arch"],[],[],[],[]]}','{"schema":1,"columns":[["block","block","block","block"],[],[],[],[]]}']){await page.evaluate(v=>localStorage.setItem('cookie-town-v1',v),value);await page.reload();check('坏存档 '+value,(await state()).columns.flat().length===0);}
 await page.evaluate(()=>{voice.play=()=>Promise.reject(Error('audio denied'));});await place('arch',2);await tap('#car');await page.waitForFunction(()=>townDebug().carPhase==='arrived');check('拒播不阻断操作与试车',(await state()).columns[2][0]==='arch');
 await reset();for(let i=0;i<25;i++){await place('block',i%5);await drag('[data-piece="block"]','#basket');}check('连续25次搭建回收无残留',(await state()).columns.flat().length===0&&(await state()).held===0&&await page.locator('.ghost').count()===0);
 for(const [w,h] of [[320,568],[568,320],[375,667],[667,375],[390,844],[844,390],[768,1024],[1024,768],[1024,1366],[1366,1024]]){
 await page.setViewportSize({width:w,height:h});await reset([['arch','block','roof'],['arch'],[],['arch','roof'],[]]);
 const d=await page.evaluate(()=>[...document.querySelectorAll('[data-piece],.material,#basket,#car,#back')].map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.dataset.piece||e.dataset.kind,w:r.width,h:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
 check('积木中心可直接触及 '+w+'x'+h,await page.evaluate(()=>[...document.querySelectorAll('[data-piece]')].every(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})));
 check('热区与边界 '+w+'x'+h,d.every(r=>r.w>=44&&r.h>=44&&r.left>=0&&r.right<=w&&r.top>=0&&r.bottom<=h),d.filter(r=>r.w<44||r.h<44||r.left<0||r.right>w||r.top<0||r.bottom>h));
 }
 check('无脚本异常',errors.length===0,errors);const scriptSha=await page.evaluate(async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(document.scripts[0].textContent))),b=>b.toString(16).padStart(2,'0')).join(''));return {scriptSha,passed:results.filter(r=>r.ok).length,total:results.length,results};
}
