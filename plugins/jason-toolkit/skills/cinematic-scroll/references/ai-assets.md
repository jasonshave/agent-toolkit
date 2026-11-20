# Generative assets in a cinematic scroll build

Generative image and video tools (Higgsfield, and equivalents) change the economics of this genre. A tier-2 image sequence used to mean a 3D artist, a render farm, and a week. It can now mean an afternoon.

But they change it unevenly. Some jobs they do better than a studio would for the budget; others they cannot do at all, and pushing them into those jobs is where builds go wrong. This file is about telling the two apart.

## Where generative assets are unambiguously right

**Static scene and hero imagery.** Full-bleed plates, environments, backgrounds, atmospheric shots. No temporal consistency problem exists, iteration is cheap, and you can generate twenty directions before committing to one.

**Concept exploration during the shot list.** Before any code, generate a frame for each scene you're considering. Ten images is a storyboard, and it makes the pacing conversation concrete far earlier than usual.

**Textures and surfaces.** Grain, paper, concrete, phosphor glow, dust, noise fields — anything used as an overlay or material.

**Ambient loops that simply play.** Drifting smoke, floating particles, weather, light shifting. Nobody scrubs these, so frame-to-frame wobble is invisible. Play them as video and stop worrying.

**Stylized or illustrated subjects.** Where the exact geometry doesn't need to be verifiable, generation is often better than modelling — richer, faster, and more characterful.

## Where they are the wrong tool

**Anything with legible text, a logo, or exact branding.** It will be subtly wrong, and the wrongness is exactly what a viewer's eye locks onto. Generate the surface, composite the text in the DOM on top. This is better practice anyway — real text stays selectable, translatable, and readable by screen readers.

**Subjects whose precise geometry matters.** A real product a customer will hold, a machine with a specific part count, a car a manufacturer will approve. Model it or photograph it.

**Anything needing a targeted fix.** Generation isn't addressable — you cannot repair frame 47. If a shot must land exactly, and iterating means regenerating everything, you want a 3D scene you can adjust.

**Long scrub sequences.** Drift compounds with duration. Past roughly five seconds of generated motion, wobble becomes hard to hide.

## The frame-sequence pipeline

This is the workflow that turns a generative video model into a tier-2 scroll-scrubbed sequence. The whole thing rests on one idea: **lock both ends.**

A scrubbed sequence is judged much more harshly than a played one. At 24fps, a subtle morph between frames is invisible. Under a scroll wheel, where the viewer controls the playhead and may move slowly or reverse, every wobble reads as a defect. Locking the first and last frame removes most of it, because the model interpolates between two fixed points rather than inventing its way forward.

**1. Generate the first and last frame as stills.**
Use `generate_image` — `nano_banana_pro` where you want 4K or crisp detail, `soul_2` for people and editorial looks. Iterate here until both frames are genuinely right. This is the cheap step and the one that determines the result, so spend the time.

**2. Interpolate between them.**
Feed both as `start_image` and `end_image` to a keyframe-capable model via `generate_video`:

- `minimax_h3` — 2K output, start/end frames, 4–15s. Best when resolution matters, which for full-bleed web it usually does.
- `seedance_2_5` — up to 1080p with `bitrate_mode: "high"`, 4–30s. The high bitrate setting matters more than it looks: you're going to extract stills, and compression artifacts that hide in playback become visible when someone stops on a frame.
- `flux_3_video` — start/end frames, 1080p, good motion quality.

Prompt the camera move in cinematographic language — "slow dolly in", "gentle orbit left", "static camera, subject rotates" — not in terms of what the subject is doing.

**3. Keep shots short and moves simple.**
Three to five seconds. One camera move per shot. Slow and linear beats fast and complex, both for drift and because scroll-scrubbing wants an even distribution of change across the sequence.

**4. Generate variants and pick the cleanest.**
Use `count: 2` to `4`, or `generate_video_batch` for several different shots at once. Drift varies run to run; choosing among four is much better than accepting one. Judge them by scrubbing, not by watching.

**5. Extract and encode.**

```bash
# Extract at the frame count you actually need, not everything
ffmpeg -i shot1.mp4 -vf "fps=30,scale=1920:-1" -q:v 2 frames/%04d.png

# Then encode for the web — WebP keeps alpha and beats PNG substantially
for f in frames/*.png; do cwebp -q 82 "$f" -o "${f%.png}.webp"; done
```

See `image-sequence.md` for frame counts, preloading, and the canvas scrubbing itself.

**6. Deflicker if needed.**
A light temporal smoothing pass can rescue an otherwise good take:

```bash
ffmpeg -i shot1.mp4 -vf "deflicker=mode=pm:size=5,fps=30" -q:v 2 frames/%04d.png
```

Don't over-apply — it softens detail. If a shot needs heavy deflickering, regenerate it instead.

## Compositing: generate the world, own the interface

The strongest pattern in this genre is **generative background, live foreground.**

Let the model produce the environment, the atmosphere, the camera move — the parts where its weaknesses don't show and its strengths do. Keep everything the viewer reads or interacts with in the DOM, layered on top: headlines, screens, labels, UI, calls to action.

You get generative production value and real text at once. A concrete example: for a shot that pushes into a computer monitor, generate the room and the dolly move as a sequence, and render the monitor's screen contents as a live DOM or canvas layer positioned over it. The screen stays crisp at any scale, its text stays real, and it can animate independently of the plate.

## Cost discipline

Generations are billed. A few habits keep it sane:

- Preflight with `get_cost: true` before any large batch.
- Settle composition at low resolution or in stills first; only generate final video once the framing is locked.
- `generate_video_batch` for several independent shots; `count` only for variants of one shot.
- Check `show_plans_and_credits` before a big run.
- Don't pass `use_unlim: true` on your own initiative — that spends a free-trial allowance the user may be saving.

## The honest summary

Generative tools move a tier-2 image sequence from "needs a 3D artist" to "needs an afternoon and good taste." That is a real and large shift, and it makes the most valuable rung of the technique ladder available on almost any budget.

They do not remove the need for art direction — they concentrate it. When anyone can generate a shot, the difference between sites is entirely in which shots were chosen, how they're paced, and what was composited on top. That judgment is the part that still has to be earned.
