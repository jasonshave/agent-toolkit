# Tier 3 — real-time WebGL

The most expensive rung, and the one most often reached for too early. `igloo.inc` is the reference: 13.5 MB, 82 requests, a 25–40 second preload, and a hard dependency on GPU acceleration.

## Decide before you build

Real-time 3D is warranted when a pre-rendered sequence fundamentally cannot do the job:

- **Real-time response to input** — materials that react to the pointer, physics, particles the viewer disturbs, refraction that tracks what's behind it.
- **A camera the viewer controls freely**, rather than a path you authored.
- **Content that varies per visitor** — configurators, user data, anything not knowable at render time.
- **A continuous world** with no fixed shot boundaries, where any pre-render would be combinatorial.

If none of those apply — if the brief is a fixed camera move over a fixed subject — build it as an image sequence. You get the same picture, art-directed exactly, at a tenth of the cost and none of the risk. See `image-sequence.md`.

Say the tradeoff out loud before committing. "This is a 3–4× build and adds ~10 MB and a 30-second first load" is a decision someone should make deliberately, not discover at launch.

## The hardware dependency

Tier 3 fails completely on machines without GPU acceleration — some VMs, some locked-down corporate fleets, browsers with hardware acceleration disabled, and older Android. Tiers 1 and 2 degrade; tier 3 shows nothing.

Detect and fall back rather than shipping a blank hero:

```js
function hasUsableGPU() {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  if (!gl) return false
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''
  // Software rasterizers: SwiftShader, llvmpipe, "Microsoft Basic Render Driver"
  return !/swiftshader|llvmpipe|basic render|software/i.test(renderer)
}
```

The fallback should be a designed still or a short image sequence — the same asset you'd use for reduced motion. Build it regardless; you need it for `prefers-reduced-motion` anyway.

Also handle context loss, which happens on real machines under memory pressure:

```js
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showFallback() })
```

## Asset pipeline

This is where the payload is won or lost. On igloo, textures are 94% of 13.5 MB.

**Geometry — Draco.** Compresses mesh data by roughly 90%.

```bash
gltf-transform draco input.glb output.glb
```

Decoded by a WASM module you must host and point the loader at. Costs a little CPU on load in exchange for a large download saving — nearly always worth it.

**Textures — KTX2 / Basis Universal.** The important one, and the step most often skipped.

```bash
gltf-transform uastc input.glb output.glb --level 4    # quality-critical maps
gltf-transform etc1s input.glb output.glb --quality 200 # colour maps, much smaller
```

KTX2 isn't just a smaller download — it stays compressed **in GPU memory**. A 2048² PNG occupies ~16 MB of VRAM decompressed; the KTX2 equivalent occupies ~1–4 MB. On a phone with a few hundred megabytes of usable VRAM, that difference decides whether the scene runs.

Use ETC1S for colour/albedo, UASTC for normal and roughness maps where artifacts show.

**Texture sizes.** 1024² for most maps, 2048² only for hero surfaces the camera gets close to. Halving a dimension quarters the cost.

**Baked lighting.** Bake to lightmaps rather than computing real-time. Cheaper and usually better looking.

**Baked animation.** igloo stores camera/scene animation in `scroll-datatexture.ktx2` and samples it by scroll progress on the GPU. Authoring choreography in 3D software and exporting it beats writing it as code — the animator works in their own tools and the runtime just reads a curve.

## Runtime discipline

- **Code-split the 3D bundle.** igloo ships `App3D-*.js` as a separate chunk so first paint doesn't wait on Three.js. Do the same — `import()` the 3D module after the page is interactive.
- **Cap `devicePixelRatio` at 2** (1.5 on mobile). Fill rate is usually the bottleneck, and it scales with the square of DPR.
- **Compile shaders during the preload**, not at first scroll. `renderer.compile(scene, camera)` before dismissing the loader, or the first interaction stalls for hundreds of milliseconds.
- **Stop the render loop when the canvas is off-screen.** An IntersectionObserver that pauses rAF is a few lines and saves meaningful battery.
- **Dispose properly** on unmount — geometries, materials, textures, and the renderer. Three.js does not garbage-collect GPU resources for you, and route changes will leak until the tab dies.

## Budget

If you're going here, plan for roughly:

- **10–15 MB** of assets, textures dominating.
- **20–40 seconds** first load on a normal connection, which forces a designed preloader and probably an entry gate.
- **A 3D artist or a generative pipeline** for models, materials, and baked animation.
- **A real device test matrix.** This is the tier where "works on my machine" is most misleading.

That's the cost of igloo.inc. It's justified there because the site *is* the experience. On a site that also has to explain a service and convert a lead, it's very hard to defend — and the same visual impact is usually available a tier down.
