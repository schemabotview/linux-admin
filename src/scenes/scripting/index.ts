import type { SceneModel } from '@graphlearning/graphl-flow'
import { PICTURE_W, consoleFrame, consoleNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/scripting/01-a-first-script/session.txt?raw'
import s2 from '../../../spine/scripting/02-variables-and-arguments/session.txt?raw'
import s3 from '../../../spine/scripting/03-if-for-case/session.txt?raw'
import s4 from '../../../spine/scripting/04-set-euo-pipefail/session.txt?raw'
import s5 from '../../../spine/scripting/05-the-deploy-script/session.txt?raw'
import s6 from '../../../spine/scripting/06-timer-and-shellcheck/session.txt?raw'

// Course 10 — Automate it. Scripts on screen are the server's `cat` of them (lab/files/bin is only
// what was copied in). Lines stay under 80 columns so a `cat` never wraps.
const WEB = 'sysops@web-01: ~'
const script = (s: string, path: string) => outputOf(s, `cat ${path}`)
const lineOf = (text: string, needle: string) => text.split('\n').findIndex((l) => l.includes(needle)) + 1

// 10.1 — a first script.
const sc = script(s1, 'site-check')
const runs = [...s1.matchAll(/answered (\d+)/g)].map((m) => m[1])
const first = consoleFrame(
  consoleNode(WEB, s1, { highlight: [rowOf(s1, 'Permission denied'), rowOf(s1, 'DOWN')] }),
  [
    { type: 'code', id: 'file', lang: 'shell', wrap: true, w: PICTURE_W, filename: '~/site-check', code: sc, highlight: [1, lineOf(sc, '[ "$code"')] },
    { type: 'group', id: 'exit', title: 'site-check && echo up || echo DOWN', icon: 'terminal', tone: 'store', children: [
      { type: 'item', id: 'ok', title: `answered ${runs[0]}: exit ${read(s1, /echo \$\?\n(\d+)/)}`, sub: 'nginx running: success, so && runs: up', icon: 'check', tone: 'store' },
      { type: 'item', id: 'down', title: `answered ${runs[1]}: exit ${read(s1, /\n(exit \d+)\n/).replace('exit ', '')}`, sub: 'nginx stopped: failure, so || runs: DOWN', icon: 'zap', tone: 'consume' },
    ] },
  ],
)

// 10.2 — variables, a default, command substitution, and the arguments.
const quoted = (s2.split('quoted "$@":\n')[1] ?? '').split('\nunquoted')[0].trim().split('\n').map((l) => l.trim())
const unq = (s2.split('unquoted $@:\n')[1] ?? '').split('\nsysops@')[0].trim().split('\n').map((l) => l.trim())
const variables = consoleFrame(
  consoleNode(WEB, s2, {
    // the two scripts' shebang-and-comment pairs fold; their working lines stay
    show: [[1, 2], [rowOf(s2, 'code=$1'), rowOf(s2, '$ cat args')], [rowOf(s2, 'echo "$# arguments'), rows(s2)]],
    highlight: [rowOf(s2, '[two words]'), rowOf(s2, '  [two]')],
  }),
  [
    { type: 'group', id: 'loops', title: './args "two words" three: two arguments', icon: 'terminal', tone: 'store', dir: 'row', children: [
      { type: 'item', id: 'q', title: 'for a in "$@"', sub: quoted.join(' '), icon: 'check', stack: true, tone: 'store' },
      { type: 'item', id: 'u', title: 'for a in $@', sub: `${unq.join(' ')}: split again`, icon: 'zap', stack: true, tone: 'consume' },
    ] },
    { type: 'table', id: 'pieces', title: 'count-status, its pieces', tone: 'ingest', fill: true, columns: ['written', 'means'], rows: [
      ['$1, $2', 'the first, second argument'],
      ['${2:-…}', '$2, or else the site’s log'],
      ['$( … )', `a command’s output: “${outputOf(s2, './count-status 200').trim()}”`],
      ['$#', `how many arguments: ${read(s2, /\n(\d+) arguments;/)}`],
    ] },
  ],
)

// 10.3 — for, case, if.
const cp = script(s3, 'check-paths')
const ok = outputOf(s3, './check-paths; echo "exit $?"').trim().split('\n')
const bad = outputOf(s3, './check-paths; echo "exit $?"', -1).trim().split('\n')
const control = consoleFrame(
  consoleNode(WEB, s3, { show: [[1, 1], [rowOf(s3, './check-paths;'), rows(s3)]], highlight: [rowOf(s3, 'all paths answered'), rowOf(s3, '4 path(s) failed')] }),
  [
    { type: 'group', id: 'runs', title: './check-paths; echo "exit $?" — twice', icon: 'workflow', tone: 'store', dir: 'row', children: [
      { type: 'item', id: 'up', title: `nginx running: exit ${ok.at(-1)!.replace('exit ', '')}`, sub: ok.at(-2)!, icon: 'check', stack: true, tone: 'store' },
      { type: 'item', id: 'down', title: `nginx stopped: exit ${bad.at(-1)!.replace('exit ', '')}`, sub: bad[bad.length - 2], icon: 'zap', stack: true, tone: 'consume' },
    ] },
    { type: 'code', id: 'file', lang: 'shell', wrap: true, w: PICTURE_W, filename: '~/check-paths', code: cp, highlight: [lineOf(cp, 'for path'), lineOf(cp, 'case $code'), lineOf(cp, 'if [')] },
  ],
)
function rows(s: string) { return s.trimEnd().split('\n').length }

// 10.4 — set -euo pipefail, one option at a time.
const loose = outputOf(s4, './publish-loose; echo "exit $?"').trim().split('\n')
const strict = outputOf(s4, './publish-strict; echo "exit $?"').trim().split('\n')
const pipe = (cmd: string) => outputOf(s4, cmd).trim()
const safety = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, 'deployed:'), rowOf(s4, 'unbound variable')] }),
  [
    { type: 'group', id: 'e', title: 'Three broken steps: cp, grep | wc, $SITE_DIR', icon: 'shield', tone: 'consume', dir: 'row', children: [
      { type: 'item', id: 'loose', title: `publish-loose: ${loose.at(-1)}`, sub: `ran all ${loose.length - 1} lines; “copied the page”, “deployed:” — a success`, icon: 'zap', stack: true, tone: 'consume' },
      { type: 'item', id: 'strict', title: `publish-strict: ${strict.at(-1)}`, sub: 'set -euo pipefail: stopped at the first failure, cp', icon: 'shield', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'o', title: 'pipefail and -u, on their own', tone: 'store', fill: true, columns: ['option', 'without', 'with'], rows: [
      ['pipefail', pipe(`bash -c 'false | true; echo "pipeline: $?"'`), pipe(`bash -c 'set -o pipefail; false | true; echo "pipeline: $?"'`)],
      ['-u', pipe(`bash -c 'echo "dir: [$SITE_DIR]"'`), read(s4, /(unbound variable)/)],
      ['-e', 'carries on', 'stops at the failure'],
    ] },
  ],
)

// 10.5 — the team's deploy script, run as deploy.
const ds = script(s5, '/usr/local/bin/deploy-site')
const changes = outputOf(s5, 'sudo -u deploy deploy-site').trim().split('\n')
const deploy = consoleFrame(
  consoleNode(WEB, s5, { show: [[1, rowOf(s5, '$ cat /usr/local/bin/deploy-site')], [rowOf(s5, '$ sudo -u deploy'), rows(s5)]], highlight: [rowOf(s5, 'deployed 3 files'), rowOf(s5, 'Published by deploy-site')] }),
  [
    { type: 'code', id: 'file', lang: 'shell', wrap: true, w: PICTURE_W, filename: '/usr/local/bin/deploy-site', code: ds, show: [[1, 1], [lineOf(ds, 'set -euo'), ds.trimEnd().split('\n').length]], highlight: [lineOf(ds, 'set -euo'), lineOf(ds, 'cd /'), lineOf(ds, 'if [')] },
    { type: 'group', id: 'flow', title: 'staging → live → checked', icon: 'workflow', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'stage', title: '/srv/data/staging', sub: 'the team edits here' },
      { type: 'item', id: 'sync', title: 'rsync, as deploy', sub: changes.filter((l) => l.startsWith('>f')).map((l) => l.split(' ')[1]).join(', '), tone: 'infra' },
      { type: 'item', id: 'check', title: 'curl', sub: changes.at(-1)!, tone: 'store' },
    ] },
  ],
  [{ from: 'stage', to: 'sync' }, { from: 'sync', to: 'check' }],
)

