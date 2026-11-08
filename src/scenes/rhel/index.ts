import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/rhel/01-web-02/session.txt?raw'
import s2 from '../../../spine/rhel/02-dnf/session.txt?raw'
import s3a from '../../../spine/rhel/03-install-firewalld/session.txt?raw'
import s3 from '../../../spine/rhel/04-firewalld-zones/session.txt?raw'
import s4 from '../../../spine/rhel/05-the-403/session.txt?raw'
import s5 from '../../../spine/rhel/06-selinux-labels/session.txt?raw'
import s6 from '../../../spine/rhel/07-restorecon-and-semanage/session.txt?raw'
import s7 from '../../../spine/rhel/08-one-site-two-families/session.txt?raw'
import d1 from '../../../spine/intro/01-kernel-and-distro/session.txt?raw'
import d3 from '../../../spine/packages/02-apt-install-nginx/session.txt?raw'
import d8 from '../../../spine/network/06-the-firewall/session.txt?raw'

// Course 11 — The other family: web-02, Rocky Linux 10.2 (lab/vm.py HOSTS). Red Hat's prompt is
// [user@host dir]$; every Debian value compared here is read from web-01's own transcripts.
const WEB2 = 'sysops@web-02: ~'
const rows = (s: string) => s.trimEnd().split('\n').length

// 11.1 — the other family.
const os = (s: string, key: string) => read(s, new RegExp(`^${key}="([^"]+)"`, 'm'))
const first = consoleFrame(
  consoleNode('sysops@ops: ~', s1, { highlight: [rowOf(s1, '[sysops@web-02 ~]$ id') + 1, rowOf(s1, 'cannot access')] }),
  [
    { type: 'group', id: 'same', title: 'Same job, two families', icon: 'linux', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'w1', title: 'web-01', sub: `${read(d1, /PRETTY_NAME="([^"]+)"/)}; kernel ${read(d1, /uname -r\n(\S+)/).split('+')[0]}; sudo by a sudoers rule`, icon: 'debian', stack: true },
      { type: 'item', id: 'w2', title: 'web-02', sub: `${os(s1, 'NAME')} ${os(s1, 'VERSION')}; kernel ${read(s1, /uname -r\n(\S+)/).split('-')[0]}; sudo by the ${read(s1, /groups=\S*\d+\((wheel)\)/)} group; an SELinux context in id`, icon: 'rocky', stack: true, tone: 'infra' },
    ] },
    { type: 'table', id: 'map', title: 'The names that change', tone: 'infra', fill: true, columns: ['', 'Debian', 'Rocky'], rows: [
      ['packages', 'apt, dpkg', 'dnf, rpm'],
      ['nginx sites', 'sites-enabled', 'conf.d'],
      ['web root', '/var/www/html', '/usr/share/nginx…'],
      ['firewall', 'nft by hand', 'firewalld'],
      ['extra guard', 'AppArmor', 'SELinux'],
    ] },
  ],
)

