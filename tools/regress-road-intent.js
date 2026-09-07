// 交给 Playwright CLI run-code；先打开本地或线上修路喽页面。
async (page) => {
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (name, ok, detail) => results.push({name, ok, detail});
  const state = () => page.evaluate(() => ({phase, filled: holes.map(g => g.filled), selected: selected?.type, focus: !!focusGap}));
  const reset = index => page.evaluate(index => {
    const random = Math.random;
    routeIndex = -1; round = 5; Math.random = () => (index + .1) / ROUTES.length;
    try { dealRound(); } finally { Math.random = random; }
  }, index);
  const dragTo = async (pieceIndex, x, y) => {
    const box = await page.locator('#tray .piece').nth(pieceIndex).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(x, y, {steps: 4}); await page.mouse.up();
  };
  await page.setViewportSize({width:1024,height:768});
  for (let layout = 0; layout < 6; layout++) {
    for (let candidate = 0; candidate < 3; candidate++) {
      await reset(layout);
      for (let attempt = 0; attempt < 5; attempt++) await dragTo(candidate, 12, 110);
      let s = await state();
      check(`布局${layout}候选${candidate}：反复拖到空地不能填洞`, s.phase === 'build' && !s.filled.some(Boolean), s);
      await page.locator('#tray .piece').nth(candidate).click();
      s = await state();
      check(`布局${layout}候选${candidate}：拖偏后的提示不代选目标`, !s.filled.some(Boolean), s);
    }
    await reset(layout);
    const wrong = await page.evaluate(() => pieces.findIndex(p => p.type !== holes[0].type));
    await page.locator('#board .gap').nth(0).click();
    for (let attempt = 0; attempt < 8; attempt++) await page.locator('#tray .piece').nth(wrong).click();
    let s = await state();
    check(`布局${layout}：连续错选8次仍不填洞`, !s.filled.some(Boolean) && s.phase === 'build', s);
    check(`布局${layout}：连续错选保留正确项提示`, await page.locator('#tray .glow').count() > 0);
    await reset(layout);
    for (let attempt = 0; attempt < 4; attempt++) await page.locator('#car').click();
    const correct = await page.evaluate(() => pieces.findIndex(p => p.type === holes[0].type));
    await page.locator('#tray .piece').nth(correct).click();
    s = await state();
    check(`布局${layout}：按车提醒后选块不能暗中填洞`, !s.filled.some(Boolean), s);
  }
  for (const reason of ['pointercancel', 'lostpointercapture', 'blur', 'resize', 'visibilitychange']) {
    await reset(0);
    await page.evaluate(reason => {
      const p = pieces.find(p => p.type === holes[0].type), r = p.el.getBoundingClientRect();
      p.el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true,pointerId:41,pointerType:'touch',clientX:r.x+20,clientY:r.y+20}));
      document.dispatchEvent(new PointerEvent('pointermove', {bubbles:true,pointerId:41,clientX:r.x+40,clientY:r.y-30}));
      if (reason === 'blur' || reason === 'resize') window.dispatchEvent(new Event(reason));
      else if (reason === 'visibilitychange') document.dispatchEvent(new Event(reason));
      else document.dispatchEvent(new PointerEvent(reason, {bubbles:true,pointerId:41}));
    }, reason);
    await page.locator('#board .gap').nth(0).click();
    const s = await state();
    check(`${reason}：取消后点缺口不能放入取消的路块`, !s.filled.some(Boolean), s);
    check(`${reason}：无拖影、不增加错误次数`, await page.evaluate(() => !drag && !document.querySelector('#ghost') && holes.every(g => g.misses === 0)));
  }
  for (const reason of ['blur', 'resize', 'visibilitychange']) {
    for (const first of ['piece', 'gap']) {
      await reset(0);
      const correct = await page.evaluate(() => pieces.findIndex(p => p.type === holes[0].type));
      const piece = page.locator('#tray .piece').nth(correct), gap = page.locator('#board .gap').nth(0);
      await (first === 'piece' ? piece : gap).click();
      await page.evaluate(reason => (reason === 'visibilitychange' ? document : window).dispatchEvent(new Event(reason)), reason);
      await (first === 'piece' ? gap : piece).click();
      const s = await state();
      check(`${reason}：普通点选${first}也不跨中断保留`, !s.filled.some(Boolean), s);
    }
  }
  check('无页面JS异常', errors.length === 0, errors);
  return {passed:results.filter(r => r.ok).length, failed:results.filter(r => !r.ok).length, results};
}
