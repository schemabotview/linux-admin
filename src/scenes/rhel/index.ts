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
import d87 from '../../../spine/network/08-https-with-certbot/session.txt?raw'
import d96 from '../../../spine/storage/07-backups/session.txt?raw'
import d105 from '../../../spine/scripting/05-the-deploy-script/session.txt?raw'
import d106 from '../../../spine/scripting/06-timer-and-shellcheck/session.txt?raw'

// Course 11 — The other family: web-02, Rocky Linux 10.2 (lab/vm.py HOSTS). Red Hat's prompt is
// [user@host dir]$; every Debian value compared here is read from web-01's own transcripts.
const WEB2 = 'sysops@web-02: ~'
const rows = (s: string) => s.trimEnd().split('\n').length

// 11.1 — the other family.
const os = (s: string, key: string) => read(s, new RegExp(`^${key}="([^"]+)"`, 'm'))
const first = consoleFrame(
  consoleNode('sysops@ops: ~', s1, { highlight: [rowOf(s1, '[sysops@web-02 ~]$ id') + 1, rowOf(s1, 'cannot access')] }),
  [
    { type: 'table', id: 'same', title: 'Same job, two families', tone: 'ingest', fill: true, columns: ['', 'web-01', 'web-02'], rows: [
      ['distribution', read(d1, /PRETTY_NAME="([^"]+)"/), `${os(s1, 'NAME')} ${os(s1, 'VERSION')}`],
      ['kernel', read(d1, /uname -r\n(\S+)/), read(s1, /uname -r\n(\S+)/)],
      ['prompt', 'sysops@web-01:~$', '[sysops@web-02 ~]$'],
      ['sudo through', 'a sudoers rule (5.5)', `the ${read(s1, /groups=\S*\d+\((wheel)\)/)} group`],
      ['security context', '—', 'SELinux: in id’s context= (11.5)'],
    ] },
    { type: 'table', id: 'id', title: 'id on web-02, read', tone: 'store', fill: true, columns: ['field', 'here'], rows: (() => {
      const line = outputOf(s1, 'id').replace(/\n/g, '')
      return [['uid, gid', `${read(line, /uid=(\S+)/)}, ${read(line, /gid=(\S+)/)}`], ['groups', read(line, /groups=(\S+)/)], ['context (SELinux)', read(line, /context=(\S+)/)]]
    })() },
    { type: 'table', id: 'map', title: 'Where things are — the names that change', tone: 'infra', fill: true, columns: ['', 'Debian', 'Rocky'], rows: [
      ['packages', 'apt, .deb, dpkg', 'dnf, .rpm, rpm'],
      ['nginx sites', 'sites-available + link', 'conf.d/*.conf'],
      ['default web root', '/var/www/html', '/usr/share/nginx/html'],
      ['firewall front end', 'nft rules by hand (8.6)', 'firewalld (11.3)'],
      ['mandatory access control', 'AppArmor', 'SELinux (11.4–11.6)'],
    ] },
  ],
)

// 11.2 — dnf.
const repos = outputOf(s2, 'dnf repolist').trim().split('\n').slice(1).map((l) => l.trim().split(/\s{2,}/))
const pkgs = [...s2.matchAll(/^ (\S+)\s+(x86_64|noarch)\s+(\S+)\s+(\w+)\s+[\d.]+ [kM]$/gm)].map((m) => [m[1], m[3], m[4]])
const dnf = consoleFrame(
  consoleNode(WEB2, s2, { show: [[1, rowOf(s2, 'Transaction Summary') - 1], [rowOf(s2, '$ rpm -ql'), rows(s2)]], highlight: [rowOf(s2, 'Installing:'), rowOf(s2, 'is-enabled nginx') + 1] }),
  [
    { type: 'table', id: 'repos', title: 'dnf repolist: where Rocky’s packages come from', tone: 'ingest', fill: true, columns: ['repo id', 'holds'], rows: repos.map((r) => [r[0], r[1]]) },
    { type: 'table', id: 'pkgs', title: 'dnf install nginx: the plan', tone: 'store', fill: true, columns: ['package', 'version', 'repo'], rows: pkgs },
    { type: 'table', id: 'diff', title: 'The difference that bites', tone: 'consume', fill: true, columns: ['after installing nginx', 'Debian', 'Rocky'], rows: [
      ['enabled at boot?', 'yes: apt’s postinst did it', read(s2, /is-enabled nginx\n(\w+)/)],
      ['running?', 'yes', 'no, until systemctl enable --now'],
      ['Server header', read(d3, /^Server: (\S+)/m), read(s2, /^Server: (\S+)/m)],
    ] },
  ],
)

