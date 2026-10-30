"""The lab's certificate authority: Pebble (Let's Encrypt's test ACME server) on the lab host.

    https://acme.ops:14000/dir   ACME directory, for certbot in the VM (acme.ops = 10.0.2.2 there)
    https://127.0.0.1:15000      Pebble's management API (its current root: /roots/0)

Pebble's own TLS certificate is for acme.ops, signed by the lab CA in lab/keys/acme/ (lab-only, committed
like the SSH keys). To validate an HTTP-01 challenge Pebble connects to sysops.example:80, which the
lab host's /etc/hosts points at web-01's port forward (vm.py forwards 80 and 443). Nothing reaches
Let's Encrypt: the certificate is real, trusted only where the lab installs Pebble's root.

Pebble keeps everything in memory and makes a new root each time it starts, so issued certificates
are `volatile`; vm.py starts it when it is not running.
"""
import json
import os
import socket
import subprocess
from pathlib import Path

KEYS = Path(__file__).parent / 'keys' / 'acme'
LAB = Path(os.environ.get('LAB', '/home/user/lab/images'))
PORT = 14000


def running() -> bool:
    with socket.socket() as s:
        return s.connect_ex(('127.0.0.1', PORT)) == 0


def start() -> None:
    hosts = Path('/etc/hosts').read_text()
    if 'sysops.example' not in hosts:
        Path('/etc/hosts').write_text(hosts + '127.0.0.11 sysops.example\n')
    config = LAB / 'pebble-config.json'
    config.write_text(json.dumps({'pebble': {
        'listenAddress': f'127.0.0.1:{PORT}', 'managementListenAddress': '127.0.0.1:15000',
        'certificate': str(KEYS / 'acme.pem'), 'privateKey': str(KEYS / 'acme-key.pem'),
        'httpPort': 80, 'tlsPort': 443, 'ocspResponderURL': '', 'externalAccountBindingRequired': False,
    }}))
    # no proxy for Pebble's validation requests: they go to the VM, never out
    env = {k: v for k, v in os.environ.items() if 'proxy' not in k.lower()}
    env.update({'PEBBLE_VA_NOSLEEP': '1', 'PEBBLE_WFE_NONCEREJECT': '0', 'PEBBLE_AUTHZREUSE': '0'})
    log = open(LAB / 'pebble.log', 'ab')
    subprocess.Popen(['pebble', '-config', str(config)], env=env, stdout=log, stderr=log, start_new_session=True)


if __name__ == '__main__':
    start()
