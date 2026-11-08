import type { SceneModel, TableRow } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/users/01-users-and-groups/session.txt?raw'
import s2 from '../../../spine/users/02-permissions/session.txt?raw'
import s3 from '../../../spine/users/03-chmod-chown/session.txt?raw'
import s4 from '../../../spine/users/04-directories/session.txt?raw'
import s5 from '../../../spine/users/05-sudo-and-root/session.txt?raw'
import s6 from '../../../spine/users/06-shared-site-directory/session.txt?raw'

// Course 5 — Who can do what. Every mode and owner in a picture is parsed from an `ls -l` the VM printed.
const WEB = 'sysops@web-01: ~'

/** An `ls -l` row's fields: mode, links, owner, group, …, name. */
const lsRow = (row: string) => {
  const f = row.trim().split(/\s+/)
  return { mode: f[0], owner: f[2], group: f[3], name: f[f.length - 1] }
}
/** The three permission triplets of a mode, as table rows; `s`/`t` are read in their place. */
const triplets = (mode: string, who: [string, string, string]): TableRow[] => [1, 4, 7].map((at, i) => {
  const t = mode.slice(at, at + 3)
  const x = t[2] === 'x' ? 'yes' : t[2] === 's' ? 'yes + setgid' : t[2] === 't' ? 'yes + sticky' : 'no'
  return { id: ['u', 'g', 'o'][i], cells: [['owner', 'group', 'others'][i], who[i], t, t[0] === 'r' ? 'yes' : 'no', t[1] === 'w' ? 'yes' : 'no', x] }
})
const octal = (t: string) => (t[0] === 'r' ? 4 : 0) + (t[1] === 'w' ? 2 : 0) + (t[2] === 'x' ? 1 : 0)

// 5.1 — identities: users, groups, and why sysops can read nginx's log.
const idLine = outputOf(s1, 'id').trim()
const groups = [...idLine.matchAll(/(\d+)\((\w[\w-]*)\)/g)].slice(2).map((m) => ({ gid: m[1], name: m[2] }))
const users = consoleFrame(
  consoleNode(WEB, s1, { highlight: [rowOf(s1, 'uid=1000'), rowOf(s1, 'adm:x:4:sysops')] }),
  [
    { type: 'table', id: 'who', title: `id: ${idLine.split(' ').slice(0, 2).join(' ')}`, tone: 'ingest', fill: true, columns: ['', 'sysops', 'www-data'], rows: [
      ['user id (uid)', read(s1, /^uid=(\d+)\(sysops\)/m), read(s1, /uid=(\d+)\(www-data\)/)],
      ['primary group', read(s1, /uid=1000\(sysops\) gid=\d+\((\w+)\)/), read(s1, /uid=33\(www-data\) gid=\d+\(([\w-]+)\)/)],
      ['home', read(s1, /^sysops:x:\d+:\d+:[^:]*:([^:]+):/m), read(s1, /^www-data:x:\d+:\d+:[^:]*:([^:]+):/m)],
      ['shell', read(s1, /^sysops:(?:[^:]*:){5}(\S+)$/m), `${read(s1, /^www-data:(?:[^:]*:){5}(\S+)$/m)}: no login`],
    ] },
    { type: 'group', id: 'member', title: 'Groups sysops belongs to', icon: 'users', tone: 'source', dir: 'row', children: groups.map((g) => (
      { type: 'item' as const, id: `g-${g.name}`, title: `${g.name} (${g.gid})`, sub: g.name === 'adm' ? 'may read system logs: nginx’s too' : 'its own private group', icon: 'users', stack: true, chip: true }
    )) },
  ],
)

