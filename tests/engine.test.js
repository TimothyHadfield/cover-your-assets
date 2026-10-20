// node tests/engine.test.js
var R = require('../js/rules.js'), E = require('../js/engine.js'), O = require('../js/odds.js');
var T = require('./helpers.js'), ok = T.ok, eq = T.eq, near = T.near;

// ---------- deck facts (docs/rules-check.md) ----------
function countBy(deck) { var c = {}; deck.forEach(function (x) { c[x.type] = (c[x.type] || 0) + 1; }); return c; }
var classic = R.buildDeck('classic');
eq(classic.length, 110, 'classic deck has 110 cards');
eq(countBy(classic), { stamps: 10, cash: 10, baseball: 10, piggy: 10, stocks: 10, coins: 10, bank: 10, auto: 10, jewels: 10, home: 8, silver: 8, gold: 4 }, 'classic counts');
eq(classic.reduce(function (a, c) { return a + c.value; }, 0), 1360000, 'classic deck totals $1,360,000');
eq(R.valueOf('classic', 'home'), 20000, 'Home $20K'); eq(R.valueOf('classic', 'gold'), 50000, 'Gold $50K'); eq(R.valueOf('classic', 'silver'), 25000, 'Silver $25K');
eq(classic.filter(function (c) { return c.value === 5000; }).length, 40, 'four $5K types x10');
eq(classic.filter(function (c) { return c.value === 10000; }).length, 30, 'three $10K types x10');
eq(classic.filter(function (c) { return c.value === 15000; }).length, 20, 'two $15K types x10');
eq(classic.filter(function (c) { return c.kind === 'wild'; }).length, 12, '12 wilds');
var e21 = R.buildDeck('e2021'), e21a = R.buildDeck('e2021', { advanced: true });
eq(e21.length, 104, '2021 classic play uses 104 cards (action/penny removed)');
eq(e21a.length, 110, '2021 box has 110 cards');
eq(countBy(e21a).swap, 2, '2 Swap'); eq(countBy(e21a).move, 2, '2 Move'); eq(countBy(e21a).penny, 2, '2 Penny Jar');
eq(R.valueOf('e2021', 'penny'), 1000, 'Penny Jar $1K');
var two = R.buildDeck('e2021', { players: 2, draft: true });
eq(two.length, 93, '2-player draft deck removes 8 Homes, 2 Silver, 1 Gold');
eq(countBy(two).home, undefined, 'no Homes in 2-player'); eq(countBy(two).silver, 6, '6 Silver'); eq(countBy(two).gold, 3, '3 Gold');

// ---------- setup ----------
function setup(cfg) { return E.newGame(cfg, 42); }
var g4 = setup({ players: 4 });
eq(g4.hands.map(function (h) { return h.length; }), [4, 4, 4, 4], 'classic 4 players: deal 4');
eq(g4.discard.length, 1, 'one card flipped to start the discard');
eq(g4.draw.length, 110 - 16 - 1, 'rest is the draw pile');
eq(g4.turn, 0, 'player left of dealer (you) starts');
eq(setup({ players: 3 }).hands[0].length, 5, 'classic 2-3 players: deal 5');
eq(setup({ players: 5, edition: 'e2021' }).hands[0].length, 5, '2021 edition: deal 5');
eq(setup({ players: 4, edition: 'e2021', advanced: true }).hands[0].length, 6, 'advanced: deal 6');
var d2 = setup({ players: 2, edition: 'e2021', draft: true });
eq(d2.hands[0].length, 6, '2-player draft: deal 6');
eq(d2.piles.map(function (p) { return p.length; }), [10, 10, 10], 'three draft piles of 10');
eq(setup({ players: 3, edition: 'e2021', draft: true }).hands[0].length, 5, '3-player draft: deal 5');
ok(E.normalizeCfg({ players: 5, teams: true }).teams === false, 'teams only with 4 or 6');

// ---------- rig a position ----------
function rig(st, spec) {
  var pool = st.cards.map(function (c) { return c.id; });
  function take(type) { for (var i = 0; i < pool.length; i++) if (st.cards[pool[i]].type === type) return pool.splice(i, 1)[0]; throw new Error('no ' + type); }
  st.hands = spec.hands.map(function (h) { return h.map(take); });
  st.stacks = spec.stacks.map(function (k) { return k.map(function (set) { return { type: set[0], cards: set.map(take) }; }); });
  st.discard = (spec.discard || []).map(take);
  st.out = []; st.draw = pool; st.turn = spec.turn || 0; st.phase = 'turn'; st.acts = 0; st.used = []; st.lockout = []; st.battle = null;
  return st;
}
function find(L, pred) { for (var i = 0; i < L.length; i++) if (pred(L[i])) return L[i]; return null; }

