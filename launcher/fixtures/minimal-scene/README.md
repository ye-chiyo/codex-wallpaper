# Minimal Scene fixture

This fixture exercises the real `webwallgl@3.0.0` scene path without using a
Wallpaper Engine Workshop asset.

## Source and license

- Source: generated in this repository from the synthetic project metadata,
  text, and WAV tone in `generate.mjs`.
- Generator dependency: `@webwallgl/editor@3.0.0`, MIT.
- Renderer dependency: `webwallgl@3.0.0`, MIT.
- Fixture contents: synthetic only. No third-party wallpaper, texture, model,
  audio, or Workshop content is included.

The fixture is test data, not a redistributable wallpaper. The generator and
fixture may be reused under the repository's own licensing decision.

## Reproduce

```powershell
node launcher/fixtures/minimal-scene/generate.mjs
node launcher/fixtures/minimal-scene/generate.mjs --check
```

The generator packs `project.json`, `scene.json`, and `sounds/tone.wav` with the
official editor API, then reads the result back with `checkWeCompat`.

Expected output:

- `scene.pkg`: 2,994 bytes
- SHA-256: `be12f6570fdf7f8291fe9777494e16329ed4750155970ddeac08c635b84d018a`
- Packed entries: `project.json`, `scene.json`, `sounds/tone.wav`
- Parsed scene: 2 layers

## Coverage boundary

The fixture proves a real WebGL2 first frame, text rendering, scene audio setup,
fit changes, pause/resume, FPS changes, and teardown. It does not prove model,
particle, shader-effect, video-texture, Workshop, or general Wallpaper Engine
compatibility.
