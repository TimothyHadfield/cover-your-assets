// Computer players and the Hint scorer: always legal, and the levels really differ in strength.
var E = require('../js/engine.js'), AI = require('../js/ai.js'), T = require('./helpers.js'), SIM = require('../tools/sim.js');

// 1. Every level's choice (and the top Hint) is legal, from the player's own view, across variants.
var cfgs = [{ players: 4 }, { players: 2 }, { players: 3, edition: 'e2021', advanced: true }, { players: 2, edition: 'e2021', draft: true }, { players: 4, teams: true }];
var illegal = 0, hintBad = 0, n = 0, seed = 1;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
cfgs.forEach(function (cfg, k) {
  var st = E.newGame(Object.assign({ format: 'quick' }, cfg), 50 + k), lv = ['easy', 'medium', 'hard'];
  while (st.phase !== 'gameOver') {
    if (st.phase === 'roundEnd') { st = E.apply(st, { t: 'next' }); continue; }
    var s = E.toAct(st), v = E.view(st, s), L = E.legal(st);
    var a = AI.choose(v, s, lv[n % 3], rnd, E.legal(v));
    if (!E.isLegal(st, a)) illegal++;
    if (st.phase !== 'pick') { var r = AI.rank(v, s); if (!r.length || !E.isLegal(st, r[0].a)) hintBad++; }
    st = E.apply(st, a); n++;
  }
});
T.eq(illegal, 0, 'computer moves are legal in ' + n + ' positions');
T.eq(hintBad, 0, 'the Hint always suggests a legal move');

// 2. Strength ladder (small sample of the lab run; seats rotate).
var hm = SIM.matchup({ players: 2 }, 'hard', 'medium', 60);
var me = SIM.matchup({ players: 2 }, 'medium', 'easy', 60);
T.ok(hm.winRate >= 0.75, 'hard beats medium head to head (' + Math.round(hm.winRate * 100) + '% of 60)');
T.ok(me.winRate >= 0.75, 'medium beats easy head to head (' + Math.round(me.winRate * 100) + '% of 60)');
T.done('ai');
