// node tests/advpick.test.js — "Pick advanced rules": the 2021 rulebook calls its advanced rules optional
// ("try adding one or all of these optional rules", p.10), so each one can be left out on its own (cfg.advOff).
var E = require('../js/engine.js'), AI = require('../js/ai.js');
var T = require('./helpers.js'), ok = T.ok, eq = T.eq;

var KEYS = ['hand', 'two', 'improve', 'cards', 'second'];
function cfg(off, extra) { return Object.assign({ players: 4, edition: 'e2021', advanced: true, advOff: off }, extra || {}); }
function types(st) { var o = {}; st.cards.forEach(function (c) { o[c.type] = (o[c.type] || 0) + 1; }); return o; }

function rig(st, spec) {
  var pool = st.cards.map(function (c) { return c.id; });
  function take(type) { for (var i = 0; i < pool.length; i++) if (st.cards[pool[i]].type === type) return pool.splice(i, 1)[0]; throw new Error('no ' + type); }
  st.hands = spec.hands.map(function (h) { return h.map(take); });
  st.stacks = spec.stacks.map(function (k) { return k.map(function (set) { return { type: set[0], cards: set.map(take) }; }); });
  st.discard = []; st.out = []; st.draw = pool; st.turn = 0; st.phase = 'turn'; st.acts = 0; st.used = []; st.lockout = []; st.battle = null;
  return st;
}
var SPEC = { hands: [['jewels', 'auto', 'auto', 'swap', 'move', 'silver'], ['cash'], ['cash'], ['cash']],
  stacks: [[['jewels', 'jewels']], [['bank', 'bank'], ['auto', 'auto'], ['boat', 'boat']], [], []] };
function legalFor(off) { return E.legal(rig(E.newGame(cfg(off), 7), SPEC)); }
function has(L, t, pred) { return L.some(function (a) { return a.t === t && (!pred || pred(a)); }); }

// backward compatible: old saves / online rooms have advanced:true and no advOff = every advanced rule
var all = E.newGame({ players: 4, edition: 'e2021', advanced: true }, 1);
eq([all.cfg.handSize, all.cfg.maxActions, all.cards.length], [6, 2, 110], 'advanced with no advOff: 6 cards, 2 actions, 110-card deck');
var L = legalFor([]);
ok(has(L, 'improve') && has(L, 'swap') && has(L, 'move') && has(L, 'challenge', function (a) { return a.depth === 1; }), 'every advanced action offered when nothing is left out');

// each rule left out on its own
var st = E.newGame(cfg(['hand']), 1);
eq([st.cfg.handSize, st.cfg.maxActions, st.hands[0].length], [5, 2, 5], 'without the 6-card hand: 5 cards, still 2 actions');
st = E.newGame(cfg(['two']), 1);
eq([st.cfg.handSize, st.cfg.maxActions], [6, 1], 'without two actions: 6 cards, 1 action');
st = E.newGame(cfg(['cards']), 1);
var ty = types(st);
eq([st.cards.length, ty.swap || 0, ty.move || 0, ty.penny || 0], [104, 0, 0, 0], 'without the new cards: no Swap, Move or Penny Jar in the deck');
L = legalFor(['improve']);
ok(!has(L, 'improve') && has(L, 'swap'), 'without Improve: no improve action, Swap still there');
L = legalFor(['second']);
ok(!has(L, 'challenge', function (a) { return a.depth === 1; }) && has(L, 'challenge', function (a) { return a.depth === 0; }), 'without 2nd-set steals: only the top set can be challenged');
ok(E.adv(E.newGame(cfg(['second']), 1), 'improve') && !E.adv(E.newGame(cfg(['second']), 1), 'second'), 'E.adv reports each rule');

// discard first then refill: part of the two-action rule
st = rig(E.newGame(cfg(['two']), 3), SPEC);
st = E.apply(st, { t: 'discard', card: st.hands[0][5] });
eq(st.turn, 1, 'one action only: the turn passes after a discard');

// everything left out = plain classic rules on the new deck
st = E.newGame(cfg(KEYS.slice()), 1);
eq([st.cfg.advanced, st.cfg.handSize, st.cfg.maxActions, st.cards.length], [false, 5, 1, 104], 'all five left out = advanced off');
// classic deck ignores it
eq(E.newGame({ players: 4, edition: 'classic', advanced: true, advOff: [] }, 1).cfg.advanced, false, 'classic deck: no advanced rules');
// junk in advOff is dropped
eq(E.newGame(cfg(['hand', 'bogus', 'hand']), 1).cfg.advOff, ['hand'], 'advOff cleaned (unknown and repeated keys dropped)');

// draft piles (2 players) without the new cards: no action cards to resolve
st = E.newGame(cfg(['cards'], { players: 2, draft: true }), 5);
ok(st.cards.every(function (c) { return c.kind !== 'action'; }), 'draft without the new cards has no action cards');

// every single rule on its own plays to the end with computers only, all cards kept
var unfinished = 0, lost = 0, s0 = 11;
function rng() { s0 = (s0 * 1103515245 + 12345) & 0x7fffffff; return s0 / 0x7fffffff; }
KEYS.forEach(function (k, ki) {
  var off = KEYS.filter(function (x) { return x !== k; });
  [{ players: 4 }, { players: 2, draft: true }].forEach(function (extra, xi) {
    for (var g = 0; g < 3; g++) {
      var s = E.newGame(cfg(off, Object.assign({ format: 'quick' }, extra)), 900 + ki * 10 + xi * 5 + g), n = 0;
      while (s.phase !== 'gameOver' && n++ < 40000) {
        if (s.phase === 'roundEnd') { s = E.apply(s, { t: 'next' }, { mutate: true }); continue; }
        var seat = E.toAct(s), LL = E.legal(s);
        s = E.apply(s, AI.choose(E.view(s, seat), seat, ['easy', 'medium', 'hard'][g], rng, LL), { mutate: true, trust: true });
        if (!T.conserved(E, s)) { lost++; break; }
      }
      if (s.phase !== 'gameOver') unfinished++;
    }
  });
});
eq([unfinished, lost], [0, 0], 'each advanced rule alone: computer-only games finish, every card kept');

// online rooms carry the choice through setup
import('../js/game.mjs').then(function (m) {
  var g = m.makeGame(E, AI);
  var s = g.setup(4, { edition: 'e2021', advanced: true, advOff: ['cards', 'second'], levels: ['medium', 'hard', 'easy', 'medium'] }, function () { return 0.5; }, []);
  eq([s.cfg.advOff, s.cards.length, s.cfg.handSize], [['cards', 'second'], 104, 6], 'online room setup keeps advOff');
  T.done('advpick');
});