// 11.2 — dnf.
const repos = outputOf(s2, 'dnf repolist').trim().split('\n').slice(1).map((l) => l.trim().split(/\s{2,}/))
const pkgs = [...s2.matchAll(/^ (\S+)\s+(x86_64|noarch)\s+(\S+)\s+(\w+)\s+[\d.]+ [kM]$/gm)].map((m) => [m[1], m[3], m[4]])
const dnf = consoleFrame(
  consoleNode(WEB2, s2, {
    // the metadata transfers, the download and transaction rows fold; repolist, the plan and the result stay
    show: [[1, rowOf(s2, '$ dnf info nginx')], [rowOf(s2, 'Name         : nginx'), rowOf(s2, '$ sudo dnf install')], [rowOf(s2, 'Installing:'), rowOf(s2, 'rocky-logos-httpd ')],
      [rowOf(s2, '$ rpm -ql'), rowOf(s2, '$ rpm -ql') + 1], [rowOf(s2, 'is-enabled nginx'), rows(s2)]],
    highlight: [rowOf(s2, 'Installing:'), rowOf(s2, 'is-enabled nginx') + 1],
  }),
  [
    { type: 'group', id: 'plan', title: `dnf install nginx: from ${repos.map((r) => r[0]).join(', ')}`, icon: 'package', tone: 'ingest', children: pkgs.map((p, i) => (
      { type: 'item' as const, id: `p${i}`, title: p[0], sub: `${i ? 'a dependency' : 'asked for'}: version ${p[1]}, from ${p[2]}`, icon: 'package', tone: i ? undefined : 'store' as const })) },
    { type: 'table', id: 'diff', title: 'The difference that bites', tone: 'consume', fill: true, columns: ['after installing nginx', 'Debian', 'Rocky'], rows: [
      ['enabled at boot?', 'yes', read(s2, /is-enabled nginx\n(\w+)/)],
      ['running?', 'yes', 'no: enable --now'],
      ['Server header', read(d3, /^Server: (\S+)/m), read(s2, /^Server: (\S+)/m)],
    ] },
  ],
)

// 11.3 — firewalld: installed in its own step (3a: it pulls a new kernel, the slowest step in the lab),
// then enabled and opened (3b, the console here).
const codes = [...(s3a + '\n' + s3).matchAll(/http:\/\/web-02\/\n(?:curl: [^\n]+\n)?(\d{3})\n/g)].map((m) => m[1])
const services = [...s3.matchAll(/--list-services\n([^\n]+)/g)].map((m) => m[1].trim())
const firewalld = consoleFrame(
  consoleNode(WEB2, s3, {
    // the logouts and logins between the curls, and the sudo prompts, fold
    show: [[1, rowOf(s3, '--list-services')+ 1], [rowOf(s3, 'sysops@ops:~$ curl'), rowOf(s3, 'sysops@ops:~$ ssh web-02')], [rowOf(s3, '--permanent'), rowOf(s3, '--permanent') + 1],
      [rowOf(s3, '--reload'), rowOf(s3, 'tcp dport 443')], [rowOf(s3, 'sysops@ops:~$ curl', 2), rows(s3)]],
    highlight: [rowOf(s3, 'curl: ('), rowOf(s3, 'dport')],
  }),
  [
    { type: 'group', id: 'steps', title: 'curl http://web-02/ from ops, three times', icon: 'firewall', tone: 'ingest', children: [
      { type: 'item', id: 'c0', title: `${codes[0]}: no firewall at all`, sub: 'the cloud image runs none', icon: 'globe' },
      { type: 'item', id: 'c1', title: `${codes[1]}: firewalld on, zone ${read(s3, /\n(\S+) \(default\)/)}`, sub: `curl (${read(s3, /\ncurl: \((\d+)\)/)}): timed out — allowed: ${services[0]}`, icon: 'firewall', tone: 'consume' },
      { type: 'item', id: 'c2', title: `${codes[2]}: http, https added`, sub: `--permanent, then --reload: ${services[1]}`, icon: 'check', tone: 'store' },
    ] },
    { type: 'table', id: 'install', title: 'dnf install firewalld: the plan’s surprise', tone: 'infra', fill: true, columns: ['package', 'why'], rows: [
      ['firewalld', 'asked for'],
      { id: 'k', cells: [`kernel-core ${read(s3a, /^ kernel-core\s+x86_64\s+(\S+)/m).split('.el')[0]}`, 'a kernel with its modules'], tone: 'infra' },
      ['kernel-modules-extra', 'the nftables modules'],
      [`running: ${read(s1, /uname -r\n(\S+)/).split('.el')[0]}`, 'until the next reboot'],
    ] },
  ],
  [{ from: 'c0', to: 'c1' }, { from: 'c1', to: 'c2' }],
)

