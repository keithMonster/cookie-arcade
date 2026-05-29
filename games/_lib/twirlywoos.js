// Twirlywoos 4 角色共享组件
// 真实形象抓手（v0.11 对照 BBC 节目剧照重画）：
//   ① 头是独立的小圆球，叠在身体顶（眼/喙长在头上，不是脸长在身体上）
//   ② 头顶 2 片翘起的橙色羽冠（不是 3 根尖刺羽毛）
//   ③ 身体葫芦/不倒翁毛绒躯干（上窄下宽，保留 v0.7 形态）
//   ④ 手臂是半月形小翅膀从身体侧面外伸（不是 stroke 直线）
//   ⑤ 脚是 2 根橙细杆 + 末端水平橙色脚板（像小木屐，不是鸡爪三趾）
//   ⑥ 大眼黑瞳带高光，眉/眼皮线根据表情切
//
// 五款 tw-* 游戏共用：window.TW.svg / playCall / playOooo / playCheer / CHARS

(function () {
  const FEATHER_LIGHT = '#ff8c1a';
  const FEATHER_DARK = '#e06600';
  const BEAK = '#ff8c00';
  const BEAK_DARK = '#c46100';
  const FEET = '#ff8c00';
  const FEET_DARK = '#c46100';
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
  // 颜色对照真实节目剧照微调：红涂涂从偏橙红 #d8442e → 砖红 #c83a2c
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
      body: '#c83a2c',          // 砖红 (v0.11 微调，对照真品)
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
  // expression: 'idle' | 'surprised' | 'cheer' | 'lying'
  //   - idle: 正常站姿，眼皮线 + 圆眼
  //   - surprised: 圆睁大眼 + 张菱形嘴 + 翅膀略抬
  //   - cheer: 笑眼 + 大笑张嘴 + 翅膀上举
  //   - lying: 瘫倒/趴下（首页 idle 招牌姿态），整体倾斜 + 眼半闭
  // 设计还原点（v0.11）：
  // ① 头独立——cy=58 的圆球叠在身体顶 (身体从 y=92 起)
  // ② 头顶 2 片矩形/梯形翘起羽冠（不是 3 根尖刺）
  // ③ 眼睛在头上 (cy=58)，间距 28，不是分两边
  // ④ 喙在头底 (cy=80)，小三角实心橙
  // ⑤ 翅膀=半月形 path 从身体侧伸出，不是直线段
  // ⑥ 脚=2 根橙细杆 + 末端水平橙板（小木屐）
  // ⑦ 身体加细纹（毛绒质感）+ 主体描边（毡感）+ 葫芦不倒翁形保留
  function svg(charKey, opts = {}) {
    const c = CHARS[charKey];
    if (!c) return '';
    const expr = opts.expression || 'idle';
    // noFilter: true → 跳过 feTurbulence + feDisplacementMap，节省 GPU
    // 适用：首页 preview / 数量多的角色排 / 移动设备性能不足时
    const noFilter = !!opts.noFilter;
    const bodyStroke = darken(c.body, 0.22);
    const bellyStroke = darken(c.belly, 0.12);

    // ===== 眼睛（在头上 cy=58，间距 28）=====
    let eyeArea;
    if (expr === 'cheer') {
      // 笑眼：弯月形
      eyeArea = `
        <path d="M82 56 Q90 64 98 56" fill="none" stroke="${OUTLINE}" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M102 56 Q110 64 118 56" fill="none" stroke="${OUTLINE}" stroke-width="3.6" stroke-linecap="round"/>
      `;
    } else if (expr === 'surprised') {
      // 圆睁大眼睛 + 大白底（无眼皮）
      eyeArea = `
        <circle cx="86" cy="58" r="13" fill="#fff" stroke="${OUTLINE}" stroke-width="1.8"/>
        <circle cx="114" cy="58" r="13" fill="#fff" stroke="${OUTLINE}" stroke-width="1.8"/>
        <circle cx="86" cy="58" r="8" fill="${OUTLINE}"/>
        <circle cx="114" cy="58" r="8" fill="${OUTLINE}"/>
        <circle cx="89" cy="54" r="3" fill="#fff"/>
        <circle cx="117" cy="54" r="3" fill="#fff"/>
      `;
    } else if (expr === 'lying') {
      // 半闭眼（眯起 idle 状）—— 一道弧线下垂
      eyeArea = `
        <path d="M76 58 Q86 64 96 58" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>
        <path d="M104 58 Q114 64 124 58" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>
      `;
    } else {
      // idle：白底大眼 + 黑瞳 + 高光（最常见姿态）
      eyeArea = `
        <circle cx="86" cy="58" r="11" fill="#fff" stroke="${OUTLINE}" stroke-width="1.5"/>
        <circle cx="114" cy="58" r="11" fill="#fff" stroke="${OUTLINE}" stroke-width="1.5"/>
        <circle cx="86" cy="58" r="6.5" fill="${OUTLINE}"/>
        <circle cx="114" cy="58" r="6.5" fill="${OUTLINE}"/>
        <circle cx="88" cy="55" r="2.4" fill="#fff"/>
        <circle cx="116" cy="55" r="2.4" fill="#fff"/>
      `;
    }

    // ===== 喙（在头底 cy~78-82）=====
    let mouth;
    if (expr === 'surprised') {
      // 上下两半喙合成菱形张开嘴
      mouth = `
        <path d="M92 78 L100 84 L108 78 L100 75 Z" fill="${BEAK}" stroke="${BEAK_DARK}" stroke-width="1"/>
        <path d="M92 84 L100 92 L108 84 L100 80 Z" fill="${BEAK_DARK}" stroke="${darken(BEAK_DARK, 0.2)}" stroke-width="1"/>
      `;
    } else if (expr === 'cheer') {
      // 张大笑：上喙翘 + 下方笑弧
      mouth = `
        <path d="M92 78 L100 74 L108 78 L100 84 Z" fill="${BEAK}" stroke="${BEAK_DARK}" stroke-width="1"/>
      `;
    } else {
      // 小三角喙
      mouth = `<path d="M93 76 L100 88 L107 76 Z" fill="${BEAK}" stroke="${BEAK_DARK}" stroke-width="1"/>`;
    }

    // ===== 翅膀（身体侧面伸出的半月形小翅）=====
    let wingL, wingR;
    const bodyLight2 = lighten(c.body, 0.1);
    const bodyDeep2 = darken(c.body, 0.18);
    if (expr === 'cheer') {
      // 上举庆祝：翅膀向上外翻
      wingL = `<path d="M 42 130 Q 14 80 26 50 Q 38 70 50 130 Z" fill="${c.body}" stroke="${bodyDeep2}" stroke-width="1.5"/>`;
      wingR = `<path d="M 158 130 Q 186 80 174 50 Q 162 70 150 130 Z" fill="${c.body}" stroke="${bodyDeep2}" stroke-width="1.5"/>`;
    } else if (expr === 'surprised') {
      // 略微抬起，翅膀水平外伸
      wingL = `<path d="M 38 150 Q 4 138 8 110 Q 28 130 50 152 Z" fill="${c.body}" stroke="${bodyDeep2}" stroke-width="1.5"/>`;
      wingR = `<path d="M 162 150 Q 196 138 192 110 Q 172 130 150 152 Z" fill="${c.body}" stroke="${bodyDeep2}" stroke-width="1.5"/>`;
    } else if (expr === 'lying') {
      // 瘫倒：翅膀外摊（向外向下）
      wingL = `<path d="M 38 160 Q 4 200 18 220 Q 32 198 50 170 Z" fill="${c.body}" stroke="${bodyDeep2}" stroke-width="1.5"/>`;
      wingR = `<path d="M 162 160 Q 196 200 182 220 Q 168 198 150 170 Z" fill="${c.body}" stroke="${bodyDeep2}" stroke-width="1.5"/>`;
    } else {
      // idle：自然垂在身体两侧，半月形微外翻
      wingL = `<path d="M 38 145 Q 18 175 26 200 Q 40 180 52 160 Z" fill="${c.body}" stroke="${bodyDeep2}" stroke-width="1.5"/>`;
      wingR = `<path d="M 162 145 Q 182 175 174 200 Q 160 180 148 160 Z" fill="${c.body}" stroke="${bodyDeep2}" stroke-width="1.5"/>`;
    }

    // 立体明暗渐变 ID（每角色独立避免冲突）
    const gradId = `g-${charKey}-${Math.random().toString(36).slice(2, 8)}`;
    const headGradId = `gh-${charKey}-${Math.random().toString(36).slice(2, 8)}`;
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

    // ===== 整体倾斜（lying 表情身体歪向左）=====
    const transform = expr === 'lying' ? 'rotate(-14 100 200)' : '';

    return `<svg viewBox="-4 -10 208 280" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
      <defs>
        <!-- 身体立体渐变：左上偏亮、右下偏暗 -->
        <radialGradient id="${gradId}" cx="38%" cy="32%" r="78%">
          <stop offset="0%" stop-color="${bodyLight}"/>
          <stop offset="60%" stop-color="${c.body}"/>
          <stop offset="100%" stop-color="${bodyDeep}"/>
        </radialGradient>
        <!-- 头部立体渐变 -->
        <radialGradient id="${headGradId}" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stop-color="${bodyLight}"/>
          <stop offset="70%" stop-color="${c.body}"/>
          <stop offset="100%" stop-color="${bodyDeep}"/>
        </radialGradient>
        <!-- 肚兜浅渐变 -->
        <radialGradient id="${gradId}-b" cx="40%" cy="32%" r="80%">
          <stop offset="0%" stop-color="${bellyLight}"/>
          <stop offset="100%" stop-color="${c.belly}"/>
        </radialGradient>
        ${filterDef}
      </defs>
      <g transform="${transform}">
        <!-- ====== 身体层（在头后面） ====== -->
        <!-- 翅膀（左，垫在身体后） -->
        ${wingL}
        <!-- 身体 squat 不倒翁形 + radial gradient 立体 + fluff filter 毛绒边缘 -->
        <path d="M 48 110
                 C 30 150, 18 220, 100 262
                 C 182 220, 170 150, 152 110
                 Q 100 95 48 110 Z"
              fill="url(#${gradId})" stroke="${bodyStroke}" stroke-width="2" ${filterAttr}/>
        <!-- 毛绒纹理（细密斑点） -->
        <g opacity="0.18" fill="${OUTLINE}">
          <circle cx="56" cy="155" r="2.5"/>
          <circle cx="148" cy="145" r="2"/>
          <circle cx="42" cy="200" r="2.5"/>
          <circle cx="160" cy="195" r="2.2"/>
          <circle cx="78" cy="240" r="2"/>
          <circle cx="135" cy="245" r="2.5"/>
          <circle cx="50" cy="180" r="2"/>
          <circle cx="155" cy="170" r="2"/>
        </g>
        <!-- 身体亮面高光 -->
        <ellipse cx="68" cy="135" rx="22" ry="11" fill="white" opacity="0.13" transform="rotate(-30 68 135)"/>
        <!-- 肚兜：椭圆奶白补丁（位置略下） -->
        <ellipse cx="100" cy="190" rx="44" ry="50" fill="url(#${gradId}-b)" stroke="${bellyStroke}" stroke-width="1.2" ${filterAttr}/>
        <!-- 翅膀（右，垫在身体后） -->
        ${wingR}

        <!-- ====== 头层（叠在身体顶，独立圆球） ====== -->
        <!-- 头顶 2 片翘起的橙色羽冠（梯形，左右各一片，对内倾） -->
        <polygon points="84,22 70,-6 92,8 92,28" fill="${FEATHER_LIGHT}" stroke="${FEATHER_DARK}" stroke-width="1.5" ${filterAttr}/>
        <polygon points="108,8 130,-6 116,22 108,28" fill="${FEATHER_DARK}" stroke="${darken(FEATHER_DARK, 0.25)}" stroke-width="1.5" ${filterAttr}/>
        <!-- 头：独立椭圆球（紧贴身体顶） -->
        <ellipse cx="100" cy="58" rx="42" ry="40" fill="url(#${headGradId})" stroke="${bodyStroke}" stroke-width="2" ${filterAttr}/>
        <!-- 头部毛绒纹理 -->
        <g opacity="0.18" fill="${OUTLINE}">
          <circle cx="74" cy="40" r="1.6"/>
          <circle cx="128" cy="38" r="1.6"/>
          <circle cx="70" cy="78" r="1.6"/>
          <circle cx="130" cy="78" r="1.6"/>
        </g>
        <!-- 头部高光 -->
        <ellipse cx="80" cy="40" rx="14" ry="8" fill="white" opacity="0.18" transform="rotate(-25 80 40)"/>
        <!-- 眼睛 -->
        ${eyeArea}
        <!-- 喙 -->
        ${mouth}

        <!-- ====== 脚层 (2 根细杆 + 横向木屐板) ====== -->
        <g stroke="${FEET}" stroke-linecap="round" fill="${FEET}">
          <!-- 左脚 -->
          <line x1="80" y1="250" x2="80" y2="262" stroke-width="6"/>
          <rect x="66" y="260" width="28" height="6" rx="2" stroke="${FEET_DARK}" stroke-width="1"/>
          <!-- 右脚 -->
          <line x1="120" y1="250" x2="120" y2="262" stroke-width="6"/>
          <rect x="106" y="260" width="28" height="6" rx="2" stroke="${FEET_DARK}" stroke-width="1"/>
        </g>
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
    darken,
    lighten,
    ensureCtx,
    playCall,
    playOooo,
    playCheer,
    playPop,
    playThud,
  };
})();
