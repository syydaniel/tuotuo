"""Edit plan for the 坨坨 promo (60 fps, 1080x1920) and every asset the Resolve build needs.
VER=v1 python3 edl.py   -> work/plan.json, captions/<VER>/, stems/<VER>/, renders/preview_mix_<VER>.wav
Cuts sit on the music's 120 BPM grid; the montage fills 8 bars, the clam bursts inside the track's first stop (22.35 s)."""
import json, os, subprocess, difflib, re, sys
import numpy as np, soundfile as sf
from PIL import Image, ImageDraw, ImageFont
from concurrent.futures import ThreadPoolExecutor

ROOT = '/Users/a1-6/Movies/TUOTUO/video'
FPS = 60
BGM = f'{ROOT}/music/out1/1cd8f7ab-e93d-c316-874f-a5378b580381.wav'
VER = os.environ.get('VER', 'v1')
CAPD, STEMD = f'{ROOT}/captions/{VER}', f'{ROOT}/stems/{VER}'
for d_ in (f'{CAPD}/png', f'{CAPD}/mov', STEMD, f'{ROOT}/work', f'{ROOT}/renders'): os.makedirs(d_, exist_ok=True)

# name, clip, src_in, src_out   (timeline position = running sum)
SEG = [
    ('hook', 'hook', 0.00, 3.60),
    ('swap', 'swap', 0.20, 5.60),
    ('intro', 'intro', 0.20, 3.15),
    ('moyu', 'moyu', 0.30, 2.30),
    ('tangping', 'tangping', 0.30, 2.30),
    ('neijuan', 'neijuan', 0.45, 2.45),
    ('shangtou', 'shangtou', 0.35, 2.35),
    ('liekai', 'liekai', 0.30, 2.30),
    ('bengbu', 'bengbu', 2.25, 4.25),
    ('babiq', 'babiq', 0.30, 2.30),
    ('geju', 'geju', 0.60, 2.60),
    ('feed', 'feed_v2', 1.10, 7.00),
    ('pat', 'pat', 1.20, 5.00),
    ('ball', 'ball', 0.20, 6.20),
    ('quit', 'quit', 0.60, 7.60),
    ('xiaban', 'xiaban', 0.55, 5.50),
    ('outro', 'outro', 0.00, 4.40),
]
# VO key -> (segment, seconds after the segment starts)
VO_AT = {'hook1': ('hook', 0.10), 'hook2': ('swap', 0.27), 'intro': ('intro', 0.05),
         'w_moyu': ('moyu', 0.10), 'w_tangping': ('tangping', 0.10), 'w_neijuan': ('neijuan', 0.10), 'w_shangtou': ('shangtou', 0.10),
         'w_liekai': ('liekai', 0.10), 'w_bengbu': ('bengbu', 0.08), 'w_babiq': ('babiq', 0.10), 'w_geju': ('geju', 0.10),
         'feed': ('feed', 0.05), 'feed2': ('feed', 4.50), 'pat': ('pat', 0.05), 'ball': ('ball', 1.10), 'ball2': ('ball', 4.80),
         'quit': ('quit', 0.05), 'quit2': ('quit', 5.70), 'off': ('xiaban', 0.10), 'off2': ('xiaban', 3.65), 'cta': ('outro', 0.15)}
NO_CAPTION = {k for k in VO_AT if k.startswith('w_')}      # the pet's own word card already says it
CAP_Y = {'cta': 830}
BIG = {'hook1': 96, 'hook2': 84}
PILL = '我用**AI**做了个抽象桌宠 《**坨坨**》'
PILL_SEGS = [s[0] for s in SEG if s[0] != 'outro']

segs, t = [], 0.0
for name, clip, a, b in SEG:
    n = round((b - a) * FPS)
    segs.append(dict(name=name, clip=clip, src=a, at=round(t * FPS), n=n, path=f'{ROOT}/rec/{clip}.mp4'))
    t += n / FPS
END = round(t * FPS)
start_of = {s['name']: s['at'] / FPS for s in segs}

sys.path.insert(0, f'{ROOT}/vo')
from lines import LINES
TIM = json.load(open(f'{ROOT}/vo/timing.json'))
vo = []
for k, (seg, off) in VO_AT.items():
    at = start_of[seg] + off
    vo.append(dict(key=k, t=round(at, 3), frame=round(at * FPS), dur=TIM[k]['dur'], file=f'{STEMD}/vo_{k}.wav'))

# ---------------------------------------------------------------- captions
FONT = '/Users/a1-6/Movies/TUOTUO/web/zcool.ttf'
INK, YEL, WHITE, LAV = (35, 31, 48, 255), (255, 214, 64, 255), (255, 255, 255, 255), (186, 164, 255, 255)


