# Rendering Clanky crisply (fixes blurry / low-res UI)

The v1 look is pixel art plus a sharp outline. It goes soft for two reasons: something is drawn at 1× on a 2× (Retina) screen, or pixels get smoothed when they're scaled. Every rule below is about one of those two.

## 1. Every <canvas> must use the device pixel ratio
```js
function setupCanvas(canvas, cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);    // backing store in device pixels
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);    // draw in CSS px from here on
  ctx.imageSmoothingEnabled = false;         // set again after every resize
  return ctx;
}
// re-run when the window moves between a Retina and a non-Retina display
matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', resizeAll, { once: true });
```
- Never size a canvas with CSS alone, and never `transform: scale()` a canvas or a sprite element.
- Assigning `canvas.width` / `canvas.height` resets the context, so apply the transform and `imageSmoothingEnabled = false` again after every resize.

## 2. Sprites: whole-number device-pixel scale, nearest neighbour
- Draw size = 32 × N **device** pixels, with N a whole number. On a 2× screen, the 64px default is 128 device px (N = 4), the 32px size is N = 2, and the 20px cursor is 10×10 at N = 4.
- Snap positions to device pixels: `x = Math.round(x * dpr) / dpr`. Sub-pixel x/y blurs pixel art even with smoothing off. During glides and bobs, move in whole device pixels.
- Easiest option: use the pre-scaled sheets in `sprites/2x` (for 1× screens) or `sprites/4x` (for 2× screens) and draw them 1:1 in device pixels, so nothing gets resampled. Source rect for a cell = `(frame*32*S, row*32*S, 32*S, 32*S)`, where S = 2 or 4.
- If sprites are DOM elements rather than canvas: use `image-rendering: pixelated`, a whole-number CSS size (64/32/20), `background-size` in exact multiples, and no fractional `left`/`top`.
- Native macOS layers (Swift/AppKit): set `layer.contentsScale = window.backingScaleFactor`, `layer.magnificationFilter = .nearest` and `minificationFilter = .nearest`. Update both on `NSWindow.didChangeBackingPropertiesNotification`.

## 3. Text, outlines and patterns
- Don't draw body text into a canvas at 1×. Prefer real HTML/DOM text for bubbles, cards and toasts. If you must draw text on canvas, the dpr setup above is mandatory, and wait for `await document.fonts.ready` before the first draw so the bundled fonts are used.
- Doto (dot-matrix) only at 12px or larger, weight 800. Martian Mono for body text, 13–14px.
- 1.5px ink strokes are 3 device px on Retina, which is fine. On 1× screens, round strokes to 1 or 2 px and offset 1px lines by 0.5 so they land on whole pixels.
- Dither and scanline patterns: build them in device pixels (one pattern cell = 1 device px × N), or render them once per dpr into an offscreen canvas. Never let a CSS-sized pattern get resampled.

## 4. App and window level
- The overlay window and webview must run at zoom 1 (Electron `webContents.setZoomFactor(1)`, WKWebView `pageZoom = 1`). Window bounds must be whole numbers.
- Don't screenshot the UI and redraw it, and don't render overlay pieces to a bitmap at 1× and scale it up.

## 5. Self-check (add a dev overlay or log)
- `devicePixelRatio` is 2 on a Retina Mac, and every canvas has `canvas.width === canvas.clientWidth * devicePixelRatio`.
- Zoom a screenshot to 800%: sprite pixels are perfect squares with hard edges, and text has no fuzzy halo.
- Drag the window between a Retina and an external 1× display: it stays sharp on both.
