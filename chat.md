# Cover Your Assets — chat log

## 2026-10-19 — build (phase 2 games brief)
- **Asked:** add Cover Your Assets with exact deck/rules, play vs computers and online, hint, odds, table tracker, data ideas, original art.
- **Built:** engine (classic + 2021 decks, advanced, draft, teams house rule, 4 formats), easy/medium/hard computers, hint + coach, odds chips, Table tab, Lab tab, online rooms via shared `online.js`, original SVG art, icons.
- **Verified:** `npm test` (engine 92, ai 4, online 20) with mutation checks (Home count, nest egg, refill order, AI strength, leaky public view all caught). Phone 393 px + laptop screenshots of every tab, zero console errors, no overflow. Full 3-player $1M game to the end in WebKit. Two separate browsers played a full online game to the end, including a mid-game reload of the guest.
- **Open:** Tim's feedback; 2021 deck second source.
