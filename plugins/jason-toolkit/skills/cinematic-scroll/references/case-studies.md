# Three sites, measured

Numbers below came from loading each site and reading `performance.getEntriesByType('resource')`, DOM structure, and scroll height — not from write-ups. Where something couldn't be verified it says so.

The point of this file: these three read as the same genre and share almost no technology. Use it to calibrate what a given look actually costs.

---

## igloo.inc — tier 3, real-time WebGL

**What loads:** 82 requests, 13.5 MB.

| Asset type | Count | Size |
| --- | --- | --- |
| `.ktx2` textures | 49 | 12.7 MB |
| `.drc` geometry | 22 | 0.6 MB |
| `.wasm` decoders | 2 | 0.32 MB |
| JavaScript | 7 | 0.49 MB |

**What that tells you.** `.drc` is Draco-compressed mesh data; `.ktx2` is GPU-compressed texture (Basis Universal), transcoded in the browser by `basis_transcoder.wasm`. This is the full production 3D pipeline — the same asset discipline a game would use. Textures are 94% of the payload, which is typical and is where optimization effort belongs.

Asset names describe the scene directly: `igloo_color`, `igloo_exploded_color`, `mountain_color`, `ground_color`, `cube1/2/3_normal`, `shattered_ring_color`. So the narrative is a journey through an ice environment where objects explode and shatter as you move.

**The interesting one:** `scroll-datatexture.ktx2`, at 1.23 MB the single largest asset. Animation or camera-path data baked into a texture and sampled by scroll progress on the GPU. That's a high-end technique — it means the scene's choreography was authored in 3D software and exported, rather than written as code.

**Load behaviour:** 25–40 seconds on a normal connection, behind a minimal ASCII-style progress bar. The 3D code is a separate chunk (`App3D-*.js`), so it's lazy-loaded rather than blocking first paint.

**Note:** the scene never rendered in a browser without GPU acceleration. Worth remembering — tier 3 has a hard hardware dependency that tiers 1 and 2 don't.

**Takeaway:** this is what full real-time 3D costs. Justified here because the site *is* the experience — there's no other content competing for the budget. On a site that also has to explain a service and convert a lead, this budget is very hard to defend.

---

## history-of-animation.webflow.io — tier 1, DOM only

**What loads:** 34 requests, negligible payload. jQuery, `webflow.js`, a webfont loader, 37 images.

**No GSAP. No canvas. No WebGL. No video.** One sticky element on the whole page.

**Scroll length:** 41,735px — **31.7 screens**.

**Type:** Cardo (serif display) and Open Sans (body). A conventional editorial pairing, used well.

**How it works.** Full-viewport artwork panels stacked vertically. Captions — year, title, one or two sentences — fade in over the artwork as each panel settles. The background colour changes per panel, so moving down the page feels like moving between eras. Chapter title cards break the sequence into named sections, and the entire palette inverts between chapters (the Silent Era is black; the Golden Age is white).

That's the whole mechanism. Scroll-linked opacity, per-section colour, and full-bleed images.

**Takeaway: this is the most important of the three.** It sits comfortably alongside WebGL sites while being, technically, stacked divs. What carries it is editorial structure, curation, committed full-bleed art direction, and the confidence to run 32 screens long.

Before quoting anything more expensive, ask whether tier 1 executed this well would actually fall short.

---

## msport-raptor.com — tier 2, canvas image sequence

**What loads:** ~250 requests. **230 PNGs**, 9 `<canvas>` elements, 5 woff2 fonts, 4 jpgs.

**Scroll length:** 26,648px — **20.2 screens**.

**Asset paths:** `shot1/0.png`, `shot1/1.png`, … alongside `partners/logo-*.png`. Numbered frames in folders named for camera shots. Nine canvases, one per scrubbed sequence.

**Type:** Aeonik (grotesk), Monda, Orbitron Light (the technical numerals).

**The opening, in order:**

1. **Preloader** — a large percentage counter in Orbitron, drawn as two stacked copies of the number with the bright one clipped to the loading progress, so the figure fills from the bottom as assets arrive. Counts to 100%.
2. **A gate** — "LAUNCH EXPERIENCE" with a red accent. Scroll is locked until clicked. This guarantees assets are ready before the cinematic begins and provides the user gesture browsers require for audio.
3. **An intro sequence** — a winding line drawing itself in SVG from the bottom of a black screen as you scroll: the rally route. A persistent **SKIP** control sits bottom-right throughout.
4. Then the scrubbed shots take over.

**Takeaway:** this is the sweet spot of the ladder. It looks like a 3D product site and contains no real-time 3D. Every frame is art-directed exactly, it runs anywhere, and the implementation is about a hundred lines. Whenever a brief asks for a "3D hero" that's really a fixed camera move over a fixed subject, this is the answer.

Also note how much of the impact comes from things that aren't the 3D at all: a beautiful loading number, an explicit threshold, a line that draws itself, and an escape hatch. Those are all tier 1 and cost almost nothing.

---

## What the three actually share

Nothing technical. What they have in common:

- Scroll used as camera movement through a designed space or time.
- One controlling idea developed the whole way down.
- A through-line device that persists across scenes.
- Loading treated as part of the experience.
- Committed full-bleed art direction and real typefaces.
- Deliberate length — 20 to 32 screens — with every screen a distinct scene.

Two of the three have an explicit escape hatch (msport's SKIP; history-of-animation's ordinary scrolling). igloo, the most expensive, has the least forgiving entry — a 40-second wait with a hardware requirement. Note which of the three most people would actually want to ship.
