// 配合 monster/scratch/cookie-refresh-toy-server.py；只允许本地夹具。
async page => {
  const root = new URL('/', page.url()).href;
  if (new URL(root).hostname !== '127.0.0.1') throw Error('仅运行本地升级夹具');
  page = await page.context().browser().newPage();
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (name, ok, detail) => {
    results.push({name, ok, detail});
    if (!ok) throw Error(JSON.stringify(results));
  };
  const mode = async name => {
    const response = await page.request.post(root + '__test/' + name);
    if (response.status() !== 204) throw Error('fixture mode failed');
  };
  const keys = () => page.evaluate(() => caches.keys());
  const click = async () => {
    await page.evaluate(() => { refreshCooldown = 0; });
    await page.locator('#refresh-games').click();
  };
  await mode('legacy');
  await page.goto(root);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  check('旧版无刷新按钮', await page.locator('#refresh-games').count() === 0);
  const oldKeys = await keys();
  check('旧版缓存已就绪', oldKeys.length === 1 && oldKeys[0].endsWith('5a601851f8ee08b9'), oldKeys);
  await mode('current');
  await page.goto(root);
  await page.evaluate(async old => {
    for (let attempt = 0; attempt < 300; attempt++) {
      const list = await caches.keys();
      const registration = await navigator.serviceWorker.getRegistration();
      if (list.length === 1 && list[0] !== old[0] && registration.active?.state === 'activated'
        && navigator.serviceWorker.controller === registration.active) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error('新版安装未完成');
  }, oldKeys);
  const upgradedResponse = await page.reload({waitUntil:'load'});
  const upgradedBody = await upgradedResponse.text();
  check('重开响应来自新版缓存', upgradedBody.includes('refresh-rotor'));
  await page.locator('#refresh-games .refresh-rotor').waitFor({state:'attached'});
  check('旧版原网址联网重开可自动安装新版并取得风车', await page.locator('#refresh-games .refresh-rotor').count() === 1);
  const currentKeys = await keys();
  const originalTime = await page.evaluate(() => performance.timeOrigin);
  await click();
  await page.waitForFunction(() => document.querySelector('#refresh-games').dataset.state === 'latest');
  check('已最新显示明确提示且不重载', await page.evaluate(t => performance.timeOrigin === t, originalTime), await page.locator('#refresh-status').textContent());
  await page.context().setOffline(true);
  await click();
  await page.waitForFunction(() => document.querySelector('#refresh-games').dataset.state === 'offline');
  check('断网不重载不换缓存', await page.evaluate(t => performance.timeOrigin === t, originalTime) && JSON.stringify(await keys()) === JSON.stringify(currentKeys));
  check('离线风车仍可点且不busy', await page.locator('#refresh-games').isEnabled() && await page.locator('#refresh-games').getAttribute('aria-busy') === 'false');
  await page.locator('#refresh-games').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  check('键盘不误进随机游戏', page.url() === root);
  await page.context().setOffline(false);
  // 同一页注册器增加短延迟，确定连点窗口；保留真实 update 实现。
  await page.evaluate(() => {
    window.updateCalls = 0;
    window.originalUpdate = ServiceWorkerRegistration.prototype.update;
    ServiceWorkerRegistration.prototype.update = async function() {
      window.updateCalls++;
      await new Promise(resolve => setTimeout(resolve, 800));
      return window.originalUpdate.call(this);
    };
    refreshCooldown = 0;
  });
  for (let i = 0; i < 5; i++) await page.locator('#refresh-games').click();
  await page.waitForFunction(() => !refreshBusy);
  for (let i = 0; i < 3; i++) await page.locator('#refresh-games').click();
  check('连点与冷却期间只检查一次', await page.evaluate(() => window.updateCalls) === 1);
  check('点击产生真实音频节点', await page.evaluate(() => toyAudio?.state === 'running'));
  await page.evaluate(() => { ServiceWorkerRegistration.prototype.update = window.originalUpdate; });
  for (const [width,height] of [[390,844],[820,1180],[1024,768]]) {
    await page.setViewportSize({width,height});
    await page.locator('#refresh-games').scrollIntoViewIfNeeded();
    const box = await page.locator('#refresh-games').evaluate(el => {
      const r=el.getBoundingClientRect();
      return {width:r.width,height:r.height,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    check(`风车 ${width} 视口热区与排布`, box.hit && box.width >= 128 && box.height >= 128 && !box.overflow, box);
    await page.evaluate(() => document.activeElement?.blur());
    await page.screenshot({path:`output/cookie-arcade/refresh-toy-20261006/footer-${width}.png`});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(() => refreshState('checking','检查中'));
  check('减少动态效果时停止旋转', await page.locator('.refresh-rotor').evaluate(el => getComputedStyle(el).animationName) === 'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mode('fail');
  await click();
  await page.waitForFunction(() => document.querySelector('#refresh-games').dataset.state === 'error');
  check('缺失资源不重载且保留旧缓存', await page.evaluate(t => performance.timeOrigin === t, originalTime) && JSON.stringify(await keys()) === JSON.stringify(currentKeys));
  await page.context().setOffline(true);
  await page.goto(root+'games/waterwheel/');
  await page.locator('#back').waitFor();
  check('失败后旧游戏仍离线可玩', await page.locator('#back').isVisible());
  await page.goto(root);
  await page.context().setOffline(false);
  await mode('v2');
  await click();
  await page.waitForFunction(() => document.title.endsWith('v2'));
  check('完整新版安装后才跳转并使用新版', (await keys()).some(name => name.includes('test-v2')));
  await page.context().setOffline(true);
  await page.goto(root+'games/picnic/');
  await page.locator('#back').waitFor();
  check('新版仍可离线玩', await page.locator('#back').isVisible());
  await page.context().setOffline(false);
  await mode('legacy');
  const older = await page.context().browser().newPage();
  await older.goto(root);
  await older.waitForFunction(() => navigator.serviceWorker.controller);
  await mode('current');
  const entry = await older.goto(root + '?refresh=20261006');
  check('一次性更新入口绕过旧首页缓存', (await entry.text()).includes('refresh-rotor'));
  await older.locator('#refresh-games').click();
  await older.waitForURL(root);
  await older.locator('#refresh-games .refresh-rotor').waitFor({state:'attached'});
  await older.context().setOffline(true);
  await older.reload();
  await older.locator('#refresh-games .refresh-rotor').waitFor({state:'attached'});
  check('更新入口下载完成返回原地址且可离线重开', older.url() === root);
  await older.context().close();
  check('无页面脚本错误', errors.length === 0, errors);
  return {passed:results.length,results};
}
