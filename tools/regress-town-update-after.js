async page=>{
 if(new URL(page.url()).origin!=='http://127.0.0.1:8787')throw Error('local snapshot only');const results=[];const check=(name,ok,d)=>{results.push({name,ok,detail:d});if(!ok)throw Error(JSON.stringify(results));};
 const version=await page.evaluate(async()=>{const src=await(await fetch('/service-worker.js',{cache:'no-store'})).text();return src.match(/const CACHE_VERSION = "([a-f0-9]+)"/)[1];});
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await page.waitForFunction(async v=>{const names=await caches.keys();return names.includes('cookie-arcade-offline-'+v)&&names.filter(n=>n.startsWith('cookie-arcade-offline-')).length===1&&(await(await caches.open('cookie-arcade-offline-'+v)).keys()).length===603;},version,{timeout:60000});
 check('旧缓存更新为完整新缓存',true,version);
 await page.context().setOffline(true);try{
 await page.goto('http://127.0.0.1:8787/');await page.locator('a[href="games/town/"]').tap();await page.waitForURL('**/games/town/');await page.waitForFunction(()=>typeof hintReason!=='undefined');check('断网实际运行新版',await page.evaluate(()=>document.documentElement.innerHTML.includes('hintReason')));
 check('升级保留原作品',await page.evaluate(()=>localStorage.getItem('cookie-town-v1')===sessionStorage.getItem('update-before')));
 await page.locator('[data-kind="roof"]').tap();await page.locator('[data-column="0"]').tap({position:{x:10,y:10}});check('升级后断网继续改建',await page.evaluate(()=>townDebug().columns[0].join()==='arch,roof'));
 await page.locator('[data-kind="block"]').tap();await page.locator('[data-column="0"]').tap({position:{x:10,y:10}});await page.locator('[data-column="0"]').tap({position:{x:10,y:10}});check('新版提示在断网时保持',await page.locator('.column.hint').count()>0);
 }finally{await page.context().setOffline(false);}return results;
}
