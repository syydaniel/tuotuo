"""usage: python3 sheet.py scene "t1,t2,..." [scene "times" ...]  -> web/_sheets/stage_<scene>.png (needs rec_server on 7812)"""
import subprocess, sys, os, time, tempfile, shutil
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'web', '_sheets')
a = sys.argv[1:]
for scene, times in zip(a[::2], a[1::2]):
    out = f'{OUT}/stage_{scene}.png'
    if os.path.exists(out): os.remove(out)
    prof = tempfile.mkdtemp(prefix='stagesheet')
    ch = subprocess.Popen([CHROME, '--headless=new', f'--user-data-dir={prof}', '--window-size=600,1000', '--no-first-run',
                           f'http://127.0.0.1:7812/video/stage.html?sheet={scene}&t={times}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.time()
    while not os.path.exists(out) and time.time() - t0 < 90: time.sleep(0.3)
    time.sleep(0.4); ch.terminate(); ch.wait(); shutil.rmtree(prof, ignore_errors=True)
    print(scene, 'ok' if os.path.exists(out) else 'TIMEOUT', flush=True)
