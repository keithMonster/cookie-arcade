async (page) => {
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok,detail)=>{results.push({name,ok,detail});if(!ok)throw Error(JSON.stringify(results));};
 const state=()=>page.evaluate(()=>({round,phase,selected,misses,fed,used,chewing,drag:!!drag}));
 const reset=()=>page.evaluate(()=>dealRound());
 const food=i=>page.locator(`[data-food="${i}"]`),guest=i=>page.locator(`[data-guest="${i}"]`);
 await page.reload();await page.waitForSelector('.food');
 const menus=await page.evaluate(()=>{round=0;const menus=[];for(let i=0;i<8;i++){dealRound();menus.push([...foods]);}round=0;dealRound();return menus;});
 check('grass and leaves every round; one carrot only every fourth round',menus.every((m,i)=>m.includes('hay')&&m.includes('leaf')&&m.filter(x=>x==='carrot').length===((i+1)%4===0?1:0)));
 check('grass remains the most common food',menus.flat().filter(x=>x==='hay').length>menus.flat().filter(x=>x==='leaf').length);

 for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768]]){
  await page.setViewportSize({width,height});
  if((await state()).fed.length!==3)await reset();
  const boxes=await page.locator('#back,.guest,.food').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
  check(`${width}x${height} visible 44px targets`,boxes.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1&&r.w>=44&&r.h>=44),boxes);
  check(`${width}x${height} unobstructed`,boxes.every(r=>r.hit),boxes);
  await page.screenshot({path:`/Users/xuke/githubProject/monster/output/cookie-arcade/picnic-finish-20261005/${width}x${height}.png`});
 }
 await page.setViewportSize({width:768,height:1024});
 await guest(0).click();check('empty hands cannot feed',!(await state()).fed.some(Boolean));
 await food(0).click();await guest(1).click();check('tap gives one serving',(await state()).fed[1]&&(await state()).used.filter(Boolean).length===1);
 await page.evaluate(()=>{select(1);completeStep(1,1);});check('busy rabbit preserves selected food',!(await state()).used[1]&&(await state()).selected===1);await page.evaluate(()=>select(null));
 check('feeding immediately starts chewing',await guest(1).evaluate(el=>el.classList.contains('eating')&&!!el.querySelector('.meal .snack')));
 await page.waitForFunction(()=>document.querySelector('[data-guest="1"] .meal').classList.contains('bite-two'));
 check('food visibly loses two bites',await guest(1).locator('.bite-two').count()===1);
 await page.waitForFunction(()=>document.querySelector('[data-guest="1"]').classList.contains('satisfied'));
 check('eaten guest keeps crumbs and no whole food',await guest(1).locator('.crumbs').count()===1&&await guest(1).locator('.snack').count()===0);
 await page.waitForFunction(()=>!document.querySelector('[data-guest="1"] .heart'));
 await guest(1).click();check('petting gives affection without another serving',await guest(1).locator('.heart').count()>0&&(await state()).used.filter(Boolean).length===1);
 for(let i=0;i<2;i++){await food(1).click();await guest(1).click();}
 check('occupied plate rejects and highlights empty places',(await state()).fed.filter(Boolean).length===1&&(await state()).misses===2&&await page.locator('.hint').count()===2);
 const from=await food(1).boundingBox(),to=await guest(0).boundingBox();
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});
 check('approaching hungry rabbit opens mouth before feeding',await guest(0).evaluate(el=>el.classList.contains('ready'))&&!(await state()).fed[0]);
 await page.mouse.up();check('drop clears anticipation',await page.locator('.ready').count()===0);
 check('native mouse drag feeds only target',(await state()).fed[0]&&(await state()).used[1]);
 await food(2).tap();await guest(2).tap();check('everyone served stays in play while food remains',(await state()).phase==='play');
 const picnicRound=(await state()).round;
 await page.waitForTimeout(5200);
 check('leftover remains playable beyond old auto-next deadline',(await state()).round===picnicRound&&(await state()).phase==='play'&&(await state()).used.filter(x=>!x).length===1);
 await food(3).tap();await guest(0).tap();
 check('last serving waits for chewing instead of celebrating',(await state()).used.every(Boolean)&&(await state()).phase==='play'&&(await state()).chewing[0]);
 await page.waitForFunction(()=>phase==='celebrate');
 check('celebration requires empty basket and all mouths finished',(await state()).used.every(Boolean)&&!(await state()).chewing.some(Boolean)&&await page.locator('.meal .snack').count()===0);
 await guest(0).click();check('petting works during celebration',await guest(0).locator('.heart').count()>0);
 const old=(await state()).round;await page.waitForFunction(r=>round>r,old);check('auto next round resets to two guests',(await state()).fed.length===2&&(await state()).misses===0&&(await state()).selected===null);
 await food(0).focus();await page.keyboard.press('Space');await guest(0).focus();await page.keyboard.press('Enter');check('keyboard feeds',(await state()).fed[0]);
 await reset();const b=await food(0).boundingBox();
 for(let i=0;i<2;i++){await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(20,200,{steps:5});await page.mouse.up();}
 check('off-target drops count misses without feeding',(await state()).misses===2&&!(await state()).fed.some(Boolean)&&(await state()).selected===null);
 await food(0).dispatchEvent('pointerdown',{pointerId:80,isPrimary:true,button:0,clientX:200,clientY:800});
 await food(0).dispatchEvent('pointermove',{pointerId:80,isPrimary:true,clientX:250,clientY:500});
 await food(0).dispatchEvent('pointerup',{pointerId:81,isPrimary:false,clientX:250,clientY:500});check('secondary finger cannot release drag',(await state()).drag);
 await page.evaluate(()=>ready(document.querySelector('[data-guest="0"]')));
 await food(0).dispatchEvent('pointercancel',{pointerId:80,isPrimary:true});check('cancel clears anticipation',await page.locator('.ready').count()===0);check('cancel clears ghost without miss',!(await state()).drag&&(await state()).misses===2&&await page.locator('#ghost').count()===0);
 await food(0).dispatchEvent('pointerdown',{pointerId:90,isPrimary:true,button:0,clientX:200,clientY:800});await reset();await guest(0).dispatchEvent('pointerup',{pointerId:90,isPrimary:true});check('stale release cannot feed new round',!(await state()).fed.some(Boolean));
 await page.evaluate(()=>{window.savedPlay=voice.play;voice.play=()=>Promise.reject(Error('blocked'));});
 for(let i=0;i<(await state()).fed.length;i++){await food(i).click();await guest(i).click();}
 check('blocked audio does not block chewing',await page.locator('.eating').count()>0);
 await page.waitForFunction(()=>!chewing.some(Boolean));const extra=(await state()).used.findIndex(x=>!x);await food(extra).click();await guest(0).click();await page.waitForFunction(()=>phase==='celebrate');
 check('blocked audio does not block completion',(await state()).phase==='celebrate');const done=(await state()).round;await page.waitForFunction(r=>round>r,done);check('blocked audio does not block next round',(await state()).phase==='play');await page.evaluate(()=>voice.play=window.savedPlay);
 await page.evaluate(()=>{phase='celebrate';window.dispatchEvent(new PageTransitionEvent('pagehide'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});check('bfcache restore resets playable round',(await state()).phase==='play'&&!(await state()).fed.some(Boolean));
 await food(0).click();await guest(0).click();await reset();
 await page.waitForTimeout(1700);
 check('old bite callbacks cannot mutate new guests',await page.locator('.satisfied,.eating,.heart,.crumbs').count()===0);
 for(const kind of ['hay','leaf','carrot']){
  await page.evaluate(()=>{round=3;dealRound();});
  const id=await page.evaluate(k=>foods.indexOf(k),kind);
  const b=await food(id).boundingBox(),g=await guest(0).boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(g.x+g.width/2,g.y+g.height/2,{steps:5});
  check(`${kind} drag keeps correct appearance`,await page.locator(`#ghost .snack.${kind}`).count()===1);
  await page.mouse.up();
  check(`${kind} served keeps correct appearance`,await guest(0).locator(`.meal.${kind} .snack.${kind}`).count()===1);
  await page.waitForFunction(()=>document.querySelector('.bite-two'));
  await page.screenshot({path:`/Users/xuke/githubProject/monster/output/cookie-arcade/picnic-finish-20261005/eating-${kind}.png`});
  await page.waitForFunction(()=>document.querySelector('.satisfied'));
  check(`${kind} can finish eating`,(await state()).fed[0]&&await guest(0).locator('.snack').count()===0);
 }
 await reset();
 await page.evaluate(()=>{round=3;dealRound();completeStep(2,0);completeStep(1,1);});
 await page.waitForFunction(()=>!chewing.some(Boolean));
 await page.evaluate(()=>completeStep(0,0));
 check('second serving resets prior bite and food classes',await guest(0).evaluate(el=>el.classList.contains('eating')&&!el.classList.contains('satisfied')&&el.querySelector('.meal').className==='meal hay'));
 await page.waitForFunction(()=>phase==='celebrate');
 check('different food refeeding finishes normally',(await state()).used.every(Boolean));await reset();
 for(const file of ['intro','place','choose','already','thanks','done','chewing']){const r=await page.request.get(new URL(`audio/${file}.mp3`,page.url()).href);check(`audio ${file}`,r.status()===200&&(await r.body()).length>1024);}
 await guest(0).click();await page.waitForFunction(()=>!voice.paused&&voice.currentTime>0);check('user gesture starts voice',await page.evaluate(()=>!voice.paused));await page.waitForFunction(()=>voice.ended,{},{timeout:7000});check('voice reaches ended',await page.evaluate(()=>voice.ended));
 check('no page errors',errors.length===0,errors);
 return {passed:results.length,results};
}
