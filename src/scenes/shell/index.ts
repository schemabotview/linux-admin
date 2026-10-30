import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode, ttyNode } from '../frame'
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
    { type: 'table', id: 'banner', title: 'What printed the login messages', tone: 'source', fill: true, columns: ['message', 'printed by'], rows: [
      ['Linux web-01 6.12…', '/etc/update-motd.d/10-uname, at each login'],
      ['The programs included…', '/etc/motd: a fixed text file'],
      ['Last login: …', 'sshd, from the login records'],
    ] },
    { type: 'table', id: 'sudo', title: 'What sudo -i changed', tone: 'consume', fill: true, columns: ['', 'before', 'after'], rows: [
      ['whoami', read(s1, /\$ whoami\n(\S+)/), read(s1, /# whoami\n(\S+)/)],
      ['pwd', read(s1, /\$ pwd\n(\S+)/), read(s1, /# pwd\n(\S+)/)],
      ['prompt ends', '$', '#'],
      ['password asked', '—', 'sysops’s own, not root’s'],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: 'A # prompt can change anything on the machine, with no confirmation. Leave root with exit as soon as the job is done.' },
  ],
  [{ from: 'ops', to: 'web', label: 'ssh web-01' }],
)

// 2.2 — one command line taken apart, and the fields of a real `ls -l` row.
const longRow = outputOf(s2, 'ls -l /etc/hostname').trim().split(/\s+/)
const hidden = outputOf(s2, 'ls -a').trim().split(/\s+/)
const DOT: Record<string, string> = {
  '.': 'this directory', '..': 'the one above', '.bash_history': 'commands you typed before',
  '.bash_logout': 'run when you log out', '.bashrc': 'the shell’s settings', '.profile': 'read at login', '.ssh': 'the keys allowed to log in',
}
const commands = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, 'ls -l -h /etc/ssh/sshd_config'), rowOf(s2, "invalid option")] }),
  [
    { type: 'group', id: 'line', title: 'ls -l -h /etc/ssh/sshd_config', icon: 'terminal', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'cmd', title: 'ls', sub: 'the command: a program to run', stack: true },
      { type: 'item', id: 'opts', title: '-l -h', sub: 'options: how to run it (long, human sizes)', stack: true, tone: 'infra' },
      { type: 'item', id: 'arg', title: '/etc/ssh/sshd_config', sub: 'an argument: what to run it on', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'forms', title: 'The same options, written three ways', tone: 'infra', fill: true, columns: ['written', 'means'], rows: [
      ['ls -l -h', 'two short options'],
      ['ls -lh', 'short options combined'],
      ['ls --all', 'a long option: the same as -a'],
    ] },
    { type: 'table', id: 'long', title: `What -l adds: ${longRow.join(' ').replace(/ +/g, ' ')}`, tone: 'store', fill: true, columns: ['field', 'here', 'means'], rows: [
      { id: 'mode', cells: ['type and permissions', longRow[0], 'a file (-); who may read and write it — course 5'] },
      { id: 'links', cells: ['links', longRow[1], 'names this file has'] },
      { id: 'owner', cells: ['owner, group', `${longRow[2]}, ${longRow[3]}`, 'who owns it'] },
      { id: 'size', cells: ['size', longRow[4], 'bytes: the name, plus a newline'] },
      { id: 'time', cells: ['modified', longRow.slice(5, 8).join(' '), 'last written: at the VM’s first boot'] },
    ] },
    { type: 'table', id: 'hidden', title: `ls -a in ~: ${hidden.length} names a plain ls hides`, tone: 'source', fill: true, columns: ['name', 'is'], rows: hidden.map((n) => [n, DOT[n] ?? (() => { throw new Error(`2.2: ls -a shows ${n}, which the picture does not explain`) })()]) },
    { type: 'note', id: 'note', tone: 'consume', text: 'An option the command does not know stops it before it does anything: ls -z prints an error and a hint, and lists nothing.' },
  ],
  [{ from: 'cmd', to: 'opts' }, { from: 'opts', to: 'arg' }],
)

