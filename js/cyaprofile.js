/* cyaprofile.js: Cover Your Assets' part of the player profile (shared kit js/profile.js, never edit that one here):
 * the computer levels' ratings, the achievements, the Daily game and turning a game into a result.
 *
 * What counts as one game: a whole game vs computers. Leaving after your first move counts as a loss.
 * A game where you used Hint or Undo counts as "with help" and isn't rated. The guided first game isn't counted.
 * Several people on one phone: counted as played, no winner of mine. Online games aren't counted here.
 * Plain script: window.CYAProfile in the browser, module.exports in node (tests/profile.test.js). */
(function (root) {
  'use strict';
  // Elo of each level from whole 4-player games to $1M, one level against three of another (js/lab-data.js,
  // 500 games a line, seats rotated). A win share s against a fair share of 1/4 is read as a head-to-head
  // score p = s / (s + (1 - s) / 3); difference = 400·log10(p / (1 − p)), rounded to 10. Easy anchored at 1200.
  //   Medium 77.6% vs 3 Easy -> p 0.912 -> +410.   Hard 92.2% vs 3 Medium -> p 0.973 -> +620.
  var LEVELS = [{ id: 'easy', name: 'Easy', rating: 1200 }, { id: 'medium', name: 'Medium', rating: 1610 }, { id: 'hard', name: 'Hard', rating: 2230 }];
  var RANK = { easy: 0, medium: 1, hard: 2 };

  function won(c) { return !!(c.last && c.last.won); }
  function ex(c) { return (c.last && c.last.extra) || {}; }
  var ACH = [
    { id: 'first', title: 'First million', desc: 'Win a game of Cover Your Assets', test: function (c) { return c.stats.wins >= 1; } },
    { id: 'medium', title: 'Savvy saver', desc: 'Win against Medium', test: function (c) { return won(c) && RANK[c.last.level] >= 1; } },
    { id: 'hard', title: 'Tycoon', desc: 'Win against Hard', test: function (c) { return won(c) && c.last.level === 'hard'; } },
    { id: 'heist', title: 'Heist', desc: 'Steal a set worth $100K or more', test: function (c) { return ex(c).bestSteal >= 100000; } },
    { id: 'thief', title: 'Sticky fingers', desc: 'Steal 5 sets in one game', test: function (c) { return ex(c).steals >= 5; } },
    { id: 'vault', title: 'Vault', desc: 'Fight off 3 challenges in one game', test: function (c) { return ex(c).kept >= 3; } },
    { id: 'covered', title: 'Fully covered', desc: 'Win a game without losing a set', test: function (c) { return won(c) && !ex(c).quit && ex(c).lost === 0; } },
    { id: 'crowd', title: 'Full table', desc: 'Win a game with 6 players', test: function (c) { return won(c) && ex(c).players >= 6; } },
    { id: 'streak', title: 'Hot streak', desc: 'Win 3 in a row', test: function (c) { return c.stats.bestStreak >= 3; } },
    { id: 'daily', title: 'Daily saver', desc: '3-day Daily streak', test: function (c) { return c.daily.streak >= 3; } }
  ];

  // Today's Daily game: the same deal for everyone that day. Standard game (classic deck, first to $1M), you + 3 Medium.
  var DAILY = { level: 'medium', players: 4, cfg: { players: 4, edition: 'classic', advanced: false, draft: false, teams: false, format: 'million' } };

  function init(onDaily) {
    if (!root.Profile) return false;
    root.Profile.init({
      game: 'cover-your-assets', levels: LEVELS, achievements: ACH, draws: false,
      modes: { computer: { name: 'vs computer' }, help: { name: 'With help' }, friends: { name: 'One phone' } },
      daily: { title: 'Daily game', onPlay: function () { if (onDaily) onDaily(); } }
    });
    return true;
  }

  /** The level a game vs computers is rated at: the strongest computer at the table. */
  function tableLevel(levels) {
    var best = null;
    (levels || []).forEach(function (l) { if (RANK[l] != null && (best == null || RANK[l] > RANK[best])) best = l; });
    return best;
  }

  /** What one game adds up to for seat me, from the game log: steals, biggest steal, challenges fought off, sets lost. */
  function summary(st, me) {
    var steals = 0, bestSteal = 0, kept = 0, lost = 0;
    (st.log || []).forEach(function (e) {
      if (e.m === 'stole' && e.s === me) { steals++; bestSteal = Math.max(bestSteal, e.value || 0); }
      if (e.m === 'stole' && e.from === me) lost++;
      if (e.m === 'held' && e.s === me) kept++;
    });
    return { steals: steals, bestSteal: bestSteal, kept: kept, lost: lost };
  }

  /** A finished (or abandoned) game -> Profile.recordResult input.
   *  g: { st, me, seats: [{ kind: 'human'|'bot', level }], helped, daily } */
  function result(g) {
    var st = g.st, me = g.me, seats = g.seats || [];
    var over = st.phase === 'gameOver';
    var people = seats.filter(function (s) { return s.kind === 'human'; }).length;
    var cpu = seats.filter(function (s) { return s.kind === 'bot'; }).map(function (s) { return s.level; });
    var mode = people > 1 || !cpu.length ? 'friends' : g.helped ? 'help' : 'computer';
    var level = mode === 'computer' ? tableLevel(cpu) : null;
    var w = mode === 'friends' ? null : over && st.winner && st.winner.seats.indexOf(me) >= 0;
    var score = (st.totals || [])[me] || 0;
    var extra = summary(st, me);
    extra.players = st.cfg.players; extra.rounds = st.round;
    if (!over) extra.quit = true;
    return { mode: mode, level: level, won: w, score: score, daily: !!g.daily && mode !== 'friends', extra: extra };
  }

  var api = { LEVELS: LEVELS, ACH: ACH, DAILY: DAILY, RANK: RANK, init: init, tableLevel: tableLevel, summary: summary, result: result };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CYAProfile = api;
})(typeof window !== 'undefined' ? window : globalThis);
