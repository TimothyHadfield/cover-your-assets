// Measure computer strength: node tools/sim.js [games] [players] [edition] [advanced]
// Plays full games (to $1,000,000) between bot levels and prints win rates.
var E = require('../js/engine.js'), AI = require('../js/ai.js');

function rng(seed) { return function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), seed | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function play(cfg, levels, seed) {
  var st = E.newGame(cfg, seed), r = rng(seed * 31 + 7), n = 0;
  while (st.phase !== 'gameOver') {
    if (st.phase === 'roundEnd') { st = E.apply(st, { t: 'next' }, { mutate: true }); continue; }
    var s = E.toAct(st), L = E.legal(st);
    var a = AI.choose(st, s, levels[s], r, L);
    st = E.apply(st, a, { mutate: true, trust: true });
    if (++n > 50000) throw new Error('runaway game');
  }
  return { winners: st.winner.seats, rounds: st.round, totals: st.totals };
}

// levels[0] is the "test" bot; rotate its seat so seat order doesn't bias the result
function matchup(cfg, test, field, games) {
  var wins = 0, rounds = 0;
  for (var g = 0; g < games; g++) {
    var n = cfg.players, seat = g % n, levels = [];
    for (var s = 0; s < n; s++) levels.push(s === seat ? test : field);
    var res = play(cfg, levels, 1000 + g);
    if (res.winners.indexOf(seat) >= 0) wins++;
    rounds += res.rounds;
  }
  return { test: test, field: field, players: cfg.players, games: games, winRate: wins / games, fair: 1 / cfg.players, rounds: rounds / games };
}

if (require.main === module) {
  var games = +process.argv[2] || 400, players = +process.argv[3] || 4, edition = process.argv[4] || 'classic', adv = process.argv[5] === 'adv';
  var cfg = { players: players, edition: edition, advanced: adv };
  var t0 = Date.now();
  [['medium', 'easy'], ['hard', 'easy'], ['hard', 'medium'], ['easy', 'hard'], ['medium', 'hard']].forEach(function (m) {
    var r = matchup(cfg, m[0], m[1], games);
    console.log(JSON.stringify(r));
  });
  console.log('seconds', (Date.now() - t0) / 1000);
}
module.exports = { play: play, matchup: matchup };
