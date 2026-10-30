"""The one lab VM: start, stop, save and restore it through QEMU's QMP socket.

Exactly one VM runs at a time (LINUX-COURSE-PLAN.md, "The lab"). Its disk is ONE qcow2 file per
host (`$LAB/<host>.qcow2`, an overlay over the pinned cloud image) that also holds the section
snapshots as INTERNAL snapshots: `savevm <tag>` stores disk + RAM + device state, `loadvm <tag>`
resumes it with every service already running. The guest clock is VM time (`clock=vm`), so it
advances only while the VM runs and a restored snapshot continues from where it was saved.

KVM is used when /dev/kvm exists; otherwise TCG emulation (slower, same transcripts apart from the
`volatile` values).
"""
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

LAB = Path(os.environ.get('LAB', '/home/user/lab/images'))
# Each host's sshd (and 80/443) is forwarded to its own loopback address, so `ssh web-01` needs no
# port or config: setup_ops() maps the names in the lab host's /etc/hosts. web-01's is SSH_ADDR.
SSH_ADDR = '127.0.0.11'
HOSTS = {
    'web-01': {
        'image': 'debian-13-genericcloud-amd64-20261026-2643.qcow2',
        'mac': '52:54:00:10:20:11',
        'size': '8G',
        'data': '2G',
        'addr': '127.0.0.11',
        'seed': 'seed.iso',
    },
    # course 11. Rocky's cloud image is 10 GiB, so its overlay cannot be smaller.
    'web-02': {
        'image': 'Rocky-10-GenericCloud-Base-10.2-20260525.0.x86_64.qcow2',
        'mac': '52:54:00:10:20:12',
        'size': '10G',
        'data': '1G',
        'addr': '127.0.0.12',
        'seed': 'seed-web-02.iso',
    },
}
CLOCK = '2026-11-02T09:00:00'