// pairs
var st = rig(E.newGame({ players: 2 }, 1), { hands: [['home', 'gold', 'silver', 'stamps', 'cash'], ['piggy']], stacks: [[], []] });
ok(!E.pairOK(st, st.hands[0][1], st.hands[0][2]), 'two wilds never pair');
ok(E.pairOK(st, st.hands[0][0], st.hands[0][1]), 'asset + wild pairs');
ok(!E.pairOK(st, st.hands[0][3], st.hands[0][4]), 'different assets do not pair');
ok(!find(E.legal(st), function (a) { return a.t === 'challenge'; }), 'no challenge before you own a set');

// challenge needs your own set, and the target's bottom set is safe
st = rig(E.newGame({ players: 3 }, 2), {
  hands: [['jewels', 'stamps', 'cash', 'piggy', 'coins'], ['jewels', 'stamps', 'cash', 'piggy', 'coins'], ['auto', 'stamps', 'cash', 'piggy', 'coins']],
  stacks: [[['bank', 'bank']], [['jewels', 'jewels']], [['auto', 'auto'], ['home', 'gold']]]
});
ok(!find(E.legal(st), function (a) { return a.t === 'challenge' && a.target === 1; }), 'a player with one set is safe (bottom set)');
ok(!find(E.legal(st), function (a) { return a.t === 'challenge' && a.target === 2; }), 'need a matching card (home) or a wild to challenge');
st.hands[0][0] = st.stacks[2][1].cards.splice(0, 1)[0]; // give seat 0 the gold from target's set? keep it simple: rebuild instead
st = rig(E.newGame({ players: 3 }, 2), {
  hands: [['home', 'silver', 'cash', 'piggy', 'coins'], ['jewels', 'stamps', 'cash', 'piggy', 'coins'], ['home', 'stamps', 'cash', 'piggy', 'coins']],
  stacks: [[['bank', 'bank']], [['jewels', 'jewels']], [['auto', 'auto'], ['home', 'gold']]]
});
var ch = E.legal(st).filter(function (a) { return a.t === 'challenge'; });
eq(ch.length, 2, 'can open with the Home or with the Silver');
// battle: seat 0 opens with Home, seat 2 answers Home, seat 0 answers Silver, seat 2 has nothing -> seat 0 wins
var open = find(ch, function (a) { return st.cards[a.cards[0]].type === 'home'; });
st = E.apply(st, open);
eq(st.phase, 'battle', 'challenge starts a battle'); eq(E.toAct(st), 2, 'defender answers');
var ans = find(E.legal(st), function (a) { return a.t === 'play'; });
st = E.apply(st, ans);
eq(E.toAct(st), 0, 'back to the challenger');
var topDraw = st.draw[0];
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'play'; }));
ok(st.hands[0].indexOf(topDraw) >= 0 && st.hands[2].indexOf(topDraw) < 0, 'after a challenge the challenger draws first, then the defender');
eq(st.phase, 'turn', 'defender out of matches: battle ends');
eq(st.stacks[2].length, 1, 'stolen set left the defender');
var won = st.stacks[0][st.stacks[0].length - 1];
eq(won.cards.length, 5, 'winner gets the set plus every card played (2 + 3)');
eq(E.setValue(st, won), 20000 + 50000 + 20000 + 20000 + 25000, 'stolen pile value');
eq(st.turn, 1, 'turn passed on');
eq(st.hands[0].length, 5, 'challenger drew back up to 5');
eq(st.hands[2].length, 5, 'defender who used cards also drew back up');

// defender wins when the challenger folds
st = rig(E.newGame({ players: 2 }, 3), {
  hands: [['home', 'cash', 'cash', 'piggy', 'coins'], ['home', 'stamps', 'cash', 'piggy', 'coins']],
  stacks: [[['bank', 'bank']], [['auto', 'auto'], ['home', 'home']]]
});
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'challenge'; }));
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'play'; }));
eq(st.phase, 'turn', 'challenger with nothing left loses automatically');
eq(st.stacks[1][1].cards.length, 4, 'defender keeps the set and adds both played cards');
eq(st.stacks[0].length, 1, 'challenger gained nothing');

