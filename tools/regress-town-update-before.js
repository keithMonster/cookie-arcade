async page=>{
 if(new URL(page.url()).origin!=='http://127.0.0.1:8787')throw Error('local snapshot only');
 await page.waitForFunction(async()=>!!navigator.serviceWorker.controller&&(await Promise.all((await caches.keys()).map(async n=>(await (await caches.open(n)).keys()).length))).includes(603),null,{timeout:60000});
 await page.goto('http://127.0.0.1:8787/games/town/');
 await page.locator('[data-kind="arch"]').tap();await page.locator('[data-column="0"]').tap({position:{x:10,y:10}});
 const saved=await page.evaluate(()=>localStorage.getItem('cookie-town-v1'));if(!JSON.parse(saved).columns[0].includes('arch'))throw Error('no saved work');
 await page.evaluate(s=>sessionStorage.setItem('update-before',s),saved);
 await page.context().setOffline(true);try{await page.reload();if(!(await page.evaluate(()=>townDebug())).columns[0].includes('arch'))throw Error('old offline failed');}finally{await page.context().setOffline(false);}
 return{oldCaches:await page.evaluate(()=>caches.keys()),saved,oldOffline:true};
}
