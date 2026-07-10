// Twirlywoos 舞台公共层（v0.11 加）
// 对照 BBC 节目剧照两个经典场景：
//   场景 A（idle 木板墙 + 树影台）：白色竖纹木墙 + 飘动树影 + 米白台
//   场景 B（红船切口）：场景 A 之上叠红色船 + 切口里露出风景（蓝天/沙漠/海/草地）
//
// 使用：
//   <link rel="stylesheet" href="...">  不需要，CSS 内联注入
//   <script src="../_lib/stage.js"></script>
//   TW.Stage.mount({ withShip: true, scene: 'sky' })  // scene 省略=随机
//
// 输出 DOM 结构（注入到 body 末尾，固定在屏幕底层 z=-10）：
//   <div class="tw-stage">
//     <div class="tw-stage-shadows"></div>    <!-- 树影飘动层 -->
//     <div class="tw-ship">                   <!-- 仅 withShip 时 -->
//       <div class="tw-ship-scene tw-scene-{sky|desert|sea|grass}"></div>
//     </div>
//   </div>

(function () {
  if (!window.TW) {
    // 直接终止——不 return 的话文件尾 TW.Stage 赋值照样 ReferenceError，warn 变自相矛盾的死防御
    console.warn('[stage.js] TW global not found; load twirlywoos.js first.');
    return;
  }

  const STAGE_CSS = `
  /* ========== 木板墙底（场景 A 公共底） ========== */
  .tw-stage {
    position: fixed;
    inset: 0;
    z-index: -10;
    pointer-events: none;
    overflow: hidden;
    /* 米白木板墙：竖向条纹 + 微暖 */
    background:
      /* 木板分隔细线（窄而柔，每 80px 一条） */
      repeating-linear-gradient(
        90deg,
        rgba(0, 0, 0, 0) 0px,
        rgba(0, 0, 0, 0) 78px,
        rgba(150, 130, 105, 0.18) 78px,
        rgba(150, 130, 105, 0.18) 80px
      ),
      /* 顶部光晕（暖白渐暗） */
      linear-gradient(180deg,
        #fdf6ea 0%,
        #f6ecd8 55%,
        #ebd9b6 100%);
  }

  /* 台面（屏幕下方 18% 高，更白略平） */
  .tw-stage::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 18%;
    background: linear-gradient(180deg,
      #fff9ec 0%,
      #f7eede 100%);
    box-shadow: 0 -3px 8px rgba(120, 90, 50, 0.08);
  }

  /* 树影飘动层（叠在木墙上，mix-blend-mode 让影子贴自然）
     动画在内层 ::before 上动 transform（可合成，零重绘）——
     此前直接动 background-position 是非合成属性，游玩全程每帧全屏 paint */
  .tw-stage-shadows {
    position: absolute;
    inset: 0;
    overflow: hidden;
    opacity: 0.22;
    mix-blend-mode: multiply;
  }
  .tw-stage-shadows::before {
    content: '';
    position: absolute;
    left: 0; top: 0;
    width: 140%; height: 140%;
    /* feTurbulence 生成的斑驳深色噪点 */
    background-image: var(--tw-shadow-url);
    background-size: 100% 100%;
    animation: tw-shadows-drift 24s ease-in-out infinite;
    will-change: transform;
  }
  @keyframes tw-shadows-drift {
    0%, 100% { transform: translate(0, 0); }
    50%      { transform: translate(-3%, -1.5%); }
  }

  /* ========== 红船切口（场景 B 增量） ========== */
  .tw-ship {
    position: absolute;
    /* 屏幕左侧偏下，约 1/3 宽 */
    left: 4%;
    bottom: 18%;       /* 紧贴台面顶 */
    width: 34%;
    max-width: 520px;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    /* 红船墙：砖红 + 微纹理感（同色 radial 暗角） */
    background:
      radial-gradient(ellipse 90% 110% at 50% 40%,
        #c14a32 0%,
        #a13822 60%,
        #7a2818 100%);
    border-radius: 4px 4px 0 0;
    box-shadow:
      inset 0 -6px 12px rgba(0, 0, 0, 0.25),
      0 4px 16px rgba(60, 20, 10, 0.2);
  }

  /* 船切口（梯形开口，左下角往内切开露出风景） */
  .tw-ship-scene {
    position: absolute;
    /* 切口位置：船左侧约 60% 宽 + 下方 80% 高的梯形 */
    left: 0;
    top: 18%;
    width: 70%;
    height: 82%;
    /* 不规则梯形切口（左侧倾斜往里收，模拟船舱内陷感） */
    clip-path: polygon(
      18% 0%,
      100% 0%,
      100% 100%,
      0% 100%
    );
    overflow: hidden;
  }

  /* 4 种风景（用纯 CSS gradient + ::before/::after 元素，无图片） */
  .tw-scene-sky {
    background: linear-gradient(180deg,
      #7ec0ee 0%,
      #b8dff4 55%,
      #e8e8c8 75%,
      #d4a878 100%);
  }
  .tw-scene-sky::before {
    /* 一朵蓬松白云 */
    content: '';
    position: absolute;
    top: 22%; left: 30%;
    width: 50%;
    height: 18%;
    background:
      radial-gradient(circle at 25% 60%, #fff 0 38%, transparent 40%),
      radial-gradient(circle at 55% 50%, #fff 0 44%, transparent 46%),
      radial-gradient(circle at 80% 60%, #fff 0 32%, transparent 34%);
    filter: blur(2px);
    opacity: 0.95;
  }

  .tw-scene-desert {
    background: linear-gradient(180deg,
      #fff4d8 0%,
      #f6d28a 45%,
      #d68a4e 100%);
  }
  .tw-scene-desert::before {
    /* 远处沙丘 */
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 38%;
    background:
      radial-gradient(ellipse 50% 100% at 30% 100%, #b86a3a 0 50%, transparent 52%),
      radial-gradient(ellipse 60% 100% at 80% 100%, #a05a30 0 50%, transparent 52%);
  }
  .tw-scene-desert::after {
    /* 太阳 */
    content: '';
    position: absolute;
    top: 18%; right: 22%;
    width: 16%; aspect-ratio: 1;
    background: radial-gradient(circle, #fff5c8 0 50%, #fcd96b 70%, transparent 75%);
    border-radius: 50%;
  }

  .tw-scene-sea {
    background: linear-gradient(180deg,
      #b6e3f4 0%,
      #6fb8d8 35%,
      #3a86b4 70%,
      #1e5e87 100%);
  }
  .tw-scene-sea::before {
    /* 海平面波浪 */
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 55%;
    background:
      repeating-linear-gradient(180deg,
        transparent 0 8%,
        rgba(255, 255, 255, 0.1) 8% 10%,
        transparent 10% 20%);
  }

  .tw-scene-grass {
    background: linear-gradient(180deg,
      #b0d7f0 0%,
      #d8e8c0 40%,
      #8bbe5c 60%,
      #5a9938 100%);
  }
  .tw-scene-grass::before {
    /* 远山 */
    content: '';
    position: absolute;
    bottom: 35%; left: 0; right: 0;
    height: 20%;
    background:
      radial-gradient(ellipse 40% 100% at 20% 100%, #6a8c5a 0 50%, transparent 52%),
      radial-gradient(ellipse 50% 100% at 70% 100%, #5a7c4a 0 50%, transparent 52%);
  }

  /* ========== idle 角色排（瘫倒态/站立切换） ========== */
  .tw-idle-cast {
    position: fixed;
    z-index: -5;
    left: 0; right: 0;
    bottom: 4%;      /* 落在台面上 */
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 1.5%;
    padding: 0 6%;
    pointer-events: none;
  }
  .tw-idle-cast .tw-idle-bird {
    height: 22vh;
    aspect-ratio: 200 / 270;
    transition: transform 1200ms cubic-bezier(0.34, 1.4, 0.64, 1),
                opacity 800ms ease;
    will-change: transform;
  }
  .tw-idle-cast .tw-idle-bird svg {
    width: 100%;
    height: 100%;
    display: block;
    filter: drop-shadow(0 5px 0 rgba(0, 0, 0, 0.08));
  }
  /* 体型梯度：站立时按真实大小排 */
  .tw-idle-cast .tw-idle-bird[data-char="bighoo"]   { height: 26vh; }
  .tw-idle-cast .tw-idle-bird[data-char="toodloo"]  { height: 22vh; }
  .tw-idle-cast .tw-idle-bird[data-char="chickedy"] { height: 15vh; }
  .tw-idle-cast .tw-idle-bird[data-char="chick"]    { height: 13vh; }

  /* 标题（小字隐在顶部，不抢焦） */
  .tw-stage-title {
    position: fixed;
    top: 22px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 14px;
    letter-spacing: 0.45em;
    color: rgba(80, 50, 30, 0.35);
    text-transform: uppercase;
    font-weight: 400;
    pointer-events: none;
    z-index: 5;
  }
  `;

  // 树影斑驳：feTurbulence 生成噪点 → 转 data URL（CSS background-image 引用）
  // 浏览器原生支持 SVG data URL，比插入 <svg> + filter 灵活
  const SHADOW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <defs>
      <filter id="leaves" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="7"/>
        <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0 0.1  0 0 0 1 -0.3"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" filter="url(#leaves)"/>
  </svg>`;
  const SHADOW_DATA_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(SHADOW_SVG);

  const SCENES = ['sky', 'desert', 'sea', 'grass'];

  function injectCSSOnce() {
    if (document.getElementById('tw-stage-css')) return;
    const style = document.createElement('style');
    style.id = 'tw-stage-css';
    style.textContent = STAGE_CSS;
    document.head.appendChild(style);
    document.documentElement.style.setProperty('--tw-shadow-url', `url("${SHADOW_DATA_URL}")`);
  }

  // 挂载舞台底层
  // opts:
  //   withShip   - 是否带红船切口（默认 false，纯木墙台面）
  //   scene      - 'sky' | 'desert' | 'sea' | 'grass' | undefined (随机)
  //   title      - 顶部小字（默认 undefined 不显示）
  function mount(opts = {}) {
    injectCSSOnce();
    const stage = document.createElement('div');
    stage.className = 'tw-stage';

    // 树影飘动层
    const shadows = document.createElement('div');
    shadows.className = 'tw-stage-shadows';
    stage.appendChild(shadows);

    // 红船切口（可选）
    if (opts.withShip) {
      const ship = document.createElement('div');
      ship.className = 'tw-ship';
      const scene = opts.scene || SCENES[Math.floor(Math.random() * SCENES.length)];
      const sceneEl = document.createElement('div');
      sceneEl.className = `tw-ship-scene tw-scene-${scene}`;
      ship.appendChild(sceneEl);
      stage.appendChild(ship);
    }

    document.body.appendChild(stage);

    if (opts.title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'tw-stage-title';
      titleEl.textContent = opts.title;
      document.body.appendChild(titleEl);
    }

    return stage;
  }

  // 挂载首页 idle 角色排（瘫倒/站立切换）
  // 30s 无操作自动切 lying，任意触屏复活
  function mountIdleCast(opts = {}) {
    if (!window.TW || !TW.svg) return null;
    const cast = document.createElement('div');
    cast.className = 'tw-idle-cast';

    // 4 角色按真实排序：唧唧 / 啾啾在前（最小），红涂涂 / 蓝呼呼在后
    const order = ['chick', 'chickedy', 'toodloo', 'bighoo'];
    order.forEach(ck => {
      const bird = document.createElement('div');
      bird.className = 'tw-idle-bird';
      bird.dataset.char = ck;
      bird.innerHTML = TW.svg(ck, { expression: 'idle', noFilter: true });
      cast.appendChild(bird);
    });
    document.body.appendChild(cast);

    // 瘫倒切换
    let lyingTimer = null;
    let isLying = false;
    const idleMs = opts.idleMs || 30000;

    function setLying(lying) {
      if (lying === isLying) return;
      isLying = lying;
      const birds = cast.querySelectorAll('.tw-idle-bird');
      birds.forEach(b => {
        const ck = b.dataset.char;
        b.innerHTML = TW.svg(ck, { expression: lying ? 'lying' : 'idle', noFilter: true });
      });
    }

    function scheduleSleep() {
      if (lyingTimer) clearTimeout(lyingTimer);
      lyingTimer = setTimeout(() => setLying(true), idleMs);
    }
    function wake() {
      setLying(false);
      scheduleSleep();
    }

    // 触屏/鼠标/键盘任意活动 → 唤醒
    ['pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, wake, { passive: true });
    });
    scheduleSleep();

    return cast;
  }

  TW.Stage = {
    mount,
    mountIdleCast,
    SCENES,
  };
})();
