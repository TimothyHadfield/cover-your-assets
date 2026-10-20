// Online adapter tests: the game wrapper online.js runs, secrecy of what gets published, and local rooms.
import { createRequire } from "node:module";
import { createLocal } from "../js/online.js";
import { makeGame } from "../js/game.mjs";
const require = createRequire(import.meta.url);
const E = require("../js/engine.js"), AI = require("../js/ai.js"), T = require("./helpers.js");
const game = makeGame(E, AI);

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const VARIANTS = [
  { edition: "classic", format: "quick" },
  { edition: "classic", format: "million" },
  { edition: "e2021", format: "quick" },
  { edition: "e2021", advanced: true, format: "quick" },
  { edition: "e2021", draft: true, format: "quick" },
  { edition: "e2021", advanced: true, draft: true, format: "three" },
  { edition: "classic", teams: true, format: "quick" },
  { edition: "classic", format: "bestof2" },
];
const LV = ["easy", "medium", "hard"];

// 1. Bot-only games through the wrapper, every variant, 2-6 players.
let games = 0, moves = 0, badState = 0, emptyToAct = 0, notJson = 0, lost = 0, bad = 0;
const t0 = Date.now();
for (let g = 0; g < 24; g++) {
  const rng = mulberry(g + 1);
  const opt = Object.assign({}, VARIANTS[g % VARIANTS.length]);
  let n = 2 + (g % 5);
  if (opt.draft) n = 2 + (g % 2);
  if (opt.teams) n = g % 2 ? 4 : 6;
  opt.levels = Array.from({ length: n }, (_, i) => LV[(g + i) % 3]);
  const seats = Array.from({ length: n }, (_, i) => ({ kind: i === 0 ? "human" : "computer", name: "S" + i }));
  let s = game.setup(n, opt, rng, seats);
  let guard = 0;
  while (!game.isOver(s) && guard++ < 5000) {
    const ta = game.toAct(s);
    if (!ta.length) { emptyToAct++; break; }
    const seat = ta[0];
    const ctx = { pub: game.publicView(s), mine: game.privateView(s, seat), state: s };
    let a;
    try { a = game.bot(ctx, seat, rng); s = game.apply(JSON.parse(JSON.stringify(s)), seat, a); moves++; }
    catch (e) { bad++; console.log("  bot move failed:", e.message, JSON.stringify(opt)); break; }
    if (JSON.stringify(JSON.parse(JSON.stringify(s))) !== JSON.stringify(s)) notJson++;
    if (s.phase !== "roundEnd" && s.phase !== "gameOver" && !T.conserved(E, s)) lost++;
  }
  if (game.isOver(s)) games++; else badState++;
}
console.log("  part 1: " + moves + " moves in " + (Date.now() - t0) + " ms");
T.eq(bad, 0, "bot moves chosen from the public view + own hand are always legal");
T.eq(games, 24, "24 bot-only games (8 variants x3, 2-6 players) all reach game over");
T.eq(emptyToAct, 0, "someone is always due to act before the game ends");
T.eq(notJson, 0, "state survives JSON round trip");
T.eq(lost, 0, "no card lost or duplicated");
T.ok(moves > 800, "plenty of moves played (" + moves + ")");

