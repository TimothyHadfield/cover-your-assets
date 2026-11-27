// Crowded table for tests/fit-ui.mjs: a real 6-player game (seeded, medium computers) played on
// until late in a round, every seat holding a tall stack, you (seat 0) holding a full hand
// and answering a challenge. Returns the saved-game object the app reads from localStorage 'cya.game'.
var E = require('../js/engine.js'), AI = require('../js/ai.js');

function rng(seed) { return function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), seed | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

var LONG = ['Maximilian Thornberry', 'Alexandrina Featherstone', 'Bartholomew Winterbottom', 'Christabel Montgomery', 'Konstantinos Papadopoulos', 'Evangeline Whitmore'];

// want: 'battle' (you are answering a challenge) or 'turn' (your own turn); minSets: every stack at least this tall
function crowded(want, minSets) {
  want = want || 'battle'; minSets = minSets || 4;
  for (var seed = 1; seed < 400; seed++) {
    var st = E.newGame({ players: 6, edition: 'classic', format: 'million' }, seed), r = rng(seed * 31 + 7), n = 0;
    while (st.phase !== 'gameOver' && st.phase !== 'roundEnd' && n++ < 4000) {
      var s = E.toAct(st);
      var tall = st.stacks.every(function (k) { return k.length >= minSets; });
      if (s === 0 && st.phase === want && tall && st.hands[0].length >= 4 && st.discard.length >= 3 &&
          (want !== 'battle' || st.battle.defender === 0 || st.battle.attacker === 0)) {
        return { state: st, seats: LONG.map(function (nm, i) { return { kind: i ? 'bot' : 'human', level: 'medium', name: nm }; }), me: 0, meta: {}, seed: seed };
      }
      st = E.apply(st, AI.choose(st, s, 'medium', r, E.legal(st)), { mutate: true, trust: true });
    }
  }
  throw new Error('no crowded state found');
}
// early: a fresh 4-player deal (normal state)
function early() {
  var st = E.newGame({ players: 4, edition: 'classic', format: 'million' }, 5);
  return { state: st, seats: ['You', 'Ann', 'Ben', 'Cal'].map(function (nm, i) { return { kind: i ? 'bot' : 'human', level: 'medium', name: nm }; }), me: 0, meta: {} };
}
module.exports = { crowded: crowded, early: early };
if (require.main === module) {
  ['battle', 'turn'].forEach(function (w) {
    var g = crowded(w, +process.argv[2] || 4), st = g.state;
    console.log(w, 'seed', g.seed, 'stacks', st.stacks.map(function (k) { return k.length; }).join(','), 'hand', st.hands[0].length, 'discard', st.discard.length, 'draw', st.draw.length, st.battle ? JSON.stringify({ a: st.battle.attacker, d: st.battle.defender }) : '');
  });
}
