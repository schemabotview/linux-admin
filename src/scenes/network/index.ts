import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, consoleNode } from '../frame'
import { outputOf, read, rowOf } from '../lab'
import s1 from '../../../spine/network/01-interfaces-and-addresses/session.txt?raw'
import s2 from '../../../spine/network/02-ports-and-sockets/session.txt?raw'
import s3 from '../../../spine/network/03-names/session.txt?raw'
import s4 from '../../../spine/network/04-curl-the-site/session.txt?raw'
import s5 from '../../../spine/network/05-ssh-keys/session.txt?raw'
import s6 from '../../../spine/network/06-the-firewall/session.txt?raw'
import s7 from '../../../spine/network/07-the-lock-out/session.txt?raw'
import s8 from '../../../spine/network/08-https-with-certbot/session.txt?raw'
import s9 from '../../../spine/network/09-a-requests-whole-path/session.txt?raw'

// Course 8 — Reach it. The lab's network is QEMU's user network: web-01 is 10.0.2.15 behind a gateway
// 10.0.2.2 (the lab host, where ops, the package cache and the ACME server live).
const WEB = 'sysops@web-01: ~'
const rows = (s: string) => s.trimEnd().split('\n').length
/** Output rows with the terminal's 80-column wraps joined back. */
const joined = (out: string) => out.split('\n').reduce<string[]>((acc, r) => {
  if (acc.length && acc[acc.length - 1].length === 80) acc[acc.length - 1] += r
  else acc.push(r)
  return acc
}, [])

// 8.1 — interfaces, addresses, routes.
const brief = joined(outputOf(s1, 'ip -br address').trim()).map((l) => l.trim().split(/\s+/))
const nic = brief.find((b) => b[0] !== 'lo')!
const routes = joined(outputOf(s1, 'ip route')).map((l) => l.trim())
const ping = read(s1, /(\d+ packets transmitted, \d+ received, [\d.]+% packet loss)/)
const interfaces = consoleFrame(
  consoleNode(WEB, s1, { highlight: [rowOf(s1, 'enp0s2 '), rowOf(s1, 'default via')] }),
  [
    { type: 'group', id: 'path', title: 'web-01 on its network', icon: 'network', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'host', title: `${nic[0]}: ${nic[2].split('/')[0]}`, sub: `/${nic[2].split('/')[1]}: the network’s size — set by DHCP`, icon: 'server', stack: true },
      { type: 'item', id: 'gw', title: `gateway ${read(s1, /default via (\S+)/)}`, sub: `the way out; ${ping}`, icon: 'router', stack: true, tone: 'infra' },
      { type: 'item', id: 'world', title: 'everything else', sub: 'the default route sends it here', icon: 'globe', stack: true, tone: 'neutral' },
    ] },
    { type: 'table', id: 'routes', title: 'ip route: where a packet goes', tone: 'store', fill: true, columns: ['to', 'via'], rows: routes.map((r) => [r.split(' ')[0], r.includes(' via ') ? read(r, /via (\S+)/) : `${read(r, /dev (\S+)/)} directly`]) },
  ],
  [{ from: 'host', to: 'gw' }, { from: 'gw', to: 'world' }],
)

