/* Odds layer: what a player can know from their own seat (their hand + everything face up).
   Works on a full state or on engine.view(state, seat). All numbers are exact hypergeometric
   probabilities over the cards this seat has not seen. */
(function (root) {
  'use strict';

  function handLen(st, q) { var h = st.hands[q]; return Array.isArray(h) ? h.length : h; }
  function drawLen(st) { return Array.isArray(st.draw) ? st.draw.length : st.draw; }

  // log of n choose k, cached
  var LF = [0];
  function lf(n) { while (LF.length <= n) LF.push(LF[LF.length - 1] + Math.log(LF.length)); return LF[n]; }
  function lC(n, k) { return (k < 0 || k > n) ? -Infinity : lf(n) - lf(k) - lf(n - k); }
  /** P(X = k) when drawing h cards from U of which m are "good" */
  function hyper(U, m, h, k) {
    if (k < 0 || k > h || k > m || h - k > U - m) return 0;
    return Math.exp(lC(m, k) + lC(U - m, h - k) - lC(U, h));
  }
  function atLeast(U, m, h, k) { var p = 0; for (var i = k; i <= Math.min(h, m); i++) p += hyper(U, m, h, i); return Math.min(1, p); }
  function atMost(U, m, h, k) { var p = 0; for (var i = 0; i <= Math.min(k, h, m); i++) p += hyper(U, m, h, i); return Math.min(1, p); }

  /** Counts by type of cards `seat` cannot see (in other hands, the draw pile, face-down draft cards). */
  // the browser turns on memoising (each rendered view is a fresh, never-mutated object);
  // simulations mutate states in place, so they leave it off
  var memo = null;
  function enableMemo() { memo = typeof WeakMap !== 'undefined' ? new WeakMap() : null; }
  function unseen(st, seat) {
    if (memo) { var mm = memo.get(st); if (mm && mm[seat]) return mm[seat]; }
    var r = unseenRaw(st, seat);
    if (memo) { var m2 = memo.get(st) || {}; m2[seat] = r; memo.set(st, m2); }
    return r;
  }
  function unseenRaw(st, seat) {
    var cnt = {}, total = 0;
    st.cards.forEach(function (c) { cnt[c.type] = (cnt[c.type] || 0) + 1; total++; });
    function see(id) { cnt[st.cards[id].type]--; total--; }
    st.hands[seat].forEach(see);
    st.stacks.forEach(function (k) { k.forEach(function (set) { set.cards.forEach(see); }); });
    st.discard.forEach(see); st.out.forEach(see);
    if (st.battle) st.battle.pot.forEach(see);
    if (st.piles) st.piles.forEach(function (pl) {
      var top = Array.isArray(pl) ? (pl.length ? pl[pl.length - 1] : null) : pl.top;
      if (top != null) see(top);
    });
    return { byType: cnt, total: total };
  }

  /** unseen cards that can fight over a set of `type` (that asset or any wild) */
  function fighters(st, un, type) {
    var m = un.byType[type] || 0;
    ['silver', 'gold', 'penny'].forEach(function (w) { m += un.byType[w] || 0; });
    return m;
  }

  /** cards in `seat`'s own hand that can fight over `type` */
  function myFighters(st, seat, type) {
    return st.hands[seat].filter(function (id) { var c = st.cards[id]; return c.kind === 'wild' || c.type === type; });
  }

  /**
   * Risk to `seat`'s top set: for each opponent, chance they hold at least one card that can start a
   * challenge, and chance they hold MORE fighters than you (so they'd win if both go all in).
   */
  function topRisk(st, seat, E) {
    var k = st.stacks[seat]; if (!k.length) return null;
    var set = k[k.length - 1], un = unseen(st, seat), m = fighters(st, un, set.type);
    var mine = myFighters(st, seat, set.type).length;
    var value = E.setValue(st, set), safe = k.length < 2;
    var per = [], none = 1, noneWin = 1;
    for (var q = 0; q < st.cfg.players; q++) {
      if (q === seat || (st.cfg.teams && st.team[q] === st.team[seat])) continue;
      var h = handLen(st, q);
      var canStart = safe ? 0 : (st.stacks[q].length ? atLeast(un.total, m, h, 1) : 0);
      var beats = safe ? 0 : (st.stacks[q].length ? atLeast(un.total, m, h, mine + 1) : 0);
      per.push({ seat: q, canStart: canStart, beats: beats });
      none *= 1 - canStart; noneWin *= 1 - beats;
    }
    // "any" figures treat opponents' hands as independent draws (very close for 4-6 cards from 50+)
    return { type: set.type, value: value, safe: safe, mine: mine, per: per, anyStart: 1 - none, anyBeat: 1 - noneWin, atRisk: value * (1 - noneWin) };
  }

  /** Chance `seat` wins a challenge on target's set if both sides play every fighter they hold. */
  function challengeOdds(st, seat, target, depth, E) {
    var k = st.stacks[target], set = k[k.length - 1 - (depth || 0)];
    var un = unseen(st, seat), m = fighters(st, un, set.type);
    var mine = myFighters(st, seat, set.type).length;
    var h = handLen(st, target);
    // attacker plays first, so attacker wins iff attacker fighters > defender fighters
    var pWin = mine ? atMost(un.total, m, h, mine - 1) : 0;
    return { type: set.type, value: E.setValue(st, set), mine: mine, pWin: pWin, oppHand: h };
  }

  /** chance the next player(s) can pair a card of `type` you discard (they hold that asset or a wild) */
  function giftRisk(st, seat, id) {
    var c = st.cards[id];
    if (c.kind === 'action') return 0;
    var un = unseen(st, seat);
    var m = c.kind === 'wild' ? Object.keys(un.byType).reduce(function (a, t) {
      var ct = null; for (var i = 0; i < st.cards.length; i++) if (st.cards[i].type === t) { ct = st.cards[i]; break; }
      return a + (ct && ct.kind === 'asset' ? un.byType[t] : 0);
    }, 0) : fighters(st, un, c.type);
    var n = st.cfg.players, q = (seat + 1) % n;
    var h = handLen(st, q);
    if (!h) return 0;
    return atLeast(un.total, m, h, 1);
  }

  var api = { enableMemo: enableMemo, hyper: hyper, atLeast: atLeast, atMost: atMost, unseen: unseen, fighters: fighters, myFighters: myFighters,
    topRisk: topRisk, challengeOdds: challengeOdds, giftRisk: giftRisk, handLen: handLen, drawLen: drawLen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CYAOdds = api;
})(this);
