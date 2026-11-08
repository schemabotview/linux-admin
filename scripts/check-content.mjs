// Content guard — silent failures that build green and break only on screen or in the recording.
// It reads the REAL registries (scripts/registry.mjs bundles src/content and src/scenes):
//
//   1. A section is scene-only and narrated, and its scene exists.
//   2. Node ids are unique within a scene (graphl-flow resolves edges and focus by id).
//   3. A console frame draws edges only INSIDE its picture: an edge between the columns widens the
//      gap it crosses and moves both off the shared template.
//   4. A console holds what the pty drew: at most CONSOLE.rows DRAWN rows (`show` folds count one) of at most CONSOLE.cols columns
//      (a wider row would mean the transcript was edited, not captured).
//   5. A console frame's picture follows the STRICT rule (frame.ts): at most two parts, and with two,
//      one of them is a diagram (a group or a plot) — never two tables, never a table and a note.
//   6. Once a course has narration audio, every section of it has its wav.
//
// Run: npm run check
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { isConsoleFrame, loadRegistry, nodesOf } from './registry.mjs'

const { COURSES, SCENES, FRAME } = await loadRegistry()
const problems = []

for (const course of Object.values(COURSES))
  for (const section of course.sections) {
    const at = `${course.id}-${section.id}`
    if ('slide' in section) problems.push(`${at}  has a slide — sections in this repo are scene-only`)
    if (!section.narration?.trim()) problems.push(`${at}  has no narration`)
    if (!SCENES[section.scene]) problems.push(`${at}  scene '${section.scene}' is not registered`)
  }

for (const [id, scene] of Object.entries(SCENES)) {
  const all = nodesOf(scene)
  const seen = new Set()
  for (const { node } of all) {
    if (seen.has(node.id)) problems.push(`scene ${id}  node id '${node.id}' is used twice`)
    seen.add(node.id)
  }
  for (const { node } of all) {
    const rows = node.type === 'tty' ? node.screen : node.type === 'code' && node.console ? node.code.split('\n') : null
    if (!rows) continue
    // Rows as graphl-flow DRAWS them: with `show`, the kept rows plus one fold row per skipped run.
    // A long real output (an apt install) is folded for display, never edited.
    const keep = node.show && new Set(node.show.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)))
    const drawn = keep ? rows.filter((_, i) => keep.has(i + 1) || i === 0 || keep.has(i)).length : rows.length // a skipped row counts once per run: when the row before it was kept (or it is first)
    if (node.id === 'console' && drawn > FRAME.CONSOLE.rows) problems.push(`scene ${id}  the console draws ${drawn} rows; the pty had ${FRAME.CONSOLE.rows} — fold with show`)
    const wide = rows.find((r) => r.length > FRAME.CONSOLE.cols)
    if (wide) problems.push(`scene ${id}  '${node.id}' has a ${wide.length}-column row; the pty was ${FRAME.CONSOLE.cols} wide — "${wide.slice(0, 40)}…"`)
  }
  if (!isConsoleFrame(scene)) continue
  const parts = scene.nodes[1].children[0].children
  const diagram = (n) => n.type === 'group' || n.type === 'plot'
  if (parts.length > 2) problems.push(`scene ${id}  the picture has ${parts.length} parts (${parts.map((n) => n.type).join(', ')}) — one diagram and at most one table; split the section`)
  else if (parts.length === 2 && !parts.some(diagram)) problems.push(`scene ${id}  the picture is ${parts.map((n) => n.type).join(' + ')} — with two parts, one is a diagram (group or plot)`)
  const top = new Map(all.map(({ node, top }) => [node.id, top]))
  for (const e of scene.edges ?? [])
    for (const end of [e.from, e.to])
      if (top.get(end.split('.')[0]) !== 'picture') problems.push(`scene ${id}  edge ${e.from} → ${e.to}: '${end}' is outside the picture — console-frame edges stay inside it`)
}

const audio = 'public/audio'
for (const course of Object.values(COURSES)) {
  const dir = join(audio, course.id)
  if (!existsSync(dir) || !statSync(dir).isDirectory() || !readdirSync(dir).some((f) => f.endsWith('.wav'))) continue
  for (const section of course.sections) {
    const wav = join(dir, `${section.id}.wav`)
    if (!existsSync(wav)) problems.push(`${course.id}-${section.id}  no narration wav at ${wav} — the section plays silence`)
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} content problem(s):\n` + problems.map((p) => '  ' + p).join('\n'))
  process.exit(1)
}
const sections = Object.values(COURSES).reduce((n, c) => n + c.sections.length, 0)
console.log(`✓ content OK — ${sections} section(s), ${Object.keys(SCENES).length} scene(s)`)