// 2.3 — the manual, on its own screen; `man -f` names the sections a page lives in.
const manIndex = outputOf(s3, 'man -f ls passwd')
const manAndHelp = consoleFrame(ttyNode('man ls — web-01', manLs), [
  { type: 'code', id: 'help', console: true, filename: WEB, code: `sysops@web-01:~$ man -f ls passwd\n${manIndex}` },
  { type: 'table', id: 'sections', title: 'The manual’s sections', tone: 'ingest', fill: true, columns: ['section', 'holds', 'e.g.'], rows: [
    { id: 's1', cells: ['1', 'commands anyone can run', 'ls(1), passwd(1)'], tone: 'ingest' },
    { id: 's5', cells: ['5', 'file formats', 'passwd(5): /etc/passwd'] },
    { id: 's8', cells: ['8', 'administration commands', 'sshd(8)'] },
  ] },
  { type: 'table', id: 'keys', title: 'Inside man (it pages with less)', tone: 'infra', fill: true, columns: ['key', 'does'], rows: [
    ['space / b', 'a page forward / back'],
    ['/word', 'search; n for the next match'],
    ['q', 'quit, back to the prompt'],
  ] },
  { type: 'table', id: 'synopsis', title: 'Reading the synopsis: ls [OPTION]... [FILE]...', tone: 'store', fill: true, columns: ['written', 'means'], rows: [
    ['ls (bold)', 'type it exactly'],
    ['[ … ]', 'optional'],
    ['...', 'may be repeated'],
    ['OPTION, FILE', 'replace with your own'],
  ] },
  { type: 'note', id: 'note', tone: 'ingest', text: `ls --help prints a summary and returns; man ls opens the full manual on its own screen. The screen on the left is man's, exactly as the terminal drew it.` },
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
      { type: 'table', id: 'steps', title: 'cd ../default from /etc/ssh', tone: 'ingest', fill: true, columns: ['step', 'now in'], rows: [
        ['start', '/etc/ssh'],
        ['..', '/etc'],
        ['default', '/etc/default'],
      ] },
    ] },
    { type: 'table', id: 'moves', title: 'Where each cd lands', tone: 'ingest', fill: true, columns: ['typed', 'kind', 'lands in'], rows: [
      { id: 'abs', cells: ['cd /etc/ssh', 'absolute: from /', '/etc/ssh'] },
      { id: 'rel', cells: ['cd ../default', 'relative: up one, then down', read(s5, /cd \.\.\/default\n.*pwd\n(\S+)/)], tone: 'ingest' },
      { id: 'home', cells: ['cd ~', 'home', read(s5, /cd ~\n.*pwd\n(\S+)/)] },
      { id: 'back', cells: ['cd -', 'back to the last place', read(s5, /cd -\n(\S+)/)] },
    ] },
    { type: 'note', id: 'note', tone: 'ingest', text: 'An absolute path starts with / and means the same from anywhere. A relative path starts from where you are: .. is the directory above, . is this one.' },
  ],
)

