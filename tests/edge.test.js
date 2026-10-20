// node tests/edge.test.js — odd and rare table moments (edge pass 2026-10-20)
var E = require('../js/engine.js'), AI = require('../js/ai.js');
var T = require('./helpers.js'), ok = T.ok, eq = T.eq;

function rig(st, spec) {
  var pool = st.cards.map(function (c) { return c.id; });
  function take(type) { for (var i = 0; i < pool.length; i++) if (st.cards[pool[i]].type === type) return pool.splice(i, 1)[0]; throw new Error('no ' + type); }
  st.hands = spec.hands.map(function (h) { return h.map(take); });
  st.stacks = spec.stacks.map(function (k) { return k.map(function (set) { return { type: set[0], cards: set.map(take) }; }); });
  st.discard = (spec.discard || []).map(take);
  st.out = []; st.draw = spec.emptyDraw ? [] : pool; st.turn = spec.turn || 0; st.phase = 'turn'; st.acts = 0; st.used = []; st.lockout = []; st.battle = null;
  if (spec.emptyDraw) st.out = pool;
  return st;
}
function find(L, pred) { for (var i = 0; i < L.length; i++) if (pred(L[i])) return L[i]; return null; }
// finish the round: seat 0 holds the last card and discards it
function endWith(st, totals) {
  st.totals = totals.slice();
  return E.apply(st, find(E.legal(st), function (a) { return a.t === 'discard'; }));
}

// ---------- ties at the top ----------
var st = rig(E.newGame({ players: 2 }, 1), { hands: [['cash'], []], stacks: [[['stamps', 'stamps']], [['coins']]], emptyDraw: true });
st = endWith(st, [1000000, 1005000]); // +10K and +10K? seat1 has one coins card = 10K, seat0 stamps pair = 10K
eq(st.totals, [1010000, 1015000], 'setup sanity: totals after the round');
eq(st.phase, 'gameOver', 'one player clearly ahead over $1M wins');
st = rig(E.newGame({ players: 2 }, 2), { hands: [['cash'], []], stacks: [[['stamps', 'stamps']], [['coins']]], emptyDraw: true });
st = endWith(st, [1000000, 1000000]);
eq([st.phase, st.winner], ['roundEnd', null], 'exact tie over $1M: no winner yet');
ok(E.extraRound(st), 'exact tie over $1M: the round panel can say one more round decides it');
var st2 = E.apply(st, { t: 'next' });
eq([st2.phase, st2.round], ['turn', 2], 'tie: the next round is dealt');
// not a tie: plain round end under $1M
st = rig(E.newGame({ players: 2 }, 3), { hands: [['cash'], []], stacks: [[['stamps', 'stamps']], [['coins']]], emptyDraw: true });
st = endWith(st, [0, 0]);
ok(!E.extraRound(st), 'ordinary round end is not a tie-break');
// one-round game tied
st = rig(E.newGame({ players: 3, format: 'quick' }, 4), { hands: [['cash'], [], []], stacks: [[['stamps', 'stamps']], [['coins']], [['piggy', 'piggy']]], emptyDraw: true });
st = endWith(st, [0, 0, 0]);
eq(st.phase, 'roundEnd', 'one-round game tied 3 ways at the top: not over');
ok(E.extraRound(st), 'one-round tie: extra round');
// three rounds tied after round 3
st = rig(E.newGame({ players: 2, format: 'three' }, 5), { hands: [['cash'], []], stacks: [[['stamps', 'stamps']], [['coins']]], emptyDraw: true });
st.round = 3; st = endWith(st, [50000, 50000]);
eq([st.phase, !!E.extraRound(st)], ['roundEnd', true], 'three rounds tied: a 4th round');
ok(!E.extraRound(Object.assign({}, st, { round: 2 })), 'a tie after round 2 of 3 is just a round');
// first to 2 round wins: both reach 2 in the same round
st = rig(E.newGame({ players: 2, format: 'bestof2' }, 6), { hands: [['cash'], []], stacks: [[['stamps', 'stamps']], [['coins']]], emptyDraw: true });
st.roundWins = [1, 1]; st = endWith(st, [0, 0]);
eq(st.roundWins, [2, 2], 'tied round counts as a win for both');
eq([st.phase, !!E.extraRound(st)], ['roundEnd', true], 'both reach 2 wins together: one more round');
// everyone has $0 in a round
st = rig(E.newGame({ players: 3, format: 'quick' }, 7), { hands: [['cash'], [], []], stacks: [[], [], []], emptyDraw: true });
st = endWith(st, [0, 0, 0]);
eq(st.roundScores, [0, 0, 0], 'a round where nobody made a set scores $0 each');
eq(st.phase, 'roundEnd', 'all $0: tied, play on');

