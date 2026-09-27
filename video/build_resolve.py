"""Assemble the 坨坨 promo cut in DaVinci Resolve through the Resolve MCP server (run edl.py first).
usage: python3 build_resolve.py setup timeline captions audio render status"""
import sys, os
sys.path.insert(0, '/Users/a1-6/Movies/UNTAMED2')
from mcp import Client

HEAD = r'''
import json
D = json.load(open('/Users/a1-6/Movies/TUOTUO/video/work/plan.json', encoding='utf-8'))
FPS = D['fps']
pm = resolve.GetProjectManager()
def P(): return pm.GetCurrentProject()
def TL():
    p = P()
    for i in range(1, p.GetTimelineCount() + 1):
        t = p.GetTimelineByIndex(i)
        if t.GetName() == D['tl']: return t
_MP = {}
def mpclip(path):
    if path in _MP: return _MP[path]
    stack = [P().GetMediaPool().GetRootFolder()]
    while stack:
        f = stack.pop()
        for c in f.GetClipList(): _MP[c.GetClipProperty('File Path')] = c
        stack += f.GetSubFolderList()
    return _MP.get(path)
def folder(name):
    mp = P().GetMediaPool(); root = mp.GetRootFolder()
    for f in root.GetSubFolderList():
        if f.GetName() == name: return f
    return mp.AddSubFolder(root, name)
def import_into(name, paths):
    mp = P().GetMediaPool(); f = folder(name); mp.SetCurrentFolder(f)
    have = set(c.GetClipProperty('File Path') for c in f.GetClipList())
    new = [x for x in paths if x not in have]
    if new: mp.ImportMedia(new)
    _MP.clear()
    return len(f.GetClipList())
def exact_append(tl, mp, path, src_f, n, trk, rec):
    """n timeline frames of path from source frame src_f, placed at timeline frame rec; retries until exact"""
    st = tl.GetStartFrame(); adj = 0
    for attempt in range(6):
        it = mp.AppendToTimeline([{'mediaPoolItem': mpclip(path), 'startFrame': src_f, 'endFrame': src_f + n - 1 + adj,
                                   'mediaType': 1, 'trackIndex': trk, 'recordFrame': st + rec}])[0]
        if it is None: return None
        d = it.GetDuration()
        if d == n and it.GetStart() - st == rec: return it
        tl.DeleteClips([it]); adj += n - d
    return it
'''

CHUNKS = {}
CHUNKS['setup'] = HEAD + r'''
names = pm.GetProjectListInCurrentFolder()
p = pm.LoadProject('TUOTUO') if 'TUOTUO' in names else pm.CreateProject('TUOTUO')
p = pm.GetCurrentProject()
for k, v in {'timelineFrameRate': '60', 'timelinePlaybackFrameRate': '60', 'timelineResolutionWidth': '1080', 'timelineResolutionHeight': '1920'}.items():
    p.SetSetting(k, v)
n1 = import_into('Scenes', sorted(set(s['path'] for s in D['segs'])))
n2 = import_into('Captions', sorted(set(c['file'] for c in D['caps'] + D.get('pills', []) + D.get('labels', []))))
n3 = import_into('Audio', sorted(set([D['bgm']] + [v['file'] for v in D['vo']] + [s['file'] for s in D['sfx']])))
pm.SaveProject()
result = {'scenes': n1, 'captions': n2, 'audio': n3, 'res': [p.GetSetting('timelineResolutionWidth'), p.GetSetting('timelineResolutionHeight'), p.GetSetting('timelineFrameRate')]}
'''

CHUNKS['timeline'] = HEAD + r'''
p = P(); mp = p.GetMediaPool()
old = TL()
if old: mp.DeleteTimelines([old])
tl = mp.CreateEmptyTimeline(D['tl']); p.SetCurrentTimeline(tl)
tl.AddTrack('video'); tl.AddTrack('video'); tl.SetTrackName('video', 1, 'SCENES'); tl.SetTrackName('video', 2, 'CAPTIONS'); tl.SetTrackName('video', 3, 'AI TITLE')
for _ in range(2): tl.AddTrack('audio', 'stereo')
for i, nm in enumerate(['VO', 'PET SFX', 'BGM'], 1): tl.SetTrackName('audio', i, nm)
bad = []
for s in D['segs']:
    it = exact_append(tl, mp, s['path'], round(s['src'] * FPS), s['n'], 1, s['at'])
    if it is None or it.GetDuration() != s['n']: bad.append((s['name'], it.GetDuration() if it else None, s['n']))
    elif it: it.SetProperties({'ZoomX': 1.0, 'ZoomY': 1.0, 'Pan': 0.0, 'Tilt': 0.0})
# the recorded clips carry no audio, but drop any linked audio just in case
for t in range(1, tl.GetTrackCount('audio') + 1):
    its = tl.GetItemListInTrack('audio', t)
    if its: tl.DeleteClips(its)
pm.SaveProject()
v1 = tl.GetItemListInTrack('video', 1)
result = {'v1': len(v1), 'bad': bad, 'end': tl.GetEndFrame() - tl.GetStartFrame(), 'want': D['end']}
'''

