import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/storage/01-disks-and-filesystems/session.txt?raw'
import s2 from '../../../spine/storage/02-mounting-and-fstab/session.txt?raw'
import s3 from '../../../spine/storage/03-the-fstab-typo/session.txt?raw'
import serial from '../../../spine/storage/03-the-fstab-typo/serial.txt?raw'
import s4 from '../../../spine/storage/04-the-disk-full-incident/session.txt?raw'
import s5 from '../../../spine/storage/05-log-rotation/session.txt?raw'
import s6 from '../../../spine/storage/06-links-and-inodes/session.txt?raw'
import s7 from '../../../spine/storage/07-backups/session.txt?raw'

// Course 9 — Disks and space. web-01 has had an empty second disk, vdb, since its base (lab/vm.py).
const WEB = 'sysops@web-01: ~'

// 9.1 — disks, partitions, filesystems.
const tree = outputOf(s1, 'lsblk').trim().split('\n').slice(1).map((l) => l.replace(/^[├└─│ ]+/, '').trim().split(/\s+/))
const uuid = read(s1, /ext4\s+1\.0\s+data\s+(\S+)/)
const disks = consoleFrame(
  consoleNode(WEB, s1, { show: [[1, rowOf(s1, 'Disk /dev/vdb')], [rowOf(s1, "$ echo 'type=linux'"), rowOf(s1, '├─vda14', 2) - 1], [rowOf(s1, '└─vdb1', 2) - 1, s1.trimEnd().split('\n').length]], highlight: [rowOf(s1, 'vdb     254'), rowOf(s1, '└─vdb1')] }),
  [
    { type: 'group', id: 'layers', title: 'Four layers, from the disk to the tree', icon: 'disk', tone: 'ingest', children: [
      { type: 'item', id: 'disk', title: '/dev/vdb: the disk', sub: `${tree.find((t) => t[0] === 'vdb')![3]}, empty: no partition table yet`, icon: 'disk' },
      { type: 'item', id: 'part', title: '/dev/vdb1: a partition', sub: "sfdisk, type=linux: the whole disk", icon: 'layers', tone: 'infra' },
      { type: 'item', id: 'fs', title: 'ext4, label data: a filesystem', sub: 'mkfs.ext4: names, owners, modes — and a UUID', icon: 'file', tone: 'store' },
      { type: 'item', id: 'mnt', title: '/srv/data: a place in the tree', sub: 'mounted: the next section', icon: 'folder', muted: true },
    ] },
    { type: 'table', id: 'ids', title: 'lsblk -f: a filesystem carries its own ID', tone: 'infra', fill: true, columns: ['filesystem', 'UUID'], rows: [
      ['vda1, /', read(s1, /├─vda1\n│\s+ext4\s+1\.0\s+(\S+)/)],
      { id: 'data', cells: ['vdb1, data', uuid], tone: 'store' },
    ] },
  ],
  [{ from: 'disk', to: 'part' }, { from: 'part', to: 'fs' }, { from: 'fs', to: 'mnt' }],
)

// 9.2 — mounting, and fstab; and (branch, discarded) the typo that stops the boot.
const fstab = read(s2, /\n(UUID=\S+ \/srv\/data ext4 \S+ \d \d)\n/)
const emergency = serial.split('\n').filter((l) => l && !/^\[\s*\d+\.\d+\]/.test(l)).slice(-6).join('\n')
const mounting = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, ' /srv/data ext4 defaults,nofail 0 2'), rowOf(s2, 'your fstab has been modified')] }),
  [
    { type: 'table', id: 'fstab', title: 'The fstab line, field by field', tone: 'store', fill: true, columns: ['field', 'here'], rows: (() => {
      const f = fstab.split(' ')
      return [['what', `${f[0].slice(0, 13)}…: by UUID`], ['where', f[1]], ['type', f[2]], { id: 'opt', cells: ['options', `${f[3]}: boot on without it`], tone: 'store' as const }, ['dump, fsck order', `${f[4]} ${f[5]}`]]
    })() },
    { type: 'group', id: 'typo', title: '⑂ The typo: run once, then discarded', icon: 'disk', tone: 'consume', children: [
      { type: 'item', id: 'bad', title: `UUID=${read(s3, /\nUUID=(\S+) \/srv\/data/).slice(0, 8)}…, no nofail`, sub: 'a disk that does not exist, and the boot must have it', icon: 'file' },
      { type: 'item', id: 'emerg', title: emergency.split('\n').find((l) => l.startsWith('You are in emergency mode'))!.replace(/\. After.*/, ''), sub: `before ssh; and: ${emergency.split('\n').find((l) => l.startsWith('Cannot open access'))!.replace(/^Cannot open access to console, /, '')}`, icon: 'power', tone: 'consume' },
      { type: 'item', id: 'nossh', title: read(s3, /\n(kex_exchange_identification: [^\n]+)/).replace('kex_exchange_identification: read: ', 'ssh: '), sub: 'the way back is a rescue system; the prevention is nofail and mount -a', icon: 'lock', tone: 'consume' },
    ] },
  ],
  [{ from: 'bad', to: 'emerg' }, { from: 'emerg', to: 'nossh' }],
)

