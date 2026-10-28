# Cover Your Assets — chat log

## 2026-10-19 — build (phase 2 games brief)
- **Asked:** add Cover Your Assets with exact deck/rules, play vs computers and online, hint, odds, table tracker, data ideas, original art.
- **Built:** engine (classic + 2021 decks, advanced, draft, teams house rule, 4 formats), easy/medium/hard computers, hint + coach, odds chips, Table tab, Lab tab, online rooms via shared `online.js`, original SVG art, icons.
- **Verified:** `npm test` (engine 92, ai 4, online 20) with mutation checks (Home count, nest egg, refill order, AI strength, leaky public view all caught). Phone 393 px + laptop screenshots of every tab, zero console errors, no overflow. Full 3-player $1M game to the end in WebKit. Two separate browsers played a full online game to the end, including a mid-game reload of the guest.
- **QA pass (fresh agent, live URL):** found a 6-card hand overflowing at 393 px after Start new game, long names pushing opponent card counts out, and no button for "pair with the discard". All three fixed and rechecked at 393 px (board 393 px wide, 58 px cards; "Pair discard $40K" button pairs). Passed: every tab, odd/HTML names, all variants, bad room codes, back button, reload mid-game, two-browser online game with guest reload, leave/close.
- **Open:** Tim's feedback; 2021 deck second source.

## 2026-10-20 — visual design pass
- **Asked (Tim):** "review them again for design improvements especially visually".
- **Built:** opponent/own stacks and piles bigger; "Your turn" in warm bold + warm glow on your stack area; challenge overlay shows two labelled lanes (Cat vs You, empty slot placeholder) and sits at the top on phone so the hand stays visible; buttons 42px, small 36px, ? hit areas 40px; risk-chip ? visible; Settings selects got their arrows back (CSS bug); Table rows 3 lines, hidden-cards in one row on phone, 2 columns on laptop; laptop Settings in 2 columns; laptop hand 124px cards, stack+hand centred; short laptops (<820px tall) get smaller sizes; active tab in accent colour; log says "challenged your Piggy" instead of "You's".
- **Verified:** `npm test` (92/4/20 pass). Before/after phone-view shots of 9 states at 393 px and 1440x900, plus 1280x720 and 1366x768 with no overlap (measured piles/msg/stack boxes), zero console errors, no horizontal overflow. One read-only reviewer agent ranked the problems first.
- **Then fixed (coordinator ask):** the Lab stolen chart divided steal events by sets made, so a set stolen twice counted twice (Auto 113%). The label was right; the number was wrong. Now it counts each set once: shares 40-60%. New `tests/lab.test.js` fails on the old shipped data (auto 113%, jewels 112%, home 108%) and on a mutation that drops the game number from the set key (370 vs 1370). Lab data regenerated; only the stolen rows changed.

## 2026-10-20 — sounds, celebrations, animations (fx brief)
- **Asked (Tim):** "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered."
- **Built:** `js/fx.js` (byte copy of `_fx/fx.js`), `js/sfx.js` (log/draw/turn diff → cues; same in local, hot-seat, online), wiring in `js/app.js`, "Sound & effects" block in Settings (column 1, under Start new game), CSS so its rows/switches match the existing ones. Event→sound map in progress.md.
- **Verified:** `tests/fx.test.js` (25 checks) failed first (no mapping module), then passes; mutation of stamp/win mappings caught. `npm test` all green. phone-view 393 px + 1440 desktop: Settings, mid-game (float "+$40K"), win screen ("You win!", totals count up, confetti; confetti only spreads in Chrome engine, headless WebKit renders few frames). Full auto game at test speed: no console errors, 0 leftover ghosts.
- **Open:** real iPhone sound check.

## 2026-10-20 — real-table look (table brief)
- **Asked (Tim):** make each game look "almost identical to how the board or card layout looks like in real life ... like you're looking through a camera that is connected to a user's glasses".
- **Built (2ebe5e5):** wood table surface, shared `_table` kit copied in, poker-ratio cards with engraved per-asset borders, criss-cross stack towers, opponents' name plates + fanned backs + towers (arc on laptop), deck that thins, messy discard, fanned hand, deck-to-hand deal flights with a 3-D turn, challenge on a wood mat, round totals on a paper score pad, SE and landscape phone layouts. fx.js re-copied (1.0.3). Research notes in the session scratchpad (`table/cover-your-assets/real.md`).
- **Verified:** `npm test` all green (engine 92, ai 4, lab 6, fx 25, online 20). Seeded fixtures (setup, mid, battle, late, round end, game over) screenshotted before/after in WebKit at 393x659 and 1280x800; plus 320x568, 659x393 and 1280x720: zero console errors, no page scroll, no horizontal overflow. Scripted discard → draw: card lifts on select, new card dealt, 0 leftover ghosts (WebKit + Chromium). Effects speed no longer touches game Speed. Live check: Pages serves 2ebe5e5, table renders.
- **Open:** reviewer agent couldn't run (subagent limit); draft/teams/6p/online not screenshotted.