// 2. Secrecy: swapping a hand card with a draw-pile card must not change the public view,
//    and seat j's private view never shows seat i's cards.
let leaks = 0, privLeaks = 0, checked = 0;
for (let g = 0; g < 40; g++) {
  const rng = mulberry(500 + g);
  const n = 2 + (g % 5);
  const opt = Object.assign({}, VARIANTS[g % VARIANTS.length], { levels: Array(n).fill("medium") });
  const N = opt.draft ? 2 + (g % 2) : opt.teams ? 4 : n;
  let s = game.setup(N, opt, rng, []);
  for (let k = 0; k < 6 + g && !game.isOver(s); k++) {
    const seat = game.toAct(s)[0];
    s = game.apply(s, seat, game.bot({ pub: game.publicView(s), mine: game.privateView(s, seat), state: s }, seat, rng));
  }
  if (game.isOver(s) || s.phase === "roundEnd") continue;
  for (let i = 0; i < N; i++) {
    if (!s.hands[i].length || !s.draw.length) continue;
    const s2 = JSON.parse(JSON.stringify(s));
    // swap with a draw card of a different type so the change is real
    const h = s2.hands[i][0], j = s2.draw.findIndex((d) => s2.cards[d].type !== s2.cards[h].type);
    if (j < 0) continue;
    s2.hands[i][0] = s2.draw[j]; s2.draw[j] = h;
    checked++;
    if (JSON.stringify(game.publicView(s)) !== JSON.stringify(game.publicView(s2))) leaks++;
    for (let o = 0; o < N; o++) if (o !== i && JSON.stringify(game.privateView(s, o)) !== JSON.stringify(game.privateView(s2, o))) privLeaks++;
  }
}
T.ok(checked > 40, "secrecy checked on " + checked + " mid-game positions");
T.eq(leaks, 0, "public view is identical whatever cards are in hands");
T.eq(privLeaks, 0, "a seat's private view never depends on another seat's hand");
{
  const s = game.setup(4, { levels: [] }, mulberry(3), []);
  const pub = game.publicView(s);
  T.ok(pub.hands.every((h) => typeof h === "number"), "public view gives hand sizes only");
  T.ok(typeof pub.draw === "number" && pub.rng === undefined, "public view hides the draw order and the shuffle seed");
  T.eq(Object.keys(game.privateView(s, 1)), ["hand"], "private view is just the hand");
  const v = game.seatView(pub, game.privateView(s, 2), 2), w = E.view(s, 2);
  w.hands[2] = w.hands[2].slice().sort((a, b) => a - b);
  T.eq(v, w, "seat view rebuilt from public + private equals the engine's own view");
}

// 3. Turn checks.
{
  const s = game.setup(3, { levels: [] }, mulberry(9), []);
  const t = game.toAct(s)[0], other = (t + 1) % 3;
  let threw = false;
  try { game.apply(s, other, { t: "discard", card: s.hands[other][0] }); } catch (e) { threw = true; }
  T.ok(threw, "a seat that is not due to act is refused");
  threw = false;
  try { game.apply(s, t, { t: "discard", card: s.hands[other][0] }); } catch (e) { threw = true; }
  T.ok(threw, "discarding a card you don't hold is refused");
}

// 4. Local rooms through online.js itself.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function runRoom(seats, options) {
  const room = createLocal({ game, seats, options, botDelayMs: 0, names: ["You"] });
  let last = null, errors = 0;
  room.on("change", (snap) => { last = snap; });
  room.on("error", () => { errors++; });
  room.start();
  const rng = mulberry(77);
  for (let k = 0; k < 20000 && (!last || last.status !== "finished"); k++) {
    if (last && last.myTurn) {
      const seat = last.mySeat;
      room.act(game.bot({ pub: last.pub, mine: last.mine }, seat, rng), seat);
    }
    await wait(0);
  }
  return { last, errors };
}
{
  const r = await runRoom(["computer", "computer", "computer", "computer"], { format: "quick", levels: ["hard", "medium", "easy", "hard"] });
  T.eq(r.last && r.last.status, "finished", "all-computer local room plays to the end");
  T.eq(r.errors, 0, "no errors in the all-computer room");
}
{
  const r = await runRoom(["human", "computer", "computer"], { format: "quick", edition: "e2021", advanced: true });
  T.eq(r.last && r.last.status, "finished", "local room with one person (advanced rules) plays to the end");
  T.eq(r.errors, 0, "no errors in the one-person room");
  T.ok(r.last && r.last.pub.phase === "gameOver" && r.last.pub.winner, "finished room shows a winner");
}
T.done("online");
