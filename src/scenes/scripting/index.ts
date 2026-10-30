import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode } from '../frame'
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
    { type: 'code', id: 'file', lang: 'shell', filename: '~/site-check', code: sc, highlight: [1, lineOf(sc, '[ "$code"')] },
    { type: 'table', id: 'parts', title: 'The script, line by line', tone: 'ingest', fill: true, columns: ['line', 'does'], rows: [
      ['#!/bin/bash', 'the shebang: which program runs the file'],
      ['code=$(curl …)', 'runs curl, keeps what it printed in $code'],
      ['echo …', 'says what it found'],
      ['[ "$code" = 200 ]', 'a test: its result is the script’s exit status'],
    ] },
    { type: 'table', id: 'exit', title: 'Its exit status, and what && and || do with it', tone: 'store', fill: true, columns: ['nginx', 'answered', 'exit', '&& up || DOWN'], rows: [
      ['running', runs[0], read(s1, /echo \$\?\n(\d+)/), 'up'],
      { id: 'down', cells: ['stopped', runs[1], read(s1, /\n(exit \d+)\n/).replace('exit ', ''), 'DOWN'], tone: 'consume' },
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: `A new file is not a program: “${read(s1, /(Permission denied)/)}” until chmod +x. Exit status 0 means success and anything else failure — the one convention every script and service relies on.` },
  ],
)

// 10.2 — variables, a default, command substitution, and the arguments.
const cs = script(s2, 'count-status')
const quoted = (s2.split('quoted "$@":\n')[1] ?? '').split('\nunquoted')[0].trim().split('\n').map((l) => l.trim())
const unq = (s2.split('unquoted $@:\n')[1] ?? '').split('\nsysops@')[0].trim().split('\n').map((l) => l.trim())
const variables = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, '[two words]'), rowOf(s2, '  [two]')] }),
  [
    { type: 'code', id: 'file', lang: 'shell', filename: '~/count-status', code: cs, highlight: [lineOf(cs, 'code=$1'), lineOf(cs, '${2:-')] },
    { type: 'table', id: 'pieces', title: 'The pieces', tone: 'ingest', fill: true, columns: ['written', 'means', 'here'], rows: [
      ['$1, $2', 'the first, second argument', './count-status 404 → 404'],
      ['${2:-default}', '$2, or the default if empty', 'the rotated site log'],
      ['$( … )', 'the output of a command, as text', `“${outputOf(s2, './count-status 200').trim()}”`],
      ['$#', 'how many arguments', read(s2, /\n(\d+) arguments;/)],
    ] },
    { type: 'code', id: 'argsfile', lang: 'shell', filename: '~/args', code: script(s2, 'args'), highlight: [lineOf(script(s2, 'args'), 'in "$@"'), lineOf(script(s2, 'args'), 'in $@;')] },
    { type: 'table', id: 'args', title: './args "two words" three', tone: 'store', fill: true, columns: ['loop over', 'arguments the loop saw'], rows: [
      ['"$@"', quoted.join(' ')],
      { id: 'unq', cells: ['$@ (unquoted)', unq.join(' ')], tone: 'consume' },
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
    { type: 'code', id: 'file', lang: 'shell', filename: '~/check-paths', code: cp, highlight: [lineOf(cp, 'for path'), lineOf(cp, 'case $code'), lineOf(cp, 'if [')] },
    { type: 'table', id: 'runs', title: 'Two runs', tone: 'store', fill: true, columns: ['nginx', 'printed', 'exit'], rows: [
      ['running', ok.slice(0, -2).map((l) => l.split(/\s+/)[0]).join(', '), ok.at(-1)!.replace('exit ', '')],
      { id: 'down', cells: ['stopped', bad[bad.length - 2], bad.at(-1)!.replace('exit ', '')], tone: 'consume' },
    ] },
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
    { type: 'code', id: 'file', lang: 'shell', filename: '~/publish-strict', code: script(s4, 'publish-strict'), highlight: [lineOf(script(s4, 'publish-strict'), 'set -euo pipefail')] },
    { type: 'table', id: 'e', title: 'set -e: the same failing steps, both ways', tone: 'consume', fill: true, columns: ['', 'without', 'with set -euo pipefail'], rows: [
      ['lines printed', String(loose.length - 1), String(strict.length - 1)],
      ['carried on after cp failed', 'yes: “copied the page”', 'no: stopped there'],
      { id: 'exit', cells: ['exit status', loose.at(-1)!.replace('exit ', '') + ' — success!', strict.at(-1)!.replace('exit ', '')], tone: 'consume' },
    ] },
    { type: 'table', id: 'o', title: 'pipefail and -u, on their own', tone: 'store', fill: true, columns: ['option', 'without', 'with'], rows: [
      ['-o pipefail: false | true', pipe(`bash -c 'false | true; echo "pipeline: $?"'`), pipe(`bash -c 'set -o pipefail; false | true; echo "pipeline: $?"'`)],
      ['-u: an unset $SITE_DIR', pipe(`bash -c 'echo "dir: [$SITE_DIR]"'`), read(s4, /(SITE_DIR: unbound variable)/)],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: 'Without them, a script reports success after three failures — and the next line could be rm -r "$SITE_DIR/". With them, the first failure stops it and says why.' },
  ],
)

// 10.5 — the team's deploy script, run as deploy.
const ds = script(s5, '/usr/local/bin/deploy-site')
const changes = outputOf(s5, 'sudo -u deploy deploy-site').trim().split('\n')
const deploy = consoleFrame(
  consoleNode(WEB, s5, { show: [[1, rowOf(s5, '$ cat /usr/local/bin/deploy-site')], [rowOf(s5, '$ sudo -u deploy'), rows(s5)]], highlight: [rowOf(s5, 'deployed 3 files'), rowOf(s5, 'Published by deploy-site')] }),
  [
    { type: 'code', id: 'file', lang: 'shell', filename: '/usr/local/bin/deploy-site', code: ds, highlight: [lineOf(ds, 'set -euo'), lineOf(ds, 'cd /'), lineOf(ds, 'if [')] },
    { type: 'group', id: 'flow', title: 'staging → live → checked', icon: 'workflow', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'stage', title: '/srv/data/staging', sub: 'the team edits here', icon: 'folder', stack: true },
      { type: 'item', id: 'sync', title: 'rsync, as deploy', sub: changes.filter((l) => l.startsWith('>f')).map((l) => l.split(' ')[1]).join(', '), icon: 'workflow', stack: true, tone: 'infra' },
      { type: 'item', id: 'check', title: 'curl', sub: changes.at(-1)!, icon: 'check', stack: true, tone: 'store' },
    ] },
  ],
  [{ from: 'stage', to: 'sync' }, { from: 'sync', to: 'check' }],
)

