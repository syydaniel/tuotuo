/* 坨坨 · abstract desktop pet engine.
   World units are CSS px with y pointing down. pet.x / pet.y is the bottom-center (feet) of the body.
   The engine is deterministic for a given seed and input sequence, so the same code runs the Mac app
   (host.js inside a WKWebView) and the promo recordings (stage.js in headless Chrome). */
'use strict';
(function (G) {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const sm = t => (t = clamp(t, 0, 1), t * t * (3 - 2 * t));
  const E = {
    out: t => 1 - Math.pow(1 - clamp(t, 0, 1), 3),
    in: t => Math.pow(clamp(t, 0, 1), 3),
    io: t => (t = clamp(t, 0, 1), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: t => { t = clamp(t, 0, 1); const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    el: t => { t = clamp(t, 0, 1); return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * TAU / 3) + 1; },
  };
  function hash(a, b) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function mkRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${lerp(A[0], B[0], t) | 0},${lerp(A[1], B[1], t) | 0},${lerp(A[2], B[2], t) | 0})`; }

  const INK = '#231f30';
  const FONT = '"ZK","PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif';
  const SKINS = [
    { name: '抹茶', body: '#a5e38c', shade: '#6fbf63' },
    { name: '芋泥', body: '#b9a4ff', shade: '#8a72e6' },
    { name: '蛋黄', body: '#ffd84f', shade: '#eeae28' },
    { name: '蜜桃', body: '#ffabc0', shade: '#ee7897' },
    { name: '汽水', body: '#86d6ff', shade: '#4ea6e3' },
    { name: '一坨色', body: '#c08a5c', shade: '#93613a' },
  ];
  const L = () => G.TUO_LINES;
  const MOODS = ['遥遥领先', '美丽', '稳定发疯', '良好（假的）', '在线但不完全在线', '已读', '抽象', '很难评'];

  // ------------------------------------------------------------------ drawing helpers
  function smooth(ctx, pts) {
    const n = pts.length;
    ctx.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    for (let i = 1; i <= n; i++) { const p = pts[i % n], q = pts[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    ctx.closePath();
  }
  // blob outline in body-local coords (origin = body center). Bottom is flatter; line "boils" like hand-drawn animation.
  function blobPts(rx, ry, jx, step, wob, t, seed = 0, N = 34) {
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, c = Math.cos(a), s = Math.sin(a);
      let x, y;
      if (s > 0) { y = ry * 0.8 * Math.pow(s, 0.62); x = rx * c * (1 + 0.05 * s); } else { y = ry * s; x = rx * c; }
      x += jx * Math.max(0, -y / ry);
      const w = wob * (Math.sin(a * 3 + t * 6) + 0.6 * Math.sin(a * 5 - t * 4.3));
      const d = (hash(i + seed * 97, step) - 0.5) * 1.9 + w;
      pts.push([x + c * d, y + s * d]);
    }
    return pts;
  }
  function wobblyRect(ctx, x, y, w, h, r, step, amp = 0.9) {
    const j = k => (hash(k, step) - 0.5) * 2 * amp;
    ctx.beginPath();
    ctx.moveTo(x + r, y + j(1)); ctx.lineTo(x + w - r, y + j(2)); ctx.quadraticCurveTo(x + w + j(3), y + j(4), x + w + j(5), y + r);
    ctx.lineTo(x + w + j(6), y + h - r); ctx.quadraticCurveTo(x + w + j(7), y + h + j(8), x + w - r, y + h + j(9));
    ctx.lineTo(x + r, y + h + j(10)); ctx.quadraticCurveTo(x + j(11), y + h + j(12), x + j(13), y + h - r);
    ctx.lineTo(x + j(14), y + r); ctx.quadraticCurveTo(x + j(15), y + j(16), x + r, y + j(1));
    ctx.closePath();
  }
  function heartPath(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35); ctx.closePath();
  }
  function star(ctx, x, y, r, k = 0.38) {
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, rr = i % 2 ? r * k : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath();
  }
  function label(ctx, s, x, y, px, fill, o = {}) {
    ctx.font = `${o.weight || ''} ${px}px ${FONT}`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    if (o.white !== false) { ctx.lineJoin = 'round'; ctx.lineWidth = px * 0.34; ctx.strokeStyle = '#fff'; ctx.strokeText(s, x, y); }
    if (o.ink !== false) { ctx.lineWidth = px * 0.12; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); }
    ctx.fillStyle = fill; ctx.fillText(s, x, y);
  }
  function inkLine(ctx, lw) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
  function fileIcon(ctx, x, y, s, ext, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-18, -24); ctx.lineTo(8, -24); ctx.lineTo(18, -14); ctx.lineTo(18, 24); ctx.lineTo(-18, 24); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); inkLine(ctx, 2.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -24); ctx.lineTo(8, -14); ctx.lineTo(18, -14); ctx.stroke();
    const col = { DOCX: '#2b6cd8', DOC: '#2b6cd8', PDF: '#e0443b', PPTX: '#e0772e', XLSX: '#23a05a', ZIP: '#8a6d3b', PNG: '#8a4de0', JPG: '#8a4de0' }[ext] || '#555';
    ctx.fillStyle = col; ctx.fillRect(-18, 4, 36, 12);
    ctx.font = `bold 9px -apple-system, "PingFang SC", sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((ext || '?').slice(0, 5), 0, 10.5);
    ctx.strokeStyle = '#c8c8d0'; ctx.lineWidth = 1.6; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-12, -14 + i * 6); ctx.lineTo(i === 2 ? 2 : 10, -14 + i * 6); ctx.stroke(); }
    ctx.restore();
  }

  // ------------------------------------------------------------------ particles
  const PD = {
    bub(ctx, q) { const a = 1 - seg(q.age, q.life * 0.7, q.life); ctx.globalAlpha = a; inkLine(ctx, 1.8); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(q.x + Math.sin(q.age * 7 + q.s) * 3, q.y, q.s, 0, TAU); ctx.fill(); ctx.stroke(); },
    txt(ctx, q) {
      const a = 1 - seg(q.age, q.life * 0.65, q.life), k = E.back(seg(q.age, 0, 0.18));
      ctx.globalAlpha = a; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.scale(k, k); label(ctx, q.txt, 0, 0, q.s, q.c || INK); ctx.restore();
    },
    shard(ctx, q) {
      ctx.globalAlpha = 1 - seg(q.age, q.life * 0.7, q.life); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r);
      ctx.beginPath(); q.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = q.c; ctx.fill(); inkLine(ctx, 2); ctx.stroke();
      if (q.txt) { ctx.clip(); label(ctx, q.txt, -q.ox, -q.oy, q.ts, INK, { white: false, ink: false }); }
      ctx.restore();
    },
    crumb(ctx, q) { ctx.globalAlpha = 1 - seg(q.age, q.life * 0.7, q.life); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, TAU); ctx.fill(); inkLine(ctx, 1.2); ctx.stroke(); },
    spark(ctx, q) { const k = Math.sin(seg(q.age, 0, q.life) * Math.PI); ctx.globalAlpha = 1; ctx.fillStyle = q.c || '#ffe25a'; star(ctx, q.x, q.y, q.s * k); ctx.fill(); inkLine(ctx, 1.4); ctx.stroke(); },
    drop(ctx, q) { ctx.globalAlpha = 1 - seg(q.age, q.life * 0.8, q.life); ctx.strokeStyle = '#3d7fd9'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.02, q.y - 11); ctx.stroke(); },
    tear(ctx, q) { ctx.globalAlpha = 1 - seg(q.age, q.life * 0.7, q.life); ctx.fillStyle = '#6ec1ff'; ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, TAU); ctx.fill(); inkLine(ctx, 1.3); ctx.stroke(); },
    smoke(ctx, q) { const u = q.age / q.life; ctx.globalAlpha = 0.75 * (1 - u); ctx.fillStyle = q.c || '#9aa0ab'; ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (0.5 + u * 1.3), 0, TAU); ctx.fill(); inkLine(ctx, 1.5); ctx.globalAlpha *= 0.6; ctx.stroke(); },
    heart(ctx, q) { const k = E.back(seg(q.age, 0, 0.2)); ctx.globalAlpha = 1 - seg(q.age, q.life * 0.7, q.life); heartPath(ctx, q.x, q.y, q.s * k); ctx.fillStyle = '#ff6b8e'; ctx.fill(); inkLine(ctx, 1.6); ctx.stroke(); },
    z(ctx, q) { const u = q.age / q.life; ctx.globalAlpha = 1 - u; label(ctx, q.txt || 'z', q.x + Math.sin(q.age * 3) * 5, q.y, q.s * (0.6 + u * 0.8), '#fff'); },
    dust(ctx, q) { const u = q.age / q.life; ctx.globalAlpha = 0.9 * (1 - u); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (0.6 + u), 0, TAU); ctx.fill(); inkLine(ctx, 1.6); ctx.stroke(); },
    stink(ctx, q) {
      const u = q.age / q.life; ctx.globalAlpha = Math.sin(u * Math.PI); ctx.strokeStyle = '#6fbf4a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const yy = q.y - i * 3.2; ctx.lineTo(q.x + Math.sin(i * 0.9 + q.age * 6) * 5, yy); } ctx.stroke();
    },
    line(ctx, q) { ctx.globalAlpha = 1 - q.age / q.life; inkLine(ctx, 2.5); ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + q.s, q.y); ctx.stroke(); },
    file(ctx, q) { ctx.globalAlpha = 1 - seg(q.age, q.life * 0.75, q.life); fileIcon(ctx, q.x, q.y, q.s, q.txt, q.r); },
    ghost(ctx, q, p) { ctx.globalAlpha = 0.28 * (1 - q.age / q.life); p.drawBody(ctx, q.rs); },
  };

  // ------------------------------------------------------------------ the pet
  class Pet {
    constructor(o = {}) {
      this.o = o;
      this.rand = mkRng(o.seed != null ? o.seed : (Math.random() * 1e9) | 0);
      this.sfx = o.sfx || new G.TuoSfx();
      this.clock = o.clock || (() => new Date());
      this.W = 1440; this.H = 900; this.floorY = 820; this.ceilY = 30;
      this.wins = []; this.plats = [{ id: 'floor', x0: 0, x1: this.W, y: this.floorY }];
      this.size = 1; this.skinI = o.skin != null ? o.skin : 1;
      this.x = 400; this.y = this.floorY; this.vx = 0; this.vy = 0; this.plat = this.plats[0]; this.air = false; this.face = 1; this.rot = 0;
      this.sx = 1; this.sy = 1; this.jig = 0; this.jigV = 0; this.jx = 0; this.jxV = 0; this.legLift = 0; this.legPh = 0; this.legMode = 'walk';
      this.look = { x: 0, y: 0 }; this.lookT = { x: 0, y: 0 }; this.blinkAmt = 0; this.blinkT = -1; this.nextBlink = 2.5; this.swap = 0; this.swapS = 0; this.nextSwap = 25;
      this.mode = 'idle'; this.mt = 0; this.md = { dur: 1.5 };
      this.act = null; this.t = 0; this.recent = []; this.recentLines = [];
      this.parts = []; this.bubble = null; this.bq = []; this.cards = []; this.acc = {}; this.ball = null; this.pie = null; this.ask = null;
      this.mouse = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, down: false, still: 0, idle: 0, hover: 0, fast: 0, seen: false };
      this.grab = null; this.clicks = []; this.quiet = false; this.hidden = false; this.offWork = 0; this.fedOnce = false; this.fileHov = false;
      this.timers = { talk: 25, act: 70, ball: 260, pat: 8, hurry: 0, clock: 3 };
      this.done = {}; this.battery = null; this.bb = null; this.moodI = 0; this.moodT = 0;
      this.onQuit = o.onQuit || (() => { }); this.onStatus = o.onStatus || (() => { });
      this.sfx.clock = () => this.t;
      this.lastStatus = '';
    }
    get R() { return 34 * this.size; }
    r() { return this.rand(); }
    pick(arr) { return arr[(this.r() * arr.length) | 0]; }

    // ---------------------------------------------------------------- world input
    setWorld(o) {
      Object.assign(this, o);
      if (!this.act && !this.air && !this.grab) { this.y = Math.min(this.y, this.floorY); }
      this.x = clamp(this.x, this.R, this.W - this.R);
      this.computePlats();
    }
    setWindows(list) {
      const old = this.plat && this.plat.wid != null ? this.wins.find(w => w.id === this.plat.wid) : null;
      const oldWin = old ? { x: old.x, y: old.y } : null;
      this.wins = list || [];
      this.computePlats();
      if (this.plat && this.plat.wid != null) {
        const w = this.wins.find(w => w.id === this.plat.wid);
        if (w && oldWin && !this.act && !this.grab && !this.air) { this.x += w.x - oldWin.x; this.y = w.y; }
        const np = this.plats.find(p => p.wid === this.plat.wid && this.x >= p.x0 - 4 && this.x <= p.x1 + 4 && Math.abs(p.y - this.y) < 3);
        if (np) this.plat = np; else if (!this.act && !this.grab) { this.plat = null; this.air = true; this.vy = Math.max(this.vy, 0); }
      }
    }
    computePlats() {
      const P = [{ id: 'floor', x0: 0, x1: this.W, y: this.floorY }], ws = this.wins;
      ws.forEach((w, i) => {
        const y = w.y;
        if (y < this.ceilY + 90 || y > this.floorY - 40 || w.w < 120) return;
        let segs = [[Math.max(0, w.x), Math.min(this.W, w.x + w.w)]];
        for (let j = 0; j < i; j++) {
          const f = ws[j];
          if (f.y <= y + 2 && f.y + f.h > y - 2) segs = segs.flatMap(([a, b]) => { const out = []; if (f.x > a) out.push([a, Math.min(b, f.x)]); if (f.x + f.w < b) out.push([Math.max(a, f.x + f.w), b]); return out.filter(([c, d]) => d - c > 1); });
        }
        segs.forEach((s, k) => { if (s[1] - s[0] >= 90) P.push({ id: `${w.id}:${k}`, wid: w.id, x0: s[0], x1: s[1], y }); });
      });
      this.plats = P;
      if (this.plat && this.plat.id === 'floor') this.plat = P[0];
    }
    setMouse(x, y, down) {
      const m = this.mouse;
      if (Math.abs(x - m.x) + Math.abs(y - m.y) > 0.5) { m.idle = 0; if (this.mode === 'sleep' && !this.act) this.wake(); }
      m.x = x; m.y = y; m.seen = true;
      if (down != null) m.down = down;
      if (this.grab && !this.grab.drag && Math.hypot(x - this.grab.x0, y - this.grab.y0) > 6) this.startDrag();
      if (this.ask) this.askHover(x, y);
    }
    setBattery(level, charging) { this.battery = { level, charging }; }
    inBody(x, y, pad = 0) { const b = this.bb; return !!b && !this.hidden && x >= b[0] - pad && x <= b[0] + b[2] + pad && y >= b[1] - pad && y <= b[1] + b[3] + pad; }
    pointerDown(x, y) {
      this.setMouse(x, y, true); this.sfx.ensure();
      if (this.ask) return this.askClick(x, y);
      if (this.pie && this.pie.state === 'ready' && Math.hypot(x - this.pie.x, y - this.pie.y) < this.pie.r + 8) { this.pie.hit = true; return true; }
      if (this.ball && this.ball.state === 'rest' && Math.hypot(x - this.ball.x, y - this.ball.y) < 20) { this.ballBack(); return true; }
      if (this.inBody(x, y, 4)) { this.grab = { x0: x, y0: y, t: this.t, drag: false }; return true; }
      return false;
    }
    pointerUp(x, y) {
      this.setMouse(x, y, false);
      const g = this.grab; this.grab = null;
      if (!g) return;
      if (g.drag) this.release(); else this.click();
    }
    hitRects() {
      const H = [];
      if (this.bb && !this.hidden) { const b = this.bb, pad = this.fileHov ? 30 : 4; H.push([b[0] - pad, b[1] - pad, b[2] + pad * 2, b[3] + pad * 2]); }
      if (this.ball && this.ball.state === 'rest') H.push([this.ball.x - 18, this.ball.y - 18, 36, 36]);
      if (this.pie && this.pie.state === 'ready') H.push([this.pie.x - this.pie.r - 6, this.pie.y - this.pie.r - 6, this.pie.r * 2 + 12, this.pie.r * 2 + 12]);
      if (this.ask) for (const b of [this.ask.yes, this.ask.no]) H.push([b.x - b.w / 2 - 30, b.y - b.h / 2 - 30, b.w + 60, b.h + 60]);
      return H;
    }

    // ---------------------------------------------------------------- talking
    voicePitch() { return 600 / Math.sqrt(this.size); }
    say(text, o = {}) {
      if (!text || (this.noSay && !o.force)) return;
      const b = { text: String(text), t: -(o.delay || 0), cps: o.cps || 13, hold: o.hold != null ? o.hold : 1.3 + [...String(text)].length * 0.09, sound: o.sound !== false, pitch: o.pitch, voiced: false, below: o.below, side: o.side };
      if (o.queue && this.bubble) this.bq.push(b); else { this.bubble = b; this.bq = []; }
    }
    card(word, col) { const top = this.bb ? this.bb[1] : this.y - this.R * 2; this.cards.push({ word, col: col || '#ff5a5f', t: 0, x: this.x, y: top }); }
    pickLine() {
      const d = this.clock(), h = d.getHours(), wd = d.getDay(), mi = d.getMinutes(), T = L();
      const special = [];
      if (h < 5) special.push(T.night); else if (h >= 6 && h < 9) special.push(T.morning);
      if (h === 12) special.push(T.lunch); if (h === 14) special.push(T.afternoon);
      if (wd === 5 && h >= 13) special.push(T.friday); if (wd === 0 || wd === 6) special.push(T.weekend);
      if (wd >= 1 && wd <= 5 && h === 17 && mi >= 15) special.push(T.preOff.map(s => s.replace('{m}', 60 - mi)));
      const pool = special.length && this.r() < 0.5 ? this.pick(special) : T.idle;
      let s; for (let k = 0; k < 6; k++) { s = this.pick(pool); if (!this.recentLines.includes(s)) break; }
      this.recentLines.push(s); if (this.recentLines.length > 12) this.recentLines.shift();
      return s;
    }
    emit(k, o) { this.parts.push(Object.assign({ k, x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 1, age: 0, r: 0, vr: 0, s: 6, drag: 0 }, o)); }
    poof(x, y, n = 8) {
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU + this.r() * 0.5; this.emit('dust', { x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 6, vx: Math.cos(a) * 140, vy: Math.sin(a) * 70 - 20, drag: 4, life: 0.5 + this.r() * 0.2, s: 7 + this.r() * 5 }); }
      this.sfx.play('pop');
    }
    status() {
      if (this.hidden && this.offWork > 0) return '精神状态：已下班';
      if (this.hidden) return '精神状态：润了';
      if (this.act) return '精神状态：' + (this.act.A.status || this.act.A.word || '忙');
      if (this.mode === 'sleep') return '精神状态：睡着了（假的）';
      return '精神状态：' + MOODS[this.moodI];
    }

    // ---------------------------------------------------------------- modes
    setMode(m, d = {}) { this.mode = m; this.mt = 0; this.md = d; }
    wake() { this.setMode('idle', { dur: 1.2 }); this.jigV += 6; this.say(this.pick(L().wake)); }
    think() {
      const T = this.timers, R = this.R;
      if (!this.quiet && T.act <= 0) { T.act = 80 + this.r() * 140; return this.play(this.pickAct('auto')); }
      if (T.ball <= 0 && !this.ball && !this.quiet) { T.ball = 300 + this.r() * 300; return this.play('throw'); }
      if (!this.quiet && T.talk <= 0) { T.talk = 40 + this.r() * 70; this.say(this.pickLine()); }
      const r = this.r(), p = this.plat || this.plats[0];
      const x0 = Math.max(p.x0, 0) + R * 1.3, x1 = Math.min(p.x1, this.W) - R * 1.3;
      if (r < 0.1 && p.wid != null) {                                // hop off the window edge
        const tx = this.r() < 0.5 ? p.x0 - R * 1.2 : p.x1 + R * 1.2;
        if (tx > R && tx < this.W - R) return this.setMode('walk', { tx, sp: 75 * this.size, moon: false });
      }
      if (r < 0.2) {                                                 // jump onto a window top
        const c = this.plats.filter(q => q !== p && q.y < this.y - 60 && q.y > this.y - 430 && q.x1 > this.x - 380 && q.x0 < this.x + 380 && q.x1 - q.x0 > R * 3);
        if (c.length) {
          const q = this.pick(c), tx = clamp(this.x + (this.r() - 0.5) * 200, q.x0 + R * 1.4, q.x1 - R * 1.4);
          return this.setMode('crouch', { tx, ty: q.y });
        }
      }
      if (r < 0.62 && x1 > x0) {
        let tx = clamp(this.x + (this.r() < 0.5 ? -1 : 1) * (80 + this.r() * 320), x0, x1);
        if (Math.abs(tx - this.x) < 30) tx = clamp(this.x + (tx < this.x ? 120 : -120), x0, x1);
        return this.setMode('walk', { tx, sp: (55 + this.r() * 35) * this.size, moon: this.r() < 0.13 });
      }
      if (r < 0.8) { this.lookT = { x: this.r() * 2 - 1, y: this.r() - 0.6 }; return this.setMode('idle', { dur: 1.5 + this.r() * 2 }); }
      this.setMode('idle', { dur: 2 + this.r() * 3 });
    }
    pickAct(pool) {
      const ids = Object.keys(ACTS).filter(k => ACTS[k][pool] && !this.recent.includes(k));
      return this.pick(ids.length ? ids : Object.keys(ACTS).filter(k => ACTS[k][pool]));
    }

    // ---------------------------------------------------------------- acts
    play(id, o = {}) {
      const A = ACTS[id]; if (!A) return;
      if (this.act) this.endAct(true);
      if (this.grab) this.grab = null;
      if (this.hidden && !A.hiddenOk) { this.hidden = false; this.offWork = 0; this.x = clamp(this.x, this.R * 2, this.W - this.R * 2); this.y = this.floorY; this.plat = this.plats[0]; this.poof(this.x, this.y - this.R); }
      if (this.air) { this.air = false; this.y = this.plat ? this.plat.y : this.floorY; }
      this.rot = 0; this.setMode('idle', { dur: 1 });
      const a = this.act = { id, A, t: 0, o };
      this.recent.push(id); if (this.recent.length > 7) this.recent.shift();
      if (A.word && !o.noCard) this.card(A.word, A.col);
      if (A.start) A.start(this, a);
    }
    endAct(cancel) {
      const a = this.act; if (!a) return;
      this.act = null;
      if (a.A.end) a.A.end(this, a, cancel);
      this.rot = 0; this.sx = 1; this.sy = 1;
      if (!this.hidden && !this.air) {
        const p = this.plats.find(q => this.x >= q.x0 && this.x <= q.x1 && Math.abs(q.y - this.y) < 2);
        if (p) this.plat = p; else { this.air = true; this.vy = 0; }
      }
      this.setMode('idle', { dur: 1 + this.r() * 1.5 });
    }
    click() {
      const now = this.t; this.clicks = this.clicks.filter(c => now - c < 1.6); this.clicks.push(now);
      this.sfx.ensure(); this.jigV += 7;
      if (this.clicks.length >= 4 && (!this.act || this.act.id !== 'fafeng')) { this.clicks = []; this.say(L().clickSpam[0]); return this.play('fafeng'); }
      if (this.act) { if (this.act.A.click && this.act.A.click(this, this.act)) return; if (this.act.t > 0.8) this.say(this.pick(L().busy)); return; }
      if (this.mode === 'sleep') return this.wake();
      this.play(this.pickAct('click'));
    }
    startDrag() {
      this.grab.drag = true; if (this.act) this.endAct(true);
      this.air = false; this.plat = null; this.setMode('drag'); this.sway = 0; this.swayV = 0;
      if (this.r() < 0.7) this.say(this.pick(L().drag));
      this.sfx.play('boing', { f: 220 });
    }
    release() {
      const m = this.mouse; this.air = true; this.vx = clamp(m.vx, -2600, 2600); this.vy = clamp(m.vy, -2600, 2600); this.airT = 0; this.thrown = Math.hypot(this.vx, this.vy) > 900;
      this.rot = 0; this.setMode('idle', { dur: 1 });
    }
    command(name, arg) {
      const T = L();
      this.sfx.ensure();
      switch (name) {
        case 'act': return this.play(arg);
        case 'random': return this.play(this.pickAct('click'));
        case 'petted': return this.play('petted');
        case 'feedHint': if (this.hidden) this.play('petted'); return this.say(T.feedHint[0]);
        case 'quiet': this.quiet = arg != null ? !!arg : !this.quiet; this.quietT = 1800; return this.say(this.quiet ? T.quietOn : T.quietOff);
        case 'mute': this.sfx.muted = arg != null ? !!arg : !this.sfx.muted; return;
        case 'skin': this.skinI = arg != null ? arg : (this.skinI + 1) % SKINS.length; if (!this.hidden) { this.poof(this.x, this.y - this.R); this.say(T.skin); } return;
        case 'size': this.size = arg; this.jigV += 8; return;
        case 'summon': {
          if (this.act) this.endAct(true);
          this.hidden = false; this.offWork = 0; this.air = true; this.vy = 0; this.vx = 0;
          this.x = clamp(this.mouse.seen ? this.mouse.x : this.W / 2, this.R * 2, this.W - this.R * 2); this.y = clamp((this.mouse.seen ? this.mouse.y : this.H / 2) - 40, this.ceilY + this.R * 2.5, this.floorY);
          this.poof(this.x, this.y - this.R); return this.say(this.pick(T.summon));
        }
        case 'back': if (this.hidden) this.play('comeback', { line: this.pick(T.backToWork) }); return;
        case 'leave': return this.startLeave();
        case 'ball': return this.play('throw');
      }
    }
    feedHover(on, x, y) {
      this.fileHov = on;
      if (on) { this.setMouse(x, y); if (!this.act && !this.hidden && this.mode !== 'expect') { this.setMode('expect'); this.say(this.pick(L().feedOpen), { hold: 3 }); } }
      else if (this.mode === 'expect') this.setMode('idle', { dur: 1 });
    }
    feed(names, x, y) {
      this.fileHov = false;
      if (!names || !names.length) return;
      this.play('eat', { names, x: x != null ? x : this.x + 120, y: y != null ? y : this.y - 120 });
    }

    // ---------------------------------------------------------------- quit drama
    startLeave() {
      if (this.act) this.endAct(true);
      if (this.hidden) { this.hidden = false; this.x = this.W / 2; this.y = this.floorY; this.plat = this.plats[0]; }
      const cx = clamp(this.x, 150, this.W - 150), cy = this.y - this.R * 0.9;
      this.ask = { t: 0, dodges: 0, yes: { x: cx - this.R * 2.9, y: cy, w: 96, h: 40, lab: '真的走', k: 1 }, no: { x: cx + this.R * 2.9, y: cy, w: 96, h: 40, lab: '算了', k: 1 } };
      this.say(L().leaveAsk, { hold: 99, below: false });
    }
    askHover(x, y) {
      const A = this.ask, b = A.yes;
      const inside = Math.abs(x - b.x) < b.w / 2 + 6 && Math.abs(y - b.y) < b.h / 2 + 6;
      if (inside && A.dodges < 2 && this.t - (A.lastDodge || -9) > 0.25) {
        A.dodges++; A.lastDodge = this.t;
        let nx, ny, k = 0;
        do { nx = clamp(this.x + (this.r() - 0.5) * 300, 70, this.W - 70); ny = clamp(this.y - this.R * 1.2 + (this.r() - 0.5) * 170, this.ceilY + 40, this.floorY - 26); k++; }
        while (k < 30 && (Math.hypot(nx - x, ny - y) < 110 || Math.hypot(nx - A.no.x, ny - A.no.y) < 110 || Math.abs(nx - this.x) < this.R * 1.6 && Math.abs(ny - (this.y - this.R)) < this.R * 1.4 ||
          Math.abs(nx - this.x) < 175 && ny < this.y - this.R * 1.5));
        A.from = { x: b.x, y: b.y, t: this.t }; b.x = nx; b.y = ny;
        this.emit('txt', { x: nx, y: ny - 36, vy: -30, life: 1.2, txt: this.pick(L().leaveDodge), s: 19, c: '#ff4d6d' });
        this.sfx.play('swish');
      }
    }
    askClick(x, y) {
      const A = this.ask, hit = b => Math.abs(x - b.x) < b.w / 2 + 4 && Math.abs(y - b.y) < b.h / 2 + 4;
      if (hit(A.yes) && A.dodges >= 2) { this.ask = null; this.bubble = null; this.play('goodbye'); return true; }
      if (hit(A.no)) { this.ask = null; this.say(L().leaveStay[0]); this.hearts(4); return true; }
      if (hit(A.yes)) { this.askHover(x, y); return true; }
      return true;
    }
    hearts(n) { for (let i = 0; i < n; i++) this.emit('heart', { x: this.x + (this.r() - 0.5) * 60, y: this.y - this.R * 1.8, vx: (this.r() - 0.5) * 60, vy: -70 - this.r() * 50, life: 1.3, s: 9 + this.r() * 4 }); this.sfx.play('heart'); }

    // ---------------------------------------------------------------- ball (the cursor is the pet)
    ballBack() { const b = this.ball; b.state = 'back'; b.t = 0; b.fx = b.x; b.fy = b.y; this.sfx.play('whoosh', { d: 0.3 }); }
    stepBall(dt) {
      const b = this.ball; if (!b) return;
      b.t += dt;
      if (b.state === 'fly') {
        const py = b.y; b.vy += 2200 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.spin += b.vx * dt * 0.08;
        if (b.x < 10 || b.x > this.W - 10) { b.vx *= -0.6; b.x = clamp(b.x, 10, this.W - 10); }
        if (b.vy > 0) for (const q of this.plats) if (b.x >= q.x0 && b.x <= q.x1 && py <= q.y - 9 && b.y >= q.y - 9) {
          b.y = q.y - 9; b.vy *= -0.45; b.vx *= 0.7; if (Math.abs(b.vy) > 80) this.sfx.play('tick');
          if (Math.abs(b.vy) < 60) { b.vy = 0; b.state = 'rest'; b.t = 0; b.plat = q; }
          break;
        }
        if (b.y > this.H + 50) this.ball = null;
      } else if (b.state === 'rest') {
        if (b.plat && b.plat.wid != null && !this.plats.find(q => q.wid === b.plat.wid)) { b.state = 'fly'; b.vy = 0; }
        if (b.t > 11 && !this.act && !this.grab && !this.air && this.mode !== 'fetch' && !this.hidden) {
          this.say(this.pick(L().ballSelf)); this.setMode('walk', { tx: clamp(b.x, this.R, this.W - this.R), sp: 90 * this.size, fetch: true });
        }
      } else if (b.state === 'back') {
        const u = E.io(b.t / 0.6), tx = this.x + this.face * this.R * 0.9, ty = this.y - this.R * 1.1;
        b.x = lerp(b.fx, tx, u); b.y = lerp(b.fy, ty, u) - Math.sin(u * Math.PI) * 120;
        if (b.t >= 0.6) { this.ball = null; this.play('goodboy'); }
      }
    }
    drawBall(ctx) {
      const b = this.ball; if (!b) return;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin || 0);
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fillStyle = '#d8f25a'; ctx.fill(); inkLine(ctx, 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(-9, 0, 7, -0.9, 0.9); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.restore();
      if (b.state === 'rest' && Math.floor(b.t * 2) % 2 === 0 && b.t < 11) label(ctx, '捡我', b.x, b.y - 24, 13, '#fff');
    }

    // ---------------------------------------------------------------- simulation
    update(dt) {
      dt = Math.min(dt, 1 / 20); this.t += dt;
      const m = this.mouse, T = this.timers;
      // mouse velocity + idle/hover bookkeeping
      if (m.px > -9000) { const ivx = (m.x - m.px) / dt, ivy = (m.y - m.py) / dt; m.vx = lerp(m.vx, ivx, 0.5); m.vy = lerp(m.vy, ivy, 0.5); }
      m.px = m.x; m.py = m.y; m.idle += dt;
      const sp = Math.hypot(m.vx, m.vy);
      m.fast = sp > 3200 && !this.grab ? m.fast + dt : 0;
      m.hover = this.inBody(m.x, m.y) && !m.down && sp < 60 ? m.hover + dt : 0;
      for (const k in T) T[k] -= dt;
      if (this.quiet && (this.quietT -= dt) <= 0) { this.quiet = false; this.say(L().quietOff); }
      if ((this.moodT -= dt) <= 0) { this.moodT = 20 + this.r() * 40; this.moodI = (this.r() * MOODS.length) | 0; }
      for (const k in this.acc) if ((this.acc[k] -= dt) <= 0) delete this.acc[k];

      if (this.hidden) {
        if (this.offWork > 0 && (this.offWork -= dt) <= 0 && !this.act) this.play('comeback', { line: this.pick(L().backToWork) });
      }
      if (this.grab && this.grab.drag) this.stepDrag(dt);
      else if (this.act) { const a = this.act; a.t += dt; const done = a.A.update ? a.A.update(this, a, dt) : a.t >= a.A.dur; if (done || a.t > (a.A.max || 40)) this.endAct(false); }
      else if (!this.hidden) this.stepBase(dt);

      // reactive bits
      if (!this.act && !this.grab && !this.hidden && !this.ask) {
        if (m.hover > 1.6 && T.pat <= 0) { T.pat = 35; this.play('pat'); }
        else if (m.fast > 0.25 && T.hurry <= 0 && !this.quiet) { T.hurry = 90; this.say(this.pick(L().hurry)); this.lookT = { x: Math.sign(m.x - this.x), y: -0.3 }; }
        else if (m.idle > 300 && this.mode !== 'sleep' && !this.air && this.mode !== 'drag') { this.setMode('sleep'); }
      }
      if (this.o.clockTriggers && T.clock <= 0) { T.clock = 20; this.clockTriggers(); }

      this.stepFace(dt);
      this.stepBall(dt);
      if (this.ask && (this.ask.t += dt) > 15) { this.ask = null; this.say(L().leaveStay[1]); }
      for (const q of this.parts) {
        q.age += dt; q.vy += q.g * dt;
        if (q.drag) { const f = Math.exp(-q.drag * dt); q.vx *= f; q.vy *= f; }
        q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt;
        if (q.floor != null && q.y > q.floor) { q.y = q.floor; q.vy *= -0.3; q.vx *= 0.6; q.vr *= 0.5; }
      }
      this.parts = this.parts.filter(q => q.age < q.life);
      if (this.bubble) {
        const b = this.bubble; b.t += dt;
        if (b.t >= 0 && !b.voiced) { b.voiced = true; if (b.sound) this.sfx.play('babble', { text: b.text, cps: b.cps, pitch: b.pitch || this.voicePitch() }); }
        if (b.t > [...b.text].length / b.cps + b.hold + 0.25) this.bubble = this.bq.shift() || null;
      }
      for (const c of this.cards) c.t += dt;
      this.cards = this.cards.filter(c => c.t < 2.1);
      const st = this.status(); if (st !== this.lastStatus) { this.lastStatus = st; this.onStatus(st); }
    }
    clockTriggers() {
      if (this.act || this.hidden || this.grab || this.ask) return;
      const d = this.clock(), h = d.getHours(), mi = d.getMinutes(), wd = d.getDay(), day = d.toDateString();
      if (wd >= 1 && wd <= 5 && h === 18 && mi < 10 && this.done.off !== day) { this.done.off = day; return this.play('xiaban', { stay: 600 }); }
      if (wd === 1 && h >= 8 && h < 12 && this.done.mon !== day) { this.done.mon = day; this.play('liekai', { line: L().monday[0] }); return; }
      const b = this.battery;
      if (b && b.level < 0.2 && !b.charging && (this.done.bat == null || this.t - this.done.bat > 3600)) { this.done.bat = this.t; this.play('tangping', { line: L().lowBattery[0] }); }
    }
    stepFace(dt) {
      const m = this.mouse;
      // eyes: follow the cursor when it is near, otherwise wander
      if (m.seen && Math.hypot(m.x - this.x, m.y - this.y) < 650 && m.idle < 8) {
        const dx = m.x - this.x, dy = m.y - (this.y - this.R);
        const d = Math.max(60, Math.hypot(dx, dy)); this.lookT = { x: clamp(dx / d * 1.2, -1, 1), y: clamp(dy / d * 1.2, -1, 1) };
      }
      this.look.x = lerp(this.look.x, this.lookT.x, 1 - Math.exp(-dt * 10)); this.look.y = lerp(this.look.y, this.lookT.y, 1 - Math.exp(-dt * 10));
      if ((this.nextBlink -= dt) <= 0) { this.blinkT = 0; this.nextBlink = 2 + this.r() * 4; }
      if (this.blinkT >= 0) { this.blinkT += dt; this.blinkAmt = Math.sin(clamp(this.blinkT / 0.16, 0, 1) * Math.PI); if (this.blinkT > 0.16) { this.blinkT = -1; this.blinkAmt = 0; } }
      if ((this.nextSwap -= dt) <= 0) { this.nextSwap = 30 + this.r() * 60; this.swap = 1 - this.swap; this.sfx.play('tick'); }
      this.swapS = lerp(this.swapS, this.swap, 1 - Math.exp(-dt * 9));
      // jelly springs
      this.jigV += (-190 * this.jig - 9 * this.jigV) * dt; this.jig += this.jigV * dt;
      this.jxV += (-160 * this.jx - 8 * this.jxV) * dt; this.jx += this.jxV * dt;
      const walking = (this.mode === 'walk' || this.mode === 'drag' || this.air) && !this.act;
      this.legLift = lerp(this.legLift, walking ? 1 : 0, 1 - Math.exp(-dt * 12));
      if (this.mode === 'sleep' && Math.floor(this.t / 1.3) !== Math.floor((this.t - dt) / 1.3)) this.emit('z', { x: this.x + this.R * 0.8, y: this.y - this.R * 1.7, vy: -28, vx: 12, life: 1.6, s: 16, txt: this.r() < 0.5 ? 'z' : 'Z' });
    }
    stepBase(dt) {
      this.mt += dt;
      if (this.air) return this.stepAir(dt);
      const R = this.R;
      switch (this.mode) {
        case 'idle': if (this.mt > (this.md.dur || 1)) this.think(); break;
        case 'walk': {
          const dir = Math.sign(this.md.tx - this.x) || 1, sp = this.md.sp;
          this.x += dir * Math.min(sp * dt, Math.abs(this.md.tx - this.x)); this.face = this.md.moon ? -dir : dir; this.legPh += dt * sp / 7; this.legMode = 'walk';
          this.jx = lerp(this.jx, -dir * 2, 0.1);
          if (Math.abs(this.md.tx - this.x) < 1) {
            if (this.md.fetch && this.ball) { this.ball = null; this.sfx.play('pop'); this.say('捡到了，下次你去。'); }
            this.setMode('idle', { dur: 0.8 + this.r() * 2.2 });
          }
          if (this.plat && this.plat.wid != null && (this.x < this.plat.x0 - 3 || this.x > this.plat.x1 + 3)) { this.air = true; this.vy = 0; this.vx = dir * sp; this.plat = null; }
          break;
        }
        case 'crouch':
          this.sy = lerp(1, 0.72, E.out(this.mt / 0.18)); this.sx = 2 - this.sy;
          if (this.mt > 0.18) {
            const g = 2600, Tt = 0.62, dx = this.md.tx - this.x, dy = this.md.ty - this.y;
            this.vx = dx / Tt; this.vy = (dy - 0.5 * g * Tt * Tt) / Tt; this.air = true; this.plat = null; this.sx = 0.85; this.sy = 1.25; this.face = Math.sign(dx) || 1;
            this.sfx.play('boing'); this.setMode('idle', { dur: 1 });
          }
          break;
        case 'sleep': break;
        case 'expect': if (this.mt > 5) this.setMode('idle', { dur: 1 }); break;
        case 'dizzy': if (this.mt > 2) this.setMode('idle', { dur: 1 }); break;
      }
      this.sx = lerp(this.sx, 1, 1 - Math.exp(-dt * 10)); this.sy = lerp(this.sy, 1, 1 - Math.exp(-dt * 10));
    }
    stepAir(dt) {
      const R = this.R, g = 2600, py = this.y;
      this.airT = (this.airT || 0) + dt;
      this.vy += g * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.legMode = 'dangle';
      if (this.x < R) { this.x = R; this.vx = Math.abs(this.vx) * 0.55; this.jxV -= 30; this.sfx.play('land', { v: 0.3 }); }
      if (this.x > this.W - R) { this.x = this.W - R; this.vx = -Math.abs(this.vx) * 0.55; this.jxV += 30; this.sfx.play('land', { v: 0.3 }); }
      if (this.y - R * 1.9 < this.ceilY && this.vy < 0) { this.y = this.ceilY + R * 1.9; this.vy = -this.vy * 0.4; }
      const stretch = clamp(Math.abs(this.vy) / 2500, 0, 0.25); this.sy = 1 + stretch; this.sx = 1 - stretch * 0.6;
      if (this.vy > 0) for (const q of this.plats) {
        if (this.x >= q.x0 && this.x <= q.x1 && py <= q.y + 0.5 && this.y >= q.y) { this.land(q); break; }
      }
      if (this.y > this.H + 300) { this.y = this.floorY; this.x = this.W / 2; this.land(this.plats[0]); }
    }
    land(q) {
      const imp = this.vy; this.y = q.y; this.plat = q; this.air = false; this.vy = 0; this.vx = 0; this.sx = 1; this.sy = 1;
      this.jigV += clamp(imp / 160, 2, 16); this.sfx.play('land', { v: clamp(imp / 1600, 0.2, 1) });
      if (imp > 900) for (let i = 0; i < 4; i++) this.emit('dust', { x: this.x + (i < 2 ? -1 : 1) * this.R * (0.6 + this.r() * 0.4), y: this.y - 4, vx: (i < 2 ? -1 : 1) * (90 + this.r() * 60), vy: -30, drag: 5, life: 0.45, s: 6 });
      if (this.thrown && imp > 1500) { this.setMode('dizzy'); this.say(this.pick(L().dizzy)); } else this.setMode('idle', { dur: 0.6 + this.r() });
      this.thrown = false;
    }
    stepDrag(dt) {
      const m = this.mouse, R = this.R;
      this.x = m.x; this.y = m.y + R * 1.9;
      const tgt = clamp(-m.vx * 0.00045, -0.75, 0.75);
      this.swayV += ((tgt - this.sway) * 90 - this.swayV * 7) * dt; this.sway += this.swayV * dt;
      this.sx = 0.88; this.sy = 1.16; this.legMode = 'dangle'; this.lookT = { x: 0, y: 1 };
    }

    // ---------------------------------------------------------------- rendering
    baseRS() {
      const sk = SKINS[this.skinI], R = this.R;
      const breath = this.mode === 'sleep' ? 0.045 * Math.sin(this.t * 1.7) : 0.022 * Math.sin(this.t * 2.4);
      const rs = {
        x: this.x, y: this.y, R, sx: this.sx * (1 + 0.3 * this.jig), sy: this.sy * (1 - 0.27 * this.jig) * (1 + breath), jx: this.jx,
        rot: this.rot, pivot: 'feet', pivotPt: null, flip: false, raise: 0, dx: 0, dy: 0, scale: 1,
        col: sk.body, sh: sk.shade, tint: null, outline: INK, lw: 3.2 * this.size,
        eyes: this.mode === 'sleep' ? 'closed' : this.mode === 'dizzy' ? 'spiral' : 'normal', mouth: this.mode === 'expect' ? 'open' : 'smile',
        look: this.look, blink: this.blinkAmt, face: this.face, swap: this.swapS, faceS: 1, blush: 0,
        legs: this.legLift > 0.03 ? this.legMode : null, legLift: this.legLift, legPh: this.legPh,
        arms: [], alpha: 1, wob: 0.7 + Math.min(3, Math.abs(this.jigV) * 0.06), back: [], front: [], noFace: false, noBody: false, seed: 0,
      };
      if (this.mode === 'drag' && this.grab) { rs.pivotPt = { x: this.mouse.x, y: this.mouse.y }; rs.rot = this.sway; rs.eyes = 'normal'; rs.mouth = 'o'; }
      if (this.mode === 'expect') rs.eyes = 'star';
      const A = this.acc;
      if (A.shades) rs.front.push(drawShades);
      if (A.clown) rs.front.push(drawClown);
      if (A.bandaid) rs.front.push(drawBandaid);
      if (A.toast) rs.tint = ['#9a5a2a', 0.35 * clamp(A.toast / 3, 0, 1)];
      return rs;
    }
    toWorld(rs, g, lx, ly) {
      let x = lx + rs.dx, y = ly + rs.dy - g.lh;
      if (rs.flip) x = -x;
      let rot = rs.rot, px = 0, py = 0;
      if (rs.pivotPt) { px = rs.pivotPt.x - rs.x; py = rs.pivotPt.y - rs.y; } else if (rs.pivot === 'center') { py = -g.lh; }
      const c = Math.cos(rot), s = Math.sin(rot), X = x - px, Y = y - py;
      return [rs.x + px + X * c - Y * s, rs.y + py + X * s + Y * c];
    }
    geom(rs) {
      const R = rs.R * rs.scale, rx = R * 1.1 * rs.sx, ry = R * rs.sy, legLen = R * 0.42;
      return { R, rx, ry, legLen, lh: 0.8 * ry + (rs.legs ? legLen * rs.legLift : 0) + rs.raise, rs, t: this.t, step: Math.floor(this.t * 8) };
    }
    drawBody(ctx, rs) {
      const g = this.geom(rs), { R, rx, ry } = g;
      ctx.save(); ctx.globalAlpha *= rs.alpha;
      if (rs.pivotPt) { ctx.translate(rs.pivotPt.x, rs.pivotPt.y); ctx.rotate(rs.rot); ctx.translate(rs.x - rs.pivotPt.x, rs.y - rs.pivotPt.y); }
      else { ctx.translate(rs.x, rs.y); if (rs.pivot === 'center') { ctx.translate(0, -g.lh); ctx.rotate(rs.rot); ctx.translate(0, g.lh); } else ctx.rotate(rs.rot); }
      if (rs.flip) ctx.scale(-1, 1);
      ctx.translate(rs.dx, rs.dy - g.lh);
      if (rs.clip) { rs.clip(ctx, g); }
      for (const f of rs.back) f(ctx, g, this);
      if (rs.legs) this.drawLegs(ctx, g);
      if (!rs.noBody) {
        const pts = blobPts(rx, ry, rs.jx, g.step, rs.wob, this.t, rs.seed);
        g.pts = pts;
        const col = rs.tint ? mix(rs.col, rs.tint[0], rs.tint[1]) : rs.col, sh = rs.tint ? mix(rs.sh, rs.tint[0], rs.tint[1]) : rs.sh;
        ctx.beginPath(); smooth(ctx, pts); ctx.fillStyle = sh; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-rx * 0.1, -ry * 0.2, rx * 0.97, ry * 0.9, 0, 0, TAU); ctx.fill();
        if (rs.inside) rs.inside(ctx, g, this);
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-rx * 0.46, -ry * 0.6, rx * 0.2, ry * 0.1, -0.55, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(-rx * 0.2, -ry * 0.78, R * 0.05, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.beginPath(); smooth(ctx, pts); ctx.lineWidth = rs.lw; ctx.strokeStyle = rs.outline; ctx.lineJoin = 'round'; ctx.stroke();
      }
      if (!rs.noFace) this.drawFace(ctx, g);
      for (const a of rs.arms) this.drawArm(ctx, g, a);
      for (const f of rs.front) f(ctx, g, this);
      ctx.restore();
      return g;
    }
    eyePos(g) {
      const { rs, rx, ry, R } = g, fx = rs.face * 0.1 * rx, s = sm(rs.swap), fs = rs.faceS;
      const A = [[-0.34 * rx + fx, -0.1 * ry, 0.28 * R * fs], [0.36 * rx + fx, -0.2 * ry, 0.155 * R * fs]];
      const B = [[0.34 * rx + fx, -0.1 * ry, 0.28 * R * fs], [-0.36 * rx + fx, -0.2 * ry, 0.155 * R * fs]];
      return [0, 1].map(i => [lerp(A[i][0], B[i][0], s), lerp(A[i][1], B[i][1], s), A[i][2]]);
    }
    drawFace(ctx, g) {
      const { rs, rx, ry, R } = g, fx = rs.face * 0.1 * rx;
      const eyes = this.eyePos(g);
      if (rs.blush) {
        ctx.fillStyle = `rgba(255,95,120,${0.55 * rs.blush})`;
        for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 0.52 * rx + fx, 0.16 * ry, 0.14 * R, 0.08 * R, 0, 0, TAU); ctx.fill(); }
      }
      eyes.forEach(([x, y, r], i) => this.drawEye(ctx, x, y, r, rs.eyes, rs, i, g));
      this.drawMouth(ctx, 0.05 * rx + fx, 0.3 * ry, 0.16 * R * rs.faceS, rs.mouth, rs, g);
    }
    drawEye(ctx, x, y, r, type, rs, i, g) {
      const lw = rs.lw * 0.8, t = this.t;
      inkLine(ctx, lw);
      const white = () => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); };
      switch (type) {
        case 'closed': ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 0.75, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); return;
        case 'happy': ctx.beginPath(); ctx.arc(x, y + r * 0.35, r * 0.75, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); return;
        case 'flat': ctx.beginPath(); ctx.moveTo(x - r * 0.8, y); ctx.lineTo(x + r * 0.8, y); ctx.stroke(); return;
        case 'x': ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.moveTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.stroke(); return;
        case 'dot': ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, Math.max(2.2, r * 0.28), 0, TAU); ctx.fill(); return;
        case 'spiral': {
          white(); ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip(); ctx.lineWidth = lw * 0.8; ctx.beginPath();
          for (let k = 0; k < 40; k++) { const a = k * 0.45 + t * 9 * (i ? -1 : 1), rr = (k / 40) * r * 0.95; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          ctx.stroke(); ctx.restore(); return;
        }
        case 'star': { const k = 1 + 0.12 * Math.sin(t * 12); ctx.fillStyle = '#ffe25a'; star(ctx, x, y, r * 1.1 * k, 0.45); ctx.fill(); ctx.stroke(); return; }
        case 'heart': heartPath(ctx, x, y + r * 0.3, r * 1.05); ctx.fillStyle = '#ff6b8e'; ctx.fill(); ctx.stroke(); return;
      }
      // normal-ish eyes with pupils
      const lk = rs.look, bl = type === 'dead' ? 0 : rs.blink;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 1 - bl * 0.88);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
      const pr = r * (i ? 0.56 : 0.5), m = r - pr - r * 0.08;
      let px = lk.x * m, py = lk.y * m;
      if (type === 'sad' || type === 'dead') py = Math.max(py, m * 0.5);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.32, 0, TAU); ctx.fill();
      if (type === 'dead' || type === 'sad') { ctx.fillStyle = rs.tint ? mix(rs.col, rs.tint[0], rs.tint[1]) : rs.col; ctx.beginPath(); ctx.rect(-r - 2, -r - 2, r * 2 + 4, r * (type === 'dead' ? 1.05 : 0.8) + 2); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); inkLine(ctx, lw / (1 - bl * 0.88 || 1) * 0.9); ctx.stroke();
      if (type === 'dead') { ctx.beginPath(); ctx.moveTo(-r, -r * 0.05); ctx.lineTo(r, -r * 0.05); ctx.stroke(); }
      ctx.restore();
      if (type === 'dead') { inkLine(ctx, lw * 0.6); ctx.beginPath(); ctx.arc(x, y + r * 0.9, r * 0.6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
      if (type === 'sad') { inkLine(ctx, lw); ctx.beginPath(); const k = x < 0 ? -1 : 1; ctx.moveTo(x - r * 0.9, y - r * 1.1 - k * r * 0.2); ctx.lineTo(x + r * 0.9, y - r * 1.1 + k * r * 0.2); ctx.stroke(); }
    }
    drawMouth(ctx, x, y, s, type, rs, g) {
      inkLine(ctx, rs.lw * 0.8);
      switch (type) {
        case 'none': return;
        case 'smile': ctx.beginPath(); ctx.arc(x, y - s * 0.3, s * 0.7, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); return;
        case 'sad': ctx.beginPath(); ctx.arc(x, y + s * 0.7, s * 0.65, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke(); return;
        case 'flat': ctx.beginPath(); ctx.moveTo(x - s * 0.6, y); ctx.lineTo(x + s * 0.6, y); ctx.stroke(); return;
        case 'o': ctx.beginPath(); ctx.ellipse(x, y, s * 0.36, s * 0.46, 0, 0, TAU); ctx.fillStyle = INK; ctx.fill(); return;
        case 'wavy': ctx.beginPath(); for (let i = 0; i <= 6; i++) ctx.lineTo(x - s * 0.8 + i * s * 0.27, y + (i % 2 ? -1 : 1) * s * 0.18); ctx.stroke(); return;
        case 'cat': ctx.beginPath(); ctx.arc(x - s * 0.3, y - s * 0.1, s * 0.3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.arc(x + s * 0.3, y - s * 0.1, s * 0.3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke(); return;
        case 'smirk': ctx.beginPath(); ctx.moveTo(x - s * 0.6, y + s * 0.05); ctx.quadraticCurveTo(x + s * 0.1, y + s * 0.35, x + s * 0.75, y - s * 0.3); ctx.stroke(); return;
        case 'grin': case 'open': case 'huge': {
          const w = type === 'huge' ? s * 2.2 : type === 'open' ? s * 1.1 : s * 1.0, h = type === 'huge' ? s * 2.2 : type === 'open' ? s * 1.15 : s * 0.7;
          ctx.beginPath(); if (type === 'grin') { ctx.moveTo(x - w, y - h * 0.3); ctx.quadraticCurveTo(x, y + h * 1.6, x + w, y - h * 0.3); ctx.closePath(); } else ctx.ellipse(x, y + h * 0.2, w * 0.7, h * 0.7, 0, 0, TAU);
          ctx.fillStyle = '#5a1f2e'; ctx.fill(); ctx.save(); ctx.clip(); ctx.fillStyle = '#ff7a8a'; ctx.beginPath(); ctx.ellipse(x, y + h * 0.75, w * 0.45, h * 0.35, 0, 0, TAU); ctx.fill(); ctx.restore(); ctx.stroke(); return;
        }
      }
    }
    drawLegs(ctx, g) {
      const { rs, rx, ry, R } = g, L_ = R * 0.42 * rs.legLift, y0 = 0.62 * ry, y1 = 0.8 * ry + L_;
      inkLine(ctx, rs.lw * 0.95);
      if (rs.legs === 'run') {
        for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 0.25 * rx, y1 - L_ * 0.45, L_ * 0.55, L_ * 0.45, 0, 0, TAU); ctx.globalAlpha *= 0.7; ctx.stroke(); ctx.globalAlpha /= 0.7; }
        return;
      }
      [[-1, 0], [1, Math.PI]].forEach(([k, s]) => {
        const ph = rs.legPh + s, bx = k * 0.3 * rx;
        const fxp = bx + (rs.legs === 'walk' ? Math.sin(ph) * L_ * 0.6 : rs.legs === 'dangle' ? Math.sin(this.t * 6 + s) * L_ * 0.22 : 0);
        const fy = y1 - (rs.legs === 'walk' ? Math.max(0, Math.cos(ph)) * L_ * 0.28 : 0);
        ctx.beginPath(); ctx.moveTo(bx, y0); ctx.lineTo(fxp, fy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fxp - 1.5, fy); ctx.lineTo(fxp + 6 * this.size * (rs.flip ? 1 : rs.face), fy); ctx.stroke();
      });
    }
    // arm from body side to a local point; a = {side, x, y, item}
    drawArm(ctx, g, a) {
      const { rs, rx, ry, R } = g, sx = a.side * 0.9 * rx, sy = 0.12 * ry;
      inkLine(ctx, rs.lw * 0.95);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + a.x) / 2 + a.side * 8, (sy + a.y) / 2 + 10, a.x, a.y); ctx.stroke();
      if (a.item) a.item(ctx, a.x, a.y, g);
      ctx.beginPath(); ctx.arc(a.x, a.y, R * 0.13, 0, TAU); ctx.fillStyle = rs.col; ctx.fill(); inkLine(ctx, rs.lw * 0.8); ctx.stroke();
    }
    worldToLocal(rs, g, wx, wy) {
      // inverse of toWorld for rot = 0 (arms only need it in upright poses)
      let x = wx - rs.x, y = wy - rs.y + g.lh - rs.dy; x -= rs.dx; if (rs.flip) x = -x; return [x, y];
    }
    // 2 = needs full frame rate, 1 = 30 fps is enough, 0 = idle (the app throttles by this)
    busy() {
      if (this.act || this.grab || this.air || this.parts.length || this.cards.length || this.ask || this.mode === 'crouch' || (this.ball && this.ball.state !== 'rest') || Math.abs(this.jigV) > 3) return 2;
      if (this.bubble || this.ball || this.mode === 'walk' || Math.abs(this.jigV) > 0.5 || this.blinkT >= 0 || Math.abs(this.swapS - this.swap) > 0.01 ||
        Math.abs(this.look.x - this.lookT.x) + Math.abs(this.look.y - this.lookT.y) > 0.02) return 1;
      return 0;
    }

    draw(ctx) {
      const a = this.act;
      if (a && a.A.backW) a.A.backW(ctx, this, a);
      if (!this.hidden) {
        const rs = this.baseRS();
        if (a && a.A.pose) a.A.pose(this, a, rs);
        let g;
        if (a && a.A.body) g = a.A.body(ctx, this, a, rs); else g = this.drawBody(ctx, rs);
        if (g) {
          const ext = [[-g.rx - 5, -g.ry - 6], [g.rx + 5, -g.ry - 6], [g.rx + 5, 0.8 * g.ry + g.legLen * (rs.legs ? rs.legLift : 0) + 3], [-g.rx - 5, 0.8 * g.ry + g.legLen * (rs.legs ? rs.legLift : 0) + 3]];
          let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
          for (const [lx, ly] of ext) { const [X, Y] = this.toWorld(rs, g, lx, ly); x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); }
          this.bb = [x0, y0, x1 - x0, y1 - y0];
        }
      } else this.bb = null;
      if (a && a.A.frontW) a.A.frontW(ctx, this, a);
      this.drawBall(ctx);
      for (const q of this.parts) { ctx.save(); PD[q.k](ctx, q, this); ctx.restore(); }
      this.drawCards(ctx);
      this.drawBubble(ctx);
      this.drawAsk(ctx);
    }
    drawCards(ctx) {
      for (const c of this.cards) {
        const k = c.t < 0.25 ? E.back(c.t / 0.25) : 1, al = 1 - seg(c.t, 1.75, 2.05);
        let y = c.y - 108; if (y < this.ceilY + 34) y = c.y + this.R * 3.6;
        const x = clamp(c.x, 90, this.W - 90);
        ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); ctx.rotate(-0.07 + Math.sin(c.t * 3) * 0.02); ctx.scale(k * 1.0, k * 1.0);
        ctx.font = `${34}px ${FONT}`; const w = ctx.measureText(c.word).width + 34;
        wobblyRect(ctx, -w / 2, -27, w, 54, 14, Math.floor(this.t * 8), 1.2); ctx.fillStyle = c.col; ctx.fill(); inkLine(ctx, 3); ctx.stroke();
        label(ctx, c.word, 0, 1, 34, '#fff', { white: false });
        ctx.restore();
      }
    }
    wrap(ctx, text, maxW) {
      const out = []; let line = '';
      const noStart = /[，。！？、…）」』”’：；,.!?)]/;
      for (const ch of [...text]) {
        const t2 = line + ch;
        if (ctx.measureText(t2).width > maxW && line && !noStart.test(ch)) { out.push(line); line = ch; } else line = t2;
      }
      if (line) out.push(line);
      return out;
    }
    bubbleLayout(ctx) {
      const b = this.bubble; if (!b || b.t < 0 || this.hidden) return null;
      const px = 17; ctx.font = `${px}px ${FONT}`;
      if (b.lines == null) { b.lines = this.wrap(ctx, b.text, 228); b.w = Math.max(...b.lines.map(s => ctx.measureText(s).width)) + 30; }
      const lines = b.lines, w = b.w, h = lines.length * (px + 7) + 20;
      const bb = this.bb || [this.x - 40, this.y - 70, 80, 70];
      let below = b.below != null ? b.below : bb[1] - h - 24 < this.ceilY + 4;
      let ax = clamp(bb[0] + bb[2] / 2, 16, this.W - 16), x = clamp(ax - w / 2, 8, this.W - w - 8), y = below ? bb[1] + bb[3] + 18 : bb[1] - h - 18, ay = below ? y : y + h;
      const side = b.side ? (bb[0] + bb[2] + 24 + w < this.W - 8 ? 1 : -1) : 0;
      if (side) { x = side > 0 ? bb[0] + bb[2] + 22 : bb[0] - 22 - w; y = clamp(bb[1] + bb[3] * 0.35 - h / 2, this.ceilY + 6, this.H - h - 6); ax = side > 0 ? x : x + w; ay = y + h / 2; }
      return { b, px, lines, w, h, below, ax, ay, x, y, side };
    }
    // rectangle [x0, y0, x1, y1] that covers everything draw() will paint this frame (the app sizes its canvas to it)
    extents(ctx) {
      const R = this.R;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const add = (a, b, c, d) => { if (a < x0) x0 = a; if (b < y0) y0 = b; if (c > x1) x1 = c; if (d > y1) y1 = d; };
      const a = this.act;
      if (a && a.A.ext) { const e = a.A.ext(this, a); if (e === 'full') return [0, 0, this.W, this.H]; if (e) add(...e); }
      if (!this.hidden) {
        const pad = R * (a ? a.A.pad || 2.6 : 1.6) + 24;
        add(this.x - pad, this.y - R * 2.2 - pad, this.x + pad, this.y + pad * 0.6);
        if (this.bb) add(this.bb[0] - 30, this.bb[1] - 30, this.bb[0] + this.bb[2] + 30, this.bb[1] + this.bb[3] + 30);
        if (this.mode === 'drag' && this.grab) add(this.mouse.x - R * 3, this.mouse.y - R * 2, this.mouse.x + R * 3, this.mouse.y + R * 3);
      }
      const L = this.bubbleLayout(ctx); if (L) add(L.x - 20, L.y - 20, L.x + L.w + 20, L.y + L.h + 20);
      for (const c of this.cards) { const y = c.y - 108 < this.ceilY + 34 ? c.y + R * 3.6 : c.y - 108, x = clamp(c.x, 90, this.W - 90); add(x - 190, y - 50, x + 190, y + 50); }
      for (const q of this.parts) add(q.x - 44, q.y - 44, q.x + 44, q.y + 44);
      if (this.ball) add(this.ball.x - 40, this.ball.y - 40, this.ball.x + 40, this.ball.y + 30);
      if (this.pie) add(this.pie.x - this.pie.r - 30, this.pie.y - this.pie.r - 40, this.pie.x + this.pie.r + 30, this.pie.y + this.pie.r + 30);
      if (this.ask) for (const b of [this.ask.yes, this.ask.no]) add(b.x - b.w / 2 - 60, b.y - b.h / 2 - 50, b.x + b.w / 2 + 60, b.y + b.h / 2 + 20);
      return x1 < x0 ? null : [x0, y0, x1, y1];
    }
    drawBubble(ctx) {
      const L = this.bubbleLayout(ctx); if (!L) return;
      const { b, px, lines, w, h, below, side } = L; let { ax, ay, x, y } = L;
      const n = [...b.text].length, shown = Math.min(n, Math.floor(b.t * b.cps) + 1);
      const end = n / b.cps + b.hold, al = 1 - seg(b.t, end, end + 0.25), k = 0.6 + 0.4 * E.back(seg(b.t, 0, 0.14));
      ctx.save(); ctx.globalAlpha = al; ctx.translate(ax, ay); ctx.scale(k, k); ctx.translate(-ax, -ay);
      const step = Math.floor(this.t * 8);
      wobblyRect(ctx, x, y, w, h, 14, step, 0.8); ctx.fillStyle = '#fff'; ctx.fill(); inkLine(ctx, 2.6); ctx.stroke();
      // tail
      const tx = clamp(ax, x + 18, x + w - 18);
      ctx.beginPath();
      if (side) { const ex = side > 0 ? x : x + w; ctx.moveTo(ex + side * 1.5, ay - 8); ctx.lineTo(ex - side * 13, ay + 4); ctx.lineTo(ex + side * 1.5, ay + 8); }
      else if (below) { ctx.moveTo(tx - 8, y + 1.5); ctx.lineTo(ax + (ax > tx ? 4 : -4), y - 12); ctx.lineTo(tx + 8, y + 1.5); }
      else { ctx.moveTo(tx - 8, y + h - 1.5); ctx.lineTo(ax + (ax > tx ? 4 : -4), y + h + 12); ctx.lineTo(tx + 8, y + h - 1.5); }
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `${px}px ${FONT}`;
      let left = shown;
      lines.forEach((s, i) => { const part = [...s].slice(0, Math.max(0, left)).join(''); left -= [...s].length; ctx.fillText(part, x + 15, y + 10 + (px + 7) * i + (px + 7) / 2); });
      ctx.restore();
    }
    drawAsk(ctx) {
      const A = this.ask; if (!A) return;
      for (const [b, col] of [[A.yes, '#ff8f8f'], [A.no, '#a6e3a1']]) {
        const k = E.back(seg(A.t, 0.1, 0.35));
        ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
        wobblyRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 12, Math.floor(this.t * 8), 0.8); ctx.fillStyle = col; ctx.fill(); inkLine(ctx, 2.6); ctx.stroke();
        ctx.font = `18px ${FONT}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.lab, 0, 1);
        ctx.restore();
      }
    }
  }

  // ------------------------------------------------------------------ accessories (body-local draw fns)
  function drawShades(ctx, g, p) {
    const e = p.eyePos(g), [a, b] = e[0][0] < e[1][0] ? [e[0], e[1]] : [e[1], e[0]], y = (a[1] + b[1]) / 2, R = g.R;
    ctx.save(); ctx.fillStyle = '#111'; inkLine(ctx, 2);
    const w = R * 0.62, h = R * 0.36;
    for (const [x] of [a, b]) { ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - w / 2 + 3, y - h / 2 + 3, 5, 3); ctx.fillRect(x - w / 2 + 9, y - h / 2 + 3, 3, 3); ctx.fillStyle = '#111'; }
    ctx.fillRect(a[0] + w / 2, y - h / 2, b[0] - a[0] - w, h * 0.3);
    ctx.fillRect(a[0] - w / 2 - R * 0.35, y - h / 2, R * 0.35, h * 0.3); ctx.fillRect(b[0] + w / 2, y - h / 2, R * 0.35, h * 0.3);
    ctx.restore();
  }
  function drawClown(ctx, g, p) {
    const { rx, ry, R, rs } = g, fx = rs.face * 0.1 * rx;
    const cols = ['#ff4d4d', '#ff9f1c', '#ffe14d', '#4cd964', '#3fa9f5', '#a66bff'];
    for (const k of [-1, 1]) cols.forEach((c, i) => { const a = -Math.PI / 2 + k * (0.55 + i * 0.16); ctx.beginPath(); ctx.arc(Math.cos(a) * rx * 1.02, Math.sin(a) * ry * 0.98, R * 0.17, 0, TAU); ctx.fillStyle = c; ctx.fill(); inkLine(ctx, 1.8); ctx.stroke(); });
    ctx.beginPath(); ctx.arc(0.05 * rx + fx, 0.08 * ry, R * 0.15, 0, TAU); ctx.fillStyle = '#ff2d2d'; ctx.fill(); inkLine(ctx, 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(0.05 * rx + fx - R * 0.05, 0.08 * ry - R * 0.05, R * 0.04, 0, TAU); ctx.fill();
  }
  function drawBandaid(ctx, g) {
    const { rx, ry, R } = g;
    ctx.save(); ctx.translate(rx * 0.02, -ry * 0.62); ctx.rotate(0.55);
    wobblyRect(ctx, -R * 0.5, -R * 0.15, R, R * 0.3, R * 0.14, 0, 0); ctx.fillStyle = '#f6c99a'; ctx.fill(); inkLine(ctx, 1.8); ctx.stroke();
    ctx.fillStyle = '#e8a870'; ctx.fillRect(-R * 0.14, -R * 0.12, R * 0.28, R * 0.24);
    ctx.fillStyle = '#c98a55'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-R * 0.07 + (i % 2) * R * 0.14, -R * 0.05 + (i >> 1) * R * 0.1, 1.2, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ------------------------------------------------------------------ acts
  // auto: may happen by itself; click: may happen when clicked. Hooks: start, update (return true when done), pose(rs),
  // body (custom body draw, return geom), backW/frontW (world-space layers), click (return true if handled), end.
  const ACTS = {};
  const def = (id, o) => (ACTS[id] = Object.assign({ id }, o));
  const W_ = p => p.W;

  def('moyu', {
    word: '摸鱼', col: '#2f9cf0', auto: true, click: true, status: '摸鱼中', pad: 3.2,
    start(p, a) { a.dir = p.x < p.W / 2 ? 1 : -1; a.x0 = p.x; a.y0 = p.y; a.x1 = clamp(p.x + a.dir * p.W * 0.6, 140, p.W - 140); a.alt = Math.min(200, p.y - p.ceilY - 160); p.sfx.play('splash'); p.say(a.o.line || '摸鱼中，勿cue', { delay: 1.0 }); },
    update(p, a, dt) {
      const t = a.t; a.m = seg(t, 0, 0.45) * (1 - seg(t, 6.0, 6.4));
      if (t > 0.45 && t < 6.4) {
        const pos = u => { const lift = Math.sin(Math.min(1, u * 1.6) * Math.PI / 2); return [lerp(a.x0, a.x1, sm(u)), a.y0 - a.alt * lift + Math.sin(u * TAU * 2.2) * 26 * lift]; };
        const u = seg(t, 0.45, 6.2), [x, y] = pos(u), [x2, y2] = pos(Math.min(1, u + 0.02));
        p.x = x; p.y = y;
        a.ang = lerp(a.ang || 0, clamp(Math.atan2(y2 - y, Math.abs(x2 - x) + 4), -0.45, 0.45), 0.15);
        if (Math.floor(t / 0.28) !== Math.floor((t - dt) / 0.28)) { p.emit('bub', { x: p.x + a.dir * p.R * 1.4, y: p.y - p.R * 0.9, vy: -60, life: 1.3, s: 3 + p.r() * 4 }); if (p.r() < 0.4) p.sfx.play('bubble'); }
      }
      if (t >= 6.4) { p.air = true; p.vy = 0; p.vx = 0; p.plat = null; return true; }
    },
    pose(p, a, rs) {
      const m = sm(a.m || 0); rs.sx *= lerp(1, 1.32, m); rs.sy *= lerp(1, 0.7, m); rs.flip = a.dir < 0; rs.face = 1; rs.rot = (a.ang || 0) * (a.dir < 0 ? -1 : 1) * m; rs.pivot = 'center';
      if (m > 0.5) rs.mouth = 'o';
      rs.back.push((ctx, g) => {
        if (m < 0.05) return; const { rx, ry, R } = g, w = Math.sin(p.t * 15) * 0.4;
        ctx.save(); ctx.translate(-rx * 0.92, 0.05 * ry); ctx.rotate(w); ctx.scale(m, m);
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-R * 0.75, -R * 0.62); ctx.quadraticCurveTo(-R * 0.5, 0, -R * 0.75, R * 0.62); ctx.closePath(); ctx.fillStyle = rs.sh; ctx.fill(); inkLine(ctx, rs.lw); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.scale(1, m); ctx.beginPath(); ctx.moveTo(-rx * 0.3, -ry * 0.9); ctx.quadraticCurveTo(-rx * 0.05, -ry * 1.55, rx * 0.25, -ry * 0.95); ctx.closePath(); ctx.fillStyle = rs.sh; ctx.fill(); inkLine(ctx, rs.lw); ctx.stroke(); ctx.restore();
      });
      rs.front.push((ctx, g) => {
        if (m < 0.5) return; const { rx, ry } = g; inkLine(ctx, rs.lw * 0.7); ctx.globalAlpha *= 0.6;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-rx * 0.1 - i * rx * 0.22, ry * 0.05, ry * 0.5, -0.5, 0.5); ctx.stroke(); }
      });
    },
  });

  def('tangping', {
    word: '躺平', col: '#7a8cff', auto: true, click: true, status: '已躺平',
    start(p, a) { p.say(a.o.line || '躺平中，勿扰', { delay: 0.8 }); p.sfx.play('whoosh', { d: 0.4 }); },
    update(p, a, dt) {
      if (Math.floor(a.t / 1.1) !== Math.floor((a.t - dt) / 1.1) && a.t > 0.8 && a.t < 6) p.emit('z', { x: p.x + p.R * 1.2, y: p.y - p.R * 0.7, vy: -30, vx: 14, life: 1.5, s: 15, txt: 'Z' });
      if (a.t > 6.2 && !a.b) { a.b = 1; p.sfx.play('boing'); p.jigV -= 10; }
      return a.t > 6.6;
    },
    click(p, a) { p.say('别动，我已经是液体了。'); p.jigV += 5; return true; },
    pose(p, a, rs) {
      const m = E.out(seg(a.t, 0, 0.5)) * (1 - E.back(seg(a.t, 6.1, 6.5)));
      rs.sy *= lerp(1, 0.3, m); rs.sx *= lerp(1, 1.95, m); rs.faceS = lerp(1, 0.75, m);
      if (m > 0.5) { rs.eyes = 'closed'; rs.mouth = 'flat'; }
    },
  });

  def('neijuan', {
    word: '内卷', col: '#ff8a3d', auto: true, click: true, status: '卷',
    start(p, a) { a.x0 = p.x; const pl = p.plat || p.plats[0]; a.lo = Math.max(pl.x0, 0) + p.R * 1.3; a.hi = Math.min(pl.x1, p.W) - p.R * 1.3; p.poof(p.x, p.y - p.R); p.sfx.play('rumble', { d: 4.4 }); p.say('卷起来了！', { delay: 0.5 }); },
    update(p, a, dt) {
      const t = a.t, u = seg(t, 0.4, 5.0);
      if (t > 0.4 && t < 5.0) {
        const A = Math.min(260, (a.hi - a.lo) / 2 - 10), px = p.x;
        const c = clamp(a.x0, a.lo + A, a.hi - A);
        p.x = clamp(c + A * Math.sin(u * TAU * 1.5) * (a.x0 < c ? -1 : 1) * -1, a.lo, a.hi);
        a.roll = (a.roll || 0) + (p.x - px) / (p.R * 0.95);
        if (Math.abs(p.x - px) > 3 && Math.floor(t / 0.06) !== Math.floor((t - dt) / 0.06)) p.emit('line', { x: p.x - Math.sign(p.x - px) * p.R * (1.3 + p.r()), y: p.y - p.R * (0.3 + p.r() * 1.3), vx: -(p.x - px) / dt * 0.2, life: 0.25, s: -Math.sign(p.x - px) * (16 + p.r() * 20) });
      }
      if (t > 5.0 && !a.done) { a.done = 1; p.poof(p.x, p.y - p.R); p.say('卷不动了。'); }
      return t > 6.2;
    },
    body(ctx, p, a, rs) {
      if (a.t < 0.4 || a.t > 5.0) return p.drawBody(ctx, rs);
      const R = p.R * 0.98, cx = p.x, cy = p.y - R, g = p.geom(rs);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a.roll || 0);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = rs.col; ctx.fill();
      ctx.strokeStyle = rs.sh; ctx.lineWidth = R * 0.2; ctx.beginPath();
      for (let k = 0; k <= 90; k++) { const an = k * 0.2, rr = (k / 90) * R * 0.86; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.stroke();
      inkLine(ctx, rs.lw * 0.7); ctx.beginPath(); for (let k = 0; k <= 90; k++) { const an = k * 0.2, rr = (k / 90) * R * 0.86 + R * 0.1; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); inkLine(ctx, rs.lw); ctx.stroke();
      // the eyes ride along the roll
      p.drawEye(ctx, R * 0.62, -R * 0.35, R * 0.26, 'spiral', rs, 0, g); p.drawEye(ctx, R * 0.68, R * 0.25, R * 0.15, 'spiral', rs, 1, g);
      ctx.restore();
      return Object.assign(g, { rx: R, ry: R / 0.9, lh: R });
    },
  });

  def('shangtou', {
    word: '上头', col: '#ff4d6d', auto: false, click: true, status: '上头',
    start(p, a) { a.y0 = p.y; a.top = p.ceilY + p.R * 0.45; p.say(a.o.line || '上头了上头了！', { delay: 0.9 }); },
    update(p, a, dt) {
      const t = a.t;
      if (t > 0.3 && !a.l) { a.l = 1; p.sfx.play('whoosh', { d: 0.4 }); p.sfx.play('boing', { f: 240 }); }
      if (t > 0.3 && t < 0.75) p.y = lerp(a.y0, a.top, E.out(seg(t, 0.3, 0.75)));
      if (t >= 0.75 && !a.stuck) { a.stuck = 1; p.y = a.top; p.jigV += 9; p.sfx.play('land', { v: 0.6 }); }
      if (t > 4.2) { p.y = a.top + (t - 4.2) * 10; p.air = true; p.vy = 200; p.vx = 0; p.plat = null; return true; }
    },
    pose(p, a, rs) {
      const t = a.t, up = seg(t, 0.3, 0.75);
      if (t < 0.3) { rs.sy *= lerp(1, 0.7, E.out(t / 0.3)); rs.sx *= lerp(1, 1.2, E.out(t / 0.3)); }
      else if (t < 0.75) { rs.sy *= 1.35; rs.sx *= 0.8; rs.legs = 'dangle'; rs.legLift = 1; }
      if (t >= 0.6) { rs.rot = Math.PI + Math.sin(t * 3.2) * 0.14 * seg(t, 0.75, 1.2); rs.legs = 'walk'; rs.legLift = 1; rs.legPh = t * 4; }
      rs.blush = seg(t, 0.8, 1.4); rs.tint = ['#ff5a5a', 0.35 * seg(t, 0.8, 1.6)]; if (t > 0.9) rs.eyes = 'spiral'; rs.mouth = t > 0.9 ? 'grin' : 'o';
      if (up > 0 && up < 1) for (let i = 0; i < 1; i++) p.emit('line', { x: p.x + (p.r() - 0.5) * 40, y: p.y + 10, vy: 200, life: 0.2, s: 0.01 });
    },
  });

  def('xiatou', {
    word: '下头', col: '#5c6b7a', auto: true, click: true, status: '下头',
    start(p, a) { p.sfx.play('whoosh', { d: 0.7 }); p.say(a.o.line || '下头了。', { delay: 1.0, below: false }); },
    update(p, a) { if (a.t > 3.9 && !a.b) { a.b = 1; p.sfx.play('boing'); } return a.t > 4.8; },
    pose(p, a, rs) {
      const t = a.t, g0 = p.geom(rs), depth = g0.ry * 0.95 * (E.io(seg(t, 0, 1.1)) - E.back(seg(t, 3.8, 4.4)));
      rs.raise = -depth; a.depth = depth; a.fy = p.y;
      if (t > 1.2 && t < 3.8) rs.look = { x: Math.sin(t * 2.2) > 0 ? 1 : -1, y: 0.3 };
    },
    body(ctx, p, a, rs) {
      ctx.save(); ctx.beginPath(); ctx.rect(-1e4, -1e4, 2e4, 1e4 + a.fy + 1); ctx.clip(); rs.clip = null;
      const g = p.drawBody(ctx, rs); ctx.restore();
      if (a.depth > 4) { inkLine(ctx, 2.4); for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(p.x + k * g.rx * 0.9, a.fy - 1); ctx.quadraticCurveTo(p.x + k * g.rx * 1.25, a.fy - 7 - Math.sin(p.t * 6) * 2, p.x + k * g.rx * 1.55, a.fy - 1); ctx.stroke(); } }
      return g;
    },
  });

  def('liekai', {
    word: '裂开', col: '#ff6b3d', auto: true, click: true, status: '裂开',
    start(p, a) { p.sfx.play('crack'); p.say(a.o.line || '我裂开了。', { delay: 0.7 }); },
    update(p, a) {
      if (a.t > 0.45 && !a.c2) { a.c2 = 1; p.sfx.play('crack'); }
      if (a.t > 3.75 && !a.ba) { a.ba = 1; p.sfx.play('pop'); p.acc.bandaid = 25; }
      return a.t > 5.0;
    },
    body(ctx, p, a, rs) {
      const t = a.t, g0 = p.geom(rs), { rx, ry } = g0;
      const Z = [[0.04, -1.25], [-0.12, -0.78], [0.11, -0.45], [-0.1, -0.12], [0.12, 0.2], [-0.06, 0.52], [0.05, 1.0]].map(([x, y]) => [x * rx, y * ry]);
      const crack = seg(t, 0, 0.45), sp = E.back(seg(t, 0.45, 0.9)) * (1 - E.io(seg(t, 3.1, 3.7)));
      if (sp <= 0.001) {
        const g = p.drawBody(ctx, rs);
        if (crack > 0 && t < 3.7) { // growing crack line
          ctx.save(); const [X, Y] = p.toWorld(rs, g, 0, 0); ctx.translate(X, Y); ctx.beginPath(); smooth(ctx, g.pts); ctx.clip(); inkLine(ctx, rs.lw * 0.9); ctx.beginPath();
          const n = Math.max(1, Math.ceil(crack * (Z.length - 1))); for (let i = 0; i <= n; i++) ctx.lineTo(Z[i][0], Z[i][1] * 0.95); ctx.stroke(); ctx.restore();
        }
        return g;
      }
      let g;
      for (const side of [-1, 1]) {
        const r2 = Object.assign({}, rs, { back: [], front: [], arms: [] });
        r2.dx = side * 20 * sp; r2.dy = 0; r2.pivot = 'feet'; r2.rot = side * 0.2 * sp;
        r2.clip = ctx => { ctx.beginPath(); ctx.moveTo(side * rx * 3, -ry * 3); ctx.lineTo(Z[0][0], -ry * 3); Z.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(Z[Z.length - 1][0], ry * 3); ctx.lineTo(side * rx * 3, ry * 3); ctx.closePath(); ctx.clip(); };
        r2.front = [(ctx, g2) => { ctx.save(); ctx.beginPath(); smooth(ctx, g2.pts); ctx.clip(); inkLine(ctx, rs.lw * 1.3); ctx.beginPath(); Z.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore(); }];
        r2.eyes = 'normal'; r2.look = { x: -side, y: 0.2 }; r2.mouth = 'wavy';
        g = p.drawBody(ctx, r2);
      }
      if (t > 1.0 && t < 3.1 && Math.floor(t * 3) !== Math.floor((t - 0.017) * 3)) p.emit('tear', { x: p.x + 24, y: p.y - p.R * 1.6, vx: 30, vy: -60, g: 500, life: 0.7, s: 3.5 });
      return g;
    },
  });

  def('pofang', {
    word: '破防', col: '#8e7cff', auto: true, click: true, status: '破防',
    start(p, a) { p.sfx.play('ding'); },
    update(p, a, dt) {
      const t = a.t;
      if (t > 1.3 && !a.c) { a.c = 1; p.sfx.play('crack'); }
      if (t > 1.75 && !a.s) {
        a.s = 1; p.sfx.play('shatter'); const cx = p.x + p.face * p.R * 0.15, cy = p.y - p.R * 0.75;
        for (let i = 0; i < 9; i++) {
          const an = (i / 9) * TAU, r1 = p.R * 0.35;
          const pts = [[0, 0], [Math.cos(an) * r1 * 1.6, Math.sin(an) * r1 * 1.6], [Math.cos(an + 0.7) * r1 * 1.5, Math.sin(an + 0.7) * r1 * 1.5]];
          p.emit('shard', { x: cx, y: cy, vx: Math.cos(an + 0.35) * (180 + p.r() * 160), vy: Math.sin(an + 0.35) * 160 - 220, g: 1300, vr: (p.r() - 0.5) * 14, life: 1.4, pts, c: '#dfe4ee', floor: p.y - 4 });
        }
        p.say(a.o.line || '破防了……', { delay: 0.3 });
      }
      if (t > 2.1 && t < 5 && Math.floor(t / 0.22) !== Math.floor((t - dt) / 0.22)) for (const k of [-1, 1]) p.emit('tear', { x: p.x + k * p.R * 0.5, y: p.y - p.R * 1.1, vx: k * (60 + p.r() * 40), vy: -120, g: 900, life: 0.8, s: 3.5, floor: p.y - 2 });
      return t > 5.3;
    },
    pose(p, a, rs) {
      const t = a.t;
      if (t < 1.75) { rs.eyes = 'normal'; rs.mouth = 'smirk'; rs.look = { x: 0.3, y: -0.2 }; }
      else { rs.eyes = 'sad'; rs.mouth = 'wavy'; rs.dx = Math.sin(t * 40) * 1.2; }
      if (t < 1.75) rs.front.push((ctx, g) => {
        const { R, ry } = g, rise = E.back(seg(t, 0, 0.4)), yy = ry * 0.25 + (1 - rise) * R * 1.5;
        ctx.save(); ctx.translate(g.rs.face * R * 0.15, yy); ctx.scale(rise, rise);
        const w = R * 0.72, h = R * 0.95;
        ctx.beginPath(); ctx.moveTo(-w, -h * 0.55); ctx.quadraticCurveTo(0, -h * 0.75, w, -h * 0.55); ctx.lineTo(w, 0); ctx.quadraticCurveTo(w * 0.8, h * 0.7, 0, h); ctx.quadraticCurveTo(-w * 0.8, h * 0.7, -w, 0); ctx.closePath();
        ctx.fillStyle = '#dfe4ee'; ctx.fill(); inkLine(ctx, g.rs.lw); ctx.stroke();
        label(ctx, '防', 0, h * 0.05, R * 0.75, '#4a4a6a', { white: false, ink: false });
        if (t > 1.3) { inkLine(ctx, 2); ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.6); ctx.lineTo(w * 0.1, -h * 0.2); ctx.lineTo(-w * 0.15, h * 0.1); ctx.lineTo(w * 0.2, h * 0.5); ctx.moveTo(w * 0.1, -h * 0.2); ctx.lineTo(w * 0.6, -h * 0.1); ctx.stroke(); }
        ctx.restore();
      });
    },
  });

  def('fafeng', {
    word: '发疯', col: '#ff2e63', auto: false, click: true, status: '发疯中', pad: 6,
    start(p, a) { a.trail = []; },
    update(p, a, dt) {
      const t = a.t, R = p.R;
      if (t > 0.6 && !a.go) { a.go = 1; a.vx = (p.x < p.W / 2 ? 1 : -1) * 1150; a.vy = -1250; p.sfx.play('scream', { d: 3.3 }); p.say('啊啊啊啊啊啊啊啊啊啊', { cps: 9, sound: false, hold: 0.6 }); }
      if (t > 0.6 && t < 4.0) {
        p.x += a.vx * dt; p.y += a.vy * dt; a.spin = (a.spin || 0) + dt * 11 * Math.sign(a.vx);
        let hit = false;
        if (p.x < R * 1.2) { p.x = R * 1.2; a.vx = Math.abs(a.vx); hit = true; } if (p.x > p.W - R * 1.2) { p.x = p.W - R * 1.2; a.vx = -Math.abs(a.vx); hit = true; }
        if (p.y - R * 1.9 < p.ceilY) { p.y = p.ceilY + R * 1.9; a.vy = Math.abs(a.vy); hit = true; } if (p.y > p.floorY) { p.y = p.floorY; a.vy = -Math.abs(a.vy); hit = true; }
        if (hit) { p.sfx.play('boing', { f: 150 + p.r() * 150 }); p.jigV += 10; p.poof(p.x, p.y - R, 4); }
        a.trail.push({ x: p.x, y: p.y, s: a.spin }); if (a.trail.length > 7) a.trail.shift();
      }
      if (t >= 4.0 && !a.fall) { a.fall = 1; a.trail = []; p.vx = 0; p.vy = 0; }
      if (a.fall && !a.landed) {
        p.vy += 2600 * dt; p.y += p.vy * dt; const q = p.plats.find(q => p.x >= q.x0 && p.x <= q.x1 && p.y >= q.y && p.y - p.vy * dt <= q.y + 1) || (p.y >= p.floorY ? p.plats[0] : null);
        if (q) { a.landed = t; p.y = q.y; p.plat = q; p.jigV += 12; p.sfx.play('land', { v: 0.8 }); p.say('刚才那个不是我。', { delay: 0.5 }); }
      }
      return a.landed && t - a.landed > 2.6;
    },
    pose(p, a, rs) {
      const t = a.t;
      if (t < 0.6) { rs.dx = (p.r() - 0.5) * 8 * t / 0.6; rs.eyes = 'spiral'; rs.mouth = 'wavy'; }
      else if (!a.landed) { rs.pivot = 'center'; rs.rot = a.spin || 0; rs.eyes = 'spiral'; rs.mouth = 'huge'; rs.tint = ['#ff2e63', 0.25 + 0.2 * Math.sin(t * 20)]; }
      else { rs.eyes = 'dot'; rs.mouth = 'flat'; rs.look = { x: 0, y: 0 }; }
    },
    backW(ctx, p, a) { if (!a.trail) return; const rs = p.baseRS(); a.trail.forEach((q, i) => { ctx.save(); ctx.globalAlpha = 0.07 + i * 0.04; p.drawBody(ctx, Object.assign({}, rs, { x: q.x, y: q.y, pivot: 'center', rot: q.s, eyes: 'spiral', mouth: 'huge', front: [], back: [] })); ctx.restore(); }); },
  });

  def('bengbu', {
    word: '蚌埠住了', col: '#ff7eb3', auto: true, click: true, status: '蚌埠住了',
    start(p, a) { p.poof(p.x, p.y - p.R); p.sfx.play('rattle', { d: 1.8 }); },
    update(p, a, dt) {
      const t = a.t;
      if (t > 0.5 && t < 2.3 && Math.floor(t / 0.35) !== Math.floor((t - dt) / 0.35)) p.emit('txt', { x: p.x + (p.r() - 0.5) * 40, y: p.y - p.R * 1.2, vx: (p.r() - 0.5) * 60, vy: -80, life: 0.8, txt: '噗', s: 16, c: '#fff' });
      if (t > 2.3 && !a.open) {
        a.open = 1; p.sfx.play('laugh'); p.sfx.play('pop');
        for (let i = 0; i < 12; i++) p.emit('txt', { x: p.x, y: p.y - p.R * 1.3, vx: (p.r() - 0.5) * 420, vy: -250 - p.r() * 250, g: 380, vr: (p.r() - 0.5) * 3, life: 1.6, txt: '哈', s: 18 + p.r() * 10, c: ['#ffe14d', '#ff7eb3', '#7fd4ff'][i % 3] });
      }
      if (t > 5.2 && !a.b) { a.b = 1; p.poof(p.x, p.y - p.R); }
      return t > 5.4;
    },
    body(ctx, p, a, rs) {
      const t = a.t, R = p.R, open = a.open ? E.el(seg(t, 2.3, 2.9)) : 0, rattle = t > 0.5 && t < 2.3 ? Math.abs(Math.sin(t * 38)) * 0.12 * seg(t, 0.5, 2.2) : 0;
      const lid = -(rattle + open * 1.25), cx = p.x, w = R * 1.35, h = R * 0.95, by = p.y - h * 0.92;
      const shell = (dir) => {
        ctx.beginPath(); ctx.moveTo(-w, 0);
        for (let i = 0; i <= 48; i++) { const an = Math.PI + (i / 48) * Math.PI, bump = 1 - 0.07 * Math.abs(Math.sin((i / 48) * Math.PI * 7)); ctx.lineTo(Math.cos(an) * w * bump, dir * -Math.sin(an) * h * bump); }
        ctx.closePath(); ctx.fillStyle = '#ffd2c2'; ctx.fill(); inkLine(ctx, rs.lw); ctx.stroke();
        ctx.save(); ctx.clip(); inkLine(ctx, 1.6); ctx.globalAlpha *= 0.5; for (let i = 1; i < 7; i++) { const an = Math.PI + (i / 7) * Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(an) * w * 0.12, dir * -Math.sin(an) * h * 0.12); ctx.lineTo(Math.cos(an) * w * 0.93, dir * -Math.sin(an) * h * 0.93); ctx.stroke(); } ctx.restore();
      };
      // body sitting inside
      const r2 = Object.assign({}, rs, { y: by + h * 0.55, scale: 0.78, eyes: a.open ? 'happy' : 'closed', mouth: a.open ? 'huge' : 'flat', dx: a.open ? Math.sin(t * 30) * 1.5 : 0 });
      const g = a.open ? p.drawBody(ctx, r2) : p.geom(r2);                                     // closed: the lid hides the body
      ctx.save(); ctx.translate(cx, by); shell(1); ctx.restore();                              // bowl, in front of the body's lower half
      ctx.save(); ctx.translate(cx - w * 0.95, by); ctx.rotate(lid); ctx.translate(w * 0.95, 0); ctx.scale(1, -1); shell(1); ctx.restore();   // lid, hinged at the back
      return Object.assign(g, { rx: w, ry: h * 1.1 });
    },
  });

  def('male', {
    word: '麻了', col: '#6b7280', auto: true, click: true, status: '麻了',
    start(p, a) { p.sfx.play('static', { d: 3.2 }); p.say(a.o.line || '麻了。', { delay: 0.9 }); },
    update(p, a) { return a.t > 3.8; },
    pose(p, a, rs) {
      const on = a.t > 0.15 && a.t < 3.5;
      if (!on) return;
      rs.eyes = 'flat'; rs.mouth = 'flat'; rs.dx = (hash(Math.floor(p.t * 20), 3) - 0.5) * 6;
      rs.inside = (ctx, g) => {
        const { rx, ry } = g, st = Math.floor(p.t * 20), s = 5;
        for (let y = -ry * 1.1; y < ry; y += s) for (let x = -rx * 1.1; x < rx * 1.1; x += s) {
          const v = hash((x * 7 + y * 131) | 0, st); ctx.fillStyle = `rgba(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0},.78)`; ctx.fillRect(x, y, s, s);
        }
        const band = (hash(st, 9) - 0.5) * ry * 2; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-rx * 1.2, band, rx * 2.4, 4);
      };
    },
  });

  def('emo', {
    word: 'emo了', col: '#5b7bb5', auto: true, click: true, status: 'emo', pad: 3.6,
    start(p, a) { p.sfx.play('sadTrombone'); p.sfx.play('rain', { d: 5 }); p.say(a.o.line || 'emo了，别管我。', { delay: 1.4, side: true }); },
    update(p, a, dt) {
      const t = a.t;
      if (t > 0.6 && t < 5.6 && Math.floor(t / 0.035) !== Math.floor((t - dt) / 0.035)) {
        const top = p.bb ? p.bb[1] : p.y - p.R * 1.8;
        p.emit('drop', { x: p.x + (p.r() - 0.5) * p.R * 1.3, y: top - p.R * 0.95, vy: 300, vx: -15, life: (p.R * 0.9) / 300, s: 1 });
      }
      return t > 6.3;
    },
    pose(p, a, rs) {
      const m = seg(a.t, 0, 0.8) * (1 - seg(a.t, 5.8, 6.3));
      rs.tint = ['#9aa4b8', 0.7 * m]; rs.sy *= lerp(1, 0.9, m); if (m > 0.3) { rs.eyes = 'sad'; rs.mouth = 'sad'; }
    },
    frontW(ctx, p, a) {
      const m = E.back(seg(a.t, 0.2, 0.7)) * (1 - seg(a.t, 5.7, 6.1)); if (m <= 0) return;
      const top = p.bb ? p.bb[1] : p.y - p.R * 1.8, cx = p.x, cy = top - p.R * 1.35, R = p.R;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(m, m);
      ctx.beginPath(); ctx.arc(-R * 0.5, 0, R * 0.42, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(-R * 0.1, -R * 0.3, R * 0.5, Math.PI, Math.PI * 1.9); ctx.arc(R * 0.45, -R * 0.05, R * 0.42, Math.PI * 1.3, Math.PI * 0.5); ctx.closePath();
      ctx.fillStyle = '#b8c0cf'; ctx.fill(); inkLine(ctx, 2.6); ctx.stroke(); ctx.restore();
    },
  });

  def('geju', {
    word: '格局打开', col: '#ffb700', auto: true, click: true, status: '格局已打开', pad: 4.6,
    start(p, a) { p.sfx.play('tick'); p.say(a.o.line || '格局，打开了。', { delay: 1.3 }); },
    update(p, a, dt) {
      if (a.t > 0.75 && !a.f) { a.f = 1; p.sfx.play('fanfare'); }
      if (a.t > 0.9 && a.t < 4 && Math.floor(a.t / 0.12) !== Math.floor((a.t - dt) / 0.12)) { const an = p.r() * TAU, d = p.R * (2 + p.r() * 1.5); p.emit('spark', { x: p.x + Math.cos(an) * d, y: p.y - p.R * 1.8 + Math.sin(an) * d, life: 0.6, s: 8 + p.r() * 6 }); }
      if (a.t > 4.3 && !a.b) { a.b = 1; p.sfx.play('pop'); }
      return a.t > 5.0;
    },
    pose(p, a, rs) { const g = E.back(seg(a.t, 0.75, 1.35)) * (1 - E.io(seg(a.t, 4.2, 4.8))); rs.scale = 1 + 0.8 * g; rs.eyes = a.t > 0.8 && a.t < 4.3 ? 'star' : 'normal'; rs.mouth = a.t > 0.8 ? 'grin' : 'o'; },
    backW(ctx, p, a) {
      const t = a.t, cx = p.x, cy = p.y - p.R * 0.95, s = p.R * 1.35;
      const rays = E.out(seg(t, 0.75, 1.2)) * (1 - seg(t, 4.1, 4.6));
      if (rays > 0) {
        ctx.save(); ctx.translate(cx, p.y - p.R * 1.5); ctx.rotate(t * 0.8); ctx.globalAlpha = 0.85 * rays;
        for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.R * 0.3, -p.R * 3.3 * rays); ctx.lineTo(p.R * 0.3, -p.R * 3.3 * rays); ctx.closePath(); ctx.fillStyle = i % 2 ? '#ffe57a' : '#fff3b8'; ctx.fill(); }
        ctx.restore();
      }
      const draw = E.out(seg(t, 0, 0.5)), open = E.io(seg(t, 0.7, 1.3));
      if (open >= 1) return;
      ctx.save(); ctx.globalAlpha = 1 - open; inkLine(ctx, 3.2);
      const d = s * (1 + open * 1.8);
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate((i * Math.PI) / 2); ctx.translate(0, -d); ctx.rotate(open * 0.9 * (i % 2 ? 1 : -1));
        ctx.beginPath(); ctx.moveTo(-s * draw, 0); ctx.lineTo(s * draw, 0); ctx.stroke(); ctx.restore();
      }
      ctx.globalAlpha *= 0.5; ctx.lineWidth = 2;
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + k * s / 3, cy - d * draw); ctx.lineTo(cx + k * s / 3, cy + d * draw); ctx.moveTo(cx - d * draw, cy + k * s / 3); ctx.lineTo(cx + d * draw, cy + k * s / 3); ctx.stroke(); }
      ctx.restore();
    },
  });

  def('taikula', {
    word: '泰酷辣', col: '#111827', auto: true, click: true, status: '泰酷辣',
    start(p, a) { p.sfx.play('whoosh', { d: 0.5 }); p.say(a.o.line || '泰酷辣。', { delay: 1.2 }); },
    update(p, a) { if (a.t > 0.9 && !a.d) { a.d = 1; p.sfx.play('ding'); p.jigV += 5; } if (a.t > 3.2) { p.acc.shades = 14; return true; } },
    pose(p, a, rs) {
      const u = E.out(seg(a.t, 0.1, 0.9)); rs.mouth = a.t > 0.9 ? 'smirk' : 'o';
      rs.front.push((ctx, g) => { ctx.save(); ctx.translate(0, -(1 - u) * g.R * 7); drawShades(ctx, g, p); ctx.restore(); });
    },
  });

  def('babiq', {
    word: '芭比Q了', col: '#ff6a00', auto: true, click: true, status: '烤着呢',
    start(p, a) { p.sfx.play('swish'); p.sfx.play('sizzle', { d: 4.2 }); p.say(a.o.line || '芭比Q了。', { delay: 0.9 }); },
    update(p, a, dt) {
      if (a.t > 0.5 && a.t < 4.6 && Math.floor(a.t / 0.2) !== Math.floor((a.t - dt) / 0.2)) p.emit('smoke', { x: p.x + (p.r() - 0.5) * p.R, y: p.y - p.R * 2.2, vy: -50, vx: (p.r() - 0.5) * 20, life: 1.4, s: 8 + p.r() * 5 });
      if (a.t > 5.2) { p.acc.toast = 10; return true; }
    },
    pose(p, a, rs) {
      const t = a.t, inS = E.out(seg(t, 0, 0.35)), out = seg(t, 4.8, 5.2), lift = p.R * 0.55 * (1 - out) * E.out(seg(t, 0.2, 0.5));
      rs.raise = lift; rs.eyes = t > 0.4 ? 'x' : 'normal'; rs.mouth = 'o'; rs.tint = ['#9a5a2a', 0.5 * seg(t, 0.5, 4.5)]; rs.pivot = 'center'; rs.rot = Math.sin(t * 2.2) * 0.25 * seg(t, 0.4, 0.8);
      const stick = (ctx, g) => { const L = g.rx * 2.4; ctx.save(); ctx.translate(-L * 1.4 * (1 - inS) + out * L * 2, g.ry * 0.05); ctx.fillStyle = '#c8894a'; inkLine(ctx, 2.2); ctx.beginPath(); ctx.moveTo(-L, -3); ctx.lineTo(L * 0.9, -3); ctx.lineTo(L, 0); ctx.lineTo(L * 0.9, 3); ctx.lineTo(-L, 3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); };
      rs.back.push(stick); rs.front.push((ctx, g) => { ctx.save(); ctx.beginPath(); ctx.rect(-g.rx * 3, -g.ry * 2, g.rx * 2.1, g.ry * 4); ctx.rect(g.rx * 0.9, -g.ry * 2, g.rx * 3, g.ry * 4); ctx.clip(); stick(ctx, g); ctx.restore(); });
    },
    backW(ctx, p, a) {
      const t = a.t, m = E.back(seg(t, 0.3, 0.6)) * (1 - seg(t, 4.7, 5.1)); if (m <= 0) return;
      const R = p.R;
      for (let i = -1; i <= 1; i++) {
        const fl = 1 + 0.25 * Math.sin(p.t * 17 + i * 2), h = R * 0.9 * m * fl * (i ? 0.75 : 1), x = p.x + i * R * 0.55, y = p.y;
        ctx.beginPath(); ctx.moveTo(x - R * 0.28, y); ctx.quadraticCurveTo(x - R * 0.35, y - h * 0.6, x + Math.sin(p.t * 9 + i) * 5, y - h); ctx.quadraticCurveTo(x + R * 0.35, y - h * 0.6, x + R * 0.28, y); ctx.closePath();
        ctx.fillStyle = '#ff8a1c'; ctx.fill(); inkLine(ctx, 2.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - R * 0.13, y); ctx.quadraticCurveTo(x, y - h * 0.75, x + R * 0.13, y); ctx.closePath(); ctx.fillStyle = '#ffe14d'; ctx.fill();
      }
      inkLine(ctx, 2.2); ctx.fillStyle = '#6b6b6b'; ctx.beginPath(); ctx.rect(p.x - R * 1.1, p.y - 3, R * 2.2, 6); ctx.fill(); ctx.stroke();
    },
  });

  def('xiaochou', {
    word: '小丑竟是我自己', col: '#e0245e', auto: true, click: true, status: '小丑',
    start(p, a) { p.sfx.play('honk'); p.say(a.o.line || '小丑竟是我自己。', { delay: 1.0 }); },
    update(p, a) { if (a.t > 3.8) { p.acc.clown = 10; return true; } },
    pose(p, a, rs) { const k = E.el(seg(a.t, 0, 0.6)); rs.mouth = 'grin'; rs.front.push((ctx, g) => { ctx.save(); ctx.scale(1, 1); ctx.globalAlpha *= clamp(k, 0, 1); drawClown(ctx, Object.assign({}, g, { R: g.R * k }), p); ctx.restore(); }); },
  });

  def('huixie', {
    word: '我真的会谢', col: '#18a999', auto: true, click: true, status: '谢谢谢谢',
    start(p, a) { a.n = 0; },
    update(p, a) {
      const b = Math.floor(a.t / 0.55);
      if (a.t < 3.4 && b !== a.n) { a.n = b; p.sfx.play('babble', { text: '谢', pitch: 620 + (b % 2) * 80 }); p.emit('txt', { x: p.x + p.face * p.R * 0.8, y: p.y - p.R * 1.4, vx: p.face * (80 + p.r() * 90), vy: -200 - p.r() * 80, g: 300, vr: (p.r() - 0.5) * 4, life: 1.3, txt: '谢', s: 20 + p.r() * 8, c: '#18a999' }); }
      return a.t > 4.0;
    },
    pose(p, a, rs) { const ph = (a.t % 0.55) / 0.55; rs.rot = a.t < 3.4 ? p.face * 0.6 * Math.sin(ph * Math.PI) : 0; rs.eyes = 'happy'; rs.mouth = 'cat'; },
  });

  def('yaoyao', {
    word: '遥遥领先', col: '#d62828', auto: false, click: true, status: '遥遥领先', pad: 3,
    ext: (p, a) => a.t < 1.3 ? [Math.min(a.x0, a.x1) - p.R * 4, p.y - p.R * 3, Math.max(a.x0, a.x1) + p.R * 4, p.y + 20] : null,
    start(p, a) { const pl = p.plats[0]; a.dir = p.x < p.W / 2 ? 1 : -1; a.x0 = p.x; a.x1 = a.dir > 0 ? p.W - p.R * 2.5 : p.R * 2.5; if (Math.abs(a.x1 - a.x0) < 300) { a.dir *= -1; a.x1 = a.dir > 0 ? p.W - p.R * 2.5 : p.R * 2.5; } p.face = a.dir; a.trail = []; },
    update(p, a, dt) {
      const t = a.t;
      if (t > 0.3 && !a.z) { a.z = 1; p.sfx.play('zip'); p.sfx.play('whoosh', { d: 0.6 }); }
      if (t > 0.3 && t < 1.2) { p.x = lerp(a.x0, a.x1, E.io(seg(t, 0.3, 1.2))); a.trail.push({ x: p.x, y: p.y }); if (a.trail.length > 6) a.trail.shift(); if (Math.floor(t / 0.03) !== Math.floor((t - dt) / 0.03)) p.emit('line', { x: p.x - a.dir * p.R * (1.4 + p.r()), y: p.y - p.R * (0.3 + p.r() * 1.4), life: 0.25, s: -a.dir * (20 + p.r() * 30) }); }
      if (t > 1.2 && !a.s) { a.s = 1; a.trail = []; for (let i = 0; i < 5; i++) p.emit('dust', { x: p.x + a.dir * p.R * 0.6, y: p.y - 4, vx: a.dir * (60 + p.r() * 120), vy: -40 - p.r() * 50, drag: 4, life: 0.5, s: 7 }); p.sfx.play('land', { v: 0.5 }); }
      if (t > 1.6 && !a.turn) { a.turn = 1; p.face = -a.dir; p.say(a.o.line || '遥遥领先。', { delay: 0.2 }); }
      return t > 4.0;
    },
    pose(p, a, rs) {
      const t = a.t;
      if (t < 0.3) { rs.sy *= 0.8; rs.sx *= 1.15; }
      else if (t < 1.2) { rs.legs = 'run'; rs.legLift = 1; rs.rot = a.dir * 0.25; rs.eyes = 'normal'; rs.look = { x: a.dir, y: 0 }; rs.jx = -a.dir * 10; }
      else if (t < 1.6) { rs.rot = -a.dir * 0.3 * (1 - seg(t, 1.2, 1.6)); rs.jx = a.dir * 8 * (1 - seg(t, 1.2, 1.6)); }
      else { rs.mouth = 'smirk'; rs.look = { x: -a.dir, y: 0 }; rs.eyes = 'normal'; }
    },
    backW(ctx, p, a) { if (!a.trail) return; const rs = p.baseRS(); a.trail.forEach((q, i) => { ctx.save(); ctx.globalAlpha = 0.1 + i * 0.05; p.drawBody(ctx, Object.assign({}, rs, { x: q.x, y: q.y, rot: a.dir * 0.25, legs: 'run', legLift: 1, front: [], back: [] })); ctx.restore(); }); },
  });

  const suitcase = (ctx, x, y, g) => {
    const R = g.R; ctx.save(); ctx.translate(x, y + R * 0.45);
    wobblyRect(ctx, -R * 0.42, 0, R * 0.84, R * 0.62, 6, Math.floor(g.t * 8), 0.6); ctx.fillStyle = '#c0703a'; ctx.fill(); inkLine(ctx, 2.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R * 0.15, 0); ctx.lineTo(-R * 0.15, -R * 0.35); ctx.lineTo(R * 0.15, -R * 0.35); ctx.lineTo(R * 0.15, 0); ctx.stroke();
    ctx.fillStyle = '#ffd84f'; ctx.fillRect(-R * 0.42, R * 0.25, R * 0.84, R * 0.08); ctx.restore();
  };
  function walkOff(p, a, dt, sp) {
    p.x += a.dir * sp * dt; p.face = a.dir; p.legPh += dt * sp / 7;
    return p.x < -p.R * 3 || p.x > p.W + p.R * 3;
  }
  def('run', {
    word: '润了', col: '#16a34a', auto: false, click: true, status: '润了', hiddenOk: true,
    start(p, a) { a.dir = p.x < p.W / 2 ? -1 : 1; p.sfx.play('pop'); p.say(a.o.line || '润了。', { delay: 0.5 }); a.ph = 0; },
    update(p, a, dt) {
      if (a.ph === 0 && a.t > 0.6) { if (walkOff(p, a, dt, 190 * p.size)) { a.ph = 1; a.t1 = a.t; p.hidden = true; } }
      if (a.ph === 1 && a.t - a.t1 > 5) { a.ph = 2; p.hidden = false; p.x = a.dir < 0 ? p.W + p.R * 2 : -p.R * 2; p.y = p.floorY; p.plat = p.plats[0]; a.tx = p.W * (0.3 + p.r() * 0.4); }   // went around the world: back in from the other edge
      if (a.ph === 2) { p.x += a.dir * 110 * p.size * dt; p.face = a.dir; p.legPh += dt * 110 / 7; if (!a.said && Math.abs(p.x - a.tx) < 260) { a.said = 1; p.say('外面也不好混。'); } if ((a.dir > 0 && p.x >= a.tx) || (a.dir < 0 && p.x <= a.tx)) return true; }
    },
    pose(p, a, rs) { if (a.t > 0.6) { rs.legs = 'walk'; rs.legLift = 1; } rs.eyes = a.ph === 2 ? 'sad' : 'normal'; rs.mouth = a.ph === 2 ? 'sad' : 'smile'; rs.arms.push({ side: 1, x: p.geom(rs).rx * 1.15, y: p.geom(rs).ry * 0.35, item: suitcase }); },
  });

  def('xiaban', {
    word: '下班', col: '#0ea5e9', auto: false, click: true, status: '已下班', hiddenOk: true,
    start(p, a) { a.dir = p.x < p.W / 2 ? -1 : 1; p.say(L().offWork, { delay: 0.3 }); p.sfx.play('ding'); },
    update(p, a, dt) {
      if (a.t > 1.6 && !a.gone) { if (walkOff(p, a, dt, 120 * p.size)) { a.gone = 1; p.hidden = true; p.offWork = a.o.stay || 7; return true; } }
    },
    pose(p, a, rs) {
      const g = p.geom(rs);
      rs.back.push((ctx, g2) => { const { rx, ry, R } = g2; ctx.save(); ctx.translate(-rs.face * rx * 0.75, -ry * 0.05); wobblyRect(ctx, -R * 0.45, -R * 0.55, R * 0.9, R * 1.05, 10, Math.floor(p.t * 8), 0.6); ctx.fillStyle = '#3b82f6'; ctx.fill(); inkLine(ctx, 2.4); ctx.stroke(); ctx.restore(); });
      if (a.t < 1.6) { rs.arms.push({ side: -rs.face, x: -rs.face * g.rx * 1.2, y: -g.ry * (0.8 + 0.25 * Math.sin(a.t * 14)) }); rs.eyes = 'happy'; rs.mouth = 'grin'; }
      else { rs.legs = 'walk'; rs.legLift = 1; }
    },
  });
  def('comeback', {
    auto: false, hiddenOk: true,
    start(p, a) { p.hidden = false; p.offWork = 0; a.dir = p.r() < 0.5 ? 1 : -1; p.x = a.dir > 0 ? -p.R * 2 : p.W + p.R * 2; p.y = p.floorY; p.plat = p.plats[0]; a.tx = p.W * (0.3 + p.r() * 0.4); },
    update(p, a, dt) { p.x += a.dir * 120 * p.size * dt; p.face = a.dir; p.legPh += dt * 120 / 7; if (!a.said && Math.abs(p.x - a.tx) < 250) { a.said = 1; p.say(a.o.line || '我回来了。'); } return (a.dir > 0 && p.x >= a.tx) || (a.dir < 0 && p.x <= a.tx); },
    pose(p, a, rs) { rs.legs = 'walk'; rs.legLift = 1; rs.eyes = 'dead'; rs.mouth = 'flat'; },
  });

  def('huabing', {
    word: '画饼', col: '#d97706', auto: true, click: true, status: '画饼中',
    ext: (p, a) => a.px != null ? [Math.min(p.x, a.px) - a.r - 60, Math.min(p.y - p.R * 2, a.py) - a.r - 60, Math.max(p.x, a.px) + a.r + 60, p.y + 20] : null,
    start(p, a) { const side = p.x < p.W / 2 ? 1 : -1; p.face = side; a.side = side; a.px = clamp(p.x + side * p.R * 3.3, 70, p.W - 70); a.py = Math.max(p.ceilY + 80, p.y - p.R * 3.4); a.r = p.R * 1.25; p.sfx.play('swish'); },
    update(p, a, dt) {
      const t = a.t;
      if (t > 1.7 && !p.pie && !a.made) { a.made = 1; p.pie = { x: a.px, y: a.py, r: a.r, state: 'ready', hit: false }; p.sfx.play('pop'); p.say(a.o.line || '饼给你画好了。'); }
      const pie = p.pie;
      if (pie && pie.hit && pie.state === 'ready') {
        pie.state = 'gone'; p.sfx.play('crack'); p.sfx.play('shatter');
        for (let i = 0; i < 16; i++) { const an = p.r() * TAU; p.emit('crumb', { x: pie.x + Math.cos(an) * pie.r * 0.6, y: pie.y + Math.sin(an) * pie.r * 0.6, vx: Math.cos(an) * (100 + p.r() * 180), vy: -120 - p.r() * 150, g: 1200, life: 1.3, s: 3 + p.r() * 4, c: '#f2b44b', floor: p.floorY }); }
        p.say('饼没了。下次再画。'); a.end = t + 2.2;
      }
      if (pie && pie.state === 'ready' && t > 9) { pie.state = 'fade'; a.fade = t; p.say('吃不到的饼，最香。'); a.end = t + 2.5; }
      if (a.end && t > a.end) return true;
    },
    end(p) { p.pie = null; },
    pose(p, a, rs) {
      const t = a.t, g = p.geom(rs);
      if (t < 1.8) {
        const u = E.io(seg(t, 0.35, 1.6)), an = -Math.PI / 2 + u * TAU;
        const [lx, ly] = p.worldToLocal(rs, g, a.px + Math.cos(an) * a.r, a.py + Math.sin(an) * a.r);
        rs.arms.push({ side: lx >= 0 ? 1 : -1, x: lx, y: ly, item: (ctx, x, y) => { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6); ctx.fillStyle = '#8b5a2b'; inkLine(ctx, 1.8); ctx.fillRect(-2.5, -24, 5, 22); ctx.strokeRect(-2.5, -24, 5, 22); ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-4, -24); ctx.lineTo(0, -34); ctx.lineTo(4, -24); ctx.fill(); ctx.restore(); } });
        rs.look = { x: a.side, y: -0.7 }; rs.mouth = 'smirk';
      } else { rs.mouth = p.pie && p.pie.state === 'gone' ? 'sad' : 'grin'; rs.eyes = p.pie && p.pie.state === 'gone' ? 'sad' : 'happy'; }
    },
    frontW(ctx, p, a) {
      const t = a.t, u = E.io(seg(t, 0.35, 1.6)); if (t < 0.35) return;
      const pie = p.pie; if (pie && pie.state === 'gone') return;
      const al = pie && pie.state === 'fade' ? 1 - seg(t, a.fade, a.fade + 1.2) : 1;
      ctx.save(); ctx.globalAlpha = al; ctx.translate(a.px, a.py);
      if (t > 1.6) {
        const k = E.back(seg(t, 1.6, 1.9)); ctx.scale(k, k);
        ctx.beginPath(); ctx.arc(0, 0, a.r, 0, TAU); ctx.fillStyle = '#f4c46b'; ctx.fill();
        ctx.fillStyle = '#d98f2e'; for (let i = 0; i < 5; i++) { const an = i * 1.3; ctx.beginPath(); ctx.ellipse(Math.cos(an) * a.r * 0.5, Math.sin(an) * a.r * 0.5, a.r * 0.16, a.r * 0.09, an, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#fff6dc'; for (let i = 0; i < 14; i++) { const an = i * 2.4, d = (i % 5) / 5 * a.r * 0.8; ctx.beginPath(); ctx.ellipse(Math.cos(an) * d, Math.sin(an) * d, 2.4, 1.3, an, 0, TAU); ctx.fill(); }
        if (pie && pie.state === 'ready') { const bl = 0.5 + 0.5 * Math.sin(p.t * 6); label(ctx, '点我', 0, -a.r - 16, 14, `rgba(255,255,255,${0.6 + 0.4 * bl})`); }
      }
      inkLine(ctx, 3.2); ctx.beginPath(); ctx.arc(0, 0, a.r, -Math.PI / 2, -Math.PI / 2 + u * TAU); ctx.stroke();
      ctx.restore();
    },
  });

  def('cpu', {
    word: 'CPU干烧了', col: '#ef4444', auto: true, click: true, status: 'CPU干烧了',
    start(p, a) { p.sfx.play('whine', { d: 2.2 }); },
    update(p, a, dt) {
      const t = a.t;
      if (t > 1.2 && t < 4.2 && Math.floor(t / 0.12) !== Math.floor((t - dt) / 0.12)) { const top = p.bb ? p.bb[1] : p.y - p.R * 1.8; p.emit('smoke', { x: p.x + (p.r() - 0.5) * p.R * 0.8, y: top + 6, vy: -70 - p.r() * 40, vx: (p.r() - 0.5) * 40, life: 1.2, s: 7 + p.r() * 5, c: '#8a8f99' }); }
      if (t > 2.2 && !a.pp) { a.pp = 1; p.sfx.play('pop'); p.say(a.o.line || 'CPU干烧了。'); }
      return t > 4.6;
    },
    pose(p, a, rs) { const t = a.t; rs.tint = ['#ff4040', 0.4 * seg(t, 0.5, 2.2)]; if (t > 1) rs.eyes = 'spiral'; rs.mouth = t > 2.2 ? 'wavy' : 'flat'; if (t > 1.8) rs.dx = Math.sin(t * 60) * 1.8; },
    frontW(ctx, p, a) {
      const t = a.t; if (t > 2.2) return;
      const top = p.bb ? p.bb[1] : p.y - p.R * 1.8, x = p.x - 46, y = top - 26, w = 92, prog = Math.min(0.99, E.out(seg(t, 0, 1.8)) * 0.99);
      wobblyRect(ctx, x, y, w, 16, 6, Math.floor(p.t * 8), 0.5); ctx.fillStyle = '#fff'; ctx.fill(); inkLine(ctx, 2); ctx.stroke();
      ctx.fillStyle = '#4ade80'; ctx.fillRect(x + 3, y + 3, (w - 6) * prog, 10);
      label(ctx, `思考中 ${Math.round(prog * 100)}%`, p.x, y - 12, 13, '#fff');
    },
  });

  // cubist: the body is cut into shards that drift apart, the face is rearranged
  const SHARDS = [[[-1.3, -1.3], [0.1, -1.3], [-0.2, -0.2], [-1.3, 0.1]], [[0.1, -1.3], [1.3, -1.3], [1.3, -0.4], [-0.2, -0.2]], [[-1.3, 0.1], [-0.2, -0.2], [-0.1, 1.2], [-1.3, 1.2]],
    [[-0.2, -0.2], [1.3, -0.4], [1.3, 0.5], [0.3, 0.5]], [[-0.2, -0.2], [0.3, 0.5], [-0.1, 1.2]], [[0.3, 0.5], [1.3, 0.5], [1.3, 1.2], [-0.1, 1.2]]];
  const CUBE = ['#e9b44c', '#4f7cac', '#e07a5f', '#81b29a', '#f2cc8f', '#c77dff'];
  def('chouxiang', {
    word: '抽象', col: '#7c3aed', auto: true, click: true, status: '抽象',
    start(p, a) { p.sfx.play('glitch', { d: 0.9 }); p.say(a.o.line || '我抽象了。', { delay: 1.0 }); },
    update(p, a) { if (a.t > 4.0 && !a.b) { a.b = 1; p.sfx.play('pop'); } return a.t > 4.6; },
    body(ctx, p, a, rs) {
      const t = a.t, m = E.back(seg(t, 0.05, 0.5)) * (1 - E.io(seg(t, 3.9, 4.4)));
      if (m <= 0.01) return p.drawBody(ctx, rs);
      const g = p.geom(rs), { rx, ry, R } = g, cy = p.y - g.lh;
      const pts = blobPts(rx, ry, 0, g.step, 0.6, p.t);
      SHARDS.forEach((sh, i) => {
        const ox = (hash(i, 1) - 0.5) * 22 * m + Math.sin(p.t * 3 + i) * 3 * m, oy = (hash(i, 2) - 0.5) * 18 * m, ro = (hash(i, 3) - 0.5) * 0.5 * m;
        ctx.save(); ctx.translate(p.x + ox, cy + oy); ctx.rotate(ro);
        ctx.beginPath(); sh.forEach(([x, y], k) => (k ? ctx.lineTo(x * rx, y * ry) : ctx.moveTo(x * rx, y * ry))); ctx.closePath(); ctx.save(); ctx.clip();
        ctx.beginPath(); smooth(ctx, pts); ctx.fillStyle = m > 0.5 ? CUBE[i] : rs.col; ctx.fill(); inkLine(ctx, rs.lw); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.beginPath(); smooth(ctx, pts); ctx.clip(); ctx.beginPath(); sh.forEach(([x, y], k) => (k ? ctx.lineTo(x * rx, y * ry) : ctx.moveTo(x * rx, y * ry))); ctx.closePath(); inkLine(ctx, 2.2); ctx.stroke(); ctx.restore();
        ctx.restore();
      });
      // rearranged face: a big frontal eye on one shard, a profile eye on another, a vertical mouth
      const f = (x, y, fn) => { ctx.save(); ctx.translate(p.x + x, cy + y); fn(); ctx.restore(); };
      f(-rx * 0.45 + 6 * m, -ry * 0.55, () => p.drawEye(ctx, 0, 0, R * 0.3, 'normal', Object.assign({}, rs, { look: { x: 1, y: 0.4 }, blink: 0 }), 0, g));
      f(rx * 0.5, ry * 0.05 - 8 * m, () => { ctx.rotate(0.3); ctx.beginPath(); ctx.moveTo(-R * 0.26, 0); ctx.quadraticCurveTo(0, -R * 0.24, R * 0.26, 0); ctx.quadraticCurveTo(0, R * 0.24, -R * 0.26, 0); ctx.fillStyle = '#fff'; ctx.fill(); inkLine(ctx, rs.lw * 0.8); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(R * 0.05, 0, R * 0.08, 0, TAU); ctx.fill(); });
      f(-rx * 0.05, ry * 0.35, () => { ctx.rotate(1.35); p.drawMouth(ctx, 0, 0, R * 0.2, 'smirk', rs, g); });
      return g;
    },
  });

  def('banwei', {
    word: '班味', col: '#65a30d', auto: true, click: true, status: '一身班味',
    start(p, a) { p.say(a.o.line || '一身班味。', { delay: 1.0 }); p.sfx.play('whoosh', { d: 0.5 }); },
    update(p, a, dt) { if (a.t > 0.3 && a.t < 4.6 && Math.floor(a.t / 0.3) !== Math.floor((a.t - dt) / 0.3)) p.emit('stink', { x: p.x + (p.r() - 0.5) * p.R * 1.8, y: p.y - p.R * 1.9, vy: -40, life: 1.4 }); return a.t > 5.0; },
    pose(p, a, rs) {
      const m = seg(a.t, 0, 0.6) * (1 - seg(a.t, 4.6, 5.0)); rs.tint = ['#8fa37a', 0.55 * m]; if (m > 0.3) { rs.eyes = 'dead'; rs.mouth = 'flat'; }
      rs.front.push((ctx, g) => { if (m < 0.1) return; const { R, ry } = g; ctx.save(); ctx.translate(g.rs.face * 0.1 * g.rx + g.rx * 0.02, ry * 0.4); ctx.scale(m, m); ctx.beginPath(); ctx.moveTo(-R * 0.08, 0); ctx.lineTo(R * 0.08, 0); ctx.lineTo(R * 0.13, R * 0.26); ctx.lineTo(0, R * 0.38); ctx.lineTo(-R * 0.13, R * 0.26); ctx.closePath(); ctx.fillStyle = '#2d4a8a'; ctx.fill(); inkLine(ctx, 1.8); ctx.stroke(); ctx.restore(); });
    },
    frontW(ctx, p, a) {
      if (a.t < 0.4 || a.t > 4.6) return;
      for (let i = 0; i < 2; i++) {
        const an = p.t * (3.2 + i) + i * 3, x = p.x + Math.cos(an) * p.R * 1.6, y = p.y - p.R * 1.9 + Math.sin(an * 1.7) * p.R * 0.5;
        ctx.fillStyle = 'rgba(255,255,255,.8)'; inkLine(ctx, 1.2);
        for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + k * 3, y - 4 + Math.sin(p.t * 60) * 1.5, 3, 5, k * 0.5, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
      }
    },
  });

  def('yidu', {
    word: '已读不回', col: '#94a3b8', auto: true, click: true, status: '已读',
    start(p, a) { p.sfx.play('tick'); },
    update(p, a) { if (a.t > 1.0 && !a.s) { a.s = 1; p.say('……', { cps: 3, hold: 1.4, sound: false }); } return a.t > 4.2; },
    pose(p, a, rs) {
      const back = a.t > 0.5 && a.t < 3.8;
      if (back) { rs.noFace = true; rs.front.push((ctx, g) => { const { rx, ry, R } = g; ctx.save(); inkLine(ctx, 2.2); ctx.beginPath(); ctx.moveTo(-R * 0.1, -ry * 0.98); ctx.quadraticCurveTo(0, -ry * 1.3, R * 0.2, -ry * 1.18); ctx.stroke(); ctx.restore(); }); rs.jx = Math.sin(a.t * 2) * 1.5; }
      rs.front.push((ctx, g) => { const k = E.back(seg(a.t, 0.1, 0.4)) * (1 - seg(a.t, 3.8, 4.1)); if (k <= 0) return; ctx.save(); ctx.translate(g.rx * 0.75, -g.ry * 1.05); ctx.scale(k, k); wobblyRect(ctx, -20, -11, 40, 22, 8, 0, 0); ctx.fillStyle = '#e5e7eb'; ctx.fill(); inkLine(ctx, 1.6); ctx.stroke(); ctx.font = `13px ${FONT}`; ctx.fillStyle = '#6b7280'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('已读', 0, 1); ctx.restore(); });
    },
  });

  def('xianyan', {
    word: '显眼包', col: '#f59e0b', auto: false, click: true, status: '显眼', pad: 3.4,
    ext: p => [p.x - p.R * 2.5, p.ceilY, p.x + p.R * 2.5, p.y + 12],
    start(p, a) { p.sfx.play('fanfare'); p.say(a.o.line || '我就是显眼包。', { delay: 1.0 }); },
    update(p, a, dt) { if (a.t < 4 && Math.floor(a.t / 0.1) !== Math.floor((a.t - dt) / 0.1)) { const an = p.r() * TAU; p.emit('spark', { x: p.x + Math.cos(an) * p.R * 2, y: p.y - p.R * 1.3 + Math.sin(an) * p.R * 1.8, life: 0.5, s: 7 + p.r() * 5, c: ['#ffe25a', '#ff7eb3', '#7fd4ff'][(p.r() * 3) | 0] }); } return a.t > 4.4; },
    pose(p, a, rs) {
      const k = E.back(seg(a.t, 0, 0.5)) * (1 - seg(a.t, 3.9, 4.3)); rs.scale = 1 + 0.25 * k; rs.eyes = 'star'; rs.mouth = 'grin'; rs.outline = `hsl(${(p.t * 400) % 360},90%,45%)`; rs.lw *= 1.3;
      const g = p.geom(rs); const up = Math.sin(a.t * 10) * 0.2;
      rs.arms.push({ side: -1, x: -g.rx * 1.25, y: -g.ry * (1 + up) }, { side: 1, x: g.rx * 1.25, y: -g.ry * (1 - up) });
    },
    backW(ctx, p, a) {
      const k = seg(a.t, 0, 0.3) * (1 - seg(a.t, 3.9, 4.3)); if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = 0.35 * k; const gr = ctx.createLinearGradient(0, p.ceilY, 0, p.y); gr.addColorStop(0, 'rgba(255,245,180,0)'); gr.addColorStop(1, 'rgba(255,240,150,1)'); ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(p.x - 18, p.ceilY); ctx.lineTo(p.x + 18, p.ceilY); ctx.lineTo(p.x + p.R * 2.2, p.y + 4); ctx.lineTo(p.x - p.R * 2.2, p.y + 4); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.5 * k; ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.R * 2.2, 8, 0, 0, TAU); ctx.fill(); ctx.restore();
    },
  });

  // ------------------------------------------------------------------ interactive (not in the random pools)
  def('pat', {
    status: '反向撸人',
    start(p, a) { p.say(p.pick(L().pat), { delay: 0.5 }); },
    update(p, a) { if (a.t > 0.5 && Math.floor(a.t / 0.3) !== Math.floor((a.t - 0.017) / 0.3) && a.t < 2.3) p.sfx.play('tick'); if (a.t > 2.4 && !a.h) { a.h = 1; p.hearts(3); } return a.t > 3.0; },
    pose(p, a, rs) {
      const g = p.geom(rs), m = p.mouse;
      let [lx, ly] = p.worldToLocal(rs, g, m.x, m.y - 6 - Math.abs(Math.sin(a.t * 10)) * 10 * seg(a.t, 0.4, 0.6));
      const d = Math.hypot(lx, ly), mx = g.rx * 2.3; if (d > mx) { lx *= mx / d; ly *= mx / d; }
      rs.arms.push({ side: lx >= 0 ? 1 : -1, x: lx, y: ly }); rs.eyes = 'happy'; rs.mouth = 'cat'; rs.blush = 0.8;
    },
  });
  def('petted', {
    status: '被撸',
    start(p, a) { p.say(p.pick(L().petted), { delay: 0.3 }); p.hearts(4); p.jigV += 8; },
    update(p, a) { return a.t > 2.6; },
    pose(p, a, rs) { rs.eyes = 'happy'; rs.mouth = 'cat'; rs.blush = 1; rs.jx = Math.sin(a.t * 12) * 4 * (1 - seg(a.t, 1, 2.4)); },
  });
  def('throw', {
    status: '遛人',
    start(p, a) { a.dir = p.x < p.W / 2 ? 1 : -1; p.face = a.dir; },
    update(p, a) {
      if (a.t > 0.45 && !a.th) {
        a.th = 1; const g = p.geom(p.baseRS());
        p.ball = { x: p.x + a.dir * g.rx * 1.3, y: p.y - g.ry * 1.6, vx: a.dir * (520 + p.r() * 520), vy: -900 - p.r() * 300, state: 'fly', t: 0, spin: 0 };
        p.sfx.play('whoosh', { d: 0.35 }); p.say(p.pick(L().ballThrow));
      }
      return a.t > 1.0;
    },
    pose(p, a, rs) { const g = p.geom(rs), wind = a.t < 0.45 ? E.out(a.t / 0.45) : 1 - E.out(seg(a.t, 0.45, 0.6)); rs.arms.push({ side: a.dir, x: a.dir * g.rx * lerp(1.1, -0.2, wind), y: -g.ry * lerp(0.9, 1.4, wind), item: a.t < 0.45 ? (ctx, x, y) => { ctx.beginPath(); ctx.arc(x, y - 8, 9, 0, TAU); ctx.fillStyle = '#d8f25a'; ctx.fill(); inkLine(ctx, 2.2); ctx.stroke(); } : null }); rs.mouth = 'grin'; },
  });
  def('goodboy', {
    status: '夸人',
    start(p, a) { p.say(p.pick(L().ballGood)); p.hearts(5); p.sfx.play('sparkle'); },
    update(p, a) { return a.t > 2.4; },
    pose(p, a, rs) { rs.eyes = 'happy'; rs.mouth = 'grin'; const g = p.geom(rs); rs.arms.push({ side: 1, x: g.rx * 1.3, y: -g.ry * (0.9 + 0.2 * Math.sin(a.t * 14)) }); },
  });
  def('goodbye', {
    status: '走了',
    start(p, a) { a.dir = p.x < p.W / 2 ? -1 : 1; p.say(L().leaveGo, { delay: 0.1 }); p.sfx.play('sadTrombone'); },
    update(p, a, dt) { if (a.t > 1.6 && !a.gone) { if (walkOff(p, a, dt, 170 * p.size)) { a.gone = 1; p.hidden = true; a.tq = a.t; } } if (a.gone && a.t - a.tq > 0.6) { p.onQuit(); return true; } },
    pose(p, a, rs) { const g = p.geom(rs); if (a.t > 1.6) { rs.legs = 'walk'; rs.legLift = 1; } rs.eyes = 'sad'; rs.mouth = 'sad'; rs.arms.push({ side: 1, x: g.rx * 1.15, y: g.ry * 0.35, item: suitcase }); },
  });
  def('eat', {
    status: '吃文件',
    ext: (p, a) => a.fx != null && a.t < 0.6 ? [Math.min(p.x, a.fx) - 80, Math.min(p.y - p.R * 2, a.fy) - 110, Math.max(p.x, a.fx) + 80, p.y + 20] : null,
    start(p, a) {
      a.names = a.o.names; const first = a.names[0] || '', r = review(first, a.names.length);
      a.rev = r; a.ext = (first.match(/\.([A-Za-z0-9]+)$/) || [])[1]; a.ext = a.ext ? a.ext.toUpperCase() : (r.folder ? 'DIR' : '?');
      a.fx = a.o.x; a.fy = a.o.y; p.face = a.fx >= p.x ? 1 : -1; p.sfx.play('whoosh', { d: 0.3 });
    },
    update(p, a) {
      const t = a.t;
      if (t > 0.5 && !a.c) { a.c = 1; p.sfx.play('chew'); }
      if (t > 1.35 && !a.r) {
        a.r = 1;
        if (a.rev.spit) { p.sfx.play('spit'); p.emit('file', { x: p.x + p.face * p.R * 0.4, y: p.y - p.R * 0.9, vx: p.face * 420, vy: -520, g: 1400, vr: p.face * 9, life: 1.8, s: 0.8, txt: a.ext, floor: p.floorY - 22 }); }
        else p.sfx.play('gulp');
        p.say(a.rev.say);
        if (!p.fedOnce) { p.fedOnce = true; p.say(L().feedSafe, { queue: true }); }
      }
      return t > 3.4;
    },
    pose(p, a, rs) {
      const t = a.t;
      if (t < 0.5) { rs.mouth = 'huge'; rs.eyes = 'star'; rs.sy *= 1.08; }
      else if (t < 1.35) { rs.mouth = Math.floor(t * 7) % 2 ? 'flat' : 'o'; rs.eyes = 'happy'; rs.sx *= 1 + 0.08 * Math.abs(Math.sin(t * 22)); rs.blush = 0.6; }
      else { rs.mouth = a.rev.spit ? 'wavy' : 'smile'; rs.eyes = a.rev.spit ? 'flat' : 'normal'; }
    },
    frontW(ctx, p, a) {
      const t = a.t; if (t > 0.5) return;
      const u = E.in(t / 0.5), g = p.geom(p.baseRS()), mx = p.x + p.face * g.rx * 0.1, my = p.y - g.lh * 0.6 + g.ry * 0.3 - 0;
      const x = lerp(a.fx, mx, u), y = lerp(a.fy, my, u) - Math.sin(u * Math.PI) * 50;
      fileIcon(ctx, x, y, lerp(1.1, 0.3, u), a.ext, u * 2);
    },
  });

  function review(name, count) {
    const n = (name || '').toLowerCase(), ext = (n.match(/\.([a-z0-9]+)$/) || [])[1] || '';
    const pre = count > 1 ? '自助餐？' : '';
    const R = (say, spit) => ({ say: pre + say, spit: !!spit, folder: !ext });
    if (/最终|final|定稿/.test(n)) return R('最终版？我不信。', true);
    if (/坨坨|tuotuo/.test(n)) return R('你把我喂给我？', true);
    if (/简历|resume|\bcv\b/.test(n)) return R('看完了，建议投给我。');
    if (/发票|报销|invoice/.test(n)) return R('没报销的发票，我不吃。', true);
    if (/论文|thesis|paper|毕设/.test(n)) return R('论文味，好苦。你辛苦了。');
    if (/截图|screenshot|屏幕快照/.test(n)) return R('截图有啥好吃的，里面还有我。');
    if (/周报|日报|汇报|report/.test(n)) return R('周报？编得不错。');
    if (/合同|contract/.test(n)) return R('合同不能吃，吃了要负责。', true);
    const map = [
      [/^(docx?|pages|rtf)$/, '文档味，有点苦。'], [/^(pptx?|key)$/, 'PPT吃多了，会画饼。'], [/^pdf$/, '嚼不动，全是字。'],
      [/^(xlsx?|csv|numbers)$/, '表格，噎住了。'], [/^(jpe?g|png|heic|gif|webp|bmp|tiff?)$/, '好看，但不好吃。'], [/^(mp4|mov|avi|mkv|webm)$/, '吃下去还在动，好怪。'],
      [/^(mp3|wav|flac|m4a|aac)$/, '嗯，是有声音的味道。'], [/^(zip|rar|7z|gz|tar|tgz)$/, '压缩饼干，顶饱。'], [/^(dmg|pkg|app|exe)$/, '同类？我不吃同类。', true],
      [/^(py|js|ts|swift|java|c|cc|cpp|h|go|rs|r|rb|php|html|css|json|sh|ipynb)$/, '代码味，有bug的香气。'], [/^(txt|md)$/, '清淡，适合减肥。'], [/^(ttf|otf|woff2?)$/, '吃完字体，说话都变好看了。'],
      [/^(psd|ai|fig|sketch|xd)$/, '设计稿，甲方还会改，先不吃。', true], [/^(epub|mobi)$/, '书，精神食粮，真的能吃。'],
    ];
    for (const [re, s, spit] of map) if (re.test(ext)) return R(s, spit);
    if (!ext) return R('一整箱？吃不下。', true);
    return R('没见过，好吃爱吃。');
  }

  G.TuoPet = Pet; G.TuoActs = ACTS; G.TuoSkins = SKINS; G.TuoReview = review;
  G.TuoUtil = { E, seg, clamp, lerp, label, wobblyRect, inkLine, fileIcon, INK, FONT, hash };
})(window);
