// Simulation bookkeeping for the Lab tab (used by tools/lab-data.js and tests/lab.test.js).
var E = require('../js/engine.js'), AI = require('../js/ai.js');

function rng(seed) { return function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), seed | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// a set keeps its object and its first card when it changes hands, so game + round + first card names it
function noteSteal(acc, st, e) {
  var k = st.stacks[e.s], set = k[k.length - 1];
  if (!set || set.type !== e.type) { acc.stealMismatch = (acc.stealMismatch || 0) + 1; return; }
  var by = acc.stolenSets[e.type] = acc.stolenSets[e.type] || {};
  by[acc.games + ':' + st.round + ':' + set.cards[0]] = 1;
  if (acc.stolenObjs) acc.stolenObjs.add(set); // tests: the same count by object identity
}

// share of sets of each kind stolen at least once (a set stolen twice counts once)
function stolenByType(acc) {
  return Object.keys(acc.setsBy).map(function (t) {
    var once = Object.keys(acc.stolenSets[t] || {}).length;
    return { type: t, made: acc.setsBy[t], steals: acc.stolenBy[t] || 0, stolen: once, rate: once / acc.setsBy[t] };
  }).sort(function (a, b) { return b.rate - a.rate; });
}

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
      if (e.m === 'stole') { acc.stealsAt[stage]++; acc.stolenBy[e.type] = (acc.stolenBy[e.type] || 0) + 1; acc.stolenValue.push(e.value); noteSteal(acc, st, e); }
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

function study(players, games, trackObjects) {
  var acc = { games: 0, rounds: [], roundValues: [], mix: {}, turnsAt: new Array(10).fill(0), stealsAt: new Array(10).fill(0), stolenBy: {}, stolenSets: {}, setsBy: {}, stolenValue: [], held: 0, fights: 0, winSeat: new Array(players).fill(0) };
  if (trackObjects) acc.stolenObjs = new Set();
  for (var g = 0; g < games; g++) instrumented({ players: players }, 5000 + g, acc);
  return acc;
}
module.exports = { study: study, instrumented: instrumented, stolenByType: stolenByType, noteSteal: noteSteal };
