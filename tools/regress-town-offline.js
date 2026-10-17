async page=>{
 const origin='http://127.0.0.1:8786';if(new URL(page.url()).origin!==origin)throw Error('local only');const results=[];const check=(name,ok,detail)=>{results.push({name,ok,detail});if(!ok)throw Error(JSON.stringify(results));};
 await page.goto(origin+'/');
 const version=await page.evaluate(async()=>{const r=await fetch('/service-worker.js',{cache:'no-store'});return (await r.text()).match(/const CACHE_VERSION = "([a-f0-9]+)"/)[1];});
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await page.waitForFunction(async v=>{const reg=await navigator.serviceWorker.getRegistration();return reg?.active===navigator.serviceWorker.controller&&(await(await caches.open('cookie-arcade-offline-'+v)).keys()).length===603;},version,{timeout:60000});
 const cache=await page.evaluate(async v=>{const c=await caches.open('cookie-arcade-offline-'+v);return{count:(await c.keys()).length,town:!!await c.match(new URL('games/town/index.html',location.href)),audio:!!await c.match(new URL('games/town/audio/intro.mp3',location.href))};},version);check('新版缓存包含游戏和语音',cache.town&&cache.audio,cache);
 await page.evaluate(()=>localStorage.setItem('cookie-town-v1',JSON.stringify({schema:1,columns:[[],[],[],[],[]]})));
 await page.context().setOffline(true);try{
 await page.goto(origin+'/games/town/');await page.waitForFunction(()=>typeof townDebug==='function');check('断网打开游戏',await page.locator('#car').count()===1);
 await page.locator('[data-kind="arch"]').tap();await page.locator('[data-column="4"]').tap({position:{x:10,y:10}});check('断网可搭建',await page.evaluate(()=>townDebug().columns[4].includes('arch')));
 await page.evaluate(()=>say('intro'));await page.waitForFunction(()=>voice.currentTime>.1&&!voice.paused);check('断网音频实际推进',true);
 const r=await page.evaluate(async()=>{const r=await fetch('audio/intro.mp3',{headers:{Range:'bytes=0-9'}});return {status:r.status,length:(await r.arrayBuffer()).byteLength};});check('离线音频范围请求',r.status===206&&r.length===10,r);
 await page.locator('#back').tap();await page.waitForURL(origin+'/');check('断网返回首页新入口',await page.locator('a[href="games/town/"]').count()===1);
 }finally{await page.context().setOffline(false);}return results;
}