// 9.3 — (branch, discarded) the disk-full incident.
const full = outputOf(s4, 'df -h /srv/data').trim().split('\n')[1].split(/\s+/)
const du = outputOf(s4, 'sudo du -sh /srv/data/*').trim().split('\n').map((l) => l.split(/\s+/))
const diskFull = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, 'No space left on device'), rowOf(s4, 'tee: /srv/data/note')] }),
  [
    { type: 'group', id: 'steps', title: 'An incident, worked: symptom → where → what → fix', icon: 'activity', tone: 'consume', children: [
      { type: 'item', id: 'sym', title: 'the symptom', sub: 'any write fails: No space left on device', icon: 'activity', tone: 'consume' },
      { type: 'item', id: 'where', title: 'df -h: where?', sub: `which filesystem: ${full[5]} at ${full[4]}`, icon: 'disk', tone: 'infra' },
      { type: 'item', id: 'what', title: 'du -sh: what?', sub: 'which directory holds the space', icon: 'folder', tone: 'infra' },
      { type: 'item', id: 'fix', title: 'remove it', sub: `df: back to ${outputOf(s4, 'df -h /srv/data', -1).trim().split('\n').at(-1)!.split(/\s+/)[4]} used`, icon: 'check', tone: 'store' },
    ] },
    { type: 'table', id: 'du', title: 'sudo du -sh /srv/data/*', tone: 'store', fill: true, columns: ['size', 'path'], rows: du.map(([n, p]) => ({ id: p, cells: [n, p], tone: n.endsWith('G') ? 'consume' as const : undefined })) },
  ],
  [{ from: 'sym', to: 'where' }, { from: 'where', to: 'what' }, { from: 'what', to: 'fix' }],
)

