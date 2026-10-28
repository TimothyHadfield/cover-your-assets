# Cover Your Assets — progress

## START HERE
Read this file, then `CLAUDE.md`, then `docs/rules-check.md` and `docs/ideas.md`. Last updated 2026-10-28 (wave 3, build 5).

## Goal right now
Phase-2 games project: exact rules, play vs computers or online players, hint, odds, real-table tracker, data lab, original art. Built and live; waiting on Tim's feedback.

## Status
| Part | State |
|---|---|
| Wave-3 kit sweep (pwa build 6, 2026-10-28) | Done. game-coach 1.2.0 (offer `place:'auto', avoid:['#hand']`) + game-pwa 1.4.0; offer had covered the tab bar + hand (393: 14040 px² / 9006 px²), now clear of both at 393×659/320×568/659×393; Settings 320 no sideways scroll; Lab + Table selects use `background-color` inline so they keep the dark-select arrow. |
| Rules engine (classic 110-card deck, 2021 deck, advanced, 2-3p draft, teams house rule, 4 game lengths) | Done, 92 engine tests + 28 edge tests (`tests/edge.test.js`) |
| Edge pass (2026-10-20) | Done: 48 weird scenarios, 12 failed on live, 12 fixed. See "Edge scenarios" below |
| Computers easy / medium / hard (dollar-EV scorer) | Done; measured in Lab (hard 92% vs 3 medium, 4p) |
| Hint, Coach, odds chips (steal %, top-set risk, discard gift risk) | Done |
| Table tab (real-table score and stack tracker) | Done |
| Lab tab (fight calculator + simulation charts) | Done |
| Online rooms (shared Firebase `online.js`, gameId `cover-your-assets`) | Done; two-browser game played to the end on 2026-10-19 |
| Art: original SVG faces, back, icons | Done |
| Visual design pass (2026-10-20) | Done: bigger stacks/piles, turn glow on your area, labelled challenge lanes, 40px taps, compact Table rows, 2-column laptop Settings, fits 1280x720 |
| Sounds, celebrations, animations (2026-10-20) | Done: `js/fx.js` (copy of `_fx/fx.js`, never edit) + `js/sfx.js` (event diff → cues) + Settings "Sound & effects"; `tests/fx.test.js` |
| Visibility pass (2026-10-27) | Done: opponents' seats take all spare height and `towerW()` (js/app.js) sizes each tower to its seat; "top $X" (what a challenge wins) shown on every screen at 12px+; laptop: your stack beside your hand; phone: message beside deck/discard, bigger discard (76px); challenge/draft panel sits above your hand (compact form when short). Gates: scratchpad `vis/cover-your-assets/check.mjs` (107 fails on old build, 0 now) |
| Improvement pass (2026-10-27, build 3) | Done: faces on every name plate (`avatar()` in js/art.js, smile after a steal / frown when robbed; hidden at 6 players on phone), Undo vs computers (not in the Daily, not with 2+ humans), end-of-game summary + Review (game log), My stats via kits `js/profile.js` + `js/cyaprofile.js` (Elo easy 1200 / medium 1610 / hard 2230, 10 achievements, Daily = 3 Medium, classic, to $1M, same deal for all), guided first game (`js/coach.js` + `js/cyacoach.js`, seed 9, never counts), home-screen install + offline (`sw.js`, `js/pwa.js`, manifest, icons). Hint/Undo = unrated; quit after a move = loss; never-moved games record nothing. AI unchanged (ladder already holds: H 92% vs 3M, M 78% vs 3E). Tests: `tests/profile.test.js` (19), `tests/pwa-check.json` (18/18 WebKit) |
| Wave 3 (2026-10-28, build 5) | Done: **Pick advanced rules one by one** (official 2021 rulebook p.10: "try adding one or all of these optional rules"): 5 sub-switches under Advanced in Settings (6-card hand, 2 actions, Improve, Swap/Move/Penny Jar, Steal the 2nd set), engine `cfg.advOff` + `E.adv(st,k)`; old saves/rooms without advOff = all on; online rooms carry it. Ladder with each rule alone (400 games, 4p, e2021): H v 3M 86-93%, M v 3E 51-90%, E v 3M 1-9%, M v 3H 0-1%. **Videos** in Rules (4, oembed-checked). **6 players on phone**: faces back, 17px beside the fanned backs (`.ohand .av`, tight mode only). Log said "stole You's"; now "your". Tests `tests/advpick.test.js` (15; failed first on the old engine) |
| Real-table look (2026-10-20, commit 2ebe5e5) | Done: Play tab is a wood kitchen table (`css/table.css` + `js/table.js` = byte copies of `_table`, never edit). Poker-ratio cards (63/88) with engraved per-asset border colours (`FRAME` in `js/art.js`); stacks = criss-cross towers of the last 6 sets (seeded tilt); opponents = name plate + fanned backs (real hand size) + tower, outer seats lowered/turned on laptop; draw pile thins (stackShadow .15/card); discard = last 4 cards askew; hand = fan (`TABLE.fanLayout`), card size capped by the row height; draws fly face-down from the deck then turn up; challenge panel on a wood mat; round totals on a paper score pad; landscape phone and SE-size layouts. fx.js re-copied at 1.0.3 (`data-fxspeed`; game Speed untouched, checked) |

