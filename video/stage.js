/* 坨坨 promo stage: a vector mock of a Mac desktop (1512x982 points) with the real pet engine on top,
   filmed by a virtual 1080x1920 camera. Every clip is a scripted scenario stepped at a fixed 60 fps, so
   recordings are deterministic. URL: stage.html?rec=<scene>&tag=<tag>&frames=N  (record to rec_server)
                                      stage.html?sheet=<scene>&t=0.5,1,2         (contact sheet -> /png)
                                      stage.html?play=<scene>                    (real-time preview) */
'use strict';
(function () {
  const OW = 1080, OH = 1920, SW = 1512, SH = 982, MENU = 28, DOCK_H = 78, FLOOR = SH - DOCK_H;
  const U = TuoUtil, INK = U.INK, E = U.E, clamp = U.clamp, lerp = U.lerp;
  const SYS = '-apple-system, "PingFang SC", "Helvetica Neue", sans-serif';
  const q = new URLSearchParams(location.search);
  const cv = document.getElementById('c'); cv.width = OW; cv.height = OH;
  const ctx = cv.getContext('2d');

  // ---------------------------------------------------------------- desktop model
  const WINS = {
    doc: { id: 11, x: 64, y: 118, w: 560, h: 600, title: '毕业论文_最终版_真的最终版.docx', kind: 'doc' },
    finder: { id: 12, x: 900, y: 404, w: 540, h: 330, title: '下载', kind: 'finder' },
  };
  const FILES = [
    { name: '毕业论文_最终版_真的最终版.docx', ext: 'DOCX', x: 0, y: 0 },
    { name: '周报_第39周.pptx', ext: 'PPTX' },
    { name: '截图 2026-09-26.png', ext: 'PNG' },
    { name: '坨坨.dmg', ext: 'DMG' },
  ];
  // file slots inside the finder window (world coords, filled in layout())
  function layout() {
    const f = WINS.finder, x0 = f.x + 168, y0 = f.y + 72;
    FILES.forEach((F, i) => { F.x = x0 + (i % 3) * 128 + 50; F.y = y0 + Math.floor(i / 3) * 130 + 34; });
  }
  layout();

  // ---------------------------------------------------------------- scene state
  const S = {
    t: 0, cam: { x: SW / 2, y: SH / 2, z: 2 }, camTw: null, follow: null,
    mouse: { x: SW * 0.8, y: SH * 0.5, down: false, visible: false, kind: 'arrow' }, mTw: null,
    wins: ['finder', 'doc'], drag: null, menuOpen: false, menuHover: -1, clock: '9月26日 周五 17:58', clockFlash: 0,
    cat: null, bg: 'desk', title: null, shake: 0, fade: 0,
  };
  const sfx = new TuoSfx(); sfx.log = [];
  const pet = new TuoPet({ seed: +(q.get('seed') || 11), sfx, skin: 1, clock: () => new Date(2026, 8, 26, 17, 58) });
  pet.setWorld({ W: SW, H: SH, floorY: FLOOR, ceilY: MENU });
  function syncWins() { pet.setWindows(S.wins.map(k => WINS[k]).filter(Boolean).map(w => ({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }))); }
  syncWins();
  // the video uses the best line of each random pool
  Object.assign(TUO_LINES, { pat: ['乖，辛苦了。'], feedOpen: ['啊～～'], ballThrow: ['去，捡回来。'], ballGood: ['好狗狗！'], drag: ['救命，我被一只鼠标绑架了。'], dizzy: ['摇匀了。'], leaveDodge: ['点不到吧', '再试试？'] });
  function calm() { // freeze the pet's own agenda; scenes drive everything
    pet.timers.talk = 1e9; pet.timers.act = 1e9; pet.timers.ball = 1e9; pet.timers.pat = 1e9; pet.timers.hurry = 1e9; pet.nextSwap = 1e9;
    pet.setMode('idle', { dur: 1e9 });
    pet.think = () => pet.setMode('idle', { dur: 1e9 });   // no wandering off between scripted beats
  }
  function place(x, y) { pet.x = x; pet.y = y; pet.air = false; pet.plat = pet.plats.find(p => x >= p.x0 && x <= p.x1 && Math.abs(p.y - y) < 2) || pet.plats[0]; }

  // tweens
  function camTo(x, y, z, dur = 0.8, ease = E.io) { S.follow = null; S.camTw = { from: { ...S.cam }, to: { x, y, z }, t0: S.t, dur, ease }; }
  function camSet(x, y, z) { S.follow = null; S.camTw = null; S.cam = { x, y, z }; }
  function follow(z, dy = -60, dx = 0, k = 0.12) { S.camTw = null; S.follow = { z, dy, dx, k }; }
  function move(x, y, dur = 0.6, ease = E.io) { S.mouse.visible = true; S.mTw = { fx: S.mouse.x, fy: S.mouse.y, tx: x, ty: y, t0: S.t, dur, ease }; }
  function down() { S.mouse.down = true; pet.pointerDown(S.mouse.x, S.mouse.y); }
  function up() { S.mouse.down = false; pet.pointerUp(S.mouse.x, S.mouse.y); }

  // ---------------------------------------------------------------- scenes: {dur, setup(), ev: [[t, fn]]}
  const SC = {};
  const at = (t, fn) => [t, fn];
  const onFloor = x => place(x, pet.floorY);

  SC.hook = {
    dur: 5.0, setup() { calm(); pet.x = 760; pet.y = 520; pet.air = true; pet.vy = 0; pet.plat = null; camSet(760, 720, 3.0); camTo(760, 760, 3.5, 5, E.out); },
    ev: [at(0.95, () => { pet.lookT = { x: 0, y: 0.25 }; }), at(1.55, () => pet.say('你好，我是一坨。', { force: true }))],
  };
  SC.swap = {
    dur: 6.2, setup() { calm(); onFloor(760); pet.hidden = true; S.cat = { x: 760, y: FLOOR, t: 0 }; camSet(760, 770, 3.6); },
    ev: [at(3.3, () => { S.cat = null; pet.hidden = false; pet.poof(pet.x, pet.y - pet.R, 12); pet.jigV += 12; }),
      at(3.55, () => { pet.lookT = { x: 0, y: 0.1 }; S.deadpan = 1; }), at(4.3, () => pet.say('……', { force: true, cps: 4, sound: false }))],
  };
  SC.intro = {
    dur: 4.2, setup() { calm(); onFloor(880); pet.face = -1; follow(3.0, -70); },
    ev: [at(0.2, () => pet.setMode('walk', { tx: 620, sp: 70, moon: true }))],
  };
  // montage: one act per clip, narrator speaks over it (pet's own bubbles off)
  const act = (id, x, z, extra = {}) => ({
    dur: extra.dur || 6, setup() { calm(); pet.noSay = !extra.say; onFloor(x); if (extra.face) pet.face = extra.face; if (extra.cam) camSet(...extra.cam); else follow(z, extra.dy != null ? extra.dy : -70); if (extra.setup) extra.setup(); },
    ev: [at(0.35, () => pet.play(id)), ...(extra.ev || [])],
  });
  SC.moyu = act('moyu', 420, 1.955, { dur: 7.2, dy: -200 });
  SC.tangping = act('tangping', 760, 3.6, { dur: 6.8 });
  SC.neijuan = act('neijuan', 760, 2.7, { dur: 6.4 });
  SC.shangtou = act('shangtou', 760, 3.0, { dur: 5.4, cam: [760, 790, 3.0], ev: [at(0.62, () => camTo(760, 150, 3.0, 0.42, E.out)), at(4.55, () => camTo(760, 790, 3.0, 0.5, E.io))] });
  SC.liekai = act('liekai', 760, 3.6, { dur: 5.4 });
  SC.bengbu = act('bengbu', 760, 3.4, { dur: 5.8 });
  SC.babiq = act('babiq', 760, 3.4, { dur: 5.8 });
  SC.geju = act('geju', 760, 2.4, { dur: 5.4, dy: -130 });
  SC.fafeng = act('fafeng', 600, 1.955, { dur: 6.4, cam: [700, SH / 2, 1.955], say: true });

  SC.feed = {
    dur: 9.0, setup() { calm(); onFloor(1060); pet.face = 1; camSet(1100, 700, 2.35); S.mouse = { ...S.mouse, x: 1250, y: 560, visible: true }; },
    ev: [
      at(0.3, () => move(FILES[0].x, FILES[0].y - 4, 0.8)),
      at(1.25, () => { S.mouse.down = true; S.drag = { name: FILES[0].name, ext: FILES[0].ext }; }),
      at(1.4, () => move(1085, 846, 1.3)),
      at(2.95, () => { S.mouse.down = false; const d = S.drag; S.drag = null; pet.feed([d.name], S.mouse.x, S.mouse.y); }),
      at(3.3, () => move(1290, 700, 0.9)),
    ],
  };
  SC.pat = {
    dur: 5.0, setup() { calm(); pet.timers.pat = 0; onFloor(760); camSet(760, 780, 3.6); S.mouse = { ...S.mouse, x: 920, y: 640, visible: true }; },
    ev: [at(0.2, () => move(768, FLOOR - 62, 0.7)), at(2.6, () => move(766, FLOOR - 66, 0.3))],
  };
  SC.ball = {
    dur: 8.0, setup() { calm(); onFloor(560); pet.face = 1; camSet(700, 700, 2.15); S.mouse = { ...S.mouse, x: 930, y: 560, visible: true }; },
    ev: [at(0.3, () => pet.play('throw')),
      at(0.78, () => { if (pet.ball) { pet.ball.vx = 330; pet.ball.vy = -760; } }),
      at(2.7, () => { const b = pet.ball; if (b) move(b.x + 2, b.y - 1, 0.9); }),
      at(3.75, () => { const b = pet.ball; if (b) { S.mouse.x = b.x + 2; S.mouse.y = b.y - 1; S.mTw = null; S.mouse.down = true; pet.pointerDown(b.x, b.y); } }), at(3.85, () => { S.mouse.down = false; }),
      at(5.0, () => move(760, 560, 1.0))],
  };
  SC.fling = {
    dur: 5.0, setup() { calm(); onFloor(620); camSet(700, SH / 2, 1.955); follow(1.955, 0, 0, 0.1); S.mouse = { ...S.mouse, x: 760, y: 700, visible: true }; },
    ev: [at(0.2, () => move(622, FLOOR - 50, 0.6)), at(0.9, () => down()),
      at(1.0, () => move(520, 520, 0.55, E.io)), at(1.6, () => move(900, 330, 0.16, E.in)), at(1.76, () => up()),
      at(2.2, () => move(1000, 600, 1.2))],
  };
  SC.quit = {
    dur: 10.5, setup() {
      calm(); onFloor(1150); pet.face = -1; camSet(1250, 420, 2.4); S.mouse = { ...S.mouse, x: 1180, y: 300, visible: true };
    },
    ev: [
      at(0.2, () => move(STATUS_X, 14, 0.7)),
      at(1.0, () => { S.menuOpen = true; sfx.play('tick'); }),
      at(1.3, () => move(STATUS_X + 40, MENU + 8 + menuItemY(MENU_ITEMS.indexOf('让它走…')), 0.8)),
      at(2.35, () => { S.menuOpen = false; pet.command('leave'); camTo(1150, 700, 2.15, 0.8); }),
      at(2.9, () => { const b = pet.ask.yes; move(b.x, b.y, 0.55); }),
      at(3.9, () => { const b = pet.ask.yes; move(b.x + 4, b.y + 2, 0.5); }),
      at(4.9, () => { const b = pet.ask.yes; move(b.x - 2, b.y, 0.45); }),
      at(5.55, () => down()), at(5.65, () => { S.mouse.down = false; }),
      at(6.2, () => move(1300, 560, 1.4)),
      at(7.2, () => follow(2.4, -90, 0, 0.06)),
    ],
  };
  SC.xiaban = {
    dur: 7.0, setup() { calm(); onFloor(1150); pet.face = -1; S.clock = '9月26日 周五 17:59'; camSet(SW - 150, 200, 3.4); pet.offWork = 0; },
    ev: [at(1.0, () => { S.clock = '9月26日 周五 18:00'; S.clockFlash = 1; sfx.play('ding'); }),
      at(1.7, () => camTo(1150, 760, 3.0, 0.7, E.io)),
      at(2.4, () => pet.play('xiaban', { stay: 999 })),
      at(4.3, () => follow(3.0, -70, 0, 0.08))],
  };
  // end card: world == output pixels here (1080x1920), the pet is big and centered
  SC.outro = {
    dur: 7.0, setup() { calm(); S.bg = 'card'; pet.size = 3.4; pet.setWorld({ W: OW, H: OH, floorY: 1290, ceilY: 0 }); pet.setWindows([]); onFloor(OW / 2); camSet(OW / 2, OH / 2, 1); pet.noSay = true; pet.cards = []; },
    ev: [at(0.25, () => pet.play('xianyan', { noCard: true })), at(4.9, () => pet.play('petted'))],
  };

  // ---------------------------------------------------------------- menu bar / status menu
  const STATUS_X = SW - 262;
  const MENU_ITEMS = ['精神状态：遥遥领先', '-', '召唤到鼠标旁边', '摸摸它', '喂它（把文件拖到它身上）', '扔个球给你捡', '让它表演', '-', '换个颜色', '大小', '让它闭嘴三十分钟', '静音', '-', '关于坨坨', '让它走…', '立即退出（没有剧情）'];
  function menuItemY(i) { let y = 6; for (let k = 0; k < i; k++) y += MENU_ITEMS[k] === '-' ? 10 : 22; return y + 11; }

  // ---------------------------------------------------------------- drawing
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wallpaper() {
    const g = ctx.createLinearGradient(0, 0, 0, SH); g.addColorStop(0, '#22406a'); g.addColorStop(0.45, '#3d8b9e'); g.addColorStop(1, '#f3c496');
    ctx.fillStyle = g; ctx.fillRect(-50, -50, SW + 100, SH + 100);
    const waves = [['rgba(255,190,140,.35)', 520, 60, 0.004, 0.5], ['rgba(236,146,112,.55)', 640, 46, 0.0055, 2.1], ['rgba(245,187,130,.75)', 760, 38, 0.0048, 4.0], ['rgba(255,221,170,.85)', 870, 26, 0.006, 1.2]];
    for (const [c, y0, a, f, ph] of waves) {
      ctx.beginPath(); ctx.moveTo(-50, SH + 50);
      for (let x = -50; x <= SW + 50; x += 16) ctx.lineTo(x, y0 + a * Math.sin(x * f + ph) + a * 0.45 * Math.sin(x * f * 2.3 + ph * 1.7));
      ctx.lineTo(SW + 50, SH + 50); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
    }
  }
  function traffic(x, y) { [['#ff5f57', '#e0443e'], ['#febc2e', '#dea123'], ['#28c840', '#1aab29']].forEach(([f, s], i) => { ctx.beginPath(); ctx.arc(x + i * 20, y, 6, 0, 7); ctx.fillStyle = f; ctx.fill(); ctx.strokeStyle = s; ctx.lineWidth = 0.8; ctx.stroke(); }); }
  function windowFrame(w, z) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 36 * z; ctx.shadowOffsetY = 12 * z;
    rr(w.x, w.y, w.w, w.h, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    ctx.save(); rr(w.x, w.y, w.w, w.h, 12); ctx.clip();
    ctx.fillStyle = '#f3f2f7'; ctx.fillRect(w.x, w.y, w.w, 36); ctx.fillStyle = '#dcdbe2'; ctx.fillRect(w.x, w.y + 36, w.w, 1);
    traffic(w.x + 20, w.y + 18);
    ctx.fillStyle = '#4a4a55'; ctx.font = `600 13px ${SYS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(w.title, w.x + w.w / 2, w.y + 18);
    if (w.kind === 'doc') docBody(w); else finderBody(w);
    ctx.restore();
    rr(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1, 12); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.stroke();
  }
  function docBody(w) {
    ctx.fillStyle = '#e9e9ee'; ctx.fillRect(w.x, w.y + 37, w.w, w.h - 37);
    const px = w.x + 70, py = w.y + 62, pw = w.w - 140;
    ctx.fillStyle = '#fff'; ctx.fillRect(px, py, pw, w.h); ctx.strokeStyle = '#d6d6de'; ctx.strokeRect(px, py, pw, w.h);
    ctx.fillStyle = '#1f1f28'; ctx.font = `700 20px "Songti SC", "STSong", serif`; ctx.textAlign = 'center'; ctx.fillText('第一章  绪论', px + pw / 2, py + 52);
    ctx.textAlign = 'left'; ctx.font = `14px "Songti SC", "STSong", serif`; ctx.fillStyle = '#2b2b33';
    const para = ['近年来，随着人工智能技术的快速发展，桌面宠物作为一种', '人机交互形式重新引起了关注。本文旨在探讨一坨果冻在', '缓解打工人精神内耗方面的潜在作用。', '', '1.1  研究背景', '截至目前，学界对“抽象”一词尚无统一定义。部分学者认为', '抽象即字面化，另一部分学者认为抽象即发疯，还有一部分', '学者已读不回。', '', '1.2  研究意义', '本研究没有意义，但很抽象。'];
    para.forEach((s, i) => ctx.fillText(s, px + 36, py + 100 + i * 30));
    ctx.fillStyle = '#e8e8ee'; for (let i = 0; i < 6; i++) ctx.fillRect(px + 36, py + 440 + i * 26, pw - 72 - (i % 3) * 40, 9);
  }
  function finderBody(w) {
    ctx.fillStyle = '#f0eff5'; ctx.fillRect(w.x, w.y + 37, 150, w.h - 37);
    ctx.fillStyle = '#8b8b96'; ctx.font = `600 11px ${SYS}`; ctx.textAlign = 'left'; ctx.fillText('个人收藏', w.x + 16, w.y + 60);
    ['最近使用', '下载', '文稿', '桌面', '应用程序'].forEach((s, i) => {
      if (i === 1) { rr(w.x + 8, w.y + 72 + i * 28, 134, 24, 6); ctx.fillStyle = '#dcdae4'; ctx.fill(); }
      ctx.fillStyle = '#2d2d38'; ctx.font = `13px ${SYS}`; ctx.fillText(s, w.x + 22, w.y + 85 + i * 28);
    });
    FILES.forEach(F => {
      if (S.drag && S.drag.name === F.name) ctx.globalAlpha = 0.45;
      U.fileIcon(ctx, F.x, F.y, 1.15, F.ext);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2d2d38'; ctx.font = `11px ${SYS}`; ctx.textAlign = 'center';
      const nm = F.name.length > 12 ? [F.name.slice(0, 11), F.name.slice(11, 21) + (F.name.length > 21 ? '…' : '')] : [F.name];
      nm.forEach((s, i) => ctx.fillText(s, F.x, F.y + 44 + i * 14));
    });
  }
  function dockIcon(x, y, s, k) {
    ctx.save(); rr(x, y, s, s, s * 0.23);
    const g = (a, b) => { const gr = ctx.createLinearGradient(0, y, 0, y + s); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
    const cx = x + s / 2, cy = y + s / 2;
    switch (k) {
      case 'folder': ctx.fillStyle = g('#6ec3ff', '#2f8de4'); ctx.fill(); ctx.fillStyle = '#fff'; rr(x + s * 0.2, y + s * 0.32, s * 0.6, s * 0.42, 4); ctx.fill(); ctx.fillStyle = '#9fd6ff'; rr(x + s * 0.2, y + s * 0.26, s * 0.26, s * 0.12, 3); ctx.fill(); break;
      case 'globe': ctx.fillStyle = g('#ffffff', '#e8eef6'); ctx.fill(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.32, 0, 7); ctx.fillStyle = '#3aa0f0'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.14, s * 0.32, 0, 0, 7); ctx.moveTo(cx - s * 0.32, cy); ctx.lineTo(cx + s * 0.32, cy); ctx.stroke(); break;
      case 'note': ctx.fillStyle = g('#fff6c9', '#ffe27a'); ctx.fill(); ctx.strokeStyle = '#d8b24a'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + s * 0.22, y + s * (0.4 + i * 0.16)); ctx.lineTo(x + s * 0.78, y + s * (0.4 + i * 0.16)); ctx.stroke(); } ctx.fillStyle = '#f5c518'; ctx.fillRect(x, y, s, s * 0.2); break;
      case 'cal': ctx.fillStyle = '#fff'; ctx.fill(); ctx.fillStyle = '#ff3b30'; ctx.font = `600 ${s * 0.18}px ${SYS}`; ctx.textAlign = 'center'; ctx.fillText('周五', cx, y + s * 0.26); ctx.fillStyle = '#222'; ctx.font = `300 ${s * 0.46}px ${SYS}`; ctx.fillText('26', cx, y + s * 0.68); break;
      case 'music': ctx.fillStyle = g('#ff7a93', '#ff2d55'); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `700 ${s * 0.55}px ${SYS}`; ctx.textAlign = 'center'; ctx.fillText('♪', cx, cy + 2); break;
      case 'term': ctx.fillStyle = g('#3a3a42', '#16161b'); ctx.fill(); ctx.fillStyle = '#e6e6e6'; ctx.font = `700 ${s * 0.28}px Menlo, monospace`; ctx.textAlign = 'left'; ctx.fillText('>_', x + s * 0.16, y + s * 0.34); break;
      case 'tuo': ctx.clip(); ctx.fillStyle = g('#fff1b8', '#ffc46b'); ctx.fillRect(x, y, s, s);
        { const p2 = new TuoPet({ seed: 5, skin: 1, sfx: Object.assign(new TuoSfx(), { log: [] }) }); p2.size = s / 34 * 0.3; p2.t = 0.37; const r2 = p2.baseRS(); Object.assign(r2, { x: cx, y: y + s * 0.8, look: { x: 0.1, y: 0.2 }, blink: 0, wob: 0, lw: s * 0.045 }); p2.drawBody(ctx, r2); } break;
      case 'trash': ctx.fillStyle = g('#f4f4f6', '#d9d9df'); ctx.fill(); ctx.fillStyle = '#9a9aa6'; rr(x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.5, 4); ctx.fill(); ctx.fillRect(x + s * 0.24, y + s * 0.22, s * 0.52, s * 0.07); break;
    }
    ctx.restore();
  }
  function dock() {
    const icons = ['folder', 'globe', 'note', 'cal', 'music', 'term', 'tuo', '|', 'trash'], s = 52, gap = 10;
    const w = icons.reduce((a, k) => a + (k === '|' ? 14 : s + gap), gap), x0 = SW / 2 - w / 2, y0 = SH - s - 20;
    ctx.save(); rr(x0, y0 - 8, w, s + 16, 20); ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    let x = x0 + gap;
    for (const k of icons) {
      if (k === '|') { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + 1, y0 + 6, 1.5, s - 12); x += 14; continue; }
      dockIcon(x, y0, s, k);
      if (k === 'tuo' || k === 'folder') { ctx.fillStyle = 'rgba(30,30,40,.7)'; ctx.beginPath(); ctx.arc(x + s / 2, y0 + s + 5, 2, 0, 7); ctx.fill(); }
      x += s + gap;
    }
  }
  function menubar() {
    ctx.fillStyle = 'rgba(245,240,235,.72)'; ctx.fillRect(0, 0, SW, MENU);
    ctx.fillStyle = '#1d1d22'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `700 13px ${SYS}`; ctx.fillText('访达', 22, MENU / 2);
    ctx.font = `13px ${SYS}`; let x = 70; for (const s of ['文件', '编辑', '显示', '前往', '窗口', '帮助']) { ctx.fillText(s, x, MENU / 2); x += ctx.measureText(s).width + 20; }
    // right side: pet status icon, wifi, battery, clock
    ctx.save(); ctx.translate(STATUS_X, MENU / 2);
    if (S.menuOpen) { rr(-13, -11, 26, 22, 5); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fill(); }
    ctx.strokeStyle = '#1d1d22'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-7, 4); ctx.bezierCurveTo(-8, -7, 8, -7, 7, 4); ctx.bezierCurveTo(6.5, 7.5, -6.5, 7.5, -7, 4); ctx.stroke();
    ctx.fillStyle = '#1d1d22'; ctx.beginPath(); ctx.arc(-2.6, 0.5, 2.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(3.2, -0.5, 1.2, 0, 7); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(STATUS_X + 36, MENU / 2 + 4); ctx.strokeStyle = '#1d1d22'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
    for (const r of [4, 8, 12]) { ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke(); } ctx.restore();
    ctx.save(); ctx.translate(STATUS_X + 62, MENU / 2 - 6); rr(0, 0, 24, 12, 3.5); ctx.strokeStyle = '#1d1d22'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.fillStyle = '#1d1d22'; rr(2, 2, 16, 8, 2); ctx.fill(); ctx.fillRect(25, 4, 2, 4); ctx.restore();
    ctx.font = `13px ${SYS}`; ctx.fillStyle = '#1d1d22'; ctx.textAlign = 'right';
    if (S.clockFlash > 0) { const w = ctx.measureText(S.clock).width; rr(SW - 16 - w - 6, 4, w + 12, 20, 5); ctx.fillStyle = `rgba(255,214,79,${S.clockFlash})`; ctx.fill(); ctx.fillStyle = '#1d1d22'; }
    ctx.fillText(S.clock, SW - 16, MENU / 2);
  }
  function statusMenu() {
    if (!S.menuOpen) return;
    const x = STATUS_X - 14, y = MENU + 4, w = 236, h = menuItemY(MENU_ITEMS.length) + 2;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 24 * S.cam.z; ctx.shadowOffsetY = 6 * S.cam.z; rr(x, y, w, h, 10); ctx.fillStyle = 'rgba(246,244,248,.97)'; ctx.fill(); ctx.restore();
    rr(x, y, w, h, 10); ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.stroke();
    let yy = y + 6;
    MENU_ITEMS.forEach((s, i) => {
      if (s === '-') { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + 12, yy + 4.5, w - 24, 1); yy += 10; return; }
      const hov = S.mouse.x > x && S.mouse.x < x + w && S.mouse.y > yy && S.mouse.y < yy + 22 && i > 0;
      if (hov) { rr(x + 5, yy, w - 10, 22, 5); ctx.fillStyle = '#3478f6'; ctx.fill(); }
      ctx.fillStyle = i === 0 ? '#8c8c96' : hov ? '#fff' : '#1d1d22'; ctx.font = `13px ${SYS}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x + 20, yy + 11);
      if (s === '让它表演' || s === '大小') { ctx.textAlign = 'right'; ctx.fillText('›', x + w - 14, yy + 11); }
      yy += 22;
    });
  }
  function cursor() {
    const m = S.mouse; if (!m.visible) return;
    if (S.drag) { ctx.save(); ctx.globalAlpha = 0.85; U.fileIcon(ctx, m.x + 6, m.y + 30, 1.05, S.drag.ext, 0); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(m.x + 26, m.y + 52, 8, 0, 7); ctx.fillStyle = '#28c840'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(m.x + 22, m.y + 51, 8, 2); ctx.fillRect(m.x + 25, m.y + 48, 2, 8); ctx.restore(); }
    ctx.save(); ctx.translate(m.x, m.y); const k = m.down ? 0.9 : 1; ctx.scale(k * 1.15, k * 1.15);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.2, 13.2); ctx.lineTo(7.2, 20); ctx.lineTo(10, 18.8); ctx.lineTo(7.1, 12.2); ctx.lineTo(12.6, 12.2); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = '#111'; ctx.fill();
    ctx.restore();
  }
  function catDoodle(c) {
    const x = c.x, y = c.y, t = S.t, lw = 3.2;
    ctx.save();
    // tail
    ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 26, y - 14); ctx.quadraticCurveTo(x + 62, y - 20 + Math.sin(t * 5) * 6, x + 58, y - 58 + Math.sin(t * 5) * 10); ctx.stroke();
    ctx.strokeStyle = '#ffb35c'; ctx.lineWidth = 6; ctx.stroke();
    // body + head
    ctx.beginPath(); ctx.ellipse(x, y - 30, 34, 31, 0, 0, 7); ctx.fillStyle = '#ffb35c'; ctx.fill(); U.inkLine(ctx, lw); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 30, y - 88); ctx.lineTo(x - 24, y - 122); ctx.lineTo(x - 6, y - 100); ctx.moveTo(x + 30, y - 88); ctx.lineTo(x + 24, y - 122); ctx.lineTo(x + 6, y - 100); ctx.fillStyle = '#ffb35c'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - 78, 36, 30, 0, 0, 7); ctx.fillStyle = '#ffb35c'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8892e'; for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.ellipse(x + k * 9, y - 102, 3, 7, k * 0.3, 0, 7); ctx.fill(); }
    const bl = (Math.floor(t * 10) % 25) === 0 ? 0.15 : 1;
    for (const k of [-1, 1]) { ctx.save(); ctx.translate(x + k * 14, y - 80); ctx.scale(1, bl); ctx.beginPath(); ctx.ellipse(0, 0, 7, 9, 0, 0, 7); ctx.fillStyle = INK; ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-2, -3, 2.6, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#ff8fa3'; ctx.beginPath(); ctx.moveTo(x - 4, y - 68); ctx.lineTo(x + 4, y - 68); ctx.lineTo(x, y - 63); ctx.closePath(); ctx.fill();
    U.inkLine(ctx, 2.2); ctx.beginPath(); ctx.arc(x - 4, y - 62, 4, 0.1 * Math.PI, 0.9 * Math.PI); ctx.arc(x + 4, y - 62, 4, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.lineWidth = 1.6; for (const k of [-1, 1]) for (const d of [-4, 3]) { ctx.beginPath(); ctx.moveTo(x + k * 20, y - 66 + d); ctx.lineTo(x + k * 44, y - 68 + d * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,120,150,.5)'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + k * 24, y - 70, 6, 4, 0, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function cardBg() {
    const g = ctx.createLinearGradient(0, 0, 0, OH); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffc46b'); ctx.fillStyle = g; ctx.fillRect(0, 0, OW, OH);
    ctx.fillStyle = 'rgba(160,110,40,.13)'; for (let y = 20; y < OH; y += 44) for (let x = 20; x < OW; x += 44) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(160,90,20,.16)'; ctx.beginPath(); ctx.ellipse(OW / 2, 1296, 300, 34, 0, 0, 7); ctx.fill();
  }
  function cardText() {
    const k = E.back(clamp(S.t / 0.5, 0, 1)), k2 = E.back(clamp((S.t - 0.5) / 0.5, 0, 1)), k3 = E.back(clamp((S.t - 1.1) / 0.5, 0, 1));
    ctx.save(); ctx.translate(OW / 2, 470); ctx.rotate(-0.04); ctx.scale(k, k); U.label(ctx, '坨坨', 0, 0, 230, '#8a6bff'); ctx.restore();
    ctx.save(); ctx.translate(OW / 2, 650); ctx.scale(k2, k2); U.label(ctx, '一只把网络热词当真的抽象桌宠', 0, 0, 56, '#fff'); ctx.restore();
    ctx.save(); ctx.translate(OW / 2, 1470); ctx.scale(k3, k3);
    U.wobblyRect(ctx, -300, -62, 600, 124, 40, Math.floor(S.t * 8), 1.5); ctx.fillStyle = '#231f30'; ctx.fill();
    U.label(ctx, 'Mac 版 · 免费下载', 0, 4, 62, '#ffe25a', { white: false, ink: false }); ctx.restore();
  }

  function render() {
    const c = S.cam, z = c.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, OW, OH);
    const sh = S.shake > 0 ? (Math.random() - 0.5) * S.shake : 0;
    ctx.setTransform(z, 0, 0, z, OW / 2 - c.x * z + sh, OH / 2 - c.y * z);
    if (S.bg === 'card') cardBg();
    else {
      wallpaper();
      for (const k of [...S.wins].reverse()) windowFrame(WINS[k], z);
      dock();
    }
    if (S.cat) catDoodle(S.cat);
    pet.draw(ctx);
    if (S.bg !== 'card') { menubar(); statusMenu(); } else cardText();
    cursor();
    if (S.fade > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(0,0,0,${S.fade})`; ctx.fillRect(0, 0, OW, OH); }
  }

  // ---------------------------------------------------------------- stepping
  function clampCam() {
    const c = S.cam, hw = OW / 2 / c.z, hh = OH / 2 / c.z;
    if (S.bg === 'card') { c.x = OW / 2; c.y = OH / 2; c.z = 1; return; }
    c.x = SW > hw * 2 ? clamp(c.x, hw, SW - hw) : SW / 2; c.y = SH > hh * 2 ? clamp(c.y, hh, SH - hh) : SH / 2;
  }
  let scene, evI = 0;
  function start(name) {
    scene = SC[name]; if (!scene) throw new Error('no scene ' + name);
    S.t = 0; evI = 0; scene.setup(); clampCam();
    scene.ev.sort((a, b) => a[0] - b[0]);
  }
  function step(dt) {
    S.t += dt;
    while (evI < scene.ev.length && scene.ev[evI][0] <= S.t + 1e-6) scene.ev[evI++][1]();
    if (S.mTw) { const m = S.mTw, u = m.ease(clamp((S.t - m.t0) / m.dur, 0, 1)); S.mouse.x = lerp(m.fx, m.tx, u); S.mouse.y = lerp(m.fy, m.ty, u); if (u >= 1) S.mTw = null; }
    if (S.mouse.visible) pet.setMouse(S.mouse.x, S.mouse.y);
    if (S.drag) { const b = pet.bb, near = b && S.mouse.x > b[0] - 50 && S.mouse.x < b[0] + b[2] + 50 && S.mouse.y > b[1] - 80 && S.mouse.y < b[1] + b[3] + 30; if (near !== pet.fileHov) pet.feedHover(near, S.mouse.x, S.mouse.y); }
    pet.update(dt);
    if (S.deadpan && !pet.act) { pet.blinkAmt = 0; }
    if (S.cat) S.cat.t += dt;
    if (S.clockFlash > 0) S.clockFlash = Math.max(0, S.clockFlash - dt * 0.8);
    if (S.camTw) { const m = S.camTw, u = m.ease(clamp((S.t - m.t0) / m.dur, 0, 1)); S.cam = { x: lerp(m.from.x, m.to.x, u), y: lerp(m.from.y, m.to.y, u), z: lerp(m.from.z, m.to.z, u) }; if (u >= 1) S.camTw = null; }
    if (S.follow) { const f = S.follow; S.cam.z = lerp(S.cam.z, f.z, 0.1); S.cam.x = lerp(S.cam.x, pet.x + f.dx, f.k); S.cam.y = lerp(S.cam.y, pet.y + f.dy, f.k); }
    clampCam();
  }
  // deadpan face for the swap gag: tiny dot eyes, flat mouth
  const baseRS = pet.baseRS.bind(pet);
  pet.baseRS = function () { const r = baseRS(); if (S.deadpan && !this.act) { r.eyes = 'dot'; r.mouth = 'flat'; } return r; };

  // ---------------------------------------------------------------- modes
  function wav(buf) {
    const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true); o += 2; }
    return new Blob([out], { type: 'audio/wav' });
  }
  async function record(name, tag, frames) {
    start(name);
    const dt = 1 / 60;
    for (let i = 0; i < frames; i++) {
      step(dt); render();
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      await fetch(`/frame?tag=${tag}&i=${i}&fps=60`, { method: 'POST', body: blob });
    }
    const buf = await TuoSfx.render(sfx.log, frames / 60 + 0.6);
    await fetch(`/audio?tag=${tag}`, { method: 'POST', body: wav(buf) });
    await fetch(`/done?tag=${tag}`, { method: 'POST', body: JSON.stringify({ scene: name, frames, events: sfx.log }) });
    document.title = 'done';
  }
  async function sheet(name, times, save) {
    start(name);
    const tw = 270, th = 480, cols = Math.min(6, times.length), rows = Math.ceil(times.length / cols);
    const out = document.createElement('canvas'); out.width = cols * tw; out.height = rows * (th + 18); const o = out.getContext('2d');
    o.fillStyle = '#111'; o.fillRect(0, 0, out.width, out.height);
    let k = 0, t = 0;
    while (k < times.length) {
      step(1 / 60); t += 1 / 60; render();
      if (t + 1e-6 >= times[k]) { o.drawImage(cv, (k % cols) * tw, Math.floor(k / cols) * (th + 18), tw, th); o.fillStyle = '#fff'; o.font = '12px sans-serif'; o.fillText(`${name} ${times[k]}s`, (k % cols) * tw + 4, Math.floor(k / cols) * (th + 18) + th + 13); k++; }
    }
    out.toBlob(b => fetch('/png?name=' + save, { method: 'POST', body: b }), 'image/png');
    document.title = 'done';
  }
  window.STAGE = { S, SC, pet, start, step, render };
  (async () => {
    await document.fonts.load('17px ZK'); await document.fonts.load('600 13px -apple-system');
    if (q.get('rec')) record(q.get('rec'), q.get('tag') || q.get('rec'), +(q.get('frames') || Math.round(SC[q.get('rec')].dur * 60)));
    else if (q.get('sheet')) sheet(q.get('sheet'), (q.get('t') || '0.5,1,2,3').split(',').map(Number), q.get('save') || 'stage_' + q.get('sheet'));
    else {
      start(q.get('play') || 'hook'); let last = performance.now();
      const loop = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); render(); if (S.t < scene.dur + 1) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  })();
})();
