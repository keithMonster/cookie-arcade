// Playwright CLI run-code 页面函数；先打开本地或线上的 games/elevator/。
async (page) => {
  const results=[],errors=[];
  const site=page.url().split('/games/')[0], game=`${site}/games/elevator/`;
  page.on('pageerror',error=>errors.push(error.message));
  const check=(name,ok,detail)=>{ results.push({name,ok,detail}); if (!ok) throw new Error(JSON.stringify(results)); };
  const state=()=>page.evaluate(()=>({floor,targetFloor,doors,phase,round,mistakes,doorMistakes,successCount,voice:voice.src}));
  const control=action=>page.locator(`[data-action="${action}"]`);
  const tapNow=async action=>{const r=await control(action).boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);};
  const settle=()=>page.waitForFunction(()=>phase==='idle'||phase==='success');
  const act=async action=>{ await control(action).click(); await settle(); };
  const reset=async (from=0,to=2)=>page.evaluate(({from,to})=>{
    dealRound(); floor=from; targetFloor=to; successCount=0;
    document.body.classList.add('no-transition'); thought.innerHTML=animalArt(homes[to].id); render();
    void lift.offsetWidth; document.body.classList.remove('no-transition');
  },{from,to});
  await page.goto(game); await page.setViewportSize({width:1024,height:768});
  for (const from of [0,1,2]) for (const to of [0,1,2]) {
    if (from===to) continue;
    await reset(from,to);
    const direction=from<to?'up':'down', step=from<to?1:-1;
    await act(direction); await act(direction);
    let s=await state();
    check(`${from}→${to}：门开着不能移动或成功`,s.floor===from&&s.successCount===0&&s.doors==='open',s);
    check(`${from}→${to}：错两次只提示关门`,await control('close').evaluate(el=>el.classList.contains('hint')));
    await act('close');
    check(`${from}→${to}：关门后不会把方向答案也亮出来`,await page.locator('.control.hint').count()===0);
    let expected=from;
    while (expected!==to) {
      await act(direction); expected+=step; s=await state();
      check(`${from}→${to}：明确按一次只到${expected}层`,s.floor===expected&&s.doors==='closed'&&s.successCount===0&&s.phase==='idle',s);
      check(`${from}→${to}：停层不代选开门`,await page.locator('.control.hint').count()===0&&!s.voice.endsWith('/opening.mp3'));
    }
    await act('open'); s=await state();
    check(`${from}→${to}：明确在目标开门才成功`,s.phase==='success'&&s.floor===to&&s.successCount===1,s);
    await tapNow('up'); await tapNow('close');
    check(`${from}→${to}：庆祝中多点不能重复完成`,(await state()).successCount===1);
  }
  const finishedRound=(await state()).round;
  await page.waitForFunction(old=>round>old,finishedRound,{timeout:7000});
  check('自然换轮保留实际位置、清提示、目标换为别层',await page.evaluate(()=>phase==='idle'&&doors==='open'&&floor!==targetFloor&&mistakes===0&&doorMistakes===0&&!passenger.classList.contains('visiting')));

  await reset(0,2);
  for (let i=0;i<3;i++) { await act('close'); await act('open'); }
  let s=await state();
  check('错误楼层反复开关门仍不送达',s.floor===0&&s.successCount===0&&s.phase==='idle',s);
  check('错误开门次数跨关门保留，提示能出现',s.mistakes===3&&await control('close').evaluate(el=>el.classList.contains('hint')),s);
  for (let i=0;i<4;i++) { await page.locator('.room').nth(i%3).click(); await page.locator('#mission').click(); }
  check('只点朋友与目标气泡不会移动、选层或成功',await page.evaluate(()=>floor===0&&successCount===0&&phase==='idle'));
  await page.evaluate(()=>{lastInput=Date.now()-11000;}); await page.waitForTimeout(1200);
  check('空闲提示不会自动完成任何动作',await page.evaluate(()=>floor===0&&doors==='open'&&successCount===0));
  await act('close'); await act('up');
  check('两层目标在中间层不能算完成',await page.evaluate(()=>floor===1&&successCount===0&&mistakes===0));
  await act('open');
  check('中间层开门狐狸仍在轿厢',await page.evaluate(()=>phase==='idle'&&floor===1&&successCount===0&&!passenger.classList.contains('visiting')));

  for (const [from,to,bad] of [[0,2,'down'],[2,0,'up']]) {
    await reset(from,to); await act('close');
    for (let i=0;i<8;i++) await act(bad);
    s=await state();check(`${from}层：反复按边界方向不越界、不送达`,s.floor===from&&s.successCount===0&&s.phase==='idle',s);
  }
  await reset(1,2); await act('close'); await act('down');
  check('选错方向会真实走远一层，可观察后纠正',await page.evaluate(()=>floor===0&&mistakes===1&&successCount===0));
  await act('up'); check('纠正方向回到中间层且撤掉方向提示',await page.evaluate(()=>floor===1&&mistakes===0&&successCount===0));

  await reset(); await act('close');
  await control('up').click(); await tapNow('open'); await tapNow('up');
  await settle(); await page.waitForTimeout(900);
  check('移动中开门/连点不排队，停稳仍在一层',await page.evaluate(()=>floor===1&&doors==='closed'&&phase==='idle'&&successCount===0));
  await reset(0,1); await act('close'); await control('up').click();
  let heldBox=await control('open').boundingBox();
  await page.mouse.move(heldBox.x+heldBox.width/2,heldBox.y+heldBox.height/2); await page.mouse.down();
  await settle(); await page.mouse.up(); await page.waitForTimeout(650);
  check('移动中按住开门、停稳后松手仍不兑现',await page.evaluate(()=>floor===1&&doors==='closed'&&phase==='idle'&&successCount===0));
  await act('open'); const heldRound=(await state()).round;
  heldBox=await control('close').boundingBox();
  await page.mouse.move(heldBox.x+heldBox.width/2,heldBox.y+heldBox.height/2); await page.mouse.down();
  await page.waitForFunction(old=>round>old,heldRound,{timeout:6000}); await page.mouse.up(); await page.waitForTimeout(550);
  check('庆祝中按住关门、换轮后松手不操作新一轮',await page.evaluate(()=>doors==='open'&&phase==='idle'&&!press));
  await reset(0,1); await act('close'); await control('up').click();
  await control('open').focus(); await page.keyboard.down('Space'); await settle(); await page.keyboard.up('Space'); await page.waitForTimeout(650);
  check('忙态开始的空格键按住不在停稳后激活',await page.evaluate(()=>doors==='closed'&&phase==='idle'&&successCount===0));
  for (const eventName of ['blur','resize','visibilitychange']) {
    await reset(); heldBox=await control('close').boundingBox();
    await page.mouse.move(heldBox.x+heldBox.width/2,heldBox.y+heldBox.height/2); await page.mouse.down();
    await page.evaluate(name=>(name==='visibilitychange'?document:window).dispatchEvent(new Event(name)),eventName);
    await page.mouse.up(); await page.waitForTimeout(550);
    check(`${eventName}取消后松手不执行动作`,await page.evaluate(()=>doors==='open'&&phase==='idle'&&!press));
  }
  await reset(); await act('close');
  await page.keyboard.down('ArrowUp'); await settle(); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(900); await page.keyboard.up('ArrowUp');
  check('长按方向键不会跨多个楼层',await page.evaluate(()=>floor===1&&successCount===0));
  await page.keyboard.press('ArrowUp'); await settle(); await page.keyboard.press('ArrowLeft'); await settle();
  check('键盘逐次移动并主动开门能送达',await page.evaluate(()=>floor===2&&phase==='success'&&successCount===1));
  await reset(2,1); await page.keyboard.press('ArrowRight'); await settle();
  await control('down').focus(); await page.keyboard.press('Enter'); await settle();
  await control('open').focus(); await page.keyboard.press('Space'); await settle();
  check('原生按钮聚焦后 Enter/Space 能完整完成',await page.evaluate(()=>floor===1&&phase==='success'));
  for (const action of ['up','down','open','close']) {
    await reset(1,2); if (action!=='close') await act('close');
    const edge=await control(action).boundingBox();
    await page.mouse.click(edge.x+edge.width/2,edge.y+2,{delay:160}); await settle();
    const s=await state();
    check(`${action}：顶部边缘点击不被按压位移吞掉`,action==='up'?s.floor===2:action==='down'?s.floor===0:action==='open'?s.doors==='open':s.doors==='closed',s);
  }

  await reset(); await act('close'); await control('up').click();
  await page.evaluate(()=>dealRound()); const newState=await state(); await page.waitForTimeout(1000);
  check('旧移动回调不污染新一轮',await page.evaluate(expected=>round===expected.round&&floor===expected.floor&&targetFloor===expected.targetFloor&&phase==='idle'&&doors==='open'&&successCount===0,newState));

  for (const [width,height] of [[320,568],[390,844],[568,320],[844,390],[768,1024],[1024,768],[1024,600],[1280,720]]) {
    await page.setViewportSize({width,height}); await reset();
    const layout=await page.locator('#back,#mission,.room,.control').evaluateAll(els=>els.map(el=>{
      const r=el.getBoundingClientRect(),front=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {name:el.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,min:el.matches('.control')?56:44,hit:!!front&&el.contains(front)};
    }));
    check(`${width}×${height}：按钮可见、可命中且尺寸足够`,layout.every(r=>r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1&&r.w>=r.min-.1&&r.h>=r.min-.1&&r.hit),layout);
    if (width===390||width===844||width===1024&&height===768) await page.screenshot({path:`output/playwright/elevator-${width}x${height}.png`});
  }
  await page.setViewportSize({width:390,height:844}); await reset(0,1);
  const touch=await page.context().newCDPSession(page);
  try {
    await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    const center=async action=>{const r=await control(action).boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
    const tap=async action=>{await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await center(action)]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();};
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await center('close')]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    check('取消触摸不会执行关门',await page.evaluate(()=>doors==='open'&&phase==='idle'));
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await center('close')]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:12,y:150}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await settle();
    check('手指拖出按钮再松开不执行关门',await page.evaluate(()=>doors==='open'&&phase==='idle'));
    const firstFinger={...await center('close'),id:0}, secondFinger={...await center('open'),id:1};
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[firstFinger]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[firstFinger,secondFinger]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[secondFinger]}); await settle();
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await page.waitForTimeout(550);
    check('真实双指不能抢锁，也不能排队到第一指完成后',await page.evaluate(()=>doors==='closed'&&floor===0&&successCount===0&&!press));
    await reset(0,1);
    await tap('close'); await tap('up'); await tap('open');
    check('真实触屏点击能完成送达',await page.evaluate(()=>floor===1&&phase==='success'&&successCount===1));
    await page.waitForTimeout(1100); await page.screenshot({path:'output/playwright/elevator-arrival.png'});
  } finally {await touch.detach();}

  const decoded=await page.evaluate(async()=>{
    const ctx=new AudioContext(),names=['task_bear','task_cat','task_rabbit','home_bear','home_cat','home_rabbit','door_open','door_closed','opening','closing','up','down','close_first','above','below','top','bottom','hello','look'];
    try{return await Promise.all(names.map(async name=>{const r=await fetch(`audio/${name}.mp3`),audio=await ctx.decodeAudioData(await r.arrayBuffer());return {name,status:r.status,duration:audio.duration};}));}finally{await ctx.close();}
  });
  check('19条语音HTTP200、可解码且未超过6秒看门狗',decoded.length===19&&decoded.every(a=>a.status===200&&a.duration>0&&a.duration<6),decoded);
  await page.route('**/games/elevator/audio/*.mp3',route=>route.abort());
  await reset(); await act('close'); await act('up'); await act('up'); await act('open');
  const silentRound=(await state()).round;
  await page.waitForFunction(old=>round>old,silentRound,{timeout:6000});
  check('音频全失败仍能送达并换轮',await page.evaluate(()=>phase==='idle'&&floor!==targetFloor));
  await page.unroute('**/games/elevator/audio/*.mp3');
  await reset();
  await page.evaluate(()=>{voice.play=()=>new Promise(()=>{});say(['task_bear','door_closed']);});
  await page.waitForFunction(()=>voice.src.endsWith('/door_closed.mp3'),null,{timeout:7500});
  check('媒体无 ended/error 时看门狗推进语音链',await page.evaluate(()=>phase==='idle'&&floor===0&&successCount===0));
  await page.reload(); await reset(0,1);
  await page.emulateMedia({reducedMotion:'reduce'}); await act('close'); await act('up'); await act('open');
  check('减少动态效果时状态转换仍完整',await page.evaluate(()=>phase==='success'&&successCount===1));
  await page.emulateMedia({reducedMotion:'no-preference'});

  await page.route('**/games/elevator/',async route=>{
    const response=await route.fetch(),source=await response.text();
    await route.fulfill({response,body:source.replace('rect=old.rect','rect=old.button.getBoundingClientRect()')});
  });
  await page.goto(game); await reset(0,1);
  const edge=await control('close').boundingBox(); await page.mouse.click(edge.x+edge.width/2,edge.y+2,{delay:160}); await settle();
  check('反向样本：按压后才取边界会吞掉顶部点击',await page.evaluate(()=>doors==='open'&&phase==='idle'));
  await page.unroute('**/games/elevator/');
  await page.route('**/games/elevator/',async route=>{
    const response=await route.fetch(),source=await response.text();
    await route.fulfill({response,body:source.replace(" || floor!==targetFloor)",")")});
  });
  await page.goto(game); await reset(0,2); await act('close'); await act('open');
  check('反向样本：移除位置守卫会在错误层送达',await page.evaluate(()=>floor===0&&targetFloor===2&&phase==='success'&&successCount===1));
  await page.unroute('**/games/elevator/');
  await page.goto(`${site}/`);
  check('首页28款、电梯叮咚排第一且动态预览存在',await page.locator('a.tile').count()===28&&await page.locator('a.tile').first().getAttribute('href')==='games/elevator/'&&await page.locator('.preview.elevator .ev-lift').count()===1);
  await page.keyboard.press('1'); await page.waitForURL(game);
  check('首页按1进入电梯游戏',page.url()===game);
  await page.locator('#back').focus(); await page.keyboard.press('Enter'); await page.waitForURL(`${site}/`);
  check('键盘返回首页有效',page.url()===`${site}/`);
  await page.locator('a[href="games/elevator/"]').click(); await page.locator('#back').click();
  check('首页鼠标进入与返回有效',page.url()===`${site}/`);
  check('无页面JS异常',errors.length===0,errors);
  return {passed:results.length,results};
}