// 5.2 — reading rwx off ls -l.
const notes = lsRow(outputOf(s2, 'ls -l notes.txt'))
const shadow = lsRow(outputOf(s2, 'ls -l /etc/shadow'))
const COLS = ['who', 'is', 'bits', 'read', 'write', 'execute']
const shadowT = [1, 4, 7].map((at) => shadow.mode.slice(at, at + 3))
const permissions = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, 'notes.txt', 2), rowOf(s2, 'Permission denied')] }),
  [
    { type: 'group', id: 'one', title: `cat /etc/shadow: Linux checks ONE triplet`, icon: 'lock', tone: 'consume', children: [
      { type: 'item', id: 'own', title: 'Do you own it?', sub: `the owner, ${shadow.owner}, gets ${shadowT[0]} — sysops is not ${shadow.owner}`, icon: 'user' },
      { type: 'item', id: 'grp', title: 'Are you in its group?', sub: `the group, ${shadow.group}, gets ${shadowT[1]} — sysops is not in it`, icon: 'users' },
      { type: 'item', id: 'oth', title: `Then you are others: ${shadowT[2]}`, sub: 'no read, so cat is refused: Permission denied', icon: 'lock', tone: 'consume' },
    ] },
    { type: 'table', id: 'notes', title: `${notes.mode}  ${notes.owner} ${notes.group}  notes.txt`, tone: 'store', fill: true, columns: COLS, rows: triplets(notes.mode, [notes.owner, notes.group, 'everyone else']) },
  ],
  [{ from: 'own', to: 'grp', label: 'no' }, { from: 'grp', to: 'oth', label: 'no' }],
)

// 5.3 — chmod in letters and in numbers; chown; a write refused by ownership.
const stat = outputOf(s3, "stat -c '%a %A %U:%G %n' notes.txt").trim().split(' ')
// every `ls -l notes.txt` the session ran, in order: after chmod 600, after chown root, after chown sysops
const listed = [...s3.matchAll(/ls -l notes\.txt\n(-[^\n]+)/g)].map((m) => lsRow(m[1]))
if (listed.length !== 3) throw new Error(`5.3: expected 3 listings of notes.txt, got ${listed.length}`)
const chmod = consoleFrame(
  consoleNode(WEB, s3, { highlight: [rowOf(s3, '644 -rw-r--r--'), rowOf(s3, '-bash: notes.txt: Permission denied')] }),
  [
    { type: 'group', id: 'octal', title: `stat: ${stat[1]} is ${stat[0]}: r = 4, w = 2, x = 1`, icon: 'lock', tone: 'ingest', dir: 'row', children: [1, 4, 7].map((at, i) => {
      const t = stat[1].slice(at, at + 3)
      return { type: 'item' as const, id: ['ou', 'og', 'oo'][i], title: `${t} = ${String(octal(t))}`, sub: `${['owner', 'group', 'others'][i]}: ${[...t].map((c, k) => (c === '-' ? 0 : [4, 2, 1][k])).join(' + ')}`, icon: ['user', 'users', 'globe'][i], stack: true }
    }) },
    { type: 'table', id: 'ways', title: 'What each command did to notes.txt', tone: 'store', fill: true, columns: ['typed', 'notes.txt is'], rows: [
      ['chmod 600', `${listed[0].mode}: all three set`],
      ['chmod go+r', `${stat[1]}: r added`],
      { id: 'root', cells: ['sudo chown root', `owner ${listed[1].owner}: sysops gets ${listed[1].mode.slice(4, 7)}`], tone: 'consume' },
      ['sudo chown sysops', `owner ${listed[2].owner}: ${listed[2].mode.slice(1, 4)} again`],
    ] },
  ],
)

// 5.4 — on a directory, r lists the names and x lets you through.
const walk = outputOf(s4, 'ls -ld / /home /home/sysops notes.txt').split('\n').filter((l) => /^[d-]/.test(l)).map(lsRow)
const directories = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, "ls: cannot access 'box/file'"), rowOf(s4, 'cat: box/file: Permission denied')] }),
  [
    { type: 'group', id: 'walk', title: 'The walk to ~/notes.txt, for another user', icon: 'folder', tone: 'store', children: walk.map((w, i) => {
      const t = w.mode.slice(7, 10), last = i === walk.length - 1, ok = last ? t[0] === 'r' : t[2] === 'x'
      return { type: 'item' as const, id: `w${i}`, title: w.name, sub: `${w.mode} — others ${t}: ${last ? (ok ? 'may read' : 'may not read') : (ok ? 'may pass through' : 'may not pass: stopped here')}`, icon: last ? 'file' : 'folder', tone: ok ? undefined : 'consume' as const }
    }) },
    { type: 'table', id: 'mean', title: 'r, w, x mean something else on a directory', tone: 'ingest', fill: true, columns: ['bit', 'on a file', 'on a directory'], rows: [
      ['r', 'read it', 'list the names'],
      ['w', 'change it', 'add, rename, delete'],
      { id: 'x', cells: ['x', 'run it', 'pass through it'], tone: 'ingest' },
    ] },
  ],
  walk.slice(1).map((_, i) => ({ from: `w${i}`, to: `w${i + 1}` })),
)

