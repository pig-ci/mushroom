/* 夜市彈珠台 — self-contained Canvas game, no libraries or network requests.
 * Logical coordinates stay fixed; CSS and devicePixelRatio handle all screens.
 * Physics uses a fixed step with substeps to prevent tunnelling through pegs.
 */
(() => {
  'use strict';

  const CONFIG = Object.freeze({
    width: 560, height: 680, balls: 3, gravity: 610,
    step: 1 / 120, maxSpeed: 1020, radius: 9,
    storageKey: 'night-market-pinball-best',
  });
  const $ = (id) => document.getElementById(id);
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  const ui = {
    score: $('score'), best: $('highScore'), balls: $('ballsLeft'),
    combo: $('combo'), start: $('startButton'), restart: $('restartButton'),
    sound: $('soundButton'), launch: $('launchButton'), power: $('powerFill'),
    status: $('statusText'), overlay: $('gameOverlay'),
    overlayTitle: $('overlayTitle'), overlayMessage: $('overlayMessage'),
    overlayButton: $('overlayButton'),
  };
  // THEME SYSTEM: visual configuration only. Never call resetGame() or modify
  // positions, velocities, scores, cooldowns or timers when applying a skin.
  const THEME_STORAGE_KEY = 'night-market-pinball-theme';
  function defineTheme(name, motif, palette, options) {
    const [page, page2, surface, deep, ink, muted, gold, pink, green, purple] = palette;
    return Object.freeze({
      name, motif,
      colors: Object.freeze({ gold, pink, green, purple, pale: ink, muted }),
      css: Object.freeze({
        '--night': page, '--night2': page2, '--ink': ink, '--muted': muted,
        '--red': pink, '--yellow': gold, '--purple': purple, '--green': green,
        '--wood': options.wood, '--surface': surface, '--surface-deep': deep,
        '--edge': options.trim, '--button-text': options.buttonText,
        '--button-fill': pink, '--glow': gold, '--title-ink': ink,
        '--cabinet-dark': deep, '--panel-radius': `${options.corner}px`,
      }),
      canvas: Object.freeze({
        outer: options.wood, inner: deep, top: surface, middle: page2,
        bottom: surface, trim: options.trim, rail: muted, ink, muted,
        pocket: deep, peg: options.peg, highlight: options.highlight,
        ball: options.ball, glow: options.glow, corner: options.corner,
        lineWidth: options.lineWidth, patternAlpha: options.patternAlpha,
        title: options.title, subtitle: options.subtitle,
        labels: options.labels, particle: options.particle,
        font: options.font || 'sans-serif',
      }),
    });
  }
  const themes = Object.freeze({
    cute: defineTheme('可愛', 'candy',
      ['#fbe9f0', '#f7dfed', '#fff6e9', '#f0d4e4', '#51304e', '#77556f', '#87551a', '#a93463', '#206751', '#6d4896'],
      { wood: '#eab6cd', trim: '#b97796', buttonText: '#ffffff', corner: 26,
        peg: '#b83e70', highlight: '#ffffff', ball: ['#ffffff', '#fff1b6', '#eb87b2', '#fff4c8', '#a13870'],
        glow: 0.35, lineWidth: 2, patternAlpha: 0.15, particle: 'star',
        title: '糖 果 星 球', subtitle: '甜 甜 好 運', labels: ['甜', '糖', '星', '福', '樂'] }),
    girlish: defineTheme('少女', 'bow',
      ['#f9edf5', '#efdfef', '#fffbf2', '#e8d5e8', '#593756', '#704b69', '#80541d', '#a12e60', '#306253', '#704790'],
      { wood: '#d8b6cf', trim: '#b48a69', buttonText: '#ffffff', corner: 18,
        peg: '#a06c98', highlight: '#fffdf2', ball: ['#ffffff', '#fff3fb', '#c782b3', '#fff3d9', '#8e5a8b'],
        glow: 0.25, lineWidth: 1.2, patternAlpha: 0.14, particle: 'petal',
        title: '花 漾 夢 遊', subtitle: '為 你 綻 放', labels: ['花', '蝶', '夢', '香', '戀'], font: 'serif' }),
    retro: defineTheme('復古', 'stamp',
      ['#efe0ba', '#e4ce98', '#f6e6bc', '#dcc494', '#493727', '#654c2e', '#6b4514', '#912d23', '#245942', '#6c4253'],
      { wood: '#713b2b', trim: '#8d6234', buttonText: '#fff5d5', corner: 10,
        peg: '#946b34', highlight: '#fff5d8', ball: ['#fff9dd', '#e7d8ad', '#93784e', '#e8c889', '#584836'],
        glow: 0.15, lineWidth: 2.5, patternAlpha: 0.2, particle: 'confetti',
        title: '老 街 彈 珠 行', subtitle: '經 典 好 手 氣', labels: ['好', '運', '旺', '福', '財'], font: 'serif' }),
    neon: defineTheme('霓虹', 'tube',
      ['#140b24', '#211332', '#23182f', '#100b1a', '#fff0fa', '#c3aacb', '#ffe076', '#ff69ac', '#5ce9e8', '#bf9cff'],
      { wood: '#3a1648', trim: '#9c5bbc', buttonText: '#250e29', corner: 20,
        peg: '#e4c9ff', highlight: '#ffffff', ball: ['#ffffff', '#d7ffff', '#55b9cd', '#e8dcff', '#6756a1'],
        glow: 1.05, lineWidth: 2, patternAlpha: 0.11, particle: 'spark',
        title: '霓 虹 夜 行', subtitle: '好 運 不 打 烊', labels: ['光', '夜', '電', '福', '財'] }),
    punk: defineTheme('龐克', 'graffiti',
      ['#111211', '#20221c', '#1b1d19', '#080a09', '#f6f6df', '#c0c3aa', '#e2ff54', '#ff6676', '#86f29d', '#c4a6ff'],
      { wood: '#242824', trim: '#d0ed48', buttonText: '#130b0c', corner: 3,
        peg: '#e2ff54', highlight: '#ffffe5', ball: ['#ffffff', '#f5ffbd', '#a1ba30', '#fff2db', '#5b671c'],
        glow: 0.35, lineWidth: 3, patternAlpha: 0.12, particle: 'shard',
        title: '打 破 規 則', subtitle: '好 運 不 設 限', labels: ['衝', '破', '燃', '狂', '熱'] }),
    future: defineTheme('未來', 'circuit',
      ['#061626', '#0b2438', '#0c293b', '#04111e', '#dcfaff', '#91bfcd', '#81f3ff', '#ff8fce', '#8fffcf', '#bcaeff'],
      { wood: '#10354b', trim: '#479eb6', buttonText: '#071827', corner: 7,
        peg: '#83e6ff', highlight: '#ecffff', ball: ['#ffffff', '#c2fdff', '#39a6c8', '#a9ebff', '#315d91'],
        glow: 0.65, lineWidth: 1.3, patternAlpha: 0.13, particle: 'diamond',
        title: '未 來 好 運 站', subtitle: '幸 運 訊 號 已 連 線', labels: ['核', '能', '光', '速', '電'], font: 'monospace' }),
  });
  let activeThemeKey = 'neon';
  let activeTheme = themes[activeThemeKey];
  const colors = { ...activeTheme.colors };
  const bumpers = [
    { x: 161, y: 213, r: 28, color: colors.pink, label: '好', flash: 0, hitAt: -10 },
    { x: 366, y: 230, r: 28, color: colors.green, label: '運', flash: 0, hitAt: -10 },
    { x: 266, y: 339, r: 33, color: colors.purple, label: '旺', flash: 0, hitAt: -10 },
    { x: 111, y: 390, r: 23, color: colors.gold, label: '福', special: true, flash: 0, hitAt: -10 },
    { x: 414, y: 393, r: 23, color: colors.pink, label: '財', special: true, flash: 0, hitAt: -10 },
  ];
  const pegs = [];
  [
    [140, [110, 210, 310, 410]],
    [280, [86, 155, 226, 309, 391, 453]],
    [443, [72, 162, 218, 313, 366, 458]],
    [493, [116, 181, 353, 420]],
    [566, [145, 255, 365]],
  ].forEach(([y, xs]) => xs.forEach((x) => pegs.push({ x, y, r: 5, hitAt: -10 })));
  const holes = [
    { x: 90, value: 50, color: colors.pink },
    { x: 200, value: 100, color: colors.green },
    { x: 310, value: 200, color: colors.purple },
    { x: 420, value: 500, color: colors.gold },
  ];
  const jackpot = { x: 269, y: 517, r: 25 };
  let best = 0;
  let storageOkay = true;
  try {
    const stored = Number(localStorage.getItem(CONFIG.storageKey));
    best = Number.isFinite(stored) && stored >= 0 ? Math.floor(stored) : 0;
  } catch (_) { storageOkay = false; }

  const state = {
    mode: 'idle', score: 0, remaining: CONFIG.balls, combo: 0, maxCombo: 0,
    time: 0, ball: null, particles: [], texts: [], trail: [],
    dragging: false, charge: 0, aim: 0, dragStart: null,
    chargeStarted: 0, resolveAt: 0, flash: 0, shake: 0,
    sound: true, lastAward: '', ballAge: 0, keyHeld: false,
  };
  let audio = null;
  let previous = 0;
  let accumulator = 0;

  function loadSavedTheme() {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return Object.hasOwn(themes, saved) ? saved : 'neon';
    } catch (_) {
      showThemeStorageNotice();
      return 'neon';
    }
  }
  function showThemeStorageNotice() {
    const notice = $('themeStorageNotice');
    if (notice) {
      notice.hidden = false;
      notice.textContent = '瀏覽器未允許儲存，皮膚仍可切換，但無法記住下次的選擇。';
    }
  }
  function applyTheme(key, persist = true) {
    if (!Object.hasOwn(themes, key)) return false;
    // Only visual fields change, including already-visible particles/text.
    const previousColors = { ...colors };
    activeThemeKey = key;
    activeTheme = themes[key];
    Object.assign(colors, activeTheme.colors);
    document.documentElement.dataset.theme = key;
    Object.entries(activeTheme.css).forEach(([name, value]) => {
      document.documentElement.style.setProperty(name, value);
    });
    ['pink', 'green', 'purple', 'gold', 'pink'].forEach((role, i) => { bumpers[i].color = colors[role]; });
    ['pink', 'green', 'purple', 'gold'].forEach((role, i) => { holes[i].color = colors[role]; });
    bumpers.forEach((b, i) => { b.label = activeTheme.canvas.labels[i]; });
    const recolor = (item) => {
      const role = Object.keys(previousColors).find((name) => previousColors[name] === item.color);
      if (role) item.color = colors[role];
    };
    state.particles.forEach(recolor);
    state.texts.forEach(recolor);
    document.querySelectorAll('[data-theme-option]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeOption === key));
    });
    if ($('currentThemeName')) $('currentThemeName').textContent = activeTheme.name;
    if ($('themeStatus')) $('themeStatus').textContent = `已套用${activeTheme.name}皮膚，遊戲進度保持不變。`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', activeTheme.css['--night']);
    if (persist) {
      try { localStorage.setItem(THEME_STORAGE_KEY, key); }
      catch (_) { showThemeStorageNotice(); }
    }
    render();
    return true;
  }
  function initThemeSystem() {
    const buttons = [...document.querySelectorAll('[data-theme-option]')];
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => applyTheme(button.dataset.themeOption));
      button.addEventListener('keydown', (event) => {
        const offsets = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let next;
        if (Object.hasOwn(offsets, event.key)) next = (index + offsets[event.key] + buttons.length) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[next].focus();
        applyTheme(buttons[next].dataset.themeOption);
      });
    });
    applyTheme(loadSavedTheme(), false);
    // Public visual-only API: adding a skin never requires altering physics.
    window.NightMarketThemes = Object.freeze({
      themes, applyTheme, loadSavedTheme,
      get current() { return activeThemeKey; },
    });
  }

  function format(value) { return Math.floor(value).toLocaleString('en-US'); }
  function status(message) { ui.status.textContent = message; }
  function updateHUD() {
    ui.score.textContent = format(state.score);
    ui.best.textContent = format(best);
    ui.balls.textContent = String(state.remaining);
    ui.combo.textContent = String(state.combo).padStart(2, '0');
    const ready = state.mode === 'ready';
    ui.launch.disabled = !ready;
    ui.launch.setAttribute('aria-label', ready ? '按住並向下拖曳蓄力，放開發射彈珠' : '等待下一顆彈珠');
    ui.power.style.width = `${Math.round(state.charge * 100)}%`;
    const round = $('roundLabel');
    if (round) {
      const currentBall = CONFIG.balls - state.remaining + (state.mode === 'ready' ? 1 : 0);
      round.textContent = `${Math.max(1, Math.min(CONFIG.balls, currentBall))} / ${CONFIG.balls}`;
    }
  }

  // Audio is created only inside a user gesture, as required by mobile browsers.
  function unlockAudio() {
    if (!state.sound) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audio) {
      try { audio = new AudioContextClass(); } catch (_) { return; }
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  }
  function playTone(frequency, duration = 0.1, type = 'sine', delay = 0, endFrequency) {
    if (!state.sound || !audio || audio.state !== 'running') return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const t = audio.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.065, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.02);
  }
  function sound(kind) {
    if (kind === 'launch') playTone(190, 0.22, 'triangle', 0, 880);
    if (kind === 'bounce') playTone(430 + state.combo * 26, 0.065, 'sine');
    if (kind === 'combo') [523, 659, 784].forEach((n, i) => playTone(n, 0.14, 'triangle', i * 0.065));
    if (kind === 'score') [659, 880, 1047].forEach((n, i) => playTone(n, 0.16, 'sine', i * 0.09));
    if (kind === 'jackpot') [523, 659, 784, 1047, 1319, 1568].forEach((n, i) => playTone(n, 0.3, 'triangle', i * 0.09));
    if (kind === 'end') [659, 523, 392, 523].forEach((n, i) => playTone(n, 0.24, 'triangle', i * 0.15));
    if (kind === 'miss') playTone(220, 0.25, 'triangle', 0, 70);
  }

  function saveHighScore() {
    if (state.score <= best) return;
    best = state.score;
    try { localStorage.setItem(CONFIG.storageKey, String(best)); }
    catch (_) {
      storageOkay = false;
      const notice = $('storageNotice');
      if (notice) {
        notice.hidden = false;
        notice.textContent = '瀏覽器未允許儲存，最高分僅保留於本次頁面。';
      }
    }
  }
  function resetGame() {
    unlockAudio();
    Object.assign(state, {
      mode: 'ready', score: 0, remaining: CONFIG.balls, combo: 0, maxCombo: 0,
      ball: null, particles: [], texts: [], trail: [], dragging: false,
      charge: 0, aim: 0, resolveAt: 0, flash: 0, shake: 0, keyHeld: false,
    });
    bumpers.forEach((b) => { b.flash = 0; b.hitAt = -10; });
    ui.overlay.hidden = true;
    ui.start.textContent = '新的一局';
    prepareBall();
    updateHUD();
  }
  function prepareBall() {
    state.mode = 'ready';
    state.combo = 0;
    state.charge = 0;
    state.aim = 0;
    state.ballAge = 0;
    state.trail = [];
    state.ball = { x: 512, y: 578, vx: 0, vy: 0, r: CONFIG.radius, lane: true };
    status(`第 ${4 - state.remaining} 顆彈珠就位 · 向下拉，放手發射`);
    updateHUD();
  }
  function endGame(missed = false) {
    state.mode = 'over';
    state.dragging = false;
    state.charge = 0;
    state.keyHeld = false;
    saveHighScore();
    sound('end');
    ui.overlayTitle.textContent = state.score >= best && state.score > 0 ? '今晚的彈珠王！' : '好運，下次再來！';
    ui.overlayMessage.textContent = `${missed ? '彈珠落出台外，本局結束。' : '三顆彈珠，滿載好運。'} 得分 ${format(state.score)} · 最高連擊 ${state.maxCombo}`;
    ui.overlayButton.textContent = '再玩一次';
    ui.overlay.hidden = false;
    status('本局結束 · 再挑戰一次最高分');
    updateHUD();
  }
  function triggerParticles(x, y, color, count = 18) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 190;
      state.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 35,
        life: 0.5 + Math.random() * 0.5, maxLife: 1, color, r: 1.3 + Math.random() * 2.5,
      });
    }
    if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
  }
  function floatingText(x, y, text, color = colors.gold, large = false) {
    state.texts.push({ x, y, text, color, life: 1.4, large });
  }
  function handleScore(value, x, y, label, color = colors.gold) {
    state.score += value;
    saveHighScore();
    floatingText(x, y - 24, `${label} +${value}`, color, value >= 500);
    triggerParticles(x, y, color, value >= 500 ? 45 : 22);
    state.flash = value >= 1000 ? 0.55 : 0.13;
    updateHUD();
  }
  function finishBall(hole, isJackpot = false) {
    if (state.mode !== 'playing') return;
    const b = state.ball;
    const value = isJackpot ? 1000 : hole.value;
    handleScore(value, b.x, b.y, isJackpot ? '大獎！' : '中獎！', isJackpot ? colors.gold : hole.color);
    state.lastAward = `${isJackpot ? 'JACKPOT！' : '中獎！'} +${value}`;
    status(`${state.lastAward} · ${state.remaining ? '準備下一顆好運' : '即將揭曉本局成績'}`);
    sound(isJackpot ? 'jackpot' : 'score');
    state.ball = null;
    state.trail = [];
    state.mode = 'settling';
    state.resolveAt = state.time + (isJackpot ? 1.8 : 1.1);
    updateHUD();
  }

  function beginCharge(point) {
    if (state.mode !== 'ready' || state.dragging) return;
    unlockAudio();
    state.dragging = true;
    state.dragStart = point;
    state.chargeStarted = state.time;
    state.charge = 0.16;
    status('向下拉蓄力，左右拖曳調整方向 · 放開發射');
  }
  function moveCharge(point) {
    if (!state.dragging || !state.dragStart) return;
    const dy = Math.max(0, point.y - state.dragStart.y);
    state.charge = Math.max(state.charge, Math.min(1, 0.16 + dy / 150));
    state.aim = Math.max(-1, Math.min(1, (point.x - state.dragStart.x) / 130));
  }
  function cancelCharge() {
    state.dragging = false;
    state.keyHeld = false;
    state.charge = 0;
    if (state.mode === 'ready') status('發射已取消 · 再次按住蓄力');
    updateHUD();
  }
  function shootBall() {
    if (state.mode !== 'ready' || !state.dragging) return;
    const b = state.ball;
    state.dragging = false;
    state.keyHeld = false;
    state.mode = 'playing';
    state.remaining--;
    state.ballAge = 0;
    b.vy = -(740 + state.charge * 275);
    b.vx = 0;
    b.power = state.charge;
    b.aim = state.aim;
    state.charge = 0;
    sound('launch');
    triggerParticles(b.x, b.y + 12, colors.gold, 12);
    status('好運出發！碰撞燈籠、累積連擊，挑戰千分大獎');
    updateHUD();
  }
  function pointerPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width * CONFIG.width,
      y: (event.clientY - rect.top) / rect.height * CONFIG.height,
    };
  }
  function bindCharge(element) {
    element.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || state.mode !== 'ready') return;
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      beginCharge(pointerPoint(event));
    });
    element.addEventListener('pointermove', (event) => moveCharge(pointerPoint(event)));
    element.addEventListener('pointerup', (event) => {
      shootBall();
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    });
    element.addEventListener('pointercancel', cancelCharge);
    element.addEventListener('lostpointercapture', () => {
      if (state.dragging) cancelCharge();
    });
  }

  // Separating interpenetrating circles before reflection prevents sticky contacts.
  function collideCircle(ball, obstacle, bumper = false) {
    const dx = ball.x - obstacle.x;
    const dy = ball.y - obstacle.y;
    const min = ball.r + obstacle.r;
    const distance = Math.hypot(dx, dy);
    if (distance >= min) return;
    const nx = distance > 0.001 ? dx / distance : 0;
    const ny = distance > 0.001 ? dy / distance : -1;
    ball.x = obstacle.x + nx * (min + 0.2);
    ball.y = obstacle.y + ny * (min + 0.2);
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot >= 0) return;
    const restitution = bumper ? 1.04 : 0.82;
    ball.vx -= (1 + restitution) * dot * nx;
    ball.vy -= (1 + restitution) * dot * ny;
    if (!bumper || state.time - obstacle.hitAt < 0.2) return;
    obstacle.hitAt = state.time;
    obstacle.flash = 0.45;
    ball.vx += nx * 65;
    ball.vy += ny * 65;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    triggerParticles(obstacle.x, obstacle.y, obstacle.color, 12);
    sound('bounce');
    state.shake = 1.8;
    if (obstacle.special) {
      handleScore(100, obstacle.x, obstacle.y, '燈籠好運', obstacle.color);
      sound('score');
    }
    if (state.combo % 3 === 0) {
      handleScore(50, ball.x, ball.y - 20, `${state.combo} 連擊`, colors.purple);
      sound('combo');
      status(`${state.combo} 連擊！額外獎勵 +50`);
    } else updateHUD();
  }

  function checkCollisions(ball) {
    const left = 37 + ball.r;
    const right = 478 - ball.r;
    if (ball.x < left) { ball.x = left; ball.vx = Math.abs(ball.vx) * 0.85; }
    if (ball.x > right) { ball.x = right; ball.vx = -Math.abs(ball.vx) * 0.85; }
    if (ball.y < 85 + ball.r) {
      ball.y = 85 + ball.r;
      ball.vy = Math.abs(ball.vy) * 0.78;
    }
    bumpers.forEach((bumper) => collideCircle(ball, bumper, true));
    pegs.forEach((peg) => collideCircle(ball, peg));
    if (ball.vy > 0 && Math.hypot(ball.x - jackpot.x, ball.y - jackpot.y) < jackpot.r - 4) {
      finishBall(null, true);
      return;
    }
    // All bottom pockets have explicit open mouths and mutually exclusive bounds.
    if (ball.y >= 602 && ball.vy > 0) {
      const index = Math.max(0, Math.min(3, Math.floor((ball.x - 35) / 110)));
      finishBall(holes[index]);
      return;
    }
    if (ball.y > CONFIG.height + 30 || !Number.isFinite(ball.x + ball.y + ball.vx + ball.vy)) {
      state.ball = null;
      sound('miss');
      endGame(true);
    }
  }

  function update(dt) {
    state.time += dt;
    state.flash = Math.max(0, state.flash - dt);
    state.shake = Math.max(0, state.shake - dt * 8);
    bumpers.forEach((b) => { b.flash = Math.max(0, b.flash - dt); });
    if (state.dragging) {
      state.charge = Math.min(1, Math.max(state.charge, 0.16 + (state.time - state.chargeStarted) * 0.5));
      ui.power.style.width = `${Math.round(state.charge * 100)}%`;
    }
    if (state.mode === 'settling' && state.time >= state.resolveAt) {
      if (state.remaining > 0) prepareBall();
      else endGame();
    }
    if (state.mode === 'playing' && state.ball) {
      const ball = state.ball;
      state.ballAge += dt;
      ball.vy += CONFIG.gravity * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.lane) {
        // The curved launch rail directs the marble onto the upper playfield.
        if (ball.y <= 130) {
          ball.lane = false;
          ball.x = 466;
          ball.vx = -(170 + ball.power * 240 + ball.aim * 100);
          ball.vy = -(80 + ball.power * 85);
        }
      } else {
        ball.vx *= Math.pow(0.998, dt * 60);
        checkCollisions(ball);
        // A deterministic nudge frees extremely rare balanced-on-peg cases.
        if (state.ballAge > 15 && Math.hypot(ball.vx, ball.vy) < 30) {
          ball.vx += (ball.x < 260 ? 95 : -95);
          ball.vy += 80;
        }
        if (state.ballAge > 24 && state.ball) {
          ball.vy = Math.max(ball.vy, 140);
          ball.vx += (260 - ball.x) * dt;
        }
      }
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > CONFIG.maxSpeed) {
        ball.vx *= CONFIG.maxSpeed / speed;
        ball.vy *= CONFIG.maxSpeed / speed;
      }
      if (state.ball) {
        state.trail.push({ x: ball.x, y: ball.y });
        if (state.trail.length > 20) state.trail.shift();
      }
    }
    state.particles.forEach((p) => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 150 * dt; p.life -= dt;
    });
    state.particles = state.particles.filter((p) => p.life > 0);
    state.texts.forEach((t) => { t.y -= dt * 30; t.life -= dt; });
    state.texts = state.texts.filter((t) => t.life > 0);
  }

  // Drawing helpers keep the visual layer separate from the simulation.
  function rounded(x, y, width, height, radius, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function circle(x, y, radius, fill, stroke, width = 1) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function text(content, x, y, size, color, weight = '600', font = activeTheme.canvas.font) {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(content, x, y);
  }
  function line(x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function glow(color, blur, draw) {
    ctx.save(); ctx.shadowColor = color;
    ctx.shadowBlur = Math.min(24, blur * activeTheme.canvas.glow);
    draw(); ctx.restore();
  }
  function star(x, y, size, color) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -size); ctx.lineTo(size * 0.26, -size * 0.26);
    ctx.lineTo(size, 0); ctx.lineTo(size * 0.26, size * 0.26);
    ctx.lineTo(0, size); ctx.lineTo(-size * 0.26, size * 0.26);
    ctx.lineTo(-size, 0); ctx.lineTo(-size * 0.26, -size * 0.26);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }
  // Motifs are registered separately from game objects and collision geometry.
  const motifDrawers = {
    candy(x, y, size, color) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
      rounded(-size, -size * 0.5, size * 2, size, size * 0.45, null, color, 1.5);
      [-1, 1].forEach((side) => {
        ctx.beginPath(); ctx.moveTo(side * size, 0);
        ctx.lineTo(side * size * 1.5, -size * 0.6);
        ctx.lineTo(side * size * 1.5, size * 0.6);
        ctx.closePath(); ctx.strokeStyle = color; ctx.stroke();
      });
      line(-size * 0.4, -size * 0.45, size * 0.2, size * 0.45, color, 2);
      ctx.restore();
    },
    bow(x, y, size, color) {
      ctx.save(); ctx.translate(x, y);
      [-1, 1].forEach((side) => {
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(side * size * 1.7, -size, side * size * 1.6, size, 0, 0);
        ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
        line(side * 2, 3, side * size * 0.6, size * 1.2, color, 2);
      });
      circle(0, 0, size * 0.2, color);
      // A five-petal blossom accompanies the ribbon in this skin.
      const flowerX = size * 1.8;
      const flowerY = -size * 0.65;
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        ctx.beginPath();
        ctx.ellipse(flowerX + Math.cos(angle) * size * 0.35,
          flowerY + Math.sin(angle) * size * 0.35,
          size * 0.3, size * 0.18, angle, 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
      }
      circle(flowerX, flowerY, size * 0.1, color);
      ctx.restore();
    },
    stamp(x, y, size, color) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.15);
      rounded(-size, -size, size * 2, size * 2, 1, null, color, 2);
      rounded(-size + 4, -size + 4, size * 2 - 8, size * 2 - 8, 0, null, color);
      text('福', 0, 1, size * 1.25, color, '900', 'serif');
      ctx.restore();
    },
    tube(x, y, size, color) {
      glow(color, 10, () => {
        ctx.beginPath();
        ctx.moveTo(x + size * 0.3, y - size);
        ctx.lineTo(x - size * 0.65, y + size * 0.15);
        ctx.lineTo(x + size * 0.1, y + size * 0.05);
        ctx.lineTo(x - size * 0.25, y + size);
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      });
    },
    graffiti(x, y, size, color) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.25);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const radius = i % 2 ? size * 0.57 : size;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      line(-size * 0.3, -size * 0.3, size * 0.3, size * 0.3, color, 2);
      line(size * 0.3, -size * 0.3, -size * 0.3, size * 0.3, color, 2);
      ctx.restore();
    },
    circuit(x, y, size, color) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const angle = i * Math.PI / 3;
        const px = x + Math.cos(angle) * size;
        const py = y + Math.sin(angle) * size;
        if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
      [-1, 1].forEach((side) => {
        line(x + side * size, y, x + side * size * 1.5, y, color);
        circle(x + side * size * 1.5, y, 2, color);
      });
      circle(x, y, size * 0.3, null, color);
    },
  };
  function drawMotif(x, y, size, color) {
    motifDrawers[activeTheme.motif](x, y, size, color);
  }
  function drawPattern() {
    const t = activeTheme.canvas;
    ctx.save(); ctx.globalAlpha = t.patternAlpha;
    // Tiled thematic drawings have no hit boxes; the peg layout never changes.
    for (let y = 167; y < 570; y += 105) {
      for (let x = 81; x < 475; x += 94) {
        drawMotif(x, y, 10, colors.purple);
      }
    }
    ctx.globalAlpha *= 0.8;
    for (let y = 91; y < 612; y += 15) {
      for (let x = 46; x < 478; x += 15) {
        ctx.fillStyle = t.rail;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.restore();
  }
  function drawBoard() {
    const t = activeTheme.canvas;
    const w = CONFIG.width;
    const h = CONFIG.height;
    rounded(10, 9, w - 20, h - 18, t.corner, t.outer, t.trim, t.lineWidth + 1);
    rounded(19, 18, w - 38, h - 36, t.corner, t.inner, t.trim, t.lineWidth);
    const field = ctx.createLinearGradient(0, 45, 0, 638);
    field.addColorStop(0, t.top);
    field.addColorStop(0.55, t.middle);
    field.addColorStop(1, t.bottom);
    rounded(33, 68, 450, 566, t.corner, field, t.trim, t.lineWidth);
    drawPattern();
    for (let i = 0; i < 15; i++) {
      const x = 43 + i * 34;
      const brightness = 0.55 + 0.4 * Math.sin(state.time * 2.5 + i * 0.7);
      ctx.globalAlpha = brightness;
      glow(colors.gold, 9, () => circle(x, 37, 3, colors.gold));
    }
    ctx.globalAlpha = 1;
    text(t.title, 267, 58, 12, t.ink, '600');
    glow(colors.gold, 8, () => {
      line(46, 95, 46, 574, t.trim, t.lineWidth);
      line(473, 95, 473, 574, t.trim, t.lineWidth);
    });
    // Upper ornamental arch; the launcher guide visibly joins this rail.
    ctx.beginPath(); ctx.moveTo(56, 127);
    ctx.bezierCurveTo(115, 53, 397, 56, 467, 125);
    ctx.strokeStyle = colors.gold; ctx.lineWidth = t.lineWidth + 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(63, 135);
    ctx.bezierCurveTo(115, 69, 397, 70, 460, 133);
    ctx.strokeStyle = t.rail; ctx.lineWidth = 1; ctx.stroke();
    text(t.subtitle, 263, 115, 15, t.ink);
    [81, 442].forEach((x) => drawMotif(x, 169, 10, colors.gold));
    [71, 451].forEach((x) => drawMotif(x, 463, 7, colors.purple));
    ctx.save();
    ctx.translate(263, 326); ctx.rotate(-0.23);
    ctx.globalAlpha = 0.05;
    text(activeTheme.name, 0, 0, 150, t.ink, '900', t.font);
    ctx.restore();
    drawLane();
    pegs.forEach((p) => {
      glow(t.peg, 5, () => circle(p.x, p.y, p.r, t.peg, t.highlight, 1));
      circle(p.x - 1, p.y - 1.5, 1.4, t.highlight);
    });
    bumpers.forEach(drawBumper);
    drawJackpot();
    drawPockets();
    text(`N I G H T  M A R K E T   ·   ${activeTheme.name}`, 264, 653, 9, t.muted, '500');
    [29, 531].forEach((x) => [24, 651].forEach((y) => {
      circle(x, y, 3, t.trim); line(x - 2, y, x + 2, y, t.inner, 1);
    }));
  }
  function drawLane() {
    const t = activeTheme.canvas;
    rounded(491, 83, 39, 547, Math.min(18, t.corner), t.inner, t.trim, t.lineWidth);
    line(487, 173, 487, 611, colors.gold, t.lineWidth);
    ctx.beginPath(); ctx.moveTo(511, 571); ctx.lineTo(511, 147);
    ctx.quadraticCurveTo(510, 103, 475, 104);
    ctx.strokeStyle = t.rail; ctx.lineWidth = 2; ctx.stroke();
    text('發', 511, 270, 12, t.ink);
    text('射', 511, 291, 12, t.ink);
    const compression = state.dragging ? state.charge * 19 : 0;
    ctx.beginPath();
    ctx.moveTo(501, 599 + compression);
    for (let i = 0; i < 10; i++) ctx.lineTo(i % 2 ? 501 : 523, 601 + compression + i * (2.5 - compression / 12));
    ctx.strokeStyle = t.peg; ctx.lineWidth = 2; ctx.stroke();
    rounded(497, 588 + compression, 29, 7, 3, colors.gold, t.highlight);
    if (state.mode === 'ready') {
      ctx.save();
      ctx.setLineDash([4, 7]); ctx.lineDashOffset = -state.time * 18;
      ctx.beginPath(); ctx.moveTo(511, 557); ctx.lineTo(511, 147);
      ctx.quadraticCurveTo(510, 92, 465, 110);
      ctx.quadraticCurveTo(390, 95, 320 - state.aim * 55, 175);
      ctx.strokeStyle = `${colors.gold}${state.dragging ? 'bb' : '55'}`;
      ctx.lineWidth = state.dragging ? 2 : 1;
      ctx.stroke(); ctx.restore();
    }
    for (let i = 0; i < 10; i++) {
      rounded(503, 523 - i * 11, 16, 5, 1, state.dragging && i / 10 < state.charge ? colors.gold : `${t.trim}55`);
    }
  }
  function drawBumper(b) {
    const t = activeTheme.canvas;
    const pulse = b.flash > 0 ? b.flash / 0.45 : 0;
    const radius = b.r + pulse * 3;
    circle(b.x + 1, b.y + 5, radius + 5, `${t.inner}99`);
    glow(b.color, 12 + pulse * 15, () => {
      circle(b.x, b.y, radius + 3, null, b.color, t.lineWidth);
      circle(b.x, b.y, radius - 3, t.top, `${b.color}90`, 1.5);
    });
    const gradient = ctx.createRadialGradient(b.x - 8, b.y - 9, 1, b.x, b.y, radius);
    gradient.addColorStop(0, `${b.color}48`);
    gradient.addColorStop(1, `${b.color}09`);
    circle(b.x, b.y, radius - 5, gradient);
    if (b.special) {
      line(b.x, b.y - radius - 12, b.x, b.y - radius - 3, t.trim, 1.5);
      rounded(b.x - 8, b.y - radius - 4, 16, 4, 1, colors.gold);
      line(b.x, b.y + radius + 2, b.x, b.y + radius + 14, b.color, 2);
      [-4, 0, 4].forEach((dx) => line(b.x + dx, b.y + radius + 10, b.x + dx, b.y + radius + 18, b.color));
      ctx.save(); ctx.globalAlpha = 0.3;
      [0.4, 0.75].forEach((v) => {
        ctx.beginPath(); ctx.ellipse(b.x, b.y, radius * v, radius - 4, 0, 0, Math.PI * 2);
        ctx.strokeStyle = b.color; ctx.lineWidth = 1; ctx.stroke();
      });
      ctx.restore();
    }
    drawMotif(b.x, b.y - radius - (b.special ? 10 : 14), b.special ? 7 : 6, b.color);
    text(b.label, b.x, b.y + 1, b.special ? 19 : 24, b.color, '700', t.font);
    if (b.special) text('+100', b.x, b.y + b.r + 31, 10, t.ink, '600', 'monospace');
    else {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        circle(b.x + Math.cos(a) * (b.r + 7), b.y + Math.sin(a) * (b.r + 7), 1.4, t.peg);
      }
    }
  }
  function drawJackpot() {
    const t = activeTheme.canvas;
    const j = jackpot;
    const pulse = 0.65 + Math.sin(state.time * 2.4) * 0.25;
    glow(colors.gold, 10 * pulse, () => {
      circle(j.x, j.y, j.r + 6, t.top, t.trim, 1);
      circle(j.x, j.y, j.r, t.pocket, colors.gold, t.lineWidth + 0.5);
      circle(j.x, j.y, j.r - 5, null, `${colors.gold}99`, 1);
    });
    text('大獎', j.x, j.y - 4, 12, colors.gold, '700');
    text('1000', j.x, j.y + 11, 13, colors.gold, '700', 'monospace');
    text('J A C K P O T', j.x, j.y - 43, 9, t.ink, '600');
    drawMotif(j.x - 45, j.y, 7, colors.gold);
    drawMotif(j.x + 45, j.y, 7, colors.gold);
  }
  function drawPockets() {
    const t = activeTheme.canvas;
    holes.forEach((hole, i) => {
      const x = hole.x;
      rounded(x - 45, 575, 90, 56, Math.min(t.corner, 14), t.pocket, t.trim, t.lineWidth);
      glow(hole.color, 9, () => {
        ctx.beginPath(); ctx.ellipse(x, 591, 32, 9, 0, Math.PI, Math.PI * 2);
        ctx.strokeStyle = hole.color; ctx.lineWidth = 2.5; ctx.stroke();
      });
      ctx.beginPath(); ctx.ellipse(x, 593, 29, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = t.inner; ctx.fill();
      text(String(hole.value), x, 614, 19, hole.color, '700', 'monospace');
      text(['小試身手', '好運來了', '手氣正旺', '超級加分'][i], x, 551, 9, t.ink, '500');
    });
  }
  function drawBall() {
    if (!state.ball) return;
    const t = activeTheme.canvas;
    const b = state.ball;
    state.trail.forEach((p, i) => {
      ctx.globalAlpha = i / state.trail.length * 0.28;
      circle(p.x, p.y, b.r * i / state.trail.length, colors.green);
    });
    ctx.globalAlpha = 1;
    const y = b.y + (state.dragging ? state.charge * 19 : 0);
    glow(t.highlight, 10, () => {
      const g = ctx.createRadialGradient(b.x - 3, y - 4, 0, b.x, y, b.r);
      [0, 0.3, 0.65, 0.88, 1].forEach((stop, i) => g.addColorStop(stop, t.ball[i]));
      circle(b.x, y, b.r, g, t.ball[4], 1.4);
    });
    circle(b.x - 3, y - 4, 2.2, t.highlight);
  }
  const particleDrawers = {
    star: (p) => star(p.x, p.y, p.r * 1.7, p.color),
    petal: (p) => {
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 1.8, p.life * 2, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.fill();
    },
    confetti: (p) => rounded(p.x, p.y, p.r * 1.6, p.r * 0.8, 0, p.color),
    spark: (p) => line(p.x, p.y, p.x - p.vx * 0.016, p.y - p.vy * 0.016, p.color, p.r),
    shard: (p) => {
      ctx.beginPath(); ctx.moveTo(p.x - p.r, p.y + p.r);
      ctx.lineTo(p.x + p.r * 2, p.y); ctx.lineTo(p.x, p.y - p.r * 2);
      ctx.closePath(); ctx.fillStyle = p.color; ctx.fill();
    },
    diamond: (p) => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
      rounded(-p.r, -p.r, p.r * 2, p.r * 2, 0, null, p.color);
      ctx.restore();
    },
  };
  function render() {
    ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.save();
    if (state.shake > 0) ctx.translate(Math.sin(state.time * 100) * state.shake, Math.cos(state.time * 110) * state.shake);
    drawBoard();
    drawBall();
    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      particleDrawers[activeTheme.canvas.particle](p);
    });
    ctx.globalAlpha = 1;
    state.texts.forEach((t) => {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      glow(t.color, 8, () => text(t.text, Math.max(95, Math.min(423, t.x)), t.y, t.large ? 25 : 17, t.color, '800'));
    });
    ctx.globalAlpha = 1;
    if (state.flash > 0) {
      ctx.globalAlpha = state.flash * 0.15;
      rounded(33, 68, 450, 566, activeTheme.canvas.corner, colors.gold);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = CONFIG.width * dpr;
    canvas.height = CONFIG.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame(now) {
    if (!previous) previous = now;
    accumulator += Math.min((now - previous) / 1000, 0.05);
    previous = now;
    while (accumulator >= CONFIG.step) {
      update(CONFIG.step);
      accumulator -= CONFIG.step;
    }
    render();
    requestAnimationFrame(frame);
  }
  function init() {
    bindCharge(canvas);
    bindCharge(ui.launch);
    ui.launch.addEventListener('click', (event) => {
      // Keyboard/assistive activation also gets a complete launch action.
      if (event.detail === 0 && state.mode === 'ready') {
        beginCharge({ x: 512, y: 578 });
        state.charge = 0.65;
        shootBall();
      }
    });
    ui.start.addEventListener('click', resetGame);
    ui.restart.addEventListener('click', resetGame);
    ui.overlayButton.addEventListener('click', resetGame);
    ui.sound.addEventListener('click', () => {
      state.sound = !state.sound;
      ui.sound.setAttribute('aria-pressed', String(state.sound));
      ui.sound.setAttribute('aria-label', state.sound ? '關閉音效' : '開啟音效');
      const label = ui.sound.querySelector('[data-sound-label]');
      if (label) label.textContent = state.sound ? '音效開啟' : '音效關閉';
      else ui.sound.textContent = state.sound ? '音效開啟' : '音效關閉';
      ui.sound.classList.toggle('muted', !state.sound);
      if (state.sound) { unlockAudio(); playTone(660, 0.08); }
    });
    const help = $('helpDialog');
    $('helpButton').addEventListener('click', () => {
      if (state.dragging) cancelCharge();
      help.showModal();
    });
    $('closeHelpButton').addEventListener('click', () => help.close());
    help.addEventListener('click', (event) => { if (event.target === help) help.close(); });
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' || event.repeat || help.open || event.target.closest('button, input, a')) return;
      event.preventDefault();
      if (state.mode === 'ready') {
        state.keyHeld = true;
        beginCharge({ x: 512, y: 578 });
      }
    });
    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space' && state.keyHeld) { event.preventDefault(); shootBall(); }
    });
    window.addEventListener('blur', () => { if (state.dragging) cancelCharge(); });
    document.addEventListener('visibilitychange', () => {
      previous = 0; accumulator = 0;
      if (document.hidden && state.dragging) cancelCharge();
    });
    window.addEventListener('resize', resize);
    ui.sound.setAttribute('aria-pressed', 'true');
    if (!storageOkay && $('storageNotice')) {
      $('storageNotice').hidden = false;
      $('storageNotice').textContent = '瀏覽器未允許儲存，最高分僅保留於本次頁面。';
    }
    resize();
    initThemeSystem();
    updateHUD();
    requestAnimationFrame(frame);
  }
  init();
})();
