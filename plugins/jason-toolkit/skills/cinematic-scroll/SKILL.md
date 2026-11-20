---
name: cinematic-scroll
description: "Build scroll-driven cinematic websites — the award-site genre (Awwwards winners, igloo.inc, Apple product pages, brand launch microsites). Covers technique selection (DOM vs canvas image sequence vs WebGL), scene choreography, pinned sections, multi-layer parallax, scroll-drawn SVG, designed preloaders, performance budgets, and reduced-motion fallbacks. Use this skill whenever someone wants a site that \"shows off\" or feels immersive, asks for heavy scroll animation, parallax, a scrollytelling narrative, an animated or 3D product hero, or points at a reference site with elaborate scroll effects and says \"like this\". Also use when a marketing site, portfolio, or launch page needs to read as a portfolio piece rather than a template, or when someone is about to reach for Three.js and may not need it. Not for ordinary app UI, dashboards, or CRUD screens."
---

Read [host execution guidance](references/host-runtime.md) before running this workflow.

# Cinematic scroll

Sites in this genre look like they share a technology. They don't.

Three measured examples, all read as siblings, all built completely differently:

| Site | Technique | Payload | Page length |
| --- | --- | --- | --- |
| igloo.inc | Three.js/WebGL — Draco geometry, KTX2 textures, baked scroll data texture | 13.5 MB / 82 requests | Short, camera-path driven |
| history-of-animation | Pure DOM. No canvas, no GSAP, no WebGL | Tiny | 32 screens |
| msport-raptor | Canvas image-sequence scrubbing — 230 frames across 9 "shots" | ~250 requests | 20 screens |

One of them wins on nothing but stacked `<div>`s and art direction.

So the genre is not a stack. It is a set of structural decisions, and the technology is chosen last and as cheaply as possible. Everything below is organized around that.

Read `references/case-studies.md` for what each of those sites actually does, measured rather than assumed. It's the fastest way to calibrate.

## The six things that actually create the feeling

These are what the three sites share. If a build has these, it reads as authored. If it misses them, no amount of GSAP rescues it.

**1. Scroll is a camera, not a scrollbar.**
Downward motion moves the viewer *through* something — a space, a timeline, a story. It does not reveal a document. `msport-raptor` names its asset folders `shot1/`, `shot2/`. That's the right instinct: think in shots, cuts, and camera moves. Before writing code, write a shot list.

**2. One controlling idea, developed the whole way down.**
igloo is a journey through an ice world. history-of-animation is a walk through eras. msport is a rally route drawing itself. Every effect serves that one idea.

The failure mode is a pile of unrelated effects — a parallax here, a counter there, a marquee because marquees are around. That reads as a template even when each individual piece is well made. One idea developed across eight scenes beats eight ideas.

**3. A through-line device.**
A single visual element that persists across scenes and gives continuity: a line that draws itself, an object that stays on screen and transforms, a color that migrates, a number that climbs. `msport-raptor` draws a winding rally route in SVG the whole way down the intro.

This is the cheapest high-impact device in the genre and the most commonly skipped. It's what makes scenes feel like one film rather than a playlist.

**4. The load is part of the show.**
igloo preloads for 25–40 seconds behind a designed ASCII progress bar. msport counts to 100% in a technical face, then presents an explicit "LAUNCH EXPERIENCE" gate before anything scrolls.

Neither apologizes. A designed preloader converts dead time into a title sequence and buys the budget for everything after it. The gate earns its place for real reasons: assets are guaranteed ready before the cinematic starts, and it provides the user gesture browsers require for audio.

Only spend this, though, when there's a genuine payload to wait for. A preloader in front of a 400 KB page is a costume.

**5. Committed art direction, at full bleed.**
Real typefaces with character. Content that fills the frame. Deep blacks or fully committed color fields — `history-of-animation` swaps its entire palette between eras, and that alone does more work than any animation on the page.

Almost nothing here is a technical achievement. It's the willingness to let one image own the whole viewport with no chrome floating over it.

**6. Length is a deliberate choice, and it needs an escape hatch.**
These pages are 20–32 screens. They earn it because every screen is a distinct scene rather than more scrolling text.

But confidence without an exit is arrogance. `msport-raptor` keeps a persistent SKIP control on its intro. Anyone who doesn't want the film gets to leave immediately.

## Choose the cheapest tier that achieves the shot

Most of the wasted effort in this genre comes from reaching for real-time 3D when a tier below would have looked identical and cost a tenth as much.

Work up this ladder, and go up a rung only when the rung below genuinely cannot produce the shot.

