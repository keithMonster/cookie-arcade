#!/usr/bin/env python3
"""出门喽 2.0 行为回归：把「顺序有依赖 + 条件判断」这套规则跑成机器断言。

为什么要有这个脚本：这一款和台上其他 25 款不同——它的正确性不在"点了有没有反应"，
而在"**顺序错了会不会被拦住**"。这类规则靠肉眼玩两把测不出来（错误路径正是最少
被手点到的那条），也正是一代翻车的地方（assist 跨轮不重置，玩到第二轮才显形）。

依赖：本机 Chrome + web-access 的 CDP Proxy（localhost:3456）。跑之前先
    node ~/.claude/skills/web-access/scripts/check-deps.mjs

用法：
    python3 tools/regress-outing.py            # 全部断言
    python3 tools/regress-outing.py --keep     # 跑完不关 tab，方便自己接着点

实现说明：
  · 用合成 PointerEvent 驱动，不用真鼠标——拖放路径全在 pointerdown/move/up 上，
    合成事件走的是同一段代码；`setPointerCapture` 对合成 pointerId 会抛，
    页面里那三处 try/catch 正好一并验到。
  · 后台 tab 的 timer 会被 Chrome 粗化到 1s 粒度（长 timer 只是变粗、不会不触发），
    所以所有等待都留足余量并轮询，不写死 sleep 到点就断言。
"""
import argparse
import http.client
import http.server
import json
import socketserver
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROXY = "http://localhost:3456"
PORT = 8899
PAGE = f"http://localhost:{PORT}/games/outing/index.html"

results = []


# ---------------------------------------------------------------------------
# 本地静态服务器（file:// 下 fetch 预载会被 CORS 挡，起个真 HTTP 更接近线上）
# ---------------------------------------------------------------------------
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), QuietHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


# ---------------------------------------------------------------------------
# CDP Proxy 薄封装
# ---------------------------------------------------------------------------
def http_get(path):
    with urllib.request.urlopen(PROXY + path, timeout=30) as r:
        return json.loads(r.read().decode())


