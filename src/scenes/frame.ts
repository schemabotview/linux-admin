import type { Code, Group, SceneModel, SceneNode, Tty } from '@graphlearning/graphl-flow'

// The CONSOLE FRAME — graphl-flow 0.10's `console-frame` study: a real console on the left, the
// picture of what it just showed on the right, on the ONE grid every GraphL frame shares (IDE,
// notebook and console: FULL_W × FRAME_H at a 1% margin). At 4K that grid zooms ≈ 2.8, so console
// text reads ≈ 42px — the old 1930×1090 frame zoomed ≈ 1.9 and drew it at ≈ 28px, with a console
// 43 rows tall however short its transcript.
//
// Both columns are FIXED (`w`/`h`), so every console frame lands on the same fit and a viewer always
// finds the console in the same place (check-render asserts it). No edges between the columns:
// `highlight` and `focus` point at console rows instead.
//
// The console keeps 80 columns — the capture pty's width (lab/capture.py): 80 × 9.0px + 30 padding
// + 2 borders = 752, so W 760. The full height holds (756 − 51 bar, padding, borders) / 24 = 29
// rows; a longer transcript is windowed with `show` (folds count one row each), never edited.
export const GAP = 10
export const FULL_W = 1344
export const FRAME_H = Math.round(FULL_W / (16 / 9))
export const CONSOLE = { w: 760, h: FRAME_H, rows: Math.floor((FRAME_H - 51) / 24), cols: 80 }
export const PICTURE_W = FULL_W - CONSOLE.w - GAP

/** The console: a real transcript (spine/<course>/<NN>/session.txt), drawn row for row. */
export const consoleNode = (title: string, session: string, rest: Partial<Code> = {}): Code => ({
  type: 'code', id: 'console', console: true, filename: title, code: session.replace(/\n+$/, ''), w: CONSOLE.w, h: CONSOLE.h, fill: true, ...rest,
})

/** A grab as lab/capture.py writes it: runs are [row, from, to] triples (JSON types them number[][]). */
export type Grab = { screen: string[]; inverse: number[][]; bold: number[][] }
const runs = (r: number[][]) => r.map(([row, from, to]) => [row, from, to] as [number, number, number])
/**
 * A full-screen program's screen (tty/<name>.json), in the console's slot at the console's size.
 * The grab is the 43-row pty's; the console holds CONSOLE.rows. `man`, `less`, `top`, `vim` and
 * `nano` fill the screen from the top and pin their chrome (a status line, nano's two help rows) to
 * the bottom, so the grab's first rows plus its last `foot` rows are exactly what a terminal
 * CONSOLE.rows tall would have drawn — a crop, not an edit. Runs on dropped rows go with them.
 */
export const ttyNode = (title: string, grab: Grab, foot = 1): Tty => {
  const n = grab.screen.length, top = CONSOLE.rows - foot
  const keep = (row: number) => row < top || row >= n - foot
  const at = (row: number) => (row < top ? row : row - (n - CONSOLE.rows))
  const crop = (r: number[][]) => runs(r).filter(([row]) => keep(row)).map(([row, a, b]) => [at(row), a, b] as [number, number, number])
  return {
    type: 'tty', id: 'console', title, w: CONSOLE.w, h: CONSOLE.h, fill: true,
    screen: grab.screen.filter((_, row) => keep(row)), inverse: crop(grab.inverse), bold: crop(grab.bold),
  }
}

// The picture's parts in ONE group, centred in the column by `spread` (with a single child,
// space-evenly is centring): the space goes above and below the whole picture, never between its parts.
//
// The STRICT picture rule (python-expense-tracker's frame v2 side pane): at most TWO parts, and with
// two, one is a diagram (a group or a plot) and the other at most one table. A lone table may be the
// picture; two tables, or a table and a note, may not. A picture that needs more is two sections, or
// a full (◆) scene. check-content counts it.
const picture = (children: SceneNode[]): Group => ({ type: 'group', id: 'picture', bare: true, spread: true, w: PICTURE_W, h: CONSOLE.h,
  children: [{ type: 'group', id: 'content', bare: true, children }] })

export const consoleFrame = (left: Code | Tty, right: SceneNode[], edges: SceneModel['edges'] = []): SceneModel => ({
  dir: 'row', padding: 0.01, nodes: [left, picture(right)], edges,
})

/** Is this scene a console frame? (check-content and check-render hold every one to the template.) */
export const isConsoleFrame = (scene: SceneModel) =>
  scene.nodes.length === 2 && scene.nodes[0].id === 'console' && scene.nodes[1].id === 'picture'