// 11.3 — firewalld: installed in its own step (3a: it pulls a new kernel, the slowest step in the lab),
// then enabled and opened (3b, the console here).
const codes = [...(s3a + '\n' + s3).matchAll(/http:\/\/web-02\/\n(?:curl: [^\n]+\n)?(\d{3})\n/g)].map((m) => m[1])
const services = [...s3.matchAll(/--list-services\n([^\n]+)/g)].map((m) => m[1].trim())
const firewalld = consoleFrame(
  consoleNode(WEB2, s3, { highlight: [rowOf(s3, 'curl: ('), rowOf(s3, 'dport')] }),
  [
    { type: 'table', id: 'steps', title: 'curl http://web-02/ from ops, three times', tone: 'ingest', fill: true, columns: ['moment', 'answer'], rows: [
      ['no firewall at all (the cloud image)', codes[0]],
      { id: 'closed', cells: ['firewalld on, default zone', `${codes[1]}: ${read(s3, /\ncurl: \((\d+)\)/)} — nothing came back`], tone: 'consume' },
      { id: 'open', cells: ['http, https added', codes[2]], tone: 'store' },
    ] },
    { type: 'table', id: 'zone', title: `zone ${read(s3, /\n(\S+) \(default\)/)}: its services`, tone: 'store', fill: true, columns: ['when', 'services'], rows: [['enabled', services[0]], ['after --add-service, --reload', services[1]]] },
    { type: 'table', id: 'install', title: 'dnf install firewalld: the plan’s surprise', tone: 'infra', fill: true, columns: ['package', 'version', 'why'], rows: [
      ['firewalld', read(s3a, /^ firewalld\s+noarch\s+(\S+)/m), 'asked for'],
      { id: 'k', cells: ['kernel-core', read(s3a, /^ kernel-core\s+x86_64\s+(\S+)/m), 'its modules need a matching kernel'], tone: 'infra' },
      ['kernel-modules-extra', read(s3a, /^ kernel-modules-extra\s+x86_64\s+(\S+)/m), 'nftables’ modules the cloud kernel left out'],
      ['running kernel', read(s1, /uname -r\n(\S+)/), 'until the next reboot'],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: `firewalld needs kernel modules the cloud kernel left out, so dnf installed kernel-core ${read(s3a, /kernel-core\s+x86_64\s+(\S+)/)} with them — used from the next reboot. firewalld writes nftables underneath (the nft rule for 80 and 443 at the end): course 8’s tool, managed for you.` },
  ],
)

// 11.4 — the 403.
const code403 = read(s4, /localhost\n(\d{3})\n/)
const namei = outputOf(s4, 'namei -l /srv/sysops.example/index.html').trim().split('\n').slice(1).map((l) => l.trim().split(/\s+/))
const the403 = consoleFrame(
  consoleNode(WEB2, s4, { highlight: [rowOf(s4, '403'), rowOf(s4, 'Permission denied')] }),
  [
    { type: 'table', id: 'walk', title: 'namei -l: every step of the path, for nginx (others)', tone: 'store', fill: true, columns: ['mode', 'owner', 'name', 'others may'], rows: namei.map((n) => [n[0], n[1], n[3], n[0].slice(7, 10).includes(n[0].startsWith('d') ? 'x' : 'r') ? 'yes' : 'no']) },
    { type: 'table', id: 'says', title: `curl says ${code403}; the classic checks say yes`, tone: 'consume', fill: true, columns: ['check', 'result'], rows: [
      ['rwx along the path (5.4)', 'allowed'],
      ['nginx -t', 'syntax is ok'],
      ['nginx’s error log', `open() … failed (${read(s4, /failed \((13: Permission denied)\)/)})`],
    ] },
    { type: 'table', id: 'err', title: 'nginx’s error line, read', tone: 'infra', fill: true, columns: ['part', 'here'], rows: (() => {
      const e = read(s4, /\n(\d{4}\/\d\d\/\d\d [^\n]+\n[^\n]+\n[^\n]+)\n\[sysops/).replace(/\n/g, '')
      return [['level', read(e, /\[(\w+)\]/)], ['what failed', `open() ${read(e, /open\(\) "([^"]+)"/)}`], ['why', read(e, /failed \(([^)]+)\)/)], ['client, server', `${read(e, /client: ([^,]+)/)}, ${read(e, /server: ([^,]+)/)}`]]
    })() },
    { type: 'note', id: 'note', tone: 'consume', text: 'Set up the way the team works on Debian: the page written in the home directory, then moved into place. Every permission says nginx may read it, and the kernel still says permission denied. Something other than rwx decided.' },
  ],
)

// 11.5 — SELinux: labels.
const label = (s: string) => s.split(':')[2]
const fileLabel = read(s5, /\n(\S+) \/srv\/sysops\.example\/index\.html/)
const dirLabel = read(s5, /\n\s*(\S+) \/srv\/sysops\.example\n/)
const goodLabel = read(s5, /\n(\S+) \/usr\/share\/nginx\/html/)
// ausearch --format text: one sentence per event, wrapped by the terminal
const avc = read(s5, /\n(At [^\n]+\n[^\n]+)\n/).replace(/\n/, '')
const selinux = consoleFrame(
  consoleNode(WEB2, s5, { highlight: [rowOf(s5, 'user_home_t'), rowOf(s5, 'unsuccessfully')] }),
  [
    { type: 'group', id: 'check', title: 'Two checks, both must pass', icon: 'shield', tone: 'consume', dir: 'row', children: [
      { type: 'item', id: 'dac', title: 'rwx', sub: 'others: r-- — allowed', icon: 'lock', tone: 'store', stack: true },
      { type: 'item', id: 'mac', title: `SELinux: ${read(s5, /getenforce\n(\w+)/)}`, sub: `${label(read(s5, /\n(\S+)\s+\d+ \?\s+[\d:]+ nginx/))} may not read ${label(fileLabel)}`, icon: 'redhat', stack: true },
    ] },
    { type: 'table', id: 'labels', title: 'ls -Z: every file has a label; the type is what counts', tone: 'ingest', fill: true, columns: ['path', 'type', 'nginx (httpd_t) may read?'], rows: [
      { id: 'f', cells: ['/srv/sysops.example/index.html', label(fileLabel), 'no'], tone: 'consume' },
      { id: 'd', cells: ['/srv/sysops.example', label(dirLabel), 'no'], tone: 'consume' },
      { id: 'g', cells: ['/usr/share/nginx/html', label(goodLabel), 'yes'], tone: 'store' },
    ] },
    { type: 'table', id: 'parts', title: `A label, taken apart: ${fileLabel}`, tone: 'infra', fill: true, columns: ['part', 'here', 'means'], rows: [
      ['user', fileLabel.split(':')[0], 'the SELinux user'],
      ['role', fileLabel.split(':')[1], 'object_r: every file has it'],
      { id: 'type', cells: ['type', fileLabel.split(':')[2], 'what the policy decides on'], tone: 'consume' },
      ['level', fileLabel.split(':')[3], 'sensitivity (unused here)'],
    ] },
    { type: 'table', id: 'avc', title: 'The denial, from the audit log (ausearch --format text)', tone: 'consume', fill: true, columns: ['said'], rows: [[avc]] },
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
    { type: 'group', id: 'how', title: 'Fix the rule, then the labels', icon: 'shield', tone: 'store', dir: 'row', children: [
      { type: 'item', id: 'rule', title: 'semanage fcontext -a', sub: '“/srv/sysops.example(/.*)? is httpd_sys_content_t”', stack: true },
      { type: 'item', id: 'apply', title: 'restorecon -Rv', sub: 'labels the files by the rules', stack: true },
      { type: 'item', id: 'ok', title: 'the page', sub: page.replace(/<\/?h1>/g, ''), icon: 'check', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'relabel', title: 'What restorecon changed', tone: 'store', fill: true, columns: ['path', 'from', 'to'], rows: relabels },
    { type: 'table', id: 'why', title: 'Why mv kept the wrong label', tone: 'consume', fill: true, columns: ['command', 'the label'], rows: [
      ['echo > ~/index.html', 'user_home_t: created in a home directory'],
      ['mv into /srv/sysops.example', 'kept: a move keeps the inode, label and all'],
      ['cp into /srv/sysops.example', 'would take the directory’s — var_t, still wrong here'],
      ['restorecon, after semanage', 'set from the rule — and survives a full relabel'],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: 'Never setenforce 0 to make a 403 go away: it switches the guard off for every service. chcon would fix the label too — until the next relabel puts it back. The rule is what lasts.' },
  ],
  [{ from: 'rule', to: 'apply' }, { from: 'apply', to: 'ok' }],
)

// 11.7 — one site, two families: the same checks on web-02 that course 10 ended with on web-01.
const enabled = outputOf(s7, 'systemctl is-enabled nginx firewalld').trim().split('\n')
const end = consoleFrame(
  consoleNode(WEB2, s7, { highlight: [rowOf(s7, 'PRETTY_NAME'), rowOf(s7, read(s7, /localhost\n([^\n]+)/))] }),
  [
    { type: 'table', id: 'both', title: 'The same site, checked on both servers', tone: 'ingest', fill: true, columns: ['check', 'web-01 (Debian)', 'web-02 (Rocky)'], rows: [
      ['system', read(d1, /PRETTY_NAME="([^"]+)"/), read(s7, /PRETTY_NAME="([^"]+)"/)],
      ['nginx enabled', 'enabled (3.3)', enabled[0]],
      ['firewall', `nftables by hand: ${read(d8, /tcp dport \{ ([^}]+) \}/).trim()} + 22`, `firewalld: ${read(s7, /--list-services\n(?:\[sudo\][^\n]*\n)?([^\n]+)/).trim()}`],
      ['the extra guard', 'AppArmor (not covered here)', `SELinux: ${read(s7, /getenforce\n(\w+)/)}`],
      ['the page', 'sysops.example', read(s7, /localhost\n([^\n]+)/).replace(/<\/?h1>/g, '')],
    ] },
    { type: 'table', id: 'built', title: 'And web-01, after ten courses — each line read from its course', tone: 'store', fill: true, columns: ['course', 'what web-01 has'], rows: [
      ['8 · network', `HTTPS: certificate for ${read(d87, /Domains: (\S+)/)}, expires ${read(d87, /Expiry Date: (\S+)/)}`],
      ['9 · storage', `a mirror on the data disk: ${(d96.match(/^>f\+{9} /gm) ?? []).length} files, kept by rsync`],
      ['10 · scripting', read(d105, /\n(deployed \d+ files; [^\n]+)/)],
      ['10 · scripting', `every 5 min: ${read(d106, /-o cat \| tail -n 4\n([^\n]+)/)}`],
    ] },
    { type: 'group', id: 'lesson', title: 'What changed, and what did not', icon: 'linux', tone: 'store', dir: 'row', children: [
      { type: 'item', id: 'same', title: 'the same', sub: 'kernel, shell, files, users, systemd, nginx, ssh', stack: true },
      { type: 'item', id: 'diff', title: 'different', sub: 'package tools, defaults, firewall front end, SELinux', stack: true, tone: 'infra' },
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
