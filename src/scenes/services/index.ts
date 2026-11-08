import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/services/01-boot-to-login/session.txt?raw'
import s2 from '../../../spine/services/02-systemctl/session.txt?raw'
import s3 from '../../../spine/services/03-site-config/session.txt?raw'
import s4 from '../../../spine/services/04-test-then-reload/session.txt?raw'
import s5 from '../../../spine/services/05-journalctl/session.txt?raw'
import s6 from '../../../spine/services/06-a-unit-of-our-own/session.txt?raw'
import s7 from '../../../spine/services/07-timers/session.txt?raw'

// Course 7 — Keep it running. Config files on screen are the `cat` the VM printed (lab/files/ is
// only what was copied in), so a picture of a file is the file as the server has it.
const WEB = 'sysops@web-01: ~'
/** A file's contents as `cat` printed it, with the terminal's 80-column wraps undone. A file line of
 *  EXACTLY 80 characters is indistinguishable from a wrap, so lab/files keep their lines shorter. */
const catOf = (s: string, path: string) => outputOf(s, `cat ${path}`).split('\n').reduce<string[]>((acc, r) => {
  if (acc.length && acc[acc.length - 1].length === 80) acc[acc.length - 1] += r
  else acc.push(r)
  return acc
}, []).join('\n')

// 7.1 — ◆ full scene: from power-on to a login prompt, on a real reboot.
const times = read(s1, /Startup finished in ([^\n]+)/)
const boot: SceneModel = {
  title: 'From power-on to login',
  sub: 'a real reboot of web-01, and what systemd started on the way',
  dir: 'row',
  nodes: [
    { type: 'code', id: 'run', console: true, filename: 'sysops@ops: ~', code: s1.trimEnd(), show: [[1, rowOf(s1, 'Linux web-01') - 1], [rowOf(s1, 'Last login'), s1.trimEnd().split('\n').length]] },
    { type: 'group', id: 'right', bare: true, dir: 'row', children: [
      { type: 'group', id: 'chain', title: 'The boot, in order', icon: 'power', tone: 'ingest', children: [
        { type: 'item', id: 'fw', title: 'firmware', sub: 'finds the disk', icon: 'cpu', tone: 'neutral' },
        { type: 'item', id: 'grub', title: 'GRUB', sub: 'loads the kernel from /boot', icon: 'disk', tone: 'neutral' },
        { type: 'item', id: 'kernel', title: 'kernel', sub: `${times.split(' + ')[0]}`, icon: 'linux', tone: 'infra' },
        { type: 'item', id: 'systemd', title: 'systemd, PID 1', sub: times.split(' + ')[1].split(' = ')[0], icon: 'settings' },
        { type: 'item', id: 'target', title: read(s1, /get-default\n(\S+)/), sub: 'the goal: multi-user.target and everything it wants — nginx, ssh, the logins', icon: 'check', tone: 'store' },
      ] },
    ] },
  ],
  edges: [{ from: 'fw', to: 'grub' }, { from: 'grub', to: 'kernel' }, { from: 'kernel', to: 'systemd' }, { from: 'systemd', to: 'target' }],
}

// 7.2 — systemctl: the status screen read, and nginx stopped and started.
const field = (name: string) => read(s2, new RegExp(`^\\s+${name}: ([^\\n]+)$`, 'm'))
const systemctl = consoleFrame(
  consoleNode(WEB, s2, {
    // Invocation and Docs, ExecStart through CPU, and the journal tail fold; Loaded, Active, the -t and the CGroup stay
    show: [[1, rowOf(s2, 'Active:')], [rowOf(s2, 'ExecStartPre'), rowOf(s2, 'ExecStartPre') + 1], [rowOf(s2, 'CGroup:'), rowOf(s2, 'CGroup:') + 3], [rowOf(s2, '$ sudo systemctl stop'), s2.trimEnd().split('\n').length]],
    highlight: [rowOf(s2, 'Active: active'), rowOf(s2, 'Could not connect')],
  }),
  [
    { type: 'group', id: 'switches', title: 'Two separate switches, and two ways to apply a change', icon: 'settings', tone: 'ingest', dir: 'grid', cols: 2, children: [
      { type: 'item', id: 'now', title: 'stop / start', sub: `runs NOW? ${read(s2, /is-active nginx\n(\w+)/)}, then ${read(s2, /start nginx\nsysops@web-01:~\$ systemctl is-active nginx\n(\w+)/)}`, icon: 'power', chip: true },
      { type: 'item', id: 'boot', title: 'enable / disable', sub: `at BOOT? nginx, ssh: ${outputOf(s2, 'systemctl is-enabled nginx ssh').trim().split('\n').join(', ')}`, icon: 'clock', chip: true },
      { type: 'item', id: 'restart', title: 'restart', sub: 'stop, then start: drops connections', icon: 'zap', chip: true, tone: 'consume' },
      { type: 'item', id: 'reload', title: 'reload', sub: 're-reads the config, keeps serving', icon: 'check', chip: true, tone: 'store' },
    ] },
    { type: 'table', id: 'status', title: 'systemctl status nginx, read', tone: 'serve', fill: true, columns: ['line', 'says'], rows: [
      ['Loaded', 'the unit file; enabled'],
      ['Active', field('Active').split(' since')[0]],
      ['ExecStartPre', 'nginx -t first: a bad config never starts'],
      ['CGroup', 'the master and its workers, together'],
    ] },
  ],
)

