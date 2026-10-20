# Cover Your Assets — chat log

## 2026-10-19 — build (phase 2 games brief)
- **Asked:** add Cover Your Assets with exact deck/rules, play vs computers and online, hint, odds, table tracker, data ideas, original art.
- **Built:** engine (classic + 2021 decks, advanced, draft, teams house rule, 4 formats), easy/medium/hard computers, hint + coach, odds chips, Table tab, Lab tab, online rooms via shared `online.js`, original SVG art, icons.
- **Verified:** `npm test` (engine 92, ai 4, online 20) with mutation checks (Home count, nest egg, refill order, AI strength, leaky public view all caught). Phone 393 px + laptop screenshots of every tab, zero console errors, no overflow. Full 3-player $1M game to the end in WebKit. Two separate browsers played a full online game to the end, including a mid-game reload of the guest.
- **QA pass (fresh agent, live URL):** found a 6-card hand overflowing at 393 px after Start new game, long names pushing opponent card counts out, and no button for "pair with the discard". All three fixed and rechecked at 393 px (board 393 px wide, 58 px cards; "Pair discard $40K" button pairs). Passed: every tab, odd/HTML names, all variants, bad room codes, back button, reload mid-game, two-browser online game with guest reload, leave/close.
- **Open:** Tim's feedback; 2021 deck second source.
