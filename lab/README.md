# lab — the one VM, and the snapshot chain

Everything that produces the spine's transcripts. See `LINUX-COURSE-PLAN.md`, "The lab", for why.

| file | role |
| --- | --- |
| `seed/user-data`, `seed/meta-data` | web-01's cloud-init seed (`seed/web-02/` is web-02's: Rocky 10.2, sudo through `wheel`, dnf through the package cache, chronyd and dnf-makecache off): hostname, the `sysops` user (lab-only password `sysops`), fixed SSH host key, pinned apt sources (snapshot.debian.org, 2026-10-26), NTP and apt timers off |
| `keys/` | **lab-only** keys, committed on purpose so every replay sees the same fingerprints: web-01's host key and the team's login key. Never use them anywhere else. |
| `vm.py` | start / save / restore a VM through QMP; `HOSTS` holds web-01 (Debian 13, `127.0.0.11`) and web-02 (Rocky 10.2, `127.0.0.12`). Each has a system disk, an empty second disk and its seed CD (a snapshot restores only into the devices it was saved with). Snapshots live in `$LAB/<host>.qcow2` (default `/home/user/lab/images`), never in git |
| `build_base.py` | first boot with the seed, one normal reboot, `savevm base` (`build_base.py web-02` for course 11). Rebuilding a base invalidates that host's chain |
| `capture.py` | the `ops` console: `su - sysops` in its own UTS namespace (hostname `ops`, no VM), an 80 × 43 pty, `pyte` recording what the terminal drew; `grab` saves full-screen programs |
| `aptcache.py` | the VM's apt proxy on the lab host (:3142): serves the pinned archives from `$LAB/apt-cache`, fetching each file once over HTTPS. Started by `vm.py` |
| `acme.py` | the lab's certificate authority: Pebble (Let's Encrypt's test ACME server) on the lab host as `acme.ops`, with its TLS cert from the lab CA in `keys/acme/`. Started by `vm.py`; VM ports 80/443 are forwarded so Pebble can validate |
| `files/` | config files a step copies into the VM (nginx site, units, nftables) — scenes show the server's `cat` of them, not these |
| `scripts/` | files a step uploads into the VM (`"upload"` in step.json), e.g. `traffic.sh` |
| `replay.py` | the chains (web-01 for courses 1–10, web-02 for `rhel`; ONE VM runs at a time): restore the parent snapshot, run a step, write `session.txt` + `tty/*.json`, save. `--check` needs no VM |

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

Course 11 also needs Rocky's image (`Rocky-10-GenericCloud-Base-10.2-20260525.0.x86_64.qcow2` from
`dl.rockylinux.org/pub/rocky/10.2/images/x86_64/`, SHA-256 `9fc9e9ff…bc4b48`) and its base:

```bash
cloud-localds /home/user/lab/images/seed-web-02.iso lab/seed/web-02/user-data lab/seed/web-02/meta-data && python3 lab/build_base.py web-02
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

web-02's base ~13 min. `rhel/03` installs firewalld, which pulls a new kernel; building its initramfs
is the slowest step in the lab (its step allows 90 min).

Base build ~4 min. Restore + ssh ~7 s. A course-2 step 22–42 s. Courses 1–2 (8 steps) ~4 min.
KVM makes all of it several times faster; the transcripts do not change apart from `volatile` values.
