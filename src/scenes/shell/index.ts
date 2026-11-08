import type { SceneModel } from '@graphlearning/graphl-flow'
import { CONSOLE, consoleFrame, consoleNode, ttyNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/shell/01-ssh-in/session.txt?raw'
import s2 from '../../../spine/shell/02-commands/session.txt?raw'
import s3 from '../../../spine/shell/03-man-and-help/session.txt?raw'
import manLs from '../../../spine/shell/03-man-and-help/tty/man-ls.json'
import s4 from '../../../spine/shell/04-filesystem-tree/session.txt?raw'
import s5 from '../../../spine/shell/05-paths/session.txt?raw'
import s6 from '../../../spine/shell/06-create-copy-move-remove/session.txt?raw'
import s7 from '../../../spine/shell/07-reading-files/session.txt?raw'
import lessReadme from '../../../spine/shell/07-reading-files/tty/less-readme.json'

// Course 2 — Find your way around. Every frame is the console frame; 2.4 is the one full scene.
const WEB = 'sysops@web-01: ~'

// 2.1 — from ops into web-01; the prompt is the first thing to read.
const sshIn = consoleFrame(
  consoleNode('sysops@ops: ~', s1, { highlight: [rowOf(s1, 'sysops@web-01:~$ whoami'), rowOf(s1, 'root@web-01:~# whoami')] }),
  [
    { type: 'group', id: 'hop', title: 'Two machines, one console', icon: 'network', tone: 'source', dir: 'row', children: [
      { type: 'item', id: 'ops', title: 'ops', sub: 'the team’s workstation', icon: 'laptop', stack: true },
      { type: 'item', id: 'web', title: 'web-01', sub: 'the server, a Debian 13 VM', icon: 'server', stack: true, tone: 'ingest' },
    ] },
    { type: 'table', id: 'prompt', title: 'Reading the prompt: sysops@web-01:~$', tone: 'ingest', fill: true, columns: ['part', 'means', 'here'], rows: [
      { id: 'user', cells: ['sysops', 'who you are', read(s1, /whoami\n(\S+)/)] },
      { id: 'host', cells: ['web-01', 'which machine runs your commands', read(s1, /hostname\n(\S+)/)] },
      { id: 'cwd', cells: ['~', 'where you are: your home directory', read(s1, /\$ pwd\n(\S+)/)] },
      { id: 'dollar', cells: ['$', 'an ordinary user', 'sysops'], tone: 'store' },
      { id: 'hash', cells: ['#', 'root: the system’s administrator', 'after sudo -i'], tone: 'consume' },
    ] },
  ],
  [{ from: 'ops', to: 'web', label: 'ssh web-01' }],
)

// 2.2 — one command line taken apart, and the fields of a real `ls -l` row.
const hidden = outputOf(s2, 'ls -a').trim().split(/\s+/)
const commands = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, 'ls -l -h /etc/ssh/sshd_config'), rowOf(s2, "invalid option")] }),
  [
    { type: 'group', id: 'line', title: 'ls -l -h /etc/ssh/sshd_config', icon: 'terminal', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'cmd', title: 'ls', sub: 'the command: a program to run', stack: true },
      { type: 'item', id: 'opts', title: '-l -h', sub: 'options: how to run it (long, human sizes)', stack: true, tone: 'infra' },
      { type: 'item', id: 'arg', title: '/etc/ssh/sshd_config', sub: 'an argument: what to run it on', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'forms', title: 'Options, written four ways', tone: 'infra', fill: true, columns: ['typed', 'means'], rows: [
      ['ls -l -h', 'long format, human sizes'],
      ['ls /etc/ssh', 'an argument: what to list'],
      ['ls -lh /etc/hosts …', 'combined; two files'],
      ['ls -a, ls --all', `one option: ${hidden.length} hidden names`],
      { id: 'bad', cells: ['ls -z', 'unknown: stops, hints'], tone: 'consume' },
    ] },
  ],
  [{ from: 'cmd', to: 'opts' }, { from: 'opts', to: 'arg' }],
)

