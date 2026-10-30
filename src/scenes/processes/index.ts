import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode, ttyNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/processes/01-fork-and-exec/session.txt?raw'
import s2 from '../../../spine/processes/02-ps-and-the-tree/session.txt?raw'
import s3 from '../../../spine/processes/03-top/session.txt?raw'
import top from '../../../spine/processes/03-top/tty/top.json'
import s4 from '../../../spine/processes/04-signals/session.txt?raw'
import s5 from '../../../spine/processes/05-jobs/session.txt?raw'
import s6 from '../../../spine/processes/06-environment-and-path/session.txt?raw'
import s7 from '../../../spine/processes/07-proc/session.txt?raw'

// Course 6 — What's running. Every step is `volatile` (PIDs, times): every number here is READ.
const WEB = 'sysops@web-01: ~'

// 6.1 — ◆ full scene: fork, then exec. The PIDs are the ones the VM handed out.
const shellPid = outputOf(s1, 'echo $$').trim()
const [, childPid, parentPid] = read(s1, /^(child \d+ parent \d+)$/m).match(/child (\d+) parent (\d+)/)!
const psRows = outputOf(s1, 'ps -o pid,ppid,comm').trim().split('\n').slice(1).map((l) => l.trim().split(/\s+/))
const psChild = psRows.find((r) => r[2] === 'ps')!
const forkExec: SceneModel = {
  title: 'fork, then exec',
  sub: 'how every command you type becomes a process',
  dir: 'row',
  nodes: [
    { type: 'code', id: 'run', console: true, filename: WEB, code: s1.trimEnd() },
    { type: 'group', id: 'right', bare: true, children: [
      { type: 'group', id: 'steps', title: `Typing ps in bash (PID ${shellPid})`, icon: 'cpu', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'shell', title: `bash ${shellPid}`, sub: 'reads the line', stack: true },
        { type: 'item', id: 'fork', title: 'fork()', sub: `a copy of bash: new PID ${psChild[0]}, parent ${psChild[1]}`, stack: true, tone: 'infra' },
        { type: 'item', id: 'exec', title: 'exec("ps")', sub: 'the copy replaces its program with ps', stack: true, tone: 'store' },
        { type: 'item', id: 'wait', title: 'wait()', sub: 'bash waits, then prints the next prompt', stack: true },
      ] },
      { type: 'table', id: 'seen', title: 'What the session showed', tone: 'store', fill: true, columns: ['asked', 'answer', 'so'], rows: [
        ['echo $$', shellPid, 'this shell’s own PID'],
        ["bash -c 'echo … $$ … $PPID'", `child ${childPid}, parent ${parentPid}`, 'a child knows its parent'],
        ['ps -o pid,ppid,comm', `ps is ${psChild[0]}, parent ${psChild[1]}`, 'ps was forked from this bash'],
        [`ls -l /proc/${shellPid}/exe`, read(s1, /exe -> (\S+)/), 'the program the process runs'],
      ] },
      { type: 'note', id: 'note', tone: 'ingest', text: 'Every process except the first (systemd, PID 1) was forked by another, so the processes form a tree. A PID is only a number handed out in order: never type one from a video — read it from ps.' },
    ] },
  ],
  edges: [{ from: 'shell', to: 'fork' }, { from: 'fork', to: 'exec' }, { from: 'exec', to: 'wait' }],
}

