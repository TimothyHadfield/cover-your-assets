# Cover Your Assets — project rules

Static GitHub Pages site: https://timothyhadfield.github.io/cover-your-assets/ · repo TimothyHadfield/cover-your-assets.
Tim's global rules apply. Read `progress.md` first.

- $0, no build step, no dependencies. Plain scripts (UMD: node + `window.CYA*`), one ES module pair for online (`js/net.js` → `js/game.mjs` + `js/online.js`).
- `js/online.js` is a copy of `Board and Card Games/_online/online.js`. Never edit it here; re-copy when the shared one changes.
- Engine is pure: `apply(state, action)` → new state; `view(state, seat)` hides secrets. All randomness from `st.rng`.
- Tests: `npm test` (engine, ai, online; ~1.5 min). Each test was shown failing on a deliberately broken engine.
- Lab numbers come from `node tools/lab-data.js 1` (~6 min) → `js/lab-data.js`. Rerun after changing the AI.
- No copyrighted art or rulebook text: art is original SVG in `js/art.js`; rules in our own words. Sources in `docs/rules-check.md`.
- Commit with explicit paths. Never write inside a `.claude` folder.
