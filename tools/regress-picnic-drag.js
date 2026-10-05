// 拖起时只有跟手的一份，取消/偏离归还、喂食后消耗。
async page=>{
 const results=[];const check=(name,ok)=>{results.push({name,ok});if(!ok)throw Error(JSON.stringify(results));};
 await page.goto(new URL('../picnic/',page.url()).href);
 await page.setViewportSize({width:390,height:844});
 const visible=()=>page.evaluate(()=>getComputedStyle(document.querySelector('[data-food="0"] .snack')).opacity==='1');
 const lift=async()=>{const b=await page.locator('[data-food="0"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y-60,{steps:5});};
 await lift();
 check('drag hides basket source and shows exactly one carried food',!await visible()&&await page.locator('#ghost .snack').count()===1);
 check('lifting does not consume food',await page.evaluate(()=>!used[0]));
 await page.screenshot({path:'/Users/xuke/githubProject/monster/output/cookie-arcade/audio-sync-20261005/picnic-drag-only-one.png'});
 await page.mouse.move(10,100);await page.mouse.up();
 check('off-target returns the same food',await visible()&&await page.evaluate(()=>!used[0]&&!drag)&&await page.locator('#ghost,.dragging').count()===0);
 await lift();await page.evaluate(()=>document.querySelector('[data-food="0"]').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:drag.id})));await page.mouse.up();
 check('pointercancel restores food without consumption',await visible()&&await page.evaluate(()=>!used[0]&&!drag)&&await page.locator('#ghost,.dragging').count()===0);
 await lift();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();
 check('blur restores food',await visible()&&await page.locator('#ghost,.dragging').count()===0);
 await lift();const guest=await page.locator('[data-guest="0"]').boundingBox();await page.mouse.move(guest.x+guest.width/2,guest.y+guest.height/2,{steps:8});await page.mouse.up();
 check('successful drop consumes source and gives rabbit one serving',await page.evaluate(()=>used[0]&&fed[0]&&!drag&&getComputedStyle(document.querySelector('[data-food="0"]')).visibility==='hidden')&&await page.locator('[data-guest="0"] .meal .snack').count()===1&&await page.locator('#ghost,.dragging').count()===0);
 await page.evaluate(()=>dealRound());await lift();await page.evaluate(()=>dealRound());await page.mouse.up();
 check('new round clears source hiding and stale ghost',await visible()&&await page.locator('#ghost,.dragging').count()===0&&await page.evaluate(()=>!used.some(Boolean)));
 await page.locator('[data-food="0"]').tap();check('tap selection keeps food visible',await visible()&&await page.evaluate(()=>selected===0));
 return {passed:results.length,results};
}
