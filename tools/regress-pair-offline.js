// 完整安装后断网冷开两款；隔离本地，不触达外部系统。
async page=>{
 const origin='http://127.0.0.1:18973';if(new URL(page.url()).origin!==origin)throw Error('local only');
 const results=[];const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw Error(JSON.stringify(results));};
 await page.goto(origin+'/');
 const manifest=await page.evaluate(async()=>{const text=await(await fetch('service-worker.js',{cache:'no-store'})).text();return{version:text.match(/const CACHE_VERSION = "([a-f0-9]+)"/)[1],paths:JSON.parse(text.match(/const PRECACHE_PATHS = (\[[\s\S]*?\]);/)[1])};});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;await(await navigator.serviceWorker.getRegistration()).update();});
 await page.waitForFunction(async m=>{const r=await navigator.serviceWorker.getRegistration();return r?.active===navigator.serviceWorker.controller&&(await(await caches.open('cookie-arcade-offline-'+m.version)).keys()).length===m.paths.length;},manifest,{timeout:90000});
 check('完整缓存安装',true,{version:manifest.version,count:manifest.paths.length});
 const context=page.context();await context.setOffline(true);const cold=page;await page.goto("about:blank");
 try{
  await cold.goto(origin+'/games/hidecar/');await cold.waitForFunction(()=>hidecarDebug().phase==='searching');const s=await cold.evaluate(()=>hidecarDebug());await cold.locator('[data-door="'+s.target+'"]').tap();await cold.waitForTimeout(550);await cold.locator('#car').tap();await cold.locator('#road').tap();check('断网找车出发',await cold.evaluate(()=>hidecarDebug().phase==='leaving'));
  await cold.goto(origin+'/games/market/');await cold.locator('[data-fruit="apple"]').tap();await cold.locator('#basket').tap();await cold.locator('#basket-handle').tap();await cold.locator('#customer').tap();check('断网水果交付',await cold.evaluate(()=>marketDebug().celebrating));
  for(const [game,audio]of [['hidecar','found'],['market','thanks']]){
   const result=await cold.evaluate(async({game,audio})=>{const url='/games/'+game+'/audio/'+audio+'.mp3';const r=await fetch(url,{headers:{Range:'bytes=0-9'}});const status=r.status,len=(await r.arrayBuffer()).byteLength;const bytes=await(await fetch(url)).arrayBuffer();const a=new AudioContext();try{const buffer=await a.decodeAudioData(bytes);return{status,len,duration:buffer.duration};}finally{await a.close();}},{game,audio});
   check(game+'离线音频Range与解码',result.status===206&&result.len===10&&result.duration>0,result);
  }
  await cold.locator('#back').tap();await cold.waitForURL(origin+'/');check('断网返回首页38款',await cold.locator('a.tile').count()===38);
  await cold.locator('a[href="games/garden/"]').tap();await cold.waitForURL(origin+'/games/garden/');await cold.waitForFunction(()=>typeof gardenDebug==='function');check('旧花园仍离线可开',await cold.evaluate(()=>typeof gardenDebug==='function'));
 }finally{await context.setOffline(false);}return results;
}
