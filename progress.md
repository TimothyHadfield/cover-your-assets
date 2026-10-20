# Cover Your Assets — progress

## START HERE
Read this file, then `CLAUDE.md`, then `docs/rules-check.md` and `docs/ideas.md`. Last updated 2026-10-20 (visual design pass).

## Goal right now
Phase-2 games project: exact rules, play vs computers or online players, hint, odds, real-table tracker, data lab, original art. Built and live; waiting on Tim's feedback.

## Status
| Part | State |
|---|---|
| Rules engine (classic 110-card deck, 2021 deck, advanced, 2-3p draft, teams house rule, 4 game lengths) | Done, 92 engine tests |
| Computers easy / medium / hard (dollar-EV scorer) | Done; measured in Lab (hard 92% vs 3 medium, 4p) |
| Hint, Coach, odds chips (steal %, top-set risk, discard gift risk) | Done |
| Table tab (real-table score and stack tracker) | Done |
| Lab tab (fight calculator + simulation charts) | Done |
| Online rooms (shared Firebase `online.js`, gameId `cover-your-assets`) | Done; two-browser game played to the end on 2026-10-19 |
| Art: original SVG faces, back, icons | Done |
| Visual design pass (2026-10-20) | Done: bigger stacks/piles, turn glow on your area, labelled challenge lanes, 40px taps, compact Table rows, 2-column laptop Settings, fits 1280x720 |

## Standing instructions (Tim's words)
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game."
- "Make sure to get everything right like rules and artwork and specific numbers of cards, routes, details, etc."
- "Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer"

## Traps
- Headless WebKit on Windows is slow (~85 ms per render). Use `speed: "test"` in `cya.settings` for full-game screenshots.
- WebKit ignores colours on native `<select>`; the global `appearance: none` rule at the end of `css/style.css` fixes it.
- Online room creation takes 10-40 s the first time (Firebase SDK lazy-load + anonymous sign-in). Once saw 403s on create that went away on retry.
- Online: the host's browser runs the computers; if the host closes the tab, another online person takes over after ~75 s.
- Laptop sizes are set in two places: CSS `@media (min-width:900px)` (+ a `max-height:819px` block for short screens) AND `js/app.js` (hand `cw`, stack `w` use `innerHeight < 820`). Change both together.
- Local test servers: other builders use common ports (8731 served Ticket to Ride on 10-20). Check the page title before trusting screenshots.
- Design-pass screenshot fixtures (mid-game, battle, round end) came from a seeded AI run; script was in the 10-20 scratchpad, not the repo.
- `privateView` must stay sorted and small (quota). Public view = `E.view(state, -1)`.

## Decisions
- Two decks: Classic (2011-2018) default, New (2021+) with Speed Boat and advanced cards. Newest-printing names not modelled.
- Teams = labelled house rule (no published source).
- Online: round-end "Next round" is pressed by the lowest person seat; computers do it if no person is left.
- Online computers use the per-seat levels from Settings (`options.levels`).

## NOT verified
- 2021 deck card names/values per tier: single source (King Panda Games).
- Real iPhone (only Safari's engine headless at 393 px).
- Online with 3+ real people and host takeover (shared layer has its own emulator tests).
- Lab "Which sets get stolen?" shows rates over 100% (e.g. Auto 113%): label says "share of sets", so either the label or the number is off. Not touched in the design pass.
- Design pass: online lobby, offer/pick overlays and draft piles not re-screenshotted (CSS shared with checked screens).

## Rejected / parked
- ~~Card-counting overlay~~ duplicate of unseen grid. ~~Bluff model~~ no human data. ~~Newest-printing deck~~ values unknown. See `docs/ideas.md`.