// 10.6 — shellcheck, and a timer for site-check.
// Our own short reading of each code (shellcheck's message wraps at the console's 80 columns; the full
// text is on the left and at shellcheck.net/wiki/<code>).
const GLOSS: Record<string, string> = {
  SC2164: 'cd can fail: add || exit',
  SC2086: 'quote the variable',
  SC2045: 'never loop over ls output',
  SC2035: 'a -name would become an option',
}
const findings = [...s6.matchAll(/(SC\d{4}) \((\w+)\): ([^\n]+)/g)].map((m) => [m[1], m[2], m[3]])
const timer = consoleFrame(
  consoleNode(WEB, s6, { show: [
    // shellcheck's findings are on the right; the console keeps its run and the line-5 error
    [rowOf(s6, '$ cp /tmp/cleanup-old'), rowOf(s6, '$ shellcheck cleanup-old')], [rowOf(s6, 'In cleanup-old line 5'), rowOf(s6, 'In cleanup-old line 5') + 5],
    [rowOf(s6, 'deploy-site && echo clean'), rowOf(s6, 'sudo install -m 755')], [rowOf(s6, 'enable --now site-check.timer'), rowOf(s6, 'site-check.timer site-check.service')],
    [rowOf(s6, '$ sudo systemctl start site-check'), rows(s6)]], highlight: [rowOf(s6, 'SC2045'), rowOf(s6, 'answered 200')] }),
  [
    { type: 'group', id: 'sched', title: 'site-check, every five minutes', icon: 'timer', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 't', title: 'site-check.timer', sub: 'OnCalendar=*:0/5', icon: 'clock', stack: true },
      { type: 'item', id: 's', title: 'site-check.service', sub: 'as deploy', icon: 'settings', stack: true },
      { type: 'item', id: 'j', title: 'the journal', sub: read(s6, /-o cat \| tail -n 4\n([^\n]+)/), icon: 'log', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'sc', title: `shellcheck cleanup-old: ${findings.length} findings in 6 lines`, tone: 'consume', fill: true, columns: ['code', 'level', 'means'], rows: findings.map((f, i) => ({ id: `f${i}`, cells: [f[0], f[1], GLOSS[f[0]] ?? (() => { throw new Error(`10.6: shellcheck reported ${f[0]}, which the picture does not explain`) })()], tone: f[1] === 'error' ? 'consume' as const : undefined })) },
  ],
  [{ from: 't', to: 's' }, { from: 's', to: 'j' }],
)

export const scriptingScenes: Record<string, SceneModel> = {
  'scripting-first': first,
  'scripting-variables': variables,
  'scripting-control': control,
  'scripting-safety': safety,
  'scripting-deploy': deploy,
  'scripting-timer': timer,
}