// 10.6 — shellcheck, and a timer for site-check.
const findings = [...s6.matchAll(/(SC\d{4}) \((\w+)\): ([^\n]+)/g)].map((m) => [m[1], m[2], m[3]])
const timer = consoleFrame(
  consoleNode(WEB, s6, { show: [[1, rowOf(s6, 'In cleanup-old line 5') + 4], [rowOf(s6, 'deploy-site && echo clean'), rows(s6)]], highlight: [rowOf(s6, 'SC2045'), rowOf(s6, 'answered 200')] }),
  [
    { type: 'table', id: 'sc', title: `shellcheck cleanup-old: ${findings.length} findings in 6 lines`, tone: 'consume', fill: true, columns: ['code', 'level', 'says'], rows: findings.map((f) => ({ id: f[0] + f[2].slice(0, 6), cells: f, tone: f[1] === 'error' ? 'consume' as const : undefined })) },
    { type: 'table', id: 'fixes', title: 'shellcheck’s own suggestions (Did you mean:)', tone: 'store', fill: true, columns: ['instead'], rows: [...s6.matchAll(/Did you mean:\n([^\n]+)/g)].map((m) => [m[1].trim()]) },
    { type: 'table', id: 'clean', title: 'And on the deploy script', tone: 'store', fill: true, columns: ['shellcheck deploy-site'], rows: [[read(s6, /echo clean\n(clean)/) + ': nothing to report']] },
    { type: 'group', id: 'sched', title: 'site-check, every five minutes', icon: 'timer', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 't', title: 'site-check.timer', sub: 'OnCalendar=*:0/5', icon: 'clock', stack: true },
      { type: 'item', id: 's', title: 'site-check.service', sub: 'as deploy', icon: 'settings', stack: true },
      { type: 'item', id: 'j', title: 'the journal', sub: read(s6, /-o cat \| tail -n 4\n([^\n]+)/), icon: 'log', stack: true, tone: 'store' },
    ] },
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
