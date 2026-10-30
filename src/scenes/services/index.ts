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
const wants = outputOf(s1, "systemctl list-dependencies --plain --no-pager multi-user.target | grep -E 'nginx|ssh|cron|getty'").trim().split('\n').map((l) => l.trim())
const boot: SceneModel = {
  title: 'From power-on to login',
  sub: 'a real reboot of web-01, and what systemd started on the way',
  dir: 'row',
  nodes: [
    { type: 'code', id: 'run', console: true, filename: 'sysops@ops: ~', code: s1.trimEnd(), show: [[1, rowOf(s1, 'Linux web-01') - 1], [rowOf(s1, 'Last login'), s1.trimEnd().split('\n').length]] },
    { type: 'group', id: 'right', bare: true, children: [
      { type: 'group', id: 'chain', title: 'The boot, in order', icon: 'power', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'fw', title: 'firmware', sub: 'finds the disk', stack: true, tone: 'neutral' },
        { type: 'item', id: 'grub', title: 'GRUB', sub: 'loads the kernel from /boot', stack: true, tone: 'neutral' },
        { type: 'item', id: 'kernel', title: 'kernel', sub: `${times.split(' + ')[0]}`, icon: 'linux', stack: true, tone: 'infra' },
        { type: 'item', id: 'systemd', title: 'systemd, PID 1', sub: times.split(' + ')[1].split(' = ')[0], stack: true },
        { type: 'item', id: 'target', title: read(s1, /get-default\n(\S+)/), sub: 'the goal: everything it wants', stack: true, tone: 'store' },
      ] },
      { type: 'table', id: 'wants', title: 'Some of what multi-user.target wants', tone: 'store', fill: true, columns: ['unit', 'is'], rows: wants.map((u) => [u, u === 'nginx.service' ? 'our web server: enabled in 3.2' : u.startsWith('ssh') || u.startsWith('sshd') ? 'how the team logs in' : 'a login prompt on a console']) },
      { type: 'note', id: 'note', tone: 'ingest', text: `Startup finished in ${times}: emulated, so slow — on real hardware seconds. nginx came back by itself: enabled means wanted by a target, so started at every boot.` },
    ] },
  ],
  edges: [{ from: 'fw', to: 'grub' }, { from: 'grub', to: 'kernel' }, { from: 'kernel', to: 'systemd' }, { from: 'systemd', to: 'target' }],
}

// 7.2 — systemctl: the status screen read, and nginx stopped and started.
const field = (name: string) => read(s2, new RegExp(`^\\s+${name}: ([^\\n]+)$`, 'm'))
const systemctl = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, 'Active: active'), rowOf(s2, 'Could not connect')] }),
  [
    { type: 'table', id: 'status', title: 'systemctl status nginx, read', tone: 'serve', fill: true, columns: ['line', 'says'], rows: [
      ['Loaded', 'the unit file, and enabled: starts at boot'],
      ['Active', field('Active').split(';')[0]],
      ['ExecStartPre', 'nginx -t ran first: a bad config never starts'],
      ['Main PID, CGroup', 'the master and its workers, kept together'],
      ['Tasks, Memory, CPU', `${field('Tasks')}; ${field('Memory')}; ${field('CPU')}`],
      ['the last lines', 'its newest journal entries (7.5)'],
    ] },
    { type: 'table', id: 'verbs', title: 'Now, and at boot: two separate switches', tone: 'ingest', fill: true, columns: ['command', 'changes', 'here'], rows: [
      ['systemctl stop / start', 'whether it runs NOW', `${read(s2, /is-active nginx\n(\w+)/)}, then ${read(s2, /start nginx\nsysops@web-01:~\$ systemctl is-active nginx\n(\w+)/)}`],
      ['systemctl enable / disable', 'whether it starts AT BOOT', outputOf(s2, 'systemctl is-enabled nginx ssh').trim().split('\n').join(', ')],
      ['systemctl restart', 'stop, then start', 'drops connections'],
      ['systemctl reload', 're-read the config, keep serving', 'nginx supports it'],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: `Stopped, the site is simply gone: curl says ${read(s2, /curl: \(7\) ([^\n]+? after)/).replace(' after', '')} — no error page, nothing listening.` },
  ],
)

