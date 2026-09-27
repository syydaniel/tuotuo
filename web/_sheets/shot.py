"""usage: python3 shot.py name "<sheet query>" [name "<query>" ...]  -> web/_sheets/<name>.png (needs rec_server on 7812)"""
import subprocess, sys, os, time, tempfile, shutil
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
D = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
for name, q in zip(args[::2], args[1::2]):
    out = f'{D}/{name}.png'
    if os.path.exists(out): os.remove(out)
    prof = tempfile.mkdtemp(prefix='sheetchrome')
    ch = subprocess.Popen([CHROME, '--headless=new', f'--user-data-dir={prof}', '--window-size=1200,700', '--no-first-run',
                           f'http://127.0.0.1:7812/web/sheet.html?{q}&save={name}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.time()
    while not os.path.exists(out) and time.time() - t0 < 40: time.sleep(0.3)
    time.sleep(0.3); ch.terminate(); ch.wait(); shutil.rmtree(prof, ignore_errors=True)
    print(name, 'ok' if os.path.exists(out) else 'TIMEOUT', flush=True)
