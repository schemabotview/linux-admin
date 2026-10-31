#!/usr/bin/env node
// The YouTube thumbnail for the single full-course film (scripts/out/film.mp4).
//
// Not the shell's `graphl-thumb`: that template is a PER-COURSE poster (58% scene + panel), and a
// cropped 16:9 video frame turns to mush at the ~168px the mobile feed actually renders. A film
// cover needs poster grammar — few elements, enormous type, one focal object.
//
// Everything on the card is REAL: the course grid is read out of the intro scene through the same
// registry the content checks use, and the terminal cards are cut out of a spine session.txt — the
// same replayed output the scenes show. So the cover cannot promise a course this repo does not
// teach, and nothing on it is retyped by hand.

import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, isAbsolute } from 'node:path'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const repoDir = process.cwd()
const FFMPEG = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(existsSync) ?? 'ffmpeg'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const SCALE = 2
const W = 1280 * SCALE
const H = 720 * SCALE

// lab/ captures through an 80-column pty, so a long line is WRAPPED in the transcript exactly as a
// real terminal wraps it. Rejoin those pieces before reading values out, or a URL splits mid-word.
const PTY_COLS = 80
function unwrap(text) {
  const out = []
  for (const line of text.split('\n')) {
    const prev = out[out.length - 1]
    if (prev !== undefined && prev.length === PTY_COLS) out[out.length - 1] = prev + line
    else out.push(line)
  }
  return out.map((l) => l.trimEnd())
}
const sessionLines = (...parts) => unwrap(readFileSync(join(repoDir, 'spine', ...parts), 'utf8'))

