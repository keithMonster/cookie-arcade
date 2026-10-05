// Playwright CLI run-code --filename：同站本地游戏回归，页面内探针不进入产品。
async (page) => {
  const base = page.url().replace(/\/games\/.*$/, '/');
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    if (!ok) throw Error(JSON.stringify(results));
  };
  for (const game of ['bubbles', 'tw-bubbles']) {
    const url = new URL(`games/${game}/`, base).href;
    await page.route(url, async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace('  function popAt(px, py) {',
        '  window.__touchProbe = {spawnBubble, popAt, bubbleCenter, get bubbles() {return liveBubbles;}};\n  function popAt(px, py) {');
      await route.fulfill({response, body});
    });
    await page.goto(url);
    await page.unroute(url);
    const evidence = await page.evaluate(() => {
      const p = window.__touchProbe;
      p.spawnBubble();
      const b = p.bubbles[0];
      b.el.getAnimations().forEach(a => a.cancel());
      b.el.style.cssText += ';left:100px;top:120px;bottom:auto;transform:translateX(50px);opacity:1;';
      const g = p.bubbleCenter(b, performance.now());
      const rect = b.el.getBoundingClientRect();
      p.popAt(g.cx + g.r + 20, g.cy);
      const blank = !b.popping;
      p.popAt(g.cx + g.r + 12, g.cy);
      return {blank, edge: b.popping, cx:g.cx, rendered:rect.left + rect.width/2};
    });
    check(`${game} 实际摇摆位置外沿12px命中、20px空白不破`, evidence.blank && evidence.edge && evidence.cx === evidence.rendered, evidence);
  }
  for (const game of ['outing', 'train']) {
    for (const [width, height] of [[320,568],[568,320],[390,844],[844,390],[768,1024]]) {
      await page.setViewportSize({width,height});
      await page.goto(new URL(`games/${game}/`, base).href);
      await page.waitForTimeout(700);
      const evidence = await page.evaluate(game => {
        const els = [...document.querySelectorAll(game === 'outing' ? '.item' : '.kid')];
        els.forEach(el => el.style.animation = 'none');
        const boxes = els.map(el => {
          const r = el.getBoundingClientRect(), css = getComputedStyle(el,'::before');
          const w=parseFloat(css.width),h=parseFloat(css.height);
          const cx=r.left+r.width/2,cy=r.top+r.height/2;
          return {id:el.id,x:cx-w/2,y:cy-h/2,w,h,hit:el.contains(document.elementFromPoint(cx+w/2-2,cy))};
        });
        const back=document.querySelector('#back'),r=back.getBoundingClientRect();
        const backHit=back.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
        const overlap=boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.x<b.x+b.w-0.5&&b.x<a.x+a.w-0.5&&a.y<b.y+b.h-0.5&&b.y<a.y+a.h-0.5));
        return {boxes,backHit,overlap};
      },game);
      check(`${game} ${width}×${height} 透明热区至少72且可命中、不盖邻项或返回`,evidence.boxes.every(b=>b.w>=71.9&&b.h>=71.9&&b.hit)&&!evidence.overlap&&evidence.backHit,evidence);
    }
  }
  await page.goto(new URL('games/bath/',base).href);
  const bath=await page.evaluate(()=>{
    const before=muds.length;
    const target=muds[0],g=mudGeom(target);
    scrubAt(g.x,g.y);
    return {one:before-muds.length===1,nearest:!muds.includes(target),min:muds.every(m=>mudGeom(m).tol>=28)};
  });
  check('bath 一次只洗最近泥点、最小半径28px',bath.one&&bath.nearest&&bath.min,bath);
  await page.goto(new URL('games/outing/',base).href);
  const outing=await page.evaluate(()=>{
    completeStep(byKey('shoe')); completeStep(byKey('towel'));
    completeStep(decoyItem()); completeStep(byKey('car'));
    return {threshold:HOLD_DRAG_THRESH,shoe:byKey('shoe').done,towel:byKey('towel').done,decoy:decoyItem().done,car:byKey('car').done};
  });
  check('outing 奶瓶34px阈值与袜鞋、奶毛巾依赖保留',outing.threshold===34&&!outing.shoe&&!outing.towel&&!outing.decoy&&!outing.car,outing);
  return {passed:results.length,results};
}
