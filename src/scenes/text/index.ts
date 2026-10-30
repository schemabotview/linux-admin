import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode, ttyNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/text/01-standard-streams/session.txt?raw'
import s2 from '../../../spine/text/02-pipes/session.txt?raw'
import s3 from '../../../spine/text/03-grep-and-regex/session.txt?raw'
import s4 from '../../../spine/text/04-cut-sort-uniq/session.txt?raw'
import s5 from '../../../spine/text/05-find/session.txt?raw'
import s6 from '../../../spine/text/06-quoting-and-globbing/session.txt?raw'
import s7 from '../../../spine/text/07-editing-a-file/session.txt?raw'
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
      { type: 'item', id: 'grep', title: 'grep \' 404 \'', sub: 'keeps the lines that match', icon: 'filter', stack: true },
      { type: 'item', id: 'wc', title: 'wc -l', sub: 'counts what arrives', icon: 'chart', stack: true },
      { type: 'item', id: 'n', title: count(s2, `grep ' 404 ' ${LOG} | wc -l`), sub: 'requests that got 404', icon: 'check', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'fields', title: 'One line of the access log', tone: 'store', fill: true, columns: ['field', 'here'], rows: [
      ['client address', f[1]], ['time', f[2]], ['request', f[3]], ['status', `${f[4]}: OK`], ['bytes sent', f[5]], ['user agent', f[7]],
    ] },
    { type: 'note', id: 'note', tone: 'ingest', text: 'A | joins one program’s stdout to the next one’s stdin. Neither knows the other exists: grep writes lines, wc counts lines, and the shell connects them.' },
  ],
  [{ from: 'file', to: 'grep' }, { from: 'grep', to: 'wc', label: '|' }, { from: 'wc', to: 'n' }],
)

// 4.3 — patterns. Every count is the one grep printed.
const P_ALT = `grep -c -E '"GET /(wp-login\\.php|\\.env|admin) ' ${LOG}`
const P_CLASS = `grep -c -E '" [45][0-9]{2} ' ${LOG}`
const grepRegex = consoleFrame(
  consoleNode(WEB, s3, { highlight: [rowOf(s3, '"GET /(wp-login'), rowOf(s3, '[45][0-9]{2}')] }),
  [
    { type: 'table', id: 'asked', title: 'Four questions to the log', tone: 'ingest', fill: true, columns: ['question', 'grep', 'lines'], rows: [
      ['asked for wp-login?', "-c 'wp-login'", count(s3, `grep -c 'wp-login' ${LOG}`)],
      ['probed any of three paths?', "-c -E '(…|…|…)'", count(s3, P_ALT)],
      ['answered 4xx or 5xx?', "-c -E '[45][0-9]{2}'", count(s3, P_CLASS)],
      ['not a browser?', "-v -c 'Mozilla'", count(s3, `grep -v -c 'Mozilla' ${LOG}`)],
    ] },
    { type: 'table', id: 'parts', title: 'The pattern pieces', tone: 'store', fill: true, columns: ['piece', 'matches'], rows: [
      ['GET /', 'exactly those characters'],
      ['(a|b|c)', 'any one of the alternatives (-E)'],
      ['\\.', 'a real dot; a bare . means any character'],
      ['[45]', 'one character from the set: 4 or 5'],
      ['[0-9]{2}', 'two digits'],
      ['^127', 'at the start of the line'],
    ] },
    { type: 'table', id: 'flags', title: 'grep’s options here', tone: 'infra', fill: true, columns: ['option', 'does'], rows: [
      ['-c', 'counts matching lines instead of printing them'],
      ['-v', 'inverts: the lines that do NOT match'],
      ['-E', 'extended patterns: ( | ) and { }'],
      ['-o', `prints only the match: ${outputOf(s3, 'grep -o -E \'^127\\.0\\.0\\.6[0-9]\' /var/log/nginx/access.log | head -n 2').trim().split('\n')[0]}`],
    ] },
  ],
)

// 4.4 — top clients, one stage at a time. The chart is the real `uniq -c`.
const perClient = outputOf(s4, `cut -d ' ' -f 1 ${LOG} | sort | uniq -c`).trim().split('\n').map((l) => l.trim().split(/\s+/)).map(([n, ip]) => ({ ip, n: +n }))
const perStatus = outputOf(s4, `cut -d ' ' -f 9 ${LOG} | sort | uniq -c`).trim().split('\n').map((l) => l.trim().split(/\s+/))
const cutSortUniq = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, 'uniq -c | so')] }),
  [
    { type: 'group', id: 'stages', title: 'Five small programs, one question', icon: 'workflow', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'cut', title: 'cut -f 1', sub: 'first field: the client', stack: true },
      { type: 'item', id: 'sort', title: 'sort', sub: 'equal lines together', stack: true },
      { type: 'item', id: 'uniq', title: 'uniq -c', sub: 'count each run', stack: true },
      { type: 'item', id: 'rank', title: 'sort -rn', sub: 'biggest count first', stack: true },
      { type: 'item', id: 'head', title: 'head -n 3', sub: 'the top three', stack: true, tone: 'store' },
    ] },
    { type: 'plot', id: 'chart', title: 'Requests per client (uniq -c), by the address’s last part', compact: true, x: { labels: perClient.map((c) => c.ip.split(/[.:]/).filter(Boolean).pop()!) },
      y: { min: 0, max: Math.ceil(Math.max(...perClient.map((c) => c.n)) / 10) * 10, step: 10, label: 'requests' },
      series: [{ kind: 'bar', points: perClient.map((c, i) => [i, c.n]), tone: 'ingest' }] },
    { type: 'table', id: 'status', title: 'Field 9: the status codes', tone: 'store', fill: true, columns: ['status', 'lines'], rows: perStatus.map(([n, code]) => ({ id: code, cells: [code, n], tone: code === '404' ? 'consume' as const : undefined })) },
  ],
  [{ from: 'cut', to: 'sort' }, { from: 'sort', to: 'uniq' }, { from: 'uniq', to: 'rank' }, { from: 'rank', to: 'head' }],
)