// refill order: player whose turn it was draws first
st = rig(E.newGame({ players: 2 }, 4), { hands: [['jewels', 'jewels', 'cash', 'piggy', 'coins'], ['home', 'stamps', 'cash', 'piggy', 'coins']], stacks: [[], []] });
var firstDraw = st.draw[0];
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'pair'; }));
ok(st.hands[0].indexOf(firstDraw) >= 0, 'turn player refills from the top of the draw pile');
eq(st.stacks[0][0].type, 'jewels', 'pair placed on the stack');

// pair with the top discard
st = rig(E.newGame({ players: 2 }, 5), { hands: [['auto', 'cash', 'cash', 'piggy', 'coins'], ['home']], stacks: [[], []], discard: ['stamps', 'auto'] });
var pd = find(E.legal(st), function (a) { return a.t === 'pairDiscard'; });
ok(pd && st.cards[pd.card].type === 'auto', 'can pair the top discard');
st = E.apply(st, pd); eq(st.discard.length, 1, 'took the top discard only');
// two wilds can't pair via the discard either
st = rig(E.newGame({ players: 2 }, 6), { hands: [['gold', 'cash', 'stamps', 'piggy', 'coins'], ['home']], stacks: [[], []], discard: ['silver'] });
ok(!find(E.legal(st), function (a) { return a.t === 'pairDiscard' && st.cards[a.card].kind === 'wild'; }), 'wild in hand + wild on discard is not a pair');

// teams (house rule): no stealing from your partner
st = rig(E.newGame({ players: 4, teams: true }, 7), {
  hands: [['home', 'cash', 'cash', 'piggy'], ['stamps'], ['stamps'], ['stamps']],
  stacks: [[['bank', 'bank']], [['auto', 'auto'], ['home', 'gold']], [['jewels', 'jewels'], ['home', 'silver']], []]
});
var tg = E.legal(st).filter(function (a) { return a.t === 'challenge'; }).map(function (a) { return a.target; });
ok(tg.indexOf(2) < 0 && tg.indexOf(1) >= 0, 'teams: seat 2 is your partner, seat 1 is fair game');