// 8.2 — which program listens on which port.
const listen = outputOf(s2, 'ss -tln').trim().split('\n').slice(1).map((l) => l.trim().split(/\s+/)[3])
// ss puts each socket's process on the row after it (its own column wrap): pair them up
const ssp = outputOf(s2, 'sudo ss -tlnp').split('\n')
const owners = ssp.flatMap((l, i) => l.startsWith('LISTEN') ? [{ at: l.split(/\s+/)[3], who: read(ssp[i + 1], /\(\("([^"]+)"/) }] : [])
const ROLE: Record<string, string> = { nginx: 'the site', sshd: 'the team’s logins', 'systemd-resolve': 'name lookups' }
const progs = [...new Set(owners.map((o) => o.who))]
const sockets = consoleFrame(
  // ss -tln's list is ss -tlnp's again without the owners: it folds
  consoleNode(WEB, s2, { show: [[1, 2], [rowOf(s2, '$ sudo ss -tlnp'), rows(s2)]], highlight: [rowOf(s2, '0.0.0.0:80 ', 2), rowOf(s2, 'ESTAB')] }),
  [
    { type: 'group', id: 'listen', title: `sudo ss -tlnp: ${listen.length} listening sockets, ${progs.length} programs`, icon: 'network', tone: 'ingest', children: progs.map((who) => {
      const at = owners.filter((o) => o.who === who).map((o) => o.at)
      const port = (a: string) => a.slice(a.lastIndexOf(':') + 1)
      const out = [...new Set(at.filter((a) => !a.startsWith('127.')).map(port))], lo = [...new Set(at.filter((a) => a.startsWith('127.')).map(port))]
      const where = [out.length ? `${out.join(', ')} on every address: reachable from outside` : '', lo.length ? `${lo.join(', ')} on loopback only: no other machine` : ''].filter(Boolean).join('; ')
      return { type: 'item' as const, id: `l-${who}`, title: `${who} — ${ROLE[who] ?? ''}`, sub: where, icon: who === 'nginx' ? 'nginx' : who === 'sshd' ? 'key' : 'search', tone: who === 'nginx' ? 'serve' as const : undefined }
    }) },
    { type: 'table', id: 'estab', title: 'ss -tn: this very session', tone: 'infra', fill: true, columns: ['', ''], rows: (() => {
      const e = outputOf(s2, 'ss -tn').trim().split('\n')[1].trim().split(/\s+/)
      return [['state', e[0]], ['web-01 side', e[3]], ['the other end', `${e[4]}: ops, via the gateway`]]
    })() },
  ],
)

// 8.3 — names: /etc/hosts first, then DNS.
const order = read(s3, /^hosts:\s+([^\n]+)$/m)
const names = consoleFrame(
  consoleNode(WEB, s3, { show: [[1, rowOf(s3, '127.0.0.1 localhost')], [rowOf(s3, '$ grep ^hosts'), rowOf(s3, '-- Information acquired')], [rowOf(s3, '-- Data from'), rows(s3)]], highlight: [rowOf(s3, 'exit 2'), rowOf(s3, '127.0.0.1       sysops.example')] }),
  [
    { type: 'group', id: 'order', title: `/etc/nsswitch.conf — hosts: ${order}`, icon: 'search', tone: 'ingest', children: order.split(/\s+/).filter((w) => !w.startsWith('[')).map((src, i) => (
      { type: 'item' as const, id: `src${i}`, title: src, sub: ({ files: '/etc/hosts', myhostname: 'the machine’s own name', resolve: 'systemd-resolved', dns: 'a DNS server' } as Record<string, string>)[src] ?? '', icon: src === 'files' ? 'file' : src === 'myhostname' ? 'server' : 'search', tone: src === 'files' ? 'store' as const : undefined }
    )) },
    { type: 'table', id: 'tries', title: 'Looking up sysops.example', tone: 'store', fill: true, columns: ['when', 'getent hosts said'], rows: [
      ['before', `nothing: ${read(s3, /\n(exit \d)\n/)} (not found)`],
      { id: 'after', cells: ['after one line in /etc/hosts', read(s3, /\n(127\.0\.0\.1\s+sysops\.example)\n/).replace(/\s+/, ' ')], tone: 'store' },
    ] },
  ],
  order.split(/\s+/).filter((w) => !w.startsWith('[')).slice(1).map((_, i) => ({ from: `src${i}`, to: `src${i + 1}` })),
)

// 8.4 — one HTTP request, header by header.
const sent = [...s4.matchAll(/^> (\S[^\n]*)$/gm)].map((m) => m[1])
const got = [...s4.matchAll(/^< (\S[^\n]*)$/gm)].map((m) => m[1])
const curl = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, '> GET'), rowOf(s4, '< HTTP/1.1 200 OK')] }),
  [
    { type: 'group', id: 'exchange', title: 'curl -v http://sysops.example/', icon: 'globe', tone: 'ingest', children: [
      { type: 'table', id: 'req', title: 'the request (>)', tone: 'ingest', fill: true, columns: ['line'], rows: sent.map((l) => [l]) },
      { type: 'table', id: 'res', title: 'the response (<)', tone: 'store', fill: true, columns: ['line'], rows: got.filter((l) => !/^(ETag|Accept-Ranges|Connection)/.test(l)).map((l) => [l]) },
    ] },
    { type: 'table', id: 'codes', title: 'Status codes worth knowing', tone: 'infra', fill: true, columns: ['code', 'means'], rows: [
      ['200', 'OK: the page'],
      ['301', 'moved: go to Location (8.7)'],
      ['403', 'forbidden: permissions'],
      ['404', `not found: /nope got ${outputOf(s4, "curl -s -o /dev/null -w '%{http_code}\\n' http://sysops.example/nope").trim()}`],
      ['502, 503', 'what is behind nginx failed'],
    ] },
  ],
  [{ from: 'req', to: 'res' }],
)

