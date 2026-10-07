// 隔离浏览器 run-code；状态枚举只用于开局，修理全部走真实触摸输入。
async page => {
 if(new URL(page.url()).origin!=='http://127.0.0.1:8775')throw Error('仅本地 8775');
 const out='/Users/xuke/githubProject/monster/output/cookie-arcade/garage-drag-20261007';
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok,detail)=>results.push({name,ok:!!ok,detail});
 const state=()=>page.evaluate(()=>({fault:{...fault},phase,round,misses,selected,held:pointers.size,ghosts:document.querySelectorAll('.ghost').length}));
 const center=async id=>{const b=await page.locator('#'+id).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
 const cdp=await page.context().newCDPSession(page);
 const touchIds=new Set();
 const send=async(type,points)=>{
  if((type==='touchCancel'||type==='touchEnd')&&!touchIds.size)return;
  await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  if(type==='touchStart')points.forEach(p=>touchIds.add(p.id));
  if(type==='touchEnd'){if(points.length)points.forEach(p=>touchIds.delete(p.id));else touchIds.clear();}
  if(type==='touchCancel')touchIds.clear();
  if(type==='touchStart'||type==='touchMove')await page.waitForFunction(expected=>expected.every(p=>Object.values(window.__garageTouchPositions||{}).some(v=>Math.abs(v.x-p.x)<1&&Math.abs(v.y-p.y)<1)),points,{timeout:2000});
  else await page.waitForTimeout(60);
 };
 const setup=async n=>{await send('touchCancel',[]);await page.evaluate(n=>{round=n;newRound();},n);await page.waitForTimeout(800);};
 const tapUse=async(tool,target)=>{await page.locator('#'+tool).tap();await page.locator('#'+target).tap();};
 const hold=async(tool,target)=>{const a=await center(tool),b=await center(target);await send('touchStart',[{...a,id:1}]);await send('touchMove',[{...b,id:1}]);return b;};
 const rub=async(b,count=4,other=[])=>{for(let i=0;i<count;i++)await send('touchMove',[{x:b.x+(i%2?-18:18),y:b.y,id:1},...other]);};
 const release=()=>send('touchEnd',[]);
 try {
 await page.goto('http://127.0.0.1:8775/games/garage/');await page.reload();await page.waitForTimeout(850);
 if(!await page.evaluate(()=>typeof moveTool==='function'&&!!document.querySelector('#headlight')))throw Error('页面仍为旧版，停止验收');
 await page.evaluate(()=>{window.__garageTouchPositions={};for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>{if(type==='pointerup'||type==='pointercancel')delete window.__garageTouchPositions[e.pointerId];else window.__garageTouchPositions[e.pointerId]={x:e.clientX,y:e.clientY};},true);});
 // 手机、小屏横屏和两种 iPad 方向都必须在松手之前完成工具动作。
 for(const [w,h] of [[320,568],[390,844],[844,390],[768,1024],[1024,768]]){
  await page.setViewportSize({width:w,height:h});await setup(0);
  await hold('tire','left-wheel');let s=await state();
  check(`${w}x${h} 轮胎到位即安装`,!s.fault.missing&&!s.fault.tight&&s.held===1,s);await release();
  const b=await hold('wrench','left-wheel');s=await state();check(`${w}x${h} 运输距离不拧紧`,!s.fault.tight,s);
  await page.waitForTimeout(350);check(`${w}x${h} 停住不拧紧`,!(await state()).fault.tight);
  await rub(b,2);s=await state();check(`${w}x${h} 持扳手来回拖即拧紧`,s.fault.tight&&s.held===1,s);
  await page.screenshot({path:`${out}/wrench-${w}x${h}.png`});
  await rub(b,4);await send('touchMove',[{x:8,y:h-8,id:1}]);await release();s=await state();
  check(`${w}x${h} 成功后移开松手不报错`,s.fault.tight&&s.misses===0&&s.held===0&&s.ghosts===0,s);
  const boxes=await page.locator('button,#back').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,w:r.width,h:r.height};}));
  check(`${w}x${h} 热区与屏幕边界`,boxes.every(b=>b.w>=44&&b.h>=44&&b.x>=0&&b.y>=0&&b.x+b.w<=w+1&&b.y+b.h<=h+1),boxes);
 }
 await setup(0);let b=await hold('wrench','left-wheel');await rub(b);await release();let s=await state();
 check('缺轮时扳手不绕过安装',s.fault.missing&&!s.fault.tight&&s.misses===1,s);
 await setup(0);await hold('tire','right-wheel');await release();s=await state();check('错误轮位不能安装',s.fault.missing&&s.misses===1,s);
 await setup(0);await tapUse('tire','left-wheel');b=await hold('pump','left-wheel');await rub(b);await release();s=await state();check('未拧紧时不能打气',s.fault.air===0&&!s.fault.tight,s);
 await setup(0);await tapUse('tire','left-wheel');await page.locator('#wrench').tap();b=await center('left-wheel');
 await send('touchStart',[{...b,id:1}]);await rub(b,3);check('先点工具再拖目标可拧紧',(await state()).fault.tight);await release();
 await setup(0);await tapUse('tire','left-wheel');b=await hold('wrench','left-wheel');
 for(let i=0;i<=12;i++){const angle=i*Math.PI/6;await send('touchMove',[{x:b.x+16*Math.cos(angle),y:b.y+16*Math.sin(angle),id:1}]);}
 check('绕圈拧动同样生效',(await state()).fault.tight);await release();
 b=await hold('pump','left-wheel');check('气筒到位尚未打气',(await state()).fault.air===0);
 await rub(b,2);s=await state();check('气筒目标内运动才计工',s.fault.air===1,s);
 await page.waitForTimeout(350);check('气筒停住不自动补满',(await state()).fault.air===1);
 await rub(b,5);check('不松手能连续打满',(await state()).fault.air===3);await release();
 b=await hold('sponge','body-hit');check('海绵运输距离不擦泥',(await state()).fault.mud===3);
 await rub(b,8);s=await state();check('不松手能擦完但不发车',s.fault.mud===0&&s.phase==='play'&&s.held===1,s);
 await page.locator('#body-hit').evaluate(el=>el.click());s=await state();check('持工具时试车仍须先释放',s.phase==='play'&&s.held===1,s);
 await release();s=await state();check('最后擦洗松手不意外发车',s.phase==='play'&&s.held===0,s);
 await page.locator('#horn').tap();s=await state();check('修好后点车灯只反馈',s.phase==='play'&&await page.locator('#headlight').evaluate(el=>el.classList.contains('lamp-flash')),s);
 check('完成提示在车身',await page.locator('#body-hit').evaluate(el=>el.classList.contains('hint')&&el.getAttribute('aria-label').includes('出发')));
 await page.screenshot({path:out+'/ready.png'});
 await page.locator('#body-hit').tap();s=await state();check('点车身主动出发',s.phase==='drive',s);
 await page.waitForFunction(r=>round>r,s.round,{timeout:5000});check('下一辆恢复可玩',(await state()).phase==='play'&&(await state()).held===0);
 // 一指持扳手，一指擦泥；同场景独立工具，两种松手顺序。
 for(const order of [[1,2],[2,1]]){
  await setup(0);await tapUse('tire','left-wheel');const a=await center('wrench'),c=await center('sponge');b=await center('left-wheel');const body=await center('body-hit');
  await send('touchStart',[{...a,id:1}]);await send('touchStart',[{...a,id:1},{...c,id:2}]);await send('touchMove',[{...b,id:1},{...body,id:2}]);
  for(let i=0;i<4;i++)await send('touchMove',[{x:b.x+(i%2?-18:18),y:b.y,id:1},{x:body.x+(i%2?-18:18),y:body.y,id:2}]);
  s=await state();check(`双工具独立工作 ${order}`,s.fault.tight&&s.fault.mud<3&&s.held===2,s);
  const ends={1:b,2:body};for(const id of order)await send('touchEnd',[{...ends[id],id}]);
  s=await state();check(`两种释放顺序无残留 ${order}`,s.held===0&&s.ghosts===0&&s.misses===0,s);
 }
 await setup(0);await tapUse('tire','left-wheel');b=await hold('wrench','left-wheel');const c=await center('sponge');
 await send('touchStart',[{...b,id:1},{...c,id:2}]);await send('touchMove',[{...b,id:1},{x:c.x,y:c.y-30,id:2}]);
 await page.evaluate(()=>{const p=[...pointers.values()].find(p=>p.tool==='wrench');p.el.dispatchEvent(new PointerEvent('pointercancel',{pointerId:p.id,bubbles:true}));});
 s=await state();check('取消一指保留另一工具且不修理',s.held===1&&s.ghosts===1&&!s.fault.tight,s);await send('touchCancel',[]);
 await setup(0);await tapUse('tire','left-wheel');await page.locator('#wrench').tap();b=await center('left-wheel');
 await send('touchStart',[{...b,id:1}]);await send('touchStart',[{...b,id:1},{x:b.x+4,y:b.y+4,id:2}]);
 s=await state();check('目标上同工具不能被双指抢占',s.held===1,s);await send('touchCancel',[]);
 await setup(0);await tapUse('tire','left-wheel');await hold('wrench','left-wheel');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await release();s=await state();
 check('失焦释放不误拧紧',s.held===0&&s.ghosts===0&&!s.fault.tight,s);
 // 老的两次点击和拖到目标立刻松手仍等价，未完成不误发车。
 await setup(0);await tapUse('tire','left-wheel');await hold('wrench','left-wheel');await release();check('拖放扳手仍可拧紧',(await state()).fault.tight);
 await setup(0);await tapUse('tire','left-wheel');await tapUse('wrench','left-wheel');check('点选扳手仍可拧紧',(await state()).fault.tight);
 await page.locator('#body-hit').tap();check('未修完点车身不出发',(await state()).phase==='play');
 const audio=await page.evaluate(async()=>{voice.pause();clearTimeout(voiceTimer);voice.src='audio/ready.mp3';return new Promise(resolve=>{const timer=setTimeout(()=>resolve({ended:false}),7000);voice.onended=()=>{clearTimeout(timer);resolve({ended:true,duration:voice.duration});};voice.play().catch(e=>{clearTimeout(timer);resolve({ended:false,error:String(e)});});});});check('新试车语音可播放结束',audio.ended,audio);
 check('无浏览器脚本错误',errors.length===0,errors);
 return {passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results,limitations:['真实 Chromium 触摸分发；未连接用户 iPad/Safari 或验证扬声器听感','单指取消和失焦用合成生命周期事件']};
 } catch(e) { return {error:String(e),passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results,state:await state()}; } finally { await cdp.detach(); }
}