// advanced: penny jar must be answered with two cards (or a penny jar)
st = rig(E.newGame({ players: 2, edition: 'e2021', advanced: true }, 8), {
  hands: [['penny', 'cash', 'cash', 'piggy', 'coins', 'baseball'], ['home', 'stamps', 'cash', 'piggy', 'coins', 'baseball']].map(function (h) { return h.map(function (t) { return t === 'stamps' ? 'baseball' : t; }); }),
  stacks: [[['bank', 'bank']], [['auto', 'auto'], ['home', 'home']]]
});
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'challenge' && a.depth === 0; }));
eq(st.phase, 'turn', 'one Home cannot answer a Penny Jar, so the challenger wins at once');
eq(st.stacks[0].length, 2, 'penny jar challenge took the set');
st = rig(E.newGame({ players: 2, edition: 'e2021', advanced: true }, 8), {
  hands: [['penny', 'cash', 'cash', 'piggy', 'coins', 'baseball'], ['home', 'silver', 'cash', 'piggy', 'coins', 'baseball']],
  stacks: [[['bank', 'bank']], [['auto', 'auto'], ['home', 'home']]]
});
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'challenge' && a.depth === 0; }));
var pl = E.legal(st).filter(function (a) { return a.t === 'play'; });
ok(pl.length === 1 && pl[0].cards.length === 2, 'answer to a Penny Jar is two cards');
// advanced: second set from the top needs a 2-card opener
st = rig(E.newGame({ players: 2, edition: 'e2021', advanced: true }, 9), {
  hands: [['auto', 'silver', 'cash', 'piggy', 'coins', 'baseball'], ['home']],
  stacks: [[['bank', 'bank']], [['piggy', 'piggy'], ['auto', 'auto'], ['home', 'home']]]
});
var d1 = E.legal(st).filter(function (a) { return a.t === 'challenge' && a.depth === 1; });
ok(d1.length === 1 && d1[0].cards.length === 2, 'advanced: second-from-top challenge opens with 2 cards');
eq(E.legal(setup({ players: 4 })).some(function (a) { return a.depth === 1; }), false, 'classic: only the top set');
// advanced: two actions, discard first refills to six
st = rig(E.newGame({ players: 2, edition: 'e2021', advanced: true }, 10), { hands: [['auto', 'auto', 'cash', 'piggy', 'coins', 'baseball'], ['home']], stacks: [[], []] });
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'discard'; }));
eq(st.hands[0].length, 6, 'advanced: discard as first action draws back to 6 at once');
eq(st.turn, 0, 'advanced: still your turn for a second action');
ok(find(E.legal(st), function (a) { return a.t === 'end'; }), 'advanced: may stop after one action');
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'pair'; }));
eq(st.turn, 1, 'after two actions the turn passes');
// improve
st = rig(E.newGame({ players: 2, edition: 'e2021', advanced: true }, 11), { hands: [['auto', 'cash', 'piggy', 'coins', 'baseball', 'gold'], ['home']], stacks: [[['auto', 'auto']], []] });
ok(find(E.legal(st), function (a) { return a.t === 'improve'; }), 'advanced: add a matching asset to your top set');
ok(!E.legal(st).some(function (a) { return a.t === 'improve' && st.cards[a.card].kind === 'wild'; }), 'improve never with a wild');
// swap and move
st = rig(E.newGame({ players: 2, edition: 'e2021', advanced: true }, 12), { hands: [['swap', 'move', 'piggy', 'coins', 'baseball', 'cash'], ['home']], stacks: [[['piggy', 'piggy'], ['coins', 'coins']], [['auto', 'auto'], ['home', 'gold']]] });
var sw = find(E.legal(st), function (a) { return a.t === 'swap'; });
var st2 = E.apply(st, sw);
eq(st2.stacks[0][1].type, 'home', 'swap: you now have their top set'); eq(st2.stacks[1][1].type, 'coins', 'swap: they have yours');
eq(st2.out.length, 1, 'action card leaves play');
var mv = find(E.legal(st), function (a) { return a.t === 'move' && a.target === 1 && a.dir === 'down'; });
st2 = E.apply(st, mv);
eq(st2.stacks[1].map(function (s) { return s.type; }), ['home', 'auto'], 'move: top set to the bottom');

// ---------- round end and winning ----------
st = rig(E.newGame({ players: 2 }, 13), { hands: [['cash'], []], stacks: [[['home', 'gold'], ['home', 'home']], [['stamps', 'stamps']]] });
st.draw = []; st.out = st.out.concat(st.cards.map(function (c) { return c.id; }).filter(function (id) {
  return st.hands[0].indexOf(id) < 0 && !st.stacks.some(function (k) { return k.some(function (s) { return s.cards.indexOf(id) >= 0; }); });
}));
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'discard'; }));
eq(st.phase, 'roundEnd', 'round ends when every hand is empty and the draw pile is gone');
eq(st.roundScores, [110000, 10000], 'round score = face value of every card in your stack');
eq(st.totals, [110000, 10000], 'totals add up');
st = E.apply(st, { t: 'next' });
eq(st.round, 2, 'next round dealt'); eq(st.stacks[0].length, 0, 'stacks cleared');
// winning at $1,000,000
st.totals = [995000, 980000]; st = rig(st, { hands: [['cash'], []], stacks: [[['stamps', 'stamps']], [['coins', 'coins']]] });
st.draw = []; st.out = [];
var used = {}; st.hands.forEach(function (h) { h.forEach(function (i) { used[i] = 1; }); }); st.stacks.forEach(function (k) { k.forEach(function (s) { s.cards.forEach(function (i) { used[i] = 1; }); }); });
st.out = st.cards.map(function (c) { return c.id; }).filter(function (i) { return !used[i]; });
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'discard'; }));
eq(st.phase, 'gameOver', 'game ends when someone reaches $1,000,000');
eq(st.winner.seats, [0], 'both pass $1M: the higher total wins ($1,005,000 vs $1,000,000)');

// quick format: one round
var q = E.newGame({ players: 2, format: 'quick' }, 14), n = 0;
while (q.phase === 'turn' || q.phase === 'battle') { var QL = E.legal(q); q = E.apply(q, find(QL, function (a) { return a.t === 'pair' && q.turn === 0; }) || QL[QL.length - 1], { mutate: true }); if (++n > 5000) break; }
eq(q.phase, 'gameOver', 'quick game ends after one round');