### Tier 1 — DOM and CSS

Pinned scenes, multi-layer parallax, masked text reveals, per-scene color fields, sticky handoffs, horizontal-inside-vertical scroll, scroll-drawn SVG.

`history-of-animation` is 32 screens of nothing but this and it holds up next to the WebGL sites. **Always start here.** Most briefs never need to leave.

### Tier 2 — Canvas image sequence

Pre-render frames offline (Blender, Cinema 4D, After Effects, or a real camera on a turntable), then scrub them onto a `<canvas>` as scroll progresses. This is how Apple product pages work, and how `msport-raptor` gets its car.

This tier is the sweet spot and it's the one people skip past:

- You get photoreal or full-3D-looking results with zero real-time 3D risk.
- It runs on any device. No GPU capability questions, no shader compilation stalls, no WebGL context loss.
- Every frame is art-directed exactly. What you rendered is what ships.
- The implementation is roughly a hundred lines.

Reach for it whenever the shot is a *fixed camera move over a fixed subject* — a product rotating, a machine exploding into parts, a camera pushing into something, a scene assembling. That covers the large majority of "we want a 3D hero" requests.

The old objection to this tier was production cost: it needed a 3D artist and a render farm. Generative video has largely removed that, which makes tier 2 available on almost any budget. The technique that makes it work is locking both ends — generate the first and last frame as stills you art-direct properly, then have a keyframe-capable model interpolate the camera move between them. See `references/ai-assets.md`.

`references/image-sequence.md` has the full production pipeline and implementation.

### Tier 3 — Real-time WebGL

Three.js, custom shaders, Draco-compressed geometry, KTX2/Basis textures. This is igloo.inc: 13.5 MB and a long preload.

Justified only when you need something a pre-rendered sequence fundamentally cannot do:

- Real-time response to input — materials that react to the pointer, physics, particles the user disturbs.
- A camera path the *user* controls freely rather than one you authored.
- Content that varies per visitor and can't be pre-rendered.

If the brief is a fixed camera move over fixed content, tier 3 is buying a film crew to shoot a photograph. `references/webgl.md` covers the asset pipeline and budget if you genuinely land here.

## Build order

Sequencing matters more than usual here, because motion added to weak structure just makes weak structure move.

**1. Write the shot list before any code.**
Number the scenes. For each: what the viewer sees, what moves, what they should feel, and what the copy says. Ten lines of plain text. This is where the controlling idea and the through-line get decided, and it's far cheaper to fix here than in code.

If generative image tools are available, generate one frame per candidate scene while writing this. Ten images make the pacing conversation concrete far earlier than words do, and it costs almost nothing to explore ten directions before committing to one.

**2. Build the entire page static and unanimated, with real content.**
No motion at all. Real copy, real images, real type, final colors.

This step is the one people skip and it's the one that decides the outcome. If the static page isn't already good, motion won't save it — it'll just be a bad page that moves. If the static page *is* good, you've also built your reduced-motion experience for free, and it's a real design rather than a broken fallback.

**3. Establish scene structure.**
Full-height sections, scroll distances, pin durations. Verify the pacing by scrolling through it with no animation attached yet — just blocks moving past. Pacing problems are obvious here and invisible later.

**4. Add the through-line device.**
Before per-scene effects. It's the spine, and later choreography should hang off it rather than compete with it.

**5. Add per-scene motion, one scene at a time.**
Finish each scene before starting the next. Choreography done in a pass across all scenes tends toward uniformity, which is exactly the template smell.

**6. Design the load sequence last.**
You can't design a preloader before you know what you're preloading or how long it takes. Measure first, then decide whether it needs a designed loader, a gate, both, or neither.

**7. Then the three passes that separate shipped from finished:** reduced-motion, mobile, performance. `references/performance.md` covers all three. Do not treat these as cleanup — budget real time for them.

## Non-negotiables

Every one of these is a thing that looks fine on the developer's machine and fails in the world.

**Content lives in the DOM.** Text is real text — never baked into canvas or images. If it's on canvas, it doesn't exist to search engines, screen readers, translation, or find-in-page. Canvas is for the picture; the words go in the markup on top of it.

**The headline is readable at first paint** and is the LCP element. It must not sit inside the canvas or wait behind a load sequence. Someone who doesn't care about the film still needs to learn what this is.

**`prefers-reduced-motion` gets a designed experience, not a disabled one.** Pins release, parallax flattens, sequences show a chosen hero frame, reveals become instant. Build it from the static page in step 2 and check it by actually enabling the setting. It should look deliberate enough to ship on its own.