// 9.4 — log rotation.
const rotated = outputOf(s5, 'ls -l /var/log/nginx').trim().split('\n').slice(1).map((l) => l.split(/\s+/))
const RULE: [string, string][] = [['daily', 'once a day'], ['rotate 14', 'keep 14 old files'], ['compress', 'gzip the old ones'], ['delaycompress', '…not the newest one'], ['create 0640 www-data adm', 'a fresh log, owned so'], ['postrotate … rotate', 'nginx reopens its files']]
const file = (name: string) => rotated.find((f) => f[8] === name)!
const rotation = consoleFrame(
  consoleNode(WEB, s5, {
    // the rule is on the right; its prerotate block, the first ls and the timer's footer fold
    show: [[1, rowOf(s5, 'create 0640')], [rowOf(s5, '$ sudo logrotate -f'), rowOf(s5, 'logrotate.timer logrotate.service')], [s5.trimEnd().split('\n').length, s5.trimEnd().split('\n').length]],
    highlight: [rowOf(s5, 'logrotate: command not found'), rowOf(s5, 'access.log.1')],
  }),
  [
    { type: 'group', id: 'rot', title: 'logrotate -f: one rotation of access.log', icon: 'log', tone: 'store', dir: 'row', children: [
      { type: 'item', id: 'old', title: 'access.log', sub: `${file('access.log.1')[4]} bytes of requests`, icon: 'file', stack: true },
      { type: 'item', id: 'one', title: 'access.log.1', sub: `renamed, kept: ${file('access.log.1')[4]} bytes`, icon: 'archive', stack: true },
      { type: 'item', id: 'new', title: 'access.log', sub: `fresh: ${file('access.log')[4]} bytes, ${file('access.log')[0]} ${file('access.log')[2]}:${file('access.log')[3]}`, icon: 'file', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'rule', title: '/etc/logrotate.d/nginx, read', tone: 'ingest', fill: true, columns: ['line', 'says'], rows: RULE.filter(([l]) => s5.includes(l.split(' …')[0])) },
  ],
  [{ from: 'old', to: 'one', label: 'mv' }, { from: 'one', to: 'new', label: 'create' }],
)

// 9.5 — names and inodes.
const ino = read(s6, /^(\d+) notes\.txt$/m)
const links = consoleFrame(
  consoleNode(WEB, s6, { highlight: [rowOf(s6, 'notes-hard.txt', 2), rowOf(s6, 'cat: notes-link: No such file')] }),
  [
    { type: 'group', id: 'model', title: 'A name points to an inode; the inode holds the data', icon: 'file', tone: 'ingest', children: [
      { type: 'item', id: 'n1', title: 'notes.txt', sub: 'a name: an entry in the directory ~', icon: 'file' },
      { type: 'item', id: 'inode', title: `inode ${ino}`, sub: `the owner, mode, size and blocks; ${read(s6, /^\d+ -rw-r--r-- (\d) sysops sysops \d+ .* notes-hard\.txt$/m)} names point here`, icon: 'disk', tone: 'store' },
      { type: 'item', id: 'n2', title: 'notes-hard.txt', sub: 'a second name for the same inode: ln', icon: 'file' },
    ] },
    { type: 'table', id: 'kinds', title: 'Two kinds of link, after rm notes.txt', tone: 'store', fill: true, columns: ['link', 'stores', 'after rm notes.txt'], rows: [
      ['hard: ln', `inode ${ino}`, 'still reads the note'],
      { id: 'sym', cells: ['symbolic: ln -s', `a name: ${read(s6, /notes-link -> (\S+)/)}`, 'dangling: no such file'], tone: 'consume' },
    ] },
  ],
  [{ from: 'n1', to: 'inode' }, { from: 'n2', to: 'inode' }],
)

// 9.6 — backups: an archive, and a mirror.
const listing = outputOf(s7, 'tar -tzvf /srv/data/backups/site.tar.gz').trim().split('\n').map((l) => l.split(/\s+/))
const second = outputOf(s7, 'rsync -a --delete --itemize-changes /srv/sysops.example/ /srv/data/mirror/', -1).trim()
const backups = consoleFrame(
  consoleNode(WEB, s7, { highlight: [rowOf(s7, '>f.st')] }),
  [
    { type: 'group', id: 'two', title: 'One directory, two kinds of copy', icon: 'archive', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'src', title: '/srv/sysops.example', sub: 'the site', icon: 'folder', stack: true },
      { type: 'group', id: 'copies', bare: true, children: [
        { type: 'item', id: 'tar', title: 'tar -czf: site.tar.gz', sub: 'one file, a moment in time', icon: 'archive', tone: 'store' },
        { type: 'item', id: 'rsync', title: 'rsync -a --delete: mirror/', sub: `kept identical; run 2 copied ${second.split('\n').length} file`, icon: 'folder', tone: 'store' },
      ] },
    ] },
    { type: 'table', id: 'tarlist', title: 'tar -tzvf: owners and modes kept', tone: 'store', fill: true, columns: ['mode', 'owner/group', 'file'], rows: listing.map((f) => [f[0], f[1], f[5]]) },
  ],
  [{ from: 'src', to: 'tar' }, { from: 'src', to: 'rsync' }],
)

export const storageScenes: Record<string, SceneModel> = {
  'storage-disks': disks,
  'storage-mount': mounting,
  'storage-full': diskFull,
  'storage-logs': rotation,
  'storage-links': links,
  'storage-backups': backups,
}
