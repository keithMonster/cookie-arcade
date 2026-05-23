// Twirlywoos 4 角色共享组件
// 形象抓手：圆胖蛋身 + 头顶 3 根橙色羽毛 + 大黑眼 + 橙色喙 + 橙色 stick 脚
// 五款 tw-* 游戏共用：window.TW.svg / playCall / playOooo / playCheer / CHARS

(function () {
  const FEATHER_LIGHT = '#ff8c1a';
  const FEATHER_DARK = '#e06600';
  const BEAK = '#ff8c00';
  const BEAK_DARK = '#c46100';
  const FEET = '#ff8c00';
  const OUTLINE = '#3a2410';

  // 颜色变暗 / 变亮工具
  function darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 255) * (1 - amt)) | 0;
    const g = Math.max(0, ((n >> 8) & 255) * (1 - amt)) | 0;
    const b = Math.max(0, (n & 255) * (1 - amt)) | 0;
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const lr = ch => Math.min(255, ch + (255 - ch) * amt) | 0;
    const r = lr((n >> 16) & 255);
    const g = lr((n >> 8) & 255);
    const b = lr(n & 255);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  // 4 角色：颜色（接近节目里的绒毛质感色）+ 体型梯度 + 中文小名 + 叫声配置
  const CHARS = {
    bighoo: {
      key: 'bighoo',
      name: '蓝呼呼',                 // 官方中文译名
      body: '#3a6dc7',          // 钴蓝偏柔
      belly: '#f0e0b8',         // 米奶色
      sizeRatio: 1.0,
      // 低沉 Hooo——sine 低频上滑
      call: { kind: 'tone', wave: 'sine', f0: 180, f1: 240, dur: 0.55, vol: 0.32 },
    },
    toodloo: {
      key: 'toodloo',
      name: '红涂涂',                 // 官方中文译名
      body: '#d8442e',          // 偏橙的红
      belly: '#f0e0b8',
      sizeRatio: 0.78,
      // Too-dloo——两个 note
      call: { kind: 'twoNote', wave: 'triangle', f0: 380, f1: 320, dur: 0.42, vol: 0.28 },
    },
    chickedy: {
      key: 'chickedy',
      name: '唧唧',                   // 官方中文译名
      body: '#f0b020',          // 暖金黄
      belly: '#fff2c8',
      sizeRatio: 0.6,
      // 短促 Chic-ke-dy——三个 16th
      call: { kind: 'tripletChirp', wave: 'square', f0: 720, dur: 0.35, vol: 0.18 },
    },
    chick: {
      key: 'chick',
      name: '啾啾',                   // 官方中文译名
      body: '#ffd84a',          // 奶油浅黄
      belly: '#fff6dc',
      sizeRatio: 0.48,
      // 一个高 Chic
      call: { kind: 'pip', wave: 'square', f0: 1050, dur: 0.16, vol: 0.16 },
    },
  };
  const CHAR_LIST = ['bighoo', 'toodloo', 'chickedy', 'chick'];

  // ===== SVG 角色生成 =====
  // expression: 'idle' | 'surprised' | 'cheer'
  // 设计还原点：
  // ① 身体 squat 不倒翁/葫芦形（上窄下宽），不是椭圆蛋形
  // ② 眼睛靠近脸中央（间距 24），不是分两边
  // ③ 眼睛上方有眼皮线（idle/cheer），surprised 时眼皮线消失露出大圆睁眼
  // ④ 头顶 3 根橙刺羽毛错落（中央长直、左右斜短），主羽颜色更深
  // ⑤ 手臂是短杆 + 圆球末端（stroke-linecap=round），不是椭圆色块
  // ⑥ 喙在两眼正中下方，小三角实心橙
  // ⑦ 脚是橙细 stick + 末端三趾鸡爪
  // ⑧ 身体加细纹（毛绒质感）+ 主体描边（毡感）
  function svg(charKey, opts = {}) {
    const c = CHARS[charKey];
    if (!c) return '';
    const expr = opts.expression || 'idle';
    // noFilter: true → 跳过 feTurbulence + feDisplacementMap，节省 GPU
    // 适用：首页 preview / 数量多的角色排 / 移动设备性能不足时
    const noFilter = !!opts.noFilter;
    const bodyStroke = darken(c.body, 0.22);
    const bellyStroke = darken(c.belly, 0.12);

    // ===== 眼区（眼皮 + 眼睛）=====
    // 位置上移到脸 1/3 (cy=92)，更接近 Twirlywoos 真实
    let eyeArea;
    if (expr === 'cheer') {
      // 笑眼：弯月形
      eyeArea = `
        <path d="M76 90 Q88 100 100 90" fill="none" stroke="${OUTLINE}" stroke-width="4" stroke-linecap="round"/>
        <path d="M100 90 Q112 100 124 90" fill="none" stroke="${OUTLINE}" stroke-width="4" stroke-linecap="round"/>
      `;
    } else if (expr === 'surprised') {
      // 圆睁眼睛（更大、无眼皮线）
      eyeArea = `
        <circle cx="88" cy="92" r="14" fill="${OUTLINE}"/>
        <circle cx="112" cy="92" r="14" fill="${OUTLINE}"/>
        <circle cx="91" cy="87" r="4" fill="#fff"/>
        <circle cx="115" cy="87" r="4" fill="#fff"/>
      `;
    } else {
      // idle：眼皮线 + 圆眼带高光
      eyeArea = `
        <path d="M78 82 Q88 75 98 82" fill="none" stroke="${OUTLINE}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M102 82 Q112 75 122 82" fill="none" stroke="${OUTLINE}" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="88" cy="94" r="11" fill="${OUTLINE}"/>
        <circle cx="112" cy="94" r="11" fill="${OUTLINE}"/>
        <circle cx="91" cy="90" r="3.5" fill="#fff"/>
        <circle cx="115" cy="90" r="3.5" fill="#fff"/>
      `;
    }

    // ===== 喙（位于眼睛下方 30px ≈ cy=120）=====
    let mouth;
    if (expr === 'surprised') {
      // 上下两半喙合成菱形张开嘴
      mouth = `
        <path d="M88 117 L100 124 L112 117 L100 113 Z" fill="${BEAK}" stroke="${BEAK_DARK}" stroke-width="1"/>
        <path d="M88 124 L100 134 L112 124 L100 120 Z" fill="${BEAK_DARK}" stroke="${darken(BEAK_DARK, 0.2)}" stroke-width="1"/>
      `;
    } else if (expr === 'cheer') {
      // 张大笑：上喙翘 + 下方笑弧
      mouth = `
        <path d="M88 115 L100 110 L112 115 L100 122 Z" fill="${BEAK}" stroke="${BEAK_DARK}" stroke-width="1"/>
        <path d="M82 128 Q100 148 118 128" fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="2"/>
      `;
    } else {
      // 小三角喙
      mouth = `<path d="M91 114 L100 130 L109 114 Z" fill="${BEAK}" stroke="${BEAK_DARK}" stroke-width="1"/>`;
    }

    // ===== 手臂（短杆 + 圆球末端，用 stroke-linecap=round 实现）=====
    let armL, armR;
    if (expr === 'cheer') {
      // 上举庆祝
      armL = `<line x1="48" y1="100" x2="18" y2="40" stroke="${c.body}" stroke-width="22" stroke-linecap="round"/>`;
      armR = `<line x1="152" y1="100" x2="182" y2="40" stroke="${c.body}" stroke-width="22" stroke-linecap="round"/>`;
    } else if (expr === 'surprised') {
      // 略微抬起
      armL = `<line x1="40" y1="155" x2="8" y2="135" stroke="${c.body}" stroke-width="22" stroke-linecap="round"/>`;
      armR = `<line x1="160" y1="155" x2="192" y2="135" stroke="${c.body}" stroke-width="22" stroke-linecap="round"/>`;
    } else {
      // idle 自然垂下偏外
      armL = `<line x1="38" y1="170" x2="14" y2="200" stroke="${c.body}" stroke-width="22" stroke-linecap="round"/>`;
      armR = `<line x1="162" y1="170" x2="186" y2="200" stroke="${c.body}" stroke-width="22" stroke-linecap="round"/>`;
    }

    // 立体明暗渐变 ID（每角色独立避免冲突）
    const gradId = `g-${charKey}-${Math.random().toString(36).slice(2, 8)}`;
    const fluffId = `f-${charKey}-${Math.random().toString(36).slice(2, 8)}`;
    const bodyLight = lighten(c.body, 0.18);
    const bodyDeep = darken(c.body, 0.15);
    const bellyLight = lighten(c.belly, 0.06);

    // 仅在需要时插入 filter 引用（noFilter=true 时省去 GPU 开销）
    const filterAttr = noFilter ? '' : `filter="url(#${fluffId})"`;
    const filterDef = noFilter ? '' : `
        <filter id="${fluffId}" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${Math.floor(Math.random() * 100)}" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2"/>
        </filter>`;

    return `<svg viewBox="0 0 200 270" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
      <defs>
        <!-- 身体立体渐变：左上偏亮、右下偏暗 -->
        <radialGradient id="${gradId}" cx="38%" cy="32%" r="78%">
          <stop offset="0%" stop-color="${bodyLight}"/>
          <stop offset="60%" stop-color="${c.body}"/>
          <stop offset="100%" stop-color="${bodyDeep}"/>
        </radialGradient>
        <!-- 肚兜浅渐变 -->
        <radialGradient id="${gradId}-b" cx="40%" cy="32%" r="80%">
          <stop offset="0%" stop-color="${bellyLight}"/>
          <stop offset="100%" stop-color="${c.belly}"/>
        </radialGradient>
        ${filterDef}
      </defs>
      <!-- 头顶 3 根橙刺羽毛：独立分散（不连成皇冠），左右斜短、中央直立稍粗深色 -->
      <polygon points="78,32 64,0 90,30" fill="${FEATHER_LIGHT}" stroke="${FEATHER_DARK}" stroke-width="1.2" ${filterAttr}/>
      <polygon points="95,28 100,-8 108,30" fill="${FEATHER_DARK}" stroke="${darken(FEATHER_DARK, 0.25)}" stroke-width="1.2" ${filterAttr}/>
      <polygon points="110,30 136,0 122,32" fill="${FEATHER_LIGHT}" stroke="${FEATHER_DARK}" stroke-width="1.2" ${filterAttr}/>
      <!-- 身体 squat 不倒翁形 + radial gradient 立体 + fluff filter 毛绒边缘 -->
      <path d="M 42 80
               Q 100 18 158 80
               C 180 130, 198 220, 100 262
               C 2 220, 20 130, 42 80 Z"
            fill="url(#${gradId})" stroke="${bodyStroke}" stroke-width="2" ${filterAttr}/>
      <!-- 毛绒纹理（细密斑点 + 短弧"毛茬"，加强毡感） -->
      <g opacity="0.18" fill="${OUTLINE}">
        <circle cx="50" cy="135" r="2.5"/>
        <circle cx="160" cy="125" r="2"/>
        <circle cx="36" cy="200" r="2.5"/>
        <circle cx="170" cy="195" r="2.2"/>
        <circle cx="78" cy="232" r="2"/>
        <circle cx="135" cy="240" r="2.5"/>
        <circle cx="42" cy="160" r="2"/>
        <circle cx="155" cy="170" r="2"/>
        <circle cx="68" cy="110" r="1.6"/>
        <circle cx="138" cy="100" r="1.6"/>
      </g>
      <!-- 身体亮面高光（左上斜向白色 patch） -->
      <ellipse cx="62" cy="105" rx="28" ry="14" fill="white" opacity="0.13" transform="rotate(-30 62 105)"/>
      <!-- 肚兜：椭圆奶白补丁（位置略下） -->
      <ellipse cx="100" cy="180" rx="48" ry="55" fill="url(#${gradId}-b)" stroke="${bellyStroke}" stroke-width="1.2" ${filterAttr}/>
      <!-- 手臂 -->
      ${armL}
      ${armR}
      <!-- 眼睛 / 眼皮 -->
      ${eyeArea}
      <!-- 喙 -->
      ${mouth}
      <!-- 脚 + 三趾鸡爪 -->
      <g stroke="${FEET}" stroke-linecap="round" fill="none">
        <line x1="80" y1="248" x2="80" y2="260" stroke-width="6"/>
        <line x1="120" y1="248" x2="120" y2="260" stroke-width="6"/>
        <line x1="80" y1="260" x2="68" y2="266" stroke-width="4.5"/>
        <line x1="80" y1="260" x2="80" y2="268" stroke-width="4.5"/>
        <line x1="80" y1="260" x2="92" y2="266" stroke-width="4.5"/>
        <line x1="120" y1="260" x2="108" y2="266" stroke-width="4.5"/>
        <line x1="120" y1="260" x2="120" y2="268" stroke-width="4.5"/>
        <line x1="120" y1="260" x2="132" y2="266" stroke-width="4.5"/>
      </g>
    </svg>`;
  }

  // ===== 音频合成 =====
  let _ctx = null;
  function ensureCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  // 单音 tone：频率 f0→f1 滑音 + 可选 vibrato（颤音）让叫声更"生物"感
  function _tone(wave, f0, f1, dur, vol, attack, ctx, startAt, vibrato) {
    const t = startAt || ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1 || f0, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + (attack || 0.015));
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    // vibrato 通过低频 LFO 调制 osc.frequency
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = vibrato.rate || 8;     // Hz
      lfoGain.gain.value = vibrato.depth || f0 * 0.04; // 频率偏移幅度
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.02);
    }
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playCall(charKey) {
    const c = CHARS[charKey];
    if (!c) return;
    const ctx = ensureCtx();
    const now = ctx.currentTime;
    const cfg = c.call;
    if (cfg.kind === 'tone') {
      // BigHoo Hooo——加慢颤音（5Hz 小幅）有低沉浑厚感
      _tone(cfg.wave, cfg.f0, cfg.f1, cfg.dur, cfg.vol, 0.04, ctx, now,
            { rate: 5, depth: cfg.f0 * 0.05 });
    } else if (cfg.kind === 'twoNote') {
      // Too-dloo: 两短音 + 第二音稍颤
      _tone(cfg.wave, cfg.f0, cfg.f0 * 0.95, 0.18, cfg.vol, 0.01, ctx, now);
      _tone(cfg.wave, cfg.f1, cfg.f1 * 0.9, 0.26, cfg.vol, 0.01, ctx, now + 0.2,
            { rate: 9, depth: cfg.f1 * 0.04 });
    } else if (cfg.kind === 'tripletChirp') {
      // Chic-ke-dy 三音——快速三连音模拟雀跃感
      _tone(cfg.wave, cfg.f0, cfg.f0 * 1.05, 0.08, cfg.vol, 0.005, ctx, now);
      _tone(cfg.wave, cfg.f0 * 0.85, cfg.f0 * 0.9, 0.08, cfg.vol, 0.005, ctx, now + 0.11);
      _tone(cfg.wave, cfg.f0 * 1.15, cfg.f0 * 0.95, 0.14, cfg.vol, 0.005, ctx, now + 0.22,
            { rate: 12, depth: cfg.f0 * 0.05 });
    } else if (cfg.kind === 'pip') {
      // Chick 一个高 Chic——尖锐短促，无颤音
      _tone(cfg.wave, cfg.f0 * 1.1, cfg.f0 * 0.85, cfg.dur, cfg.vol, 0.005, ctx, now);
    }
  }

  // "Oooo" 集体惊讶——4 角色叫声错落叠加
  function playOooo() {
    const ctx = ensureCtx();
    const now = ctx.currentTime;
    // 一组上行 sine 形成 "wooow" 感
    _tone('sine', 220, 360, 0.6, 0.18, 0.08, ctx, now);
    _tone('sine', 320, 480, 0.55, 0.14, 0.08, ctx, now + 0.05);
    _tone('sine', 440, 620, 0.5, 0.1, 0.06, ctx, now + 0.1);
  }

  // 欢呼——4 音上升琶音 + Oooo
  function playCheer() {
    const ctx = ensureCtx();
    const now = ctx.currentTime;
    const notes = [261, 329, 392, 523, 659, 784]; // C 大调上升
    notes.forEach((f, i) => {
      _tone('triangle', f, f, 0.22, 0.2, 0.005, ctx, now + i * 0.09);
    });
    // 第二层叠 4 角色叫声同时
    setTimeout(() => playCall('bighoo'), 50);
    setTimeout(() => playCall('toodloo'), 200);
    setTimeout(() => playCall('chickedy'), 350);
    setTimeout(() => playCall('chick'), 500);
  }

  // "啵"——泡泡破裂短音
  function playPop() {
    const ctx = ensureCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + Math.random() * 300, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // 球落地"咚"
  function playThud() {
    const ctx = ensureCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.15);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  window.TW = {
    CHARS,
    CHAR_LIST,
    svg,
    ensureCtx,
    playCall,
    playOooo,
    playCheer,
    playPop,
    playThud,
  };
})();
