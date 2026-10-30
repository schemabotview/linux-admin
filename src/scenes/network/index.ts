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
    { type: 'table', id: 'addrs', title: 'ip -br address', tone: 'ingest', fill: true, columns: ['interface', 'state', 'IPv4'], rows: brief.map((b) => [b[0], b[1], b[2]]) },
    { type: 'table', id: 'routes', title: 'ip route: where a packet goes', tone: 'store', fill: true, columns: ['to', 'via'], rows: routes.map((r) => [r.split(' ')[0], r.includes(' via ') ? read(r, /via (\S+)/) : `${read(r, /dev (\S+)/)} directly`]) },
    { type: 'note', id: 'note', tone: 'ingest', text: 'netplan’s file says dhcp4: true — the address is handed out by the network, here the lab’s own (QEMU’s user network, gateway 10.0.2.2: the lab host). lo is the machine talking to itself.' },
  ],
  [{ from: 'host', to: 'gw' }, { from: 'gw', to: 'world' }],
)

// 8.2 — which program listens on which port.
const listen = outputOf(s2, 'ss -tln').trim().split('\n').slice(1).map((l) => l.trim().split(/\s+/)[3])
// ss puts each socket's process on the row after it (its own column wrap): pair them up
const ssp = outputOf(s2, 'sudo ss -tlnp').split('\n')
const owners = ssp.flatMap((l, i) => l.startsWith('LISTEN') ? [{ at: l.split(/\s+/)[3], who: read(ssp[i + 1], /\(\("([^"]+)"/) }] : [])
const ROLE: Record<string, string> = { nginx: 'the site', sshd: 'the team’s logins', 'systemd-resolve': 'name lookups (local only, or LLMNR on 5355)' }
const sockets = consoleFrame(
  consoleNode(WEB, s2, { highlight: [rowOf(s2, '0.0.0.0:80 '), rowOf(s2, 'ESTAB')] }),
  [
    { type: 'table', id: 'listen', title: `ss -tlnp: ${listen.length} listening sockets, and who holds each`, tone: 'ingest', fill: true, columns: ['address:port', 'program', 'for'], rows: owners.map((o) => ({ id: o.at, cells: [o.at, o.who, ROLE[o.who] ?? ''], tone: o.who === 'nginx' ? 'serve' as const : undefined })) },
    { type: 'table', id: 'addr', title: 'Reading the local address', tone: 'store', fill: true, columns: ['written', 'means'], rows: [
      ['0.0.0.0:80, [::]:22', 'every address this machine has: reachable from outside'],
      ['127.0.0.53%lo:53', 'loopback only: no other machine can reach it'],
    ] },
    { type: 'table', id: 'estab', title: 'ss -tn: this very session', tone: 'infra', fill: true, columns: ['', ''], rows: (() => {
      const e = outputOf(s2, 'ss -tn').trim().split('\n')[1].trim().split(/\s+/)
      return [['state', e[0]], ['web-01 side', e[3]], ['the other end', `${e[4]}: ops, via the gateway`]]
    })() },
  ],
)

// 8.3 — names: /etc/hosts first, then DNS.
const order = read(s3, /^hosts:\s+([^\n]+)$/m)
const names = consoleFrame(
  consoleNode(WEB, s3, { highlight: [rowOf(s3, 'exit 2'), rowOf(s3, '127.0.0.1       sysops.example')] }),
  [
    { type: 'group', id: 'order', title: `/etc/nsswitch.conf — hosts: ${order}`, icon: 'search', tone: 'ingest', dir: 'row', children: order.split(/\s+/).filter((w) => !w.startsWith('[')).map((src, i) => (
      { type: 'item' as const, id: `src${i}`, title: src, sub: ({ files: '/etc/hosts', myhostname: 'the machine’s own name', resolve: 'systemd-resolved', dns: 'a DNS server' } as Record<string, string>)[src] ?? '', stack: true, chip: true, tone: src === 'files' ? 'store' as const : undefined }
    )) },
    { type: 'table', id: 'tries', title: 'Looking up sysops.example', tone: 'store', fill: true, columns: ['when', 'getent hosts said'], rows: [
      ['before', `nothing: ${read(s3, /\n(exit \d)\n/)} (not found)`],
      { id: 'after', cells: ['after one line in /etc/hosts', read(s3, /\n(127\.0\.0\.1\s+sysops\.example)\n/).replace(/\s+/, ' ')], tone: 'store' },
    ] },
    { type: 'table', id: 'hosts', title: '/etc/hosts, its entries (before the team’s line)', tone: 'source', fill: true, columns: ['address', 'names'], rows:
      outputOf(s3, 'cat /etc/hosts').split('\n').filter((l) => /^[0-9a-f:.]+\s/.test(l)).map((l) => [l.split(/\s+/)[0], l.split(/\s+/).slice(1).join(' ')]) },
    { type: 'note', id: 'note', tone: 'ingest', text: 'On the internet, sysops.example would be a DNS record pointing at the server’s public address. This lab has no public DNS, so the name is given in /etc/hosts — the first place the lookup order checks. cloud-init’s header warns it may rewrite that file.' },
  ],
  order.split(/\s+/).filter((w) => !w.startsWith('[')).slice(1).map((_, i) => ({ from: `src${i}`, to: `src${i + 1}` })),
)

// 8.4 — one HTTP request, header by header.
const sent = [...s4.matchAll(/^> (\S[^\n]*)$/gm)].map((m) => m[1])
const got = [...s4.matchAll(/^< (\S[^\n]*)$/gm)].map((m) => m[1])
const curl = consoleFrame(
  consoleNode(WEB, s4, { highlight: [rowOf(s4, '> GET'), rowOf(s4, '< HTTP/1.1 200 OK')] }),
  [
    { type: 'group', id: 'exchange', title: 'curl -v http://sysops.example/', icon: 'globe', tone: 'ingest', dir: 'row', children: [
      { type: 'table', id: 'req', title: 'the request (>)', tone: 'ingest', columns: ['line'], rows: sent.map((l) => [l]) },
      { type: 'table', id: 'res', title: 'the response (<)', tone: 'store', columns: ['line'], rows: got.filter((l) => !/^(ETag|Accept-Ranges|Connection)/.test(l)).map((l) => [l]) },
    ] },
    { type: 'table', id: 'codes', title: 'Status codes worth knowing', tone: 'infra', fill: true, columns: ['code', 'means', 'here'], rows: [
      ['200', 'OK', 'the page'],
      ['301', 'moved: go to Location', '8.7'],
      ['403', 'forbidden: permissions (5.4)', 'course 11'],
      ['404', 'no such file', `/nope: ${outputOf(s4, "curl -s -o /dev/null -w '%{http_code}\\n' http://sysops.example/nope").trim()}`],
      ['502, 503', 'the server behind nginx failed', '—'],
    ] },
  ],
  [{ from: 'req', to: 'res' }],
)

// 8.5 — keys, and passwords off.
const fp = read(s5, /^256 (SHA256:\S+) sysops@ops/m)
const keys = consoleFrame(
  consoleNode(WEB, s5, { show: [[1, rowOf(s5, "web-01's password:")], [rowOf(s5, 'Last login'), rows(s5)]], highlight: [rowOf(s5, 'Permission denied (publickey)')] }),
  [
    { type: 'group', id: 'pair', title: 'One key pair, two halves', icon: 'key', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'priv', title: 'ops: ~/.ssh/id_ed25519', sub: 'the private half: never leaves ops', icon: 'lock', stack: true, tone: 'consume' },
      { type: 'item', id: 'pub', title: 'web-01: ~/.ssh/authorized_keys', sub: 'the public half: which keys may log in', icon: 'key', stack: true },
    ] },
    { type: 'table', id: 'fp', title: 'The same fingerprint on both ends', tone: 'store', fill: true, columns: ['where', 'ssh-keygen -lf'], rows: [['authorized_keys on web-01', fp], ['id_ed25519.pub on ops', fp]] },
    { type: 'table', id: 'off', title: 'Passwords off, in four steps', tone: 'infra', fill: true, columns: ['step', 'here'], rows: [
      ['a drop-in file', 'sshd_config.d/10-no-passwords.conf'],
      ['first value wins', `${outputOf(s5, 'ls /etc/ssh/sshd_config.d').trim().split(/\s+/).join(' before ')}`],
      ['sshd -t', read(s5, /echo config ok\n(config ok)/)],
      ['reload, then try', read(s5, /(Permission denied \(publickey\))/)],
    ] },
    { type: 'note', id: 'note', tone: 'consume', text: 'Change sshd only while a second session is still logged in, and test from a third. A mistake here locks out exactly the people who could fix it.' },
  ],
  [{ from: 'priv', to: 'pub', label: 'proves it holds' }],
)

// 8.6 — the firewall, and (branch, discarded) the lock-out.
const ruleset = outputOf(s6, 'sudo nft list chain inet filter input')
const firewall = consoleFrame(
  consoleNode(WEB, s6, { show: [[1, rowOf(s6, 'Space needed')], [rowOf(s6, 'ruleset ok') - 1, rows(s6)]], highlight: [rowOf(s6, 'policy drop'), rowOf(s6, 'dport 22 accept')] }),
  [
    { type: 'table', id: 'rules', title: 'The input chain, top to bottom: the first match decides', tone: 'ingest', fill: true, columns: ['rule', 'lets in'], rows: [
      ['policy drop', 'nothing — unless a rule below says so'],
      ['ct state established,related', 'replies to connections already allowed'],
      ['iif lo', 'the machine talking to itself'],
      ['icmp, ipv6-icmp', 'ping and the network’s own messages'],
      { id: 'ssh', cells: ['tcp dport 22', 'ssh: the team'], tone: 'store' },
      { id: 'site', cells: ['tcp dport { 80, 443 }', `the site — counter: ${read(ruleset, /counter (packets \d+ bytes \d+) accept/)}`], tone: 'store' },
    ] },
    { type: 'code', id: 'lockout', console: true, filename: '⑂ the lock-out (run, then discarded)', code: s7.trimEnd() },
    { type: 'note', id: 'note', tone: 'consume', text: 'insert puts a rule at the TOP. One drop for port 22 above the accept, and the session froze mid-command; ~. closed it, and a new login timed out. The way back is the console — on a cloud server, the provider’s. Test rules with a timer that undoes them, or keep a console open.' },
  ],
)

// 8.7 — HTTPS from the lab's ACME server.
const certPath = read(s8, /Certificate is saved at: (\S+)/)
const https = consoleFrame(
  consoleNode(WEB, s8, { show: [[1, 2], [rowOf(s8, 'sudo certbot --nginx'), rowOf(s8, 'Congratulations')], [rowOf(s8, '$ curl -sI https'), rowOf(s8, 'Location: https')], [rowOf(s8, '$ grep -n'), rows(s8)]], highlight: [rowOf(s8, 'Successfully received certificate.'), rowOf(s8, 'Location: https')] }),
  [
    { type: 'group', id: 'acme', title: 'How certbot proved the name is the team’s', icon: 'cert', tone: 'ingest', dir: 'row', children: [
      { type: 'item', id: 'ask', title: 'certbot asks', sub: 'a certificate for sysops.example', stack: true },
      { type: 'item', id: 'token', title: 'a challenge', sub: 'serve this token at /.well-known/acme-challenge/', stack: true, tone: 'infra' },
      { type: 'item', id: 'check', title: 'the CA fetches it', sub: 'over port 80, from outside', stack: true },
      { type: 'item', id: 'issued', title: 'issued', sub: 'saved in /etc/letsencrypt/live/', icon: 'cert', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'cert', title: 'sudo certbot certificates', tone: 'store', fill: true, columns: ['', ''], rows: [
      ['key type', read(s8, /Key Type: (\S+)/)],
      ['domains', read(s8, /Domains: (\S+)/)],
      ['expires', read(s8, /Expiry Date: (\S+)/)],
      ['files', `${certPath.replace(/\/[^/]+$/, '/')} fullchain.pem, privkey.pem`],
    ] },
    { type: 'table', id: 'nginx', title: 'What certbot changed in the site’s block', tone: 'serve', fill: true, columns: ['line', 'does'], rows: [
      ['listen 443 ssl', 'HTTPS on port 443'],
      ['ssl_certificate, _key', 'the two files above'],
      [`HTTP → ${read(s8, /^(HTTP\/1\.1 301 [^\n]+)$/m).replace('HTTP/1.1 ', '')}`, 'port 80 now redirects (--redirect)'],
    ] },
    { type: 'note', id: 'note', tone: 'ingest', text: 'The CA here is the lab’s: Pebble, Let’s Encrypt’s own test server, running on the lab host as acme.ops. Same protocol, same certbot — but its certificates are trusted only in this lab, and they last five years where Let’s Encrypt’s last 90 days.' },
  ],
  [{ from: 'ask', to: 'token' }, { from: 'token', to: 'check' }, { from: 'check', to: 'issued' }],
)

// 8.8 — ◆ full scene: one request's whole path, as the server recorded it.
const v = (re: RegExp) => read(s9, re)
const counter = read(s9, /counter (packets \d+ bytes \d+) accept/)
const requestPath: SceneModel = {
  title: 'One request, the whole way',
  sub: 'https://sysops.example/ from ops, through the firewall — every step is a line the terminal printed',
  dir: 'col',
  nodes: [
    { type: 'group', id: 'flow', bare: true, dir: 'row', children: [
      { type: 'item', id: 'name', title: '1 · the name', sub: `on ops: ${v(/\n(\S+)\s+sysops\.example/)} (the lab’s forward)`, icon: 'search', stack: true },
      { type: 'item', id: 'tcp', title: '2 · TCP', sub: `Connected … port ${v(/Connected to sysops\.example \([^)]+\) port (\d+)/)}`, icon: 'network', stack: true },
      { type: 'item', id: 'fw', title: '3 · the firewall', sub: `dport 443: ${counter}`, icon: 'firewall', stack: true, tone: 'infra' },
      { type: 'item', id: 'tls', title: '4 · TLS', sub: `${v(/SSL connection using (TLSv[\d.]+)/)}; issuer ${v(/issuer: CN=([^\n]+)/).replace(/ [0-9a-f]+$/, '')}`, icon: 'lock', stack: true, tone: 'store' },
      { type: 'item', id: 'http', title: '5 · HTTP', sub: `${v(/> (GET [^\n]+)/)} → ${v(/< HTTP\/1\.1 ([^\n]+)/)}`, icon: 'nginx', stack: true, tone: 'serve' },
      { type: 'item', id: 'file', title: '6 · the file, logged', sub: `client ${v(/\n(\S+) - - \[/)}: the gateway`, icon: 'file', stack: true },
    ] },
    { type: 'code', id: 'run', console: true, filename: 'sysops@ops: ~', code: s9.trimEnd() },
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
