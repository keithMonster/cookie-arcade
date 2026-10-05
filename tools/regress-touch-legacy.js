async (page) => {
  const origin = new URL('../../',page.url()).href.replace(/\/$/,'');
  const results = [];
  const initialViewport = page.viewportSize();
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/games/helper/`);
    await page.addStyleTag({ content: '.item, .held { animation: none !important; }' });
    const layout = await page.evaluate(() => {
      const assert = (ok, message) => { if (!ok) throw new Error(`helper layout ${innerWidth}x${innerHeight}: ${message}`); };
      heldEl.textContent = target.item.emoji;
      handEl.classList.add('full');
      const elements = [...itemEls, heldEl];
      const rects = elements.map(el => el.getBoundingClientRect());
      elements.forEach((el, i) => {
        const r = rects[i], css = getComputedStyle(el), pseudo = getComputedStyle(el, '::before');
        const vmin = Math.min(innerWidth, innerHeight) / 100;
        assert(r.width > 0 && r.height > 0 && r.width < innerWidth / 2, '实体布局越界或占满屏幕');
        assert(Math.abs(r.height - (el === heldEl ? 13 : 14) * vmin) < 2, '透明热区误改实体高度');
        assert(css.position === (el === heldEl ? 'absolute' : 'relative'), '物件定位被透明热区覆盖');
        assert(pseudo.content !== 'none' && parseFloat(pseudo.height) >= 71.9, '透明热区未达到72px');
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const hit = (x, y) => { const found = document.elementFromPoint(x, y); return found === el || el.contains(found); };
        assert(hit(cx, cy), '实体中心被其他元素遮挡');
        const radius = Math.max(r.height, 72) / 2 - 2;
        assert(hit(cx, cy - radius) && hit(cx, cy + radius), '透明热区上下边缘实际不可点击');
      });
      for (let i = 1; i < itemEls.length; i++) {
        assert(rects[i].left > rects[i - 1].right, '相邻物件实体重叠');
        const x = (rects[i].left + rects[i - 1].right) / 2;
        const y = rects[i].top + rects[i].height / 2;
        const hit = document.elementFromPoint(x, y);
        assert(!itemEls.some(el => el === hit || el.contains(hit)), '透明热区横向侵入相邻间隙');
      }
      return { width: innerWidth, height: innerHeight, hitTargets: elements.length };
    });
    results.push({ helperLayout: layout });
  }
  if (initialViewport) await page.setViewportSize(initialViewport);
  for (const game of ['basket', 'helper', 'sort']) {
    await page.goto(`${origin}/games/${game}/`);
    const result = await page.evaluate(async (game) => {
      const assert = (ok, message) => { if (!ok) throw new Error(`${game}: ${message}`); };
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const pointer = (el, type, x, y, id = 7, pointerType = 'touch') => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType, clientX: x, clientY: y }));
      // 直接设定轮内状态，跳过音频等待；不调用外部资源或修改玩法判定。
      let el;
      if (game === 'helper') {
        phase = 'give'; taskSpeaking = false; heldItem = target.item;
        heldEl.textContent = heldItem.emoji; handEl.classList.add('full'); el = heldEl;
      } else { phase = 'play'; el = document.querySelector(game === 'basket' ? '.fruit' : '.item'); }
      const before = game === 'basket' ? missStreak : game === 'sort' ? el.dataset.taps : heldItem;
      let r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      pointer(el, 'pointerdown', x, y);
      pointer(el, 'pointermove', x + 90, y - 80);
      const dragged = el.getBoundingClientRect();
      pointer(el, 'pointermove', x + 250, y, 8);
      assert(Math.abs(el.getBoundingClientRect().left - dragged.left) < 1, '第二根手指抢走拖动');
      pointer(el, 'pointercancel', x + 90, y - 80);
      assert(!el.classList.contains(game === 'basket' ? 'in-basket' : 'in-bin'), 'cancel 自动完成');
      assert((game === 'basket' ? missStreak : game === 'sort' ? el.dataset.taps : heldItem) === before, 'cancel 计错或丢物件');
      await wait(80);
      r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2;
      pointer(el, 'pointerdown', x, y);
      assert(Math.abs(el.getBoundingClientRect().left - r.left) < 1, '回位时再抓跳位');
      pointer(el, 'pointermove', x + 12, y);
      assert(Math.abs(el.getBoundingClientRect().left - r.left - 12) < 1, '再抓不跟手');
      await wait(500);
      assert(Math.abs(el.getBoundingClientRect().left - r.left - 12) < 1, '旧 timer 打断拖动');
      pointer(el, 'pointercancel', x + 12, y);
      if (game !== 'basket') {
        const targets = game === 'sort' ? [binEls.L, binEls.R] : petEls;
        const originals = targets.map(t => t.getBoundingClientRect);
        targets.forEach((t, i) => t.getBoundingClientRect = () => ({ left: i * 120, right: i * 120 + 100, top: 0, bottom: 100, width: 100, height: 100 }));
        assert((game === 'sort' ? hitBin(122, 50) === 'R' : hitPet(122, 50) === targets[1]), '扩展热区盖住原始目标');
        assert((game === 'sort' ? hitBin(115, 50) === 'R' : hitPet(115, 50) === targets[1]), '交叠区未选最近目标');
        targets.forEach((t, i) => t.getBoundingClientRect = originals[i]);
      }
      await wait(500);
      r = el.getBoundingClientRect();
      pointer(el, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2, 9, 'mouse');
      pointer(el, 'pointerup', r.left + r.width / 2, r.top + r.height / 2, 9, 'mouse');
      assert(el.classList.contains('hop'), '鼠标点按无反馈');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
      await wait(100);
      assert(game === 'helper' ? phase === 'fly' : !!document.querySelector(game === 'basket' ? '.in-basket' : '.in-bin') || phase !== 'play', '键盘未推进');
      return { game, cancel: true, regrab: true, overlap: game !== 'basket', touchMouseKeyboard: true };
    }, game);
    results.push(result);
  }
  return results;
}
