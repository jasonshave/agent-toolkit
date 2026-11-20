# The three finishing passes

Reduced motion, mobile, and performance. These are not cleanup — they're where a build either becomes shippable or stays a demo. Budget real time for them.

---

## Pass 1 — reduced motion

`prefers-reduced-motion: reduce` is set by people who get motion sickness or vestibular symptoms from exactly the effects this genre is built on. Parallax and scroll-jacking are among the worst offenders. This is not a nice-to-have.

**The standard to hold:** the reduced-motion version should look deliberate enough that you'd consider shipping it as the default. If it looks like the site with the fun removed, it isn't finished.

This is nearly free if you followed the build order — the static page from step 2 *is* the reduced-motion experience.

What each device becomes:

| Device | Reduced-motion form |
| --- | --- |
| Pinned scene | Normal stacked sections, all content visible |
| Parallax | Flat; layers composited at rest |
| Masked text reveal | Final state, no animation |
| Image sequence | One chosen hero frame, sequence never preloaded |
| Scroll-drawn SVG | Path rendered complete |
| Scene colour transitions | Discrete per section, no interpolation |
| Smooth scroll | Native scrolling; destroy the smooth-scroll instance |
| Intro sequence | Skipped entirely, straight to the page |

```js
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

function build() {
  if (reduced.matches) { buildStatic(); return }
  buildAnimated()
}
reduced.addEventListener('change', () => { teardown(); build() })
build()
```

Honour changes at runtime — people toggle this when a page starts making them unwell, and it should take effect without a reload.

**Verify by actually enabling the setting.** Windows: Settings → Accessibility → Visual effects → Animation effects off. macOS: System Settings → Accessibility → Display → Reduce motion. Chrome DevTools: Rendering panel → Emulate CSS media feature. Reasoning about it is not the same as looking at it.

**Skipping the preload under reduced motion also saves those users several megabytes.**

---

## Pass 2 — mobile

Phones are where this genre dies: a quarter of the fill rate, a fraction of the memory, a much smaller viewport, and touch gestures that fight scroll-jacking.

**Design the mobile motion, don't scale the desktop motion.**

- **Decide per scene** whether it stays pinned or becomes a well-composed static section. Some scenes are better still on a phone. That's a design choice, not a concession.
- **Pinned horizontal scroll usually shouldn't survive** to narrow viewports — it fights the browser's own gestures and the back-swipe. Stack the items instead.
- **Ship a smaller image sequence** — fewer frames, narrower render — selected by `matchMedia`, not scaled down.
- **Cap DPR at 2**, or 1.5 for canvas-heavy scenes.
- **Never `smoothTouch: true`.** Native momentum is better than anything you'll tune, and overriding it feels wrong immediately.
- **Mind the dynamic viewport.** Mobile browser chrome grows and shrinks on scroll, so `100vh` shifts under you and pinned scenes jump. Use `100dvh`, and call `ScrollTrigger.refresh()` on orientation change but *not* on every resize event — iOS fires resize during that chrome animation.

**Test on a mid-range Android.** Not a current iPhone, which will run almost anything. That's where you find out what you actually built.

---

## Pass 3 — performance

### Budgets

| Metric | Target | Why |
| --- | --- | --- |
| LCP | < 2.5s on mid-range phone / 4G | The headline is the LCP element; it must not be inside a canvas or behind a loader |
| Frame time | < 16ms sustained during scroll | Below this it reads as "smooth"; above it reads as "broken" |
| Lighthouse mobile perf | 90+ | Achievable at tier 1 and 2; tier 3 will not hit it and that's a knowing trade |
| Total payload, tiers 1–2 | Under ~5 MB | Sequences dominate; count them explicitly |

The animation JavaScript is the product here, so it's allowed to cost something. It has to be the *only* thing that costs.

### The rules that matter most

**Animate `transform` and `opacity`. Nothing else.** Anything touching layout — `top`, `left`, `width`, `height`, `margin`, `padding` — forces reflow on every frame. This single rule accounts for most of the difference between a site that feels expensive and one that feels broken.

**`will-change: transform` only while a scene is active.** It promotes the element to its own layer, which costs memory. Applied to every layer at once, it can exhaust memory on a phone. Add on scene enter, remove on leave.

**Never read layout inside a scroll handler.** `getBoundingClientRect`, `offsetTop`, `scrollHeight` all force synchronous layout. Cache on resize and on `ScrollTrigger.refresh()`.

**Self-host and subset fonts.** Display faces used for three headlines don't need the full glyph set. `font-display: swap`, and preload the one face used above the fold.

**Code-split per route** and register ScrollTrigger instances only for scenes that exist on the current page.

**Lazy-load below-the-fold images**, `fetchpriority="high"` on the hero, modern formats throughout.

### Profiling

Chrome DevTools → Performance → record while scrolling the whole page.

Read it in this order:

1. **The frame chart.** Long frames show as red. Find the worst one and work backwards.
2. **Purple blocks (layout/paint).** Any of these during scroll means something is animating a non-composited property. Find it and fix it — this is almost always the real problem.
3. **Yellow blocks (scripting).** Long tasks during scroll usually mean a scroll handler doing too much, or an image decoding at draw time.
4. **The memory track.** A staircase that never falls indicates a leak — commonly ScrollTrigger instances not killed on route change, or Three.js resources not disposed.

Then throttle: CPU 4× slowdown, network Fast 3G. What feels fine unthrottled on a workstation tells you nothing about a phone.

### SEO and accessibility

Cinematic sites fail these in predictable ways:

- **All copy in the served HTML.** Verify with `curl` or view-source, not DevTools — the elements panel shows the DOM after JavaScript, which is not what a crawler necessarily gets.
- **`aria-hidden="true"` on decorative canvas and SVG.** The section around them carries the accessible name.
- **Keyboard navigation works through pinned scenes.** Tab order must follow visual order, focused elements must scroll into view, and a pin must never trap focus.
- **Visible focus states**, designed rather than the browser default overridden away.
- **AA contrast in every scene state**, including mid-transition when colours interpolate.
- **Deep links land correctly.** Anchor links into a pinned scene should arrive at the right scroll position, not at the pin's start.
- Per-page titles and meta descriptions, Open Graph tags, structured data, sitemap, `robots.txt`.

### The last check

Load the finished site on a mid-range phone, on a real connection, having never seen it. Watch what happens in the first three seconds.

If you can't tell what the company does before the animation resolves, the site fails at the thing it was built to do — no matter how good the animation is.
