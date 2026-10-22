// 隔离浏览器完整安装后断网冷开；版本和资源数从真实生成清单读取。
async page=>{
 const origin='http://127.0.0.1:8791';if(new URL(page.url()).origin!==origin)throw Error('local only');
 const results=[];const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw Error(JSON.stringify(results));};
 await page.goto(origin+'/');
 const manifest=await page.evaluate(async()=>{const text=await(await fetch('service-worker.js',{cache:'no-store'})).text();return{version:text.match(/const CACHE_VERSION = "([a-f0-9]+)"/)[1],paths:JSON.parse(text.match(/const PRECACHE_PATHS = (\[[\s\S]*?\]);/)[1])};});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
 await page.waitForFunction(async m=>{const reg=await navigator.serviceWorker.getRegistration();return reg?.active===navigator.serviceWorker.controller&&(await(await caches.open('cookie-arcade-offline-'+m.version)).keys()).length===m.paths.length;},manifest,{timeout:90000});
 check('完整新版缓存安装',true,manifest.version+' / '+manifest.paths.length);
 await page.evaluate(()=>localStorage.setItem('cookie-garden-v1',JSON.stringify({schema:1,beds:[null,null,null],basket:[],table:[]})));
 const context=page.context();await context.setOffline(true);
 const cold=await context.newPage();try{
  await cold.goto(origin+'/games/garden/');await cold.waitForFunction(()=>typeof gardenDebug==='function');
  check('断网新页面冷开',await cold.locator('[data-seed]').count()===3);
  const tap=s=>cold.locator(s).tap();await tap('[data-seed="strawberry"]');await tap('[data-bed="0"]');
  for(let i=0;i<2;i++){await tap('#water');await tap('[data-bed="0"]');}
  await tap('[data-bed="0"]');await tap('#basket');await tap('#basket');
  check('断网完整种植配送',await cold.evaluate(()=>gardenDebug().state.table[0]?.kind==='strawberry'));
  await cold.reload();check('断网刷新保留',await cold.evaluate(()=>gardenDebug().state.table[0]?.kind==='strawberry'));
  await tap('#friend');await cold.waitForFunction(()=>gardenDebug().voice.time>.1&&!gardenDebug().voice.paused,{},{timeout:10000});check('离线本地语音实际推进',true);
  const range=await cold.evaluate(async()=>{const r=await fetch('audio/intro.mp3',{headers:{Range:'bytes=0-9'}});return{status:r.status,length:(await r.arrayBuffer()).byteLength};});
  check('离线音频Range',range.status===206&&range.length===10,range);
  await tap('#back');await cold.waitForURL(origin+'/');check('断网返回首页36款新入口',await cold.locator('a.tile').count()===36&&await cold.locator('a.tile').first().getAttribute('href')==='games/garden/');
  await cold.locator('a[href="games/town/"]').tap();await cold.waitForFunction(()=>typeof townDebug==='function');check('旧游戏town离线仍打开',await cold.locator('#car').count()===1);
  await cold.locator('#back').tap();await cold.waitForURL(origin+'/');await cold.locator('a[href="games/garden/"]').tap();await cold.waitForFunction(()=>typeof gardenDebug==='function');check('首页重新进入保存花园',await cold.evaluate(()=>gardenDebug().state.table[0]?.kind==='strawberry'));
 }finally{await cold.close();await context.setOffline(false);}return results;
}
