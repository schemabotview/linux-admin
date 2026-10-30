"""The lab's package cache: an HTTP proxy for the VM's apt, on the lab host at 127.0.0.1:3142.

The guest's apt is told (seed: /etc/apt/apt.conf.d/01lab-cache) to use http://10.0.2.2:3142, which
QEMU's user network maps to this host's loopback. A request for http://snapshot.debian.org/… is
answered from `$LAB/apt-cache/` when the file is there, and otherwise fetched ONCE over HTTPS (so a
host that only has an HTTPS proxy works) and kept. Only the pinned archives are served.

So a replay that installs packages needs the network only the first time; after that it is offline,
and the versions cannot move — the archives are dated snapshots. Transcripts still name the real
archive URL, because that is what apt asked for.

    python3 lab/aptcache.py          (vm.py starts it when it is not already listening)
"""
import http.server
import os
import shutil
import socket
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PORT = 3142
ALLOWED = {'snapshot.debian.org', 'dl.rockylinux.org'}
CACHE = Path(os.environ.get('LAB', '/home/user/lab/images')) / 'apt-cache'


def _context() -> ssl.SSLContext:
    bundle = '/root/.ccr/ca-bundle.crt'
    return ssl.create_default_context(cafile=bundle) if os.path.exists(bundle) else ssl.create_default_context()


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        url = urllib.parse.urlsplit(self.path)
        if url.hostname not in ALLOWED:
            return self.send_error(403, 'not a pinned archive')
        local = CACHE / url.hostname / url.path.lstrip('/')
        # an index (InRelease, Packages) under a dated snapshot never changes either, so it is cached too
        if not local.is_file():
            try:
                with urllib.request.urlopen(f'https://{url.hostname}{url.path}', context=_context(), timeout=120) as r:
                    local.parent.mkdir(parents=True, exist_ok=True)
                    tmp = local.with_suffix(local.suffix + '.part')
                    with open(tmp, 'wb') as f:
                        shutil.copyfileobj(r, f)
                    tmp.replace(local)
            except urllib.error.HTTPError as e:
                return self.send_error(e.code)
            except Exception as e:  # noqa: BLE001
                return self.send_error(502, str(e)[:100])
        self.send_response(200)
        self.send_header('Content-Length', str(local.stat().st_size))
        self.end_headers()
        with open(local, 'rb') as f:
            shutil.copyfileobj(f, self.wfile)

    def log_message(self, *args):
        pass


def running() -> bool:
    with socket.socket() as s:
        return s.connect_ex(('127.0.0.1', PORT)) == 0


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