**Reveals never gate content on an event that might not fire.** Animate from a visible resting state, or ensure the final state is what you get without JavaScript. A scroll handler that doesn't run must never leave the page blank.

**Animate `transform` and `opacity` only.** Anything touching layout — `top`, `left`, `width`, `height`, `margin` — drops frames on the devices that matter.

**Browser controls keep working.** Back button, deep links, refresh mid-page, keyboard navigation, tab order through pinned sections. Cinematic is not an excuse for breaking the browser.

**Mobile gets its own motion design.** Not the desktop choreography scaled down. Some pinned scenes should become well-composed static sections on a narrow viewport — decide that per scene deliberately.

**Fast scrolling reaches the bottom fast.** Never require slow scrolling to progress. Scroll distance should map to content, not to how long you want someone to look at your animation.

**There is always a way out.** Skip control on any intro over a few seconds, and don't replay it at full length on every visit within a session.

## Anti-patterns — the tells of a template

If a site has these, people who look at a lot of sites will clock it instantly:

- **Uniform fade-up on every element.** The single strongest signal of applied-rather-than-authored motion. Vary it, or cut most of it.
- **Animations that fire on elements already in view at load**, so the first screen visibly assembles itself for no reason.
- **Smooth scroll that lags.** Badly tuned inertia feels like a broken page, which is the exact opposite of the intended impression. If it can't be made to feel excellent, ship native scrolling — that's a legitimate outcome, not a failure.
- **Counters that count** because counters are a thing, attached to numbers nobody asked about.
- **Parallax strong enough to induce motion sickness.** Depth should register as dimensionality, not as an effect you can name.
- **Real-time 3D that could have been an image sequence** — a fixed camera move rendered live at 10× the cost and a fraction of the reliability.
- **A pinned section with no clear exit**, where the viewer can't tell whether scrolling still works.
- **Every scene using a different technique**, which reads as a demo reel rather than a site.
- **A preloader in front of a page that loads instantly.**

## Working with someone else's reference site

When you're handed "make it like this," go look — don't work from the screenshot or from memory. In a browser session, the useful reads take about a minute:

- `performance.getEntriesByType('resource')` grouped by extension and size. This identifies the tier immediately: numbered PNG/WebP sequences mean tier 2; `.drc`, `.ktx2`, `.glb` plus a basis or draco `.wasm` means tier 3; neither means tier 1.
- `document.body.scrollHeight / innerHeight` for how many screens the narrative runs.
- Count `<canvas>` elements — several usually means several scrubbed sequences, one per scene.
- Check `window.gsap`, `window.THREE`, `window.Lenis`. Often absent because everything is bundled, which is itself informative.
- Then scroll it slowly and write down the shot list.

Separate what you're borrowing. Usually it's the *structure* — pacing, scene count, the through-line device — not the visual style, and definitely not the tier. Say which explicitly, so nobody assumes a 13 MB WebGL build got quoted.

## Stack

Nothing here is mandatory; these are the defaults that hold up.

- **GSAP + ScrollTrigger** for scroll choreography — pinning, scrubbing, timelines. The most capable option and the one with the fewest surprises around pinning. Verify its current commercial license terms before committing on a client project.
- **Lenis** for smooth scroll, if smooth scroll is wanted at all. Tune it or drop it.
- **Native CSS scroll-driven animations** where they're sufficient — no library cost, but check support against the audience.
- **Motion** for component and route transitions in React, if it's earning its place. Don't ship two animation libraries doing one job.
- **Canvas 2D** for image sequences. No library needed.
- **Three.js** only at tier 3.

`references/techniques.md` has implementation recipes for each of the tier-1 devices, plus the scroll-drawn SVG and scene color transitions.

## Reference files

- `references/case-studies.md` — the three sites, measured. Read this first to calibrate.
- `references/techniques.md` — tier 1 recipes: pinning, parallax, masked text reveals, scroll-drawn SVG, scene color transitions, horizontal-in-vertical, smooth scroll setup.
- `references/image-sequence.md` — tier 2 in full: rendering, encoding, frame counts, preloading, canvas scrubbing, mobile strategy.
- `references/webgl.md` — tier 3: when it's genuinely warranted, Draco/KTX2 pipeline, budget and risk.
- `references/ai-assets.md` — generative images and video in this pipeline: what they're right and wrong for, the locked-endpoint frame-sequence workflow, and compositing real text over generated plates.
- `references/performance.md` — budgets, profiling, the reduced-motion pass, the mobile pass, accessibility.
