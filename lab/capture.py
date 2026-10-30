"""Drive the `ops` shell in an 80 × 43 pty and record what the terminal DREW.

The ops shell is the team's workstation (LINUX-COURSE-PLAN.md, "The cast"): a login shell as the
host user `sysops` in its own UTS namespace with hostname `ops` — not a VM, so it costs nothing and
the one-VM rule holds. `ssh web-01` from it reaches the lab VM through QEMU's port forward.

Output goes through `pyte`, a terminal emulator, so a transcript is what a terminal showed: rows
wrapped at 80 columns where the terminal wrapped them, blank rows kept, escape sequences applied and
gone. Two screens are fed the same bytes:

  - a TALL one (80 × 5000), which never scrolls: the transcript's rows, the console the scenes draw;
  - a REAL one (80 × 43, the pty's size), for full-screen programs: `grab` copies it with its
    inverse/bold runs into a `tty` capture.

A step is a list of actions (spine/<course>/<NN>/step.json "session"):

  "text"                      type the line + Enter, wait for the prompt
  {"cmd": "…", "wait": re}    the same, waiting for a regex instead of the prompt
  {"keys": "…"}               raw keystrokes (no Enter), then settle
  {"secret": "…"}             a password: typed + Enter, never echoed, so never in the transcript
  {"grab": "name"}            save the 80 × 43 screen as tty/<name>.json
  {"hidden": [actions]}       run, but start the transcript AFTER them (e.g. a login)
"""
import json
import os
import pty
import re
import select
import shutil
import struct
import subprocess
import fcntl
import termios
import time
from pathlib import Path

import pyte

from vm import SSH_ADDR

COLS, ROWS = 80, 43
PROMPT = re.compile(r'^(?:\S+@\S+:.*[$#]|\[\S+@\S+ [^\]]*\][$#]) $')
LAB_DIR = Path(__file__).parent
ALT = re.compile(rb'(\x1b\[\?(?:1049|1047|47)[hl])')
ALT_ON = {b'\x1b[?1049h', b'\x1b[?1047h', b'\x1b[?47h'}
ALT_OFF = {b'\x1b[?1049l', b'\x1b[?1047l', b'\x1b[?47l'}
DECSTBM = re.compile(rb'\x1b\[\d*(?:;\d*)?r')
STATUS_ROW = re.compile(rb'\x1b7.*?\x1b8', re.S)
SGR_COLON = re.compile(rb'\x1b\[[0-9;:]*:[0-9;:]*m')


def setup_ops() -> None:
    """The host user `sysops` with the team's key and an ssh config naming web-01. Idempotent."""
    if subprocess.run(['id', 'sysops'], capture_output=True).returncode:
        subprocess.run(['useradd', '-m', '-s', '/bin/bash', '-c', 'Sysops team', 'sysops'], check=True)
    ssh = Path('/home/sysops/.ssh')
    ssh.mkdir(mode=0o700, exist_ok=True)
    shutil.copy(LAB_DIR / 'keys' / 'sysops_ed25519', ssh / 'id_ed25519')
    shutil.copy(LAB_DIR / 'keys' / 'sysops_ed25519.pub', ssh / 'id_ed25519.pub')
    # known_hosts as OpenSSH writes it for a non-22 port, so `ssh web-01` never asks
    pub = (LAB_DIR / 'keys' / 'ssh_host_ed25519_key.pub').read_text().split()[:2]
    (ssh / 'known_hosts').write_text(f'web-01 {" ".join(pub)}\n')
    (ssh / 'config').unlink(missing_ok=True)
    hosts = Path('/etc/hosts').read_text()
    if 'web-01' not in hosts:
        Path('/etc/hosts').write_text(hosts + f'{SSH_ADDR} web-01\n')
    os.chmod(ssh / 'id_ed25519', 0o600)
    subprocess.run(['chown', '-R', 'sysops:sysops', str(ssh)], check=True)


class Screen(pyte.Screen):
    """pyte's screen, minus one crash: vim sends `ESC[>4;2m` (xterm modifyOtherKeys), a PRIVATE
    sequence that pyte hands to its colour handler. It sets a keyboard mode and draws nothing."""

    def select_graphic_rendition(self, *attrs, private=False):
        if not private:
            super().select_graphic_rendition(*attrs)


def _attrs(screen: pyte.Screen, row: int) -> tuple[list, list]:
    inv, bold = [], []
    line = screen.buffer[row]
    for key, runs in (('reverse', inv), ('bold', bold)):
        start = None
        for x in range(screen.columns + 1):
            on = x < screen.columns and getattr(line[x], key)
            if on and start is None:
                start = x
            if not on and start is not None:
                runs.append([row, start, x])
                start = None
    return inv, bold


