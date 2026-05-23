// Twirlywoos 4 角色共享组件
// 形象抓手：圆胖蛋身 + 头顶 3 根橙色羽毛 + 大黑眼 + 橙色喙 + 橙色 stick 脚
// 五款 tw-* 游戏共用：window.TW.svg / playCall / playOooo / playCheer / CHARS

(function () {
  const FEATHER = '#ff8c00';
  const BEAK = '#ff8c00';
  const FEET = '#ff8c00';

  // 4 角色：颜色 + 体型梯度 + 中文小名 + 叫声配置
  const CHARS = {
    bighoo: {
      key: 'bighoo',
      name: '大蓝',
      body: '#3b82f6',
      belly: '#f5e6c5',
      sizeRatio: 1.0,
      // 低沉 Hooo——sine 低频上滑
      call: { kind: 'tone', wave: 'sine', f0: 180, f1: 240, dur: 0.55, vol: 0.32 },
    },
    toodloo: {
      key: 'toodloo',
      name: '红红',
      body: '#dc2626',
      belly: '#f5e6c5',
      sizeRatio: 0.78,
      // Too-dloo——两个 note
      call: { kind: 'twoNote', wave: 'triangle', f0: 380, f1: 320, dur: 0.42, vol: 0.28 },
    },
    chickedy: {
      key: 'chickedy',
      name: '小黄',
      body: '#fbbf24',
      belly: '#fef3c7',
      sizeRatio: 0.6,
      // 短促 Chic-ke-dy——三个 16th
      call: { kind: 'tripletChirp', wave: 'square', f0: 720, dur: 0.35, vol: 0.18 },
    },
    chick: {
      key: 'chick',
      name: '小小',
      body: '#fde047',
      belly: '#fffbe6',
      sizeRatio: 0.48,
      // 一个高 Chic
      call: { kind: 'pip', wave: 'square', f0: 1050, dur: 0.16, vol: 0.16 },
    },
  };
  const CHAR_LIST = ['bighoo', 'toodloo', 'chickedy', 'chick'];

  // ===== SVG 角色生成 =====
  // expression: 'idle' | 'surprised' | 'cheer'
  function svg(charKey, opts = {}) {
    const c = CHARS[charKey];
    if (!c) return '';
    const expr = opts.expression || 'idle';
    const armUp = expr === 'cheer';
    const eyeR = expr === 'surprised' ? 14 : 11;
    const eyeY = expr === 'cheer' ? 100 : 105;
    // cheer 表情：眼睛闭弯
    const eyeNode = (cx) => {
      if (expr === 'cheer') {
        return `<path d="M${cx - 12} ${eyeY} Q${cx} ${eyeY - 10} ${cx + 12} ${eyeY}" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>`;
      }
      return `<circle cx="${cx}" cy="${eyeY}" r="${eyeR}" fill="#1a1a1a"/>
              <circle cx="${cx + 3}" cy="${eyeY - 3}" r="3" fill="white"/>`;
    };
    // 嘴：idle 小三角 / surprised 大 O / cheer 张大笑
    let mouthNode;
    if (expr === 'surprised') {
      mouthNode = `<ellipse cx="100" cy="135" rx="10" ry="13" fill="#1a1a1a"/>
                   <path d="M93 130 L100 124 L107 130 Z" fill="${BEAK}"/>`;
    } else if (expr === 'cheer') {
      mouthNode = `<path d="M85 132 Q100 152 115 132" fill="#1a1a1a" stroke="#1a1a1a" stroke-width="2"/>
                   <path d="M93 128 L100 122 L107 128 Z" fill="${BEAK}"/>`;
    } else {
      mouthNode = `<path d="M93 130 L100 140 L107 130 Z" fill="${BEAK}"/>`;
    }
    // 手臂位置 idle 下垂 / cheer 上举
    const armL = armUp
      ? `<ellipse cx="22" cy="115" rx="22" ry="14" fill="${c.body}" transform="rotate(-55 22 115)"/>`
      : `<ellipse cx="18" cy="172" rx="22" ry="14" fill="${c.body}" transform="rotate(-22 18 172)"/>`;
    const armR = armUp
      ? `<ellipse cx="178" cy="115" rx="22" ry="14" fill="${c.body}" transform="rotate(55 178 115)"/>`
      : `<ellipse cx="182" cy="172" rx="22" ry="14" fill="${c.body}" transform="rotate(22 182 172)"/>`;

    return `<svg viewBox="0 0 200 270" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
      <!-- 头顶羽毛簇（3 根橙刺） -->
      <path d="M78 35 L70 3 L88 28 Z" fill="${FEATHER}"/>
      <path d="M100 30 L100 -5 L114 28 Z" fill="${FEATHER}"/>
      <path d="M122 35 L132 3 L114 28 Z" fill="${FEATHER}"/>
      <!-- 身体（egg） -->
      <ellipse cx="100" cy="145" rx="82" ry="105" fill="${c.body}"/>
      <!-- 肚兜 -->
      <ellipse cx="100" cy="170" rx="50" ry="62" fill="${c.belly}"/>
      <!-- 手臂 -->
      ${armL}
      ${armR}
      <!-- 眼睛 -->
      ${eyeNode(80)}
      ${eyeNode(120)}
      <!-- 嘴 -->
      ${mouthNode}
      <!-- 脚 -->
      <line x1="78" y1="248" x2="78" y2="262" stroke="${FEET}" stroke-width="6" stroke-linecap="round"/>
      <line x1="122" y1="248" x2="122" y2="262" stroke="${FEET}" stroke-width="6" stroke-linecap="round"/>
      <line x1="78" y1="263" x2="71" y2="266" stroke="${FEET}" stroke-width="4" stroke-linecap="round"/>
      <line x1="78" y1="263" x2="78" y2="268" stroke="${FEET}" stroke-width="4" stroke-linecap="round"/>
      <line x1="78" y1="263" x2="85" y2="266" stroke="${FEET}" stroke-width="4" stroke-linecap="round"/>
      <line x1="122" y1="263" x2="115" y2="266" stroke="${FEET}" stroke-width="4" stroke-linecap="round"/>
      <line x1="122" y1="263" x2="122" y2="268" stroke="${FEET}" stroke-width="4" stroke-linecap="round"/>
      <line x1="122" y1="263" x2="129" y2="266" stroke="${FEET}" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
  }

  // ===== 音频合成 =====
  let _ctx = null;
  function ensureCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  // 单音 tone：频率 f0→f1 滑音
  function _tone(wave, f0, f1, dur, vol, attack, ctx, startAt) {
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
      _tone(cfg.wave, cfg.f0, cfg.f1, cfg.dur, cfg.vol, 0.04, ctx, now);
    } else if (cfg.kind === 'twoNote') {
      // Too-dloo: 两短音
      _tone(cfg.wave, cfg.f0, cfg.f0 * 0.95, 0.18, cfg.vol, 0.01, ctx, now);
      _tone(cfg.wave, cfg.f1, cfg.f1 * 0.9, 0.24, cfg.vol, 0.01, ctx, now + 0.2);
    } else if (cfg.kind === 'tripletChirp') {
      // Chic-ke-dy 三音
      _tone(cfg.wave, cfg.f0, cfg.f0, 0.07, cfg.vol, 0.005, ctx, now);
      _tone(cfg.wave, cfg.f0 * 0.85, cfg.f0 * 0.85, 0.07, cfg.vol, 0.005, ctx, now + 0.1);
      _tone(cfg.wave, cfg.f0 * 1.1, cfg.f0 * 0.95, 0.12, cfg.vol, 0.005, ctx, now + 0.2);
    } else if (cfg.kind === 'pip') {
      _tone(cfg.wave, cfg.f0, cfg.f0 * 0.9, cfg.dur, cfg.vol, 0.005, ctx, now);
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
