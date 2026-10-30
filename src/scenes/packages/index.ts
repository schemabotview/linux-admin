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
const policy1 = versions(outputOf(s1, 'apt-cache policy nginx'))
const managerDoes = consoleFrame(
  consoleNode(WEB, s1, {
    show: [[1, rowOf(s1, 'Get:2') - 1], [rowOf(s1, 'Fetched'), s1.trimEnd().split('\n').length]],
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
    { type: 'table', id: 'policy', title: 'apt-cache policy nginx: two versions on offer', tone: 'store', fill: true, columns: ['version', 'from', ''], rows:
      policy1.map((v) => ({ id: v.version, cells: [v.version, v.from, v.version === read(s1, /Candidate: (\S+)/) ? 'the candidate: newest' : ''], tone: v.version === read(s1, /Candidate: (\S+)/) ? 'store' as const : undefined })) },
  ],
  [{ from: 'archive', to: 'index' }, { from: 'index', to: 'apt' }, { from: 'apt', to: 'dpkg' }],
)

// 3.2 — the install. The download and unpack rows fold; the plan, the question and the result stay.
const header = (name: string) => read(s2, new RegExp(`^${name}: ([^\\n]+)$`, 'm'))
const installNginx = consoleFrame(
  consoleNode(WEB, s2, {
    show: [[1, rowOf(s2, 'Continue?')], [rowOf(s2, 'Created symlink'), s2.trimEnd().split('\n').length]],
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
    { type: 'table', id: 'answer', title: 'curl -sI localhost: nginx is already serving', tone: 'store', fill: true, columns: ['header', 'value'], rows: [
      { id: 'status', cells: ['status', read(s2, /HTTP\/1\.1 ([^\n]+)/)], tone: 'store' },
      ['Server', header('Server')],
      ['Content-Type', header('Content-Type')],
      ['Content-Length', `${header('Content-Length')} bytes: the welcome page`],
    ] },
  ],
  [{ from: 'nginx', to: 'common', label: 'depends on' }],
)

// 3.3 — what the two packages put where, and the service they left running.
const program = outputOf(s3, 'dpkg -L nginx').split('\n').filter((l) => /^\/usr\/(sbin|share\/man)\/.+[^/]$/.test(l) && !l.endsWith('man8'))
const logs = outputOf(s3, 'ls -l /var/log/nginx').split('\n').filter((l) => l.startsWith('-')).map((l) => l.trim().split(/\s+/))
const putWhere = consoleFrame(
  consoleNode(WEB, s3, { highlight: [rowOf(s3, '/usr/sbin/nginx'), rowOf(s3, 'nginx-common: /etc/nginx/nginx.conf')] }),
  [
    { type: 'table', id: 'owner', title: 'Which package put which file', tone: 'ingest', fill: true, columns: ['file', 'package', 'is'], rows: [
      ...program.map((f) => [f, 'nginx', f.includes('/sbin/') ? 'the program' : 'its manual page']),
      [read(s3, /nginx-common: (\S+)/), 'nginx-common', 'its main settings'],
    ] },
    { type: 'group', id: 'places', bare: true, dir: 'row', children: [
      // ls -F marks a directory with / — the terminal says which is which, not a guess from the name
      { type: 'tree', id: 'etc', title: '/etc/nginx (ls -F)', entries: outputOf(s3, 'ls -F /etc/nginx').trim().split(/\s+/).sort()
        .map((n) => (n.endsWith('/') ? { name: n.slice(0, -1), folder: true, state: n.startsWith('sites') ? 'active' as const : 'muted' as const } : { name: n, state: n === 'nginx.conf' ? 'active' as const : 'muted' as const })) },
      { type: 'table', id: 'data', title: 'Its data and its logs', tone: 'store', fill: true, columns: ['file', 'owner', 'mode'], rows: [
        [`/var/www/html/${outputOf(s3, 'ls /var/www/html').trim()}`, 'root', 'the page curl got'],
        ...logs.map((f) => [`/var/log/nginx/${f[8]}`, `${f[2]}:${f[3]}`, f[0]]),
      ] },
    ] },
    { type: 'table', id: 'svc', title: 'And it is running', tone: 'serve', fill: true, columns: ['asked', 'answer', 'means'], rows: [
      ['systemctl is-active nginx', read(s3, /is-active nginx\n(\S+)/), 'running now'],
      ['systemctl is-enabled nginx', read(s3, /is-enabled nginx\n(\S+)/), 'starts at every boot — course 7'],
    ] },
  ],
)

// 3.4 — installed vs candidate; update vs upgrade; manual vs automatic.
const policy4 = versions(outputOf(s4, 'apt-cache policy nginx'))
const manual = outputOf(s4, 'apt-mark showmanual nginx nginx-common').trim().split(/\s+/)
const updates = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, 'Installed:'), rowOf(s4, ' *** '), rowOf(s4, 'Upgrading: 0')] }),
  [
    { type: 'table', id: 'policy', title: 'apt-cache policy nginx, after the install', tone: 'store', fill: true, columns: ['version', 'from', 'state'], rows:
      policy4.map((v) => ({ id: v.version, cells: [v.version, v.from, v.installed ? '*** installed' : 'older'], tone: v.installed ? 'store' as const : undefined })) },
    { type: 'table', id: 'verbs', title: 'Three verbs that sound alike', tone: 'ingest', fill: true, columns: ['command', 'changes', 'here'], rows: [
      ['apt update', 'only the lists of what exists', 'run in 3.1'],
      ['apt upgrade', 'installed packages, to their candidates', read(s4, /(Upgrading: \d+)/)],
      ['apt install x', 'adds x and what x needs', 'run in 3.2'],
    ] },
    { type: 'table', id: 'marks', title: 'apt-mark showmanual nginx nginx-common', tone: 'infra', fill: true, columns: ['package', 'installed', 'removed with apt autoremove'], rows: ['nginx', 'nginx-common'].map((p) =>
      manual.includes(p) ? [p, 'manually: you asked', 'never'] : [p, 'automatically: a dependency', 'once nothing needs it']) },
    { type: 'note', id: 'note', tone: 'infra', text: 'This archive is frozen, so nothing is ever upgradable here — and this lab turned automatic updates off so nothing changes during a recording. A real server runs apt update and apt upgrade regularly, or leaves it to unattended-upgrades.' },
  ],
)

export const packagesScenes: Record<string, SceneModel> = {
  'packages-manager': managerDoes,
  'packages-install': installNginx,
  'packages-where': putWhere,
  'packages-updates': updates,
}