class Console:
    def __init__(self):
        self.tall = Screen(COLS, 5000)
        self.real = Screen(COLS, ROWS)
        self.stream = pyte.ByteStream()
        self.stream.attach(self.tall)
        self.real_stream = pyte.ByteStream(self.real)
        pid, fd = pty.fork()
        if pid == 0:
            os.environ.clear()
            os.environ.update({'TERM': 'xterm-256color', 'LANG': 'C.UTF-8', 'PATH': '/usr/sbin:/usr/bin:/sbin:/bin'})
            os.execvp('unshare', ['unshare', '--uts', 'sh', '-c', 'hostname ops && exec su - sysops'])
        self.pid, self.fd = pid, fd
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', ROWS, COLS, 0, 0))
        self.mark = 0
        self.alt = False
        self.held = b''
        self.wait_prompt()

    # -- io --------------------------------------------------------------------------------------
    def _pump(self, timeout: float) -> bool:
        """Read what the pty drew and feed both screens."""
        r, _, _ = select.select([self.fd], [], [], timeout)
        if not r:
            return False
        try:
            data = os.read(self.fd, 65536)
        except OSError:
            return False
        # systemd colours with COLON sub-parameters (ESC[38:5:245m); pyte reads only semicolons and
        # would print the rest as text ("5:245m"). Same colour, written the older way.
        data = SGR_COLON.sub(lambda m: m.group(0).replace(b':', b';'), data)
        # The grab screen follows xterm: entering the alternate screen CLEARS it (the cursor stays).
        for part in ALT.split(data):
            if part in ALT_ON:
                self.real.erase_in_display(2)
            elif part not in ALT_OFF:
                self.real_stream.feed(part)
        # A full-screen program switches to the ALTERNATE screen (smcup, `ESC[?1049h`) and back
        # (`ESC[?1049l`); a terminal then shows the console exactly as it was. pyte has no alternate
        # buffer, so the tall screen simply does not see those bytes: `man ls` leaves one row.
        for part in ALT.split(data):
            if part in ALT_ON:
                self.alt = True
            elif part in ALT_OFF:
                self.alt = False
            elif not self.alt:
                # a scroll region (DECSTBM) would make the never-scrolling tall screen scroll inside
                # the pty's 43 rows and lose the top: a terminal's scrollback keeps those rows
                part = DECSTBM.sub(b'', part)
                # apt 3's progress bar: save cursor (ESC 7), draw on the BOTTOM row, restore (ESC 8). On
                # the tall screen "the bottom row" is a transcript row, so the bar overwrote real output;
                # a terminal erases the bar when apt ends. Drop each save…restore span (held until whole).
                part = self.held + part
                cut = part.rfind(b'\x1b7')
                if cut != -1 and part.find(b'\x1b8', cut) == -1:
                    part, self.held = part[:cut], part[cut:]
                else:
                    self.held = b''
                self.stream.feed(STATUS_ROW.sub(b'', part))
        return True

    def settle(self, quiet: float = 1.0, timeout: float = 600) -> None:
        end = time.time() + timeout
        last = time.time()
        while time.time() < end:
            if self._pump(0.1):
                last = time.time()
            elif time.time() - last > quiet:
                return

    def rows(self) -> list[str]:
        lines = [line.rstrip() for line in self.tall.display]
        return lines[: self.tall.cursor.y + 1]

    def wait_for(self, pattern: re.Pattern, timeout: float = 900) -> None:
        end = time.time() + timeout
        while time.time() < end:
            self._pump(0.2)
            cur = self.tall.display[self.tall.cursor.y][: self.tall.cursor.x]
            if pattern.search(cur):
                self.settle(0.5)
                if pattern.search(self.tall.display[self.tall.cursor.y][: self.tall.cursor.x]):
                    return
        raise TimeoutError(f'no {pattern.pattern!r}; screen ends: {self.rows()[-5:]}')

    def wait_prompt(self, timeout: float = 900) -> None:
        self.wait_for(PROMPT, timeout)

    def type(self, text: str) -> None:
        for ch in text:  # one keystroke at a time, the way a person types: readline sees each
            os.write(self.fd, ch.encode())
            time.sleep(0.01)

    # -- actions ---------------------------------------------------------------------------------
    def run(self, actions: list, grabs: dict) -> None:
        for a in actions:
            if isinstance(a, str):
                a = {'cmd': a}
            if 'cmd' in a:
                self.type(a['cmd'] + '\r')
                if 'wait' in a:
                    self.wait_for(re.compile(a['wait']))
                else:
                    self.wait_prompt()
            elif 'keys' in a:
                self.type(a['keys'].encode().decode('unicode_escape'))
                self.settle(a.get('quiet', 1.5))
            elif 'secret' in a:
                self.type(a['secret'] + '\r')
                if 'wait' in a:
                    self.wait_for(re.compile(a['wait']))
                else:
                    self.wait_prompt()
            elif 'grab' in a:
                self.settle(a.get('quiet', 1.5))
                inv, bold = [], []
                for y in range(ROWS):
                    i, b = _attrs(self.real, y)
                    inv += i
                    bold += b
                grabs[a['grab']] = {'screen': [line.rstrip() for line in self.real.display], 'inverse': inv, 'bold': bold}
            elif 'hidden' in a:
                self.run(a['hidden'], grabs)
                self.mark = self.tall.cursor.y
            else:
                raise ValueError(f'unknown action {a}')

    def transcript(self) -> str:
        return '\n'.join(self.rows()[self.mark:]) + '\n'

    def close(self) -> None:
        try:
            os.kill(self.pid, 9)
        except ProcessLookupError:
            pass
        os.waitpid(self.pid, 0)
