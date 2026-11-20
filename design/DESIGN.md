# Clanky design handoff (v0.1, "pocket handheld")

Source of truth for colours, type, spacing and motion is `tokens.json`. Use token names, not raw hex, in code.

## Files
- `tokens.json`: colors (base, status, ghost), surfaces, contrast, type, shape, edge/glow, space, motion, sprite.
- `sprites/clanky-<ghost>-light.png` and `-dark.png`: 128×512 sheets, 32×32 cells, 4 columns (frames) × 16 rows (states). Ghosts: `ivory` (Look's own / Clanky), `cobalt` (Butler), `green` (Teacher), `pink` (Sassy).
- `sprites/clanky-cursor-light.png` and `-dark.png`: 20×40, 10×10 cells, rows = ivory, cobalt, green, pink; 2 idle frames at 400ms.
- `sprites/clanky-sprites.json`: state order, frame counts and per-frame ms.
- `tools/clanky-sprite-gen.py`: regenerates every sheet (`python3 clanky-sprite-gen.py out`).

## Drawing the character (canvas)
- Set `ctx.imageSmoothingEnabled = false`. Scale by whole numbers only: 2× = 64px default, 1× = 32px small; cursor 10×10 at 2× = 20px.
- Frame source rect: `x = frame*32, y = stateRow*32`. Use the per-frame ms from the manifest, not a fixed rate.
- Choose the `-dark` sheet when the sampled backdrop luminance is < 0.18. Dark sheets have the glow baked in, and Butler/Teacher use a light rim outline.
- State rows: idle, listening, thinking, talking, working, pointing, waiting, done, error, asleep, wave, hype, remind, motivate, long-wait, offline.
- Clanky's antenna light uses the state's status colour (in the manifest as `status`).
- Reduced motion: draw frame 0 of the state plus a status bead and a text label; no loops.

## Overlay surfaces (bubbles, cards, toasts, marks)
- Solid `oat` fill, 1.5px `ink` stroke, radius 6, hard shadow `0 2px 0 rgba(42,36,32,.22)`. No blur, no glass, no transparency on text surfaces.
- Bubble: 3px top strip plus a corner tab in the active ghost colour (Clanky uses tangerine). Padding 12/14, text 14/22 Martian Mono, page indicator `1/2` in Doto, blinking ▼ when more text is coming.
- Free strokes (arrows, leaders, rings) are cased: a 6px `oat` stroke under a 2px `ink` stroke, pixel arrowheads, orthogonal routes only.
- Pointer ring: ink 1.5 / tangerine 3 / ink 1.5, 8px outside the target, pulse 1600ms steps(4), step chip ("2 of 4") above it.
- Tangerine marks the single thing to look at. Accents never go on body text.
- At most 5 marks on screen; the oldest dithers out (200ms) when a 6th arrives. Entry uses a Bayer dither wipe of 200ms with a 40ms stagger; connectors draw after both ends land.
- Only buttons, copy and open marks take clicks. Everything else, including the scrim, passes clicks through to the app.

## Explain scrim
- Only during a guided explain or "show me how".
- Over a light app: `rgba(42,36,32,.28)`. Over a dark app: `rgba(0,0,0,.45)`.
- Spotlight cut-out around the current target: padding 8, radius 8. Marks, the bubble and the ghost sit above the scrim at full opacity.
- Fades in over 240ms and out over 160ms. With reduced motion it appears without a fade.

## Type
- Martian Mono for body and UI. Doto (weight 800, uppercase, tracking .06em) for labels and headings only, never paragraphs. Readex Pro for Arabic/RTL, 1px larger than the Martian step.
- Use `font-variant-numeric: tabular-nums` for times, counts and progress.

## Motion
- open 240, close 160, page 220, stagger 40, pulse 1600 (loop), spring k420 c32 m1.
- Everything except loops runs between 150 and 400ms, is interruptible, and never blocks input.

## Not designed yet
- Ask bar, toasts, background agent rows, mic meter.
- The Settings panel (11 pages) and the setup guide (10 steps).
- The developer spec for each mark.

For these, keep to the rules above and ask before inventing new visual language.
