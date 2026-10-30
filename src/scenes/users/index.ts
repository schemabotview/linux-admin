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
    { type: 'table', id: 'files', title: 'Where the system keeps these', tone: 'infra', fill: true, columns: ['file', 'one line per', 'here'], rows: [
      ['/etc/passwd', 'user', read(s1, /^(sysops:x:[^\n]+)$/m)],
      ['/etc/group', 'group, with its members', read(s1, /^(adm:x:[^\n]+)$/m)],
      ['/etc/shadow', 'user’s password hash', 'root only: next section'],
    ] },
    { type: 'note', id: 'note', tone: 'source', text: `www-data is the account nginx runs as: no password, no shell. A service gets its own account so a fault in it can reach only what that account may touch. The sudo group is empty (sudo:x:27:) — sysops gets sudo another way (5.5).` },
  ],
)

// 5.2 — reading rwx off ls -l.
const notes = lsRow(outputOf(s2, 'ls -l notes.txt'))
const shadow = lsRow(outputOf(s2, 'ls -l /etc/shadow'))
const tmp = lsRow(outputOf(s2, 'ls -ld /home/sysops /tmp').split('\n')[1])
const COLS = ['who', 'is', 'bits', 'read', 'write', 'execute']
const permissions = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, 'notes.txt', 2), rowOf(s2, 'Permission denied')] }),
  [
    { type: 'table', id: 'notes', title: `${notes.mode}  ${notes.owner} ${notes.group}  notes.txt`, tone: 'store', fill: true, columns: COLS, rows: triplets(notes.mode, [notes.owner, notes.group, 'everyone else']) },
    { type: 'table', id: 'shadow', title: `${shadow.mode}  ${shadow.owner} ${shadow.group}  /etc/shadow`, tone: 'consume', fill: true, columns: COLS, rows: triplets(shadow.mode, [shadow.owner, shadow.group, 'sysops, here']) },
    { type: 'table', id: 'first', title: 'The first character, and two specials', tone: 'infra', fill: true, columns: ['seen', 'means'], rows: [
      ['- / d / l', 'a file / a directory / a symbolic link'],
      [`${tmp.mode} (/tmp)`, 't, sticky: anyone may create, only the owner may delete'],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: `Linux checks ONE triplet: the owner’s if you own the file, else the group’s if you are in its group, else others’. sysops is neither root nor in shadow — so “others”: no read, and cat is refused.` },
  ],
)

// 5.3 — chmod in letters and in numbers; chown; a write refused by ownership.
const stat = outputOf(s3, "stat -c '%a %A %U:%G %n' notes.txt").trim().split(' ')
// every `ls -l notes.txt` the session ran, in order: after chmod 600, after chown root, after chown sysops
const listed = [...s3.matchAll(/ls -l notes\.txt\n(-[^\n]+)/g)].map((m) => lsRow(m[1]))
if (listed.length !== 3) throw new Error(`5.3: expected 3 listings of notes.txt, got ${listed.length}`)
const chmod = consoleFrame(
  consoleNode(WEB, s3, { highlight: [rowOf(s3, '644 -rw-r--r--'), rowOf(s3, '-bash: notes.txt: Permission denied')] }),
  [
    { type: 'table', id: 'octal', title: `stat: ${stat[1]} is ${stat[0]}`, tone: 'ingest', fill: true, columns: ['who', 'bits', 'r=4', 'w=2', 'x=1', 'digit'], rows: [1, 4, 7].map((at, i) => {
      const t = stat[1].slice(at, at + 3)
      return [['owner', 'group', 'others'][i], t, t[0] === 'r' ? '4' : '0', t[1] === 'w' ? '2' : '0', t[2] === 'x' ? '1' : '0', String(octal(t))]
    }) },
    { type: 'table', id: 'ways', title: 'The two ways to write a change', tone: 'store', fill: true, columns: ['typed', 'gave notes.txt', 'style'], rows: [
      ['chmod 600 notes.txt', listed[0].mode, 'numbers: set all three digits'],
      ['chmod go+r notes.txt', stat[1], 'letters: add r for group, others'],
    ] },
    { type: 'table', id: 'own', title: 'chown: the owner decides who “owner” is', tone: 'consume', fill: true, columns: ['after', 'owner', 'sysops may write?'], rows: [
      ['sudo chown root notes.txt', listed[1].owner, `no: sysops is now “group”, ${listed[1].mode.slice(4, 7)}`],
      ['sudo chown sysops notes.txt', listed[2].owner, `yes again: ${listed[2].mode.slice(1, 4)}`],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: 'Changing the owner needs root, so a user cannot give files away to dodge a quota. chmod needs only ownership: the owner always decides the mode.' },
  ],
)

// 5.4 — on a directory, r lists the names and x lets you through.
const box = lsRow(outputOf(s4, 'ls -ld box'))
const walk = outputOf(s4, 'ls -ld / /home /home/sysops notes.txt').split('\n').filter((l) => /^[d-]/.test(l)).map(lsRow)
const directories = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, "ls: cannot access 'box/file'"), rowOf(s4, 'cat: box/file: Permission denied')] }),
  [
    { type: 'table', id: 'mean', title: 'r, w, x mean something else on a directory', tone: 'ingest', fill: true, columns: ['bit', 'on a file', 'on a directory'], rows: [
      ['r', 'read its contents', 'list the names in it'],
      ['w', 'change its contents', 'create, rename, delete entries'],
      { id: 'x', cells: ['x', 'run it as a program', 'pass through it: open what is inside'], tone: 'ingest' },
    ] },
    { type: 'table', id: 'trial', title: `box at ${box.mode}, then drwx------`, tone: 'consume', fill: true, columns: ['tried', 'needs', 'result'], rows: [
      ['ls box', 'r on box', `the name: ${read(s4, /Permission denied\n(\w+)\n/)} — but no details`],
      ['cat box/file', 'x on box', read(s4, /\$ cat box\/file\n(cat: [^\n]+)/)],
      { id: 'ok', cells: ['chmod 700 box; cat box/file', 'x on box', read(s4, /chmod 700 box\n.*cat box\/file\n(\w+)/)], tone: 'store' },
    ] },
    { type: 'table', id: 'walk', title: 'The walk to ~/notes.txt, for another user (others)', tone: 'store', fill: true, columns: ['step', 'mode', 'others may', 'so'], rows: walk.map((w, i) => {
      const t = w.mode.slice(7, 10), last = i === walk.length - 1, ok = last ? t[0] === 'r' : t[2] === 'x'
      return { id: `w${i}`, cells: [w.name, w.mode, last ? (t[0] === 'r' ? 'read' : 'not read') : (t[2] === 'x' ? 'pass' : 'not pass'), ok ? 'on' : 'stopped here'], tone: ok ? undefined : 'consume' as const }
    }) },
    { type: 'note', id: 'note', tone: 'ingest', text: 'A user needs x on every directory along a path, then r on the file. notes.txt is r for others — but /home/sysops lets others nothing, so the walk stops there. When nginx answers 403 later, check the whole path for www-data.' },
  ],
)