// 2.6 — make, copy, move, remove; rm has no undo. The trace's "asked 4 times" is the transcript's count.
const asked = (s6.match(/^rm: (descend|remove) .*\? y$/gm) ?? []).length
const files = consoleFrame(
  consoleNode(WEB, s6, { highlight: [rowOf(s6, 'overwrite'), rowOf(s6, 'Is a directory'), rowOf(s6, 'rm -ri site')] }),
  [
    { type: 'table', id: 'trace', title: 'site/ after each command', tone: 'ingest', fill: true, columns: ['command', 'did', 'site/ now holds'], rows: [
      ['mkdir site', 'made a directory', '(empty)'],
      ['touch site/index.html', 'made an empty file', 'index.html'],
      ['cp …index.html …copy.html', 'a second file, same bytes', 'index.html, copy.html'],
      ['mv …copy.html …about.html', 'the same file, new name', 'index.html, about.html'],
      ['mkdir site/css', 'a directory inside', '+ css/'],
      ['cp /etc/hostname …notes.txt', 'a file with something in it', '+ notes.txt'],
      { id: 'mvi', cells: ['mv -i …about.html …notes.txt', 'asked first; answered n', 'unchanged'], tone: 'infra' },
      { id: 'rm1', cells: ['rm site/about.html', 'removed it: no bin, no undo', 'index.html, notes.txt, css/'], tone: 'consume' },
      { id: 'rm2', cells: ['rm site', 'refused: Is a directory', 'unchanged'] },
      { id: 'rm3', cells: ['rm -ri site', `asked ${asked} times, removed all`, 'site/ is gone'], tone: 'consume' },
    ] },
    { type: 'group', id: 'state', bare: true, dir: 'grid', cols: 2, children: [
      { type: 'table', id: 'reach', title: 'rm, and how much it removes', tone: 'consume', fill: true, columns: ['typed', 'removes'], rows: [
        ['rm file', 'that file'],
        ['rm dir', 'nothing: “Is a directory”'],
        ['rm -r dir', 'dir and everything in it'],
        ['rm -ri dir', 'the same, asking at each step'],
      ] },
      { type: 'table', id: 'replace', title: 'cp and mv onto a name that exists', tone: 'infra', span: 'all', columns: ['typed', 'what happens to the old file'], rows: [
        ['mv a b, cp a b', 'replaced, without a question'],
        { id: 'kept', cells: ['mv -i a b, cp -i a b', `asks first: “${read(s6, /(overwrite '[^']+'\?)/)}”`], tone: 'infra' },
        ['cat site/notes.txt after n', read(s6, /cat site\/notes\.txt\n(\S+)/) + ': the old contents, kept'],
      ] },
      { type: 'table', id: 'habits', title: 'Before any rm -r', tone: 'store', fill: true, columns: ['habit'], rows: [
        ['ls the exact path first'],
        ['read the prompt: which machine?'],
        ['not as root unless you must'],
        ['-i when it is not routine'],
      ] },
      { type: 'note', id: 'note', tone: 'consume', span: 'all', text: 'rm refuses a directory; rm -r removes it and everything under it, at once. -i asks first, one entry at a time — answer every question before you type y.' },
    ] },
  ],
)

// 2.7 — reading files: the whole, the ends, the count, and a pager for the long ones. The account
// line is the real last row of /etc/passwd (course 5 comes back to it).
const account = read(s7, /\n(sysops:[^\n]+)/).split(':')
const reading = consoleFrame(ttyNode('less /var/log/README — web-01', lessReadme), [
  { type: 'code', id: 'short', console: true, filename: WEB, code: s7.split('\n').slice(0, rowOf(s7, 'less /var/log/README') - 1).join('\n') },
  { type: 'table', id: 'tools', title: 'Which tool for which file', tone: 'ingest', fill: true, columns: ['tool', 'shows', 'for'], rows: [
    ['cat', 'all of it', 'short files'],
    ['head -n 3', 'the first lines', 'a file’s start'],
    ['tail -n 2', 'the last lines', 'the newest log entries'],
    ['wc -l', 'how many lines', `${read(s7, /(\d+) \/etc\/passwd/)} in /etc/passwd`],
    ['less', 'a screen at a time', 'anything long'],
  ] },
  { type: 'table', id: 'passwd', title: `One account, one line: ${account.join(':')}`, tone: 'store', fill: true, columns: ['field', 'here'], rows: [
    ['name', account[0]],
    ['password', `${account[1]}: kept in /etc/shadow`],
    ['user id, group id', `${account[2]}, ${account[3]}`],
    ['comment', account[4]],
    ['home, shell', `${account[5]}, ${account[6]}`],
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
