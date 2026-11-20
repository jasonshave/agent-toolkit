# Tier 1 recipes — DOM and CSS

Everything here runs on stacked elements, `transform`, and `opacity`. `history-of-animation.webflow.io` gets 32 screens of cinematic feel out of nothing else.

Examples use GSAP + ScrollTrigger because it's the most predictable option for pinning. Where a native CSS equivalent exists and is well supported for the audience, prefer it — no library cost.

## Contents

- [Setup](#setup)
- [Smooth scroll](#smooth-scroll)
- [Pinned scenes](#pinned-scenes)
- [Multi-layer parallax](#multi-layer-parallax)
- [Masked text reveals](#masked-text-reveals)
- [Scroll-drawn SVG](#scroll-drawn-svg)
- [Scene colour transitions](#scene-colour-transitions)
- [Horizontal inside vertical](#horizontal-inside-vertical)
- [Sticky header handoff](#sticky-header-handoff)
- [Cleanup and React](#cleanup-and-react)

---

## Setup

```js
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)

// One place to respect the setting, checked by every scene below.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

Register ScrollTrigger instances only for scenes that exist on the current route. On a multi-page site, tearing down and rebuilding on navigation avoids a slow accumulation of dead triggers.

---

## Smooth scroll

Optional, and genuinely optional. Badly tuned inertia feels like a broken page — the opposite of the impression you're buying. If it doesn't feel excellent, ship native scrolling.

```js
import Lenis from 'lenis'

const lenis = new Lenis({
  duration: 1.1,          // higher = more float; past ~1.4 it feels laggy
  smoothWheel: true,
  smoothTouch: false,     // leave touch alone — native momentum is better
})

lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((t) => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)
```

Two things people get wrong: driving Lenis from its own `requestAnimationFrame` loop *and* GSAP's ticker, which double-updates and produces jitter; and enabling `smoothTouch`, which fights the OS and feels worse than doing nothing.

Disable entirely under reduced motion — `lenis.destroy()`.

---

## Pinned scenes

The core device. A section locks in place while its content advances with scroll.

```js
const scene = document.querySelector('#problems')

ScrollTrigger.create({
  trigger: scene,
  start: 'top top',
  end: '+=200%',        // pin lasts two extra viewport heights of scrolling
  pin: true,
  pinSpacing: true,     // keep true unless you know why you're overlapping
  scrub: 1,             // ~1s catch-up; 'true' is 1:1 and feels stiffer
  animation: gsap.timeline()
    .to('.stmt-1', { opacity: 0, y: -40 })
    .from('.stmt-2', { opacity: 0, y: 40 }, '<')
    .to('.stmt-2', { opacity: 0, y: -40 })
    .from('.stmt-3', { opacity: 0, y: 40 }, '<'),
})
```

**Pin length is a pacing decision, not a technical one.** `+=100%` per beat of content is a reasonable starting point. Too long and it feels stuck; too short and the content flashes past. Scroll it yourself repeatedly — this is not something to reason about abstractly.

**Every pin needs an obvious exit.** The viewer must be able to tell that scrolling is still doing something. Progress within the scene should be continuously visible — content moving, an indicator advancing, the through-line drawing.

**Under reduced motion, don't pin at all:**

```js
if (reduced) {
  // Show every statement as a normal stacked section.
  gsap.set('.stmt-1, .stmt-2, .stmt-3', { opacity: 1, y: 0, position: 'relative' })
} else {
  ScrollTrigger.create({ /* as above */ })
}
```

---

## Multi-layer parallax

Depth comes from layers moving at genuinely different rates. Keep it subtle enough that it registers as dimensionality rather than as an effect with a name.

```js
gsap.utils.toArray('[data-depth]').forEach((layer) => {
  const depth = parseFloat(layer.dataset.depth)   // 0 = fixed, 1 = scrolls normally
  gsap.to(layer, {
    yPercent: -20 * (1 - depth),
    ease: 'none',
    scrollTrigger: { trigger: layer.closest('.scene'), start: 'top bottom', end: 'bottom top', scrub: true },
  })
})
```

```html
<div class="scene">
  <img data-depth="0.1" class="layer" src="sky.webp" alt="">
  <img data-depth="0.4" class="layer" src="mountains.webp" alt="">
  <img data-depth="0.8" class="layer" src="foreground.webp" alt="">
</div>
```

Give layers `will-change: transform` only while their scene is active, and remove it after — leaving it on permanently costs memory on every layer at once.

Oversize each layer beyond its container by roughly the distance it travels, or edges will slide into frame.

---

## Masked text reveals

A clip reveal reads as considered; a plain fade-up on everything reads as a template.

```css
.reveal-line { display: block; overflow: hidden; }
.reveal-line > span { display: block; will-change: transform; }
```

```js
gsap.utils.toArray('.reveal').forEach((el) => {
  gsap.from(el.querySelectorAll('.reveal-line > span'), {
    yPercent: 110,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.08,
    scrollTrigger: { trigger: el, start: 'top 80%', once: true },
  })
})
```

Per line or per word. **Never per character on body copy** — it's illegible, it wrecks screen-reader output, and it's the single loudest "template" signal in the genre.

The wrapper markup must contain the real text. If you're splitting text at runtime, split from existing DOM content rather than injecting it, so the words exist without JavaScript.

Under reduced motion, set the resting state and skip the animation — the text is already there.

---

## Scroll-drawn SVG

The through-line device. One line that draws itself the length of the page, binding scenes together. `msport-raptor` uses this for its rally route.

```html
<svg class="thread" viewBox="0 0 100 4000" preserveAspectRatio="none" aria-hidden="true">
  <path d="M50 0 C 20 400, 80 800, 50 1200 S 20 2000, 50 2400 S 80 3400, 50 4000"
        fill="none" stroke="currentColor" stroke-width="1" pathLength="1" />
</svg>
```

```css
.thread { position: fixed; inset: 0; height: 100vh; width: 100%; pointer-events: none; }
.thread path { stroke-dasharray: 1; stroke-dashoffset: 1; }
```

```js
gsap.to('.thread path', {
  strokeDashoffset: 0,
  ease: 'none',
  scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
})
```

`pathLength="1"` normalizes the path so dash values are a 0–1 progress fraction regardless of the path's real length — you can redraw the curve later without retuning anything.

Under reduced motion, render the path complete (`stroke-dashoffset: 0`) and leave it.

---

## Scene colour transitions

Changing the whole page palette between scenes does more for the "travelling through spaces" feeling than any single animation. It's also nearly free.

```css
:root { --bg: #0a0a0a; --fg: #f5f5f5; --accent: #39ff6a; }
body { background: var(--bg); color: var(--fg); transition: background-color .6s ease, color .6s ease; }
```

```js
document.querySelectorAll('[data-theme-bg]').forEach((scene) => {
  ScrollTrigger.create({
    trigger: scene,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: ({ isActive }) => {
      if (!isActive) return
      document.documentElement.style.setProperty('--bg', scene.dataset.themeBg)
      document.documentElement.style.setProperty('--fg', scene.dataset.themeFg)
    },
  })
})
```

**Every intermediate state has to pass contrast.** Transitioning between two AA-compliant palettes does not guarantee the values in between are compliant. Either keep transitions short enough that mid-states aren't readable-and-wrong for long, or step discretely at scene boundaries rather than interpolating.

---

## Horizontal inside vertical

Use once. Twice and it becomes a tic.

```js
const track = document.querySelector('.h-track')

gsap.to(track, {
  x: () => -(track.scrollWidth - window.innerWidth),
  ease: 'none',
  scrollTrigger: {
    trigger: '.h-section',
    start: 'top top',
    end: () => '+=' + (track.scrollWidth - window.innerWidth),
    pin: true,
    scrub: 1,
    invalidateOnRefresh: true,   // recompute on resize
  },
})
```

`invalidateOnRefresh` matters — without it, the distance is baked at load and breaks on rotation or resize.

On narrow viewports, drop the pin and let the track scroll horizontally by touch, or stack the items vertically. Pinned horizontal scroll on a phone frequently fights the browser's own gestures.

---

## Sticky header handoff

Cheap, and it does a lot for the sense of chapters.

```css
.scene-label { position: sticky; top: 0; z-index: 2; }
```

Each scene's label sticks at the top while its scene is in view and is pushed out by the next one. No JavaScript. Works under reduced motion unchanged.

---

## Cleanup and React

In any framework with remounting, kill triggers on unmount or they accumulate and fire against detached nodes.

```js
useEffect(() => {
  const ctx = gsap.context(() => {
    // all ScrollTrigger / gsap calls for this component
  }, rootRef)
  return () => ctx.revert()
}, [])
```

`gsap.context` scopes selectors to the ref and reverts everything — triggers, tweens, and inline styles — in one call.

After any layout change that isn't a resize (fonts loading, images settling, a route transition), call `ScrollTrigger.refresh()`. Stale start/end positions are the most common cause of "the pin fires in the wrong place."