// ---------- empty hands and empty piles ----------
// challenging a player whose hand is empty: they can't answer, the challenger takes the set at once
st = rig(E.newGame({ players: 3 }, 8), { hands: [['auto', 'cash'], [], ['piggy']], stacks: [[['stamps', 'stamps']], [['coins', 'coins'], ['auto', 'auto']], []], emptyDraw: true });
var ch = find(E.legal(st), function (a) { return a.t === 'challenge' && a.target === 1; });
ok(ch, 'can challenge a player who has no cards left');
st = E.apply(st, ch);
eq(st.stacks[0].length, 2, 'their set moves to the challenger at once (no answer possible)');
eq(st.turn, 2, 'turn skips the player with an empty hand');
// draw pile empty: the only moves are from hand, nothing is drawn
st = rig(E.newGame({ players: 2 }, 9), { hands: [['cash', 'piggy'], ['home']], stacks: [[], []], emptyDraw: true });
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'discard'; }));
eq(st.hands[0].length, 1, 'no refill when the draw pile is gone');
eq(st.turn, 1, 'play passes on');
// challenger plays their last card; defender answers; challenger can't go on -> defender keeps it
st = rig(E.newGame({ players: 2 }, 10), { hands: [['auto'], ['auto', 'cash']], stacks: [[['stamps', 'stamps']], [['coins', 'coins'], ['auto', 'auto']]], emptyDraw: true });
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'challenge'; }));
st = E.apply(st, find(E.legal(st), function (a) { return a.t === 'play'; }));
eq(st.stacks[1].length, 2, 'out of cards mid-fight: the defender keeps the set');
eq(st.stacks[1][1].cards.length, 4, 'and every card played lands on it');
// acting after the game is over is refused
st = rig(E.newGame({ players: 2, format: 'quick' }, 11), { hands: [['cash'], []], stacks: [[['stamps', 'stamps']], []], emptyDraw: true });
st = endWith(st, [0, 0]);
eq(st.phase, 'gameOver', 'quick game with a clear winner ends');
var threw = false; try { E.apply(st, { t: 'next' }); } catch (e) { threw = true; }
ok(threw, 'no moves after game over');

// ---------- min and max tables ----------
var g6 = E.newGame({ players: 6, edition: 'e2021', advanced: true }, 12);
eq(g6.hands.map(function (h) { return h.length; }), [6, 6, 6, 6, 6, 6], '6 players advanced: 6 cards each');
eq(g6.draw.length, 110 - 36 - 1, '6 players advanced: rest is the draw pile');
eq(E.newGame({ players: 9 }, 1).cfg.players, 6, 'more than 6 players is capped at 6');
eq(E.newGame({ players: 1 }, 1).cfg.players, 2, 'fewer than 2 players is raised to 2');

// ---------- every variant plays to the end with computers only ----------
var cfgs = [{ players: 2 }, { players: 6 }, { players: 6, teams: true, format: 'bestof2' }, { players: 4, teams: true, format: 'three' },
  { players: 6, edition: 'e2021', advanced: true, format: 'quick' }, { players: 2, edition: 'e2021', draft: true, advanced: true }, { players: 3, edition: 'e2021', draft: true, advanced: true, format: 'bestof2' }];
var unfinished = 0, lost = 0, s0 = 3;
function rng() { s0 = (s0 * 1103515245 + 12345) & 0x7fffffff; return s0 / 0x7fffffff; }
cfgs.forEach(function (c, ci) {
  for (var g = 0; g < 4; g++) {
    var s = E.newGame(c, 500 + ci * 10 + g), k = 0;
    while (s.phase !== 'gameOver' && k++ < 40000) {
      if (s.phase === 'roundEnd') { s = E.apply(s, { t: 'next' }, { mutate: true }); continue; }
      var seat = E.toAct(s), L = E.legal(s);
      s = E.apply(s, AI.choose(E.view(s, seat), seat, ['easy', 'medium', 'hard'][g % 3], rng, L), { mutate: true, trust: true });
      if (!T.conserved(E, s)) { lost++; break; }
    }
    if (s.phase !== 'gameOver') unfinished++;
  }
});
eq([unfinished, lost], [0, 0], 'computer-only games finish in every variant with every card kept');

T.done('edge');
