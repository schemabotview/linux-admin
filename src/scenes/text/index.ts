import type { SceneModel } from '@graphlearning/graphl-flow'
import { PICTURE_W, consoleFrame, consoleNode, ttyNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/text/01-standard-streams/session.txt?raw'
import s2 from '../../../spine/text/02-pipes/session.txt?raw'
import s3 from '../../../spine/text/03-grep-and-regex/session.txt?raw'
import s4 from '../../../spine/text/04-cut-sort-uniq/session.txt?raw'
import s5 from '../../../spine/text/05-find/session.txt?raw'
import s6 from '../../../spine/text/06-quoting-and-globbing/session.txt?raw'
import nano from '../../../spine/text/07-editing-a-file/tty/nano.json'
import vimInsert from '../../../spine/text/07-editing-a-file/tty/vim-insert.json'
import vimCommand from '../../../spine/text/07-editing-a-file/tty/vim-command.json'

// Course 4 — Text is the interface. Everything reads nginx's real access log (traffic: lab/scripts/traffic.sh).
const WEB = 'sysops@web-01: ~'
const LOG = '/var/log/nginx/access.log'

/** A command's output with the terminal's wraps undone: a row that is exactly 80 wide continues. */
const unwrap = (out: string) => out.split('\n').reduce<string[]>((acc, r) => {
  if (acc.length && acc[acc.length - 1].length % 80 === 0 && acc[acc.length - 1].length > 0) acc[acc.length - 1] += r
  else acc.push(r)
  return acc
}, [])
/** A count a command printed alone on its row (`grep -c`, `wc -l` of a pipe). */
const count = (s: string, cmd: string) => {
  const out = outputOf(s, cmd).trim()
  if (!/^\d+$/.test(out)) throw new Error(`${cmd} printed ${JSON.stringify(out)}, not a count`)
  return out
}

// 4.1 — ◆ full scene: three streams per process, and redirection rewires them. The fd table is the
// real /proc/self/fd of the `ls` that listed it.
const fds = outputOf(s1, 'ls -l /proc/self/fd').split('\n').filter((l) => l.startsWith('l')).map((l) => {
  const m = l.match(/ (\d+) -> (\S+)$/)!
  return { fd: m[1], to: m[2] }
}).filter((f) => +f.fd <= 2)
const NAMES = ['stdin', 'stdout', 'stderr']
const streams: SceneModel = {
  title: 'stdin, stdout, stderr',
  sub: 'every process starts with three open files — and the shell decides where they lead',
  dir: 'row',
  nodes: [
    { type: 'code', id: 'run', console: true, filename: WEB, code: s1.trimEnd() },
    { type: 'group', id: 'right', bare: true, children: [
      { type: 'group', id: 'proc', title: 'ls, as the kernel sees it', icon: 'cpu', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'kbd', title: 'the keyboard', sub: 'what you type', icon: 'terminal', stack: true },
        { type: 'table', id: 'fd', title: 'ls -l /proc/self/fd', tone: 'ingest', columns: ['fd', 'name', 'leads to'], rows: fds.map((f) => ({ id: f.fd, cells: [f.fd, NAMES[+f.fd], f.to] })) },
        { type: 'item', id: 'term', title: 'the terminal', sub: fds[1].to, icon: 'screen', stack: true },
      ] },
      { type: 'table', id: 'redir', title: 'What each redirection rewired, in the session', tone: 'infra', fill: true, columns: ['typed', 'stdout went to', 'stderr went to'], rows: [
        ['ls /etc/hostname /nope', 'the terminal', 'the terminal'],
        { id: 'r1', cells: ['… > out.txt', `out.txt: ${outputOf(s1, 'cat out.txt').trim()}`, 'still the terminal'], tone: 'infra' },
        { id: 'r2', cells: ['… 2> err.txt', 'the terminal', 'err.txt: the error'], tone: 'infra' },
        ['… 2> /dev/null', 'the terminal', 'nowhere: discarded (4.5)'],
      ] },
      { type: 'note', id: 'why', tone: 'ingest', text: 'Errors have their own stream so a program’s results can go to a file or the next program while its complaints still reach you.' },
    ] },
  ],
  edges: [{ from: 'kbd', to: 'fd.0' }, { from: 'fd.1', to: 'term' }, { from: 'fd.2', to: 'term' }],
}