// 5.5 — sudo: what it allows, the rule, and the cached password.
const rule = read(s5, /^(sysops ALL=\(ALL\) ALL)$/m)
const asks = (s5.match(/\[sudo\] password for sysops:/g) ?? []).length
const sudoRuns = (s5.match(/\$ sudo /g) ?? []).length
const sudo = consoleFrame(
  consoleNode(WEB, s5, { highlight: [rowOf(s5, '(ALL) ALL'), rowOf(s5, rule)] }),
  [
    { type: 'group', id: 'rule', title: `${read(s5, /sudoers\.d\n(\S+)/)}: ${rule}`, icon: 'shield', tone: 'consume', children: [
      { type: 'item', id: 'who', title: 'sysops', sub: 'who the rule is for', icon: 'user' },
      { type: 'item', id: 'host', title: 'ALL=', sub: 'on any host this file is read on', icon: 'server' },
      { type: 'item', id: 'as', title: '(ALL)', sub: 'as any user: root, or another with -u', icon: 'users' },
      { type: 'item', id: 'cmd', title: 'ALL', sub: 'any command', icon: 'terminal', tone: 'consume' },
    ] },
    { type: 'table', id: 'cache', title: `Your password, asked ${asks} times in ${sudoRuns} sudos`, tone: 'infra', fill: true, columns: ['typed', 'asked?'], rows: [
      ['sudo -l', 'yes: the first sudo'],
      ['sudo ls, sudo cat, sudo whoami', 'no: remembered'],
      { id: 'k', cells: ['sudo -k, then sudo whoami', 'yes: -k forgot it'], tone: 'infra' },
    ] },
  ],
  [{ from: 'who', to: 'host' }, { from: 'host', to: 'as' }, { from: 'as', to: 'cmd' }],
)

// 5.6 — the team's directory: a group, setgid, a new login, umask.
const dir = lsRow(outputOf(s6, 'ls -ld /srv/sysops.example'))
const files = outputOf(s6, 'ls -l /srv/sysops.example').split('\n').filter((l) => l.startsWith('-')).map(lsRow)
const ids = [...s6.matchAll(/^(uid=1000[^\n]+)$/gm)].map((m) => m[1])
const shared = consoleFrame(
  consoleNode(WEB, s6, {
    // the setup stays; the login banner and the closing id deploy fold
    show: [[1, rowOf(s6, 'sudo usermod')], [rowOf(s6, 'sudo chmod 2775'), rowOf(s6, '$ exit')], [rowOf(s6, 'sysops@ops:~$ ssh web-01'), rowOf(s6, 'sysops@ops:~$ ssh web-01')],
      [rowOf(s6, 'sysops@web-01:~$ id', 2), rowOf(s6, 'index.html', 4)]],
    highlight: [rowOf(s6, "touch: cannot touch"), rowOf(s6, '1001(site)')],
  }),
  [
    { type: 'group', id: 'made', title: `${dir.mode}  ${dir.owner}:${dir.group}: s is setgid`, icon: 'folder', tone: 'ingest', children: [
      { type: 'item', id: 'dir', title: '/srv/sysops.example', sub: `new files take its group, ${dir.group}`, icon: 'folder' },
      { type: 'group', id: 'files', bare: true, dir: 'row', children: files.map((f) => (
        { type: 'item' as const, id: `f-${f.name.split('.')[0]}`, title: f.name, sub: `${f.group}, ${f.mode} — umask ${f.name === 'about.html' ? '022: no group write' : `${read(s6, /\$ umask\n(\d+)/)}`}`, icon: 'file', stack: true, tone: f.name === 'about.html' ? 'consume' as const : 'store' as const })) },
    ] },
    { type: 'table', id: 'login', title: 'A new group takes a new login', tone: 'consume', fill: true, columns: ['when', 'touch'], rows: [
      ['after usermod -aG site', 'denied: id has no site'],
      { id: 'after', cells: ['after exit, ssh web-01', `works: id lists ${read(ids[1], /(\d+\(site\))/)}`], tone: 'store' },
    ] },
  ],
  files.map((f) => ({ from: 'dir', to: `f-${f.name.split('.')[0]}` })),
)

export const usersScenes: Record<string, SceneModel> = {
  'users-ids': users,
  'users-permissions': permissions,
  'users-chmod': chmod,
  'users-directories': directories,
  'users-sudo': sudo,
  'users-shared': shared,
}