// 6.2 — ps and the tree.
const ancestry = outputOf(s2, 'pstree -s $$').trim().split('───')
const nginxRows = outputOf(s2, 'ps -o user,pid,ppid,cmd -C nginx').trim().split('\n').slice(1).map((l) => l.trim().split(/\s+/))
const tree = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, 'systemd───'), rowOf(s2, 'nginx: master')] }),
  [
    { type: 'group', id: 'chain', title: 'pstree -s $$: this shell’s ancestors', icon: 'workflow', tone: 'ingest', dir: 'row', children: ancestry.map((name, i) => (
      { type: 'item' as const, id: `a${i}`, title: name, sub: i === 0 ? 'PID 1: started by the kernel' : name === 'bash' ? 'this shell' : name === 'pstree' ? 'the command itself' : name === 'sshd' ? 'listens for logins' : 'one per login', stack: true, chip: true }
    )) },
    { type: 'table', id: 'nginx', title: 'ps -C nginx: one master, workers under it', tone: 'serve', fill: true, columns: ['user', 'PID', 'parent', 'role'], rows: nginxRows.map((r) => (
      { id: `p${r[1]}`, cells: [r[0], r[1], r[2], r[4] === 'master' ? 'root: binds port 80, reads the config' : 'www-data: answers requests'], tone: r[4] === 'master' ? 'serve' as const : undefined }
    )) },
    { type: 'table', id: 'cols', title: 'ps aux, the columns worth reading', tone: 'infra', fill: true, columns: ['column', 'means'], rows: [
      ['%CPU, %MEM', 'share of the processor, of memory'],
      ['RSS', 'memory actually in use, in KiB (sorted here)'],
      ['STAT', 'S sleeping, R running, T stopped (6.4)'],
      ['TIME', 'processor time used so far'],
    ] },
    { type: 'note', id: 'note', tone: 'ingest', text: `${outputOf(s2, 'ps -e --no-headers | wc -l').trim()} processes on an idle server, most of them the kernel’s own. nginx’s split is common: a privileged parent, unprivileged children doing the work.` },
  ],
  ancestry.slice(1).map((_, i) => ({ from: `a${i}`, to: `a${i + 1}` })),
)

// 6.3 — top, as the terminal drew it.
const head = (n: number) => top.screen[n]
const tasks = head(1).match(/(\d+) total,\s+(\d+) running,\s+(\d+) sleeping/)!
const load = head(0).match(/load average: ([\d.]+), ([\d.]+), ([\d.]+)/)!
const idle = head(2).match(/([\d.]+) id/)![1]
const mem = head(3).match(/([\d.]+) total,\s+([\d.]+) free,\s+([\d.]+) used,\s+([\d.]+) buff\/cache/)!
const avail = head(4).match(/([\d.]+) avail Mem/)![1]
const topFrame = consoleFrame(ttyNode('top — web-01', top), [
  { type: 'table', id: 'header', title: 'Reading top’s header', tone: 'ingest', fill: true, columns: ['line', 'here', 'means'], rows: [
    ['load average', `${load[1]}, ${load[2]}, ${load[3]}`, 'tasks wanting the CPU, over 1, 5, 15 min'],
    ['Tasks', `${tasks[1]}: ${tasks[2]} running, ${tasks[3]} sleeping`, 'almost everything waits'],
    ['%Cpu(s) id', `${idle}%`, 'idle; us = programs, sy = kernel'],
    ['MiB Mem used', mem[3], 'held by programs'],
    ['buff/cache', mem[4], 'file data kept in memory: given back on demand'],
    ['avail Mem', avail, 'what a new program could get'],
  ] },
  { type: 'table', id: 'keys', title: 'Inside top', tone: 'infra', fill: true, columns: ['key', 'does'], rows: [
    ['M / P', 'sort by memory / by CPU'],
    ['k', 'send a signal to a PID (6.4)'],
    ['q', 'quit'],
  ] },
  { type: 'code', id: 'uptime', console: true, filename: WEB, code: `sysops@web-01:~$ uptime\n${outputOf(s3, 'uptime').trimEnd()}` },
  { type: 'note', id: 'note', tone: 'ingest', text: 'Load is not a percentage: on this 2-CPU server, a load of 2 means both are busy. “free” looks small on any healthy server — read avail Mem instead: cache is memory doing useful work until something needs it.' },
])

