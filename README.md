# Origin: interactive story

A five-chapter WebGL storytelling site (Three.js + Vite). The visuals and sound are generated at runtime, so the project ships no binary assets.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static output in dist/
```

## Chapters

| # | Stage | Interaction |
|---|-------|-------------|
| 0 | Loader | 99 → 00 countdown, then drag the dot around the ring (this also unlocks audio) |
| 1 | `PromiseStage` | Scroll to drift through clouds and floating certificates |
| 2 | `FilterStage` | Click the glass to crack it, then click again to shatter it |
| 3 | `CostStage` | Press and hold (or hold Space) to burn the banknotes |
| 4 | `ReverseStage` | Scroll through a tunnel lined with job breakdowns |
| 5 | `FieldStage` | Drag to pan, scroll to zoom, tap pins or the ground; waitlist CTA |

Between chapters, a press-and-hold button triggers a noise-dissolve transition (`StageMixPass`).

## Where to change things

- **Copy, brand, palettes, role pins, XP, waitlist endpoint:** `src/content.js`
- **Waitlist backend:** set `config.waitlistEndpoint`. It receives a `POST` with JSON `{ email, path }`. When it is empty, sign-ups are only saved to `localStorage`.
- **First-paint gradient:** `index.html`. Keep it in sync with chapter 1's palette.
- **Adding a chapter:** extend `Stage` (`src/stages/Stage.js`), set `progress` from 0 to 1, call `complete()`, and register the stage in `Experience`.

## Architecture

```
src/
  core/Experience.js    renderer, post stack, chapter state machine, UI wiring
  core/StageMixPass.js  renders the active stage, or dissolves between two
  core/FinishPass.js    vignette, grain, chromatic fringe
  core/Input.js         wheel/touch/keys/pointer → scroll, pointer and hold events
  core/Audio.js         Web Audio synth: ambient pads and sound effects
  stages/*              one scene and camera per chapter
  ui/*                  loader, HUD, hold button, narrative, waitlist, hub card, no-WebGL fallback
  utils/*               math, canvas textures, GLSL noise, backdrop
```

Without WebGL2, the page falls back to a static, readable version of the story that still includes the waitlist. Reduced-motion preferences are honoured.
