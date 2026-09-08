// 交给 Playwright CLI run-code 的页面函数；本地服务器由调用者启动。
// 示例：playwright-cli -s=cookie-road run-code '<本文件内容>'
async (page) => {
  const results = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (name, ok, detail) => { results.push({name, ok, detail}); if (!ok) throw new Error(JSON.stringify(results)); };
  const reset = async (index = 0) => page.evaluate(index => {
    const original = Math.random;
    routeIndex = -1; round = 5; Math.random = () => (index + .1) / ROUTES.length;
    try { dealRound(); } finally { Math.random = original; }
  }, index);
  const state = () => page.evaluate(() => ({round, phase, misses:holes.map(g=>g.misses), filled:holes.map(g=>g.filled), drag:!!drag, ghosts:document.querySelectorAll('#ghost').length}));
  const pieceFor = async (gapIndex, correct = true) => {
    const index = await page.evaluate(({gapIndex, correct}) => pieces.findIndex(p => correct ? p.type === holes[gapIndex].type : p.type !== holes[gapIndex].type), {gapIndex,correct});
    return page.locator('#tray .piece').nth(index);
  };
  const gapAt = index => page.locator('#board .gap').nth(index);
  await page.goto('http://127.0.0.1:8907/games/road/');
  await page.setViewportSize({width:1024,height:768});
  for (let layout=0; layout<6; layout++) {
    await reset(layout);
    await (await pieceFor(0,false)).click(); await gapAt(0).click();
    await (await pieceFor(0,false)).click();
    let s = await state();
    check(`布局${layout}：两次错接不填洞且给光提示`, !s.filled.some(Boolean) && s.misses[0]===2 && await page.locator('#tray .glow').count() > 0, s);
    await (await pieceFor(0)).click();
    check(`布局${layout}：先选缺口再选路块`, (await state()).filled[0]);
    await (await pieceFor(1)).click(); await gapAt(1).click();
    check(`布局${layout}：接通后开车`, (await state()).phase === 'drive');
  }
  const completedRound = (await state()).round;
  await page.waitForFunction(() => phase === 'celebrate');
  const audio = await page.evaluate(() => ({src:voice.src,paused:voice.paused}));
  check('到家播放 home 语音', audio.src.endsWith('/home.mp3') && !audio.paused, audio);
  await page.waitForFunction(old => round > old, completedRound, {timeout:10000});
  check('自然换轮清空提示与选择', await page.evaluate(() => phase==='build' && !selected && !focusGap && holes.every(g=>g.misses===0 && !g.filled)));

  await reset();
  const source = await (await pieceFor(0)).boundingBox(), target = await gapAt(0).boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2); await page.mouse.down();
  await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:12}); await page.mouse.up();
  check('真实鼠标拖放接路', (await state()).filled[0]);
  await reset();
  for (let i=0;i<4;i++) {
    const r = await (await pieceFor(0)).boundingBox();
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2); await page.mouse.down();
    await page.mouse.move(12,100,{steps:8}); await page.mouse.up();
  }
  check('四次拖偏只提示、不替孩子填洞', !(await state()).filled.some(Boolean));
  await (await pieceFor(0)).click(); await gapAt(0).click();
  check('拖偏后仍可用点选明确接路', (await state()).filled[0]);
  await reset();
  for (let i=0;i<2;i++) {
    const index = await page.evaluate(i=>pieces.findIndex(p=>p.type===holes[i].type),i);
    await page.keyboard.press(String(index+1)); await page.keyboard.press(i ? 'b' : 'a');
  }
  check('数字键选择 + A/B 放置能接通', (await state()).phase==='drive');

  await reset();
  await page.evaluate(() => {
    const fire = (el,type,id,x,y) => el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y}));
    const p=pieces[0].el,r=p.getBoundingClientRect(); fire(p,'pointerdown',41,r.x+20,r.y+20); fire(document,'pointermove',41,r.x+40,r.y-30);
    fire(pieces[1].el,'pointerdown',42,r.x+20,r.y+20); fire(document,'pointerup',42,0,0);
  });
  check('第二指不能抢走第一指的拖拽', await page.evaluate(()=>drag?.id===41));
  await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:41,pointerType:'touch'})));
  check('取消拖放不判错、不留影子', await page.evaluate(()=>!drag && !document.querySelector('#ghost') && holes.every(g=>g.misses===0)));

  for (const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1024,600],[1024,675],[1280,720]]) {
    await page.setViewportSize({width,height}); await reset();
    const layout = await page.evaluate(() => [...document.querySelectorAll('#back,.gap,.piece')].map(el=>{
      const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};
    }));
    check(`${width}×${height}：目标完整可见且至少44px`,layout.every(r=>r.x>=0 && r.y>=0 && r.right<=width+1 && r.bottom<=height+1 && r.w>=44 && r.h>=44),layout);
    if (width===390 || width===844 || width===1024 && height===768) await page.screenshot({path:`output/playwright/road-${width}x${height}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  const touch = await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await reset();
  const a=await (await pieceFor(0)).boundingBox(),b=await gapAt(0).boundingBox();
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check('真实触屏事件拖放接路', (await state()).filled[0]);
  await touch.detach();
  const decoded = await page.evaluate(async () => {
    const context = new AudioContext();
    try { return await Promise.all(['intro','choose','mismatch','hint','place','wait','joined','go','home','next'].map(async name=>{
      const response=await fetch(`audio/${name}.mp3`); const data=await context.decodeAudioData(await response.arrayBuffer()); return {name,status:response.status,duration:data.duration};
    })); } finally { await context.close(); }
  });
  check('10条语音HTTP200且实际可解码',decoded.length===10 && decoded.every(a=>a.status===200 && a.duration>0),decoded);
  await page.route('**/games/road/audio/*.mp3',route=>route.abort());
  await reset();
  for (let i=0;i<2;i++) { await (await pieceFor(i)).click(); await gapAt(i).click(); }
  const failedAudioRound=(await state()).round;
  await page.waitForFunction(old=>round>old,failedAudioRound,{timeout:14000});
  check('音频全部失败仍能完成并换轮',(await state()).phase==='build');
  await page.unroute('**/games/road/audio/*.mp3');
  await reset();
  for (let i=0;i<2;i++) { await (await pieceFor(i)).click(); await gapAt(i).click(); }
  await page.locator('#back').focus(); await page.keyboard.press('Enter');
  await page.waitForURL('http://127.0.0.1:8907/');
  check('行驶中键盘激活返回键',page.url()==='http://127.0.0.1:8907/');
  await page.route('**/games/road/',async route=>{
    const response=await route.fetch(); const text=await response.text();
    await route.fulfill({response,body:text.replace('if (piece.type !== gap.type)','if (false)')});
  });
  await page.goto('http://127.0.0.1:8907/games/road/');
  await (await pieceFor(0,false)).click(); await gapAt(0).click();
  check('反向样本：拿掉连通判定会把错块放进去', (await state()).filled[0]);
  await page.unroute('**/games/road/');
  await page.goto('http://127.0.0.1:8907/');
  check('首页28款且包含修路喽',await page.locator('a.tile').count()===28 && await page.locator('a.tile[href="games/road/"]').count()===1);
  await page.locator('a.tile[href="games/road/"]').click();
  check('首页可进入新游戏',page.url().endsWith('/games/road/'));
  await page.locator('#back').click(); check('返回键回到首页',page.url()==='http://127.0.0.1:8907/');
  check('无页面JS异常',errors.length===0,errors);
  return {passed:results.length,results};
}
