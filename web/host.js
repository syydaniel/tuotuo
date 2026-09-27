/* 坨坨 · host glue. Inside the Mac app (WKWebView) it talks to Swift through webkit.messageHandlers.pet and
   window.TUOHOST; in a normal browser it builds a fake desktop with draggable windows and a test panel. */
'use strict';
(function () {
  const bridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pet;
  const APP = !!bridge;
  const post = m => { try { if (bridge) bridge.postMessage(m); } catch (e) { } };
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  let dpr = 1, W = innerWidth, H = innerHeight, inited = false;

  // prefs: the app keeps them in UserDefaults (injected as __TUO_PREFS), the browser in localStorage
  const PREFS = window.__TUO_PREFS || {};
  const store = {
    get(k, d) {
      if (APP) return PREFS[k] != null ? PREFS[k] : d;
      try { const v = localStorage.getItem('tuo.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
      if (APP) { PREFS[k] = v; post({ type: 'pref', key: k, value: v }); return; }
      try { localStorage.setItem('tuo.' + k, JSON.stringify(v)); } catch (e) { }
    },
  };
  const sfx = new TuoSfx(); sfx.muted = store.get('mute', false);
  const pet = new TuoPet({
    sfx, clockTriggers: APP, skin: store.get('skin', 1),
    onQuit: () => (APP ? post({ type: 'quit' }) : setTimeout(() => location.reload(), 600)),
    onStatus: s => post({ type: 'status', text: s }),
  });
  pet.size = store.get('size', 1);
  window.PET = pet;

  // The canvas only covers the area the pet is painting in and slides around with CSS transforms,
  // so the GPU never has to recomposite a full-screen Retina layer (idle cost stays near zero).
  const view = { x: 0, y: 0, w: 0, h: 0, small: 0 };
  function place(ext) {
    if (!ext) ext = [pet.x - 60, pet.y - 120, pet.x + 60, pet.y];
    ext = [Math.max(0, ext[0]), Math.max(0, ext[1]), Math.min(W, ext[2]), Math.min(H, ext[3])];
    const nw = ext[2] - ext[0], nh = ext[3] - ext[1];
    const fits = ext[0] >= view.x && ext[1] >= view.y && ext[2] <= view.x + view.w && ext[3] <= view.y + view.h;
    view.small = fits && nw * nh < view.w * view.h * 0.25 ? view.small + 1 : 0;
    if (fits && view.small < 90) return;
    const q = v => Math.ceil(v / 128) * 128;
    const w = Math.min(q(W), q(nw + 220)), h = Math.min(q(H), q(nh + 220));
    view.x = Math.round(Math.max(0, Math.min(W - w, (ext[0] + ext[2]) / 2 - w / 2)));
    view.y = Math.round(Math.max(0, Math.min(H - h, (ext[1] + ext[3]) / 2 - h / 2)));
    if (w !== view.w || h !== view.h) { view.w = w; view.h = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    cv.style.transform = `translate(${view.x}px,${view.y}px)`;
    view.small = 0;
  }
  function resize() {
    dpr = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight; view.w = 0;
    if (!APP) pet.setWorld({ W, H, floorY: H - 74, ceilY: 26 });
  }
  addEventListener('resize', resize); resize();

  function hello() {
    if (inited) return; inited = true;
    pet.x = pet.W * 0.7; pet.y = pet.floorY - 260; pet.air = true; pet.vy = 0; pet.plat = null;
    const first = !store.get('met', false); store.set('met', true);
    setTimeout(() => {
      if (first) { pet.say('你好，我是一坨。点我试试。'); pet.say('右上角菜单栏里也有我。', { queue: true }); }
      else pet.say(pet.pick(['我回来了。', '又见面了，一坨向你问好。', '开机了？那我也开机了。']));
    }, 900);
  }

  // ------------------------------------------------------------ API for Swift
  window.TUOHOST = {
    init(o) { pet.setWorld({ W: o.w, H: o.h, floorY: o.floor, ceilY: o.ceil }); hello(); },
    mouse(x, y) { pet.setMouse(x, y); },
    windows(list) { pet.setWindows(list.map(([id, x, y, w, h]) => ({ id, x, y, w, h }))); },
    battery(level, charging) { pet.setBattery(level, charging); },
    command(name, arg) {
      pet.command(name, arg);
      if (name === 'mute') store.set('mute', pet.sfx.muted);
      if (name === 'skin') store.set('skin', pet.skinI);
      if (name === 'size') store.set('size', pet.size);
    },
    state() { return JSON.stringify({ mute: pet.sfx.muted, quiet: pet.quiet, skin: pet.skinI, size: pet.size, hidden: pet.hidden, offWork: pet.offWork > 0 }); },
  };

  // ------------------------------------------------------------ pointer + drop
  addEventListener('mousedown', e => {
    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) return;
    if (e.button === 0 && pet.pointerDown(e.clientX, e.clientY)) e.preventDefault();
  });
  addEventListener('mousemove', e => pet.setMouse(e.clientX, e.clientY));
  addEventListener('mouseup', e => { if (e.button === 0) pet.pointerUp(e.clientX, e.clientY); });
  addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!pet.inBody(e.clientX, e.clientY, 6)) return;
    if (APP) post({ type: 'menu', x: e.clientX, y: e.clientY }); else devMenu(e.clientX, e.clientY);
  });
  addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; pet.feedHover(true, e.clientX, e.clientY); });
  addEventListener('dragleave', e => { if (!e.relatedTarget) pet.feedHover(false); });
  addEventListener('drop', e => {
    e.preventDefault();
    const names = e.dataTransfer ? [...e.dataTransfer.files].map(f => f.name) : [];
    if (names.length) pet.feed(names, e.clientX, e.clientY); else pet.feedHover(false);
  });

  // ------------------------------------------------------------ loop
  let last = performance.now(), lastHit = '', lastState = '';
  // power saving: display rate while something moves; otherwise a plain timer at 10 fps (5 asleep, 3 off screen).
  // The line "boils" at 8 fps anyway, so idle frames look the same as the hand-drawn style intends.
  function schedule() {
    const b = pet.busy();
    if (!APP || b === 2) return requestAnimationFrame(loop);
    setTimeout(() => requestAnimationFrame(loop), b === 1 ? 26 : pet.hidden ? 330 : pet.mode === 'sleep' ? 200 : 100);
  }
  function loop(now) {
    schedule();
    let step = Math.min(0.25, (now - last) / 1000); last = now;
    while (step > 1e-4) { const d = Math.min(step, 1 / 20); pet.update(d); step -= d; }
    place(pet.extents(ctx));
    ctx.setTransform(dpr, 0, 0, dpr, -view.x * dpr, -view.y * dpr); ctx.clearRect(view.x, view.y, view.w, view.h);
    pet.draw(ctx);
    if (APP) {
      const rects = pet.grab ? [[0, 0, W, H]] : pet.hitRects().map(r => r.map(v => Math.round(v)));
      const key = JSON.stringify(rects);
      if (key !== lastHit) { lastHit = key; post({ type: 'hit', rects }); }
      const st = { type: 'state', mute: pet.sfx.muted, quiet: pet.quiet, size: pet.size, hidden: pet.hidden, offWork: pet.offWork > 0 };
      const sk = JSON.stringify(st); if (sk !== lastState) { lastState = sk; post(st); }
    }
    if (!APP && devTick) devTick();
  }
  document.fonts && document.fonts.load('17px ZK').catch(() => { });
  schedule();
  if (APP) post({ type: 'ready', acts: Object.keys(TuoActs).filter(k => TuoActs[k].click).map(k => [k, TuoActs[k].word]) }); else setTimeout(hello, 50);

  // ------------------------------------------------------------ browser dev mode: fake desktop + test panel
  let devTick = null;
  function devMenu(x, y) {
    const old = document.getElementById('devmenu'); if (old) old.remove();
    const m = document.createElement('div'); m.id = 'devmenu';
    m.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:#fff;border:1px solid #ccc;border-radius:8px;padding:4px;font:14px -apple-system;z-index:20;box-shadow:0 8px 24px rgba(0,0,0,.2)`;
    const items = [['摸摸它', () => pet.command('petted')], ['喂它（把文件拖给它）', () => pet.command('feedHint')], ['扔个球', () => pet.command('ball')], ['换个颜色', () => pet.command('skin')], ['让它走…', () => pet.command('leave')]];
    for (const [lab, fn] of items) { const b = document.createElement('div'); b.textContent = lab; b.style.cssText = 'padding:6px 12px;cursor:default;border-radius:5px'; b.onmouseenter = () => (b.style.background = '#e8f0ff'); b.onmouseleave = () => (b.style.background = ''); b.onclick = () => { m.remove(); fn(); }; m.appendChild(b); }
    document.body.appendChild(m); setTimeout(() => addEventListener('mousedown', () => m.remove(), { once: true }), 0);
  }
  if (!APP) {
    document.body.classList.add('dev');
    const wins = [];
    const mk = (id, x, y, w, h, title) => {
      const d = document.createElement('div'); d.className = 'win'; d.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
      d.innerHTML = `<div class="bar"><i></i><i></i><i></i><span>${title}</span></div><div class="body"></div>`;
      document.getElementById('desk').appendChild(d); wins.push({ id, d });
      let drag = null;
      d.querySelector('.bar').addEventListener('mousedown', e => { drag = { x: e.clientX - d.offsetLeft, y: e.clientY - d.offsetTop }; e.stopPropagation(); wins.splice(wins.findIndex(q => q.d === d), 1); wins.unshift({ id, d }); wins.forEach((q, i) => (q.d.style.zIndex = 5 - i)); });
      addEventListener('mousemove', e => { if (drag) { d.style.left = e.clientX - drag.x + 'px'; d.style.top = e.clientY - drag.y + 'px'; } });
      addEventListener('mouseup', () => (drag = null));
    };
    mk(1, 120, 300, 520, 330, '毕业论文_最终版_真的最终版.docx');
    mk(2, 760, 180, 420, 260, '访达');
    wins.forEach((q, i) => (q.d.style.zIndex = 5 - i));
    devTick = () => pet.setWindows(wins.map(q => ({ id: q.id, x: q.d.offsetLeft, y: q.d.offsetTop, w: q.d.offsetWidth, h: q.d.offsetHeight })));
    const panel = document.getElementById('panel');
    for (const id of Object.keys(TuoActs).filter(k => TuoActs[k].click || ['pat', 'petted', 'throw'].includes(k))) {
      const A = TuoActs[id]; const b = document.createElement('button'); b.textContent = A.word || id; b.onclick = () => pet.play(id); panel.appendChild(b);
    }
    for (const [lab, fn] of [['说话', () => pet.say(pet.pickLine())], ['喂docx', () => pet.feed(['毕业论文_最终版_v8.docx'], 300, 200)], ['喂png', () => pet.feed(['截图 2026-09-27.png'], 300, 200)], ['让它走', () => pet.command('leave')], ['换色', () => pet.command('skin')], ['召唤', () => pet.command('summon')], ['静音', () => pet.command('mute')]]) {
      const b = document.createElement('button'); b.textContent = lab; b.onclick = fn; b.className = 'x'; panel.appendChild(b);
    }
  }
})();