class VM:
    def __init__(self, host: str):
        self.host = host
        self.spec = HOSTS[host]
        self.disk = LAB / f'{host}.qcow2'
        self.data = LAB / f'{host}-data.qcow2'
        self.qmp_path = LAB / f'{host}.qmp'
        self.proc: subprocess.Popen | None = None
        self.sock: socket.socket | None = None

    # -- disk ---------------------------------------------------------------------------------
    def create_disk(self) -> None:
        """A fresh overlay over the pinned image, and an EMPTY second disk (vdb, course 9). Throws away
        every snapshot of this host. The second disk is there from the base on because a snapshot
        restores only into the device set it was saved with."""
        self.disk.unlink(missing_ok=True)
        self.data.unlink(missing_ok=True)
        subprocess.run(['qemu-img', 'create', '-q', '-f', 'qcow2', '-F', 'qcow2',
                        '-b', str(LAB / self.spec['image']), str(self.disk), self.spec['size']], check=True)
        subprocess.run(['qemu-img', 'create', '-q', '-f', 'qcow2', str(self.data), self.spec['data']], check=True)

    def snapshots(self) -> list[str]:
        out = subprocess.run(['qemu-img', 'snapshot', '-l', str(self.disk)], capture_output=True, text=True).stdout
        return [line.split()[1] for line in out.splitlines()[2:] if line.split()]

    # -- process ------------------------------------------------------------------------------
    def start(self, loadvm: str | None = None) -> None:
        """The seed CD and the second disk are ALWAYS attached: a snapshot restores only into the device
        set it was saved with, and the base was saved after first boot with them in. cloud-init is
        disabled by then."""
        import aptcache
        if not aptcache.running():  # the VM's apt proxy (lab/aptcache.py); it outlives the VM, harmlessly
            subprocess.Popen([sys.executable, str(Path(__file__).parent / 'aptcache.py')], start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        import acme
        if not acme.running():  # the lab's ACME server (lab/acme.py), for course 8's certificate
            acme.start()
        kvm = os.path.exists('/dev/kvm')
        a = self.spec['addr']
        self.qmp_path.unlink(missing_ok=True)
        cmd = [
            'qemu-system-x86_64', '-name', self.host, '-machine', 'q35',
            '-accel', 'kvm' if kvm else 'tcg,thread=multi', '-cpu', 'host' if kvm else 'max',
            '-smp', '2', '-m', '2048',
            '-rtc', f'base={CLOCK},clock=vm',
            '-drive', f'file={self.disk},if=virtio,format=qcow2,discard=unmap',
            '-netdev', f'user,id=n0,hostname={self.host},hostfwd=tcp:{a}:22-:22,hostfwd=tcp:{a}:80-:80,hostfwd=tcp:{a}:443-:443',
            '-device', f'virtio-net-pci,netdev=n0,mac={self.spec["mac"]}',
            '-qmp', f'unix:{self.qmp_path},server=on,wait=off',
            '-display', 'none', '-serial', f'file:{LAB / (self.host + ".console.log")}',
        ]
        cmd += ['-drive', f'file={self.data},if=virtio,format=qcow2,discard=unmap']  # vdb: empty until course 9
        cmd += ['-cdrom', str(LAB / self.spec['seed'])]  # a CD, so it does not take a vd* name
        if loadvm:
            cmd += ['-loadvm', loadvm]
        self.proc = subprocess.Popen(cmd)
        for _ in range(200):
            if self.qmp_path.exists():
                break
            time.sleep(0.05)
        self.sock = socket.socket(socket.AF_UNIX)
        self.sock.connect(str(self.qmp_path))
        self._read()  # greeting
        self.qmp('qmp_capabilities')

    def _read(self) -> dict:
        buf = b''
        while not buf.endswith(b'\n'):
            buf += self.sock.recv(65536)
        # events may arrive before the reply; keep the last non-event line
        msgs = [json.loads(line) for line in buf.decode().splitlines() if line.strip()]
        replies = [m for m in msgs if 'event' not in m]
        return replies[-1] if replies else self._read()

    def qmp(self, command: str, **args) -> dict:
        self.sock.sendall(json.dumps({'execute': command, 'arguments': args}).encode() + b'\n')
        reply = self._read()
        if 'error' in reply:
            raise RuntimeError(f'{command}: {reply["error"]}')
        return reply.get('return')

    def hmp(self, line: str) -> str:
        out = self.qmp('human-monitor-command', **{'command-line': line})
        if out and ('Error' in out or 'error' in out):
            raise RuntimeError(f'{line}: {out}')
        return out

    def save(self, tag: str) -> None:
        if tag in self.snapshots_live():
            self.hmp(f'delvm {tag}')
        self.hmp(f'savevm {tag}')

    def snapshots_live(self) -> list[str]:
        out = self.hmp('info snapshots')
        # rows are `<ID> <TAG> …`; with more than one disk the ID column reads `--`
        return [f[1] for f in (line.split() for line in out.splitlines()) if len(f) > 1 and (f[0].isdigit() or f[0] == '--')]

    def restore(self, tag: str) -> None:
        self.hmp(f'loadvm {tag}')

    def wait_ssh(self, timeout: float = 900) -> None:
        end = time.time() + timeout
        while time.time() < end:
            r = subprocess.run(['ssh', *ssh_opts(self.host), '-o', 'ConnectTimeout=5', self.host, 'true'], capture_output=True)
            if r.returncode == 0:
                return
            time.sleep(3)
        raise TimeoutError('ssh did not come up')

    def stop(self) -> None:
        """Hard stop: everything worth keeping is in a snapshot already."""
        if self.proc and self.proc.poll() is None:
            try:
                self.qmp('quit')
            except Exception:
                self.proc.kill()
            self.proc.wait(30)
        self.proc = None


KEY = Path(__file__).parent / 'keys' / 'sysops_ed25519'


def ssh_opts(host: str = 'web-01') -> list[str]:
    known = Path(__file__).parent / 'keys' / 'known_hosts'
    return ['-F', '/dev/null', '-i', str(KEY), '-o', 'IdentitiesOnly=yes', '-o', f'UserKnownHostsFile={known}',
            '-o', 'StrictHostKeyChecking=yes', '-o', f'HostKeyAlias={host}',
            '-o', 'User=sysops', '-o', f'HostName={HOSTS[host]["addr"]}']
