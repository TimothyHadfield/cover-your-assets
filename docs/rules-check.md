# Rules check: Cover Your Assets (Grandpa Beck's Games)

Every number the site uses, the sources it was checked against (2026-10-19), and what is still unverified.
The official rulebook PDF was not reachable online, so each fact is cross-checked across independent
rules write-ups and reviews instead. Tests in `tests/engine.test.js` assert every count below.

## Sources
| # | Source | What it gives |
|---|---|---|
| S1 | [Dice n Board game guide](https://dicenboard.com/game-guides/cover-your-assets-game-guide/) | Full classic card table (name, value, copies, total 110 / $1,360,000), turn options, nest egg, refill order |
| S2 | [The Board Game Family review (2019)](https://www.theboardgamefamily.com/2019/05/cover-your-assets-card-game-review/) | Copies per card (10 each, Home 8, Silver 8, Gold 4), "four $5K types, three $10K, two $15K, one $20K", deal 4 |
| S3 | [Geeky Hobbies review and rules](https://www.geekyhobbies.com/cover-your-assets-card-game-review-and-rules/) | Scoring example consistent with S1 values (4 Coins = $40K, 5 Piggy = $25K, 2 Stamps = $10K, 3 Auto = $45K, 4 Stocks = $40K); deal sizes; refill order; tie rule |
| S4 | [UltraBoardGames rules](https://ultraboardgames.com/cover-your-assets/game-rules.php) | Deal 4 (5 for 2-3 players), turn options, challenge rules, first set safe, round end, $1M, ties |
| S5 | [GameRules.com](https://gamerules.com/rules/cover-your-assets/) | 110 cards, 4-6 players, deal 4, turn options, challenges |
| S6 | [GeekDad review (2012)](https://geekdad.com/2012/12/cover-your-assets/) | 110 cards = 10 asset types + Gold/Silver; Cash Under the Mattress $5,000; deal 4 (5 for 2-3); first pair can't be stolen |
| S7 | [Learn New Games](https://www.learnnewgames.com/cover-your-assets/) | Deal 4 (5 for 2-3 players), first pair never stolen, round end, $1M in 3-5 rounds, one-round quick game |
| S8 | [RulesPal rulebook summary (current edition)](https://rulespal.com/cover-your-assets/rulebook) | New-edition rules: deal 5, classic/quick/three-round/best-of formats, Advanced rules, Penny Jar, Swap, Move, 2- and 3-player draft rules |
| S9 | [King Panda Games review](https://www.kingpandagames.com/cover-your-assets-review/) | 2021-edition card list (adds Speed Boat, 9 copies of six assets), Penny Jar $1K, advanced rules |
| S10 | [The Tabletop Family](https://thetabletopfamily.com/cover-your-assets/) | 110 cards, assets $5K-$20K, Silver $25K, Gold $50K, deal 4 |
| S11 | [Official 2021 rulebook PDF (Grandpa Beck's Games, 16 pages)](https://cdn.1j1ju.com/medias/55/96/c1-cover-your-assets-rulebook.pdf) | Read 2026-10-28. Advanced rules p.10: "try adding one or all of these optional rules" (6 cards, 2 actions, Improve / action cards, 2nd set challengeable); Penny Jar, Swap, Move p.11; 2p/3p draft p.12-15 |

## Classic deck (2011-2018 printings) - default
| Card | Value | Copies | Checked |
|---|---|---|---|
| Stamp Collection | $5,000 | 10 | S1, S2 (count), S3 (value) |
| Cash Under the Mattress | $5,000 | 10 | S1, S2, S6 (value) |
| Baseball Cards | $5,000 | 10 | S1, S2 |
| Piggy Bank | $5,000 | 10 | S1, S2, S3 |
| Stocks | $10,000 | 10 | S1, S2, S3 |
| Coin Collection | $10,000 | 10 | S1, S2, S3 |
| Bank Account | $10,000 | 10 | S1, S2 |
| Classic Auto | $15,000 | 10 | S1, S2, S3 |
| Jewels | $15,000 | 10 | S1, S2 |
| Home | $20,000 | 8 | S1, S2 |
| Silver (wild) | $25,000 | 8 | S1, S2, S10 |
| Gold (wild) | $50,000 | 4 | S1, S2, S10 |
| **Total** | **$1,360,000** | **110** | S1 total; S2/S5/S6/S10 say 110 |

S2's tier count (four $5K, three $10K, two $15K, one $20K type) independently matches S1.

## New deck (2021+ box) - "New (2021+)" in Settings
| Card | Value | Copies |
|---|---|---|
| Baseball Cards, Coin Collection, Piggy Bank | $5,000 | 10 each |
| Cash Under the Mattress, Bank Account, Stocks | $10,000 | 9 each |
| Speed Boat, Jewels, Classic Auto | $15,000 | 9 each |
| Home | $20,000 | 8 |
| Silver / Gold (wild) | $25,000 / $50,000 | 8 / 4 |
| Advanced only: Swap, Move (action), Penny Jar (wild, $1,000) | - | 2 / 2 / 2 |

104 cards for classic play + 6 advanced = 110 (S8 structure 10/10/10, 9x6, 8, 8, 4, 2/2/2 matches; names and values from S9).
**Single source (S9) for which names/values sit in each tier: NOT verified against a second source.**
S8 lists different asset names for what looks like the newest printing (Comic Books, Piano, Toy Train,
Scooter, Sport Plane, Cabin) with the same copy pattern; per-card values are not given there. Not modelled.

## Rules used by the engine
| Rule | Engine | Sources |
|---|---|---|
| 4-6 players best; 2-3 allowed | 2-6 players | S4, S5, S8 |
| Deal 4 (classic deck, 4+ players); 5 with 2-3 players | `normalizeCfg` | S4, S6, S7 (S3: 5 for 2 players) |
| New deck deals 5; Advanced holds 6 | `normalizeCfg` | S8 |
| Flip one card to start the discard; empty discard stays empty | `startRound` | S4, S5, S8 |
| Player left of dealer starts; deal rotates | `startRound` | S4, S8 |
| One action per turn: pair from hand, pair with top discard, challenge, or discard | `legal` | S1, S4, S5, S8 |
| A pair is two matching assets or asset + wild; two wilds never pair; never more than 2 | `pairOK` | S1, S3, S4, S8 |
| New set goes on top, crossed over the last | stack order (drawing alternates) | S4, S5, S8 |
| Challenger must own a set; target must have 2+ sets (bottom set / nest egg is safe) | `canChallengeAt` | S1, S3, S4, S6, S7, S8 |
| Only the top set can be challenged (classic) | `canChallengeAt` | S4, S6 |
| Challenge with a card matching the set or a wild; answers alternate; last card played wins the set and all cards played | `doBattle`/`finishBattle` | S1, S3, S4, S5, S8 |
| No drawing during a challenge; afterwards challenger refills first, then the defender | `endTurn` | S1, S3, S8 |
| Draw back up to hand size at end of turn | `refill` | S1, S4, S8 |
| Draw pile empty: keep playing without drawing; must discard if nothing else; round ends when all hands are empty | `advanceTurn`/`endRound` | S1, S4, S7, S8 |
| Score = face value of every card in your stack, kept across rounds | `endRound` | S1, S4, S7, S8 |
| First to $1,000,000 wins; two over it: higher total wins | `checkWinner` | S3, S4, S8 |
| Exact tie at the top: play another round | `checkWinner` | S4 (suggests "an extra round" among tie-breakers) |
| Formats: one round / three rounds / first to 2 round wins | `cfg.format` | S8 (one-round quick game also S4, S7) |
| Advanced: 6 cards, up to 2 actions, may stop after 1; discard first -> refill to 6 at once | `afterAction`, `doTurnAction` | S8, S9 |
| Advanced: Improve (add a matching asset, not a wild, to your top set) | `improve` | S8 |
| Advanced: 2nd set from top challengeable, opened with 2 cards (or a Penny Jar); then 1 card each | `openers(need=2)` | S8, S9 |
| Penny Jar counts as 2 cards in a fight; answered by 2 cards or another Penny Jar | `needAfter` | S8, S9 |
| Lost a challenge: can't challenge that player again this turn | `lockout` | S8 |
| Advanced rules may be added one at a time ("one or all of these optional rules"); Settings switches each off: 6-card hand, 2 actions (with discard-first refill), Improve, Swap/Move/Penny Jar cards, 2nd-set steals | `cfg.advOff`, `E.adv(st, k)` | S11 p.10 |
| Swap: trade top sets with anyone; Move: any stack's top to bottom or bottom to top; action cards leave play | `swap`/`move` | S8 |
| 2-player draft: remove 8 Home, 2 Silver, 1 Gold; 3 face-up draft piles of 10; deal 6 | `buildDeck`, `startRound` | S8 |
| Draft a Set: play a hand card matching draft-pile tops, collect the matching tops into one set; the opponent may challenge it | `draftActions`, `doOffer` | S8 |
| 3-player draft: one pile between each pair of players; draft only from your two piles; only that neighbour may challenge | `pilesFor`, `pileNeighbours` | S8 |
| Advanced 2-3p: action cards on top at setup go back into the middle; revealed later they act at once on the two players beside the pile | `fixSetupTop`, `resolveRevealed` | S8 |

## Reasoned choices (rule text is silent or ambiguous) - NOT verified
- **Teams**: no published team rules found in any source (searched twice). Built as a clearly labelled house rule: 4 or 6 players, partners across, no stealing from your partner, money added together.
- A wild in hand may pair with an asset on the discard, and an asset in hand may pair with a wild on the discard (S8: "pair with a Wild"); two wilds never.
- Draft: a wild on a pile top can be collected along with an asset from hand. You collect every usable top of the chosen asset type. Discard pile is not flipped in draft games.
- Draft challenges ignore the "own a set first" and nest-egg rules (the drafted set is fought over as it is claimed).
- After a two-card answer to a Penny Jar, the next answer needs one card again.
- Move flipped from a draft pile: each affected player chooses which way the other player's stack moves.
- Lockout applies only to the turn player's own challenges.
