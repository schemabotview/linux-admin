#!/usr/bin/env node
// Combine every recorded section into the single YouTube film: one video, all 11 courses, both
// servers, no break in the middle.
//
// The segments under scripts/segments/ are all produced by one encoder path (same SPS/PPS, 30fps
// CFR, 90k timescale, AAC 44.1k mono), so the concat is a stream copy — no re-encode, no quality
// loss. Chapter offsets are accumulated from each segment's PROBED duration, never from wav
// arithmetic, so they cannot drift away from the film they index.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { loadRegistry } from './registry.mjs'

const run = promisify(execFile)
const repoDir = process.cwd()
const dataDir = join(repoDir, 'scripts')
const FFMPEG = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(existsSync) ?? 'ffmpeg'

// LINUX-COURSE-PLAN.md §"Packaging for YouTube" fixes this title. Change the plan first.
const TITLE = 'Linux administration: full course, beginner to professional'
const pad2 = (n) => String(n).padStart(2, '0')
const stamp = (sec) => {
  const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return `${h}:${pad2(m)}:${pad2(s % 60)}`
}

async function probe(f) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v',
    '-show_entries', 'stream=duration', '-of', 'default=nw=1:nk=1', f])
  return parseFloat(stdout.trim())
}

const reg = await loadRegistry()
const courses = Object.values(reg.COURSES)
const outDir = join(dataDir, 'out')
mkdirSync(outDir, { recursive: true })

// Walk the syllabus in order, pairing each section with the segment the recorder named for it.
const items = []
for (const course of courses) {
  course.sections.forEach((section, i) => {
    const seg = join(dataDir, 'segments', course.id, `${pad2(i + 1)}-${section.id}.mp4`)
    if (!existsSync(seg)) throw new Error(`missing segment: ${seg} — record ${course.id} first`)
    items.push({ course, section, seg, first: i === 0 })
  })
}

console.log(`Film: ${items.length} sections across ${courses.length} courses`)

let t = 0
const chapters = []
for (const it of items) {
  chapters.push({
    start: t,
    title: it.first ? `▸ ${it.course.title} — ${it.section.title}` : it.section.title,
  })
  t += await probe(it.seg)
}

const out = join(outDir, 'film.mp4')
const raw = join(dataDir, '.tmp', 'film-raw.mp4')

// Chapters and the blurb are cheap (67 ffprobes); the encode is not. `--desc-only` rewrites
// film.txt against the film already on disk, so editing a line of copy costs seconds.
const descOnly = process.argv.includes('--desc-only')
if (descOnly && !existsSync(out)) throw new Error(`--desc-only needs an existing ${out} — run without it first`)

if (!descOnly) {
  const listFile = join(dataDir, '.tmp', 'film-concat.txt')
  mkdirSync(join(dataDir, '.tmp'), { recursive: true })
  writeFileSync(listFile, items.map((i) => `file '${i.seg.replace(/'/g, "'\\''")}'`).join('\n') + '\n')
  console.log(`Merging → ${stamp(t)}`)
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c', 'copy', '-movflags', '+faststart', raw], { maxBuffer: 1 << 26 })

  // Chatterbox lands every wav close to one level, so nothing per-section is needed — but that
  // level is well under YouTube's -14 LUFS target (which only attenuates, never boosts) and the
  // wavs peak around 0 dBTP, which clips through AAC. One LINEAR pass fixes both: a constant gain,
  // so the narration's own dynamics are untouched. Two-pass, since single-pass loudnorm is dynamic.
  console.log('Measuring loudness …')
  const { stderr: m } = await run(FFMPEG, ['-i', raw, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
    '-f', 'null', '-'], { maxBuffer: 1 << 26 })
  const meas = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1))
  console.log(`  in ${meas.input_i} LUFS, tp ${meas.input_tp} dBTP → -14 LUFS, tp -1 dBTP`)
  const norm = `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}`
    + `:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true`
  console.log('Normalising audio (video copied) …')
  await run(FFMPEG, ['-y', '-i', raw, '-c:v', 'copy', '-af', norm,
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '1',
    '-movflags', '+faststart', out], { maxBuffer: 1 << 26 })
}

const desc = [
  TITLE, '',
  `${items.length} sections, ${courses.length} courses, ${stamp(t)}. Every command is really run on a`,
  'real virtual machine — Debian 13 for courses 1–10, Rocky 10.2 for course 11 — so every prompt,',
  'every output and every error you see is real. Nothing is typed by hand.', '',
  '⏱ CHAPTERS',
  ...chapters.map((c) => `${stamp(c.start)} ${c.title}`), '',
  // The cover carries Tux, and the condition usually quoted with Larry Ewing's image asks that he
  // and the GIMP be acknowledged. The cover has nowhere to put that; this is the place for it.
  // See output/thumbnails/README.md — the trademark question is still open.
  'Cover art: Tux, the Linux mascot, created by Larry Ewing with The GIMP.',
].join('\n') + '\n'
writeFileSync(join(outDir, 'film.txt'), desc)

const real = await probe(out)
console.log(`\n✅ scripts/out/film.mp4  ${stamp(real)}`)
console.log(`✅ scripts/out/film.txt  ${chapters.length} chapters`)
if (Math.abs(real - t) > 0.5) console.warn(`⚠ film ${real.toFixed(2)}s vs chapters ${t.toFixed(2)}s`)