## 2026-10-20 — edge pass (weird scenarios)
- **Asked (Tim):** "focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." Plus the missed table-look review.
- **Built:** read-only reviewer ran; fixed clipped 6-player names, off-centre empty spot, ×N badge over the art. Then 48 scenarios, 12 failed on live, all fixed: pass-and-play cover (face-down hand, no odds leak, survives reload), two tabs sync, tie explanation (`E.extraRound`), duplicate names numbered, tip closes on Back, $1.005M format, tracker double End round and deck-switch NaN.
- **Verified:** `tests/edge.test.js` (28 checks; failed first on `extraRound`), full `npm test` green, `ui-edge.mjs` U1–U35 in WebKit: 12 fail on live before, all pass local after; draft/teams/6p/online lobby screenshotted at phone, laptop, 320, landscape (no errors, no overflow).
- **Open (Tim's call):** reviewer's layout ideas (challenge panel over the hand on phone, app-like count badges, score-pad style, laptop empty band); wording of the tie line, "Ann 2", tracker toast.

## 2026-10-21 → 10-27 — visibility pass
- **Asked (Tim):** "the cards or board layout is too small to easily see what's going on ... Fix this so the view of what's happening and where everything is is very clear."
- **Built:** opponents' seats fill the spare height and towers are sized to fit (`towerW`, never smaller than the old size); "top $X" on every screen; laptop puts your stack beside your hand; phone puts the message beside the piles and enlarges the discard; challenge/draft panel sits above the hand (compact when short); 6-player names fit at 320 px.
- **Verified:** 60 seeded shots (12 states x 393/320/659-land/1280/1440, WebKit): gates `check.mjs` 107 fails before → 0, `nreg.mjs` (no card smaller than before) 28 fails on the unfinished build → 0. Steal taps + challenge buttons by script in WebKit and Chromium. `npm test` green. One reviewer agent; its "smaller than before" items fixed.
- **Open:** see NOT verified (6-player cards at 320/landscape, panel over seats).

## 2026-10-27 — improvement pass (build 3)
- **Asked (Tim):** "start building every single improvement you can think of after your competitor analysis" / "I want to make our boardgames the best in every single metric we can."
- **Built:** reacting faces on every seat, Undo vs computers, game-over summary + Review, My stats (Elo, 10 achievements, Daily game), guided first game, install + offline (kits profile 1.1.0, coach 1.0.0, pwa 1.2.0; fx.js re-copied). AI unchanged (ladder already holds).
- **Verified:** `npm test` green (engine 92, edge 28, ai 4, lab 6, fx 25, profile 19, online 20); scratchpad `ui.mjs` (WebKit 393 + 1280) passes every flow and times out on the old build; visibility gates leave 2 fails (the deliberately long 6p test name, accepted); PWA check 18/18.
- **Open (Tim's call):** achievement names, face designs, Daily setup, faces hidden at 6p on phone, button placement and wording.

## 2026-10-28 — wave 3 ("just make the games better")
- **Asked (Tim):** "Just make the games better" (layout, customization, practical settings, YouTube links, variations/house rules, iPhone layout).
- **Built:** advanced rules pickable one by one (the official rulebook calls them "optional rules... one or all"), Videos section in Rules (4 links), faces back at 6 players on phone (beside the fanned backs), log grammar fix ("You's" → "your"), short Advanced section in Rules.
- **Verified:** `tests/advpick.test.js` 15/15 (failed first on the old engine); full `npm test` green; ladder with each advanced rule alone holds (400 games each); pwa-check 18/18; WebKit shots 393/320/659x393/1280/1440, sub-switches clicked in the page and the new game's cfg read back (advOff, 104 cards, 6-card hand).
- **Skipped:** web "house rules" (no real source), practical settings (no gap).
- **Open (Tim's call):** sub-switch labels, face position at 6p on phone.

## 2026-10-28 — wave-3 kit sweep (pwa build 6)
- game-coach 1.2.0 + game-pwa 1.4.0 copied; first-visit offer `place:'auto'` avoiding the hand (it covered the tab bar and hand before, measured); Lab/Table select arrows restored. Verified: npm test all green (engine 92, edge 28, advpick 15, ai 4, lab 6, fx 25, profile 19, online 20), pwa-check 18/18, offer rects at 393/320/659×393, Settings 320 no overflow, select styles read in WebKit, 393 screenshot looked at.
