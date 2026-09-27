"""Clone a designed voice for every VO line with Qwen3-TTS Base (mlx), 3 takes, pick by Whisper accuracy (tie -> shorter).
usage: python lines_tts.py VOICE [keys...] -> ../vo/qwen_<VOICE>/<key>.wav + choice.json"""
import sys, os, json, difflib
import numpy as np, soundfile as sf, mlx_whisper
R = '/Users/a1-6/Movies/TUOTUO/video'
sys.path.insert(0, f'{R}/vo')
from lines import LINES, SAY
from mlx_audio.tts.utils import load_model
VOICE = sys.argv[1]; KEYS = sys.argv[2:] or list(LINES)
OUT = f'{R}/vo/qwen_{VOICE}'; os.makedirs(OUT + '/takes', exist_ok=True)
REF = f'/Users/a1-6/Movies/AIGAME1/tts/voices/{VOICE}.wav'; REF_TXT = open(f'/Users/a1-6/Movies/AIGAME1/tts/voices/{VOICE}.txt').read()
m = load_model('mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16')
norm = lambda s: ''.join(ch for ch in s.lower() if ch.isalnum())
choice = json.load(open(f'{OUT}/choice.json')) if os.path.exists(f'{OUT}/choice.json') else {}
for k in KEYS:
    text = SAY.get(k, LINES[k][0]); want = norm(LINES[k][0])
    best = None
    for take in range(3):
        res = list(m.generate(text=text, ref_audio=REF, ref_text=REF_TXT, language='Chinese'))
        a = np.concatenate([np.array(r.audio) for r in res]); sr = res[0].sample_rate
        env = np.abs(a) > 0.01; idx = np.where(env)[0]
        a = a[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.12 * sr)] if len(idx) else a
        p = f'{OUT}/takes/{k}_{take}.wav'; sf.write(p, a, sr)
        asr = mlx_whisper.transcribe(p, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='zh', initial_prompt='以下是普通话的句子。')['text']
        got = norm(asr).replace('麦克', 'mac').replace('芭比q', '芭比q')
        acc = difflib.SequenceMatcher(None, want, got).ratio(); dur = len(a) / sr
        score = acc - 0.01 * dur
        print(k, take, f'acc {acc:.2f} dur {dur:.2f}', asr, flush=True)
        if best is None or score > best[0]: best = (score, p, dur, acc)
    choice[k] = dict(file=best[1], dur=round(best[2], 3), acc=round(best[3], 3))
    json.dump(choice, open(f'{OUT}/choice.json', 'w'), ensure_ascii=False, indent=1)
print('DONE', json.dumps(choice, ensure_ascii=False))
