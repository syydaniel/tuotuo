"""Record stage scenes with headless Chrome against rec_server.py (port 7812).
usage: python3 rec.py scene[:tag] ...   -> rec/<tag>.mp4 + .wav + .json (tag defaults to scene)"""
import subprocess, sys, os, time, tempfile, shutil
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ROOT = os.path.dirname(os.path.abspath(__file__))
for spec in sys.argv[1:]:
    scene, *rest = spec.split(':'); tag = rest[0] if rest else scene
    for ext in ('mp4', 'wav', 'json'):
        p = f'{ROOT}/rec/{tag}.{ext}'
        if os.path.exists(p): os.remove(p)
    url = f'http://127.0.0.1:7812/video/stage.html?rec={scene}&tag={tag}'
    prof = tempfile.mkdtemp(prefix='recchrome')
    t0 = time.time()
    ch = subprocess.Popen([CHROME, '--headless=new', f'--user-data-dir={prof}', '--window-size=600,1000', '--hide-scrollbars',
                           '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
                           '--no-first-run', '--no-default-browser-check', url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    while not os.path.exists(f'{ROOT}/rec/{tag}.json'):
        time.sleep(0.5)
        if time.time() - t0 > 600: print('TIMEOUT', tag); break
    ch.terminate(); ch.wait(); shutil.rmtree(prof, ignore_errors=True)
    print(tag, round(time.time() - t0, 1), 's', flush=True)
