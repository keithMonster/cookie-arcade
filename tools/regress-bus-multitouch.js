// Playwright CLI run-code：隔离浏览器、同站静态页面的真实多触点回归。
async (page) => {
  const results=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const check=async(name,fn)=>{const ok=await fn();results.push({name,ok});if(!ok)throw Error(JSON.stringify({results,state:await page.evaluate(()=>({round,phase,doors,ps:[...pointers.values()].map(p=>({id:p.id,el:p.el.id,ghost:!!p.ghost})),ghosts:document.querySelectorAll('.drag-ghost').length}))}));};
  const settle=()=>page.waitForFunction(()=>phase==='idle');
  const center=selector=>page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  const cdp=await page.context().newCDPSession(page);
  let fingers=[];
  const send=async(type)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:fingers});await page.waitForTimeout(50);};
  const down=async(id,selector)=>{fingers.push({...await center(selector),id});await send('touchStart');};
  const move=async(id,selector)=>{Object.assign(fingers.find(p=>p.id===id),await center(selector));await send('touchMove');await page.waitForFunction(({x,y})=>[...pointers.values()].some(p=>p.ghost&&Math.abs(p.lastX-x)<2&&Math.abs(p.lastY-y)<2),fingers.find(p=>p.id===id));};
  const up=async id=>{const ended=fingers.filter(p=>p.id===id);fingers=fingers.filter(p=>p.id!==id);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:ended});await page.waitForTimeout(50);};
  const tap=async(id,selector)=>{await down(id,selector);await up(id);};
  const clean=()=>page.evaluate(()=>pointers.size===0&&!document.querySelector('.drag-ghost,.drag-source,.drop-ready'));
  const correct=async()=>`[data-person="${await page.evaluate(()=>leaving)}"]`;
  await page.setViewportSize({width:768,height:1024});
  await page.reload();await settle();
  await down(11,await correct());await move(11,'#platform');
  await tap(22,'#door-button');
  await check('另一指开门且主指拖动保留',()=>page.evaluate(()=>doors&&pointers.size===1&&!!pending.ghost));
  await settle();await tap(22,'#station');
  await check('另一指点站牌不丢主指',()=>page.evaluate(()=>pointers.size===1&&voice.src.endsWith(`/stop_${stops[stop]}.mp3`)));
  await up(11);await settle();
  await check('门改变后原拖动可下车',()=>page.evaluate(()=>unloaded));
  await down(31,'#waiting');await move(31,'#door');await tap(32,'#door-button');
  await up(31);await settle();await page.waitForTimeout(200);
  await check('关门动画中释放返回原处且不丢乘客',async()=>await page.evaluate(()=>!boarded&&!doors)&&await clean());
  await tap(33,'#door-button');await settle();
  await down(34,'#waiting');await move(34,'#door');await up(34);await settle();
  await tap(35,'#door-button');await settle();
  // 留在车上的乘客拿在手里时，即使接送已完成也不能出发。
  const remaining=`[data-person="${await page.evaluate(()=>1-leaving)}"]`;
  await down(41,remaining);await move(41,'#platform');await tap(42,'#go');
  await check('手中仍有乘客时不能开走',()=>page.evaluate(()=>round===1&&phase==='idle'&&pointers.size===1));
  await up(41);await settle();
  const before=await page.evaluate(()=>JSON.stringify(passengers));await tap(43,'#go');
  await page.waitForFunction(()=>round===2&&phase==='idle');
  await check('完成一站仍保持乘客身份',()=>page.evaluate(old=>JSON.stringify(passengers)===old,before));
  await tap(44,'#door-button');await settle();
  // 两名不同乘客同时持有，先上车释放不能越过下车条件。
  await down(51,await correct());await move(51,'#platform');await down(52,'#waiting');await move(52,'#door');
  await check('两名乘客独立持有两个拖影',()=>page.evaluate(()=>pointers.size===2&&document.querySelectorAll('.drag-ghost').length===2));
  await up(52);
  await check('副指提前上车被拒且主指保留',()=>page.evaluate(()=>!boarded&&!unloaded&&pointers.size===1&&document.querySelectorAll('.drag-ghost').length===1));
  await up(51);await settle();await page.waitForTimeout(200);
  await down(61,'#waiting');await move(61,'#door');await up(61);await settle();
  await tap(62,'#door-button');await settle();await tap(63,'#go');await page.waitForFunction(()=>round===3&&phase==='idle');
  // 反向释放：下车完成动画期间手持等待者，动画结束后可上车。
  await tap(64,'#door-button');await settle();
  await down(71,await correct());await move(71,'#platform');await down(72,'#waiting');await move(72,'#door');await up(71);await settle();
  await check('下车状态改变不撤销手持等待者',()=>page.evaluate(()=>unloaded&&!boarded&&pointers.size===1&&!!pending.ghost));
  await up(72);await settle();await tap(73,'#door-button');await settle();await tap(74,'#go');await page.waitForFunction(()=>round===4&&phase==='idle');
  await check('完整三站往返且每站恰有一个到站者',()=>page.evaluate(()=>stop===0&&passengers.filter(p=>p.dest===stop).length===1));
  // 同物件两指争抢时，第一指保有所有权。
  await down(81,await correct());await move(81,'#platform');await down(82,await correct());await up(82);
  await check('同一乘客不能由第二指抢走',()=>page.evaluate(()=>pointers.size===1&&!!pending.ghost));
  await tap(83,'#door-button');await settle();
  await down(84,'#waiting');await move(84,'#door');
  await page.evaluate(()=>{const p=[...pointers.values()].find(p=>p.el.id==='waiting');p.el.dispatchEvent(new PointerEvent('pointercancel',{pointerId:p.id}));});
  await up(84);
  await check('副指取消仅清自己',()=>page.evaluate(()=>pointers.size===1&&pending.el.classList.contains('rider')));
  await up(81);await settle();
  for(const event of ['blur','pagehide']){
    await down(91,'#waiting');await move(91,'#door');await page.evaluate(event=>window.dispatchEvent(new Event(event)),event);await up(91);
    await check(`${event} 全部清理`,clean);
  }
  await page.locator('#waiting').click();await settle();await page.locator('#door-button').focus();await page.keyboard.press('Space');await settle();
  await check('鼠标点击与键盘空格均只执行一次',()=>page.evaluate(()=>boarded&&!doors));
  await page.locator('#go').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>round===5&&phase==='idle');
  await check('键盘回车只前进一站',()=>page.evaluate(()=>round===5&&!doors));
  await check('无页面错误及残留拖动',async()=>errors.length===0&&await clean());
  await cdp.detach();return {passed:results.length,results};
}
