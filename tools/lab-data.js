// Builds js/lab-data.js from simulated games. node tools/lab-data.js [scale]
// scale 1 = full run (several minutes). Every number in the Lab tab comes from here.
var fs = require('fs'), path = require('path');
var E = require('../js/engine.js'), AI = require('../js/ai.js');
var sim = require('./sim.js');
var K = +process.argv[2] || 1;

function rng(seed) { return function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), seed | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// one instrumented game of hard bots
function instrumented(cfg, seed, acc) {
  var st = E.newGame(cfg, seed), r = rng(seed), n = 0;
  var deckSize = st.draw.length;
  while (st.phase !== 'gameOver') {
    if (st.phase === 'roundEnd') {
      acc.roundValues.push(st.roundScores.reduce(function (a, b) { return a + b; }, 0) / cfg.players);
      st = E.apply(st, { t: 'next' }, { mutate: true }); deckSize = st.draw.length; continue;
    }
    var s = E.toAct(st), L = E.legal(st), a = AI.choose(st, s, 'hard', r, L);
    var phase = st.phase, logLen = st.log.length;
    if (phase === 'turn') acc.mix[a.t] = (acc.mix[a.t] || 0) + 1;
    var stage = Math.min(9, Math.floor((1 - st.draw.length / Math.max(1, deckSize)) * 10));
    if (phase === 'turn') acc.turnsAt[stage]++;
    st = E.apply(st, a, { mutate: true, trust: true });
    for (var i = logLen; i < st.log.length; i++) {
      var e = st.log[i];
      if (e.m === 'stole') { acc.stealsAt[stage]++; acc.stolenBy[e.type] = (acc.stolenBy[e.type] || 0) + 1; acc.stolenValue.push(e.value); }
      if (e.m === 'held') acc.held++;
      if (e.m === 'challenge') acc.fights++;
      if (e.m === 'pair' || e.m === 'pairDiscard') acc.setsBy[e.type] = (acc.setsBy[e.type] || 0) + 1;
    }
    if (++n > 50000) throw new Error('runaway');
  }
  acc.rounds.push(st.round);
  acc.winSeat[st.winner.seats[0]]++;
  acc.games++;
}

function study(players, games) {
  var acc = { games: 0, rounds: [], roundValues: [], mix: {}, turnsAt: new Array(10).fill(0), stealsAt: new Array(10).fill(0), stolenBy: {}, setsBy: {}, stolenValue: [], held: 0, fights: 0, winSeat: new Array(players).fill(0) };
  for (var g = 0; g < games; g++) instrumented({ players: players }, 5000 + g, acc);
  return acc;
}
function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / (a.length || 1); }

var t0 = Date.now(), out = { generated: new Date().toISOString().slice(0, 10) };

// 1. strength
var N = Math.round(500 * K);
var rows = [];
[[4, 'hard', 'medium'], [4, 'medium', 'easy'], [4, 'hard', 'easy'], [2, 'hard', 'medium'], [2, 'medium', 'easy'], [2, 'hard', 'easy']].forEach(function (m) {
  var r = sim.matchup({ players: m[0] }, m[1], m[2], N);
  rows.push({ label: cap(m[1]) + ' vs ' + (m[0] === 2 ? '1 ' : '3 ') + m[2] + ' (' + m[0] + ' players)', players: m[0], test: m[1], field: m[2], games: N, winRate: r.winRate, fair: r.fair });
  console.log(rows[rows.length - 1].label, r.winRate);
});
out.strength = { rows: rows, note: N + ' full games per line to $1,000,000, classic deck, every seat rotated.' };
function cap(s) { return s[0].toUpperCase() + s.slice(1); }

// 2. by player count (hard bots)
out.byPlayers = [];
var big = null;
[2, 3, 4, 5, 6].forEach(function (p) {
  var acc = study(p, Math.round(300 * K));
  out.byPlayers.push({ players: p, games: acc.games, rounds: mean(acc.rounds), perRound: mean(acc.roundValues),
    fightsPerGame: acc.fights / acc.games, stealRate: acc.fights ? (acc.fights - acc.held) / acc.fights : 0,
    seatWin: acc.winSeat.map(function (w) { return w / acc.games; }) });
  if (p === 4) big = acc;
  console.log('players', p, out.byPlayers[out.byPlayers.length - 1].rounds);
});

// 3. details from 4-player games
var mixT = Object.keys(big.mix).reduce(function (a, k) { return a + big.mix[k]; }, 0);
out.mix = Object.keys(big.mix).map(function (k) { return { t: k, share: big.mix[k] / mixT }; }).sort(function (a, b) { return b.share - a.share; });
out.stealsByStage = big.stealsAt.map(function (s, i) { return { stage: i, perTurn: s / Math.max(1, big.turnsAt[i]) }; });
out.stolenByType = Object.keys(big.setsBy).map(function (t) { return { type: t, made: big.setsBy[t], stolen: big.stolenBy[t] || 0, rate: (big.stolenBy[t] || 0) / big.setsBy[t] }; }).sort(function (a, b) { return b.rate - a.rate; });
out.avgStolen = mean(big.stolenValue);
out.games4 = big.games;

// 4. nest egg experiment: does a wild in your first set help? hard bot vs hard bot that never uses a wild on its first pair
var nestN = Math.round(400 * K);
function nestPlay(seed, special) {
  var st = E.newGame({ players: 4 }, seed), r = rng(seed), n = 0;
  while (st.phase !== 'gameOver') {
    if (st.phase === 'roundEnd') { st = E.apply(st, { t: 'next' }, { mutate: true }); continue; }
    var s = E.toAct(st), L = E.legal(st), a;
    if (s === special && st.phase === 'turn' && st.stacks[s].length === 0) {
      var ranked = AI.rank(st, s, L);
      // the variant: if any pair is possible for the first set, use the most valuable one including wilds
      var pairs = ranked.filter(function (x) { return x.a.t === 'pair' || x.a.t === 'pairDiscard'; });
      pairs.sort(function (x, y) { return val(st, y.a) - val(st, x.a); });
      a = pairs.length ? pairs[0].a : ranked[0].a;
    } else a = AI.choose(st, s, 'hard', r, L);
    st = E.apply(st, a, { mutate: true, trust: true });
    if (++n > 50000) throw new Error('runaway');
  }
  return st.winner.seats.indexOf(special) >= 0;
}
function val(st, a) { var ids = a.t === 'pair' ? a.cards : [a.card, st.discard[st.discard.length - 1]]; return ids.reduce(function (x, id) { return x + st.cards[id].value; }, 0); }
var nw = 0; for (var g = 0; g < nestN; g++) if (nestPlay(9000 + g, g % 4)) nw++;
out.nest = { games: nestN, winRate: nw / nestN, fair: 0.25, note: 'One hard bot always makes its first set (the safe nest egg) as valuable as possible, wilds included; the other three play normally.' };
console.log('nest', out.nest.winRate);

out.seconds = Math.round((Date.now() - t0) / 1000);
var js = '/* generated by tools/lab-data.js on ' + out.generated + ' — do not edit by hand */\nwindow.CYALabData = ' + JSON.stringify(out, null, 1) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'js', 'lab-data.js'), js);
console.log('wrote js/lab-data.js in', out.seconds, 's');
