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
  consoleNode(WEB, s1, { highlight: [rowOf(s1, 'vdb     254'), rowOf(s1, '└─vdb1')] }),
  [
    { type: 'group', id: 'layers', title: 'A disk, a partition, a filesystem, a place in the tree', icon: 'disk', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'disk', title: '/dev/vdb', sub: `the disk: ${tree.find((t) => t[0] === 'vdb')![3]}, empty`, icon: 'disk', stack: true },
      { type: 'item', id: 'part', title: '/dev/vdb1', sub: 'a partition: sfdisk', stack: true, tone: 'infra' },
      { type: 'item', id: 'fs', title: 'ext4, label data', sub: 'a filesystem: mkfs.ext4', stack: true, tone: 'store' },
      { type: 'item', id: 'mnt', title: '/srv/data', sub: 'mounted: next section', icon: 'folder', stack: true, muted: true },
    ] },
    { type: 'table', id: 'lsblk', title: 'lsblk: what web-01 has', tone: 'store', fill: true, columns: ['name', 'size', 'type', 'mounted on'], rows: tree.map((t) => ({ id: t[0], cells: [t[0], t[3], t[5], t[6] ?? ''], tone: t[0].startsWith('vdb') ? 'store' as const : undefined })) },
    { type: 'table', id: 'ids', title: 'lsblk -f: filesystems carry their own ID', tone: 'infra', fill: true, columns: ['device', 'type', 'UUID'], rows: [
      ['vda1', 'ext4', read(s1, /├─vda1\n│\s+ext4\s+1\.0\s+(\S+)/)],
      ['vdb1', 'ext4, label data', uuid],
    ] },
    { type: 'note', id: 'note', tone: 'ingest', text: 'Device names follow the order the disks were found; a UUID is written into the filesystem itself. That is why fstab names filesystems by UUID. sr0 is the lab’s cloud-init CD.' },
  ],
  [{ from: 'disk', to: 'part' }, { from: 'part', to: 'fs' }, { from: 'fs', to: 'mnt' }],
)

// 9.2 — mounting, and fstab; and (branch, discarded) the typo that stops the boot.
const fstab = read(s2, /\n(UUID=\S+ \/srv\/data ext4 \S+ \d \d)\n/)
const df = outputOf(s2, 'df -h / /srv/data').trim().split('\n').slice(1).map((l) => l.split(/\s+/))
const emergency = serial.split('\n').filter((l) => l && !/^\[\s*\d+\.\d+\]/.test(l)).slice(-6).join('\n')
const mounting = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, ' /srv/data ext4 defaults,nofail 0 2'), rowOf(s2, 'your fstab has been modified')] }),
  [
    { type: 'table', id: 'df', title: 'df -h: two filesystems, one tree', tone: 'ingest', fill: true, columns: ['filesystem', 'size', 'used', 'mounted on'], rows: df.map((d) => [d[0], d[1], d[4], d[5]]) },
    { type: 'table', id: 'fstab', title: 'The fstab line, field by field', tone: 'store', fill: true, columns: ['field', 'here'], rows: (() => {
      const f = fstab.split(' ')
      return [['what', `${f[0].slice(0, 13)}…: by UUID`], ['where', f[1]], ['type', f[2]], ['options', `${f[3]}: nofail = boot on without it`], ['dump, fsck order', `${f[4]} ${f[5]}`]]
    })() },
    { type: 'code', id: 'serial', console: true, filename: '⑂ the typo: web-01’s own console, after reboot', code: emergency },
    { type: 'note', id: 'note', tone: 'consume', text: `In the branch, the UUID was wrong and nofail gone. The boot waited for a disk that does not exist, stopped in emergency mode — before ssh: ${read(s3, /\n(kex_exchange_identification: [^\n]+)/)}. With root locked, not even the console lets anyone in.` },
  ],
)

