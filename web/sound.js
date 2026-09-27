/* 坨坨 · synthesized sound. Every sound is a function (ctx, out, t, arg) so the same code runs live (AudioContext)
   and offline for video recording (OfflineAudioContext, events logged with their engine time). No audio files. */
'use strict';
(function (G) {
  let NOISE = null;
  function noiseBuf(ctx) {
    if (NOISE && NOISE.sampleRate === ctx.sampleRate) return NOISE;
    const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let s = 12345; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    return (NOISE = b);
  }
  function env(ctx, out, t, a, peak, d, hold = 0) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d); g.connect(out); return g;
  }
  function osc(ctx, type, f, t, dur, dest) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function noise(ctx, t, dur, dest, off = 0) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.loop = true; s.connect(dest); s.start(t, off % 1.5); s.stop(t + dur + 0.05); return s;
  }
  function filt(ctx, type, f, q, dest) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; }
  const hsh = s => { let h = 7; for (const c of s) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
  const PUNCT = /[\s，。！？、…—,.!?~～：:；;（）()"“”'‘’「」【】《》\-]/;

  const S = {
    // Animal-Crossing style gibberish, one blip per character; pitch per character is stable (same text sounds the same)
    babble(ctx, out, t, a) {
      const text = a.text || '', cps = a.cps || 13, base = a.pitch || 560;
      let i = 0;
      for (const ch of text) {
        const at = t + i / cps; i++;
        if (PUNCT.test(ch)) continue;
        const h = hsh(ch), f = base * Math.pow(2, ((h % 9) - 4) / 12) * (a.up ? 1 + i * 0.03 : 1);
        const g = env(ctx, out, at, 0.006, (a.vol || 0.22), 0.075);
        const bp = filt(ctx, 'bandpass', [700, 1100, 1500, 2100, 2700][h % 5], 2.2, g);
        const o = osc(ctx, 'triangle', f, at, 0.09, bp); o.frequency.exponentialRampToValueAtTime(f * 0.86, at + 0.08);
        const o2 = osc(ctx, 'square', f * 2, at, 0.09, filt(ctx, 'lowpass', 2400, 0.7, g)); o2.frequency.exponentialRampToValueAtTime(f * 1.7, at + 0.08);
      }
    },
    pop(ctx, out, t) { const g = env(ctx, out, t, 0.004, 0.3, 0.09); const o = osc(ctx, 'sine', 320, t, 0.1, g); o.frequency.exponentialRampToValueAtTime(980, t + 0.07); },
    boing(ctx, out, t, a = {}) {
      const g = env(ctx, out, t, 0.005, 0.26, 0.42); const o = osc(ctx, 'sine', (a.f || 170), t, 0.45, g);
      o.frequency.exponentialRampToValueAtTime((a.f || 170) * 2.6, t + 0.12); o.frequency.exponentialRampToValueAtTime((a.f || 170) * 1.3, t + 0.42);
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 22; lg.gain.value = 26; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.45);
    },
    land(ctx, out, t, a = {}) {
      const v = Math.min(1, a.v || 0.5); const g = env(ctx, out, t, 0.003, 0.35 * v, 0.16); const o = osc(ctx, 'sine', 150, t, 0.18, g); o.frequency.exponentialRampToValueAtTime(55, t + 0.15);
      noise(ctx, t, 0.08, filt(ctx, 'lowpass', 700, 0.7, env(ctx, out, t, 0.002, 0.18 * v, 0.07)));
    },
    whoosh(ctx, out, t, a = {}) {
      const d = a.d || 0.45; const bp = filt(ctx, 'bandpass', 400, 1.4, env(ctx, out, t, d * 0.35, 0.28, d * 0.65));
      bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(3200, t + d * 0.45); bp.frequency.exponentialRampToValueAtTime(700, t + d);
      noise(ctx, t, d, bp, 0.3);
    },
    bubble(ctx, out, t) { const g = env(ctx, out, t, 0.003, 0.12, 0.06); const o = osc(ctx, 'sine', 500, t, 0.08, g); o.frequency.exponentialRampToValueAtTime(1500, t + 0.06); },
    splash(ctx, out, t) {
      noise(ctx, t, 0.35, filt(ctx, 'lowpass', 1800, 0.8, env(ctx, out, t, 0.005, 0.3, 0.32)));
      for (let i = 0; i < 5; i++) S.bubble(ctx, out, t + 0.05 + i * 0.05);
    },
    crack(ctx, out, t) {
      for (let i = 0; i < 4; i++) noise(ctx, t + i * 0.045, 0.02, filt(ctx, 'highpass', 1800, 0.7, env(ctx, out, t + i * 0.045, 0.001, 0.4, 0.03)), i * 0.2);
      const g = env(ctx, out, t, 0.002, 0.25, 0.2); const o = osc(ctx, 'sine', 110, t, 0.22, g); o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
    },
    shatter(ctx, out, t) {
      noise(ctx, t, 0.25, filt(ctx, 'highpass', 2500, 0.7, env(ctx, out, t, 0.002, 0.35, 0.25)));
      for (let i = 0; i < 18; i++) { const at = t + i * 0.028 + (i % 3) * 0.01, f = 2200 + ((i * 7919) % 3800); osc(ctx, 'sine', f, at, 0.1, env(ctx, out, at, 0.001, 0.07, 0.09)); }
    },
    scream(ctx, out, t, a = {}) {
      const d = a.d || 1.6, g = env(ctx, out, t, 0.04, 0.16, 0.25, d - 0.3);
      const f1 = filt(ctx, 'bandpass', 950, 3, g), f2 = filt(ctx, 'bandpass', 1500, 3, g);
      for (const [det, dst] of [[0, f1], [7, f2]]) {
        const o = osc(ctx, 'sawtooth', 620 + det, t, d, dst); o.frequency.linearRampToValueAtTime(900 + det, t + d * 0.5); o.frequency.linearRampToValueAtTime(760, t + d);
        const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 7.5; lg.gain.value = 45; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d);
      }
    },
    laugh(ctx, out, t, a = {}) { S.babble(ctx, out, t, { text: '哈哈哈哈哈哈哈哈', cps: 9, pitch: a.pitch || 640, vol: 0.24 }); },
    static(ctx, out, t, a = {}) {
      const d = a.d || 1.2, g = env(ctx, out, t, 0.01, 0.12, 0.1, d - 0.1);
      noise(ctx, t, d, filt(ctx, 'highpass', 900, 0.5, g));
      for (let i = 0; i < d * 12; i++) { const at = t + i / 12; osc(ctx, 'square', 60 + (i * 37 % 90), at, 0.03, env(ctx, out, at, 0.001, 0.04, 0.02)); }
    },
    rain(ctx, out, t, a = {}) {
      const d = a.d || 3; noise(ctx, t, d, filt(ctx, 'bandpass', 3200, 0.6, env(ctx, out, t, 0.4, 0.05, 0.6, d - 1)));
      for (let i = 0; i < d * 5; i++) { const at = t + 0.2 + i * 0.19 + (i * 0.073 % 0.1), f = 1200 + (i * 331 % 900); const o = osc(ctx, 'sine', f, at, 0.05, env(ctx, out, at, 0.002, 0.05, 0.04)); o.frequency.exponentialRampToValueAtTime(f * 1.6, at + 0.04); }
    },
    sadTrombone(ctx, out, t) {
      const notes = [[196, 0, 0.42], [185, 0.45, 0.42], [174.6, 0.9, 0.42], [164.8, 1.35, 1.1]];
      for (const [f, at, d] of notes) {
        const g = env(ctx, out, t + at, 0.03, 0.18, d * 0.5, d * 0.45), lp = filt(ctx, 'lowpass', 1100, 1.5, g);
        const o = osc(ctx, 'sawtooth', f, t + at, d, lp);
        if (d > 1) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6; lg.gain.value = 5; l.connect(lg); lg.connect(o.frequency); l.start(t + at + 0.3); l.stop(t + at + d); }
      }
    },
    fanfare(ctx, out, t) {
      [523, 659, 784, 1047, 1319].forEach((f, i) => { const at = t + i * 0.09, g = env(ctx, out, at, 0.005, 0.14, i === 4 ? 0.7 : 0.18); osc(ctx, 'triangle', f, at, 0.8, g); osc(ctx, 'square', f, at, 0.3, filt(ctx, 'lowpass', 2000, 0.7, env(ctx, out, at, 0.005, 0.04, 0.15))); });
      S.sparkle(ctx, out, t + 0.45);
    },
    sparkle(ctx, out, t) { [2093, 2637, 3136, 2637, 3520].forEach((f, i) => osc(ctx, 'sine', f, t + i * 0.06, 0.2, env(ctx, out, t + i * 0.06, 0.002, 0.06, 0.18))); },
    sizzle(ctx, out, t, a = {}) {
      const d = a.d || 3; noise(ctx, t, d, filt(ctx, 'highpass', 3500, 0.5, env(ctx, out, t, 0.2, 0.1, 0.5, d - 0.7)));
      for (let i = 0; i < d * 9; i++) { const at = t + i / 9 + (i * 0.037 % 0.05); noise(ctx, at, 0.012, filt(ctx, 'highpass', 2500, 0.7, env(ctx, out, at, 0.001, 0.12, 0.01)), i * 0.11); }
    },
    honk(ctx, out, t) {
      for (const at of [t, t + 0.3]) { const g = env(ctx, out, at, 0.01, 0.2, 0.12, 0.1), bp = filt(ctx, 'bandpass', 950, 2, g); osc(ctx, 'sawtooth', 330, at, 0.25, bp); osc(ctx, 'sawtooth', 342, at, 0.25, bp); }
    },
    ding(ctx, out, t) { osc(ctx, 'sine', 1320, t, 0.9, env(ctx, out, t, 0.002, 0.16, 0.85)); osc(ctx, 'sine', 2640, t, 0.5, env(ctx, out, t, 0.002, 0.05, 0.45)); },
    chew(ctx, out, t) { for (let i = 0; i < 3; i++) noise(ctx, t + i * 0.2, 0.07, filt(ctx, 'lowpass', 420, 1, env(ctx, out, t + i * 0.2, 0.004, 0.4, 0.07)), i * 0.3); },
    gulp(ctx, out, t) { const g = env(ctx, out, t, 0.005, 0.3, 0.15); const o = osc(ctx, 'sine', 380, t, 0.18, g); o.frequency.exponentialRampToValueAtTime(140, t + 0.14); },
    spit(ctx, out, t) { noise(ctx, t, 0.08, filt(ctx, 'bandpass', 1300, 1.5, env(ctx, out, t, 0.002, 0.4, 0.08))); S.pop(ctx, out, t + 0.03); },
    zip(ctx, out, t) { const g = env(ctx, out, t, 0.01, 0.12, 0.25); const o = osc(ctx, 'sawtooth', 200, t, 0.3, filt(ctx, 'lowpass', 1800, 1, g)); o.frequency.exponentialRampToValueAtTime(1400, t + 0.25); },
    rumble(ctx, out, t, a = {}) { const d = a.d || 2; noise(ctx, t, d, filt(ctx, 'lowpass', 220, 1, env(ctx, out, t, 0.1, 0.35, 0.3, d - 0.4))); },
    whine(ctx, out, t, a = {}) {
      const d = a.d || 2.2, g = env(ctx, out, t, 0.2, 0.07, 0.1, d - 0.3); const o = osc(ctx, 'sine', 700, t, d, g); o.frequency.exponentialRampToValueAtTime(3000, t + d);
      noise(ctx, t, d, filt(ctx, 'bandpass', 1800, 0.8, env(ctx, out, t, 0.3, 0.05, 0.1, d - 0.4)));
    },
    glitch(ctx, out, t, a = {}) { const d = a.d || 1; for (let i = 0; i < d * 16; i++) { const at = t + i / 16, f = 200 + (i * 7717 % 1400); osc(ctx, 'square', f, at, 0.05, filt(ctx, 'lowpass', 3000, 1, env(ctx, out, at, 0.001, 0.06, 0.04))); } },
    heart(ctx, out, t) { [1047, 1319, 1568].forEach((f, i) => osc(ctx, 'sine', f, t + i * 0.07, 0.3, env(ctx, out, t + i * 0.07, 0.003, 0.09, 0.25))); },
    tick(ctx, out, t) { osc(ctx, 'square', 1800, t, 0.02, filt(ctx, 'highpass', 1000, 0.7, env(ctx, out, t, 0.001, 0.05, 0.015))); },
    swish(ctx, out, t) { S.whoosh(ctx, out, t, { d: 0.22 }); },
    snore(ctx, out, t) { noise(ctx, t, 1.2, filt(ctx, 'lowpass', 500, 2, env(ctx, out, t, 0.6, 0.06, 0.5))); },
    rattle(ctx, out, t, a = {}) { const d = a.d || 1.5; for (let i = 0; i < d * 14; i++) { const at = t + i / 14; noise(ctx, at, 0.025, filt(ctx, 'bandpass', 900 + (i % 3) * 300, 2, env(ctx, out, at, 0.001, 0.2, 0.025)), i * 0.07); } },
  };

  class Sfx {
    constructor() { this.ctx = null; this.vol = 0.55; this.muted = false; this.log = null; this.clock = () => 0; }
    ensure() {
      if (this.log) return;
      if (!this.ctx) {
        try { const AC = G.AudioContext || G.webkitAudioContext; this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.gain.value = this.vol; this.out.connect(this.ctx.destination); } catch (e) { return; }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    setVol(v) { this.vol = v; if (this.out) this.out.gain.value = v; }
    play(name, arg) {
      if (!S[name]) return;
      if (this.log) { this.log.push({ t: this.clock(), name, arg: arg || null }); return; }
      if (this.muted) return;
      this.ensure(); if (!this.ctx || this.ctx.state !== 'running') return;
      try { S[name](this.ctx, this.out, this.ctx.currentTime + 0.005, arg || {}); } catch (e) { }
    }
    // offline render of a logged event list -> AudioBuffer (stereo 48k)
    static async render(events, dur, vol = 0.55) {
      const sr = 48000, ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr), out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination);
      for (const e of events) if (e.t < dur) S[e.name](ctx, out, e.t + 0.005, e.arg || {});
      return ctx.startRendering();
    }
  }
  Sfx.S = S;
  G.TuoSfx = Sfx;
})(window);