def http_post(path, body, tolerate=False):
    req = urllib.request.Request(
        PROXY + path, data=body.encode(), method="POST",
        headers={"Content-Type": "text/plain; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        # /emulate 的 touch 那一跳在本机 Chrome 上恒报错，但 device metrics 已经生效——
        # 「HTTP 码不 OK」不等于「动作没发生」，这里按副作用判（调用方随后读 innerWidth 核对）
        if not tolerate:
            raise
        return {"error": e.read().decode()[:200]}


def ev(target, js):
    """跑一段 JS，返回它的值（页面里 throw 会原样冒上来，不吞）。"""
    r = http_post(f"/eval?target={target}", js)
    if isinstance(r, dict) and r.get("error"):
        raise RuntimeError(f"eval 失败：{r}")
    return r.get("value") if isinstance(r, dict) and "value" in r else r


def evj(target, js):
    """跑一段 JS 并把结果按 JSON 取回（页面侧自己 JSON.stringify）。"""
    out = ev(target, js)
    return json.loads(out) if isinstance(out, str) else out


# 传输层挂了（proxy 自杀 / Chrome CDP 卡死）跟「断言没过」是两回事，分开处理：
# 前者整轮重来，后者才计入结果。CDP Proxy 是全机共用的，别的会话把 Chrome 拖垮时
# 它会自杀重启，半路挂掉的 eval 可能已经改了页面状态——所以只能整轮重来，不能续跑。
TRANSPORT_ERRORS = (urllib.error.URLError, TimeoutError, ConnectionError,
                    http.client.RemoteDisconnected, http.client.BadStatusLine)


class ProxyDied(Exception):
    pass


def ensure_proxy(wait=6):
    for _ in range(3):
        try:
            http_get("/health")
            return True
        except Exception:
            subprocess.run(["node", str(Path.home() / ".claude/skills/web-access/scripts/check-deps.mjs")],
                           capture_output=True, timeout=180)
            time.sleep(wait)
    return False


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("  ✓ " if ok else "  ✗ ") + name + (f"  — {detail}" if detail else ""))


def wait_until(fn, timeout=20.0, step=0.4):
    """轮询到条件成立；后台 tab timer 被粗化，所有时序断言都走这条路。"""
    end = time.time() + timeout
    while time.time() < end:
        if fn():
            return True
        time.sleep(step)
    return False


# ---------------------------------------------------------------------------
# 页面侧测试探针（一次注入，之后每次 eval 直接调）
# ---------------------------------------------------------------------------
PROBE = r"""
window.__T = {
  el: function (k) { return document.getElementById('it' + k[0].toUpperCase() + k.slice(1)); },
  mk: function (t, x, y, pid) {
    return new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: pid,
                                 pointerType: 'mouse', clientX: x, clientY: y, isPrimary: true });
  },
  // 从东西的中心一路拖到宝宝中心：中间补两个 pointermove，越过 DRAG_THRESH
  drag: function (k, pid) {
    pid = pid || 1;
    var el = this.el(k), r = el.getBoundingClientRect();
    var b = document.getElementById('baby').getBoundingClientRect();
    var fx = r.left + r.width / 2, fy = r.top + r.height / 2;
    var tx = b.left + b.width / 2,  ty = b.top + b.height / 2;
    el.dispatchEvent(this.mk('pointerdown', fx, fy, pid));
    el.dispatchEvent(this.mk('pointermove', (fx + tx) / 2, (fy + ty) / 2, pid));
    el.dispatchEvent(this.mk('pointermove', tx, ty, pid));
    el.dispatchEvent(this.mk('pointerup',   tx, ty, pid));
  },
  // 拖到画面角落（没碰到宝宝）—— 「拖偏也计一次没成」那条路径
  dragAway: function (k, pid) {
    pid = pid || 1;
    var el = this.el(k), r = el.getBoundingClientRect();
    var fx = r.left + r.width / 2, fy = r.top + r.height / 2;
    el.dispatchEvent(this.mk('pointerdown', fx, fy, pid));
    el.dispatchEvent(this.mk('pointermove', 4, 4, pid));
    el.dispatchEvent(this.mk('pointerup',   4, 4, pid));
  },
  tap: function (k, pid) {
    pid = pid || 1;
    var el = this.el(k), r = el.getBoundingClientRect();
    var fx = r.left + r.width / 2, fy = r.top + r.height / 2;
    el.dispatchEvent(this.mk('pointerdown', fx, fy, pid));
    el.dispatchEvent(this.mk('pointerup',   fx, fy, pid));
  },
  holdDown: function (pid) {
    pid = pid || 1;
    var el = this.el('bottle'), r = el.getBoundingClientRect();
    el.dispatchEvent(this.mk('pointerdown', r.left + r.width / 2, r.top + r.height / 2, pid));
  },
  holdUp: function (pid) {
    pid = pid || 1;
    var el = this.el('bottle'), r = el.getBoundingClientRect();
    el.dispatchEvent(this.mk('pointerup', r.left + r.width / 2, r.top + r.height / 2, pid));
  },
  // 把一次拖拽拆成两半，中间好插一次换轮（手一直没离开屏幕）
  dragStart: function (k, pid) {
    pid = pid || 1;
    var el = this.el(k), r = el.getBoundingClientRect();
    el.dispatchEvent(this.mk('pointerdown', r.left + r.width / 2, r.top + r.height / 2, pid));
  },
  dragFinish: function (k, pid) {
    pid = pid || 1;
    var el = this.el(k);
    var b = document.getElementById('baby').getBoundingClientRect();
    var tx = b.left + b.width / 2, ty = b.top + b.height / 2;
    el.dispatchEvent(this.mk('pointermove', tx - 40, ty - 40, pid));
    el.dispatchEvent(this.mk('pointermove', tx, ty, pid));
    el.dispatchEvent(this.mk('pointerup',   tx, ty, pid));
  },
  horn: function () {
    document.getElementById('ask').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  },
  winCls: function () { return document.getElementById('win').className; },
  // 系统把手势收走（掌根 / 第二根手指 / 来电 / 切后台）：不是他松的手
  holdCancel: function (pid) {
    pid = pid || 1;
    var el = this.el('bottle'), r = el.getBoundingClientRect();
    el.dispatchEvent(this.mk('pointercancel', r.left + r.width / 2, r.top + r.height / 2, pid));
  },
  // 把这一轮的天气强行摆成想要的那个（dealRound 自己会重置全部计数）
  // 至少发一轮：本来就是这个天气时一轮不发的话，上一组测试的脏状态会原样留下来
  forceWeather: function (w) {
    for (var i = 0; i < 200; i++) { dealRound(); if (weather === w) break; }
    return weather;
  },
  reset: function () { dealRound(); return weather; },
  // 键盘短按一下（keydown 立刻跟 keyup，300ms 的长按视觉不会起来）
  key: function () {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    document.dispatchEvent(new KeyboardEvent('keyup',   { key: 'a', bubbles: true, cancelable: true }));
  },
  state: function () {
    return JSON.stringify({
      phase: phase, weather: weather, gear: gearItem().key, decoy: decoyItem().key,
      glowKeys: Array.from(glowKeys), wrongGearMiss: wrongGearMiss,
      everDragged: everDragged, finished: finished,
      items: ITEMS.map(function (i) {
        return { k: i.key, done: !!i.done, miss: i.miss | 0, block: i.blockMiss | 0,
                 assist: !!i.assist, glow: i.el.classList.contains('glow'),
                 gone: i.el.classList.contains('gone'), cls: i.el.className };
      })
    });
  }
};
'probe-ready'
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--keep", action="store_true", help="跑完不关 tab")
    args = ap.parse_args()

    serve()
    for attempt in range(1, 4):
        if not ensure_proxy():
            sys.exit("CDP Proxy 起不来——手动跑 "
                     "node ~/.claude/skills/web-access/scripts/check-deps.mjs 看它报什么")
        results.clear()
        tid = None
        try:
            tid = http_get("/new?url=" + urllib.parse.quote(PAGE, safe=""))["targetId"]
            print(f"tab {tid} → {PAGE}" + (f"（第 {attempt} 次尝试）" if attempt > 1 else "") + "\n")
            run(tid)
            break
        except TRANSPORT_ERRORS as e:
            print(f"\n… CDP 传输层中断（{type(e).__name__}: {e}），整轮重来（{attempt}/3）\n")
            time.sleep(8)
        finally:
            if tid and not args.keep:
                try:
                    http_get(f"/close?target={tid}")
                except Exception:
                    pass
    else:
        sys.exit("三次都被 CDP 传输层打断，没跑完——Chrome 那边可能卡了（tab 太多 / 授权框积压）")

    bad = [n for n, ok, _ in results if not ok]
    print("\n" + "-" * 60)
    print(f"{len(results) - len(bad)}/{len(results)} 通过" + ("" if not bad else "，未过：" + "、".join(bad)))
    return 1 if bad else 0


def run(tid):
    assert ev(tid, PROBE) == "probe-ready", "探针注入失败"
    ev(tid, "unlock(); 1")
    st = lambda: evj(tid, "__T.state()")
    item = lambda s, k: next(i for i in s["items"] if i["k"] == k)

    # ------------------------------------------------------------- 断言 ③⑥
    # 放在最前面跑：只有这一段依赖真实时钟（1.7s 长按 + 出门 4.2s + 换场）。
    # 后台 tab 隐藏满 5 分钟后 Chrome 会上 intensive throttling，把 timer 对齐到分钟级，
    # 这一段要是排在最后就会随机超时——排最前面，跑在那 5 分钟窗口里。
    print("③ 按依赖全部做完 → leaving；⑥ 下一轮全部计数归零")
    ev(tid, "__T.reset(); 1")
    # 先把这一轮弄脏：顺序错两次（留 glow）+ 拖偏一次（留 miss），下一轮必须全清
    ev(tid, "__T.drag('shoe'); __T.drag('shoe'); __T.dragAway('shirt'); 1")
    s = st()
    check("脏状态已造出（glow + miss 都非空）",
          s["glowKeys"] and item(s, "shirt")["miss"] == 1,
          f"glow={s['glowKeys']} shirt.miss={item(s,'shirt')['miss']}")

    gear = s["gear"]
    for k in ["shirt", "sock", "shoe"]:
        ev(tid, f"__T.drag('{k}'); 1")
    # 奶瓶：真长按（阈值 1700ms，后台 tab 里 timer 粗化到 1s 粒度，给足余量）
    t0 = time.time()
    ev(tid, "__T.holdDown(); 1")
    ok = wait_until(lambda: item(st(), "bottle")["done"], timeout=40)
    ev(tid, "__T.holdUp(); 1")
    check("长按 1.7s 把奶喝完", ok,
          f"{time.time()-t0:.1f}s / visibility={ev(tid, 'document.visibilityState')}")
    s = st()
    check("奶喝完了毛巾才解锁", item(s, "bottle")["done"])
    ev(tid, "__T.drag('towel'); 1")
    s = st()
    check("奶喝完后毛巾能用", item(s, "towel")["done"])
    ev(tid, f"__T.drag('{gear}'); 1")
    ev(tid, "__T.tap('car'); 1")
    check("全部按依赖做完 → 进入 leaving",
          wait_until(lambda: st()["phase"] == "leaving", timeout=20),
          f"phase={st()['phase']}")

    # 等它自己开出门 + 换下一个宝宝
    ok = wait_until(lambda: st()["phase"] == "play", timeout=60)
    check("自动进入下一轮", ok, f"phase={st()['phase']}")
    s = st()
    dirty = [i for i in s["items"]
             if i["done"] or i["miss"] or i["block"] or i["assist"] or i["glow"] or i["gone"]]
    check("下一轮 done / miss / blockMiss / assist / glow / gone 全部归零",
          not dirty, json.dumps(dirty, ensure_ascii=False)[:400])
    check("wrongGearMiss / finished 一并归零",
          s["wrongGearMiss"] == 0 and not s["finished"],
          f"wrongGearMiss={s['wrongGearMiss']} finished={s['finished']}")
    check("glowKeys 集合清空", s["glowKeys"] == [], f"glow={s['glowKeys']}")

    # ---------------------------------------------------------------- 断言 ④
    print("\n④ 早点小车 → 不进 leaving")
    ev(tid, "__T.reset(); 1")
    ev(tid, "__T.tap('car'); 1")
    s = st()
    check("车按早了不算完成", not item(s, "car")["done"], f"car.done={item(s,'car')['done']}")
    check("相位仍是 play", s["phase"] == "play", f"phase={s['phase']}")
    check("记的是 blockMiss 不是 miss",
          item(s, "car")["block"] == 1 and item(s, "car")["miss"] == 0,
          f"block={item(s,'car')['block']} miss={item(s,'car')['miss']}")
    ev(tid, "__T.tap('car'); 1")
    s = st()
    check("车按早第 2 次 → 没做完的全部发光",
          len(s["glowKeys"]) >= 5 and all(item(s, k)["glow"] for k in s["glowKeys"]),
          f"glow={s['glowKeys']}")

    # ------------------------------------------------------------- 断言 ①②
    print("\n①② 袜子之前拖鞋子")
    ev(tid, "__T.reset(); 1")
    ev(tid, "__T.drag('shoe'); 1")
    s = st()
    check("鞋子没穿上（状态不变）", not item(s, "shoe")["done"])
    check("袜子也没被顺手做掉", not item(s, "sock")["done"])
    check("鞋子滑回原位（back / sway，无 done 类）",
          "done" not in item(s, "shoe")["cls"], item(s, "shoe")["cls"])
    check("blockMiss=1 且没进 miss（顺序错不喂给 assist）",
          item(s, "shoe")["block"] == 1 and item(s, "shoe")["miss"] == 0)
    check("第 1 次不发光", not item(s, "sock")["glow"])
    ev(tid, "__T.drag('shoe'); 1")
    s = st()
    check("同一步第 2 次错 → 袜子出现 glow class", item(s, "sock")["glow"],
          f"itSock class = {item(s,'sock')['cls']}")
    check("发光的只有袜子这一件", s["glowKeys"] == ["sock"], f"glow={s['glowKeys']}")
    # 阻塞态下狂拖也不许被 assist 替他做掉（一代抄 basket 时踩的那个前提）
    ev(tid, "for (var i = 0; i < 6; i++) __T.dragAway('shoe'); 1")
    s = st()
    check("前置没满足时，拖偏 6 次也不会被替他穿上",
          not item(s, "shoe")["done"] and not item(s, "shoe")["assist"],
          f"done={item(s,'shoe')['done']} assist={item(s,'shoe')['assist']}")
    ev(tid, "__T.drag('sock'); 1")
    s = st()
    check("袜子穿上后光就灭了", not item(s, "sock")["glow"] and s["glowKeys"] == [])
    ev(tid, "__T.drag('shoe'); 1")
    s = st()
    check("袜子在，鞋子就穿得上了", item(s, "shoe")["done"])

    # ---------------------------------------------------------------- 断言 ⑤
    print("\n⑤ 下雨天：帽子滑回、雨伞完成")
    w = ev(tid, "__T.forceWeather('rain')")
    check("能摆出下雨的一轮", w == "rain", f"weather={w}")
    ev(tid, "__T.drag('cap'); 1")
    s = st()
    check("下雨拖帽子 → 没戴上", not item(s, "cap")["done"])
    check("算的是 wrongGearMiss", s["wrongGearMiss"] == 1)
    ev(tid, "__T.drag('cap'); 1")
    s = st()
    check("拿错第 2 次 → 雨伞发光", item(s, "umbrella")["glow"], f"glow={s['glowKeys']}")
    ev(tid, "__T.drag('umbrella'); 1")
    s = st()
    check("拖雨伞 → 完成", item(s, "umbrella")["done"])
    check("选对之后帽子退场", item(s, "cap")["gone"])
    # 反向：大晴天该戴帽子
    w = ev(tid, "__T.forceWeather('sun')")
    ev(tid, "__T.drag('umbrella'); 1")
    s = st()
    check("大晴天拖雨伞 → 没拿上", not item(s, "umbrella")["done"], f"weather={w}")
    ev(tid, "__T.drag('cap'); 1")
    s = st()
    check("大晴天拖帽子 → 戴上", item(s, "cap")["done"])

    # ------------------------------- 断言 ⑧：天气不对的那件，攒再多 miss 也不上手
    # 这是 assist 的第二个前提（第一个是 unmet）：拖偏只是手上没做好，
    # 不代表「这一轮该拿它」——只挡 unmet 不挡 isActive，晴天拖偏三次伞就塞手里了
    print("\n⑧ 干扰项拖偏再多次也不会被替他做掉")
    for w, decoy, right in [("sun", "umbrella", "cap"), ("rain", "cap", "umbrella")]:
        got = ev(tid, f"__T.forceWeather('{w}')")
        ev(tid, f"for (var i = 0; i < 6; i++) __T.dragAway('{decoy}'); 1")
        s = st()
        d = item(s, decoy)
        check(f"{w} 天把 {decoy} 拖偏 6 次 → 不上手、没被 assist",
              not d["done"] and not d["assist"],
              f"weather={got} done={d['done']} assist={d['assist']} miss={d['miss']}")
        check(f"{w} 天拖偏 {decoy} 不算「拿错」（没碰宝宝）", s["wrongGearMiss"] == 0,
              f"wrongGearMiss={s['wrongGearMiss']}")
        check(f"{w} 天该拿的 {right} 一点没被带累", not item(s, right)["done"])

    # ------------------- 断言 ⑨：长按被系统收走手势，不算他没按住
    print("\n⑨ 长按中途被 pointercancel，不记账")
    ev(tid, "__T.reset(); 1")
    ev(tid, "__T.holdDown(); 1")
    time.sleep(0.5)
    check("长按已经起来了（holding 类在）",
          "holding" in item(st(), "bottle")["cls"], item(st(), "bottle")["cls"])
    ev(tid, "__T.holdCancel(); 1")
    s = st()
    b = item(s, "bottle")
    check("系统收走手势 → bottle.miss 不变（仍是 0）", b["miss"] == 0, f"miss={b['miss']}")
    check("也没顺手把奶替他喝完", not b["done"])
    check("视觉收住了（holding 类已摘）", "holding" not in b["cls"], b["cls"])
    # 反面对照：真的是他自己松手太早，还是要记一笔
    ev(tid, "__T.holdDown(); 1")
    time.sleep(0.4)
    ev(tid, "__T.holdUp(); 1")
    check("他自己松手太早 → 照常记一次没成", item(st(), "bottle")["miss"] == 1,
          f"miss={item(st(),'bottle')['miss']}")

    # --------------------- 断言 ⑩：手一直没离开屏幕，中间换了宝宝
    # 拖到一半换轮是真会发生的（他抓着东西不放，上一轮自己走完了出门流程）。
    # 闭包里的 dragging/ptr 不认代次的话，这一把会落进新一轮的账上
    print("\n⑩ 拖到一半换了宝宝：这一把作废，不记进新一轮")
    ev(tid, "__T.reset(); 1")
    ev(tid, "__T.dragStart('shirt'); 1")
    ev(tid, "__T.reset(); 1")            # 手还按着，换了一轮
    ev(tid, "__T.dragFinish('shirt'); 1")
    s = st()
    sh = item(s, "shirt")
    check("上一轮那一把不算数：衣服没被穿上", not sh["done"], f"done={sh['done']}")
    check("也没记进新一轮的 miss", sh["miss"] == 0, f"miss={sh['miss']}")
    check("视觉收回原位（lift 已摘、回到 sway）",
          "lift" not in sh["cls"] and "sway" in sh["cls"], sh["cls"])
    ev(tid, "__T.drag('shirt'); 1")
    check("换轮后重新拖一次照常成功", item(st(), "shirt")["done"])

    # ------------- 断言 ⑪：能做的那件正握在他手里时，戳喇叭也得有反馈
    print("\n⑪ 无事可指时戳喇叭仍有反馈（每次输入必反馈）")
    ev(tid, "__T.reset(); 1")
    gear2 = st()["gear"]
    for k in ["shirt", "sock", "shoe", gear2]:
        ev(tid, f"__T.drag('{k}'); 1")
    time.sleep(0.8)
    ev(tid, "__T.holdDown(); 1")          # 唯一还能做的那件被他自己按着
    time.sleep(0.2)
    ev(tid, "document.getElementById('win').classList.remove('tell'); 1")
    ev(tid, "__T.horn(); 1")
    check("todo 为空时戳喇叭 → 窗户弹一下（不是死的）",
          "tell" in ev(tid, "__T.winCls()"), ev(tid, "__T.winCls()"))
    ev(tid, "__T.holdUp(); 1")
    # 对照：有事可指时走的是「点亮那件东西」，不弹窗户
    ev(tid, "__T.reset(); 1")
    ev(tid, "document.getElementById('win').classList.remove('tell'); 1")
    ev(tid, "__T.horn(); 1")
    check("有事可指时戳喇叭 → 点亮东西、不弹窗户",
          "tell" not in ev(tid, "__T.winCls()") and
          any("flash" in i["cls"] for i in st()["items"]),
          ev(tid, "__T.winCls()") + " / " + str([i["cls"] for i in st()["items"]]))

    # ---------------------------------------------------------------- 断言 ⑦
    print("\n⑦ 两根手指同时按两件东西")
    ev(tid, "__T.reset(); 1")
    before = len(http_get(f"/console?target={tid}&level=error").get("entries", []) or [])
    ev(tid, """
      __T.el('shirt').dispatchEvent(__T.mk('pointerdown', 40, 40, 11));
      __T.el('sock').dispatchEvent(__T.mk('pointerdown', 60, 60, 12));
      __T.holdDown(13);
      __T.holdDown(14);
      __T.el('shirt').dispatchEvent(__T.mk('pointermove', 80, 80, 11));
      __T.el('sock').dispatchEvent(__T.mk('pointermove', 90, 90, 12));
      __T.el('sock').dispatchEvent(__T.mk('pointerup', 90, 90, 12));
      __T.el('shirt').dispatchEvent(__T.mk('pointerup', 80, 80, 11));
      __T.holdUp(14);
      __T.holdUp(13);
      'ok'
    """)
    errs = http_get(f"/console?target={tid}&level=error").get("entries", []) or []
    new_errs = errs[before:]
    check("多指并发无 TypeError / 未捕获异常", not new_errs, json.dumps(new_errs, ensure_ascii=False)[:300])

    # ------------------------------------------------ 顺带：键盘那一路也守依赖
    # 三输入都通是台上的底线；键盘短按是「替他做下一件」，最容易被写成绕过顺序的后门
    print("\n（顺带）键盘短按也守依赖，不给绕过顺序的后门")
    ev(tid, "__T.reset(); 1")
    gear = st()["gear"]
    for _ in range(4):
        ev(tid, "__T.key(); 1")
        time.sleep(0.15)
    s = st()
    check("键盘 4 下 → 衣服/袜子/鞋子/天气那件按依赖顺序做完",
          all(item(s, k)["done"] for k in ["shirt", "sock", "shoe", gear]),
          str([(i["k"], i["done"]) for i in s["items"]]))
    check("毛巾没被键盘跳过奶瓶做掉", not item(s, "towel")["done"])
    check("小车没被键盘提前点掉", not item(s, "car")["done"])
    ev(tid, "__T.key(); 1")
    s = st()
    check("没有可做的非长按步骤时，短按记到奶瓶的 miss 上",
          item(s, "bottle")["miss"] == 1 and not item(s, "towel")["done"],
          f"bottle.miss={item(s,'bottle')['miss']}")

    # ------------------------------------------------------- 顺带：布局不打架
    # 每种屏幕连量 3 轮：位置是每轮打乱的，量一轮只能证明这一次的随机排布没撞上
    print("\n（顺带）八件东西三种屏幕都摆得开、且不压在喇叭热区下（各 3 轮随机排布）")
    for label, w, h in [("iPad 横屏", 1194, 834), ("iPad 竖屏", 768, 1024), ("iPhone 竖屏", 390, 844)]:
        http_post(f"/emulate?target={tid}",
                  json.dumps({"width": w, "height": h, "deviceScaleFactor": 2}), tolerate=True)
        time.sleep(0.6)
        wh = ev(tid, 'innerWidth + "x" + innerHeight')
        check(f"{label} viewport 已切到 {w}x{h}", wh == f"{w}x{h}", str(wh))
        over, out, on_baby, on_zone = [], [], [], []
        for _ in range(3):
            ev(tid, "__T.reset(); 1")     # 重新摆一轮，量的是刚发下来的干净排布
            b = evj(tid, LAYOUT_PROBE)
            over += b["over"]; out += b["out"]; on_baby += b["onBaby"]; on_zone += b["onZone"]
        check(f"{label} 八件互不重叠", not over, str(sorted(set(over))))
        check(f"{label} 八件都在屏内", not out, str(sorted(set(out))))
        check(f"{label} 不压到宝宝身上", not on_baby, str(sorted(set(on_baby))))
        check(f"{label} 不压在喇叭 / 窗户底下（它们 z-index 更高，会抢走这一戳）",
              not on_zone, str(sorted(set(on_zone))))
    http_post(f"/emulate?target={tid}", json.dumps({"reset": True}), tolerate=True)


LAYOUT_PROBE = """(function(){
  // 用 offsetLeft/Top（布局坐标）不用 getBoundingClientRect：后台 tab 不渲染，
  // 一条已经开始的 transition 会永远停在起点，computed transform 里留着一个假位移——
  // 拿它量排布会得到根本不存在的「重叠」。这里量的是槽位本身，与任何 transform 无关。
  var box = function (e) { return { l: e.offsetLeft, t: e.offsetTop,
                                    r: e.offsetLeft + e.offsetWidth,
                                    b: e.offsetTop + e.offsetHeight }; };
  var rs = ITEMS.map(function (i) { var o = box(i.el); o.k = i.key; return o; });
  var baby = box(document.getElementById('baby'));
  var over = [];
  for (var a = 0; a < rs.length; a++) for (var b2 = a + 1; b2 < rs.length; b2++) {
    var x = rs[a], y = rs[b2];
    if (x.l < y.r && y.l < x.r && x.t < y.b && y.t < x.b) over.push(x.k + '×' + y.k);
  }
  var f = document.getElementById('field');
  var out = rs.filter(function (x) { return x.l < 0 || x.t < 0 ||
    x.r > f.clientWidth || x.b > f.clientHeight; }).map(function (x) { return x.k; });
  var onBaby = rs.filter(function (x) { return x.l < baby.r && baby.l < x.r &&
    x.t < baby.b && baby.t < x.b; }).map(function (x) { return x.k; });
  // .ask（z-index 30）和 .window（可点）盖在东西上面就等于把那一戳抢走了：
  // 娃伸手去拿右上角那件，拿到的是一句语音提示
  // 这两个热区从不被拖动，所以可以放心用 rect（它们的居中靠 translateX(-50%)，
  // offsetLeft 读不到那一半位移，拿 offset 量会算出根本不存在的重叠）
  var fr = document.getElementById('field').getBoundingClientRect();
  var zbox = function (e) { var r = e.getBoundingClientRect();
    return { l: r.left - fr.left, t: r.top - fr.top,
             r: r.right - fr.left, b: r.bottom - fr.top }; };
  var zones = [['ask', zbox(document.getElementById('ask'))],
               ['win', zbox(document.getElementById('win'))]];
  var onZone = [];
  rs.forEach(function (x) {
    zones.forEach(function (z) {
      var q = z[1];
      if (x.l < q.r && q.l < x.r && x.t < q.b && q.t < x.b) onZone.push(x.k + '×' + z[0]);
    });
  });
  return JSON.stringify({over: over, out: out, onBaby: onBaby, onZone: onZone});
})()"""


if __name__ == "__main__":
    sys.exit(main())
