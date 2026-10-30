# Learn Linux administration by running a web server — plan

**Status: v3 plan (2026-10-30): x86_64, one VM at a time, one vim section.** Courses 1–9 authored (spine captured, scenes, narration, checks); narration audio not generated yet.

## The idea

One project: the **Sysops team** serves **`sysops.example`**. It starts from a fresh VM reached over
SSH and ends with a hardened, monitored Debian server serving the site over HTTPS, then does the
same job on Rocky Linux to learn the other family. Each Linux feature is taught **when the server first needs it**. Background topics (the
kernel, `fork`/`exec`, a packet's path) appear as short detours at the moment they answer a question
on screen. They are never front-loaded.

Why a web server:

- **It is why most people meet Linux.**
- **Each need pulls in a topic**: reading logs needs pipes and `grep`, the team's site directory needs
  permissions and groups, nginx needs packages and systemd, HTTPS needs the network, a firewall and
  a certificate, a full disk needs storage, the 403 on Rocky needs SELinux.
- **The ending is checkable**: `curl https://sysops.example` answers, on Debian and then on Rocky.

Engine `@graphlearning/graphl-flow` (≥ 0.8: consoles, Debian/Red Hat prompts, `tty` screens,
`ini`/`nginx`/`nft` highlighting, Linux icons), shell `@graphlearning/shell` (1.x), both pinned.
Engine 0.7 was built for exactly this course: its `console-frame` study and `code/linux.ts`
fixtures are real captures from Debian 13 and Rocky 10.2 VMs.

## The cast

| Name | What it is |
| --- | --- |
| **Sysops team** | the people running the servers; the narration says "the team" |
| `sysops` | the team's login on every machine (prompt `sysops@web-01:~$`) |
| `site` (group) | the people who may edit the site: sysops and `deploy`; owns `/srv/sysops.example` (setgid, course 5). Not the `sysops` group, which is sysops's private group |
| `deploy` | a service account added in course 5, used by the deploy script (course 10) |
| `ops` | the team's workstation: where every session starts, `ssh web-01`. **Not a VM** — a shell on the lab host in its own UTS namespace (hostname `ops`), so it costs nothing |
| `web-01` | Debian 13 "trixie", x86_64, the web server of courses 1–10 |
| `web-02` | Rocky Linux 10.2, x86_64, the web server of course 11 |

**Exactly one VM runs at a time.** `web-01` is shut down before course 11 starts `web-02`. The lab's
infrastructure runs as plain processes on the lab host, reached from the VM through QEMU's gateway,
and the course shows it only where it is the subject: DNS (`sysops.example` → the VM), a local ACME
server (Pebble) for certbot, and the package mirrors (below). Nothing in a replay reaches the internet.

## Packaging for YouTube

One video, **"Linux administration: full course, beginner to professional"**: all 11 courses,
67 sections, about 1 h 45 min. A course is one chapter group and the owner's review unit. A section
(~90 s) is one chapter. The video opens with the finished `curl`. It is published
only when all 11 courses are recorded. Each section can also go out as a Short (`record-reels`).

## Every output is real

A terminal on screen is a **captured transcript** from a real VM through an 80-column pty. A row wraps
where the terminal wrapped, and nothing is typed from memory. Debian 13 and Rocky 10.2 are pinned by
image digest, the same way Python 3.15.1 and PostgreSQL 16 are pinned in the sister repos. Behaviour
that belongs to one distribution family is labelled as such.

## The lab: real VMs, built incrementally

### Why VMs, not containers

Containers start faster (< 1 s against a 5–15 s boot), but a container is a process tree on the
**host's** kernel. That breaks a third of this course:

| Topic | Container | VM |
| --- | --- | --- |
| `uname -r`, kernel vs distro (1.1) | shows the host's kernel | its own kernel |
| boot, systemd as PID 1 (7.1, 7.2) | no boot; systemd needs privileged hacks | real |
| `ps --forest` (6.2) | no systemd → sshd → bash tree | real |
| `journalctl`, timers (7.5, 7.7) | partial | real |
| nftables, firewalld (8.6, 11.3) | only a network namespace, needs `CAP_NET_ADMIN` | real |
| `lsblk`, `mount`, `fstab`, `df` (9.1–9.3) | the host's disks and overlayfs | its own disks |
| SELinux (11.4–11.6) | not available inside a container | real (Rocky, enforcing) |
| reboot (7.1, 9.2) | impossible | real |

So the course uses **VMs everywhere**. Splitting the shell and text courses into containers would
save little and give two different prompts, process trees and hostnames inside one film.
Snapshots remove most of the speed cost (below).

### The snapshot chain: each section builds on the previous one

A replay never rebuilds the server from scratch. The lab is a **chain of snapshots**, one per
section, each built on the previous one's end state:

```
base ──▶ intro/01 ──▶ intro/02 ──▶ shell/01 ──▶ … ──▶ storage/06 ──▶ … ──▶ rhel/07
          (snapshot = the one running VM + its host-side service state)
```

- **A snapshot is the one VM at one moment**, disk **and** RAM, plus the state of the host-side
  services that belong with it (the ACME server's account and certificate database). Disks are qcow2 overlays (each section's disk is a copy-on-write layer over its
  parent's, so it costs only what changed). RAM is QEMU's saved VM state, so a section **resumes**
  in 1–3 s with its services already running instead of booting.
- **Replaying section N** = restore snapshot N−1 → run N's steps → save snapshot N. The cost is
  N's own commands, not the 1…N−1 before it.
- **Cache key** = hash of (base image digests + every step of every section up to N). Change a
  section and it and everything after it is marked **stale**. `replay` reruns only stale sections,
  in order, and prints which transcripts actually changed. `check:spine` fails while anything is stale.
- **`replay <course>/<NN>`** reruns one section, and `--through <course>/<NN>` reruns a range.
  `--only` reruns one section without touching its descendants: they stay marked stale, for when
  you are iterating on wording and know the state did not change.
- **Damage is a detour, not the main line.** Sections that break the machine (disk full, an
  `fstab` typo that stops the boot, locking yourself out with the firewall, the SELinux 403)
  are `"branch": true` in `step.json`. They start from their parent snapshot, run, and are **discarded**,
  so the next section builds on the healthy server. This is the expense tracker's rule ("experiments
  go in the REPL, never into `main.py`") applied to a machine. A section that fixes the damage
  replays the break and the fix together.
- **Base images** are built once: pinned x86_64 cloud image + a fixed cloud-init seed (hostname,
  a fixed MAC and address, the `sysops` user, **fixed SSH host keys** so fingerprints
  never change between replays), cloud-init then disabled. Rebuilding a base invalidates its chain.

### Determinism

- **Packages come from pinned archives**: Debian from `snapshot.debian.org` at 2026-10-26, Rocky
  from the 10.2 vault, so `apt install nginx` always installs the same version. A replay that
  installs packages needs the network; a local mirror (the original plan) would make it offline and
  is a later optimisation.
- **The guest clock is VM time** (`-rtc base=2026-11-02T09:00:00,clock=vm`, NTP off). Time
  advances only while the VM runs, and it continues from a snapshot rather than jumping to today.
- **`volatile` steps** (PIDs, load averages, uptime, byte counts from `du`, timings) are compared with
  their numbers masked. A scene **reads** such a value from `session.txt` and never types it, and
  narration says "a few milliseconds", not a number.

### Capture

A host-side driver opens the `ops` shell in an 80 × 43 pty and drives it with typed keystrokes,
waiting on the prompt regex. A terminal emulator (`pyte`) records exactly what was drawn: rows,
wraps and blank rows go to `session.txt`, and for a full-screen program (`top`, `less`, `man`,
`vim`) the screen buffer with its inverse/bold runs is written as a `tty` capture. That is the
same format graphl-flow's `linux.ts` and `console-frame.ts` fixtures came from.

### The spine

`spine/<course>/<NN-step>/` = `session.txt` + `step.json` (`host`, the commands, `volatile`,
`branch`) + `files/` (the config files the section changed, copied from the VM, so a config frame
shows the real file) + the chain's cache key. Scenes import them with `?raw`. Highlights are found
by text, never typed as line numbers.

### Where it runs, and how long it takes

The replay needs hardware virtualization: **KVM on an x86_64 Linux host** (or an x86_64 Mac with
HVF; on Apple Silicon an x86_64 guest is emulated and slow). This cloud container has no
`/dev/kvm`, and pure emulation (TCG) is 5–10× slower, so replays run on the owner's machine and
the repo commits the transcripts (not the VM images). Content checks, render and capture run anywhere.

Estimates with acceleration: restore 1–3 s, a typical section 10–30 s, a package install from the
local mirror 10–20 s, a reboot ~10 s. First full build (bases + mirror + all 67 sections) about
30–45 min, then 10–20 min for a full chain, and well under a minute to rerun one edited section.

## Frames

- **Console frame** (graphl-flow `console-frame` study): a fixed 80 × 43 console on the left and the
  picture of what it just showed on the right. Both columns are fixed (`SAME_FIT`), so every frame
  lands on the same zoom. No edges between the columns: `focus` highlights a console line.
- **Tty frame**: `top`, `less`, `man`, `vim` take the console's slot at the same size.
- **Config frame**: a unit file, nginx site or `nftables.conf` as a `code` node (`ini`, `nginx`,
  `nft`), copied from the VM.
- **◆ full scene**: a canonical big picture (the filesystem tree, file descriptors, fork/exec, boot,
  a request's whole path) with the real output inside it, as its own section. The rule is the same as
  the expense tracker's: if it cannot fit the side at ≥ 24px body text in the 4K frame, it is a full scene.

## The courses — 11 courses, 67 sections

Branch sections (run, then discarded) are marked ⑂.

**1. `intro` · Linux, and what we'll build · 2**

| # | Section | Picture |
| --- | --- | --- |
| 1 | What Linux is: kernel and distribution | distro → kernel → machine; `uname -r` and `os-release` |
| 2 | What we'll build | the map: ops → SSH → web-01 → HTTPS, then the same on web-02; the finished `curl` |

**2. `shell` · Find your way around · 7**

| # | Section | Picture |
| --- | --- | --- |
| 1 | SSH in; the prompt read | prompt anatomy: user@host:cwd `$` vs `#` |
| 2 | Commands, options, arguments | one command line taken apart |
| 3 | `man` and `--help` (tty) | a man page's sections |
| 4 | ◆ full scene: the filesystem tree | `/etc /var /usr /home /srv /proc`, the real `ls /` |
| 5 | Paths: absolute, relative, `~`, `..` | the tree with cwd marked, two routes to one file |
| 6 | Create, copy, move, remove | `site/` after each command; `mv`/`cp` replace silently unless `-i`; `rm -r` has no undo |
| 7 | Reading files: `cat`, `less`, `head`, `tail` | which tool for which file; one `/etc/passwd` line read field by field (`tail -f` waits for course 7, the first log that grows) |

**3. `packages` · Installing software · 4**

| # | Section | Picture |
| --- | --- | --- |
| 1 | What a package manager does | repo → signed index → package → files |
| 2 | `apt install nginx` | the install's dependency tree; the welcome page answers `curl` |
| 3 | What it put where (`dpkg -L`) | the files laid out in the tree |
| 4 | Updates and upgrades | versions before/after |

Moved before `text` (2026-10-30): the text course needs a log a real program writes, and nginx's
access log is the one the rest of the course keeps reading.

**4. `text` · Text is the interface · 7**

| # | Section | Picture |
| --- | --- | --- |
| 1 | ◆ full scene: stdin, stdout, stderr | fd 0/1/2 → terminal; redirection rewires them |
| 2 | Pipes | `grep … /var/log/nginx/access.log \| wc -l` as stages |
| 3 | `grep` and regular expressions | the pattern taken apart, matches lit |
| 4 | `cut`, `sort`, `uniq -c`: top clients in the access log | rows → buckets → ranking table |
| 5 | `find` | the search on the tree, matches lit |
| 6 | Quoting, globbing, expansion order | the shell's expansions before `exec` |
| 7 | Editing a file: nano, then vim (tty) | vim's modes as states |

**5. `users` · Who can do what · 6**

| # | Section | Picture |
| --- | --- | --- |
| 1 | Users and groups: `/etc/passwd`, `id` | user → groups table; the `sysops` group |
| 2 | Permissions: `rwx` read | `-rw-r--r--` as three triplets |
| 3 | `chmod`, `chown`, octal | bits → number |
| 4 | Directories: what `x` means | the path walk, a check at each directory |
| 5 | `sudo` and root | who runs what; `/etc/sudoers.d/sysops` |
| 6 | The team's `/srv/sysops.example`: the `site` group, setgid, umask; the `deploy` account | a new file's owner and mode, before/after; new groups need a new login |

**6. `processes` · What's running · 7**

| # | Section | Picture |
| --- | --- | --- |
| 1 | ◆ full scene: fork and exec | the shell forking `ls`; the real `ps --forest` |
| 2 | `ps` and the process tree | systemd → sshd → bash → ps |
| 3 | `top` (tty) | the header lines explained |
| 4 | Signals: `kill`, `TERM` vs `KILL` | the signal's path to the process |
| 5 | Jobs: `&`, `fg`, `bg`, `Ctrl-Z` | job states |
| 6 | Environment and `PATH` | the lookup for one command name |
| 7 | `/proc` | a process as files |

**7. `services` · Keep it running · 7**

| # | Section | Picture |
| --- | --- | --- |
| 1 | ◆ full scene: boot to login (real reboot) | firmware → kernel → systemd → targets → units |
| 2 | `systemctl status / start / enable` | unit states |
| 3 | The site config (`nginx`) | server block → root → file on disk |
| 4 | `nginx -t`, reload vs restart | the two paths; why `-t` comes first |
| 5 | `journalctl` | sources → journal → a query |
| 6 | Our own unit: `report.service` (`ini`) | the unit's sections → what systemd does |
| 7 | Timers, not cron | timer → service → schedule |

**8. `network` · Reach it · 8**

| # | Section | Picture |
| --- | --- | --- |
| 1 | Interfaces and addresses: `ip a` | NIC → address → route |
| 2 | Ports and sockets: `ss -tlnp` | listening sockets → process |
| 3 | Names: `/etc/hosts`, `dig` | the resolution order |
| 4 | `curl` the site | request → response, headers read |
| 5 | SSH keys; passwords off | key pair → `authorized_keys`; keep a second session open |
| 6 | The firewall: nftables (`nft`); ⑂ the lock-out | a packet against the rules, one path lit |
| 7 | HTTPS with certbot | ACME exchange → cert files → nginx |
| 8 | ◆ full scene: a request's whole path | DNS → TCP → firewall → nginx → file → back |

**9. `storage` · Disks and space · 6**

| # | Section | Picture |
| --- | --- | --- |
| 1 | Disks, partitions, filesystems: `lsblk` | device tree |
| 2 | Mounting and `fstab`; ⑂ the typo that stops the boot | the tree with a mount grafted on |
| 3 | ⑂ The disk-full incident: `df`, `du` | the top directories |
| 4 | Log rotation | a log file's lifecycle |
| 5 | Hard and symbolic links; inodes | names → inode → blocks |
| 6 | Backups: `tar` and `rsync` | source → archive, what each copies |

**10. `scripting` · Automate it · 6**

| # | Section | Picture |
| --- | --- | --- |
| 1 | A script: shebang, `chmod +x`, exit codes | exit code → `&&` / `\|\|` |
| 2 | Variables, quoting, arguments | `$1` `"$@"` expanded |
| 3 | `if`, `for`, `case` | flow chart, one path lit |
| 4 | `set -euo pipefail` | the same failure with and without it |
| 5 | The team's deploy script, run as `deploy` | its steps as a pipeline |
| 6 | Run it on a timer; `shellcheck` | the findings table |

**11. `rhel` · The other family: Rocky Linux · 7**

`web-01` is shut down and `web-02` starts its own chain from the Rocky base image (still one VM).

| # | Section | Picture |
| --- | --- | --- |
| 1 | `web-02`: the same site on Rocky | Debian ↔ Rocky: paths and tools |
| 2 | `dnf` | apt ↔ dnf side by side; the install |
| 3 | firewalld | zones → services → the nftables it generates |
| 4 | ⑂ The 403 | the symptoms; `rwx` says allowed |
| 5 | SELinux: labels | two checks, both must pass |
| 6 | `restorecon` and `semanage fcontext` (replays the 403 and the fix) | the label before/after; why `mv` kept the wrong label |
| 7 | One site, two families | the map, every stage lit; the same checks on Debian (course 10's end) and on Rocky |

The final narration closes the film with what the team built. It does not claim the viewer is now
an administrator.

## Checks, before handing over

```sh
npm run build && npx tsc --noEmit && npm run check   # check-content + check-render (4K)
npm run check:spine                                  # nothing stale; transcripts match (volatile masked)
npm run shots -- <course>                            # then LOOK
```

## Decided (2026-10-30)

- **x86_64** for the whole film.
- **One vim section** (4.7).
- **One VM at a time**; `ops` is a namespace on the host, the lab services are host processes.
- **Rocky is the final course**; repo `schemabotview/linux-admin`.