// 4.2 — pipes, and one line of the log read field by field.
const line = unwrap(outputOf(s2, `head -n 2 ${LOG}`)).find((l) => l.startsWith('127.'))!
const f = line.match(/^(\S+) - - \[([^\]]+)\] "([^"]+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/)
if (!f) throw new Error(`4.2: the access-log line does not parse: ${line}`)
const pipes = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, `grep ' 404 ' ${LOG} | wc -l`), rowOf(s2, `grep ' 404 ' ${LOG} | wc -l`) + 1] }),
  [
    { type: 'group', id: 'pipe', title: `grep ' 404 ' access.log | wc -l`, icon: 'filter', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'file', title: 'access.log', sub: `${read(s2, /(\d+) \/var\/log\/nginx\/access\.log/)} lines`, icon: 'file', stack: true },
      { type: 'item', id: 'grep', title: 'grep \' 404 \'', sub: 'keeps matches', icon: 'filter', stack: true },
      { type: 'item', id: 'wc', title: 'wc -l', sub: 'counts what arrives', icon: 'chart', stack: true },
      { type: 'item', id: 'n', title: count(s2, `grep ' 404 ' ${LOG} | wc -l`), sub: 'requests that got 404', icon: 'check', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'fields', title: 'One line of the access log', tone: 'store', fill: true, columns: ['field', 'here'], rows: [
      ['client address', f[1]], ['time', f[2]], ['request', f[3]], ['status', `${f[4]}: OK`], ['bytes sent', f[5]], ['user agent', f[7]],
    ] },
  ],
  [{ from: 'file', to: 'grep' }, { from: 'grep', to: 'wc', label: '|' }, { from: 'wc', to: 'n' }],
)

// 4.3 — patterns. Every count is the one grep printed.
const P_ALT = `grep -c -E '"GET /(wp-login\\.php|\\.env|admin) ' ${LOG}`
const P_CLASS = `grep -c -E '" [45][0-9]{2} ' ${LOG}`
const P_ONLY = `grep -o -E '^127\\.0\\.0\\.6[0-9]' ${LOG} | head -n 2`
const grepRegex = consoleFrame(
  consoleNode(WEB, s3, { highlight: [rowOf(s3, '"GET /(wp-login'), rowOf(s3, '[45][0-9]{2}')] }),
  [
    { type: 'group', id: 'pattern', title: `'"GET /(wp-login\\.php|\\.env|admin) ', piece by piece`, icon: 'filter', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'lit', title: '"GET /', sub: 'exactly these characters', stack: true },
      { type: 'item', id: 'alt', title: '( a | b | c )', sub: 'any one alternative (-E)', stack: true },
      { type: 'item', id: 'dot', title: '\\.', sub: 'a real dot, not any character', stack: true },
      { type: 'item', id: 'hits', title: count(s3, P_ALT), sub: 'requests probed', icon: 'check', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'asked', title: 'Five questions to the log', tone: 'store', fill: true, columns: ['question', 'grep', 'answer'], rows: [
      ['asked for wp-login?', "-c 'wp-login'", count(s3, `grep -c 'wp-login' ${LOG}`)],
      ['probed three paths?', "-c -E '(…|…|…)'", count(s3, P_ALT)],
      ['a 4xx or 5xx?', "-c -E '[45][0-9]{2}'", count(s3, P_CLASS)],
      ['not a browser?', "-v -c 'Mozilla'", count(s3, `grep -v -c 'Mozilla' ${LOG}`)],
      ['an address in the 60s?', "-o -E '^127…6[0-9]'", outputOf(s3, P_ONLY).trim().split('\n')[0]],
    ] },
  ],
  [{ from: 'lit', to: 'alt' }, { from: 'alt', to: 'dot' }, { from: 'dot', to: 'hits' }],
)