def runs(s):
    return [(part, i % 2 == 1) for i, part in enumerate(s.split('**')) if part]


def render_caption(text, y, px, path):
    im = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0)); d = ImageDraw.Draw(im); rs = runs(text)
    while True:
        f = ImageFont.truetype(FONT, px); w = sum(d.textlength(s, font=f) for s, _ in rs)
        if w <= 960 or px < 40: break
        px -= 4
    sw = max(8, px // 7); x = 540 - w / 2
    for dy, fill_fn in ((10, lambda h: INK), (0, lambda h: YEL if h else WHITE)):
        xx = x
        for s, h in rs:
            d.text((xx, y + dy), s, font=f, fill=fill_fn(h), anchor='lm', stroke_width=sw, stroke_fill=INK); xx += d.textlength(s, font=f)
    im.save(path)


def alnum(s): return [ch.lower() for ch in s if ch.isalnum()]


caps = []
for v in vo:
    k = v['key']
    if k in NO_CAPTION: continue
    chars = TIM[k]['chars']; script = [c['c'].lower() for c in chars]; phrases = LINES[k][1].split('|')
    flat, owner = [], []
    for i, p in enumerate(phrases):
        a = alnum(p.replace('**', '')); flat += a; owner += [i] * len(a)
    sm = difflib.SequenceMatcher(None, flat, script, autojunk=False); first = {}
    for a0, b0, n in sm.get_matching_blocks():
        for j in range(n): first.setdefault(owner[a0 + j], chars[b0 + j]['t'])
    starts = [first.get(i) for i in range(len(phrases))]
    for i in range(len(starts)):
        if starts[i] is None: starts[i] = starts[i - 1] + 0.4 if i else 0.0
    for i, p in enumerate(phrases):
        t0 = v['t'] + max(0.0, starts[i] - 0.06)
        t1 = v['t'] + (starts[i + 1] - 0.03 if i + 1 < len(phrases) else v['dur'] + 0.35)
        y = CAP_Y.get(k, 640)
        path = f"{CAPD}/png/cap_{''.join('abcdefghij'[int(ch)] if ch.isdigit() else ch for ch in k)}_{'abcdefghijklmnop'[i]}.png"
        render_caption(p, y, BIG.get(k, 76), path)
        caps.append(dict(file=path, frame=round(t0 * FPS), length=max(6, round((t1 - t0) * FPS)), track=2, text=p))
caps.sort(key=lambda c: c['frame'])
for a, b in zip(caps, caps[1:]): a['length'] = min(a['length'], b['frame'] - a['frame'])

# ---------------------------------------------------------------- audio stems (levels baked in; Resolve faders stay at 0 dB)
SR = 48000


def load(p):
    a, sr = sf.read(p, always_2d=True)
    if sr != SR:
        tmp = f'{ROOT}/work/_rs.wav'; subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-ar', str(SR), tmp], check=True); a, _ = sf.read(tmp, always_2d=True)
    if a.shape[1] == 1: a = np.repeat(a, 2, 1)
    return a


def loudnorm(src, dst, target):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f'loudnorm=I={target}:TP=-1.5:LRA=11', '-ar', str(SR), '-ac', '2', dst], check=True)


for v in vo: loudnorm(TIM[v['key']]['file'], v['file'], -15)

sfx = []
for s in segs:
    src = load(f"{ROOT}/rec/{s['clip']}.wav")
    a = src[int(s['src'] * SR): int((s['src'] + s['n'] / FPS) * SR)].copy()
    if len(a) < s['n'] / FPS * SR: a = np.pad(a, ((0, int(s['n'] / FPS * SR) - len(a)), (0, 0)))
    fade = int(0.01 * SR); a[:fade] *= np.linspace(0, 1, fade)[:, None]; a[-fade:] *= np.linspace(1, 0, fade)[:, None]
    p = f"{STEMD}/sfx_{s['name']}.wav"; sf.write(p, a * 10 ** (-1 / 20), SR)
    sfx.append(dict(file=p, frame=s['at'], seg=s['name']))

N = int(END / FPS * SR) + SR
mask = np.zeros(N)
for v in vo:
    i0 = int((v['t'] - 0.1) * SR); i1 = int((v['t'] + v['dur'] + 0.1) * SR); mask[max(0, i0):i1] = 1
k = np.exp(-1 / (0.25 * SR)); env = np.zeros(N); x = 0.0
for i in range(N):
    m = mask[i]; x = m if m > x else x * k + m * (1 - k); env[i] = x