// A captured prompt is `sysops@web-01:~$ ` (Debian) or `[sysops@web-02 ~]$ ` (Rocky).
const PROMPT = /^(?:\[?[\w.-]+@[\w.-]+[\s:][^$#]*)[$#] (.*)$/
const commandAt = (lines, i) => lines[i].match(PROMPT)?.[1] ?? null
const isPrompt = (l) => PROMPT.test(l)

/** The lines a command printed, up to the next prompt. */
function outputAfter(lines, i) {
  const body = []
  for (let j = i + 1; j < lines.length && !isPrompt(lines[j]); j++) body.push(lines[j])
  return body
}

/**
 * §8.4 — `curl -v http://sysops.example/`: the request going out, the response coming back, and
 * the page itself. The strongest hook this course has, because it is the thing the whole series
 * is building towards: a server that answers.
 */
function realRequest() {
  const lines = sessionLines('network', '04-curl-the-site', 'session.txt')
  const i = lines.findIndex((l) => /^.*\$ curl -v http/.test(l))
  if (i < 0) throw new Error('no `curl -v http…` command in network/04-curl-the-site')
  const cmd = commandAt(lines, i)
  const body = outputAfter(lines, i)

  const hero = body.find((l) => /^< HTTP\/1\.1 200 OK$/.test(l))
  if (!hero) throw new Error('no `< HTTP/1.1 200 OK` in the curl session — did the site stop answering?')
  const sent = body.find((l) => /^> GET \/ HTTP/.test(l))
  if (!sent) throw new Error('no `> GET / HTTP/1.1` in the curl session')
  const page = body.find((l) => /^<h1>/.test(l))
  if (!page) throw new Error('no served page (`<h1>…`) in the curl session')

  // The response headers worth showing, in the order curl printed them. Long ones are OMITTED
  // rather than truncated (see MAX below), so nothing shown is ever altered.
  const headers = body.filter((l) => /^< \S+: /.test(l) && !/^< (Date|ETag|Last-Modified|Connection|Accept-Ranges):/.test(l))
  return { cmd, hero: hero.replace(/^< /, ''), sent, headers, page }
}

/**
 * §11.5 — the same page, the same permissions, and a 403 on Rocky. The failure that makes the
 * SELinux course land: every classic check says yes and the kernel still says no.
 */
function realSelinux() {
  const lines = sessionLines('rhel', '05-the-403', 'session.txt')
  const ci = lines.findIndex((l) => /\$ curl .*http_code/.test(l))
  if (ci < 0) throw new Error('no http_code curl in rhel/05-the-403')
  const code = outputAfter(lines, ci).find((l) => /^\d{3}$/.test(l))
  if (code !== '403') throw new Error(`expected a 403 in rhel/05-the-403, got ${code ?? 'nothing'}`)

  const ni = lines.findIndex((l) => /\$ namei -l /.test(l))
  if (ni < 0) throw new Error('no `namei -l` in rhel/05-the-403')
  const cmd = commandAt(lines, ni)
  const rows = outputAfter(lines, ni)
    .filter((l) => /^[d-][rwx-]{9}\s/.test(l))
    .map((l) => {
      const m = l.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/)
      if (!m) throw new Error(`unparsed namei row: "${l}"`)
      return { mode: m[1], owner: m[2], group: m[3], name: m[4] }
    })
  if (!rows.length) throw new Error('no namei rows in rhel/05-the-403')

  const li = lines.findIndex((l) => /\$ sudo tail .*error\.log/.test(l))
  const why = li < 0 ? null : outputAfter(lines, li).join(' ').match(/\((13: Permission denied)\)/)?.[1]
  if (!why) throw new Error('no `13: Permission denied` in the nginx error log')
  return { cmd, code, rows, why }
}

/**
 * The course grid, read from the intro scene (`intro-what-we-will-build`) through the same
 * registry the checks use — so the cover shows THE COURSE'S OWN list. Edit the scene and the
 * thumbnail follows; if that scene ever stops having a `web01` group the render fails rather
 * than falling back to something invented.
 */
async function realCourses() {
  const { loadRegistry, nodesOf } = await import(pathToFileURL(join(repoDir, 'scripts', 'registry.mjs')).href)
  const reg = await loadRegistry()
  for (const scene of Object.values(reg.SCENES)) {
    const hit = nodesOf(scene).find(({ node }) => node.id === 'web01')
    if (!hit) continue
    const items = (hit.node.children ?? []).filter((c) => c.type === 'item')
    if (!items.length) throw new Error('the "web01" group has no items')
    return { title: scene.title, sub: hit.node.sub, host: hit.node.title, items }
  }
  throw new Error('no scene contains a group with id "web01" — has src/scenes/intro changed?')
}

// ── the page ────────────────────────────────────────────────────────────────────────────────────
const fontFace = (fam, weight, file) => {
  const b64 = readFileSync(join(repoDir, 'node_modules', '@fontsource', fam, 'files', file)).toString('base64')
  return `@font-face{font-family:'${fam === 'ibm-plex-mono' ? 'IBM Plex Mono' : 'IBM Plex Sans'}';`
    + `font-weight:${weight};font-style:normal;font-display:block;`
    + `src:url(data:font/woff2;base64,${b64}) format('woff2')}`
}

// The scene engine's tone palette (@graphlearning/graphl-flow), its dark row — the card is dark in
// every theme. Using these instead of invented colours paints the cover like the scenes.
const TONE = {
  neutral: { accent: '#9aa4b2', tint: '#181b20' },
  ingest:  { accent: '#4f8ff7', tint: '#111d2e' },
  store:   { accent: '#37b877', tint: '#122419' },
  serve:   { accent: '#c98bff', tint: '#1e1428' },
  consume: { accent: '#f0656f', tint: '#2a1416' },
  infra:   { accent: '#f0902f', tint: '#241c12' },
}

// The accent is the repo's own amber (scripts/concept.json panelBg), not Python's yellow.
const THEMES = {
  dark:  { badgeInk: '#1a1206', bg: '#0c1016', card: '#141b26', ink: '#ffffff', accent: '#e3a72f', rule: 'rgba(255,255,255,.14)',
           glow: 'radial-gradient(120% 120% at 8% 10%, #1d2738 0%, #0c1016 60%)' },
  navy:  { badgeInk: '#0f141a', bg: '#0f141a', card: '#182434', ink: '#ffffff', accent: '#e3a72f', rule: 'rgba(255,255,255,.12)',
           glow: 'radial-gradient(130% 110% at 85% 15%, #1d3a5c 0%, #0f141a 62%)' },
  light: { badgeInk: '#ffffff', bg: '#f4f6fa', card: '#141b26', ink: '#0d1220', accent: '#a5660a', rule: 'rgba(0,0,0,.12)',
           glow: 'radial-gradient(120% 120% at 10% 8%, #ffffff 0%, #e9edf4 70%)' },
}

function pageHtml({ request, selinux, courses, theme, head1, head2, badge, mark, foot }) {
  const t = THEMES[theme]
  const fonts = [
    fontFace('ibm-plex-sans', 700, 'ibm-plex-sans-latin-700-normal.woff2'),
    fontFace('ibm-plex-sans', 600, 'ibm-plex-sans-latin-600-normal.woff2'),
    fontFace('ibm-plex-mono', 600, 'ibm-plex-mono-latin-600-normal.woff2'),
    fontFace('ibm-plex-mono', 400, 'ibm-plex-mono-latin-400-normal.woff2'),
  ].join('')

  // One grid for the namei table, so every column lines up across rows and nothing can collide.
  const naiCells = (selinux?.rows ?? []).map((r) => {
    const leaf = !r.mode.startsWith('d')
    return `<span class="mode${leaf ? ' hot' : ''}">${esc(r.mode)}</span>`
      + `<span class="own">${esc(r.owner)}</span>`
      + `<span class="nm">${esc(r.name)}</span>`
  }).join('')

  return `<style>
  ${fonts}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{background:${t.bg};background-image:${t.glow};
       font-family:'IBM Plex Sans',system-ui,sans-serif;color:${t.ink};
       display:flex;align-items:stretch;gap:${40 * SCALE}px;padding:${46 * SCALE}px ${50 * SCALE}px}

  .left{flex:0 0 auto;max-width:${470 * SCALE}px;display:flex;flex-direction:column;justify-content:center}
  .logo{width:${104 * SCALE}px;height:${104 * SCALE}px;display:block;margin-bottom:${16 * SCALE}px;
        align-self:flex-start}
  .h{font-weight:700;line-height:.85;letter-spacing:-.05em;font-size:${116 * SCALE}px;white-space:nowrap}
  .h2{color:${t.accent}}
  .badge{align-self:flex-start;margin-top:${26 * SCALE}px;padding:${11 * SCALE}px ${24 * SCALE}px;
         background:${t.accent};border-radius:${12 * SCALE}px;
         font-weight:700;font-size:${34 * SCALE}px;letter-spacing:.06em;color:${t.badgeInk}}

  .card{flex:1;min-width:0;background:${t.card};border:${1 * SCALE}px solid ${t.rule};
        border-radius:${18 * SCALE}px;padding:${26 * SCALE}px ${30 * SCALE}px ${24 * SCALE}px;
        display:flex;flex-direction:column;box-shadow:0 ${22 * SCALE}px ${64 * SCALE}px rgba(0,0,0,.5)}
  .dots{display:flex;gap:${9 * SCALE}px;margin-bottom:${18 * SCALE}px}
  .dots i{width:${13 * SCALE}px;height:${13 * SCALE}px;border-radius:50%}
  .cmd{font-family:'IBM Plex Mono',monospace;font-size:${26 * SCALE}px;font-weight:400;
       color:rgba(255,255,255,.66);margin-bottom:${14 * SCALE}px;white-space:nowrap}
  .cmd b{color:${TONE.store.accent};font-weight:400}

  /* the course grid */
  .uses{flex:1;min-width:0;display:grid;grid-template-columns:1fr 1fr;align-content:center;
        column-gap:${24 * SCALE}px;row-gap:${17 * SCALE}px;margin:${8 * SCALE}px 0}
  .use{display:flex;align-items:flex-start;gap:${11 * SCALE}px;min-width:0}
  .ico{width:${29 * SCALE}px;height:${29 * SCALE}px;flex:0 0 auto;margin-top:${2 * SCALE}px}
  .usetext{min-width:0}
  .usetitle{font-weight:700;font-size:${25 * SCALE}px;color:#ffffff;letter-spacing:-.01em;white-space:nowrap}
  .usesub{font-size:${21 * SCALE}px;color:rgba(255,255,255,.56);margin-top:${2 * SCALE}px;white-space:nowrap}

  /* the request card */
  .resp{flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:column;
        justify-content:center;gap:${9 * SCALE}px;
        font-family:'IBM Plex Mono',monospace;font-size:${28 * SCALE}px;white-space:nowrap}
  .hdr{color:rgba(255,255,255,.62);font-weight:400}
  .hdr b{color:rgba(255,255,255,.88);font-weight:600}
  .page{color:${TONE.store.accent};font-weight:600;font-size:${30 * SCALE}px}

  /* the namei table */
  .rows{flex:1;display:grid;align-content:center;grid-template-columns:auto auto 1fr;
        column-gap:${18 * SCALE}px;row-gap:${22 * SCALE}px;
        font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:${30 * SCALE}px;color:#fff}
  .mode{letter-spacing:-.02em;color:rgba(255,255,255,.9)}
  .mode.hot{color:${TONE.infra.accent}}
  .own{color:rgba(255,255,255,.6)}
  .nm{color:rgba(255,255,255,.9)}

  .stat{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:${46 * SCALE}px;
        letter-spacing:-.02em;white-space:nowrap}
  .stat.good{color:${TONE.store.accent}}
  .stat.bad{color:${TONE.consume.accent}}
  .stat2{font-weight:700;font-size:${40 * SCALE}px;color:#ffffff;letter-spacing:-.02em;white-space:nowrap}
  .statsub{font-family:'IBM Plex Mono',monospace;font-size:${26 * SCALE}px;
           color:rgba(255,255,255,.55);margin-top:${6 * SCALE}px;white-space:nowrap}
  .foot{margin-top:${20 * SCALE}px;white-space:nowrap;font-family:'IBM Plex Mono',monospace;
        font-size:${24 * SCALE}px;color:rgba(255,255,255,.4);letter-spacing:.04em}
</style>
<div class="left">
  ${markSvg(t, theme, mark)}
  <div class="h">${esc(head1)}</div>
  ${head2.split(/\s+/).map((w) => `<div class="h h2">${esc(w)}</div>`).join('')}
  <div class="badge">${esc(badge)}</div>
</div>
<div class="card">
  <div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
  ${courses
    ? `<div class="stat2">${esc(courses.title)}</div>
       <div class="uses">${usesHtml(courses)}</div>
       <div class="foot">${esc(foot)}</div>`
    : request
    ? `<div class="cmd">$ <b>${esc(request.cmd)}</b></div>
       <div class="stat good">${esc(request.hero)}</div>
       <div class="statsub">${esc(request.sent)}</div>
       <div class="resp">${respHtml(request)}</div>
       <div class="foot">${esc(foot)}</div>`
    : `<div class="cmd">$ <b>${esc(selinux.cmd)}</b></div>
       <div class="stat bad">${esc(selinux.code)}</div>
       <div class="statsub">${esc(selinux.why)}</div>
       <div class="rows">${naiCells}</div>
       <div class="foot">${esc(foot)}</div>`}
</div>`
}

/**
 * The mark. `glyph` (the default) is the repo's own: a shell prompt. It is the most recognisable
 * thing on a Linux screen, it is exactly what the card beside it shows, and it belongs to nobody.
 *
 * `tux` draws the engine's bundled Linux mark. "Linux" is a registered trademark of Linus Torvalds
 * and Tux is Larry Ewing's image with its own attribution condition, so that build is NOT the
 * default — see output/thumbnails/README.md before publishing with it.
 */
function markSvg(t, theme, mark) {
  if (mark === 'glyph') {
    const ink = theme === 'light' ? t.accent : '#ffffff'
    return `<svg class="logo" viewBox="0 0 64 64" role="img" aria-label="a shell prompt — GraphL"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M12 18 L27 32 L12 46" fill="none" stroke="${ink}" stroke-width="7"
        stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M34 46 L54 46" fill="none" stroke="${t.accent}" stroke-width="7" stroke-linecap="round"/>
    </svg>`
  }
  const { path } = brandIcon('linux')
  const ink = theme === 'light' ? '#0d1220' : '#ffffff'
  return `<svg class="logo" viewBox="0 0 24 24" role="img" aria-label="Linux"
    xmlns="http://www.w3.org/2000/svg"><path fill="${ink}" d="${path}"/></svg>`
}

// ── the app's own icons ──────────────────────────────────────────────────────────────────────────
// graphl-flow maps its semantic icon names onto lucide components (`firewall` → BrickWall,
// `disk` → HardDrive) and bundles brand marks as path data. Resolve a name exactly the way the
// engine does, so the cover's icons are the scene's icons and cannot drift from them.
const engineSrc = () =>
  readFileSync(join(repoDir, 'node_modules', '@graphlearning', 'graphl-flow', 'dist', 'index.js'), 'utf8')

let ENGINE = null
function engineMaps() {
  if (ENGINE) return ENGINE
  const src = engineSrc()
  const head = src.slice(0, src.indexOf('from "lucide-react"'))
  const alias = {}                                   // minified ident → lucide component name
  for (const m of head.matchAll(/(\w+) as ([\w$]+)/g)) alias[m[2]] = m[1]
  const named = {}                                   // semantic icon name → minified ident
  for (const m of src.matchAll(/(?:^|[{,\n])\s*([a-z][\w-]*):\s*([A-Za-z$][\w$]*)\s*(?=[,}])/g)) {
    if (!(m[1] in named)) named[m[1]] = m[2]
  }
  ENGINE = { src, alias, named }
  return ENGINE
}

const kebab = (pascal) => pascal.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])(\d)/g, '$1-$2').toLowerCase()