// 2.3 — the manual, on its own screen; `man -f` names the sections a page lives in.
const manIndex = outputOf(s3, 'man -f ls passwd')
const manAndHelp = consoleFrame(ttyNode('man ls — web-01', manLs), [
  { type: 'group', id: 'index', title: 'man -f ls passwd: the sections a name is in', icon: 'search', tone: 'ingest', children: manIndex.trim().split('\n').map((l, i) => {
    const m = l.match(/^(\S+) \((\w+)\)\s+- (.+)$/)
    if (!m) throw new Error(`2.3: man -f printed ${JSON.stringify(l)}`)
    const SECTION: Record<string, string> = { '1': 'a command', '1ssl': 'an OpenSSL command', '5': 'a file format' }
    return { type: 'item' as const, id: `ix${i}`, title: `${m[1]} (${m[2]})`, sub: `${SECTION[m[2]] ?? `section ${m[2]}`}: ${m[3]}`, tone: m[2] === '5' ? 'store' as const : undefined }
  }) },
  { type: 'table', id: 'keys', title: 'Inside man (it pages with less)', tone: 'infra', fill: true, columns: ['key', 'does'], rows: [
    ['space / b', 'a page forward / back'],
    ['/word', 'search; n for the next match'],
    ['q', 'quit, back to the prompt'],
  ] },
])

// 2.4 — ◆ full scene: the tree from /. The real `ls -F /` beside what each directory holds.
const root = outputOf(s4, 'ls -F /')
const filesystemTree: SceneModel = {
  title: 'The filesystem tree',
  sub: 'one tree from / — every disk, device and setting has a place in it',
  dir: 'row',
  nodes: [
    { type: 'group', id: 'left', bare: true, children: [
      { type: 'code', id: 'ls', console: true, filename: WEB, code: `sysops@web-01:~$ ls -F /\n${root}` },
      { type: 'note', id: 'marks', tone: 'ingest', text: 'ls -F marks a directory with / and a symbolic link with @. On Debian 13, bin, sbin and lib are links into /usr.' },
    ] },
    { type: 'group', id: 'dirs', title: 'What lives where', icon: 'folder', tone: 'ingest', dir: 'grid', cols: 2, children: [
      { type: 'table', id: 'config', title: 'Settings and programs', tone: 'ingest', columns: ['dir', 'holds'], rows: [
        ['/etc', 'configuration: ssh, users, nginx later'],
        ['/usr', 'installed programs and libraries'],
        ['/boot', 'the kernel and what starts it'],
        ['/opt', 'add-on software outside packages'],
      ] },
      { type: 'table', id: 'data', title: 'Data that changes', tone: 'store', columns: ['dir', 'holds'], rows: [
        ['/var', 'logs, caches, queues: /var/log'],
        ['/srv', 'data a server serves (our site)'],
        ['/tmp', 'scratch files, cleared at boot'],
        ['/run', 'state of the running system'],
      ] },
      { type: 'table', id: 'people', title: 'People', tone: 'source', columns: ['dir', 'holds'], rows: [
        ['/home', 'one directory per user: sysops'],
        ['/root', 'root’s own home'],
      ] },
      { type: 'table', id: 'kernel', title: 'The kernel’s view', tone: 'infra', columns: ['dir', 'holds'], rows: [
        ['/proc', 'running processes, as files'],
        ['/sys', 'devices and kernel settings'],
        ['/dev', 'disks and terminals, as files'],
      ] },
    ] },
  ],
  edges: [],
}

// 2.5 — absolute and relative paths, walked on the tree. The tree's top level is the real `ls ../..`.
const topDirs = outputOf(s5, 'ls ../..').trim().split(/\s+/).sort()
const OPEN: Record<string, { name: string; folder?: boolean; state?: 'active'; note?: string }[]> = {
  etc: [{ name: 'default', folder: true, state: 'active' }, { name: 'ssh', folder: true }],
  home: [{ name: 'sysops', folder: true, note: '~' }],
  var: [{ name: 'log', folder: true }],
}
const paths = consoleFrame(
  consoleNode(WEB, s5, { highlight: [rowOf(s5, 'cd ../default'), rowOf(s5, '$ cd -')] }),
  [
    { type: 'group', id: 'walk', title: 'The walks on the tree', icon: 'folder', tone: 'ingest', dir: 'row', children: [
      { type: 'tree', id: 'tree', title: '/  (ls ../.. from ~)', entries: topDirs.map((name) => OPEN[name] ? { name, children: OPEN[name] } : { name, folder: true, state: 'muted' }) },
      { type: 'table', id: 'moves', title: 'Where each cd lands', tone: 'ingest', fill: true, columns: ['typed', 'lands in'], rows: [
        { id: 'abs', cells: ['cd /etc/ssh', '/etc/ssh: from /'] },
        { id: 'rel', cells: ['cd ../default', read(s5, /cd \.\.\/default\n.*pwd\n(\S+)/)], tone: 'ingest' },
        { id: 'home', cells: ['cd ~', read(s5, /cd ~\n.*pwd\n(\S+)/)] },
        { id: 'back', cells: ['cd -', `${read(s5, /cd -\n(\S+)/)}: back`] },
      ] },
    ] },
  ],
)

