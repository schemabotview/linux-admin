import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode } from '../frame'
import { read, rowOf } from '../lab'
import s1 from '../../../spine/intro/01-kernel-and-distro/session.txt?raw'

// Course 1 — Linux, and what we'll build.

// 1.1: one machine, two names. os-release names the DISTRIBUTION, uname the KERNEL; every value in the
// picture is read from the transcript.
const distro = read(s1, /PRETTY_NAME="([^"]+)"/)
const kernel = read(s1, /uname -r\n(\S+)/)
const arch = read(s1, /uname -m\n(\S+)/)
const kernelAndDistro: SceneModel = consoleFrame(
  consoleNode('sysops@web-01: ~', s1, { highlight: [rowOf(s1, 'PRETTY_NAME'), rowOf(s1, kernel), rowOf(s1, arch)] }),
  [
    { type: 'group', id: 'layers', title: 'One machine, two names', icon: 'linux', tone: 'ingest', children: [
      { type: 'item', id: 'distro', icon: 'debian', title: distro, sub: 'the distribution: packages, defaults, tools, the way it is run — /etc/os-release' },
      { type: 'item', id: 'kernel', icon: 'linux', title: `Linux ${kernel.split('+')[0]}`, sub: 'the kernel: processes, memory, files, devices, the network — uname -r', tone: 'infra' },
      { type: 'item', id: 'hw', icon: 'cpu', title: `The machine: ${arch}`, sub: 'a virtual machine, 2 CPUs and 2 GiB — uname -m', tone: 'neutral' },
    ] },
    { type: 'table', id: 'source', title: 'Where each answer comes from', tone: 'infra', fill: true, columns: ['asked', 'reads', 'answer'], rows: [
      { id: 'osr', cells: ['cat /etc/os-release', 'a file the distribution ships', distro], tone: 'ingest' },
      { id: 'unr', cells: ['uname -r', 'the running kernel’s release', kernel], tone: 'infra' },
      { id: 'unm', cells: ['uname -m', 'the hardware the kernel runs on', arch] },
    ] },
    { type: 'table', id: 'family', title: 'The same kernel, different distributions', tone: 'ingest', fill: true, columns: ['family', 'distributions', 'in this course'], rows: [
      { id: 'deb', cells: ['Debian', 'Debian, Ubuntu', 'web-01, courses 1–10'], tone: 'ingest' },
      { id: 'rh', cells: ['Red Hat', 'RHEL, Rocky, AlmaLinux, Fedora', 'web-02, course 11'] },
    ] },
  ],
  [{ from: 'distro', to: 'kernel', label: 'system calls' }, { from: 'kernel', to: 'hw' }],
)

// 1.2: the map of the whole course. Nothing to run yet: the finished `curl` joins this frame when
// the network course has produced it (LINUX-COURSE-PLAN.md, "Packaging").
const whatWeBuild: SceneModel = {
  title: "What we'll build",
  sub: 'the Sysops team serves sysops.example: one server, built course by course',
  dir: 'row',
  nodes: [
    { type: 'group', id: 'team', title: 'The Sysops team', icon: 'users', tone: 'source', children: [
      { type: 'item', id: 'ops', title: 'ops', sub: 'the team’s workstation', icon: 'laptop', stack: true },
    ] },
    { type: 'group', id: 'web01', title: 'web-01', sub: 'Debian 13', icon: 'debian', tone: 'ingest', dir: 'grid', cols: 2, children: [
      { type: 'item', id: 'c2', title: 'the shell', sub: '2 · find your way', icon: 'terminal', chip: true },
      { type: 'item', id: 'c3', title: 'packages', sub: '3 · apt, nginx', icon: 'package', chip: true },
      { type: 'item', id: 'c4', title: 'text tools', sub: '4 · pipes, grep', icon: 'filter', chip: true },
      { type: 'item', id: 'c5', title: 'users', sub: '5 · permissions, sudo', icon: 'user', chip: true },
      { type: 'item', id: 'c6', title: 'processes', sub: '6 · ps, top, signals', icon: 'cpu', chip: true },
      { type: 'item', id: 'c7', title: 'services', sub: '7 · systemd, logs', icon: 'settings', chip: true },
      { type: 'item', id: 'c8', title: 'network', sub: '8 · firewall, HTTPS', icon: 'firewall', chip: true },
      { type: 'item', id: 'c9', title: 'storage', sub: '9 · disks, backups', icon: 'disk', chip: true },
      { type: 'item', id: 'c10', title: 'scripts', sub: '10 · automate it', icon: 'code', chip: true, span: 'all' },
    ] },
    { type: 'group', id: 'out', bare: true, children: [
      { type: 'item', id: 'site', title: 'https://sysops.example', sub: 'the site, served by nginx', icon: 'globe', tone: 'store', stack: true },
      { type: 'item', id: 'web02', title: 'web-02', sub: '11 · the same job on Rocky Linux', icon: 'rocky', muted: true, stack: true },
    ] },
  ],
  edges: [{ from: 'ops', to: 'web01', label: 'ssh' }, { from: 'web01', to: 'site', label: 'https' }],
}

export const introScenes: Record<string, SceneModel> = {
  'intro-kernel-and-distro': kernelAndDistro,
  'intro-what-we-will-build': whatWeBuild,
}