// 5.5 — sudo: what it allows, the rule, and the cached password.
const rule = read(s5, /^(sysops ALL=\(ALL\) ALL)$/m)
const asks = (s5.match(/\[sudo\] password for sysops:/g) ?? []).length
const sudo = consoleFrame(
  consoleNode(WEB, s5, { highlight: [rowOf(s5, '(ALL) ALL'), rowOf(s5, rule)] }),
  [
    { type: 'table', id: 'rule', title: `The rule: ${rule}`, tone: 'consume', fill: true, columns: ['part', 'means'], rows: [
      ['sysops', 'who the rule is for'],
      ['ALL=', 'on any host this file is read on'],
      ['(ALL)', 'as any user: root, or another with -u'],
      ['ALL', 'any command'],
    ] },
    { type: 'table', id: 'cache', title: `The password was asked ${asks} times in ${(s5.match(/\$ sudo /g) ?? []).length} sudo commands`, tone: 'infra', fill: true, columns: ['typed', 'asked?', 'why'], rows: [
      ['sudo -l', 'yes', 'the first sudo in this login'],
      ['sudo ls, sudo cat, sudo whoami', 'no', 'remembered for a while (15 min)'],
      { id: 'k', cells: ['sudo -k, then sudo whoami', 'yes', '-k forgets it at once'], tone: 'infra' },
    ] },
    { type: 'table', id: 'where', title: 'Where the rules live', tone: 'source', fill: true, columns: ['file', 'edit with'], rows: [
      ['/etc/sudoers', 'visudo: checks the syntax before saving'],
      [`/etc/sudoers.d/${read(s5, /sudoers\.d\n(\S+)/)}`, 'visudo -f — written here by cloud-init'],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: 'sudo asks for YOUR password, not root’s, and logs every command it runs. A broken sudoers file can lock everyone out of root — which is why the editor is visudo.' },
  ],
)

// 5.6 — the team's directory: a group, setgid, a new login, umask.
const dir = lsRow(outputOf(s6, 'ls -ld /srv/sysops.example'))
const files = outputOf(s6, 'ls -l /srv/sysops.example').split('\n').filter((l) => l.startsWith('-')).map(lsRow)
const ids = [...s6.matchAll(/^(uid=1000[^\n]+)$/gm)].map((m) => m[1])
const shared = consoleFrame(
  consoleNode(WEB, s6, { highlight: [rowOf(s6, "touch: cannot touch"), rowOf(s6, '1001(site)')] }),
  [
    { type: 'table', id: 'dir', title: `${dir.mode}  ${dir.owner}:${dir.group}  /srv/sysops.example`, tone: 'ingest', fill: true, columns: COLS, rows: triplets(dir.mode, [dir.owner, `${dir.group}: sysops, deploy`, 'everyone else']) },
    { type: 'table', id: 'login', title: 'A new group takes a new login', tone: 'consume', fill: true, columns: ['when', 'id says', 'touch'], rows: [
      ['after usermod -aG site', ids[0].replace(/^.*groups=/, 'groups='), 'Permission denied'],
      { id: 'after', cells: ['after exit, ssh web-01', ids[1].replace(/^.*groups=/, 'groups='), 'works'], tone: 'store' },
    ] },
    { type: 'table', id: 'made', title: 'Two new files: setgid gave both the group; umask set the mode', tone: 'store', fill: true, columns: ['file', 'group', 'mode', 'umask'], rows: files.map((f) => ({ id: f.name, cells: [f.name, f.group, f.mode, f.name === 'about.html' ? '022: group may not write' : `${read(s6, /\$ umask\n(\d+)/)}: Debian 13’s default`], tone: f.name === 'about.html' ? 'consume' as const : undefined })) },
    { type: 'note', id: 'note', tone: 'ingest', text: `The s in ${dir.mode} is setgid on a directory: new files take the directory’s group (site), not the creator’s. deploy is a system account in site with no shell — course 10’s script runs as it.` },
  ],
)

export const usersScenes: Record<string, SceneModel> = {
  'users-ids': users,
  'users-permissions': permissions,
  'users-chmod': chmod,
  'users-directories': directories,
  'users-sudo': sudo,
  'users-shared': shared,
}
