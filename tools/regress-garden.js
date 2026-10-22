// Playwright CLI run-code；只测试隔离本地服务，不触达外部系统。
async page => {
 const origin='http://127.0.0.1:8791',out='/Users/xuke/githubProject/monster/output/cookie-arcade/garden-20261022';
 if(new URL(page.url()).origin!==origin)throw Error('local only');
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw Error(JSON.stringify(results));};
 const state=()=>page.evaluate(()=>gardenDebug());
 const tap=sel=>page.locator(sel).tap({force:true});
 const center=sel=>page.locator(sel).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 const reset=async s=>{await page.evaluate(s=>localStorage.setItem('cookie-garden-v1',JSON.stringify(s||{schema:1,beds:[null,null,null],basket:[],table:[]})),s);await page.reload();};
 const plant=async(kind,i)=>{await tap('[data-seed="'+kind+'"]');await tap('[data-bed="'+i+'"]');};
 const water=async i=>{await tap('#water');await tap('[data-bed="'+i+'"]');};
 const harvest=async i=>{await tap('[data-bed="'+i+'"]');await tap('#basket');};
 const ripe=(kind='carrot')=>({kind,color:0,stage:3});
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/games/garden/');await reset();
 check('无文字UI',!(await page.locator('#scene').innerText()).trim());
 for(const [i,kind] of ['carrot','strawberry','flower'].entries()){
  await plant(kind,i);check(kind+'种下',(await state()).state.beds[i]?.stage===1);
  await water(i);check(kind+'发芽',(await state()).state.beds[i]?.stage===2);
  await water(i);check(kind+'成熟',(await state()).state.beds[i]?.stage===3);
 }
 await page.screenshot({path:out+'/ripe-phone.png'});
 await page.reload();check('刷新保留三圃',(await state()).state.beds.every(c=>c?.stage===3));
 await plant('flower',0);check('已种不可覆盖',(await state()).state.beds[0].kind==='carrot');
 for(let i=0;i<3;i++)await harvest(i);
 check('三种收获进篮',(await state()).state.basket.length===3&&(await state()).state.beds.every(c=>!c));
 await plant('flower',1);await water(1);await water(1);await harvest(1);
 check('满篮不摘除',(await state()).state.beds[1]?.stage===3&&(await state()).state.basket.length===3);
 // 满篮提示之后直接点篮子配送，不要求孩子额外取消选中。
 await tap('#basket');
 check('配送立即原子提交',(await state()).state.basket.length===0&&(await state()).state.table.length===3);
 await page.reload();check('配送动画中刷新不丢物',(await state()).state.table.length===3&&(await state()).state.basket.length===0);
 await reset();await water(0);check('空地浇水不生植物',(await state()).state.beds[0]===null);
 await plant('carrot',0);await tap('[data-bed="0"]');check('幼苗不能收获',(await state()).state.beds[0]?.stage===1);
 await reset();
 for(let round=0;round<20;round++){
  const i=round%3,kind=['carrot','strawberry','flower'][round%3];
  await plant(kind,i);await water(i);await water(i);await harvest(i);await tap('#basket');
  check('连续循环 '+(round+1),(await state()).state.table[0]?.kind===kind&&(await state()).state.beds.every(c=>!c)&&(await state()).held===0);
 }
 // 用真实CDP触屏覆盖拖动与多触点；WebKit由下方DOM PointerEvent单独覆盖恢复分支。
 let cdp;try{cdp=await page.context().newCDPSession(page);}catch{}
 if(cdp){
  const send=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p});
  const drag=async(a,b,delay=0)=>{const p=await center(a),q=await center(b);await send('touchStart',[{...p,id:1}]);await send('touchMove',[{...q,id:1}]);if(delay)await page.waitForTimeout(delay);await send('touchEnd',[]);};
  await reset();await drag('[data-seed="flower"]','[data-bed="0"]');check('真实触摸拖种子',(await state()).state.beds[0]?.stage===1);
  await drag('#water','[data-bed="0"]',100);check('水壶不足600ms松手不成长',(await state()).state.beds[0]?.stage===1);
  await drag('#water','[data-bed="0"]',700);check('水壶停留发芽',(await state()).state.beds[0]?.stage===2);
  await drag('#water','[data-bed="0"]',1400);check('同手势同地块只成长一次',(await state()).state.beds[0]?.stage===3);
  await drag('[data-bed="0"]','#basket');check('真实拖动收获',(await state()).state.basket.length===1&&(await state()).state.beds[0]===null);
  for(const order of [[1,2],[2,1]]){
   await reset();const a=await center('[data-seed="carrot"]'),b=await center('[data-seed="flower"]'),x=await center('[data-bed="0"]'),y=await center('[data-bed="2"]');
   await send('touchStart',[{...a,id:1}]);await send('touchStart',[{...a,id:1},{...b,id:2}]);await send('touchMove',[{...x,id:1},{...y,id:2}]);check('双指持不同种子 '+order,(await state()).held===2);
   const remaining=order[1];await send('touchEnd',[{...(remaining===1?x:y),id:remaining}]);await send('touchEnd',[]);
   check('双指两种松手次序 '+order,(await state()).state.beds[0]?.kind==='carrot'&&(await state()).state.beds[2]?.kind==='flower');
  }
  await reset();let a=await center('[data-seed="carrot"]'),x=await center('[data-bed="1"]');await send('touchStart',[{...a,id:1}]);await send('touchMove',[{...x,id:1}]);await send('touchCancel',[]);
  check('取消拖种子无提交无鬼影',(await state()).state.beds.every(c=>!c)&&(await state()).held===0&&await page.locator('.ghost').count()===0);
  await plant('carrot',0);a=await center('#water');x=await center('[data-bed="0"]');await send('touchStart',[{...a,id:1}]);await send('touchMove',[{...x,id:1}]);await page.waitForTimeout(150);await send('touchCancel',[]);await page.waitForTimeout(650);
  check('浇水600ms前取消不提交',(await state()).state.beds[0]?.stage===1);
  await send('touchStart',[{...a,id:1}]);await send('touchMove',[{...x,id:1}]);await page.waitForTimeout(700);await send('touchCancel',[]);check('浇水提交后取消保留',(await state()).state.beds[0]?.stage===2&&(await state()).held===0);
 }
 // 两个独立Pointer ID；不直接调用业务函数，验证事件入口归属。
 const pointer=async(type,id,sel)=>page.evaluate(({type,id,sel})=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2}));},{type,id,sel});
 await reset({schema:1,beds:[{kind:'carrot',color:0,stage:1},null,null],basket:[],table:[]});
 await tap('#water');await pointer('pointerdown',41,'#water');await pointer('pointermove',41,'#cloud');await pointer('pointerdown',42,'#water');await pointer('pointerup',42,'#water');await pointer('pointerdown',43,'[data-bed="0"]');await pointer('pointerup',43,'[data-bed="0"]');
 check('持水壶第二指不能抢工具',(await state()).state.beds[0].stage===1&&(await state()).held===1);await pointer('pointercancel',41,'#water');
 await reset({schema:1,beds:[ripe(),null,null],basket:[{kind:'flower',color:1}],table:[]});
 await pointer('pointerdown',51,'[data-bed="0"]');await pointer('pointermove',51,'#cloud');await tap('#basket');check('持作物时第二指可配送旧收获',(await state()).state.table.length===1&&(await state()).held===1);
 await pointer('pointerup',51,'#basket');check('配送后按当前空篮放入作物',(await state()).state.basket[0]?.kind==='carrot'&&(await state()).state.beds[0]===null);
 await reset();await pointer('pointerdown',61,'[data-seed="flower"]');await pointer('pointermove',61,'[data-bed="1"]');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));check('失焦清理手势',(await state()).held===0&&await page.locator('.ghost').count()===0);
 for(const bad of ['{bad',JSON.stringify({schema:2,beds:[null,null,null],basket:[],table:[]}),JSON.stringify({schema:1,beds:[{kind:'unknown',stage:9,color:0},null,null],basket:[],table:[]})]){
  await page.evaluate(s=>localStorage.setItem('cookie-garden-v1',s),bad);await page.reload();check('无效存档安全恢复 '+bad.slice(0,20),(await state()).state.beds.every(c=>!c));
 }
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('denied');};});await plant('flower',0);check('存储拒绝仍能玩',(await state()).state.beds[0]?.kind==='flower');await page.reload();
 await reset({schema:1,beds:[ripe('carrot'),ripe('strawberry'),ripe('flower')],basket:[{kind:'flower',color:2}],table:[{kind:'carrot',color:0}]});
 for(const [w,h] of [[320,568],[390,844],[667,375],[844,390],[768,1024],[1024,768]]){
  await page.setViewportSize({width:w,height:h});
  const boxes=await page.locator('.seed,#water,.bed,#basket,#friend,#sun,#cloud,#bee,#table,#back').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}));
  check('视口与44px热区 '+w+'x'+h,boxes.every(r=>r.x>=0&&r.y>=0&&r.right<=w+.1&&r.bottom<=h+.1&&r.w>=44&&r.h>=44),boxes);
  await page.screenshot({path:out+'/'+w+'x'+h+'.png'});
 }
 await page.setViewportSize({width:390,height:844});for(const id of ['sun','cloud','bee','friend','table']){await tap('#'+id);check('显眼物件反馈 '+id,await page.locator('#'+id).evaluate(e=>e.classList.contains('pop')));}
 await reset();await page.evaluate(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(Error('blocked'));};});await plant('carrot',0);await water(0);check('语音不驱动状态',(await state()).state.beds[0]?.stage===2);
 check('零运行异常',errors.length===0,errors);return results;
}
