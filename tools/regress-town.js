// Playwright CLI run-code；隔离本地页面，不调用生产或付费API。
async page => {
 const origin='http://127.0.0.1:8786';if(new URL(page.url()).origin!==origin)throw Error('local only');
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw Error(JSON.stringify(results));};
 const state=()=>page.evaluate(()=>townDebug());
 const reset=async cols=>{await page.evaluate(c=>localStorage.setItem('cookie-town-v1',JSON.stringify({schema:1,columns:c})),cols||[[],[],[],[],[]]);await page.reload();};
 const center=async selector=>page.locator(selector).first().evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 const touch=await page.context().newCDPSession(page);
 const send=(type,points)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 const drag=async(a,b)=>{const p=await center(a),q=await center(b);await send('touchStart',[{...p,id:1}]);await send('touchMove',[{...q,id:1}]);await send('touchEnd',[]);};
 const place=async(kind,col)=>{await page.locator(`[data-kind="${kind}"]`).tap();await page.locator(`[data-column="${col}"]`).tap({position:{x:10,y:10}});};
 await page.setViewportSize({width:390,height:844});await page.reload();await reset();check('空白无文字UI',!(await page.locator('#scene').innerText()).trim());
 await place('arch',0);await place('block',0);await place('roof',0);check('点选可搭三层',(await state()).columns[0].join()==='arch,block,roof');
 await place('block',0);await place('block',0);check('满列不覆盖',(await state()).columns[0].length===3);check('错误提示不代搭',(await state()).columns.flat().length===3);
 await drag('[data-piece="roof"]','#basket');check('拖动回收顶块',(await state()).columns[0].join()==='arch,block');
 await drag('[data-piece="block"]','[data-column="1"]');check('拖动改建',(await state()).columns[0].join()==='arch'&&(await state()).columns[1].join()==='block');
 await page.reload();check('刷新保留作品',(await state()).columns[1].join()==='block');
 await reset([['block'],[],[],[],[]]);await page.locator('#car').tap();check('实心底块挡车',(await state()).carPhase==='blocked');
 await drag('[data-piece="block"]','#basket');await place('arch',0);await page.locator('#car').tap();await page.waitForFunction(()=>townDebug().carPhase==='arrived');check('改成拱门可通行',(await state()).columns[0][0]==='arch');
 await page.waitForFunction(()=>townDebug().carPhase==='idle');check('到达后作品仍在',(await state()).columns[0][0]==='arch');
 await reset();await drag('[data-kind="block"]','[data-column="2"]');check('从材料拖出',(await state()).columns[2][0]==='block');
 let p=await center('[data-piece="block"]'),q=await center('[data-column="3"]');await send('touchStart',[{...p,id:1}]);await send('touchMove',[{...q,id:1}]);await send('touchCancel',[]);check('取消不改作品不留指针',(await state()).columns[2][0]==='block'&&(await state()).held===0);
 for(const order of [[1,2],[2,1]]){
  await reset();p=await center('[data-kind="arch"]');q=await center('[data-kind="block"]');const a=await center('[data-column="0"]'),b=await center('[data-column="1"]');
  await send('touchStart',[{...p,id:1}]);await send('touchStart',[{...p,id:1},{...q,id:2}]);await send('touchMove',[{...a,id:1},{...b,id:2}]);check('双指各持材料 '+order,(await state()).held===2);
  const ends={1:a,2:b};for(const id of order)await send('touchEnd',[{...ends[id],id}]);check('双指释放 '+order,(await state()).columns[0][0]==='arch'&&(await state()).columns[1][0]==='block'&&(await state()).held===0);
 }
 await reset([['arch'],[],[],[],[]]);p=await center('[data-piece="arch"]');q=await center('[data-kind="block"]');const dest=await center('[data-column="0"]'),away=await center('[data-column="2"]');
 await send('touchStart',[{...p,id:1}]);await send('touchMove',[{...away,id:1}]);await send('touchStart',[{...away,id:1},{...q,id:2}]);await send('touchMove',[{...away,id:1},{...dest,id:2}]);await send('touchEnd',[{...dest,id:2}]);check('持有源列禁止第二指叠加',(await state()).columns[0].join()==='arch');await send('touchEnd',[]);check('源列释放后搬移完整',(await state()).columns[2][0]==='arch'&&(await state()).columns[0].length===0);
 await reset();p=await center('[data-kind="roof"]');q=await center('#sun');await send('touchStart',[{...p,id:1}]);await send('touchMove',[{x:p.x,y:p.y-40,id:1}]);await send('touchStart',[{x:p.x,y:p.y-40,id:1},{...q,id:2}]);await send('touchEnd',[{...q,id:2}]);check('持物第二指太阳反馈',(await state()).held===1&&await page.locator('#sun').evaluate(e=>e.classList.contains('pop')));await send('touchCancel',[]);
 await page.evaluate(()=>localStorage.setItem('cookie-town-v1','{"schema":1,"columns":[["roof","block"],[],[],[],[]]}'));await page.reload();check('坏存档安全回空',(await state()).columns.flat().length===0);
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('denied');};});await place('arch',1);check('存储拒绝仍可玩',(await state()).columns[1][0]==='arch');
 await page.reload();await reset([['arch','block','roof'],['arch'],[],['arch','roof'],[]]);
 for(const [w,h] of [[390,844],[844,390],[768,1024],[1024,768]]){await page.setViewportSize({width:w,height:h});check('布局不溢出 '+w+'x'+h,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('.material,#basket,#back')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&r.width>=44&&r.height>=44;})));await page.screenshot({path:`/Users/xuke/githubProject/cookie-arcade/output/town-20261018/${w}x${h}.png`});}
 check('无运行异常',errors.length===0,errors);return results;
}
