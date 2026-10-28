// My stats: turning a real game into a Profile result (js/cyaprofile.js), and the levels' ratings.
var E = require('../js/engine.js'), AI = require('../js/ai.js'), T = require('./helpers.js');
var CP = require(process.env.CYAP || '../js/cyaprofile.js');

function rng(seed) { return function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), seed | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a whole standard game to $1M, seat 0 = "you" played by Hard, the rest by `field`; stop early after `cut` moves
function play(seed, field, cut) {
  var st = E.newGame({ players: 4 }, seed), r = rng(seed), n = 0;
  while (st.phase !== 'gameOver' && !(cut && n >= cut)) {
    if (st.phase === 'roundEnd') { st = E.apply(st, { t: 'next' }); continue; }
    var s = E.toAct(st);
    st = E.apply(st, AI.choose(E.view(st, s), s, s === 0 ? 'hard' : field, r, E.legal(st))); n++;
  }
  return st;
}
var bots = function (lv) { return [{ kind: 'human' }, { kind: 'bot', level: lv }, { kind: 'bot', level: 'easy' }, { kind: 'bot', level: lv }]; };

// 1. a finished game vs computers: rated at the strongest computer, won matches the engine's winner
var st = play(7, 'medium'), r = CP.result({ st: st, me: 0, seats: bots('medium') });
T.eq(r.mode, 'computer', 'game vs computers counts as "vs computer"');
T.eq(r.level, 'medium', 'rated at the strongest computer at the table');
T.eq(r.won, st.winner.seats.indexOf(0) >= 0, 'won follows the engine winner');
T.eq(r.score, st.totals[0], 'score = your total');
T.ok(!r.extra.quit, 'a finished game is not a quit');
// steals / biggest steal / fought off / lost, counted straight from the log
var steals = st.log.filter(function (e) { return e.m === 'stole' && e.s === 0; });
T.eq(r.extra.steals, steals.length, 'steals counted from the log');
T.eq(r.extra.bestSteal, steals.reduce(function (m, e) { return Math.max(m, e.value); }, 0), 'biggest steal from the log');
T.eq(r.extra.kept, st.log.filter(function (e) { return e.m === 'held' && e.s === 0; }).length, 'challenges fought off counted');
T.eq(r.extra.lost, st.log.filter(function (e) { return e.m === 'stole' && e.from === 0; }).length, 'sets lost counted');
T.ok(r.extra.steals + r.extra.kept + r.extra.lost > 0, 'a real game has some fights for you (' + JSON.stringify(r.extra) + ')');

// 2. leaving after your first move = a loss; Hint/Undo = with help, not rated; several people = no winner of mine
var q = CP.result({ st: play(8, 'hard', 12), me: 0, seats: bots('hard') });
T.eq([q.mode, q.level, q.won, !!q.extra.quit], ['computer', 'hard', false, true], 'quitting mid-game is a rated loss');
var h = CP.result({ st: st, me: 0, seats: bots('hard'), helped: true });
T.eq([h.mode, h.level], ['help', null], 'Hint or Undo makes it unrated "with help"');
var f = CP.result({ st: st, me: 0, seats: [{ kind: 'human' }, { kind: 'human' }, { kind: 'bot', level: 'hard' }, { kind: 'bot', level: 'easy' }] });
T.eq([f.mode, f.won, f.level], ['friends', null, null], 'two people on one phone: played, no winner of mine');
var d = CP.result({ st: st, me: 0, seats: bots('medium'), daily: true });
T.eq([d.daily, d.mode], [true, 'computer'], 'Daily game flagged');
T.eq(CP.result({ st: st, me: 0, seats: bots('medium'), daily: true, helped: true }).daily, true, 'a Daily with Hint still uses up the Daily');

// 3. levels: ratings rise with strength; achievements well-formed and their tests don't throw on a real result
T.ok(CP.LEVELS[0].rating < CP.LEVELS[1].rating && CP.LEVELS[1].rating < CP.LEVELS[2].rating, 'Easy < Medium < Hard ratings');
var ctx = { stats: { wins: 1, bestStreak: 1 }, daily: { streak: 0 }, last: Object.assign({}, r, { won: true }), levels: CP.LEVELS };
var bad = CP.ACH.filter(function (a) { try { a.test(ctx); return !a.id || !a.title || !a.desc; } catch (e) { return true; } });
T.eq(bad.length, 0, 'every achievement has id/title/desc and a test that runs');
T.eq(CP.ACH.filter(function (a) { return a.id === 'covered'; })[0].test({ stats: {}, daily: {}, last: { won: true, extra: { lost: 0 } } }), true, '"Fully covered" unlocks on a win with no set lost');
T.eq(CP.ACH.filter(function (a) { return a.id === 'heist'; })[0].test({ stats: {}, daily: {}, last: { extra: { bestSteal: 100000 } } }), true, '"Heist" at a $100K steal');
T.done('profile');