// 2.6 — make, copy, move, remove; rm has no undo. The trace's "asked 4 times" is the transcript's count.
const asked = (s6.match(/^rm: (descend|remove) .*\? y$/gm) ?? []).length
const files = consoleFrame(
  consoleNode(WEB, s6, { highlight: [rowOf(s6, 'overwrite'), rowOf(s6, 'Is a directory'), rowOf(s6, 'rm -ri site')] }),
  [
    { type: 'group', id: 'reach', title: 'rm, and how much it removes', icon: 'file', tone: 'consume', dir: 'row', children: [
      { type: 'item', id: 'rmf', title: 'rm file', sub: 'gone: no bin, no undo', stack: true, tone: 'consume' },
      { type: 'item', id: 'rmd', title: 'rm dir', sub: 'refused: Is a directory', stack: true, tone: 'store' },
      { type: 'item', id: 'rmri', title: 'rm -ri dir', sub: `all of it, asking ${asked} times`, stack: true, tone: 'consume' },
    ] },
    { type: 'table', id: 'trace', title: 'site/ after each command', tone: 'ingest', fill: true, columns: ['command', 'site/ now holds'], rows: [
      ['mkdir site', '(empty)'],
      ['touch site/index.html', 'index.html'],
      ['cp … copy.html', 'index.html, copy.html'],
      ['mv … about.html', 'index.html, about.html: renamed'],
      ['mkdir site/css', '+ css/'],
      ['cp /etc/hostname … notes.txt', '+ notes.txt'],
      { id: 'mvi', cells: ['mv -i …, answered n', `unchanged: still ${read(s6, /cat site\/notes\.txt\n(\S+)/)}`], tone: 'infra' },
      { id: 'rm1', cells: ['rm site/about.html', 'index.html, notes.txt, css/'], tone: 'consume' },
      { id: 'rm2', cells: ['rm site', 'unchanged'] },
      { id: 'rm3', cells: ['rm -ri site', 'site/ is gone'], tone: 'consume' },
    ] },
  ],
  [{ from: 'rmf', to: 'rmd' }, { from: 'rmd', to: 'rmri', label: '-r' }],
)

// 2.7 — reading files: the whole, the ends, the count, and a pager for the long ones. The account
// line is the real last row of /etc/passwd (course 5 comes back to it).
const account = read(s7, /\n(sysops:[^\n]+)/).split(':')
const FIELDS = ['name', 'password', 'user id', 'group id', 'comment', 'home', 'shell']
const reading = consoleFrame(ttyNode('less /var/log/README — web-01', lessReadme, (() => {
  // less drew the whole README bottom-aligned: its first non-blank row must survive the crop
  const first = lessReadme.screen.findIndex((r) => r.trim())
  if (lessReadme.screen.length - first > CONSOLE.rows) throw new Error('2.7: the README is taller than the console; cropping would cut it')
  return CONSOLE.rows
})()), [
  { type: 'group', id: 'passwd', title: `tail -n 1 of /etc/passwd: one account, seven fields`, icon: 'user', tone: 'store', dir: 'grid', cols: 2, children: account.map((v, i) => (
    { type: 'item' as const, id: `f${i}`, title: i === 1 ? `${v}: in /etc/shadow` : v, sub: FIELDS[i], chip: true, ...(i === 6 ? { span: 'all' as const } : {}) })) },
  { type: 'table', id: 'tools', title: 'Which tool for which file', tone: 'ingest', fill: true, columns: ['tool', 'shows', 'for'], rows: [
    ['cat', 'all of it', 'short files'],
    ['head -n 3', 'the first lines', 'a file’s start'],
    ['tail -n 2', 'the last lines', 'the newest entries'],
    ['wc -l', 'how many lines', `${read(s7, /wc -l \/etc\/passwd\n(\d+) /)} in /etc/passwd`],
    ['less', 'a screen at a time', 'anything long'],
  ] },
])

export const shellScenes: Record<string, SceneModel> = {
  'shell-ssh-in': sshIn,
  'shell-commands': commands,
  'shell-man-and-help': manAndHelp,
  'shell-filesystem-tree': filesystemTree,
  'shell-paths': paths,
  'shell-files': files,
  'shell-reading-files': reading,
}