// 8.5 — keys, and passwords off.
const fp = read(s5, /^256 (SHA256:\S+) sysops@ops/m)
const keys = consoleFrame(
  consoleNode(WEB, s5, { show: [[1, rowOf(s5, "web-01's password:")], [rowOf(s5, 'Last login'), rows(s5)]], highlight: [rowOf(s5, 'Permission denied (publickey)')] }),
  [
    { type: 'group', id: 'pair', title: 'One key pair, two halves', sub: `the same fingerprint on both: ${fp}`, icon: 'key', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'priv', title: 'ops: ~/.ssh/id_ed25519', sub: 'the private half: never leaves ops', icon: 'lock', stack: true, tone: 'consume' },
      { type: 'item', id: 'pub', title: 'web-01: authorized_keys', sub: 'the public half: who may log in', icon: 'key', stack: true },
    ] },
    { type: 'table', id: 'off', title: 'Passwords off, in four steps', tone: 'infra', fill: true, columns: ['step', 'here'], rows: [
      ...outputOf(s5, 'ls /etc/ssh/sshd_config.d').trim().split(/\s+/).map((f, i) => [i ? 'read after it' : 'read first: it wins', f]),
      ['sshd -t', read(s5, /echo config ok\n(config ok)/)],
      ['reload, then try', read(s5, /(Permission denied \(publickey\))/)],
    ] },
  ],
  [{ from: 'priv', to: 'pub', label: 'proves it holds' }],
)

// 8.6 — the firewall, and (branch, discarded) the lock-out.
const ruleset = outputOf(s6, 'sudo nft list chain inet filter input')
const firewall = consoleFrame(
  consoleNode(WEB, s6, {
    // the install keeps its command and its summary; the download and unpack rows fold
    show: [[1, 1], [rowOf(s6, 'Upgrading: 0'), rowOf(s6, 'Upgrading: 0')], [rowOf(s6, 'ruleset ok') - 1, rows(s6)]],
    highlight: [rowOf(s6, 'policy drop'), rowOf(s6, 'dport 22 accept')],
  }),
  [
    { type: 'table', id: 'rules', title: 'The input chain: the first match decides', tone: 'ingest', fill: true, columns: ['rule', 'lets in'], rows: [
      ['policy drop', 'nothing, unless below'],
      ['ct state established…', 'replies to allowed'],
      ['iif lo', 'the machine itself'],
      ['icmp, ipv6-icmp', 'ping, network messages'],
      { id: 'ssh', cells: ['tcp dport 22', 'ssh: the team'], tone: 'store' },
      { id: 'site', cells: ['tcp dport { 80, 443 }', `the site: ${read(ruleset, /counter (packets \d+) bytes/)} yet`], tone: 'store' },
    ] },
    { type: 'group', id: 'lockout', title: '⑂ The lock-out: run once, then discarded', icon: 'firewall', tone: 'consume', children: [
      { type: 'item', id: 'ins', title: 'nft insert rule … tcp dport 22 drop', sub: 'insert puts it at the TOP, above the accept', icon: 'firewall' },
      { type: 'item', id: 'froze', title: read(s7, /(Connection to web-01 closed\.)/), sub: 'the session froze mid-command; ~. closed it', icon: 'power', tone: 'consume' },
      { type: 'item', id: 'retry', title: read(s7, /(Connection timed out during banner exchange)/), sub: 'no way back over the network: the console', icon: 'lock', tone: 'consume' },
    ] },
  ],
  [{ from: 'ins', to: 'froze' }, { from: 'froze', to: 'retry' }],
)

