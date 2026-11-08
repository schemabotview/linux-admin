import type { SceneModel } from '@graphlearning/graphl-flow'
import { PICTURE_W, consoleFrame, consoleNode, ttyNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/processes/01-fork-and-exec/session.txt?raw'
import s2 from '../../../spine/processes/02-ps-and-the-tree/session.txt?raw'
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
    { type: 'group', id: 'right', bare: true, dir: 'row', children: [
      { type: 'group', id: 'steps', title: `Typing ps in bash (PID ${shellPid})`, icon: 'cpu', tone: 'ingest', children: [
        { type: 'item', id: 'shell', title: `bash ${shellPid}`, sub: 'reads the line you typed', icon: 'terminal' },
        { type: 'item', id: 'fork', title: 'fork()', sub: `a copy of bash: new PID ${psChild[0]}, parent ${psChild[1]}`, icon: 'layers', tone: 'infra' },
        { type: 'item', id: 'exec', title: 'exec("ps")', sub: 'the copy replaces its program with ps, same PID', icon: 'cpu', tone: 'store' },
        { type: 'item', id: 'wait', title: 'wait()', sub: 'bash waits, then prints the next prompt', icon: 'clock' },
      ] },
      { type: 'table', id: 'seen', title: 'What the session showed', tone: 'store', fill: true, columns: ['asked', 'answer'], rows: [
        ['echo $$', `${shellPid}: this shell`],
        ["bash -c '… $$ … $PPID'", `child ${childPid}, parent ${parentPid}`],
        ['ps -o pid,ppid,comm', `ps ${psChild[0]}, parent ${psChild[1]}`],
        [`ls -l /proc/${shellPid}/exe`, read(s1, /exe -> (\S+)/)],
      ] },
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
    { type: 'group', id: 'chain', title: 'pstree -s $$: this shell’s ancestors', icon: 'workflow', tone: 'ingest', children: ancestry.map((name, i) => (
      { type: 'item' as const, id: `a${i}`, title: name, sub: i === 0 ? 'PID 1: started by the kernel' : name === 'bash' ? 'this shell' : name === 'pstree' ? 'the command itself' : name === 'sshd' ? 'listens for logins' : 'one per login', icon: i === 0 ? 'settings' : name === 'bash' || name === 'pstree' ? 'terminal' : 'key' }
    )) },
    { type: 'table', id: 'nginx', title: 'ps -C nginx: one master, workers under it', tone: 'serve', fill: true, columns: ['user', 'PID', 'parent', 'role'], rows: nginxRows.map((r) => (
      { id: `p${r[1]}`, cells: [r[0], r[1], r[2], r[4] === 'master' ? 'master: port 80, config' : 'worker: requests'], tone: r[4] === 'master' ? 'serve' as const : undefined }
    )) },
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
const topFrame = consoleFrame(ttyNode('top — web-01', top, 0), [
  { type: 'plot', id: 'mem', title: `MiB Mem: ${mem[1]} total, as top split it`, w: PICTURE_W,
    x: { labels: ['used', 'buff/cache', 'free', 'avail Mem'] },
    y: { min: 0, max: Math.ceil(+mem[1] / 500) * 500, step: 500, label: 'MiB' },
    series: [{ kind: 'bar', points: [+mem[3], +mem[4], +mem[2], +avail].map((v, i) => [i, v] as [number, number]), tone: 'ingest' }] },
  { type: 'table', id: 'header', title: 'Reading top’s header', tone: 'ingest', fill: true, columns: ['line', 'here'], rows: [
    ['load average', `${load[1]}, ${load[2]}, ${load[3]}: on 2 CPUs, idle`],
    ['Tasks', `${tasks[1]}: ${tasks[2]} running, ${tasks[3]} sleeping`],
    ['%Cpu(s) id', `${idle}% of the time idle`],
    { id: 'avail', cells: ['avail Mem', `${avail} MiB: read this, not free`], tone: 'store' },
  ] },
])

// 6.4 — signals: TERM asks, STOP pauses, CONT resumes, KILL cannot be refused.
const nums = outputOf(s4, 'kill -l TERM KILL STOP CONT HUP').trim().split('\n')
const stats = [...s4.matchAll(/^\s+\d+ ([A-Z]+)\s+sleep 1000$/gm)].map((m) => m[1]) // after &, after STOP, after CONT
if (stats.length !== 3) throw new Error(`6.4: expected 3 ps rows for sleep, got ${stats.length}`)
const signals = consoleFrame(
  consoleNode(WEB, s4, {
    show: [[1, rowOf(s4, '$ kill -CONT %1')], [rowOf(s4, '$ kill -CONT %1') + 3, s4.trimEnd().split('\n').length]],
    highlight: [rowOf(s4, 'Terminated'), rowOf(s4, ' T    sleep'), rowOf(s4, 'Killed')],
  }),
  [
    { type: 'group', id: 'states', title: 'One sleep 1000, its STAT through the session', icon: 'cpu', tone: 'store', children: [
      { type: 'item', id: 'st0', title: `${stats[0]}: sleeping`, sub: 'started with &', icon: 'clock' },
      { type: 'item', id: 'st1', title: `${stats[1]}: ${read(s4, /\[1\]\+\s+(Stopped)/).toLowerCase()}`, sub: 'kill -STOP %1: the kernel pauses it', icon: 'power', tone: 'infra' },
      { type: 'item', id: 'st2', title: `${stats[2]}: sleeping again`, sub: 'kill -CONT %1', icon: 'clock' },
      { type: 'item', id: 'st3', title: `gone: ${read(s4, /\[1\]\+\s+(Killed)/).toLowerCase()}`, sub: 'kill -KILL %1: no chance to clean up', icon: 'zap', tone: 'consume' },
    ] },
    { type: 'table', id: 'sigs', title: 'kill -l: the names and their numbers', tone: 'ingest', fill: true, columns: ['signal', 'number', 'can it refuse?'], rows: [
      { id: 'term', cells: ['TERM', nums[0], 'yes: asks, kill’s default'], tone: 'ingest' },
      { id: 'kill', cells: ['KILL', nums[1], 'no: the kernel ends it'], tone: 'consume' },
      ['STOP', nums[2], 'no: the kernel pauses it'],
      ['CONT', nums[3], '—: carry on after STOP'],
      ['HUP', nums[4], 'yes: daemons reload'],
    ] },
  ],
  [{ from: 'st0', to: 'st1' }, { from: 'st1', to: 'st2' }, { from: 'st2', to: 'st3' }],
)

// 6.5 — jobs: the shell's own list of what it started.
const jobs = consoleFrame(
  consoleNode(WEB, s5, { highlight: [rowOf(s5, '^Z'), rowOf(s5, '^C')] }),
  [
    { type: 'group', id: 'states', title: 'A job’s three states, and the keys between them', icon: 'terminal', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'fg', title: 'foreground', sub: 'owns the terminal: you wait', stack: true },
      { type: 'item', id: 'stopped', title: 'stopped', sub: 'paused: Ctrl-Z sent it STOP', stack: true, tone: 'infra' },
      { type: 'item', id: 'bg', title: 'background', sub: 'runs on; the prompt is back', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'keys', title: 'The controls', tone: 'infra', fill: true, columns: ['typed', 'does'], rows: [
      ['command &', 'start it in the background'],
      ['Ctrl-Z', 'stop the foreground job'],
      ['bg / fg %n', 'continue it behind / in front'],
      ['Ctrl-C', 'interrupt it: the INT signal'],
      ['kill %1', 'TERM to job 1, no PID needed'],
    ] },
  ],
  [{ from: 'fg', to: 'stopped', label: 'Ctrl-Z' }, { from: 'stopped', to: 'bg', label: 'bg' }],
)

// 6.6 — the environment, and how a name becomes a program.
const path = outputOf(s6, 'echo $PATH').trim().split(':')
const env = consoleFrame(
  consoleNode(WEB, s6, { highlight: [rowOf(s6, 'nginx: command not found'), rowOf(s6, 'nginx version')] }),
  [
    { type: 'group', id: 'lookup', title: 'nginx -v: the shell searches PATH, in order', icon: 'search', tone: 'ingest', dir: 'grid', cols: 2, children: [
      ...path.map((d, i) => ({ type: 'item' as const, id: `p${i}`, title: d, sub: `${i + 1}: no nginx here`, chip: true })),
      { type: 'item', id: 'sbin', title: '/usr/sbin', sub: `nginx IS here (${read(s6, /^(-rwx\S+) .* \/usr\/sbin\/nginx$/m)}), but not in sysops’s PATH`, chip: true, tone: 'consume', span: 'all' },
    ] },
    { type: 'table', id: 'vars', title: 'A variable reaches a child only when exported', tone: 'infra', fill: true, columns: ['typed', 'printed'], rows: [
      ["GREETING=hello bash -c …", outputOf(s6, "GREETING=hello bash -c 'echo [$GREETING]'").trim()],
      ['echo [$GREETING], after', outputOf(s6, 'echo [$GREETING]').trim() + ': it was for one command'],
      ["export GREETING=hi; bash -c …", outputOf(s6, "bash -c 'echo [$GREETING]'").trim()],
    ] },
  ],
)

// 6.7 — /proc: the kernel's view, as files.
const status = Object.fromEntries(outputOf(s7, 'head -n 9 /proc/$$/status').trim().split('\n').map((l) => [l.split(':')[0], l.split(':').slice(1).join(':').trim()]))
const la = outputOf(s7, 'cat /proc/loadavg').trim().split(' ')
const proc = consoleFrame(
  consoleNode(WEB, s7, { highlight: [rowOf(s7, 'State:'), rowOf(s7, 'PPid:')] }),
  [
    { type: 'group', id: 'pid', title: `/proc/${status.Pid}: this shell, as files`, icon: 'folder', tone: 'ingest', children: [
      { type: 'item', id: 'status', title: 'status', sub: `${status.Name}, ${status.State}; parent ${status.PPid}; uid ${status.Uid.split(/\s+/)[0]}; umask ${status.Umask}`, icon: 'file' },
      { type: 'item', id: 'cwd', title: 'cwd', sub: `a link to where it is: ${read(s7, /cwd -> (\S+)/)}`, icon: 'folder' },
      { type: 'item', id: 'cmdline', title: 'cmdline', sub: `what started it: ${outputOf(s7, "tr '\\0' ' ' < /proc/$$/cmdline; echo").trim()} — a login shell`, icon: 'terminal' },
    ] },
    { type: 'table', id: 'system', title: 'The system’s own numbers, as files', tone: 'store', fill: true, columns: ['file', 'here'], rows: [
      ['/proc/loadavg', `${la.slice(0, 3).join(' ')}: top’s load`],
      ['', `${la[3]}: running / all tasks`],
      ['/proc/meminfo', `MemAvailable ${read(s7, /MemAvailable:\s+(\d+ kB)/)}`],
      ['/proc/uptime', `${read(s7, /cat \/proc\/uptime\n([\d.]+)/)} s since boot`],
    ] },
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
