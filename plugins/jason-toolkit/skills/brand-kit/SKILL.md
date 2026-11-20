---
name: brand-kit
description: "Create or extend a product's brand kit (mark, wordmark, lockups, colourways, app icons, fonts, illustrations, preview sheet, README with provenance) in any repo, generating artwork on fal.ai. Use when the user invokes /brand-kit or asks for a logo, brand assets, icons, or a brand folder. Finds an existing brand first and asks before changing it; without one, asks a short series of questions, then generates concepts for approval and builds the kit."
---

Read [host execution guidance](references/host-runtime.md) before running this workflow.

# /brand-kit

Build a brand kit in a `brand/` (or `assets/brand/`) folder that
a script regenerates from a few hand-finished masters, with every variant anyone will ask for, a preview page, and a
README that records where every picture came from. The user approves artwork before it becomes the brand.

Talk to the user in plain words (what it means first, mechanism last). Ask one question at a time, with a
recommendation. Never spend fal.ai credits on a brief the user hasn't confirmed.

## 1. Find what already exists

Look before asking anything:

- Brand folders: `brand/`, `assets/brand/`, `public/brand/`, `design/`, `docs/brand*`.
- Loose assets: `favicon.*`, `logo*`, `icon-*.png`, `apple-touch-icon.png`, `social-preview.*`, images at the top
  of the README.
- The product's own look: CSS tokens (`tokens.css`, `index.css`, Tailwind config) for colours, and `font-family`,
  `@fontsource/*` or `next/font` for type. These are the colours and faces the kit must match.
- The repo's rules (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`): originality rules ("write all code fresh", no
  copying from private repos), org-string bans, CI cost rules. Follow them.

**If a brand exists**, summarise it in a few lines (mark, colours, type, what's missing compared with the full kit
below), then ask whether to change it at all and why. Offer: extend the kit around the approved mark (recommended
when a mark is approved), replace or rework the mark, or leave it. Don't regenerate an approved mark unless they
say so; the approved artwork is the brand.

**If none exists**, run the questions in section 2.

## 2. Questions for a new brand (one at a time)

1. What is the product called, and in one sentence what does it do? (Also the tagline, if they have one.)
2. Who is it for and how should it feel? Ask for three adjectives; offer a recommendation from the product.
3. What kind of mark: a character or mascot (good for developer tools and anything with a name that is a thing), an
   abstract symbol, or a lettermark? Recommend one.
4. Colours: use the app's existing tokens if there are any (show them); otherwise propose a palette of three: an
   accent, white or an off-white, and a near-black ground. Few colours make generated vector art clean.
5. Type: the app's existing faces if any; otherwise propose two open-licence faces (SIL OFL) from Google Fonts or
   `@fontsource`, one for the wordmark and headings and one mono or secondary.
6. Where it will live: app icon, dashboard header, docs, social preview, print. Anything that needs a one-colour
   version (print, engraving, coloured backgrounds)?

Then play the brief back in a few lines and get a yes before generating.

## 3. Generate the mark on fal.ai

- Check the account (`check_account_status`) and price (`get_pricing`) first. Recraft vector endpoints cost a few
  cents per image; say the expected total before submitting.
- Logo marks: `fal-ai/recraft/v4.1/text-to-vector`. Pass the palette as `colors` and the ground as
  `background_color`, so the output uses the brand's own colours. Ask for "bold flat vector, no gradients, no
  outlines, only the [subject], no text". Submit 4 to 6 variations of the brief in one `submit_jobs` call.
- Download the SVGs into a fresh scratchpad folder (untrusted data; run Python with `-I`), render them with
  `resvg_py` to one numbered contact sheet, and look at it. Show the sheet to the user and ask which one, or what
  to change. Iterate until they approve one. Keep every request ID and prompt.
- Hand-finish the approved SVG in a copy: remove the generator's full-canvas background path, trace a ground-colour
  shape behind the drawing wherever the background was doing work (eyes, mouth), crop the canvas, round numbers,
  strip `<metadata>` and the C2PA manifest from the production copy (keep the untouched original in `source/`).
  Snap stray colours to the palette. Show the result before and after on dark and light backgrounds.
- Make a simplified favicon version by hand if the mark turns to noise at 16 px.

