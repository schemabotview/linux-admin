# lab — the one VM, and the snapshot chain

Everything that produces the spine's transcripts. See `LINUX-COURSE-PLAN.md`, "The lab", for why.

| file | role |
| --- | --- |
| `seed/user-data`, `seed/meta-data` | web-01's cloud-init seed: hostname, the `sysops` user (lab-only password `sysops`), fixed SSH host key, pinned apt sources (snapshot.debian.org, 2026-10-26), NTP and apt timers off |
| `keys/` | **lab-only** keys, committed on purpose so every replay sees the same fingerprints: web-01's host key and the team's login key. Never use them anywhere else. |
| `vm.py` | start / save / restore the VM through QMP. Disk + section snapshots live in `$LAB/web-01.qcow2` (default `/home/user/lab/images`), never in git |
| `build_base.py` | first boot with the seed, one normal reboot, `savevm base`. Rebuilding it invalidates the whole chain |
| `capture.py` | the `ops` console: `su - sysops` in its own UTS namespace (hostname `ops`, no VM), an 80 × 43 pty, `pyte` recording what the terminal drew; `grab` saves full-screen programs |
| `aptcache.py` | the VM's apt proxy on the lab host (:3142): serves the pinned archives from `$LAB/apt-cache`, fetching each file once over HTTPS. Started by `vm.py` |
| `acme.py` | the lab's certificate authority: Pebble (Let's Encrypt's test ACME server) on the lab host as `acme.ops`, with its TLS cert from the lab CA in `keys/acme/`. Started by `vm.py`; VM ports 80/443 are forwarded so Pebble can validate |
| `files/` | config files a step copies into the VM (nginx site, units, nftables) — scenes show the server's `cat` of them, not these |
| `scripts/` | files a step uploads into the VM (`"upload"` in step.json), e.g. `traffic.sh` |
| `replay.py` | the chain: restore the parent snapshot, run a step, write `session.txt` + `tty/*.json`, save. `--check` needs no VM |

## Setting up a lab host (once)

```bash
sudo apt-get install -y qemu-system-x86 qemu-utils cloud-image-utils openssh-client
```

```bash
pip install pyte
```

```bash
mkdir -p /home/user/lab/images && cd /home/user/lab/images && curl -sSLO https://cloud.debian.org/images/cloud/trixie/20261026-2643/debian-13-genericcloud-amd64-20261026-2643.qcow2
```

```bash
cloud-localds /home/user/lab/images/seed.iso lab/seed/user-data lab/seed/meta-data && python3 lab/build_base.py
```

Then `npm run replay` (stale steps only) or `npm run replay -- shell/04` (that step and what is
stale after it). The lab host must run as root (it maps `web-01` in `/etc/hosts` and creates the
host user `sysops`).

## Snapshots kept

A snapshot holds the VM's RAM (~0.5 GB): keeping all of them filled the 39 GB disk at course 8.
`replay.py` keeps only `base` and each course's last step; replaying an earlier step rebuilds
forward from the nearest kept snapshot (the steps in between should come back "same").

## "changed" that is not a change

A few steps not marked `volatile` still print a download speed (`Fetched … (1261 kB/s)`) or an HTTP
`Date:`; a replay reports them "changed". Check with `git diff spine/` that only such values moved
before believing a transcript changed. Scenes never read those values.

## Timings measured (TCG emulation, no KVM, 4 vCPU host)

Base build ~4 min. Restore + ssh ~7 s. A course-2 step 22–42 s. Courses 1–2 (8 steps) ~4 min.
KVM makes all of it several times faster; the transcripts do not change apart from `volatile` values.