// 6.4 — signals: TERM asks, STOP pauses, CONT resumes, KILL cannot be refused.
const nums = outputOf(s4, 'kill -l TERM KILL STOP CONT HUP').trim().split('\n')
const stats = [...s4.matchAll(/^\s+\d+ ([A-Z]+)\s+sleep 1000$/gm)].map((m) => m[1]) // after &, after STOP, after CONT
if (stats.length !== 3) throw new Error(`6.4: expected 3 ps rows for sleep, got ${stats.length}`)
const signals = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, 'Terminated'), rowOf(s4, ' T    sleep'), rowOf(s4, 'Killed')] }),
  [
    { type: 'table', id: 'sigs', title: 'kill -l: the names and their numbers', tone: 'ingest', fill: true, columns: ['signal', 'number', 'asks the process to', 'can it refuse?'], rows: [
      { id: 'term', cells: ['TERM', nums[0], 'stop, cleaning up first — kill’s default', 'yes'], tone: 'ingest' },
      { id: 'kill', cells: ['KILL', nums[1], 'nothing: the kernel ends it', 'no'], tone: 'consume' },
      ['STOP', nums[2], 'nothing: the kernel pauses it', 'no'],
      ['CONT', nums[3], 'carry on after STOP', '—'],
      ['HUP', nums[4], 'its terminal hung up; daemons: reload', 'yes'],
    ] },
    { type: 'table', id: 'states', title: 'One sleep 1000, its STAT column through the session', tone: 'store', fill: true, columns: ['after', 'STAT', 'jobs says'], rows: [
      ['started with &', stats[0], 'running in the background'],
      ['kill -STOP %1', stats[1], read(s4, /\[1\]\+\s+(Stopped)/)],
      ['kill -CONT %1', stats[2], 'running again'],
      { id: 'k', cells: ['kill -KILL %1', 'gone', read(s4, /\[1\]\+\s+(Killed)/)], tone: 'consume' },
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: 'Ask first: plain kill sends TERM, and a well-behaved program finishes its writes and exits. KILL gives it no chance to clean up — use it only when TERM has been ignored.' },
  ],
)

