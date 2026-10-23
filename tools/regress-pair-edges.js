async page=>{
 const origin='http://127.0.0.1:18973';if(new URL(page.url()).origin!==origin)throw Error('local only');
 const results=[],check=(name,ok)=>{results.push({name,ok:!!ok});if(!ok)throw Error(JSON.stringify(results));};
 const tap=async s=>{const p=await page.locator(s).evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!el.contains(document.elementFromPoint(x,y)))throw Error('blocked hit '+el.id);return{x,y};});await page.touchscreen.tap(p.x,p.y);};
 const pointer=async(type,id,sel)=>page.evaluate(({type,id,sel})=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2}));},{type,id,sel});
 await page.goto(origin+'/games/hidecar/');await page.waitForFunction(()=>hidecarDebug().phase==='searching');let h=await page.evaluate(()=>hidecarDebug());await tap('[data-door="'+((h.target+1)%3)+'"]');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));h=await page.evaluate(()=>hidecarDebug());check('空门计时被中断仍恢复全关',h.doors.every(d=>!d.open));
 await page.goto(origin+'/games/market/');const m=()=>page.evaluate(()=>marketDebug());
 const give=async()=>{await tap('#basket-handle');await tap('#customer');};const add=async()=>{await tap('[data-fruit="apple"]');await tap('#basket');};
 await give();await add();await pointer('pointerdown',81,'[data-fruit="pear"]');await pointer('pointermove',81,'#cloud');await give();check('一指持货架不阻止已装正确篮交付',(await m()).celebrating);await pointer('pointerup',81,'#cloud');await page.waitForFunction(()=>!marketDebug().celebrating);check('庆祝乱拖不会污染新轮提示',await page.locator('.hint').count()===0&&(await m()).misses===0);
 for(const order of [[51,52],[52,51]]){
  await page.reload();await pointer('pointerdown',51,'#basket-handle');await pointer('pointermove',51,'#customer');await pointer('pointerdown',52,'[data-fruit="apple"]');await pointer('pointermove',52,'#basket');
  for(const id of order)await pointer('pointerup',id,id===51?'#customer':'#basket');
  const s=await m();check('持篮与装果按实时状态 '+order,order[0]===52?s.celebrating:!s.celebrating&&s.state.basket.length===1);
 }
 await page.reload();await pointer('pointerdown',61,'[data-fruit="apple"]');await pointer('pointermove',61,'#basket');await pointer('pointerdown',62,'[data-fruit="pear"]');await pointer('pointermove',62,'#basket');await pointer('pointercancel',61,'#basket');check('单指取消保留另一指',(await m()).held.length===1);await pointer('pointerup',62,'#basket');check('剩余手指可提交',(await m()).state.basket[0]?.fruit==='pear');
 await page.reload();await add();const id=(await m()).state.basket[0].id;await pointer('pointerdown',71,'[data-id="'+id+'"]');await pointer('pointermove',71,'[data-fruit="apple"]');await give();check('持篮中水果时不交付',!(await m()).celebrating);await pointer('pointercancel',71,'[data-fruit="apple"]');
 for(const [width,height]of [[320,568],[667,375],[768,1024]]){await page.setViewportSize({width,height});await page.waitForTimeout(800);const r=await page.locator('#basket-handle').boundingBox();check('把手44px且可命中 '+width,r.width>=44&&r.height>=44&&await page.locator('#basket-handle').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));await tap('#basket-handle');check('把手点选整篮 '+width,(await m()).selected?.type==='basket');await tap('#basket-handle');}
 return results;
}