// 11.4 — the 403.
const code403 = read(s4, /localhost\n(\d{3})\n/)
const namei = outputOf(s4, 'namei -l /srv/sysops.example/index.html').trim().split('\n').slice(1).map((l) => l.trim().split(/\s+/))
const the403 = consoleFrame(
  consoleNode(WEB2, s4, { highlight: [rowOf(s4, '403'), rowOf(s4, 'Permission denied')] }),
  [
    { type: 'group', id: 'says', title: `curl says ${code403}; every classic check says yes`, icon: 'shield', tone: 'consume', children: [
      { type: 'item', id: 'rwx', title: 'rwx along the path: allowed', sub: 'namei -l: others may enter each directory and read the file', icon: 'lock', tone: 'store' },
      { type: 'item', id: 't', title: 'nginx -t: syntax is ok', sub: 'the server block in conf.d is valid', icon: 'nginx', tone: 'store' },
      { type: 'item', id: 'log', title: `error log: open() failed (${read(s4, /failed \((13: Permission denied)\)/)})`, sub: 'the KERNEL refused nginx: something other than rwx decided', icon: 'log', tone: 'consume' },
    ] },
    { type: 'table', id: 'walk', title: 'namei -l: the path, for nginx (others)', tone: 'store', fill: true, columns: ['mode', 'owner', 'name', 'others?'], rows: namei.map((n) => [n[0], n[1], n[3], n[0].slice(7, 10).includes(n[0].startsWith('d') ? 'x' : 'r') ? 'yes' : 'no']) },
  ],
)

// 11.5 — SELinux: labels.
const label = (s: string) => s.split(':')[2]
const fileLabel = read(s5, /\n(\S+) \/srv\/sysops\.example\/index\.html/)
const dirLabel = read(s5, /\n\s*(\S+) \/srv\/sysops\.example\n/)
const goodLabel = read(s5, /\n(\S+) \/usr\/share\/nginx\/html/)
const selinux = consoleFrame(
  consoleNode(WEB2, s5, { highlight: [rowOf(s5, 'user_home_t'), rowOf(s5, 'unsuccessfully')] }),
  [
    { type: 'group', id: 'check', title: 'Two checks, both must pass', icon: 'shield', tone: 'consume', children: [
      { type: 'item', id: 'dac', title: 'rwx: allowed', sub: 'the file is r-- for others: the first check passes', icon: 'lock', tone: 'store' },
      { type: 'item', id: 'mac', title: `SELinux: ${read(s5, /getenforce\n(\w+)/)}`, sub: `nginx runs as ${label(read(s5, /\n(\S+)\s+\d+ \?\s+[\d:]+ nginx/))}, which may not read ${label(fileLabel)}: denied`, icon: 'redhat', tone: 'consume' },
    ] },
    { type: 'table', id: 'labels', title: 'ls -Z: the type is what counts', tone: 'ingest', fill: true, columns: ['path', 'type'], rows: [
      { id: 'f', cells: ['…/index.html', `${label(fileLabel)}: no`], tone: 'consume' },
      { id: 'd', cells: ['/srv/sysops.example', `${label(dirLabel)}: no`], tone: 'consume' },
      { id: 'g', cells: ['/usr/share/nginx/html', `${label(goodLabel)}: yes`], tone: 'store' },
    ] },
  ],
  [{ from: 'dac', to: 'mac' }],
)

