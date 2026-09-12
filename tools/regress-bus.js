// Playwright CLI run-code：在 games/bus/ 页面执行；只访问同站静态资源。
async (page) => {
  const results=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const check=(name,ok,detail)=>{results.push({name,ok,detail});if(!ok)throw Error(JSON.stringify(results));};
  const state=()=>page.evaluate(()=>({round,stop,leaving,doors,unloaded,boarded,phase,misses,passengers,waitingPerson}));
  const settle=()=>page.waitForFunction(()=>phase==='idle');
  const click=async selector=>{await page.locator(selector).click();await settle();};
  await page.reload();await settle();
  for(const [width,height] of [[390,844],[320,568],[844,390],[768,1024],[1024,768]]){
    await page.setViewportSize({width,height});
    const boxes=await page.locator('#station,.rider,#waiting,.control,#back').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {id:el.id||el.dataset.person,x:r.x,y:r.y,w:r.width,h:r.height};}));
    check(`${width}×${height} 目标可见且至少44px`,boxes.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1&&r.w>=44&&r.h>=44),boxes);
    check(`${width}×${height} 目标无互相遮挡`,await page.locator('#station,.rider,#waiting,.control,#back').evaluateAll(els=>els.every(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})));
  }
  await page.setViewportSize({width:768,height:1024});
  let s=await state(),correct=`[data-person="${s.leaving}"]`,wrong=`[data-person="${1-s.leaving}"]`;
  await click(correct);await click(correct);
  check('闭门不能下车、两错提示开门',await page.evaluate(()=>!unloaded&&!doors&&document.querySelector('#door-button').classList.contains('hint')));
  await click('#go');check('未完成接送不能出发',(await state()).round===1);
  await click('#door-button');await click('#waiting');await click('#waiting');
  check('先下后上、提示不代做',await page.evaluate(()=>!unloaded&&!boarded&&riders[leaving].classList.contains('hint')));
  await click(wrong);await click(wrong);check('目的地不符的乘客留在车内',!(await state()).unloaded);
  await page.locator(`${correct} .ticket`).click({position:{x:22,y:8}});await settle();check('点目的地图上半部也能让到站乘客下车',(await state()).unloaded);
  await click('#go');check('不能丢下等车乘客',(await state()).phase==='idle'&&!(await state()).boarded);
  await click('#waiting');await click('#go');check('开门时不能出发',(await state()).doors&&(await state()).round===1);
  const before=await state();await click('#door-button');await page.locator('#go').click();
  await page.locator('#door-button').dispatchEvent('pointerdown',{pointerId:73,isPrimary:true,button:0,clientX:100,clientY:100});
  await page.waitForFunction(old=>round>old&&phase==='idle',before.round);
  await page.locator('#door-button').dispatchEvent('pointerup',{pointerId:73,isPrimary:true,button:0,clientX:100,clientY:100});
  s=await state();
  check('自然换站、在行驶中开始的按压不延迟兑现',s.stop===1&&!s.doors&&!s.unloaded&&!s.boarded);
  check('继续乘车的朋友跨站保持身份与目的地',JSON.stringify(s.passengers)===JSON.stringify(before.passengers));
  check('每站恰好一位到站、一位继续乘车',s.passengers.filter(p=>p.dest===s.stop).length===1);
  // 取消事件只能撤销，不能变成点击。
  const doorBox=await page.locator('#door-button').boundingBox();
  await page.mouse.move(doorBox.x+doorBox.width/2,doorBox.y+doorBox.height/2);await page.mouse.down();
  await page.locator('#door-button').dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});
  await page.mouse.up();
  check('pointercancel 不开门',!(await state()).doors);
  await page.locator('#door-button').tap();await settle();check('触摸开门',(await state()).doors);
  await page.locator(`[data-person="${(await state()).leaving}"]`).tap();await settle();
  await page.locator('#waiting').tap();await settle();check('触摸完成先下后上',(await state()).unloaded&&(await state()).boarded);
  await page.locator('#door-button').focus();await page.keyboard.press('Space');await settle();check('键盘空格关门',!(await state()).doors);
  await page.locator('#go').focus();const previous=(await state()).round;await page.keyboard.press('Enter');
  await page.waitForFunction(old=>round>old&&phase==='idle',previous);check('键盘回车出发到下一站',(await state()).stop===2);
  // 媒体拒绝不会阻塞状态机；恢复原方法后继续正常资源检查。
  await page.evaluate(()=>{window.originalPlay=voice.play;voice.play=()=>Promise.reject(new Error('test blocked playback'));});
  await click('#door-button');await click(`[data-person="${(await state()).leaving}"]`);await click('#waiting');await click('#door-button');
  const silentRound=(await state()).round;await page.locator('#go').click();await page.waitForFunction(old=>round>old&&phase==='idle',silentRound);
  check('语音播放被拒绝仍完成一整站',(await state()).stop===0);
  await page.evaluate(()=>{voice.play=window.originalPlay;lastInput=Date.now()-12000;});await page.waitForTimeout(1300);
  check('空闲提示不操作车门和乘客',await page.evaluate(()=>!doors&&!unloaded&&!boarded&&document.querySelectorAll('.hint').length===1));
  const files=['stop_park','stop_beach','stop_home','open','close','open_first','close_first','leave_first','board_first','not_yet','bye','aboard','go','look','ready'];
  for(const name of files){const r=await page.request.get(`${page.url().split('?')[0]}audio/${name}.mp3`);check(`语音 ${name} 可取且非空`,r.status()===200&&(await r.body()).length>1024);}
  check('无页面脚本异常',errors.length===0,errors);
  return {passed:results.length,results};
}