// ---------- view hides secrets ----------
var v = E.view(g4, 0);
ok(Array.isArray(v.hands[0]) && typeof v.hands[1] === 'number', 'view: only your own hand');
ok(typeof v.draw === 'number' && v.rng === undefined, 'view: draw pile is a count, no rng');
ok(E.legal(v).length === E.legal(g4).length, 'legal moves work from your own view');

// ---------- random full games keep every card exactly once ----------
var cfgs = [{ players: 4 }, { players: 2 }, { players: 6, teams: true }, { players: 5, edition: 'e2021', advanced: true }, { players: 2, edition: 'e2021', draft: true, advanced: true }, { players: 3, edition: 'e2021', draft: true }];
var r = 7, bad = 0, games = 0;
cfgs.forEach(function (c) {
  for (var g = 0; g < 25; g++) {
    var s = E.newGame(c, g + 100), k = 0;
    while (s.phase !== 'gameOver' && k++ < 30000) {
      if (s.phase === 'roundEnd') { s = E.apply(s, { t: 'next' }, { mutate: true }); continue; }
      var L = E.legal(s); r = (r * 1103515245 + 12345) & 0x7fffffff;
      s = E.apply(s, L[r % L.length], { mutate: true });
      if (!T.conserved(E, s)) { bad++; break; }
    }
    if (s.phase === 'gameOver') games++;
  }
});
eq(bad, 0, 'every card stays exactly once in random games');
eq(games, cfgs.length * 25, 'every random game finishes');

// ---------- odds math vs brute force ----------
// P(at least 1 good card in 3 drawn from 7 with 2 good) by enumeration
var cnt = 0, tot = 0;
for (var a1 = 0; a1 < 7; a1++) for (var b1 = a1 + 1; b1 < 7; b1++) for (var c1 = b1 + 1; c1 < 7; c1++) { tot++; if (a1 < 2 || b1 < 2 || c1 < 2) cnt++; }
near(O.atLeast(7, 2, 3, 1), cnt / tot, 1e-12, 'hypergeometric at-least matches enumeration');
near(O.atMost(52, 13, 5, 1), O.hyper(52, 13, 5, 0) + O.hyper(52, 13, 5, 1), 1e-12, 'at-most sums');
var sum = 0; for (var i = 0; i <= 5; i++) sum += O.hyper(52, 13, 5, i); near(sum, 1, 1e-12, 'distribution sums to 1');
// unseen count from a seat
var u = O.unseen(g4, 0);
eq(u.total, 110 - 4 - 1, 'seat sees its 4 cards and the discard');
// topRisk vs simulation
st = rig(E.newGame({ players: 4 }, 15), {
  hands: [['stamps', 'cash', 'piggy', 'coins'], ['bank', 'bank', 'bank', 'bank'], ['bank', 'bank', 'bank', 'bank'], ['coins', 'coins', 'stocks', 'stocks']],
  stacks: [[['piggy', 'piggy'], ['auto', 'auto']], [['bank', 'stocks'].slice(0, 1).concat(['silver'])], [['stocks', 'stocks']], [['stocks', 'gold']]]
});
var risk = O.topRisk(st, 0, E);
// simulate: deal the unseen cards at random to the 3 opponents (4 each), check if any holds an auto or wild
var un = [], seen = {};
st.hands[0].forEach(function (x) { seen[x] = 1; }); st.stacks.forEach(function (k) { k.forEach(function (s) { s.cards.forEach(function (x) { seen[x] = 1; }); }); });
st.cards.forEach(function (c) { if (!seen[c.id]) un.push(c.id); });
var hit = 0, N = 40000, seed = 99;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
for (var t = 0; t < N; t++) {
  for (var x = 0; x < 12; x++) { var j = x + Math.floor(rnd() * (un.length - x)); var tmp = un[x]; un[x] = un[j]; un[j] = tmp; }
  var any = false; for (x = 0; x < 12; x++) { var cc = st.cards[un[x]]; if (cc.type === 'auto' || cc.kind === 'wild') any = true; }
  if (any) hit++;
}
near(risk.anyStart, hit / N, 0.02, 'chance someone can challenge your top set (formula vs 40,000 deals)');
eq(risk.value, 30000, 'value at risk is the top set');

T.done('engine');