CHUNKS['recaptions'] = HEAD + r'''
p = P(); mp = p.GetMediaPool(); f = folder('Captions')
old = f.GetClipList()
tl = TL()
if tl:
    its = tl.GetItemListInTrack('video', 2)
    if its: tl.DeleteClips(its)
if old: mp.DeleteClips(old)
n = import_into('Captions', sorted(set(c['file'] for c in D['caps'] + D.get('pills', []) + D.get('labels', []))))
pm.SaveProject()
result = {'removed': len(old), 'captions': n}
'''

CHUNKS['captions'] = HEAD + r'''
p = P(); tl = TL(); p.SetCurrentTimeline(tl); mp = p.GetMediaPool(); st = tl.GetStartFrame()
while tl.GetTrackCount('video') < 4: tl.AddTrack('video')
tl.SetTrackName('video', 4, 'AIGC LABEL')
for t_ in (2, 3, 4):
    its = tl.GetItemListInTrack('video', t_)
    if its: tl.DeleteClips(its)
bad = []; placed = 0
for m in D['caps'] + D.get('pills', []) + D.get('labels', []):
    it = mp.AppendToTimeline([{'mediaPoolItem': mpclip(m['file']), 'startFrame': 0, 'endFrame': m['length'], 'mediaType': 1, 'trackIndex': m['track'], 'recordFrame': st + m['frame']}])
    if not it or not it[0]:
        bad.append((m['file'].rsplit('/', 1)[1], 'fail')); continue
    it = it[0]; placed += 1
    it.SetProperties({'ZoomX': 1.0, 'ZoomY': 1.0})
    if it.GetDuration() != m['length'] or it.GetStart() - st != m['frame']:
        bad.append((m['file'].rsplit('/', 1)[1], it.GetStart() - st, it.GetDuration(), m['frame'], m['length']))
pm.SaveProject()
result = {'placed': placed, 'bad': bad[:20]}
'''

CHUNKS['audio'] = HEAD + r'''
p = P(); tl = TL(); p.SetCurrentTimeline(tl); mp = p.GetMediaPool(); st = tl.GetStartFrame()
for t in range(1, tl.GetTrackCount('audio') + 1):
    its = tl.GetItemListInTrack('audio', t)
    if its: tl.DeleteClips(its)
r = {'vo': 0, 'sfx': 0}
for v in D['vo']:
    it = mp.AppendToTimeline([{'mediaPoolItem': mpclip(v['file']), 'mediaType': 2, 'trackIndex': 1, 'recordFrame': st + v['frame']}])
    if it and it[0]: r['vo'] += 1
for s in D['sfx']:
    it = mp.AppendToTimeline([{'mediaPoolItem': mpclip(s['file']), 'mediaType': 2, 'trackIndex': 2, 'recordFrame': st + s['frame']}])
    if it and it[0]: r['sfx'] += 1
it = mp.AppendToTimeline([{'mediaPoolItem': mpclip(D['bgm']), 'mediaType': 2, 'trackIndex': 3, 'recordFrame': st}])
r['bgm'] = bool(it and it[0])
r['a'] = [[(x.GetStart() - st, x.GetDuration()) for x in tl.GetItemListInTrack('audio', t)][:3] for t in (1, 2, 3)]
pm.SaveProject()
result = r
'''

CHUNKS['render'] = HEAD + r'''
p = P(); tl = TL(); p.SetCurrentTimeline(tl)
resolve.OpenPage('deliver')
p.DeleteAllRenderJobs()
p.SetCurrentRenderFormatAndCodec('mp4', 'H264')
ok = p.SetRenderSettings({'SelectAllFrames': True, 'TargetDir': '/Users/a1-6/Movies/TUOTUO/video/renders', 'CustomName': 'OUTNAME',
                          'FormatWidth': 1080, 'FormatHeight': 1920, 'FrameRate': 60, 'VideoQuality': 0, 'ExportVideo': True, 'ExportAudio': True,
                          'AudioCodec': 'aac', 'AudioBitDepth': 16, 'AudioSampleRate': 48000})
jid = p.AddRenderJob()
p.StartRendering([jid], False)
result = {'settings': ok, 'job': jid}
'''

CHUNKS['load'] = HEAD + r'''
p = pm.LoadProject('TUOTUO')
p = pm.GetCurrentProject(); tl = TL()
if tl: p.SetCurrentTimeline(tl)
result = {'project': p.GetName(), 'timeline': tl.GetName() if tl else None, 'v1': len(tl.GetItemListInTrack('video', 1)) if tl else 0}
'''

CHUNKS['status'] = HEAD + r'''
p = P()
result = {'rendering': p.IsRenderingInProgress(), 'jobs': [(j['JobId'], p.GetRenderJobStatus(j['JobId'])) for j in p.GetRenderJobList()]}
'''


def run(names):
    c = Client()
    try:
        for name in names:
            src = CHUNKS[name].replace('OUTNAME', os.environ.get('OUTNAME', 'TUOTUO_v1'))
            out = c.call('run_script_unsafe', {'script': src, 'timeout': 60}, timeout=150)
            print(name, '->', out[:1500], flush=True)
    finally:
        c.p.terminate()


if __name__ == '__main__':
    run(sys.argv[1:])
