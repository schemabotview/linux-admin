import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/packages/01-what-a-package-manager-does/session.txt?raw'
import s2 from '../../../spine/packages/02-apt-install-nginx/session.txt?raw'
import s3 from '../../../spine/packages/03-what-it-put-where/session.txt?raw'
import s4 from '../../../spine/packages/04-updates-and-upgrades/session.txt?raw'

// Course 3 — Installing software. Moved before the text course (LINUX-COURSE-PLAN.md): nginx's access
// log is what the text tools read.
const WEB = 'sysops@web-01: ~'

// The version table `apt-cache policy` prints: `[***] <version> <priority>` then `<priority> <source>` rows.
function versions(policy: string) {
  const rows: { version: string; installed: boolean; from: string }[] = []
  const lines = policy.split('\n')
  lines.forEach((l, i) => {
    const m = l.match(/^ (\*\*\*| {3}) (\S+) (\d+)$/)
    if (m) rows.push({ version: m[2], installed: m[1] === '***', from: (lines[i + 1] + lines[i + 2]).includes('debian-security') ? 'trixie-security' : 'trixie (the release)' })
  })
  if (!rows.length) throw new Error('apt-cache policy printed no version table')
  return rows
}

// 3.1 — where packages come from. The Get rows of `apt update` fold; the sources file and the policy stay.
const managerDoes = consoleFrame(
  consoleNode(WEB, s1, {
    show: [[1, rowOf(s1, '$ sudo apt update') + 1], [rowOf(s1, 'Fetched'), s1.trimEnd().split('\n').length]],
    highlight: [rowOf(s1, 'URIs:'), rowOf(s1, 'Candidate:')],
  }),
  [
    { type: 'group', id: 'flow', title: 'From the archive to the disk', icon: 'package', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'archive', title: 'the archive', sub: 'snapshot.debian.org, frozen at 2026-10-26', icon: 'globe', stack: true },
      { type: 'item', id: 'index', title: 'apt update', sub: `the index: ${read(s1, /Fetched (\S+ \S+)/)} of package lists`, icon: 'database', stack: true },
      { type: 'item', id: 'apt', title: 'apt install', sub: 'picks a version and its dependencies', icon: 'workflow', stack: true },
      { type: 'item', id: 'dpkg', title: 'dpkg', sub: 'unpacks the files, runs the setup', icon: 'disk', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'source', title: '/etc/apt/sources.list.d/debian.sources, read', tone: 'ingest', fill: true, columns: ['line', 'says'], rows: [
      ['Types: deb', 'binary packages (not source code)'],
      ['URIs:', 'where the archive is'],
      ['Suites:', `which release: ${read(s1, /Suites: ([^\n]+)/)}`],
      ['Components: main', 'the free software Debian supports'],
      ['Signed-By:', 'the key that proves the lists are Debian’s'],
    ] },
  ],
  [{ from: 'archive', to: 'index' }, { from: 'index', to: 'apt' }, { from: 'apt', to: 'dpkg' }],
)

// 3.2 — the install. The download and unpack rows fold; the plan, the question and the result stay.
const installNginx = consoleFrame(
  consoleNode(WEB, s2, {
    show: [[1, rowOf(s2, 'Continue?')], [rowOf(s2, 'Created symlink'), rowOf(s2, 'Created symlink') + 1],
      [rowOf(s2, '$ curl -sI'), rowOf(s2, 'Server:')], [rowOf(s2, 'Content-Type'), rowOf(s2, 'Content-Length')], [s2.trimEnd().split('\n').length, s2.trimEnd().split('\n').length]],
    highlight: [rowOf(s2, 'Continue?'), rowOf(s2, 'HTTP/1.1')],
  }),
  [
    { type: 'group', id: 'deps', title: 'What apt decided to install', icon: 'package', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'nginx', title: 'nginx', sub: 'asked for: the program', icon: 'nginx', stack: true },
      { type: 'item', id: 'common', title: 'nginx-common', sub: 'a dependency: its settings and service', icon: 'package', stack: true },
      { type: 'item', id: 'suggest', title: read(s2, /Suggested packages:\n\s+([^\n]+)/).trim().split(/\s+/).join(', '), sub: 'suggested: not installed', icon: 'package', stack: true, muted: true },
    ] },
    { type: 'table', id: 'summary', title: 'The plan, before the question', tone: 'infra', fill: true, columns: ['', ''], rows: [
      ['installing', read(s2, /Installing: (\d+)/) + ' packages'],
      ['download', read(s2, /Download size: ([^\n]+)/)],
      ['space on disk', read(s2, /Space needed: (\S+ \S+)/)],
      ['asked', 'Continue? [Y/n] — Enter alone means Y'],
    ] },
  ],
  [{ from: 'nginx', to: 'common', label: 'depends on' }],
)

