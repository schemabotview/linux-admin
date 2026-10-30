// Reading the spine. A scene never TYPES a value the VM printed: it finds the row (`rowOf`) or reads
// the value (`read`) from the transcript, so a replay that changes the output changes the picture —
// or fails loudly here, at build time, instead of drawing a stale number.

/** The 1-based console row that contains `needle` (the first, or the `nth`). Throws if absent. */
export function rowOf(session: string, needle: string, nth = 1): number {
  const rows = session.split('\n')
  let seen = 0
  for (let i = 0; i < rows.length; i++)
    if (rows[i].includes(needle) && ++seen === nth) return i + 1
  throw new Error(`the transcript has no row containing ${JSON.stringify(needle)}`)
}

/** The first capture group of `pattern` in the transcript. Throws if it does not match. */
export function read(session: string, pattern: RegExp): string {
  const m = session.match(pattern)
  if (!m) throw new Error(`the transcript does not match ${pattern}`)
  return m[1]
}

/** The output of one command: the rows after the prompt row(s) that end with `command`, up to the next
 *  prompt. A command row exactly 80 wide WRAPPED (graphl-flow's console rule), so it is joined with the
 *  rows that continue it before comparing. `nth` picks among repeated runs (1 first, -1 last). */
export function outputOf(session: string, command: string, nth = 1): string {
  const rows = session.split('\n')
  const prompt = /^\S+@\S+:.*?[$#]( |$)/
  const found: string[] = []
  for (let i = 0; i < rows.length; i++) {
    if (!prompt.test(rows[i])) continue
    let line = rows[i], j = i
    while (rows[j].length === 80 && j + 1 < rows.length) line += rows[++j]
    // the command EXACTLY, right after the prompt: `bash -c '…'` must not match `X=1 bash -c '…'`
    if (!line.endsWith(`$ ${command}`) && !line.endsWith(`# ${command}`)) continue
    const end = rows.findIndex((r, k) => k > j && prompt.test(r))
    found.push(rows.slice(j + 1, end < 0 ? undefined : end).join('\n'))
  }
  // nth: 1 = the first run of the command, -1 = the last (a command run twice is two outputs)
  const out = nth < 0 ? found[found.length + nth] : found[nth - 1]
  if (out === undefined) throw new Error(`the transcript never runs ${JSON.stringify(command)}${nth !== 1 ? ` (occurrence ${nth})` : ''}`)
  return out
}