// 6.5 — jobs: the shell's own list of what it started.
const jl = outputOf(s5, 'jobs -l').trim().split('\n').map((l) => l.match(/^\[(\d)\]([+-])\s+(\d+) (\w+)\s+(.+?) &$/)!)
const jobs = consoleFrame(
  consoleNode(WEB, s5, { highlight: [rowOf(s5, '^Z'), rowOf(s5, '^C')] }),
  [
    { type: 'group', id: 'states', title: 'A job’s three states, and the keys between them', icon: 'terminal', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'fg', title: 'foreground', sub: 'owns the terminal: you wait', stack: true },
      { type: 'item', id: 'stopped', title: 'stopped', sub: 'paused: Ctrl-Z sent it STOP', stack: true, tone: 'infra' },
      { type: 'item', id: 'bg', title: 'background', sub: 'runs on; the prompt is back', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'list', title: 'jobs -l, mid-session', tone: 'store', fill: true, columns: ['job', 'mark', 'PID', 'state', 'command'], rows: jl.map((m) => [`%${m[1]}`, m[2] === '+' ? '+ current' : '- previous', m[3], m[4], m[5]]) },
    { type: 'table', id: 'keys', title: 'The controls', tone: 'infra', fill: true, columns: ['typed', 'does'], rows: [
      ['command &', 'start it in the background'],
      ['Ctrl-Z', 'stop the foreground job'],
      ['bg / fg %n', 'continue it in the background / bring it forward'],
      ['Ctrl-C', 'interrupt the foreground job (the INT signal)'],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: 'Jobs belong to this shell: log out, and they get HUP. Anything that must keep running belongs in a service (course 7), not in a background job.' },
  ],
  [{ from: 'fg', to: 'stopped', label: 'Ctrl-Z' }, { from: 'stopped', to: 'bg', label: 'bg' }],
)

// 6.6 — the environment, and how a name becomes a program.
const path = outputOf(s6, 'echo $PATH').trim().split(':')
const env = consoleFrame(
  consoleNode(WEB, s6, { highlight: [rowOf(s6, 'nginx: command not found'), rowOf(s6, 'nginx version')] }),
  [
    { type: 'table', id: 'lookup', title: 'Typing nginx: the shell searches PATH, in order', tone: 'ingest', fill: true, columns: ['directory', 'nginx there?'], rows: [
      ...path.map((d) => [d, 'no']),
      { id: 'sbin', cells: ['/usr/sbin — not in sysops’s PATH', `yes: ${read(s6, /^(-rwx\S+ .* \/usr\/sbin\/nginx)$/m).split(/\s+/)[0]}`], tone: 'consume' },
    ] },
    { type: 'table', id: 'kinds', title: 'type: three kinds of command', tone: 'store', fill: true, columns: ['name', 'is'], rows: outputOf(s6, 'type ls cd').trim().split('\n').map((l) => [l.split(' ')[0], l.slice(l.indexOf(' is ') + 4)]).concat([['/usr/sbin/nginx', 'a path: no search at all']]) },
    { type: 'table', id: 'vars', title: 'A variable reaches a child only when exported', tone: 'infra', fill: true, columns: ['typed', 'the child printed'], rows: [
      ["GREETING=hello bash -c '…'", outputOf(s6, "GREETING=hello bash -c 'echo [$GREETING]'").trim()],
      ['echo [$GREETING] (afterwards)', outputOf(s6, 'echo [$GREETING]').trim() + ' — it was for that one command'],
      ["export GREETING=hi; bash -c '…'", outputOf(s6, "bash -c 'echo [$GREETING]'").trim()],
    ] },
  ],
)

// 6.7 — /proc: the kernel's view, as files.
const status = Object.fromEntries(outputOf(s7, 'head -n 9 /proc/$$/status').trim().split('\n').map((l) => [l.split(':')[0], l.split(':').slice(1).join(':').trim()]))
const la = outputOf(s7, 'cat /proc/loadavg').trim().split(' ')
const proc = consoleFrame(
  consoleNode(WEB, s7, { highlight: [rowOf(s7, 'State:'), rowOf(s7, 'PPid:')] }),
  [
    { type: 'table', id: 'status', title: `/proc/${status.Pid}/status: this shell`, tone: 'ingest', fill: true, columns: ['field', 'here', 'means'], rows: [
      ['Name', status.Name, 'the program'],
      ['State', status.State, 'waiting for input'],
      ['Pid, PPid', `${status.Pid}, ${status.PPid}`, 'itself, its parent (sshd-session)'],
      ['Uid', status.Uid.split(/\s+/)[0], 'runs as sysops'],
      ['Umask', status.Umask, 'the umask from 5.6'],
    ] },
    { type: 'table', id: 'system', title: 'The system’s own numbers, as files', tone: 'store', fill: true, columns: ['file', 'here', 'means'], rows: [
      ['/proc/loadavg', la.slice(0, 3).join(' '), 'what uptime and top show'],
      ['', la[3], 'running / all tasks'],
      ['/proc/meminfo', read(s7, /MemAvailable:\s+(\d+ kB)/), 'MemAvailable: top’s avail Mem'],
      ['/proc/uptime', read(s7, /cat \/proc\/uptime\n([\d.]+)/) + ' s', 'seconds since boot'],
    ] },
    { type: 'note', id: 'note', tone: 'ingest', text: `Nothing under /proc is on a disk: the kernel writes each file the moment it is read. ps, top and free are readers of /proc. cwd and exe are links to where a process is and what it runs.` },
  ],
)

export const processesScenes: Record<string, SceneModel> = {
  'processes-fork-exec': forkExec,
  'processes-tree': tree,
  'processes-top': topFrame,
  'processes-signals': signals,
  'processes-jobs': jobs,
  'processes-env': env,
  'processes-proc': proc,
}
