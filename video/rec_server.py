"""Static server for the game + frame sink for headless recordings.
GET  /...                  -> files from ~/Movies/TUOTUO (web/ and video/)
POST /frame?tag=X&i=N      -> PNG piped into ffmpeg -> rec/X.mp4 (60 fps, near-lossless)
POST /audio?tag=X          -> rec/X.wav (offline-rendered game SFX)
POST /done?tag=X           -> closes the video, writes rec/X.json (frame count + sound events)
usage: python3 rec_server.py [port]"""
import http.server, os, subprocess, sys, json, threading
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
GAME, OUT = os.path.dirname(ROOT), os.path.join(ROOT, 'rec')
os.makedirs(OUT, exist_ok=True)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7812
pipes, lock = {}, threading.Lock()


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=GAME, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        u = urlparse(self.path); q = parse_qs(u.query); tag = q.get('tag', ['clip'])[0]
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if u.path == '/frame':
            with lock:
                p = pipes.get(tag)
                if p is None:
                    fps = q.get('fps', ['60'])[0]
                    p = pipes[tag] = subprocess.Popen(
                        ['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', fps, '-i', '-',
                         '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', os.path.join(OUT, tag + '.mp4')],
                        stdin=subprocess.PIPE)
                p.stdin.write(body)
                n = int(q.get('i', ['0'])[0])
                if n % 120 == 0:
                    print(tag, 'frame', n, flush=True)
        elif u.path == '/png':
            name = os.path.basename(q.get('name', ['sheet'])[0])
            os.makedirs(os.path.join(GAME, 'web', '_sheets'), exist_ok=True)
            open(os.path.join(GAME, 'web', '_sheets', name + '.png'), 'wb').write(body)
        elif u.path == '/audio':
            open(os.path.join(OUT, tag + '.wav'), 'wb').write(body)
        elif u.path == '/done':
            with lock:
                p = pipes.pop(tag, None)
            if p:
                p.stdin.close(); p.wait()
            open(os.path.join(OUT, tag + '.json'), 'wb').write(body)
            print('DONE', tag, flush=True)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')


if __name__ == '__main__':
    print('serving', GAME, 'on', PORT, flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
