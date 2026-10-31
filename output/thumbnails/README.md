# Thumbnails

`film.png` — the thumbnail for the single full-course video (`scripts/out/film.mp4`).
A copy of `film-dark.png`. Rebuild any variant with:

```sh
npm run thumb:film -- --theme dark --source courses --mark tux --out output/thumbnails/film-dark.png
```

Variants kept for comparison: `film-dark.png` (shipped), `film-navy.png`,
`film-light.png` (stands out in a dark feed, but Tux flattens to a silhouette there and the
card loses its contrast with the page), `film-request.png` and `film-selinux.png` (the other
sources, below), `film-glyph.png` (the permission-free mark, below).

## Which cover ships, and why

`--source courses --mark tux` ships: **breadth, with the mark carrying the topic.** It
advertises the ten courses by name to a viewer who reads past the first glance, and Tux says
"Linux" before a single word is read.

The runner-up is real, and the measurement behind it stands. Downscale every build to
**168px** — the width the YouTube mobile feed actually renders, and the only size that decides
a thumbnail — and this is what survives:

| build | what survives at 168px |
| --- | --- |
| `courses` + `tux` **(shipped)** | Tux, LEARN / LINUX, the badge, "What we'll build"; the nine rows become texture |
| `request` + `glyph` | `HTTP/1.1 200 OK` in green, large and legible — one focal object |
| `selinux` | `403` reads, but it is three characters; the rest is texture |

So `film-request.png` still has the stronger *single hook*, and it is the alternative to reach
for if the grid underperforms: it promises a server that answers, which is exactly what the
course delivers. The trade the shipped cover makes is breadth over one hook — the same trade
the sister python repo makes, and the reason Tux matters here: at 168px it does the topic work
that the `>_` glyph could not, which is what makes the breadth card viable at all.

## The three sources, all real

Nothing on any card is retyped. Each source either reads the scene registry or cuts lines
out of a spine `session.txt`, and **fails the render rather than inventing a fallback**.

`--source request` (default, shipped) cuts `spine/network/04-curl-the-site/session.txt`:
the real `curl -v http://sysops.example/`, the request line, the response headers nginx
sent, and the page itself. The render fails if that session stops containing
`< HTTP/1.1 200 OK`, `> GET / HTTP/1.1`, or the served `<h1>` — so the cover cannot outlive
the site answering.

Response headers longer than `MAX` are **omitted rather than truncated**, so nothing shown is
ever altered; `Date`, `ETag`, `Last-Modified`, `Connection` and `Accept-Ranges` are dropped as
noise. What is left — `Server: nginx`, `Content-Type`, `Content-Length` — is the course's own
output, in curl's own order.

`--source courses` renders the nine course chips out of the `web01` group in
`src/scenes/intro/index.ts`, read through the same `scripts/registry.mjs` the content checks
use. The cover shows **the course's list, not a retyped one**: edit the scene and the
thumbnail follows. If that scene ever stops having a group with id `web01`, the render fails.

`--source selinux` cuts `spine/rhel/05-the-403/session.txt`: the real 403, the `namei -l`
walk showing every classic permission saying yes, and `13: Permission denied` from nginx's
own error log. It asserts the code really is `403` and that the error line is really there.

## The icons are the app's

The course grid resolves each icon exactly the way the engine does. graphl-flow maps its
semantic names onto lucide components (`firewall` → `BrickWall`, `disk` → `HardDrive`,
`code` → `Code2`) and bundles brand marks as path data; `thumb-film.mjs` parses that map out
of the engine bundle and reads the geometry from `node_modules/lucide-react` (ISC), following
lucide's own alias re-exports (`filter.mjs` → `funnel.mjs`). So the cover's icons are the
scene's icons and cannot drift from them — and an icon the engine cannot resolve fails the
build rather than rendering an empty box.

## The colours are the engine's

The prompts, the `200 OK`, the served page and the `403` all take their colours from
`@graphlearning/graphl-flow`'s own tone palette — the same ones the scenes use — copied into
`TONE` in `scripts/thumb-film.mjs`: `store` `#37b877` for the command and the success,
`consume` `#f0656f` for the 403, `infra` `#f0902f` for the course icons. The amber accent is
this repo's own, from `scripts/concept.json`'s `panelBg` — not Python's yellow.

## The mark: Tux ships — read this first

`--mark tux` is the shipped build, by the owner's decision. It draws the Linux mark that
graphl-flow bundles, which the engine's own `icons.d.ts` documents as coming from
**simple-icons**. simple-icons releases its icon files under CC0 — but CC0 is a *copyright*
waiver, and a project mark is also a *trademark*, which CC0 cannot and does not grant.

So the licence question is **open, not settled**, and these two points are the ones to settle
before the video goes out — **neither was verified in this repo**:

- **"Linux" is a registered trademark of Linus Torvalds**, administered through a sublicensing
  programme (the Linux Mark Institute, under the Linux Foundation). Nominative use — accurately
  naming the operating system a course teaches — is the ordinary basis for using the word, and
  this cover's use is nominative. The *image* is a separate question from the *word*.
- **Tux is Larry Ewing's image**, and the condition usually quoted with it asks that he and
  the GIMP be acknowledged. `film.png` carries no such acknowledgement, because the cover has
  nowhere to put one — **the video description is the place for it**, and it is not there yet.

If the video is monetised, read the current LMI/Linux Foundation trademark policy and Ewing's
own statement before publishing. `film-glyph.png` is the same cover with the repo's own mark —
a shell prompt, the most recognisable thing on a Linux screen, owned by nobody — and it is kept
rendered and ready for exactly this reason: if the answer comes back no, or nobody wants to
spend the time asking, swap that file in and nothing else about the cover changes.

Note that the sister repos answer this differently and correctly so — the python repo vendors
the PSF logo with its ™ and a written NOTICE, the data-science repo carries the real pandas
logo because pandas publishes it under BSD-3-Clause, and the Spark repo carries no project
mark at all because the ASF permits one essentially only as a hyperlink. Copyright and
trademark are different questions and every project answers for itself; do not copy any of
these decisions across without reading that project's policy.

## The editorial lines

One string on each card is written rather than quoted — the footer:

| source | footer |
| --- | --- |
| `request` | `the site, served by nginx` |
| `courses` | `one server · ten courses · every output real` |
| `selinux` | `every rwx says yes — the kernel still says no` |

These are labels, not transcript quotes, and they are the only such strings on the covers.
Override one with `--foot`.

## Why not `npm run thumb` (the shell's `graphl-thumb`)

That template is a **per-course** poster: 58% of a scene plus a text panel. A scene is a
16:9 video frame, and cropped to 58% it turns to unreadable mush at the ~168px the mobile
feed renders — which is the only size that decides a thumbnail. `scripts/thumb-film.mjs`
uses poster grammar instead: few elements, enormous type, one focal object. The renderer
also asserts that no element overflows its box or runs past the viewport, so a clipped label
fails the build instead of shipping.