// 7.3 — the team's site: a page, a server block, a link. The block is the file the server has.
const conf = catOf(s3, '/etc/nginx/sites-available/sysops.example')
const lineOf = (text: string, needle: string) => text.split('\n').findIndex((l) => l.includes(needle)) + 1
const siteConfig = consoleFrame(
  consoleNode(WEB, s3, { highlight: [rowOf(s3, 'sudo ln -s'), rowOf(s3, 'sudo rm /etc/nginx/sites-enabled/default')] }),
  [
    { type: 'code', id: 'conf', lang: 'nginx', filename: '/etc/nginx/sites-available/sysops.example', code: conf, highlight: [lineOf(conf, 'listen'), lineOf(conf, 'root'), lineOf(conf, 'access_log')] },
    { type: 'table', id: 'read', title: 'The server block, read', tone: 'serve', fill: true, columns: ['directive', 'says'], rows: [
      ['listen 80 default_server', 'port 80; the answer to any name nobody else claims'],
      ['server_name', 'the name in the request’s Host header'],
      ['root, index', 'files from /srv/sysops.example; / means index.html'],
      ['access_log', 'this site’s own log, apart from the default one'],
      ['try_files … =404', 'a file, a directory, or a 404'],
    ] },
    { type: 'table', id: 'link', title: 'Enabled by a link, not a copy', tone: 'ingest', fill: true, columns: ['directory', 'holds'], rows: [
      ['sites-available/', 'every site the server knows'],
      ['sites-enabled/', `the ones it serves: ${outputOf(s3, 'ls -l /etc/nginx/sites-enabled').split('\n').filter((l) => l.startsWith('l')).map((l) => l.split(' -> ')[0].split(/\s+/).pop()).join(', ')}`],
    ] },
  ],
)

// 7.4 — test, then reload; and what a typo does to a restart.
const emerg = read(s4, /\[emerg\] \d+#\d+: ([^\n]+\n[^\n]+)/).replace(/\n/, '')
const testReload = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, '[emerg]'), rowOf(s4, 'Job for nginx.service failed'), rowOf(s4, 'is-active nginx') + 1] }),
  [
    { type: 'table', id: 'runs', title: 'The same change, two ways', tone: 'ingest', fill: true, columns: ['did', 'with a good config', 'with the typo'], rows: [
      ['nginx -t', 'syntax is ok', 'test failed: names the line'],
      { id: 'reload', cells: ['systemctl reload', `the site answers: ${read(s4, /curl -s localhost\n([^\n]+)/)}`, 'never run: -t said no'], tone: 'store' },
      { id: 'restart', cells: ['systemctl restart', 'a short gap', `${read(s4, /is-active nginx\n(\w+)/)}: the site is down`], tone: 'consume' },
      ['curl, from outside', 'the page', read(s4, /curl: \(7\) Failed to connect to (localhost port 80)/) + ': refused'],
    ] },
    { type: 'group', id: 'order', title: 'The safe order for any config change', icon: 'check', tone: 'store', dir: 'row', children: [
      { type: 'item', id: 'edit', title: 'edit', sub: 'the file in sites-available', stack: true },
      { type: 'item', id: 'test', title: 'nginx -t', sub: 'the whole config, offline', stack: true, tone: 'infra' },
      { type: 'item', id: 'rel', title: 'reload', sub: 'switch, keep serving', stack: true },
      { type: 'item', id: 'look', title: 'curl', sub: 'check from outside', stack: true },
    ] },
    { type: 'table', id: 'error', title: 'The error, word for word', tone: 'consume', fill: true, columns: ['nginx -t said'], rows: [[emerg]] },
    { type: 'note', id: 'note', tone: 'consume', text: 'The typo was one missing ; after root. Restart stops the old nginx BEFORE the new one fails to start, so the site is gone until someone notices. Always nginx -t, then reload.' },
  ],
  [{ from: 'edit', to: 'test' }, { from: 'test', to: 'rel' }, { from: 'rel', to: 'look' }],
)