// 4.4 — top clients, one stage at a time. The chart is the real `uniq -c`.
const perClient = outputOf(s4, `cut -d ' ' -f 1 ${LOG} | sort | uniq -c`).trim().split('\n').map((l) => l.trim().split(/\s+/)).map(([n, ip]) => ({ ip, n: +n }))
const cutSortUniq = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, 'uniq -c | so')] }),
  [
    { type: 'group', id: 'stages', title: 'Five small programs, one question', icon: 'workflow', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'cut', title: 'cut -f 1', sub: 'the client', stack: true },
      { type: 'item', id: 'sort', title: 'sort', sub: 'groups equals', stack: true },
      { type: 'item', id: 'uniq', title: 'uniq -c', sub: 'counts runs', stack: true },
      { type: 'item', id: 'rank', title: 'sort -rn', sub: 'ranks', stack: true },
      { type: 'item', id: 'head', title: 'head -n 3', sub: 'top three', stack: true, tone: 'store' },
    ] },
    { type: 'plot', id: 'chart', title: 'Requests per client (uniq -c), by the address’s last part', w: PICTURE_W, x: { labels: perClient.map((c) => c.ip.split(/[.:]/).filter(Boolean).pop()!) },
      y: { min: 0, max: Math.ceil(Math.max(...perClient.map((c) => c.n)) / 10) * 10, step: 10, label: 'requests' },
      series: [{ kind: 'bar', points: perClient.map((c, i) => [i, c.n]), tone: 'ingest' }] },
  ],
  [{ from: 'cut', to: 'sort' }, { from: 'sort', to: 'uniq' }, { from: 'uniq', to: 'rank' }, { from: 'rank', to: 'head' }],
)

// 4.5 — find: a search of the tree, by name, type and size.
const lines = (cmd: string) => outputOf(s5, cmd).trim().split('\n')
const DENIED = read(s5, /find: (‘[^’]+’): Permission denied/)
const QUIET = "find /var/log -name '*.log' 2> /dev/null"
const find = consoleFrame(
  consoleNode(WEB, s5, {
    // the quiet run's list repeats the noisy one's: keep its first rows (the error is gone), fold the rest
    show: [[1, rowOf(s5, QUIET) + 4], [rowOf(s5, '$ find /etc/nginx -type l'), s5.trimEnd().split('\n').length]],
    highlight: [rowOf(s5, 'Permission denied'), rowOf(s5, QUIET)],
  }),
  [
    { type: 'group', id: 'streams', title: QUIET, icon: 'search', tone: 'ingest', children: [
      { type: 'item', id: 'walk', title: 'find', sub: 'walks /var/log, tests each name', icon: 'search' },
      { type: 'group', id: 'out', bare: true, dir: 'row', children: [
        { type: 'item', id: 'res', title: `${lines(QUIET).length} logs`, sub: 'stdout: the terminal', icon: 'screen', stack: true, tone: 'store' },
        { type: 'item', id: 'err', title: DENIED, sub: 'stderr: /dev/null, discarded', icon: 'lock', stack: true, tone: 'consume' },
      ] },
    ] },
    { type: 'table', id: 'tests', title: 'find <where> <test>: what each search found', tone: 'store', fill: true, columns: ['test', 'found'], rows: [
      ["-name '*.conf'", `${lines("find /etc/nginx -name '*.conf'").length} names ending .conf, in /etc/nginx`],
      ["-name '*.log'", `${lines(QUIET).length} logs under /var/log`],
      ['-type l', `a link: ${lines('find /etc/nginx -type l')[0].replace('/etc/nginx/', '')}`],
      ['-type f -size +5M', `${lines('find /usr -type f -size +5M').length} files over 5 MiB, in /usr`],
    ] },
  ],
  [{ from: 'walk', to: 'res' }, { from: 'walk', to: 'err' }],
)