// 9.3 — (branch, discarded) the disk-full incident.
const full = outputOf(s4, 'df -h /srv/data').trim().split('\n')[1].split(/\s+/)
const du = outputOf(s4, 'sudo du -sh /srv/data/*').trim().split('\n').map((l) => l.split(/\s+/))
const diskFull = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, 'No space left on device'), rowOf(s4, 'tee: /srv/data/note')] }),
  [
    { type: 'group', id: 'steps', title: 'An incident, worked: symptom → where → what → fix', icon: 'activity', tone: 'consume', dir: 'row', children: [
      { type: 'item', id: 'sym', title: 'symptom', sub: 'a write fails: No space left on device', stack: true },
      { type: 'item', id: 'where', title: 'df -h', sub: `which filesystem: ${full[5]} at ${full[4]}`, stack: true, tone: 'infra' },
      { type: 'item', id: 'what', title: 'du -sh', sub: 'which directory holds it', stack: true, tone: 'infra' },
      { type: 'item', id: 'fix', title: 'remove it', sub: `back to ${outputOf(s4, 'df -h /srv/data').trim().split('\n').at(-1)!.split(/\s+/)[4]}`, stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'df', title: 'df -h /srv/data, before and after', tone: 'infra', fill: true, columns: ['when', 'used', 'avail', 'use%'], rows: [-1, 1].map((n, i) => {
      const f = outputOf(s4, 'df -h /srv/data', n === -1 ? 1 : -1).trim().split('\n')[1].split(/\s+/)
      return { id: `d${i}`, cells: [i ? 'after rm' : 'full', f[2], f[3], f[4]], tone: i ? 'store' as const : 'consume' as const }
    }) },
    { type: 'table', id: 'du', title: 'sudo du -sh /srv/data/*', tone: 'store', fill: true, columns: ['size', 'path'], rows: du.map(([n, p]) => ({ id: p, cells: [n, p], tone: n.endsWith('G') ? 'consume' as const : undefined })) },
    { type: 'note', id: 'note', tone: 'consume', text: 'Run on a disk of its own and discarded: the server never ran out. On a real one the usual culprits are logs (rotation, 9.4), caches, old backups — and a deleted file a program still holds open, which df counts and du cannot see.' },
  ],
  [{ from: 'sym', to: 'where' }, { from: 'where', to: 'what' }, { from: 'what', to: 'fix' }],
)

// 9.4 — log rotation.
const rotated = outputOf(s5, 'ls -l /var/log/nginx').trim().split('\n').slice(1).map((l) => l.split(/\s+/))
const RULE: [string, string][] = [['daily', 'once a day'], ['rotate 14', 'keep 14 old files'], ['compress', 'gzip the old ones'], ['delaycompress', '…but not the newest old one'], ['create 0640 www-data adm', 'a fresh, empty log, owned like this'], ['postrotate … rotate', 'tell nginx to reopen its files']]
const rotation = consoleFrame(
  consoleNode(WEB, s5, { highlight: [rowOf(s5, 'logrotate: command not found'), rowOf(s5, 'access.log.1')] }),
  [
    { type: 'table', id: 'rule', title: '/etc/logrotate.d/nginx, read', tone: 'ingest', fill: true, columns: ['line', 'says'], rows: RULE.filter(([l]) => s5.includes(l.split(' …')[0])) },
    { type: 'table', id: 'files', title: 'After one forced rotation', tone: 'store', fill: true, columns: ['file', 'size', 'mode'], rows: rotated.map((f) => ({ id: f[8], cells: [f[8], f[4], f[0]], tone: f[8].endsWith('.1') ? 'store' as const : undefined })) },
    { type: 'note', id: 'note', tone: 'infra', text: `The rule came with nginx, but the program did not: Debian 13’s cloud image has no logrotate. Installed, its timer runs it daily (next: ${read(s5, /\n(\w{3} \d{4}-\d\d-\d\d \d\d:\d\d:\d\d \w+)\s+\d+h/)}).` },
  ],
)

// 9.5 — names and inodes.
const ino = read(s6, /^(\d+) notes\.txt$/m)
const links = consoleFrame(
  consoleNode(WEB, s6, { highlight: [rowOf(s6, 'notes-hard.txt', 2), rowOf(s6, 'cat: notes-link: No such file')] }),
  [
    { type: 'group', id: 'model', title: 'A name points to an inode; the inode holds the data', icon: 'file', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'n1', title: 'notes.txt', sub: 'a name', chip: true },
      { type: 'item', id: 'inode', title: `inode ${ino}`, sub: 'owner, mode, size, where the blocks are', icon: 'disk', stack: true, tone: 'store' },
      { type: 'item', id: 'n2', title: 'notes-hard.txt', sub: 'a second name: ln', chip: true },
    ] },
    { type: 'table', id: 'li', title: 'ls -li notes*: inode, mode, link count, name', tone: 'ingest', fill: true, columns: ['inode', 'mode', 'links', 'name'], rows:
      outputOf(s6, 'ls -li notes*').trim().split('\n').map((l) => l.trim().split(/\s+/)).map((f) => [f[0], f[1], f[2], f.slice(9).join(' ')]) },
    { type: 'table', id: 'kinds', title: 'Two kinds of link, after rm notes.txt', tone: 'store', fill: true, columns: ['link', 'points to', 'after rm'], rows: [
      ['hard: ln a b', `the inode (${ino}); count ${read(s6, /^\d+ -rw-r--r-- (\d) sysops sysops \d+ .* notes-hard\.txt$/m)}`, `still reads: ${read(s6, /cat notes-hard\.txt\n([^\n]+)/)}`],
      { id: 'sym', cells: ['symbolic: ln -s a b', `a NAME: ${read(s6, /notes-link -> (\S+)/)}`, 'dangling: No such file'], tone: 'consume' },
    ] },
    { type: 'note', id: 'note', tone: 'ingest', text: 'rm removes a name. The data goes only when the last name is gone (and no program has it open). Put the name back, and the symbolic link works again — it only ever stored a name.' },
  ],
  [{ from: 'n1', to: 'inode' }, { from: 'n2', to: 'inode' }],
)