music = load(BGM)[:N]
if len(music) < N: music = np.pad(music, ((0, N - len(music)), (0, 0)))
tmpn = f'{ROOT}/work/_bgm_norm.wav'; sf.write(f'{ROOT}/work/_bgm.wav', music, SR); loudnorm(f'{ROOT}/work/_bgm.wav', tmpn, -18)
music = load(tmpn)[:N]
if len(music) < N: music = np.pad(music, ((0, N - len(music)), (0, 0)))
gain_db = -4.0 - 10.0 * env
tt = np.arange(N) / SR; endT = END / FPS
gain = 10 ** (gain_db / 20) * np.clip((endT - tt) / 0.8, 0, 1)
bgm = music * gain[:, None]
sf.write(f'{STEMD}/bgm_ducked.wav', bgm[:int(endT * SR)], SR)
mix = bgm.copy()
for v in vo:
    a = load(v['file']); i = int(v['t'] * SR); mix[i:i + len(a)] += a[:max(0, N - i)]
for s in sfx:
    a = load(s['file']); i = int(s['frame'] / FPS * SR); mix[i:i + len(a)] += a[:max(0, N - i)]
sf.write(f'{ROOT}/renders/preview_mix_{VER}.wav', np.clip(mix[:int(endT * SR)], -1, 1), SR)
lu = subprocess.run(['ffmpeg', '-hide_banner', '-i', f'{ROOT}/renders/preview_mix_{VER}.wav', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = re.findall(r'I:\s+(-?[\d.]+) LUFS', lu)[-1]; TP = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', lu)[-1]


# ---------------------------------------------------------------- persistent headline pill + AIGC label
def render_pill(text, path):
    im = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 48); rs = runs(text); w = sum(d.textlength(s_, font=f) for s_, _ in rs)
    x0, y0, h = 540 - w / 2 - 34, 250, 80
    d.rounded_rectangle((x0, y0 + 7, x0 + w + 68, y0 + h + 7), radius=40, fill=(0, 0, 0, 255))
    d.rounded_rectangle((x0, y0, x0 + w + 68, y0 + h), radius=40, fill=INK, outline=WHITE, width=4)
    xx = x0 + 34
    for s_, hot in rs:
        d.text((xx, y0 + h / 2 + 2), s_, font=f, fill=YEL if hot else WHITE, anchor='lm'); xx += d.textlength(s_, font=f)
    im.save(path)


pill_png = f'{CAPD}/png/pill_ai.png'; render_pill(PILL, pill_png)


def render_label(text, path):
    im = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 32); w = d.textlength(text, font=f)
    d.rounded_rectangle((540 - w / 2 - 22, 350, 540 + w / 2 + 22, 400), radius=25, fill=(23, 22, 31, 190))
    d.text((540, 376), text, font=f, fill=WHITE, anchor='mm'); im.save(path)


label_png = f'{CAPD}/png/label_aigc.png'; render_label('AI生成声明：本视频画面、配音、配乐由AI生成', label_png)
labels = [dict(file=label_png, frame=0, length=round(3.6 * FPS), track=4, text='AIGC', out=f'{CAPD}/mov/label_aigc.mov')]
spans = []
for s_ in segs:
    if s_['name'] not in PILL_SEGS: continue
    if spans and spans[-1][1] == s_['at']: spans[-1][1] = s_['at'] + s_['n']
    else: spans.append([s_['at'], s_['at'] + s_['n']])
pills = [dict(file=pill_png, frame=a, length=b - a, track=3, text=PILL, out=f"{CAPD}/mov/pill_{'abcdefgh'[i]}.mov") for i, (a, b) in enumerate(spans)]


def to_mov(m):  # Resolve imports stills as 1-frame clips, so each overlay becomes an alpha ProRes 4444 clip of its exact length
    out = m.get('out') or m['file'].replace('/png/', '/mov/').replace('.png', '.mov')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-i', m['file'], '-frames:v', str(m['length']),
                    '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', out], check=True)
    m['file'] = out


with ThreadPoolExecutor(8) as ex: list(ex.map(to_mov, caps + pills + labels))
plan = dict(fps=FPS, end=END, segs=segs, vo=vo, caps=caps, pills=pills, labels=labels, sfx=sfx, bgm=f'{STEMD}/bgm_ducked.wav', tl=f'坨坨 {VER}')
json.dump(plan, open(f'{ROOT}/work/plan.json', 'w'), ensure_ascii=False, indent=1)
print('END', END, 'frames =', round(END / FPS, 2), 's | segs', len(segs), '| vo', len(vo), '| captions', len(caps), '| preview mix', I, 'LUFS, peak', TP, 'dBFS')
for s in segs: print(f"  {s['name']:9s} src {s['src']:.2f}  at {s['at'] / FPS:6.2f}  len {s['n'] / FPS:.2f}")
