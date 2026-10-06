"""本地旧版与增量更新夹具；仅监听127.0.0.1，统计资源请求，不访问生产。"""
from collections import Counter
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import hashlib
import json
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
OLD = {name: subprocess.check_output(['git', 'show', '067dbed:' + name], cwd=ROOT) for name in ['index.html', 'service-worker.js']}


class Handler(SimpleHTTPRequestHandler):
    mode = 'old'
    counts = Counter()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass

    def reply(self, body, kind='text/html; charset=utf-8'):
        self.send_response(200)
        self.send_header('Content-Type', kind)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_POST(self):
        mode = self.path.removeprefix('/__test/')
        if mode not in ['old', 'current', 'v2', 'broken', 'hang']:
            self.send_error(400)
            return
        Handler.mode = mode
        Handler.counts = Counter()
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/__test/counts':
            return self.reply(json.dumps(dict(self.counts)).encode(), 'application/json')
        if not path.startswith('/arcade/'):
            return self.send_error(404)
        path = path.removeprefix('/arcade')
        self.counts[path] += 1
        name = 'index.html' if path in ['/', '/index.html'] else 'service-worker.js' if path == '/service-worker.js' else None
        if not name:
            self.path = path
            return super().do_GET()
        if self.mode == 'old':
            source = OLD[name]
        else:
            source = (ROOT / name).read_bytes()
            if self.mode in ['v2', 'broken', 'hang']:
                original = (ROOT / 'index.html').read_bytes()
                modified = original.replace(b"<title>Cookie's Arcade</title>", f'<title>Cookie Arcade {self.mode}</title>'.encode())
                if name == 'index.html':
                    if self.mode == 'hang':
                        time.sleep(25)
                    source = b'wrong release' if self.mode == 'broken' else modified
                else:
                    source = source.replace(b'const CACHE_VERSION = "', ('const CACHE_VERSION = "test-' + self.mode + '-').encode())
                    source = source.replace(hashlib.sha256(original).hexdigest().encode(), hashlib.sha256(modified).hexdigest().encode())
        return self.reply(source, 'application/javascript' if name.endswith('.js') else 'text/html; charset=utf-8')


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    print(server.server_address[1], flush=True)
    server.serve_forever()