// 9.6 — backups: an archive, and a mirror.
const listing = outputOf(s7, 'tar -tzvf /srv/data/backups/site.tar.gz').trim().split('\n').map((l) => l.split(/\s+/))
const second = outputOf(s7, 'rsync -a --delete --itemize-changes /srv/sysops.example/ /srv/data/mirror/', -1).trim()
const backups = consoleFrame(
  consoleNode(WEB, s7, { highlight: [rowOf(s7, '>f.st')] }),
  [
    { type: 'table', id: 'tar', title: 'tar -tzvf site.tar.gz: owners and modes kept', tone: 'ingest', fill: true, columns: ['mode', 'owner/group', 'file'], rows: listing.map((f) => [f[0], f[1], f[5]]) },
    { type: 'table', id: 'rsync', title: 'rsync, second run: only what changed', tone: 'store', fill: true, columns: ['run', 'copied'], rows: [
      ['first', `${(s7.match(/^>f\+{9} /gm) ?? []).length} files (>f+++++++++: new)`],
      ['after one edit', `${second.split('\n').length} file: ${second.replace(/\s+/, ' — ')}`],
    ] },
    { type: 'table', id: 'which', title: 'Which, when', tone: 'infra', fill: true, columns: ['tool', 'makes', 'for'], rows: [
      ['tar -czf', 'one file: a moment in time', 'keeping history, sending elsewhere'],
      ['rsync -a --delete', 'a copy kept identical', 'a mirror; fast after the first run'],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: 'Both copies here are on the same server — a second disk, not a second place. A backup counts when it is somewhere else, and when a restore from it has been tried.' },
  ],
)

export const storageScenes: Record<string, SceneModel> = {
  'storage-disks': disks,
  'storage-mount': mounting,
  'storage-full': diskFull,
  'storage-logs': rotation,
  'storage-links': links,
  'storage-backups': backups,
}
