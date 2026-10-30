"""Replay the spine on the one lab VM, as a chain of snapshots (LINUX-COURSE-PLAN.md, "The lab").

    python3 lab/replay.py                  replay every STALE step, in course order
    python3 lab/replay.py shell/04         replay that step (and whatever is stale after it)
    python3 lab/replay.py --check          no VM: fail if any step is stale or has no transcript

A step is `spine/<course>/<NN-id>/step.json`; its snapshot tag is `<course>-<NN>`. `"upload":
{"lab/file": "/remote/path"}` copies lab files into the VM before the session (hidden setup). Replaying a step
restores its PARENT's snapshot (the previous non-branch step, or `base`), runs the session in the
`ops` console, writes `session.txt` (+ `tty/<name>.json` for each grab), and saves its own snapshot.
A `"branch": true` step (one that breaks the machine) is run and then discarded: it saves nothing,
and the next step builds on its parent.

Staleness is a hash chain: a step's key is sha256(parent key + its step.json), recorded in
`spine/chain.lock` when its transcript is written. Edit a step and it and everything after it no
longer match. The lock is committed, so `--check` works anywhere; the snapshots live only in the lab
host's qcow2 (`$LAB`). Only base and each course's last step are KEPT (keep_tags): a replay whose
parent was pruned rebuilds forward from the nearest kept ancestor.

`volatile` (step.json) masks digits and 0x… addresses when a new transcript is compared with the old
one: a PID or uptime change is not a change.
"""
import hashlib
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

ROOT = Path(__file__).parent.parent
SPINE = ROOT / 'spine'
LOCK = SPINE / 'chain.lock'
COURSES = ['intro', 'shell', 'packages', 'text', 'users', 'processes', 'services', 'network', 'storage', 'scripting', 'rhel']


def steps() -> list[dict]:
    out = []
    for course in COURSES:
        d = SPINE / course
        if not d.is_dir():
            continue
        for s in sorted(p for p in d.iterdir() if p.is_dir()):
            spec = json.loads((s / 'step.json').read_text())
            # an uploaded file is part of the step: editing it makes the step stale
            raw = (s / 'step.json').read_bytes() + b''.join((ROOT / src).read_bytes() for src in spec.get('upload', {}))
            out.append({'dir': s, 'tag': f'{course}-{s.name[:2]}', 'spec': spec, 'raw': raw})
    parent, key = 'base', hashlib.sha256(b'web-01 base').hexdigest()
    for s in out:
        s['parent'] = parent
        s['key'] = hashlib.sha256(key.encode() + s['raw']).hexdigest()
        if not s['spec'].get('branch'):
            parent, key = s['tag'], s['key']
    return out


def keep_tags(chain: list[dict]) -> set[str]:
    """The snapshots worth keeping: base and each course's last (non-branch) step. A snapshot holds the
    VM's RAM (~0.5 GB): keeping every step's filled a 39 GB disk at course 8. Replaying an earlier
    step rebuilds forward from the nearest kept one."""
    last = {}
    for s in chain:
        if not s['spec'].get('branch'):
            last[s['tag'].rsplit('-', 1)[0]] = s['tag']
    return {'base', *last.values()}


def mask(text: str) -> str:
    return re.sub(r'0x[0-9a-f]+|\d', '#', text)


def check() -> int:
    lock = json.loads(LOCK.read_text()) if LOCK.exists() else {}
    bad = [f'{s["tag"]}  stale — step.json changed since its transcript (or an earlier step did)'
           for s in steps() if lock.get(s['tag']) != s['key']]
    bad += [f'{s["tag"]}  no session.txt' for s in steps() if not (s['dir'] / 'session.txt').exists()]
    if bad:
        print(f'✗ {len(bad)} spine problem(s):\n' + '\n'.join('  ' + b for b in bad))
        return 1
    print(f'✓ spine OK — {len(steps())} step(s), every transcript current')
    return 0


def replay(only: str | None) -> int:
    import subprocess

    from capture import Console, setup_ops
    from vm import VM, ssh_opts

    lock = json.loads(LOCK.read_text()) if LOCK.exists() else {}
    vm = VM('web-01')
    live = set(vm.snapshots())
    chain = steps()
    start = None
    if only:
        course, nn = only.split('/')
        start = next(i for i, s in enumerate(chain) if s['tag'] == f'{course}-{nn[:2]}')
    todo, dirty = [], False
    for i, s in enumerate(chain):
        stale = lock.get(s['tag']) != s['key']
        if (start is not None and i == start) or stale or (dirty and not s['spec'].get('branch')):
            todo.append(s)
            dirty = dirty or not s['spec'].get('branch')
    if not todo:
        print('nothing stale')
        return 0
    # The first step's parent may have been pruned (keep_tags): rebuild forward from the nearest
    # ancestor that is still there, re-running the steps in between (their transcripts should be "same").
    by_tag = {s['tag']: s for s in chain}
    while todo[0]['parent'] != 'base' and todo[0]['parent'] not in live:
        todo.insert(0, by_tag[todo[0]['parent']])
    keep = keep_tags(chain)
    setup_ops()
    vm.start(loadvm=todo[0]['parent'])
    try:
        for s in todo:
            t0 = time.time()
            vm.restore(s['parent'])
            for src, dst in s['spec'].get('upload', {}).items():  # lab files the session uses (never shown)
                vm.wait_ssh()
                subprocess.run(['scp', '-q', *ssh_opts(), str(ROOT / src), f'web-01:{dst}'], check=True)
            con = Console()
            grabs: dict = {}
            con.run(s['spec']['session'], grabs)
            text = con.transcript()
            con.close()
            old = (s['dir'] / 'session.txt').read_text() if (s['dir'] / 'session.txt').exists() else None
            cmp = mask if s['spec'].get('volatile') else (lambda x: x)
            changed = old is None or cmp(old) != cmp(text)
            (s['dir'] / 'session.txt').write_text(text)
            if grabs:
                (s['dir'] / 'tty').mkdir(exist_ok=True)
                for name, g in grabs.items():
                    (s['dir'] / 'tty' / f'{name}.json').write_text(json.dumps(g, indent=1) + '\n')
            if not s['spec'].get('branch'):
                vm.save(s['tag'])
                for tag in vm.snapshots_live():  # a snapshot is ~0.5 GB of RAM: keep only what the chain needs
                    if tag not in keep and tag != s['tag'] and tag != s['parent']:
                        vm.hmp(f'delvm {tag}')
            lock[s['tag']] = s['key']
            LOCK.write_text(json.dumps(lock, indent=1, sort_keys=True) + '\n')
            print(f'{s["tag"]:<16} {"changed" if changed else "same":<8} {time.time() - t0:5.0f}s'
                  f'{"  (branch, discarded)" if s["spec"].get("branch") else ""}', flush=True)
    finally:
        vm.stop()
    return 0


if __name__ == '__main__':
    args = sys.argv[1:]
    sys.exit(check() if '--check' in args else replay(args[0] if args else None))