// 4.5 — find: a search of the tree, by name, type and size.
const lines = (cmd: string) => outputOf(s5, cmd).trim().split('\n')
const find = consoleFrame(
  consoleNode(WEB, s5, { highlight: [rowOf(s5, 'Permission denied'), rowOf(s5, "2> /dev/null")] }),
  [
    { type: 'table', id: 'tests', title: 'find <where> <test>: what each search found', tone: 'ingest', fill: true, columns: ['test', 'means', 'found'], rows: [
      ["-name '*.conf'", 'the name matches (quoted: find does the matching)', `${lines("find /etc/nginx -name '*.conf'").length} in /etc/nginx`],
      ["-name '*.log'", 'the same, under /var/log', `${lines("find /var/log -name '*.log' 2> /dev/null").length} logs`],
      ['-type l', 'a symbolic link', lines('find /etc/nginx -type l')[0]],
      ['-size +5M', 'bigger than 5 MiB', `${lines('find /usr -type f -size +5M').length} files in /usr`],
    ] },
    { type: 'table', id: 'big', title: 'find /usr -type f -size +5M', tone: 'store', fill: true, columns: ['file'], rows: lines('find /usr -type f -size +5M').map((l) => [l]) },
    { type: 'table', id: 'denied', title: 'The one error, and where it went', tone: 'consume', fill: true, columns: ['', ''], rows: [
      ['the error', read(s5, /find: (‘[^’]+’: Permission denied)/)],
      ['why', 'sysops may not read that directory'],
      ['2> /dev/null', 'sends stderr nowhere: the results stay'],
    ] },
  ],
)

// 4.6 — the shell rewrites the line before the program runs. Every "passed" cell is what echo printed.
const echoed = (cmd: string) => outputOf(s6, cmd).trim()
// what `/etc/n*` became: the files ls named on its first row, then each directory it headed with `name:`
const nOut = outputOf(s6, 'ls /etc/n*').split('\n')
const globbed = [...nOut[0].trim().split(/\s+/), ...nOut.filter((l) => /^\/etc\/n\S*:$/.test(l)).map((l) => l.slice(0, -1))].sort()
const quoting = consoleFrame(
  consoleNode(WEB, s6, { show: [[1, rowOf(s6, '$ ls /etc/n*') + 1], [rowOf(s6, '/etc/nginx:'), rowOf(s6, '/etc/nginx:')], [s6.trimEnd().split('\n').length, s6.trimEnd().split('\n').length]] }),
  [
    { type: 'table', id: 'cases', title: 'Typed, and what echo was given', tone: 'ingest', fill: true, columns: ['typed', 'echo printed', 'because'], rows: [
      ['echo /etc/nginx/*.conf', echoed('echo /etc/nginx/*.conf'), '* matched two names'],
      ["echo '/etc/nginx/*.conf'", echoed("echo '/etc/nginx/*.conf'"), "'…' stops everything"],
      ['echo /etc/nginx/*.nothing', echoed('echo /etc/nginx/*.nothing'), 'no match: left as typed'],
      ['echo $HOME', echoed('echo $HOME'), '$ expands a variable'],
      ["echo '$HOME'", echoed("echo '$HOME'"), "not inside '…'"],
      ['echo "$HOME"', echoed('echo "$HOME"'), 'but inside "…"'],
      ['echo two     spaces', echoed('echo two     spaces'), 'split into words'],
      ["echo 'two     spaces'", echoed("echo 'two     spaces'"), 'one word, kept whole'],
    ] },
    { type: 'table', id: 'nstar', title: `ls /etc/n*: one glob, ${globbed.length} arguments`, tone: 'store', fill: true, columns: ['the shell passed', 'ls showed'], rows: globbed.map((n) => [n, outputOf(s6, 'ls /etc/n*').includes(`${n}:`) ? 'a directory: its contents' : 'a file: its name']) },
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
    { type: 'item', id: 'normal', title: 'normal', sub: 'where vim starts: keys are commands', stack: true },
    { type: 'item', id: 'insert', title: 'insert', sub: `typing is text: ${status(vimInsert).split(/\s{2,}/)[0]}`, stack: true, tone: 'store' },
    { type: 'item', id: 'cmdline', title: 'command line', sub: `${status(vimCommand)} saves and quits; :q! quits without`, stack: true, tone: 'infra' },
  ] },
  { type: 'code', id: 'nano', console: true, filename: 'nano’s own help, its last two rows', code: nano.screen.slice(-2).join('\n') },
  { type: 'table', id: 'keys', title: 'The keys that matter', tone: 'infra', fill: true, columns: ['editor', 'keys', 'does'], rows: [
    ['vim', 'i, then Esc', 'into insert mode, and back out'],
    ['vim', ':wq / :q!', 'save and quit / quit, discarding'],
    ['nano', '^O, ^X', 'Ctrl+O writes, Ctrl+X exits'],
  ] },
  { type: 'code', id: 'saved', console: true, filename: WEB, code: s7.split('\n').slice(rowOf(s7, 'cat notes.txt') - 1).join('\n').trimEnd() },
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
