"""Build a host's base snapshot: first boot with its cloud-init seed, then `savevm base`.

    python3 lab/build_base.py            web-01
    python3 lab/build_base.py web-02     (course 11)

Throws away every snapshot of the host (the whole chain is rebuilt from here).
"""
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from vm import VM, ssh_opts  # noqa: E402

t0 = time.time()
host = sys.argv[1] if len(sys.argv) > 1 else 'web-01'
vm = VM(host)
vm.create_disk()
vm.start()
vm.wait_ssh()
print(f'ssh up after {time.time() - t0:.0f}s', flush=True)
subprocess.run(['ssh', *ssh_opts(host), host, 'cloud-init status --wait >/dev/null; sudo -n true 2>/dev/null; true'], check=True)
# reboot once so the base is a NORMAL boot (cloud-init disabled), not the first-boot one
subprocess.run(['ssh', *ssh_opts(host), host, 'echo sysops | sudo -S -p "" systemctl reboot'])
time.sleep(10)
vm.wait_ssh()
subprocess.run(['ssh', *ssh_opts(host), host, 'systemctl is-system-running --wait; true'])
time.sleep(5)
vm.save('base')
vm.stop()
print(f'base saved after {time.time() - t0:.0f}s')