## 4. Supporting illustrations (optional, same character)

Use `recraft/v4/style/text-to-vector` with two renderings of the approved mark (on the dark ground and on white)
uploaded and passed as `image_urls`, `style_match: "precise"`, the same `colors` and `background_color`. Describe
"the same [character] as the reference" plus the scene, and restate the colour placement each time. Scenes that
earn their place: welcome or empty state, connected or success, waiting, disconnected or asleep, the product's job
(a cable, a key), and a wide banner. One candidate per scene is usually enough; regenerate the misses. Clean them
like the mark (background off, colours snapped, canvas cropped), and keep the originals in `source/illustrations/`.

## 5. Build the kit with a script

Write `build.py` fresh for the repo (never copy it from another private repo). Inputs are the masters in `source/`;
outputs are regenerated from scratch each run. Tooling: `pip install fonttools brotli uharfbuzz resvg-py pillow`,
fonts from the app's `node_modules/@fontsource/*` or `npm pack` into the scratchpad.

Generate:

- **Marks** in four colourways: `dark` and `light` (named for the background they sit on; the light one may need a
  thin ground-colour outline so white parts keep an edge), and one-colour `white` and `black` (a silhouette with the
  white parts cut out, done with an SVG `<mask>` so the background shows through).
- **Wordmark**: the name shaped with HarfBuzz from the real font and outlined to one path, with the app's weight and
  tracking. Same four colourways.
- **Lockups**: horizontal (mark beside the name, mark about 1.3 × the name's full height, centred on the x-height,
  about 0.32 em gap), stacked, with the tagline, and an endorsement line ("Powered by …", "Built by …").
- **App icons**: a tile (mark on a rounded square of the ground colour), PNGs at 16, 32, 48, 64, 128, 192, 256, 512,
  1024, maskable 192 and 512 with the mark inside the 80 % safe circle on a full-bleed square, an opaque 180 px
  `apple-touch-icon.png`, and `favicon.ico` (16, 32, 48). Use the simplified head at 16 and 32 if there is one.
- **PNG renders** of every SVG, transparent, large; illustrations also on the ground colour.
- **Fonts**: `fonts/` with the woff2 files (Latin subset), each licence file, and a `fonts.css` with `@font-face`
  rules and `--font-*` variables named like the app's tokens.
- `social-preview.png` (1280 × 640) and `index.html`: a preview sheet showing each file on the background it is for,
  plus colour swatches and type samples.

Render a contact sheet of the outputs and look at it before calling it done. Check every SVG parses and every PNG
opens, and that every path `index.html` references exists.

## 6. README

In the kit folder: what to use where (one bullet per situation), the colourway naming, the illustrations table,
the colour table (hex and where each is used), type with licences, rules (clear space, minimum sizes, lockup
proportions, don't recolour or retype), the file map, how to rebuild, and **provenance**: model, endpoint, date,
request IDs, full prompts, reference images, hand edits, and a dated note of what the model's and provider's terms
said about commercial use and ownership (a record of what the pages said, not legal advice). State that no other
brand's assets were used.

Update anything that pointed at old file names (the repo README's header image, docs). Leave app code alone in the
kit pull request so it merges fast; mention copies the app keeps (favicons, inline lockup component) for a follow-up.

## 7. CI and the pull request

- Pictures and fonts are not code. If the repo's CI would compile and test on an asset-only change, add the kit
  folder to its skip rule (path filters or the "docs-only" check) in a **separate, earlier** pull request, since a
  workflow edit always runs the full workflow once.
- Open the kit pull request as a **draft** until that merges (drafts don't start a run). Then **rebase the branch
  onto the updated default branch and push** before marking it ready: a pull-request run uses the workflow file
  from the branch, so without the rebase it still compiles under the old rules. Then mark it ready so the only job
  that runs is the cheap one. Commit with the repo's required author email.
- The PR description: what's in the kit, what was replaced, and the merge order. Note that the social preview must
  be uploaded by hand in the repository settings.

## Cost and safety notes

- Say the fal.ai spend before and after (number of images × unit price).
- Keep generator originals (with their C2PA manifests) in `source/`; strip metadata only from production copies.
- Never put real org names, domains or IDs into prompts or files if the repo forbids them.