// 3.3 — what the two packages put where, and the service they left running.
const program = outputOf(s3, 'dpkg -L nginx').split('\n').filter((l) => /^\/usr\/(sbin|share\/man)\/.+[^/]$/.test(l) && !l.endsWith('man8'))
const logs = outputOf(s3, 'ls -l /var/log/nginx').split('\n').filter((l) => l.startsWith('-')).map((l) => l.trim().split(/\s+/))
const conf = read(s3, /nginx-common: (\S+)/)
const putWhere = consoleFrame(
  consoleNode(WEB, s3, {
    // dpkg -L's bare directory rows fold; the program, the docs and the manual page stay
    show: [[1, 1], [rowOf(s3, '/usr/sbin/nginx'), rowOf(s3, '/usr/sbin/nginx')], [rowOf(s3, 'changelog.Debian.gz'), rowOf(s3, '/copyright')], [rowOf(s3, 'nginx.8.gz'), s3.trimEnd().split('\n').length]],
    highlight: [rowOf(s3, '/usr/sbin/nginx'), rowOf(s3, 'nginx-common: /etc/nginx/nginx.conf')],
  }),
  [
    { type: 'group', id: 'places', title: 'Each kind of file in its place', icon: 'folder', tone: 'ingest', dir: 'row', children: [
      // ls -F marks a directory with / — the terminal says which is which, not a guess from the name
      { type: 'tree', id: 'etc', title: '/etc/nginx (ls -F)', entries: outputOf(s3, 'ls -F /etc/nginx').trim().split(/\s+/).sort()
        .map((n) => (n.endsWith('/') ? { name: n.slice(0, -1), folder: true, state: n.startsWith('sites') ? 'active' as const : 'muted' as const } : { name: n, state: n === 'nginx.conf' ? 'active' as const : 'muted' as const })) },
      { type: 'table', id: 'data', title: '/var/log/nginx (ls -l)', tone: 'store', fill: true, columns: ['log', 'owner', 'mode'], rows: logs.map((f) => [f[8], `${f[2]}:${f[3]}`, f[0]]) },
    ] },
    { type: 'table', id: 'owner', title: 'Which package put which file (dpkg)', tone: 'ingest', fill: true, columns: ['file', 'package'], rows: [
      ...program.map((f) => [f, 'nginx']),
      { id: 'conf', cells: [conf, 'nginx-common'], tone: 'store' },
    ] },
  ],
)

// 3.4 — installed vs candidate; update vs upgrade; manual vs automatic.
// the *** row is the installed version; apt-cache says it is also the candidate
const installed = versions(outputOf(s4, 'apt-cache policy nginx')).find((v) => v.installed)!
if (read(s4, /Candidate: (\S+)/) !== installed.version) throw new Error('3.4: the installed nginx is not the candidate')
const manual = outputOf(s4, 'apt-mark showmanual nginx nginx-common').trim().split(/\s+/)
const updates = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, 'Installed:'), rowOf(s4, ' *** '), rowOf(s4, 'Upgrading: 0')] }),
  [
    { type: 'group', id: 'verbs', title: 'Three verbs that sound alike', icon: 'package', tone: 'ingest', children: [
      { type: 'item', id: 'update', title: 'apt update', sub: 'refreshes the lists of what exists; installs nothing', icon: 'database' },
      { type: 'item', id: 'upgrade', title: `apt upgrade — ${read(s4, /(Upgrading: \d+)/)}`, sub: `moves installed packages to their candidates; nginx ${installed.version} already is one`, icon: 'workflow', tone: 'store' },
      { type: 'item', id: 'install', title: 'apt install x', sub: 'adds x, and whatever x needs', icon: 'package' },
    ] },
    { type: 'table', id: 'marks', title: 'apt-mark showmanual nginx nginx-common', tone: 'infra', fill: true, columns: ['package', 'installed', 'autoremove'], rows: ['nginx', 'nginx-common'].map((p) =>
      manual.includes(p) ? [p, 'manually', 'never'] : [p, 'as a dependency', 'once unneeded']) },
  ],
  [{ from: 'update', to: 'upgrade' }],
)

export const packagesScenes: Record<string, SceneModel> = {
  'packages-manager': managerDoes,
  'packages-install': installNginx,
  'packages-where': putWhere,
  'packages-updates': updates,
}
