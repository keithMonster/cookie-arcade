// Playwright CLI run-code：在本地或已部署 beads 页面运行，只读取静态资源。
async (page) => {
  const results=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const check=(name,ok,detail)=>{results.push({name,ok,detail});if(!ok)throw Error(JSON.stringify(results));};
  const state=()=>page.evaluate(()=>({round,next,start,selected,misses,phase,expected:expected(),drag:!!drag}));
  const pick=async kind=>page.locator(`[data-kind="${kind}"]`).click();
  const place=async index=>page.locator(`[data-slot="${index}"]`).click();
  const reset=()=>page.evaluate(()=>dealRound());
  await page.reload();await page.waitForSelector('.choice');
  for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768]]) {
    await page.setViewportSize({width,height});
    const boxes=await page.locator('#back,#friend,.slot,.choice').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
    check(`${width}x${height} 所有目标可见且44px`,boxes.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1&&r.w>=44&&r.h>=44),boxes);
    check(`${width}x${height} 目标无遮挡`,boxes.every(r=>r.hit),boxes);
    await page.screenshot({path:`/Users/xuke/githubProject/monster/output/cookie-arcade/beads-20261004/${width}x${height}.png`});
  }
  await page.setViewportSize({width:768,height:1024});
  let s=await state();
  await place(4);check('未选珠不补答案',(await state()).next===4);
  await pick(1-s.expected);await place(4);await pick(1-s.expected);await place(4);
  check('两次错珠保持原序列且只提示',(await state()).next===4&&await page.locator('.hint').count()===2);
  await pick(s.expected);await place(5);check('不能跳过前一个空位',(await state()).next===4);
  await pick(s.expected);await place(4);check('正确第一颗只前进一步',(await state()).next===5&&(await state()).misses===0);
  s=await state();await pick(s.expected);await place(5);
  check('完成佩戴项链',(await state()).phase==='celebrate'&&await page.locator('#necklace .bead').count()===6);
  const finishedRound=(await state()).round;await page.waitForFunction(r=>round>r,finishedRound);
  check('自动新轮完整重置',(await state()).next===4&&(await state()).misses===0&&(await state()).selected===null);
  // 原生鼠标拖放，不直接调用判定函数。
  s=await state();await page.locator(`[data-kind="${s.expected}"]`).dragTo(page.locator('[data-slot="4"]'));
  check('鼠标拖放放入正确珠',(await state()).next===5);
  const wrong=1-(await state()).expected;await page.locator(`[data-kind="${wrong}"]`).dragTo(page.locator('[data-slot="5"]'));
  check('拖错珠不通过',(await state()).next===5&&(await state()).misses===1);
  await reset();s=await state();const el=page.locator(`[data-kind="${s.expected}"]`);const b=await el.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(20,200,{steps:5});await page.mouse.up();
  check('拖偏计尝试但不完成',(await state()).misses===1&&(await state()).next===4&&(await state()).selected===null);
  // 取消与副指必须不计错、不消费选择。
  await el.dispatchEvent('pointerdown',{pointerId:80,isPrimary:true,button:0,clientX:200,clientY:800});
  await el.dispatchEvent('pointermove',{pointerId:80,isPrimary:true,clientX:250,clientY:500});
  await el.dispatchEvent('pointerup',{pointerId:81,isPrimary:false,clientX:250,clientY:500});
  check('副指释放不结束主拖动',(await state()).drag);
  await el.dispatchEvent('pointercancel',{pointerId:80,isPrimary:true});
  check('取消不加错且清理影子',!(await state()).drag&&(await state()).misses===1&&await page.locator('#ghost').count()===0);
  await reset();s=await state();
  await page.locator(`[data-kind="${s.expected}"]`).tap();await page.locator('[data-slot="4"]').tap();
  check('真实触摸点击可放珠',(await state()).next===5);
  s=await state();await page.locator(`[data-kind="${s.expected}"]`).focus();await page.keyboard.press('Space');
  await page.locator('[data-slot="5"]').focus();await page.keyboard.press('Enter');check('键盘空格回车完成',(await state()).phase==='celebrate');
  await reset();await page.evaluate(()=>{window.savedPlay=voice.play;voice.play=()=>Promise.reject(Error('blocked'));});
  for(let i=4;i<6;i++){s=await state();await pick(s.expected);await place(i);}
  check('媒体拒绝不阻塞完成',(await state()).phase==='celebrate');
  const old=(await state()).round;await page.waitForFunction(r=>round>r,old);check('媒体拒绝不阻塞换轮',(await state()).phase==='play');
  await page.evaluate(()=>{voice.play=window.savedPlay;});
  await page.evaluate(()=>{phase='celebrate';window.dispatchEvent(new PageTransitionEvent('pagehide'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  check('bfcache恢复不会卡庆祝',(await state()).phase==='play'&&(await state()).next===4);
  const starts=new Set(),sides=new Set();
  for(let i=0;i<30;i++){await reset();starts.add((await state()).start);sides.add(await page.locator('.choice').first().getAttribute('data-kind'));}
  check('起始形状与候选左右均会变化',starts.size===2&&sides.size===2);
  for(const file of ['intro','place','choose','look','next','again','done','next_round']){
    const r=await page.request.get(new URL(`audio/${file}.mp3`,page.url()).href);check(`音频 ${file}`,r.status()===200&&(await r.body()).length>1024);
  }
  const decoded=await page.evaluate(async()=>{const ctx=new AudioContext();try{const data=await fetch('audio/intro.mp3').then(r=>r.arrayBuffer());return (await ctx.decodeAudioData(data)).duration;}finally{await ctx.close();}});
  check('语音可解码',decoded>1,decoded);
  await page.locator('#friend').click();await page.waitForFunction(()=>!voice.paused&&voice.currentTime>0);
  check('真实手势启动语音',await page.evaluate(()=>navigator.userActivation.hasBeenActive&&!voice.paused));
  check('无页面脚本异常',errors.length===0,errors);
  return {passed:results.length,results};
}