// 7.3 — the team's site: a page, a server block, a link. The block is the file the server has.
const conf = catOf(s3, '/etc/nginx/sites-available/sysops.example')
const lineOf = (text: string, needle: string) => text.split('\n').findIndex((l) => l.includes(needle)) + 1
const enabled = outputOf(s3, 'ls -l /etc/nginx/sites-enabled').split('\n').filter((l) => l.startsWith('l')).map((l) => l.split(' -> ')[0].split(/\s+/).pop())
const siteConfig = consoleFrame(
  consoleNode(WEB, s3, { highlight: [rowOf(s3, 'sudo ln -s'), rowOf(s3, 'sudo rm /etc/nginx/sites-enabled/default')] }),
  [
    { type: 'group', id: 'link', title: 'Enabled by a link, not a copy', icon: 'folder', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'avail', title: 'sites-available/', sub: 'every site the server knows', icon: 'folder', stack: true },
      { type: 'item', id: 'enabled', title: 'sites-enabled/', sub: `the ones it serves: ${enabled.join(', ')}`, icon: 'folder', stack: true, tone: 'store' },
    ] },
    { type: 'code', id: 'conf', lang: 'nginx', filename: '/etc/nginx/sites-available/sysops.example', code: conf, highlight: [lineOf(conf, 'listen'), lineOf(conf, 'root'), lineOf(conf, 'access_log')] },
  ],
  [{ from: 'enabled', to: 'avail', label: 'ln -s' }],
)

// 7.4 — test, then reload; and what a typo does to a restart.
const testReload = consoleFrame(
  consoleNode(WEB, s4, {
    show: [[1, rowOf(s4, 'Job for nginx.service failed')], [rowOf(s4, 'is-active nginx'), rowOf(s4, '$ sudo nginx -t', 3)], [rowOf(s4, '$ sudo systemctl start nginx'), s4.trimEnd().split('\n').length]],
    highlight: [rowOf(s4, '[emerg]'), rowOf(s4, 'Job for nginx.service failed'), rowOf(s4, 'is-active nginx') + 1],
  }),
  [
    { type: 'group', id: 'order', title: 'The safe order for any config change', icon: 'check', tone: 'store', children: [
      { type: 'item', id: 'edit', title: 'edit', sub: 'the file in sites-available', icon: 'file' },
      { type: 'item', id: 'test', title: 'nginx -t', sub: 'tests the whole config, offline', icon: 'check', tone: 'infra' },
      { type: 'item', id: 'rel', title: 'systemctl reload nginx', sub: 'switches over, keeps serving', icon: 'settings' },
      { type: 'item', id: 'look', title: 'curl', sub: 'checks from the outside', icon: 'globe', tone: 'store' },
    ] },
    { type: 'table', id: 'runs', title: 'One missing ; after root, two ways', tone: 'ingest', fill: true, columns: ['did', 'got'], rows: [
      ['nginx -t', `test failed: ${read(s4, /(sysops\.example:\d+)/)}`],
      { id: 'reload', cells: ['systemctl reload', 'would keep the old config'], tone: 'store' },
      { id: 'restart', cells: ['systemctl restart', `stopped, then ${read(s4, /is-active nginx\n(\w+)/)}`], tone: 'consume' },
      ['curl localhost', 'refused: the site is down'],
    ] },
  ],
  [{ from: 'edit', to: 'test' }, { from: 'test', to: 'rel' }, { from: 'rel', to: 'look' }],
)

