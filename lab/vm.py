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
# web-01's sshd, forwarded to its own loopback address so `ssh web-01` needs no port or config:
# setup_ops() maps the name in the lab host's /etc/hosts.
SSH_ADDR = '127.0.0.11'
HOSTS = {
    'web-01': {
        'image': 'debian-13-genericcloud-amd64-20261026-2643.qcow2',
        'mac': '52:54:00:10:20:11',
        'size': '8G',
    },
}
CLOCK = '2026-11-02T09:00:00'


class VM:
    def __init__(self, host: str):
        self.host = host
        self.spec = HOSTS[host]
        self.disk = LAB / f'{host}.qcow2'
        self.qmp_path = LAB / f'{host}.qmp'
        self.proc: subprocess.Popen | None = None
        self.sock: socket.socket | None = None

    # -- disk ---------------------------------------------------------------------------------
    def create_disk(self) -> None:
        """A fresh overlay over the pinned image. Throws away every snapshot of this host."""
        self.disk.unlink(missing_ok=True)
        subprocess.run(['qemu-img', 'create', '-q', '-f', 'qcow2', '-F', 'qcow2',
                        '-b', str(LAB / self.spec['image']), str(self.disk), self.spec['size']], check=True)

    def snapshots(self) -> list[str]:
        out = subprocess.run(['qemu-img', 'snapshot', '-l', str(self.disk)], capture_output=True, text=True).stdout
        return [line.split()[1] for line in out.splitlines()[2:] if line.split()]

    # -- process ------------------------------------------------------------------------------
    def start(self, loadvm: str | None = None) -> None:
        """The seed ISO is ALWAYS attached: a snapshot restores only into the device set it was saved
        with, and the base was saved after first boot with it in. cloud-init is disabled by then."""
        import aptcache
        if not aptcache.running():  # the VM's apt proxy (lab/aptcache.py); it outlives the VM, harmlessly
            subprocess.Popen([sys.executable, str(Path(__file__).parent / 'aptcache.py')], start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        kvm = os.path.exists('/dev/kvm')
        self.qmp_path.unlink(missing_ok=True)
        cmd = [
            'qemu-system-x86_64', '-name', self.host, '-machine', 'q35',
            '-accel', 'kvm' if kvm else 'tcg,thread=multi', '-cpu', 'host' if kvm else 'max',
            '-smp', '2', '-m', '2048',
            '-rtc', f'base={CLOCK},clock=vm',
            '-drive', f'file={self.disk},if=virtio,format=qcow2,discard=unmap',
            '-netdev', f'user,id=n0,hostname={self.host},hostfwd=tcp:{SSH_ADDR}:22-:22',
            '-device', f'virtio-net-pci,netdev=n0,mac={self.spec["mac"]}',
            '-qmp', f'unix:{self.qmp_path},server=on,wait=off',
            '-display', 'none', '-serial', f'file:{LAB / (self.host + ".console.log")}',
        ]
        cmd += ['-drive', f'file={LAB / "seed.iso"},if=virtio,format=raw,readonly=on']
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
        return [line.split()[1] for line in out.splitlines() if line.split() and line.split()[0].isdigit()]

    def restore(self, tag: str) -> None:
        self.hmp(f'loadvm {tag}')

    def wait_ssh(self, timeout: float = 900) -> None:
        end = time.time() + timeout
        while time.time() < end:
            r = subprocess.run(['ssh', *ssh_opts(), '-o', 'ConnectTimeout=5', 'web-01', 'true'], capture_output=True)
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


def ssh_opts() -> list[str]:
    known = Path(__file__).parent / 'keys' / 'known_hosts'
    return ['-F', '/dev/null', '-i', str(KEY), '-o', 'IdentitiesOnly=yes', '-o', f'UserKnownHostsFile={known}',
            '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlias=web-01',
            '-o', 'User=sysops', '-o', f'HostName={SSH_ADDR}']