// 11.6 — the fix: a rule for the path, then the labels.
// restorecon's rows wrap mid-label: join each 80-wide row with the next, then read the types
const joinedRows = s6.split('\n').reduce<string[]>((acc, r) => {
  if (acc.length && acc[acc.length - 1].length === 80) acc[acc.length - 1] += r
  else acc.push(r)
  return acc
}, [])
const relabels = joinedRows.flatMap((l) => {
  const m = l.match(/^Relabeled (\S+) from \S+:(\w+_t):s0 to \S+:(\w+_t):s0$/)
  return m ? [[m[1], m[2], m[3]]] : []
})
if (relabels.length !== 2) throw new Error(`11.6: expected 2 relabels, read ${relabels.length}`)
const page = outputOf(s6, "curl -s -H 'Host: sysops.example' localhost").trim()
const fix = consoleFrame(
  consoleNode(WEB2, s6, { highlight: [rowOf(s6, 'Relabeled /srv/sysops.example/index.html'), rowOf(s6, page)] }),
  [
    { type: 'group', id: 'how', title: 'Fix the rule, then the labels', icon: 'shield', tone: 'store', children: [
      { type: 'item', id: 'rule', title: 'semanage fcontext -a', sub: '/srv/sysops.example(/.*)? is httpd_sys_content_t', icon: 'shield' },
      { type: 'item', id: 'apply', title: `restorecon -Rv: ${relabels.length} relabelled`, sub: relabels.map((r) => `${r[1]} → ${r[2]}`).join('; '), icon: 'settings' },
      { type: 'item', id: 'ok', title: `curl: ${page.replace(/<\/?h1>/g, '')}`, sub: 'the page, on web-02', icon: 'check', tone: 'store' },
    ] },
    { type: 'table', id: 'why', title: 'Why mv kept the wrong label', tone: 'consume', fill: true, columns: ['did', 'the label'], rows: [
      ['echo > ~/index.html', 'user_home_t: born at home'],
      ['mv into /srv/…', 'kept: same inode, same label'],
      ['cp would have', `taken ${relabels[0][1]}: wrong too`],
      { id: 'rc', cells: ['semanage + restorecon', 'from the rule: it lasts'], tone: 'store' },
    ] },
  ],
  [{ from: 'rule', to: 'apply' }, { from: 'apply', to: 'ok' }],
)

// 11.7 — one site, two families: the same checks on web-02 that course 10 ended with on web-01.
const enabled = outputOf(s7, 'systemctl is-enabled nginx firewalld').trim().split('\n')
const end = consoleFrame(
  consoleNode(WEB2, s7, { highlight: [rowOf(s7, 'PRETTY_NAME'), rowOf(s7, read(s7, /localhost\n([^\n]+)/))] }),
  [
    { type: 'group', id: 'lesson', title: 'What changed, and what did not', icon: 'linux', tone: 'store', dir: 'row', children: [
      { type: 'item', id: 'same', title: 'the same', sub: 'kernel, shell, files, users, processes, systemd, ssh, nginx', icon: 'check', stack: true, tone: 'store' },
      { type: 'item', id: 'diff', title: 'different', sub: 'package tools, defaults, the firewall’s front end, SELinux', icon: 'layers', stack: true, tone: 'infra' },
    ] },
    { type: 'table', id: 'both', title: 'The same checks, on both servers', tone: 'ingest', fill: true, columns: ['check', 'web-01', 'web-02'], rows: [
      ['system', `Debian ${read(d1, /VERSION_ID="([^"]+)"/)}`, read(s7, /PRETTY_NAME="([^"(]+?) \(/)],
      ['nginx', 'enabled', enabled[0]],
      ['firewall', `nft: ${read(d8, /tcp dport \{ ([^}]+) \}/).trim()}`, `firewalld: ${read(s7, /--list-services\n(?:\[sudo\][^\n]*\n)?([^\n]+)/).trim().split(/\s+/).filter((x) => x.startsWith('http')).join(', ')}`],
      ['the guard', 'AppArmor', `SELinux: ${read(s7, /getenforce\n(\w+)/)}`],
      ['the page', 'sysops.example', read(s7, /localhost\n([^\n]+)/).replace(/<\/?h1>/g, '').replace('sysops.example ', '… ')],
    ] },
  ],
)

export const rhelScenes: Record<string, SceneModel> = {
  'rhel-web-02': first,
  'rhel-dnf': dnf,
  'rhel-firewalld': firewalld,
  'rhel-403': the403,
  'rhel-selinux': selinux,
  'rhel-fix': fix,
  'rhel-end': end,
}
