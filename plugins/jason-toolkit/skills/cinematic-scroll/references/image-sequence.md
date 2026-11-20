# Tier 2 — canvas image sequence

Pre-render frames offline, then scrub them onto a `<canvas>` as scroll progresses. This is how Apple product pages work and how `msport-raptor.com` renders its car across nine shots and 230 frames.

**Why this tier deserves more attention than it gets:** it produces photoreal or full-3D-looking results with none of real-time 3D's risk. It runs anywhere — no GPU capability check, no shader compilation stall, no WebGL context loss. Every frame is exactly what you art-directed. And the implementation below is the whole thing.

Reach for it whenever the shot is a **fixed camera move over a fixed subject**: a product rotating, a machine exploding into parts, a camera pushing into something, a scene assembling. That describes most "we need a 3D hero" briefs.

## Producing the frames

Source them from Blender, Cinema 4D, After Effects, a physical turntable shoot, or a generative video model. See `ai-assets.md` for the generative route, which is now often the fastest.

**Frame count.** 60–120 per shot. Below about 48 the motion visibly steps; above ~120 you're paying bytes for differences nobody perceives. Start at 90 and cut if the file budget demands it.

**Resolution.** Render at the largest size the sequence will ever display, not the largest you can. A canvas that occupies a 1440px-wide column needs 1440px frames — 2× that only for a full-bleed hero on high-DPI screens, and even then cap around 2560px.

**Format.** WebP at quality 78–85 is the default; it keeps alpha and is dramatically smaller than PNG. AVIF is smaller again but decodes more slowly, which matters when you're decoding 90 images. Use PNG only when you need lossless alpha edges against a busy background.

```bash
# From a video source
ffmpeg -i shot1.mp4 -vf "fps=30,scale=1920:-1" -q:v 2 frames/%04d.png

# Encode the sequence
for f in frames/*.png; do cwebp -q 82 "$f" -o "${f%.png}.webp"; done
```

**Budget check.** 90 frames × ~45 KB ≈ 4 MB per shot. That is a real cost. Two or three shots is usually the sensible ceiling for a site that also has to do a job; `msport-raptor` runs nine because the experience *is* the product.

**Frame naming.** Zero-padded and sequential from 0 (`shot1/0000.webp`). Predictable naming lets you construct URLs rather than shipping a manifest.

## Preloading

A sequence must be fully loaded before its scene can be scrubbed. Half-loaded scrubbing looks broken in a way that reads as a bug, not as loading.

```js
function preloadSequence(base, count, ext = 'webp', onProgress) {
  let loaded = 0
  return Promise.all(
    Array.from({ length: count }, (_, i) => new Promise((resolve) => {
      const img = new Image()
      img.decoding = 'async'
      img.src = `${base}/${String(i).padStart(4, '0')}.${ext}`
      const done = () => { onProgress?.(++loaded / count); resolve(img) }
      img.onload = () => img.decode().then(done, done)   // decode up front, not at draw time
      img.onerror = () => { resolve(null) }               // a hole is better than a hang
    }))
  )
}
```

Two details that matter more than they look:

- **`img.decode()` before you need the frame.** Without it the first draw of each image decodes synchronously on the main thread, and the sequence stutters exactly once per frame on first pass — which is when the viewer is watching most closely.
- **Resolve on error rather than rejecting.** One missing frame should leave a gap, not prevent the whole scene from ever running.

Feed `onProgress` into a designed loader. This is the moment that earns a preloader.

Only preload the shots that are near. For a page with several sequences, load shot 1 eagerly and trigger the rest from a ScrollTrigger a screen or two ahead.

## Drawing and scrubbing

```js
function createSequenceScene({ canvas, frames, trigger, end = '+=200%' }) {
  const ctx = canvas.getContext('2d', { alpha: false })
  const state = { frame: 0 }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)   // cap at 2 — 3x costs a lot for nothing
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    draw()
  }

  function draw() {
    const img = frames[Math.round(state.frame)] ?? nearestLoaded(frames, state.frame)
    if (!img) return
    // cover-fit, preserving aspect
    const s = Math.max(canvas.width / img.width, canvas.height / img.height)
    const w = img.width * s, h = img.height * s
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
  }

  gsap.to(state, {
    frame: frames.length - 1,
    ease: 'none',
    scrollTrigger: { trigger, start: 'top top', end, pin: true, scrub: 0.5 },
    onUpdate: draw,
  })

  window.addEventListener('resize', size)
  size()
}

function nearestLoaded(frames, i) {
  for (let d = 0; d < frames.length; d++) {
    if (frames[Math.round(i) - d]) return frames[Math.round(i) - d]
    if (frames[Math.round(i) + d]) return frames[Math.round(i) + d]
  }
  return null
}
```

Notes on the choices:

- **`{ alpha: false }`** lets the browser skip compositing transparency. Meaningful on a full-bleed canvas.
- **DPR capped at 2.** Three-times pixel density quadruples fill cost against a difference almost nobody can see on a moving image.
- **`scrub: 0.5`** adds a short catch-up so frame changes feel like motion rather than a slideshow. `true` is 1:1 and reads mechanically.
- **`nearestLoaded`** keeps the canvas showing something if a frame is missing.
- **Draw on `onUpdate`, not on a rAF loop.** ScrollTrigger already throttles to the frame; a separate loop redraws identical frames forever and burns battery.

## Layering real content over the sequence

The canvas is the picture; everything readable goes above it in the DOM.

```html
<section class="shot" aria-label="Product overview">
  <canvas class="shot__canvas" aria-hidden="true"></canvas>
  <div class="shot__copy">
    <h2>Real text, selectable and indexable</h2>
  </div>
</section>
```

```css
.shot { position: relative; height: 100vh; }
.shot__canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.shot__copy { position: relative; z-index: 1; }
```

`aria-hidden` on the canvas — it's decorative, and a screen reader announcing "canvas" helps nobody. The section gets the accessible label instead.

**Never put words inside the canvas.** They vanish from search, screen readers, translation, find-in-page, and text selection.

## Mobile

Sequences are the heaviest thing on the page and phones are where the budget is tightest.

- **Ship a smaller sequence**, chosen at load: fewer frames (45–60) and a narrower render. Pick with `matchMedia`, not by scaling the desktop one down.
- **Or drop to a single hero frame.** Choosing the best frame in the sequence and showing it as a static image is a legitimate design decision on a phone, not a failure. Decide it per shot.
- Test on a mid-range Android, not a current iPhone. That's where sequences fall over.

## Reduced motion

```js
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Load one frame, draw it, and don't create the ScrollTrigger at all.
  const hero = new Image()
  hero.src = `${base}/0045.webp`
  hero.onload = () => drawStatic(hero)
  return
}
```

Pick the hero frame deliberately — the most compositionally interesting one, not frame 0. This is a design decision, and if the sequence is any good there's an obvious best frame.

Skipping preload entirely under reduced motion also saves those users several megabytes, which is a real courtesy.