## Event → sound map (js/sfx.js; others' moves at 0.8 volume)
| Event (log entry) | Sound | Animation |
|---|---|---|
| New game / round dealt | shuffle, then 3× cardDeal | hand cards slide in (existing) |
| Pair / Add to top | place + coins (coin for add) | your cards fly hand → stack; "+$X" float; your total counts up |
| Pair with discard | cardDeal + place + coins | hand card + discard fly to stack |
| Discard | cardFlip | your card flies to the discard |
| Card drawn from deck (any player) | cardDeal per card (max 3) | — |
| Challenge (incl. draft offer) | stamp | fight panel's set shakes |
| Answer in a fight | place (pitch 0.9) | new card enters (existing) |
| Give up | miss | — |
| Defender keeps it | capture | defender's stack pops, "Kept $X" |
| Set stolen | whoosh, coins | set flies fight panel → thief's stack; "+$X"; if yours: your stack shakes + red flash, total counts down |
| Swap / Move | whoosh / slide | stacks pop |
| Draft | cardDeal + coins | "+$X" |
| Swap/Move card flips up | cardFlip (+ whoosh / shuffle) | — |
| Round over | coins | Total column counts up |
| Becomes YOUR turn | turn (alerts) | "Your turn" pulses |
| Illegal tap (not your turn, cards that don't pair, wrong target) | error (alerts) | tapped thing shakes |
| Hand card tapped | tap (ui) | — |
| Steal or defend a set ≥ $100K (you) | celebrate big | sparkles at your stack |
| Game over | celebrate win (you/your team, or any person on this phone) / lose | confetti in money colours |

## Edge scenarios (2026-10-20)
48 tested (35 UI in WebKit, 10 engine, online room, odd layouts). Failed on live and fixed:
| Scenario | Was | Now |
|---|---|---|
| 6 players on phone | names cut to 1 letter | name over money, ellipsis |
| Pass-and-play hand-off | next hand face-up behind cover, odds leaked on laptop, cover lost on reload | face-down hand, odds hidden, cover restored |
| Same game in two tabs | two diverging games | background tab adopts the newer save |
| Tie at the top | no explanation | "Tied at the top: one more round decides it." (`E.extraRound`) |
| Two players same name | identical | "Ann 2" |
| ? tip then Back | tip stayed | closes |
| Empty stack spot | off-centre | centred |
| ×N badge | covered the card picture | on the card corner |
| $1,005,000 | "$1.00M" | "$1.005M" |
| Tracker End round x2 / deck switch | banked empty round / NaN | toast / no NaN |
Passed already: double taps, reloads mid-fight, Back, settings mid-game, blocked storage, light mode, empty deck, 320/landscape/zoom 200%/1920, animations off, 25-card hand, draft offer on SE, every variant computer-only. Scripts and screens: 10-20 scratchpad `edge/cover-your-assets/` (not in repo).

## Standing instructions (Tim's words)
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game."
- "Make sure to get everything right like rules and artwork and specific numbers of cards, routes, details, etc."
- "Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer"
- (2026-10-20) "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered."

- (2026-10-20) "make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life ... Make the decks look like actual decks ... It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)."

- (2026-10-20) "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird."

- (2026-10-21) "for a lot of the games the cards or board layout is too small to easily see what's going on ... Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense in what's happening and if the user can reasonably see it."

## Traps
- **Kits re-copied 2026-10-27 (kitfix):** game-coach 1.1.0 (rules tabs wrap in the kit now, so the style.css `.coach-rules-nav` override is redundant but harmless; a note beside a tall target keeps title + 2 lines + buttons) and game-pwa 1.3.0 (`data-extra` on the pwa.js tag caches files loaded later by script). Copies stay byte-identical to `../_coach` / `../_pwa`.
- **online.js cache stamp (2026-10-27):** every import of `js/online.js` uses `?v=a3d0418b`, the `_online` content stamp. After a re-copy: put the new stamp from `node ../_online/tools/stamp.mjs` there, bump the importing file's `?v=` (and pwa.js `data-version`), then `node ../_online/tools/stamp.mjs --check .` must say OK.
- Opponent seats are sized AFTER the rest of the table renders (`renderOpps` runs last in `render()`, measures the seat, redraws if `towerW` changes). Keep that order.
- Playwright `click()` waits for animations, so computers move meanwhile; for timing tests click in-page (`el.click()`).
- Pass-and-play (2+ people on one device): the "I'm X" cover shows at load and on reload; tests must click it first.
- `.empty-stack.tbl-spot`: `inset:auto` must come before `left/top` or it cancels them.
- Never use class `top` on table elements: `.top` is the header bar (it drew a stray line under stacks once).
- Hand cards are positioned by `--x/--y/--r` in `transform`; animate them with `translate`/`rotate` properties (see `handIn`, `turnUp`), never `transform`, or they snap to the left.
- Playwright `tap()` on hand cards times out (live before and after this change); `click()` works. Not seen on a real phone yet.
- Headless WebKit on Windows is slow (~85 ms per render). Use `speed: "test"` in `cya.settings` for full-game screenshots.
- WebKit ignores colours on native `<select>`; the global `appearance: none` rule at the end of `css/style.css` fixes it.
- Online room creation takes 10-40 s the first time (Firebase SDK lazy-load + anonymous sign-in). Once saw 403s on create that went away on retry.
- Online: the host's browser runs the computers; if the host closes the tab, another online person takes over after ~75 s.
- Laptop sizes are set in two places: CSS `@media (min-width:900px)` (+ a `max-height:819px` block for short screens) AND `js/app.js` (hand `cw`, stack `w` use `innerHeight < 820`). Change both together.
- Local test servers: other builders use common ports (8731 served Ticket to Ride on 10-20). Check the page title before trusting screenshots.
- Design-pass screenshot fixtures (mid-game, battle, round end) came from a seeded AI run; script was in the 10-20 scratchpad, not the repo.
- `privateView` must stay sorted and small (quota). Public view = `E.view(state, -1)`.
- Effects are driven by diffing the view in `render()` (`fxPrev`); a new host (new game, reload, room) resets it so nothing replays. Headless WebKit has no Web Audio and renders few confetti frames: check confetti with `--engine chrome`.

- **Advanced rules are opt-out per rule** (`cfg.advOff`, keys hand/two/improve/cards/second). Never test `cfg.advanced` alone for a single rule: use `E.adv(st, key)`. All five off = advanced off. The lockout rule and discard-first refill belong to "two".
- Local test server: port 47613 was serving another game (Bank) on 10-28; check `<title>` first.

## Decisions
- Two decks: Classic (2011-2018) default, New (2021+) with Speed Boat and advanced cards. Newest-printing names not modelled.
- Teams = labelled house rule (no published source).
- Lab "Which sets get stolen?" = share of sets stolen at least once (fixed 10-20; it used to divide steals by sets, up to 113%). Sim bookkeeping lives in `tools/lab-stats.js`; `tests/lab.test.js` guards it.
- Online: round-end "Next round" is pressed by the lowest person seat; computers do it if no person is left.
- Online computers use the per-seat levels from Settings (`options.levels`).

## NOT verified
- 2021 deck card names/values per tier: single source (King Panda Games).
- Real iPhone (only Safari's engine headless at 393 px).
- Online with 3+ real people and host takeover (shared layer has its own emulator tests).
- Sounds never heard (no audio headless); real iPhone sound + feel unchecked. Online effects only reasoned (same view diff), not run in two browsers.
- Design pass: online lobby, offer/pick overlays and draft piles not re-screenshotted (CSS shared with checked screens).
- Edge pass: draft piles, teams 4/6, 6 players and online lobby + table now screenshotted (phone, localhost). Table-look reviewer ran; its layout ideas (challenge panel covering the hand on phone, app-like count badges, score-pad style, laptop empty band) left for Tim. Two-tab sync tested only in one headless browser context.
- Real-table look (old note): deal flight frames not captured; deal flight frames not captured (headless too fast/slow), only "no leftover ghosts, no errors". The required reviewer agent could not run (subagent limit hit twice); self-reviewed instead. Real card layout details beyond "engraved border, per-type colour, name + value" not found online.

- Visibility pass: 6-player opponents' cards on 320 px and sideways phones stay ~24-26 px (the "top $X" label carries the value); the challenge panel still covers the seats (phone, laptop) and ~30% of the hand on a sideways phone. Steal taps checked by script (WebKit + Chromium, 393/320/1280), not on a real iPhone.

- Improvement pass: avatar faces' look, coach steps and install/offline only checked headless (WebKit 393/1280), not on a real iPhone. `.gitattributes` (shared) not updated with -text for the new kit files.

- Wave 3: per-rule advanced picks, videos and 6-player phone faces checked headless only (WebKit 393/320/659x393/1280/1440). Sources for "house rules" beyond the rulebook (Safe Top, No Wilds Round) look like SEO filler, so none were built.

## Rejected / parked
- ~~House rules "Safe Top token", "No Wilds round", "Quick draft"~~ only on low-quality SEO pages (officialgamerules.org), no real source (2026-10-28).
- ~~Practical settings additions~~ speed, sound/effects, remembered setup and per-seat levels already exist; no real gap found (2026-10-28).
- ~~Card-counting overlay~~ duplicate of unseen grid. ~~Bluff model~~ no human data. ~~Newest-printing deck~~ values unknown. See `docs/ideas.md`.
