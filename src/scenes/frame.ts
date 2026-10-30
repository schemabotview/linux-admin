import type { Code, Group, SceneModel, SceneNode, Tty } from '@graphlearning/graphl-flow'

// The CONSOLE FRAME — graphl-flow's `console-frame` study, unchanged: a real console on the left, the
// picture of what it just showed on the right. Both columns are FIXED (`w`/`h`), so every console
// frame lands on the same fit and a viewer always finds the console in the same place (check-render
// asserts it). No edges between the columns: `highlight` and `focus` point at console rows instead.
//
// The console holds 43 rows of 80 columns — the capture pty's size (lab/capture.py): 43 × 24px + 51
// (bar, padding, borders) ≈ 1083, so H 1090; 80 × 9.0px + 30 padding + 2 borders = 752, so W 760.
// The picture takes the rest of a 16:9 frame.
export const CONSOLE = { w: 760, h: 1090, rows: 43, cols: 80 }
export const PICTURE_W = Math.round((CONSOLE.h * 16) / 9) - CONSOLE.w - 10

/** The console: a real transcript (spine/<course>/<NN>/session.txt), drawn row for row. */
export const consoleNode = (title: string, session: string, rest: Partial<Code> = {}): Code => ({
  type: 'code', id: 'console', console: true, filename: title, code: session.replace(/\n+$/, ''), w: CONSOLE.w, h: CONSOLE.h, fill: true, ...rest,
})


/** A grab as lab/capture.py writes it: runs are [row, from, to] triples (JSON types them number[][]). */
export type Grab = { screen: string[]; inverse: number[][]; bold: number[][] }
const runs = (r: number[][]) => r.map(([row, from, to]) => [row, from, to] as [number, number, number])
/** A full-screen program's screen (tty/<name>.json), in the console's slot at the console's size. */
export const ttyNode = (title: string, grab: Grab): Tty => ({
  type: 'tty', id: 'console', title, w: CONSOLE.w, h: CONSOLE.h, fill: true, screen: grab.screen, inverse: runs(grab.inverse), bold: runs(grab.bold),
})

const picture = (children: SceneNode[]): Group => ({ type: 'group', id: 'picture', bare: true, w: PICTURE_W, h: CONSOLE.h, children })

export const consoleFrame = (left: Code | Tty, right: SceneNode[], edges: SceneModel['edges'] = []): SceneModel => ({
  dir: 'row', nodes: [left, picture(right)], edges,
})

/** Is this scene a console frame? (check-content and check-render hold every one to the template.) */
export const isConsoleFrame = (scene: SceneModel) =>
  scene.nodes.length === 2 && scene.nodes[0].id === 'console' && scene.nodes[1].id === 'picture'
