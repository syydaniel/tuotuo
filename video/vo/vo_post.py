"""Chosen takes -> voice chain -> vo/final/<key>.wav, plus per-character timing of the script text -> vo/timing.json
usage: python vo_post.py VOICE"""
import sys, os, json, subprocess, difflib
import mlx_whisper
R = '/Users/a1-6/Movies/TUOTUO/video/vo'
sys.path.insert(0, R)
from lines import LINES
VOICE = sys.argv[1]
OUT = f'{R}/final'; os.makedirs(OUT, exist_ok=True)
choice = json.load(open(f'{R}/qwen_{VOICE}/choice.json'))
SPOKEN = {}
timing = {}
for k, c in choice.items():
    out = f'{OUT}/{k}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', c['file'], '-af',
                    'highpass=f=80,equalizer=f=3000:t=q:w=1.2:g=2.5,equalizer=f=250:t=q:w=1:g=-1.5,'
                    'acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2,aresample=48000', '-ac', '2', out], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
    r = mlx_whisper.transcribe(out, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='zh', word_timestamps=True, initial_prompt='以下是普通话的句子。')
    asr = []
    for s in r['segments']:
        for w in s.get('words', []):
            chars = [ch for ch in w['word'].lower() if ch.isalnum()]
            for j, ch in enumerate(chars):
                t0 = w['start'] + (w['end'] - w['start']) * j / len(chars); t1 = w['start'] + (w['end'] - w['start']) * (j + 1) / len(chars)
                asr.append((ch, t0, t1))
    orig = [ch for ch in LINES[k][0] if ch.isalnum()]
    low = [ch.lower() for ch in orig]
    sm = difflib.SequenceMatcher(None, low, [a[0] for a in asr], autojunk=False)
    tt = [None] * len(orig)
    for a0, b0, n in sm.get_matching_blocks():
        for j in range(n): tt[a0 + j] = (asr[b0 + j][1], asr[b0 + j][2])
    known = [i for i, v in enumerate(tt) if v]
    for i in range(len(tt)):
        if tt[i] is None:
            lo = max([j for j in known if j < i], default=None); hi = min([j for j in known if j > i], default=None)
            if lo is not None and hi is not None:
                f = (i - lo) / (hi - lo); t0 = tt[lo][1] + (tt[hi][0] - tt[lo][1]) * f; tt[i] = (t0, t0 + 0.1)
            elif lo is not None: tt[i] = (tt[lo][1], tt[lo][1] + 0.1)
            elif hi is not None: tt[i] = (max(0, tt[hi][0] - 0.1), tt[hi][0])
            else: tt[i] = (0.0, 0.1)
    timing[k] = dict(chars=[dict(c=ch, t=round(a, 3), e=round(b, 3)) for ch, (a, b) in zip(orig, tt)], dur=round(dur, 3), file=out)
    print(k, round(dur, 2), r['text'].strip(), flush=True)
json.dump(timing, open(f'{R}/timing.json', 'w'), ensure_ascii=False, indent=1)
print('timing written')