function brandIcon(name) {
  const { src, named } = engineMaps()
  const id = named[name]
  if (!id) throw new Error(`icon "${name}" is not in graphl-flow's icon map`)
  const at = src.search(new RegExp(`(?:^|[\\s,;])${id.replace('$', '\\$')}\\s*=\\s*\\{`))
  if (at < 0) throw new Error(`no definition for bundled icon "${name}" (${id})`)
  const seg = src.slice(at, at + 8000)
  const path = seg.match(/path:\s*"([^"]+)"/)?.[1]
  if (!path) throw new Error(`no path for bundled icon "${name}"`)
  return { title: seg.match(/title:\s*"([^"]+)"/)?.[1] ?? name, path }
}

function lucideSvg(file, colour) {
  // Some names are aliases that re-export another icon (`filter.mjs` → `funnel.mjs`); follow them.
  for (let hop = 0; hop < 4; hop++) {
    const alias = readFileSync(file, 'utf8').match(/export\s*\{\s*default\s*\}\s*from\s*'\.\/([\w-]+)\.mjs'/)
    if (!alias) break
    file = join(dirname(file), `${alias[1]}.mjs`)
  }
  const nodes = [...readFileSync(file, 'utf8').matchAll(/\[\s*"(\w+)",\s*\{([^}]*)\}\s*\]/g)]
    .map((m) => {
      const attrs = [...m[2].matchAll(/(\w+):\s*"([^"]*)"/g)]
        .filter(([, k]) => k !== 'key').map(([, k, v]) => `${k}="${v}"`).join(' ')
      return `<${m[1]} ${attrs}/>`
    }).join('')
  if (!nodes) throw new Error(`no geometry in ${file}`)
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${nodes}</svg>`
}

function iconSvg(name, colour) {
  const direct = join(repoDir, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons', `${name}.mjs`)
  if (existsSync(direct)) return lucideSvg(direct, colour)
  const { alias, named } = engineMaps()
  const lucideName = alias[named[name]]
  if (lucideName) {
    const f = join(repoDir, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons', `${kebab(lucideName)}.mjs`)
    if (existsSync(f)) return lucideSvg(f, colour)
  }
  const { path } = brandIcon(name)   // a brand mark (debian, rocky, nginx …)
  return `<svg class="ico" viewBox="0 0 24 24" fill="${colour}" xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg>`
}

function usesHtml(courses) {
  return courses.items.map((it) => `<div class="use">
      ${iconSvg(it.icon, TONE.infra.accent)}
      <div class="usetext"><div class="usetitle">${esc(it.title)}</div>`
    + (it.sub ? `<div class="usesub">${esc(it.sub)}</div>` : '')
    + `</div></div>`).join('')
}

/** The response as the card: the headers nginx sent, and the page itself. */
function respHtml(r) {
  // Long header lines are OMITTED rather than truncated — nothing shown is ever altered.
  const MAX = 40
  const rows = r.headers
    .map((l) => l.replace(/^< /, ''))
    .filter((l) => l.length <= MAX)
    .map((l) => {
      const [k, ...v] = l.split(': ')
      return `<div class="hdr"><b>${esc(k)}</b>: ${esc(v.join(': '))}</div>`
    })
  return rows.join('') + `<div class="page">${esc(r.page)}</div>`
}

// ── render ──────────────────────────────────────────────────────────────────────────────────────
const FOOT = {
  courses: 'one server · ten courses · every output real',
  request: 'the site, served by nginx',
  selinux: 'every rwx says yes — the kernel still says no',
}

async function main() {
  const argv = process.argv.slice(2)
  // The defaults ARE the shipped cover (output/thumbnails/film.png), so a bare run reproduces it
  // rather than quietly replacing it with something else. `--source request` has the stronger
  // single hook at 168px and `--mark glyph` needs nobody's permission; both are kept rendered as
  // alternatives. See output/thumbnails/README.md — the Tux mark has an open trademark question.
  const opt = { theme: 'dark', out: 'output/thumbnails/film.png', source: 'courses', mark: 'tux',
                head1: 'LEARN', head2: 'LINUX', badge: 'FULL COURSE', foot: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--theme') opt.theme = argv[++i]
    else if (a === '--out') opt.out = argv[++i]
    else if (a === '--head1') opt.head1 = argv[++i]
    else if (a === '--head2') opt.head2 = argv[++i]
    else if (a === '--badge') opt.badge = argv[++i]
    else if (a === '--source') opt.source = argv[++i]
    else if (a === '--mark') opt.mark = argv[++i]
    else if (a === '--foot') opt.foot = argv[++i]
    else { console.error(`unknown argument: ${a}`); process.exit(2) }
  }
  if (!THEMES[opt.theme]) { console.error(`unknown theme: ${opt.theme} (have: ${Object.keys(THEMES).join(', ')})`); process.exit(2) }
  if (!['courses', 'request', 'selinux'].includes(opt.source)) {
    console.error(`unknown source: ${opt.source} (have: courses, request, selinux)`); process.exit(2)
  }
  if (!['glyph', 'tux'].includes(opt.mark)) {
    console.error(`unknown mark: ${opt.mark} (have: glyph, tux)`); process.exit(2)
  }
  opt.foot ??= FOOT[opt.source]

  const courses = opt.source === 'courses' ? await realCourses() : null
  const request = opt.source === 'request' ? realRequest() : null
  const selinux = opt.source === 'selinux' ? realSelinux() : null
  if (courses) {
    console.log(`Real scene from src/scenes/intro: "${courses.title}" — ${courses.host}`)
    for (const it of courses.items) console.log(`  ${String(it.icon).padEnd(9)} ${it.title}${it.sub ? ` — ${it.sub}` : ''}`)
  } else if (request) {
    console.log(`Real request from spine/network/04: $ ${request.cmd}`)
    console.log(`  ${request.sent}\n  < ${request.hero}`)
    for (const h of request.headers) console.log(`  ${h}`)
    console.log(`  ${request.page}`)
  } else {
    console.log(`Real 403 from spine/rhel/05: ${selinux.code} — ${selinux.why}`)
    console.log(`  $ ${selinux.cmd}`)
    for (const r of selinux.rows) console.log(`  ${r.mode} ${r.owner.padEnd(7)} ${r.name}`)
  }
  if (opt.mark === 'tux') console.log('\nMark: the Linux mark — read output/thumbnails/README.md before publishing this build')

  const requireFromRepo = createRequire(join(repoDir, 'package.json'))
  const { default: puppeteer } = await import(pathToFileURL(requireFromRepo.resolve('puppeteer')).href)

  const browser = await puppeteer.launch({ headless: true,
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, args: [`--window-size=${W},${H}`] })
  try {
    const page = await browser.newPage()
    await page.setContent(pageHtml({ request, selinux, courses, ...opt }), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await sleep(250)

    const overflow = await page.evaluate(() => {
      const bad = []
      for (const sel of ['.rows', '.uses', '.resp', '.card', '.left', 'body']) {
        const el = document.querySelector(sel)
        if (el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
          bad.push(`${sel} ${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight}`)
        }
      }
      // any element whose edge runs past the viewport is clipped
      for (const el of document.querySelectorAll('.mode,.own,.nm,.cmd,.h,.badge,.stat,.stat2,.statsub,.hdr,.page,.usetitle,.usesub,.foot')) {
        const r = el.getBoundingClientRect()
        if (r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1) {
          bad.push(`clipped: "${el.textContent.trim().slice(0, 18)}" right=${Math.round(r.right)} bottom=${Math.round(r.bottom)}`)
        }
      }
      return bad
    })
    if (overflow.length) throw new Error(`layout overflows:\n  ${overflow.join('\n  ')}`)

    const out = isAbsolute(opt.out) ? opt.out : join(repoDir, opt.out)
    mkdirSync(dirname(out), { recursive: true })
    const big = join(tmpdir(), `thumb-film-${Date.now()}.png`)
    await page.screenshot({ path: big })
    await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', big, '-vf', 'scale=1280:720:flags=lanczos', out])
    rmSync(big, { force: true })
    console.log(`\n✅ ${out}  (${opt.theme}, ${opt.source}, ${opt.mark})`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => { console.error('\n✗', e.message); process.exit(1) })
