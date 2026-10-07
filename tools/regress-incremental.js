// 配合 tools/serve-update-fixture.py；仅运行本地真实SW升级。
async page => {
  const origin = new URL(page.url()).origin;
  if (new URL(origin).hostname !== '127.0.0.1') throw Error('仅限本地夹具');
  const root = origin + '/arcade/';
  const test = await page.context().browser().newPage();
  const results = [];
  const check = (name, ok, detail) => {
    results.push({name,ok,detail});
    if (!ok) throw Error(JSON.stringify(results));
  };
  const mode = async value => {
    const response = await test.request.post(origin+'/__test/'+value);
    if (response.status() !== 204) throw Error('fixture mode');
  };
  const click = async () => {
    await test.evaluate(() => {refreshCooldown=0;});
    await test.locator('#refresh-games').click();
  };
  const progress = () => test.evaluate(() => new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(Error('no progress response')),3000);
    const handler=event=>{
      if(event.source!==navigator.serviceWorker.controller || event.data?.type!=='OFFLINE_PROGRESS') return;
      clearTimeout(timer);navigator.serviceWorker.removeEventListener('message',handler);resolve(event.data);
    };
    navigator.serviceWorker.addEventListener('message',handler);
    navigator.serviceWorker.controller.postMessage({type:'OFFLINE_PROGRESS'});
  }));
  try {
    await mode('old');
    await test.goto(root);
    await test.waitForFunction(()=>navigator.serviceWorker.controller);
    await test.reload();
    const firstTime=await test.evaluate(()=>performance.timeOrigin);
    await mode('current');
    await click();
    await test.waitForFunction(old=>performance.timeOrigin!==old && !!document.querySelector('.refresh-group'),firstTime);
    const first=await progress();
    const requests=await (await test.request.get(origin+'/__test/counts')).json();
    check('旧发布版直接增量迁移，仅重下首页两个地址', first.downloaded===2 && first.reused===first.total-2 && first.completed===first.total, {progress:first,requests});
    check('升级没有重新请求任何游戏或语音资源',Object.keys(requests).every(path=>['/','/index.html','/service-worker.js'].includes(path)));
    const sound=await test.evaluate(async()=>{
      const cache=await caches.open((await caches.keys())[0]);
      const request=(await cache.keys()).find(r=>r.url.endsWith('.mp3'));
      await cache.put(request,new Response('damaged test audio'));
      return request.url;
    });
    const nextTime=await test.evaluate(()=>performance.timeOrigin);
    await mode('v2');
    await click();
    await test.waitForFunction(old=>performance.timeOrigin!==old && document.title==='Cookie Arcade v2',nextTime);
    const next=await progress();
    check('只改首页并损坏一份旧音频，仅下载3个地址',next.downloaded===3 && next.reused===next.total-3 && next.completed===next.total,next);
    await test.context().setOffline(true);
    const range=await test.evaluate(async url=>{
      const response=await fetch(url,{headers:{Range:'bytes=0-15'}});
      return {status:response.status,length:(await response.arrayBuffer()).byteLength,range:response.headers.get('content-range')};
    },sound);
    check('复用/修复后的音频离线Range仍有效',range.status===206 && range.length===16,range);
    await test.goto(root+'games/waterwheel/');
    check('游戏目录别名离线可打开',await test.locator('#back').isVisible());
    await test.goto(root+'games/waterwheel/index.html');
    check('游戏index.html离线可打开',await test.locator('#back').isVisible());
    await test.goto(root);
    const before=await test.evaluate(async()=>({time:performance.timeOrigin,keys:await caches.keys()}));
    await test.context().setOffline(false);
    await mode('broken');
    await click();
    await test.waitForFunction(()=>refreshButton.dataset.state==='error');
    check('200响应版本不符时不启用，保留完整旧缓存',await test.evaluate(async old=>performance.timeOrigin===old.time && JSON.stringify(await caches.keys())===JSON.stringify(old.keys),before));
    await mode('hang');
    const began=Date.now();
    await click();
    await test.waitForTimeout(22000);
    const waiting=()=>test.evaluate(old=>refreshBusy && refreshButton.dataset.state==='checking' && performance.timeOrigin===old.time,before);
    check('单资源超过20秒仍下载，旧页继续服务',await waiting(),{elapsed:Date.now()-began,status:await test.locator('#refresh-status').textContent()});
    await test.waitForTimeout(36000);
    await test.waitForTimeout(36000);
    check('整轮超过90秒仍等待并显示进度',await waiting(),{elapsed:Date.now()-began,status:await test.locator('#refresh-status').textContent()});
    await test.waitForFunction(()=>document.title==='Cookie Arcade hang',null,{timeout:30000});
    check('百秒慢下载完成后自动切换完整新版',Date.now()-began>=99000,await progress());
    await test.context().setOffline(true);
    await test.reload();
    check('慢下载完成后新版可离线重开',await test.title()==='Cookie Arcade hang');
    await test.context().setOffline(false);
    await mode('connect');
    await click();
    await test.waitForTimeout(13000);
    check('连接超过12秒仍等待不报超时',await test.evaluate(()=>refreshBusy&&refreshButton.dataset.state==='checking'),await test.locator('#refresh-status').textContent());
    await test.waitForFunction(()=>document.title==='Cookie Arcade connect',null,{timeout:45000});
    check('慢连接最终完成更新',await test.title()==='Cookie Arcade connect');
    await test.context().setOffline(true);
    await click();
    await test.waitForFunction(()=>refreshButton.dataset.state==='offline');
    check('真实断网仍提示且保留旧游戏',await test.evaluate(()=>!refreshBusy&&!!navigator.serviceWorker.controller));
    return {passed:results.length,results};
  } catch(error) {
    return {error:String(error),results,status:await test.locator('#refresh-status').textContent().catch(()=>null)};
  } finally {await test.context().close();}
}