// 8.7 — HTTPS from the lab's ACME server.
const certPath = read(s8, /Certificate is saved at: (\S+)/)
const https = consoleFrame(
  consoleNode(WEB, s8, {
    show: [[1, 1], [rowOf(s8, 'sudo certbot --nginx'), rowOf(s8, 'sudo certbot --nginx') + 1], [rowOf(s8, 'Successfully received certificate.'), rowOf(s8, 'This certificate expires')],
      [rowOf(s8, 'Congratulations'), rowOf(s8, 'Congratulations')], [rowOf(s8, '$ curl -sI https'), rowOf(s8, 'Location: https')], [rowOf(s8, '$ sudo certbot certificates'), rowOf(s8, '$ sudo certbot certificates')],
      [rowOf(s8, '$ grep -n'), rowOf(s8, 'ssl_certificate_key') + 1], [rows(s8), rows(s8)]],
    highlight: [rowOf(s8, 'Successfully received certificate.'), rowOf(s8, 'Location: https')],
  }),
  [
    { type: 'group', id: 'acme', title: 'How certbot proved the name is the team’s', icon: 'cert', tone: 'ingest', children: [
      { type: 'item', id: 'ask', title: 'certbot asks', sub: 'for a certificate for sysops.example', icon: 'cert' },
      { type: 'item', id: 'token', title: 'the CA sets a challenge', sub: 'serve this token under /.well-known/acme-challenge/', icon: 'key', tone: 'infra' },
      { type: 'item', id: 'check', title: 'the CA fetches it', sub: 'over port 80, from outside: the firewall lets 80 in', icon: 'globe' },
      { type: 'item', id: 'issued', title: 'issued, and nginx edited', sub: 'listen 443 ssl; port 80 now answers 301', icon: 'check', tone: 'store' },
    ] },
    { type: 'table', id: 'cert', title: 'sudo certbot certificates', tone: 'store', fill: true, columns: ['', ''], rows: [
      ['key type', read(s8, /Key Type: (\S+)/)],
      ['domains', read(s8, /Domains: (\S+)/)],
      ['expires', read(s8, /Expiry Date: (\S+)/)],
      ['files', `${certPath.replace(/\/[^/]+$/, '/').replace('/etc/letsencrypt/', '…/')}`],
    ] },
  ],
  [{ from: 'ask', to: 'token' }, { from: 'token', to: 'check' }, { from: 'check', to: 'issued' }],
)

// 8.8 — ◆ full scene: one request's whole path, as the server recorded it.
const v = (re: RegExp) => read(s9, re)
const counter = read(s9, /counter (packets \d+ bytes \d+) accept/)
const requestPath: SceneModel = {
  title: 'One request, the whole way',
  sub: 'https://sysops.example/ from ops, through the firewall — every step is a line the terminal printed',
  dir: 'row',
  nodes: [
    { type: 'code', id: 'run', console: true, filename: 'sysops@ops: ~', code: s9.trimEnd() },
    { type: 'group', id: 'flow', title: 'The steps, in order', icon: 'globe', tone: 'ingest', children: [
      { type: 'item', id: 'name', title: '1 · the name', sub: `on ops: ${v(/\n(\S+)\s+sysops\.example/)} (the lab’s forward)`, icon: 'search' },
      { type: 'item', id: 'tcp', title: '2 · TCP', sub: `Connected … port ${v(/Connected to sysops\.example \([^)]+\) port (\d+)/)}`, icon: 'network' },
      { type: 'item', id: 'fw', title: '3 · the firewall', sub: `dport 443: ${counter}`, icon: 'firewall', tone: 'infra' },
      { type: 'item', id: 'tls', title: '4 · TLS', sub: `${v(/SSL connection using (TLSv[\d.]+)/)}; issuer ${v(/issuer: CN=([^\n]+)/).replace(/ [0-9a-f]+$/, '')}`, icon: 'lock', tone: 'store' },
      { type: 'item', id: 'http', title: '5 · HTTP', sub: `${v(/> (GET [^\n]+)/)} → ${v(/< HTTP\/1\.1 ([^\n]+)/)}`, icon: 'nginx', tone: 'serve' },
      { type: 'item', id: 'file', title: '6 · the file, logged', sub: `client ${v(/\n(\S+) - - \[/)}: the gateway`, icon: 'file' },
    ] },
  ],
  edges: [{ from: 'name', to: 'tcp' }, { from: 'tcp', to: 'fw' }, { from: 'fw', to: 'tls' }, { from: 'tls', to: 'http' }, { from: 'http', to: 'file' }],
}

export const networkScenes: Record<string, SceneModel> = {
  'network-interfaces': interfaces,
  'network-sockets': sockets,
  'network-names': names,
  'network-curl': curl,
  'network-keys': keys,
  'network-firewall': firewall,
  'network-https': https,
  'network-path': requestPath,
}
