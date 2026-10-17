// 几何比例与视觉快照，与功能断言独立；截图前等布局及停车位置稳定。
async page=>{
 const root='http://127.0.0.1:8786/';if(new URL(page.url()).origin!==new URL(root).origin)throw Error('local only');
 await page.evaluate(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();});await page.goto('about:blank');await page.goto(root+'games/town/');
 await page.evaluate(()=>localStorage.setItem('cookie-town-v1',JSON.stringify({schema:1,columns:[['arch','block','roof'],['arch'],[],['arch','roof'],[]]})));await page.reload();
 const engine=await page.evaluate(()=>/Chrome\//.test(navigator.userAgent)?'chromium':'webkit');
 const out='/Users/xuke/githubProject/cookie-arcade/output/town-proportions-20261018',results=[];
 const check=(name,ok,detail)=>{results.push({name,ok,detail});};
 for(const [w,h] of [[320,568],[568,320],[375,667],[667,375],[390,844],[844,390],[768,1024],[1024,768],[1024,1366],[1366,1024]]){
 await page.setViewportSize({width:w,height:h});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const d=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return{pieces:[...document.querySelectorAll('[data-piece]')].map(e=>({...rect(e),hit:e.contains(document.elementFromPoint(e.getBoundingClientRect().x+e.clientWidth/2,e.getBoundingClientRect().y+e.clientHeight/2))})),materials:[...document.querySelectorAll('.material')].map(rect),car:rect(document.querySelector('.car-art')),scene:rect(document.querySelector('#scene'))};});
 check('积木与材料固定正方形 '+w+'x'+h,[...d.pieces,...d.materials].every(r=>Math.abs(r.w-r.h)<.2),d);
 check('小车固定比例 '+w+'x'+h,Math.abs(d.car.h/d.car.w-.65)<.01,d.car);
 check('完整可见且每块可触及 '+w+'x'+h,d.pieces.every(r=>r.w>=44&&r.h>=44&&r.hit&&r.x>=d.scene.x&&r.right<=d.scene.right+.5&&r.y>=d.scene.y&&r.bottom<=d.scene.bottom+.5));
 await page.screenshot({path:out+`/final-${engine}-${w}x${h}.png`});
 }
 const a=await page.locator('[data-kind="block"]').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2,a.y-40,{steps:5});check('拖动影像也保持正方形',await page.locator('.ghost').evaluate(e=>Math.abs(parseFloat(e.style.width)-parseFloat(e.style.height))<.1));await page.mouse.up();
 return{passed:results.filter(r=>r.ok).length,total:results.length,results};
}
