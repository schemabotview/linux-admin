# CLAUDE.md — linux-admin

> Workspace invariants live in the workspace `CLAUDE.md`. This file is only what is true here.

A GraphL concept app: **Linux administration by running a web server.** The Sysops team serves
`sysops.example` from `web-01` (Debian 13, courses 1–10), then does the job again on `web-02` (Rocky
10.2, course 11). **`LINUX-COURSE-PLAN.md` is the source of truth**: change it first, never drift.

Engine `@graphlearning/graphl-flow` ^0.8.0, shell `@graphlearning/shell` ^1.0.4.

## Status

ALL ELEVEN COURSES AUTHORED, 67 sections (2026-10-30/31): spine captured on real VMs, scenes,
narration, checks green, every frame looked at.
1 `intro` 2, 2 `shell` 7, 3 `packages` 4, 4 `text` 7, 5 `users` 6, 6 `processes` 7, 7 `services` 7,
8 `network` 8, 9 `storage` 6, 10 `scripting` 6, 11 `rhel` 7 (on web-02, Rocky 10.2).
`packages` moved before `text` so nginx's access log exists for the text tools.

NARRATED AND RECORDED 2026-10-31: all 67 wavs in, every course captured at 3840×2160, and combined
into the single YouTube film (`npm run film` → 1:37:55, 67 chapters). Cover and descriptions built.
Awaiting the owner's review of the whole course.

## Every output is real

Consoles are captured by `lab/` from a real VM through an 80 × 43 pty (see `lab/README.md`), never
typed. Scenes read values from `session.txt` (`src/scenes/lab.ts`: `rowOf`, `read`, `outputOf`),
which THROW at build time if the transcript no longer says it. Narration quotes only what a
transcript shows; after a replay changes a value, grep the narration for it.

- **One VM at a time.** `ops` is a namespace on the lab host, not a VM.
- **Steps build on the previous step's snapshot** (`lab/replay.py`). `"branch": true` steps (ones
  that break the machine) are discarded. `spine/chain.lock` is committed; `npm run check:spine`
  fails when a step.json changed without a replay.
- **`volatile`** steps (dates, PIDs) are compared masked; scenes read such values, never type them.
- Full-screen programs (`man`, `less`, `top`) are `grab`s: the alternate screen never reaches the
  console transcript, as in a real terminal.

## Frames

The console frame (`src/scenes/frame.ts`, graphl-flow's `console-frame` study): fixed console |
fixed picture, one fit for every frame. No edges between the columns. The picture's parts sit in ONE
group centred in the column; check-render fails a picture under 45% of the column — fill it with real
material from the transcript, never with spacing between parts.
Full scenes (◆) are their own sections.

## Checks, before handing over

```sh
npx tsc --noEmit && npm run build && npm run check   # check-content + check-render (4K)
npm run check:spine
npm run shots -- <course>                            # then LOOK
```

## Publishing

```sh
npm run record:all          # caffeinate + 4K capture, one mp4 per course (2.4s loop method)
npm run film                # all 67 segments → scripts/out/film.mp4 + film.txt (chapters)
npm run film -- --desc-only # rewrite film.txt against the film on disk (seconds, no re-encode)
npm run gen:desc            # per-course YouTube descriptions → scripts/out/<course>.txt
npm run thumb:film          # the film cover → output/thumbnails/film.png
```

The film's title is fixed by `LINUX-COURSE-PLAN.md` §"Packaging for YouTube"; per-course publish
titles live in `scripts/titles.json`. The concat is a stream copy (one encoder path for every
segment), then ONE linear `loudnorm` pass to −14 LUFS / −1 dBTP — the wavs land ~−18.5 LUFS and peak
over 0 dBTP, which clips through AAC. Chapter offsets come from each segment's PROBED duration, never
from wav arithmetic. The cover reads the scene registry and the spine and FAILS rather than invent.
It ships with Tux, whose trademark question is OPEN — read `output/thumbnails/README.md` before
publishing, and keep the Ewing/GIMP credit that `film.txt` carries. `film-glyph.png` is the same
cover with the repo's own mark, rendered and ready if the answer is no.

## Invariants

- Never write `x`/`y`. Stylesheets: graphl-flow, shell, `./theme.css` last.
- No `file:` installs committed. `SiteHeader` on the catalog page only.
- Narration audio at `public/audio/<course>/<id>.wav`.
- `lab/keys/` are lab-only keys, committed deliberately (stable fingerprints). Never reuse them.