// 4.6 — the shell rewrites the line before the program runs. Every "passed" cell is what echo printed.
const echoed = (cmd: string) => outputOf(s6, cmd).trim()
const quoting = consoleFrame(
  consoleNode(WEB, s6, { show: [[1, rowOf(s6, '$ ls /etc/n*') + 1], [rowOf(s6, '/etc/nginx:'), s6.trimEnd().split('\n').length]] }),
  [
    { type: 'table', id: 'cases', title: 'echo, typed eight ways: what the shell did', tone: 'ingest', fill: true, columns: ['echo …', 'the shell'], rows: [
      ['/etc/nginx/*.conf', `* matched ${echoed('echo /etc/nginx/*.conf').split(' ').length} names`],
      ["'/etc/nginx/*.conf'", "'…' stopped the glob"],
      ['/etc/nginx/*.nothing', `no match: ${echoed('echo /etc/nginx/*.nothing') === '/etc/nginx/*.nothing' ? 'left as typed' : 'expanded'}`],
      ['$HOME', `expanded: ${echoed('echo $HOME')}`],
      ["'$HOME'", `not inside '…': ${echoed("echo '$HOME'")}`],
      ['"$HOME"', `but inside "…": ${echoed('echo "$HOME"')}`],
      ['two     spaces', `split: ${echoed('echo two     spaces').split(' ').length} words`],
      ["'two     spaces'", 'one word, kept whole'],
    ] },
    { type: 'group', id: 'order', title: 'What the shell does, before the program starts', icon: 'terminal', tone: 'infra', dir: 'row', children: [
      { type: 'item', id: 'vars', title: '$ variables', sub: '$HOME → /home/sysops', stack: true },
      { type: 'item', id: 'split', title: 'word splitting', sub: 'at unquoted spaces', stack: true },
      { type: 'item', id: 'glob', title: 'globs', sub: '* ? [ ] → file names', stack: true },
      { type: 'item', id: 'quotes', title: 'quote removal', sub: 'then the program runs', stack: true, tone: 'store' },
    ] },
  ],
  [{ from: 'vars', to: 'split' }, { from: 'split', to: 'glob' }, { from: 'glob', to: 'quotes' }],
)

// 4.7 — editing: vim's modes, nano's shortcut bar. The console slot is vim, as the terminal drew it.
const status = (g: { screen: string[] }) => g.screen[g.screen.length - 1].trim()
const editing = consoleFrame(ttyNode('vim notes.txt — web-01', vimInsert), [
  { type: 'group', id: 'modes', title: 'vim has modes: keys mean different things in each', icon: 'code', tone: 'ingest', dir: 'row', children: [
    { type: 'item', id: 'normal', title: 'normal', sub: 'keys are commands', stack: true },
    { type: 'item', id: 'insert', title: 'insert', sub: `typing is text, and vim shows ${status(vimInsert).split(/\s{2,}/)[0]}`, stack: true, tone: 'store' },
    { type: 'item', id: 'cmdline', title: 'command line', sub: `${status(vimCommand)} saves, :q! discards`, stack: true, tone: 'infra' },
  ] },
  { type: 'table', id: 'keys', title: 'The keys that matter', tone: 'infra', fill: true, columns: ['editor', 'key', 'does'], rows: [
    ['vim', 'i', 'insert mode: typing is text'],
    ['vim', 'Esc', 'back to normal mode'],
    ['vim', status(vimCommand), 'write the file, and quit'],
    ['vim', ':q!', 'quit, throwing changes away'],
    ['nano', read(nano.screen.at(-2)!, /(\^O) Write/), 'Ctrl+O writes the file out'],
    ['nano', read(nano.screen.at(-1)!, /(\^X) Exit/), 'Ctrl+X exits'],
  ] },
], [{ from: 'normal', to: 'insert', label: 'i' }, { from: 'insert', to: 'cmdline', label: 'Esc :' }])

export const textScenes: Record<string, SceneModel> = {
  'text-streams': streams,
  'text-pipes': pipes,
  'text-grep': grepRegex,
  'text-cut-sort-uniq': cutSortUniq,
  'text-find': find,
  'text-quoting': quoting,
  'text-editing': editing,
}