// 7.5 — the journal.
const sudoLine = read(s5, /sudo\[\d+\]:\s+(sysops : TTY=[^\n]+\n[^\n]+)/).replace(/\n/, '')
const journal = consoleFrame(
  consoleNode(WEB, s5, { highlight: [rowOf(s5, 'Failed to start', 2), rowOf(s5, 'COMMAND=') - 1] }),
  [
    { type: 'table', id: 'queries', title: 'Asking the journal', tone: 'ingest', fill: true, columns: ['typed', 'answers'], rows: [
      ['journalctl -u nginx', 'one unit’s history: every start, reload, stop'],
      ['-p err', `only errors and worse: ${read(s5, /-p err --no-pager \| tail -n 4\n[^\n]+?systemd\[1\]: (Failed to start nginx\.service)/)} (7.4)`],
      ['_COMM=sudo', 'by the program that logged: every sudo'],
      ['--disk-usage', read(s5, /take up (\S+)/) + ' in all'],
      ['-f', 'follow: new entries as they arrive (tail -f)'],
    ] },
    { type: 'table', id: 'sudo', title: 'sudo’s record of one command', tone: 'consume', fill: true, columns: ['field', 'here'], rows: [['by', sudoLine.split(' : ')[0]], ...sudoLine.split(' : ').slice(1).join(' : ').split(' ; ').map((p) => [p.split('=')[0], p.split('=').slice(1).join('=')])] },
    { type: 'note', id: 'note', tone: 'ingest', text: 'The journal is where Debian 13 keeps the logs /var/log/README talked about (2.7): systemd collects every service’s output, with the time, the unit and the priority. sysops reads it because it is in adm.' },
  ],
)

// 7.6 — a unit of our own: oneshot, as deploy.
const unit = catOf(s6, '/etc/systemd/system/report.service')
const report = outputOf(s6, 'cat /srv/sysops.example/status.txt').trim().split('\n').map((l) => l.trim().split(/\s+/))
const ownUnit = consoleFrame(
  consoleNode(WEB, s6, { highlight: [rowOf(s6, 'Active: inactive'), rowOf(s6, 'deploy site')] }),
  [
    { type: 'code', id: 'unit', lang: 'ini', filename: '/etc/systemd/system/report.service', code: unit, highlight: [lineOf(unit, 'Type='), lineOf(unit, 'User='), lineOf(unit, 'SupplementaryGroups=')] },
    { type: 'table', id: 'read', title: 'The unit, read', tone: 'serve', fill: true, columns: ['line', 'says'], rows: [
      ['Type=oneshot', 'runs to the end, then is done: inactive (dead) is success'],
      ['User=deploy', 'not root: the account from 5.6'],
      ['SupplementaryGroups=adm', 'so deploy may read the log'],
      ['ExecStart=', 'course 4’s pipeline, on the site’s log'],
    ] },
    { type: 'table', id: 'out', title: `It wrote status.txt, as ${lsOwner(s6)}`, tone: 'store', fill: true, columns: ['requests', 'status'], rows: report.map(([n, code]) => ({ id: code, cells: [n, code], tone: code === '404' ? 'consume' as const : undefined })) },
  ],
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
    { type: 'code', id: 'timer', lang: 'ini', filename: '/etc/systemd/system/report.timer', code: timer, highlight: [lineOf(timer, 'OnCalendar='), lineOf(timer, 'Persistent=')] },
    { type: 'group', id: 'how', title: 'timer → service → status.txt', icon: 'timer', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 't', title: 'report.timer', sub: `enabled; next: ${next[0]}`, icon: 'clock', stack: true },
      { type: 'item', id: 's', title: 'report.service', sub: `${outputOf(s7, 'systemctl is-enabled report.timer report.service').trim().split('\n')[1]}: only the timer starts it`, icon: 'settings', stack: true },
      { type: 'item', id: 'f', title: 'status.txt', sub: 'rewritten every hour', icon: 'file', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'read', title: 'The timer, read', tone: 'serve', fill: true, columns: ['line', 'says'], rows: [
      ['OnCalendar=hourly', 'at the top of every hour'],
      ['Persistent=true', 'a run missed while the server was off runs at boot'],
      ['WantedBy=timers.target', 'what enable links it to'],
    ] },
    { type: 'note', id: 'note', tone: 'ingest', text: 'cron does the same job and is still common. A timer’s runs land in the journal like any unit’s, and systemctl list-timers shows when each will fire next.' },
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
