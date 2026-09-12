// Playwright CLI run-code：只操作本地/同站公交游戏，无外部写入。
async (page) => {
  const results=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const check=(name,ok)=>{results.push({name,ok});if(!ok)throw Error(JSON.stringify(results));};
  const settle=()=>page.waitForFunction(()=>phase==='idle');
  const center=async selector=>page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  const start=async selector=>{const p=await center(selector);await page.mouse.move(p.x,p.y);await page.mouse.down();return p;};
  const drag=async (selector,target)=>{const from=await start(selector),to=typeof target==='string'?await center(target):target;await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up();await settle();return from;};
  const clean=()=>page.evaluate(()=>!pending&&!document.querySelector('.drag-ghost,.drag-source,.drop-ready'));
  for(const [width,height] of [[390,844],[320,568],[844,390],[768,1024],[1024,768]]){
    await page.setViewportSize({width,height});await page.reload();await settle();
    const correct=`[data-person="${await page.evaluate(()=>leaving)}"]`,wrong=`[data-person="${await page.evaluate(()=>1-leaving)}"]`;
    await drag(correct,'#platform');check(`${width} 闭门拖动不能下车`,await page.evaluate(()=>!unloaded));
    await page.locator('#door-button').click();await settle();
    await drag('#waiting','#door');check(`${width} 拖动不能抢先上车`,await page.evaluate(()=>!boarded&&!unloaded));
    await drag(wrong,'#platform');check(`${width} 拖错乘客不能下车`,await page.evaluate(()=>!unloaded));
    await drag(correct,{x:width/2,y:70});await page.waitForTimeout(220);
    check(`${width} 拖偏回原位且不代做`,await page.evaluate(()=>!unloaded)&&await clean());
    const origin=await start(correct),target=await center('#platform');await page.mouse.move(target.x,target.y,{steps:12});
    check(`${width} 拖起跟手且站台亮起`,await page.evaluate(()=>!!document.querySelector('.drag-ghost')&&document.querySelector('#platform').classList.contains('drop-over')));
    await page.mouse.move(origin.x,origin.y,{steps:12});await page.mouse.up();await page.waitForTimeout(220);
    check(`${width} 拖回原位松手不会变成点击`,await page.evaluate(()=>!unloaded)&&await clean());
    await drag(correct,'#platform');check(`${width} 鼠标拖下车`,await page.evaluate(()=>unloaded));
    const waitingBox=await page.locator('#waiting').boundingBox(),home={x:waitingBox.x+10,y:waitingBox.y+10};
    await page.mouse.move(home.x,home.y);await page.mouse.down();await page.mouse.move(home.x-70,home.y-70,{steps:6});await page.mouse.move(home.x,home.y,{steps:6});await page.mouse.up();await page.waitForTimeout(220);
    check(`${width} 等车乘客拖回原位不会因热区重叠而上车`,await page.evaluate(()=>!boarded)&&await clean());
    await drag('#waiting','#door');check(`${width} 鼠标拖上车`,await page.evaluate(()=>boarded)&&await clean());
    await page.locator('#door-button').click();await settle();await page.locator('#go').click();
    await page.waitForFunction(()=>round===2&&phase==='idle');check(`${width} 拖放接送后自然换站`,await page.evaluate(()=>passengers.filter(p=>p.dest===stop).length===1));
  }
  await page.setViewportSize({width:768,height:1024});await page.reload();await settle();
  await page.locator('#door-button').click();await settle();
  let correct=`[data-person="${await page.evaluate(()=>leaving)}"]`;
  for(const cancel of ['pointercancel','lostpointercapture','blur','resize','visibilitychange']){
    await start(correct);const target=await center('#platform');await page.mouse.move(target.x,target.y,{steps:12});
    await page.evaluate(event=>{if(event==='pointercancel'||event==='lostpointercapture')pending.el.dispatchEvent(new PointerEvent(event,{pointerId:pending.id}));else (event==='visibilitychange'?document:window).dispatchEvent(new Event(event));},cancel);
    await page.mouse.up();check(`${cancel} 撤销拖动并清理视觉`,await page.evaluate(()=>!unloaded)&&await clean());
  }
  await start(correct);let target=await center('#platform');await page.mouse.move(target.x,target.y,{steps:12});
  await page.evaluate(()=>{const el=document.querySelector('#waiting');el.dispatchEvent(new PointerEvent('pointerdown',{pointerId:92,isPrimary:false,button:0}));el.dispatchEvent(new PointerEvent('pointercancel',{pointerId:92}));});
  check('第二根手指取消不清掉第一根拖动',await page.evaluate(()=>!!pending?.ghost));
  await page.mouse.up();await settle();check('第一根手指仍能正常完成',await page.evaluate(()=>unloaded));
  await page.reload();await settle();await page.locator('#door-button').tap();await settle();
  const cdp=await page.context().newCDPSession(page);
  for(const [selector,destination] of [[`[data-person="${await page.evaluate(()=>leaving)}"]`,'#platform'],['#waiting','#door']]){
    const a=await center(selector),b=await center(destination);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:11}]});
    for(let n=1;n<=8;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*n/8,y:a.y+(b.y-a.y)*n/8,id:11}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
  }
  await cdp.detach();check('真实触摸事件拖放完成先下后上',await page.evaluate(()=>unloaded&&boarded)&&await clean());
  check('无脚本异常',errors.length===0);
  return {passed:results.length,results};
}