// 7.5 — the journal.
const sudoLine = read(s5, /sudo\[\d+\]:\s+(sysops : TTY=[^\n]+\n[^\n]+)/).replace(/\n/, '')
const sudoFields = sudoLine.split(' : ').slice(1).join(' : ').split(' ; ').map((p) => [p.split('=')[0], p.split('=').slice(1).join('=')])
const journal = consoleFrame(
  consoleNode(WEB, s5, {
    show: [[1, 1], [rowOf(s5, 'Starting nginx.service'), rowOf(s5, 'test failed')], [rowOf(s5, 'Failed to start'), rowOf(s5, '$ journalctl _COMM=sudo')],
      [rowOf(s5, 'COMMAND=') - 1, rowOf(s5, 'COMMAND=')], [rowOf(s5, '$ journalctl --disk-usage'), s5.trimEnd().split('\n').length]],
    highlight: [rowOf(s5, 'Failed to start', 2), rowOf(s5, 'COMMAND=') - 1],
  }),
  [
    { type: 'group', id: 'sudo', title: 'journalctl _COMM=sudo: who ran what, as root', icon: 'shield', tone: 'consume', dir: 'grid', cols: 2, children: [
      { type: 'item', id: 'by', title: sudoLine.split(' : ')[0].trim(), sub: 'by', icon: 'user', chip: true },
      ...sudoFields.map(([k, v], i) => ({ type: 'item' as const, id: `sf${i}`, title: v, sub: k, chip: true, ...(k === 'COMMAND' ? { span: 'all' as const, tone: 'consume' as const } : {}) })),
    ] },
    { type: 'table', id: 'queries', title: 'Asking the journal', tone: 'ingest', fill: true, columns: ['typed', 'answers'], rows: [
      ['journalctl -u nginx', 'one unit’s history'],
      ['-p err', `errors only: the failed start`],
      ['_COMM=sudo', 'by the program that logged'],
      ['--disk-usage', read(s5, /take up (\S+)/) + ' in all'],
      ['-f', 'new entries as they arrive'],
    ] },
  ],
)

// 7.6 — a unit of our own: oneshot, as deploy.
const unit = catOf(s6, '/etc/systemd/system/report.service')
const report = outputOf(s6, 'cat /srv/sysops.example/status.txt').trim().split('\n').map((l) => l.trim().split(/\s+/))
const ownUnit = consoleFrame(
  consoleNode(WEB, s6, {
    // the unit file is on the right; the console keeps the run around it
    show: [[1, rowOf(s6, '$ cat /etc/systemd')], [rowOf(s6, '$ sudo systemctl daemon-reload'), s6.trimEnd().split('\n').length]],
    highlight: [rowOf(s6, 'Active: inactive'), rowOf(s6, 'deploy site')],
  }),
  [
    { type: 'group', id: 'run', title: 'systemctl start report: one run, as deploy', icon: 'settings', tone: 'serve', dir: 'row', children: [
      { type: 'item', id: 'log', title: 'the site’s log', sub: 'group adm may read it', icon: 'log', stack: true },
      { type: 'item', id: 'svc', title: 'report.service', sub: `oneshot: ${read(s6, /Active: (inactive \(dead\))/)}`, icon: 'settings', stack: true },
      { type: 'item', id: 'out', title: 'status.txt', sub: `${lsOwner(s6)}: ${report.map(([n, code]) => `${n} × ${code}`).join(', ')}`, icon: 'file', stack: true, tone: 'store' },
    ] },
    { type: 'code', id: 'unit', lang: 'ini', filename: '/etc/systemd/system/report.service', code: unit, highlight: [lineOf(unit, 'Type='), lineOf(unit, 'User='), lineOf(unit, 'SupplementaryGroups=')] },
  ],
  [{ from: 'log', to: 'svc' }, { from: 'svc', to: 'out' }],
)
function lsOwner(s: string) {
  const f = outputOf(s, 'ls -l /srv/sysops.example/status.txt').trim().split(/\s+/)
  return `${f[2]}:${f[3]}`
}

// 7.7 — a timer starts the unit on a schedule.
const timer = catOf(s7, '/etc/systemd/system/report.timer')
const next = outputOf(s7, 'systemctl list-timers report.timer --no-pager').split('\n')[1].trim().split(/\s{2,}|\s(?=\d+min)/)
const timers = consoleFrame(
  consoleNode(WEB, s7, { highlight: [rowOf(s7, 'Created symlink'), rowOf(s7, 'report.timer report.service')] }),
  [
    { type: 'group', id: 'how', title: 'timer → service → status.txt', icon: 'timer', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 't', title: 'report.timer', sub: `enabled; next: ${next[0]}`, icon: 'clock', stack: true },
      { type: 'item', id: 's', title: 'report.service', sub: `${outputOf(s7, 'systemctl is-enabled report.timer report.service').trim().split('\n')[1]}: only the timer starts it`, icon: 'settings', stack: true },
      { type: 'item', id: 'f', title: 'status.txt', sub: 'rewritten every hour', icon: 'file', stack: true, tone: 'store' },
    ] },
    { type: 'code', id: 'timer', lang: 'ini', filename: '/etc/systemd/system/report.timer', code: timer, highlight: [lineOf(timer, 'OnCalendar='), lineOf(timer, 'Persistent=')] },
  ],
  [{ from: 't', to: 's' }, { from: 's', to: 'f' }],
)

export const servicesScenes: Record<string, SceneModel> = {
  'services-boot': boot,
  'services-systemctl': systemctl,
  'services-site': siteConfig,
  'services-test-reload': testReload,
  'services-journal': journal,
  'services-unit': ownUnit,
  'services-timers': timers,
}
