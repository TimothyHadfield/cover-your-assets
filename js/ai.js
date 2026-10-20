/* Computer players. Each decision sees only what that seat could see at a real table
   (own hand, all face-up cards, hand sizes). Works on full states and on views.
   easy   = plays whatever is legal, pairs about half the time it can
   medium = simple greedy habits (biggest pair, defend when it can)
   hard   = scores every legal move in dollars with the odds layer (risk to its top set,
            win chance of each fight) and plays the best one. Same scorer powers the Hint. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var E = node ? require('./engine.js') : root.CYAEngine;
  var O = node ? require('./odds.js') : root.CYAOdds;

  var P = { keepAsset: 0.45, keepPair: 0.8, keepWild: 0.75, keepAction: 6000, expose: 0.6, gift: 0.5 };

  function val(st, id) { return st.cards[id].value; }
  function kind(st, id) { return st.cards[id].kind; }
  function typ(st, id) { return st.cards[id].type; }

  // what a hand card is worth to keep (if it is lost in a fight or thrown away)
  function keep(st, hand, id) {
    var c = st.cards[id];
    if (c.kind === 'action') return P.keepAction;
    if (c.kind === 'wild') return c.value * P.keepWild + (c.type === 'penny' ? 8000 : 0);
    var twins = hand.filter(function (x) { return x !== id && (typ(st, x) === c.type || kind(st, x) === 'wild'); }).length;
    return c.value * (twins ? P.keepPair : P.keepAsset);
  }
  function sumKeep(st, hand, ids) { return ids.reduce(function (a, id) { return a + keep(st, hand, id); }, 0); }
  function minus(hand, ids) { return hand.filter(function (x) { return ids.indexOf(x) < 0; }); }
  function cheapestFirst(st, ids) {
    return ids.slice().sort(function (a, b) { return (kind(st, a) === 'wild') - (kind(st, b) === 'wild') || val(st, a) - val(st, b); });
  }
  function opponents(st, seat) {
    var out = [];
    for (var q = 0; q < st.cfg.players; q++) if (q !== seat && !(st.cfg.teams && st.team[q] === st.team[seat])) out.push(q);
    return out;
  }

  // expected loss on a set sitting on top of `seat`'s stack, given the hand left to defend it
  function exposure(st, seat, type, value, handAfter, stackLenAfter, un) {
    if (stackLenAfter < 2) return 0; // the bottom set can't be challenged
    var m = O.fighters(st, un, type);
    var mine = handAfter.filter(function (id) { return kind(st, id) === 'wild' || typ(st, id) === type; }).length;
    var none = 1;
    opponents(st, seat).forEach(function (q) {
      var h = O.handLen(st, q);
      if (!st.stacks[q].length && !st.piles) return; // they can't steal before owning a set
      none *= 1 - O.atLeast(un.total, m, h, mine + 1);
    });
    return (1 - none) * value * P.expose;
  }

  function fightWin(st, un, type, mine, oppHand, oppPlayed) {
    var m = O.fighters(st, un, type);
    if (mine <= 0) return 0;
    return O.atMost(un.total, m, oppHand, mine - 1 + (oppPlayed || 0) * 0);
  }

  // ---------- the hard scorer ----------
  function score(st, seat, a, un) {
    var hand = st.hands[seat], k = st.stacks[seat], top = k.length ? k[k.length - 1] : null, why = '';
    var topNow = top ? exposure(st, seat, top.type, E.setValue(st, top), hand, k.length, un) : 0;
    var s = 0;
    switch (a.t) {
      case 'end': return { s: 0, why: 'Stop here' };
      case 'pair': case 'pairDiscard': {
        var ids = a.t === 'pair' ? a.cards : [a.card, st.discard[st.discard.length - 1]];
        var fromHand = a.t === 'pair' ? a.cards : [a.card];
        var T = kind(st, ids[0]) === 'asset' ? typ(st, ids[0]) : typ(st, ids[1]);
        var V = val(st, ids[0]) + val(st, ids[1]);
        var after = minus(hand, fromHand);
        var risk = exposure(st, seat, T, V, after, k.length + 1, un);
        var cover = st.cfg.advanced ? topNow * 0.5 : topNow;
        s = V - risk - sumKeep(st, hand, fromHand) + cover;
        why = 'Banks $' + (V / 1000) + 'K' + (cover > 2000 ? ' and covers your top set' : '') + (risk > 3000 ? '; risk ~$' + Math.round(risk / 1000) + 'K' : '');
        return { s: s, why: why };
      }
      case 'challenge': {
        var tk = st.stacks[a.target], set = tk[tk.length - 1 - a.depth], VS = E.setValue(st, set);
        var my = hand.filter(function (id) { return kind(st, id) === 'wild' || typ(st, id) === set.type; });
        var eff = my.length - (a.depth ? 1 : 0);
        var pw = fightWin(st, un, set.type, eff, O.handLen(st, a.target));
        var commit = sumKeep(st, hand, my);
        var gainMine = my.reduce(function (x, id) { return x + val(st, id); }, 0) - commit;
        var newRisk = exposure(st, seat, set.type, VS, [], k.length + 1, un);
        s = pw * (VS + gainMine - newRisk + topNow) - (1 - pw) * commit - (a.cards.length > 1 ? 0 : sumKeep(st, hand, a.cards) * 0.05);
        // open with the cheapest card
        s -= a.cards.reduce(function (x, id) { return x + (kind(st, id) === 'wild' ? 50 : 0) + val(st, id) / 1e4; }, 0);
        why = Math.round(pw * 100) + '% to take $' + (VS / 1000) + 'K';
        return { s: s, why: why };
      }
      case 'discard': {
        var g = O.giftRisk(st, seat, a.card);
        s = -keep(st, hand, a.card) - g * val(st, a.card) * P.gift;
        why = 'Least useful card' + (g > 0.4 ? ' (next player may pair it)' : '');
        return { s: s, why: why };
      }
      case 'improve': {
        var V2 = E.setValue(st, top) + val(st, a.card), after2 = minus(hand, [a.card]);
        var r2 = exposure(st, seat, top.type, V2, after2, k.length, un);
        s = val(st, a.card) - keep(st, hand, a.card) - (r2 - topNow);
        return { s: s, why: 'Adds $' + val(st, a.card) / 1000 + 'K to your top set' };
      }
      case 'swap': {
        var theirs = st.stacks[a.target][st.stacks[a.target].length - 1], Vt = E.setValue(st, theirs), Vm = E.setValue(st, top);
        var rT = exposure(st, seat, theirs.type, Vt, minus(hand, [a.card]), k.length, un);
        s = Vt - Vm - rT + topNow - keep(st, hand, a.card);
        return { s: s, why: 'Trade your $' + Vm / 1000 + 'K top for their $' + Vt / 1000 + 'K' };
      }
      case 'move': {
        var tk2 = st.stacks[a.target], n2 = tk2.length;
        var newTop = a.dir === 'down' ? tk2[n2 - 2] : tk2[0];
        if (a.target === seat) {
          var rNew = exposure(st, seat, newTop.type, E.setValue(st, newTop), minus(hand, [a.card]), n2, un);
          s = topNow - rNew - keep(st, hand, a.card);
          return { s: s, why: a.dir === 'down' ? 'Hides your top set at the bottom' : 'Brings your bottom set up' };
        }
        var my2 = hand.filter(function (id) { return id !== a.card && (kind(st, id) === 'wild' || typ(st, id) === newTop.type); }).length;
        var oldTop = tk2[n2 - 1];
        var my3 = hand.filter(function (id) { return id !== a.card && (kind(st, id) === 'wild' || typ(st, id) === oldTop.type); }).length;
        var gainNew = fightWin(st, un, newTop.type, my2, O.handLen(st, a.target)) * E.setValue(st, newTop);
        var gainOld = fightWin(st, un, oldTop.type, my3, O.handLen(st, a.target)) * E.setValue(st, oldTop);
        s = 0.5 * (gainNew - gainOld) - keep(st, hand, a.card);
        return { s: s, why: 'Exposes their $' + E.setValue(st, newTop) / 1000 + 'K set' };
      }
      case 'draft': {
        var got = [a.card];
        a.piles.forEach(function (p) { var pl = st.piles[p]; got.push(Array.isArray(pl) ? pl[pl.length - 1] : pl.top); });
        var T3 = null; got.forEach(function (id) { if (kind(st, id) === 'asset') T3 = typ(st, id); });
        var V3 = got.reduce(function (x, id) { return x + val(st, id); }, 0);
        var after3 = minus(hand, [a.card]);
        var mine3 = after3.filter(function (id) { return kind(st, id) === 'wild' || typ(st, id) === T3; }).length;
        var m3 = O.fighters(st, un, T3), none3 = 1;
        opponents(st, seat).forEach(function (q) { none3 *= 1 - O.atLeast(un.total, m3, O.handLen(st, q), mine3 + 1); });
        var r3 = (1 - none3) * V3 * 0.8 + exposure(st, seat, T3, V3, after3, k.length + 1, un) * 0.5;
        s = V3 - r3 - keep(st, hand, a.card) + topNow;
        return { s: s, why: 'Drafts $' + V3 / 1000 + 'K' };
      }
      case 'pick': {
        var tgt = st.pick.targets[0], tk3 = st.stacks[tgt], n3 = tk3.length;
        var top3 = a.dir === 'down' ? tk3[n3 - 2] : tk3[0];
        return { s: E.setValue(st, top3), why: 'Leaves their bigger set on top' };
      }
    }
    return { s: -1e9, why: '' };
  }

  // battle / offer decisions: continue (play) or stop
  function fightScore(st, seat, a, un) {
    var b = st.battle, set, opp, potV = 0, my;
    if (st.phase === 'offer') { opp = st.offer.owner; set = st.stacks[opp][st.stacks[opp].length - 1]; }
    else { opp = b.toAct === b.attacker ? b.defender : b.attacker; set = st.stacks[b.defender][b.index]; potV = b.pot.reduce(function (x, id) { return x + val(st, id); }, 0); }
    if (a.t === 'fold' || a.t === 'pass') return { s: 0, why: 'Let it go' };
    var hand = st.hands[seat];
    my = hand.filter(function (id) { return kind(st, id) === 'wild' || typ(st, id) === set.type; });
    var VS = E.setValue(st, set);
    var pw = fightWin(st, un, set.type, my.length - (a.cards.length > 1 ? 1 : 0), O.handLen(st, opp));
    var commit = sumKeep(st, hand, my);
    var s = pw * (VS + potV) - (1 - pw) * commit;
    s -= a.cards.reduce(function (x, id) { return x + (kind(st, id) === 'wild' ? 50 : 0) + val(st, id) / 1e4; }, 0);
    return { s: s, why: Math.round(pw * 100) + '% to win $' + Math.round((VS + potV) / 1000) + 'K' };
  }

  /** every legal move with its dollar score, best first */
  function rank(st, seat, legal) {
    legal = legal || E.legal(st);
    var un = O.unseen(st, seat);
    var fight = st.phase === 'battle' || st.phase === 'offer';
    return legal.map(function (a) {
      var r = fight ? fightScore(st, seat, a, un) : score(st, seat, a, un);
      return { a: a, s: r.s, why: r.why };
    }).sort(function (x, y) { return y.s - x.s; });
  }

  // ---------- easy and medium ----------
  function easy(st, seat, legal, rnd) {
    var fight = st.phase === 'battle' || st.phase === 'offer';
    if (fight) {
      var plays = legal.filter(function (a) { return a.t === 'play'; });
      return plays.length && rnd() < 0.5 ? plays[Math.floor(rnd() * plays.length)] : legal[0];
    }
    var pairs = legal.filter(function (a) { return a.t === 'pair' || a.t === 'pairDiscard' || a.t === 'draft'; });
    if (pairs.length && rnd() < 0.5) return pairs[Math.floor(rnd() * pairs.length)];
    var other = legal.filter(function (a) { return a.t !== 'end'; });
    return other[Math.floor(rnd() * other.length)] || legal[0];
  }

  function medium(st, seat, legal, rnd) {
    var fight = st.phase === 'battle' || st.phase === 'offer';
    if (fight) {
      var set = st.phase === 'offer' ? E.topSet(st, st.offer.owner) : st.stacks[st.battle.defender][st.battle.index];
      var plays = legal.filter(function (a) { return a.t === 'play'; });
      if (!plays.length) return legal[0];
      // play the cheapest card when the set is worth it
      plays.sort(function (x, y) { return cost(x) - cost(y); });
      return E.setValue(st, set) >= 10000 ? plays[0] : legal[0];
    }
    function cost(a) { return (a.cards || [a.card]).reduce(function (x, id) { return x + val(st, id) + (kind(st, id) === 'wild' ? 30000 : 0); }, 0); }
    function gain(a) {
      if (a.t === 'pair') return val(st, a.cards[0]) + val(st, a.cards[1]) - (a.cards.some(function (id) { return kind(st, id) === 'wild'; }) ? 20000 : 0);
      if (a.t === 'pairDiscard') return val(st, a.card) + val(st, st.discard[st.discard.length - 1]) + 2000;
      if (a.t === 'draft') return 15000;
      return -1;
    }
    var best = null, bg = -1;
    legal.forEach(function (a) { var g = gain(a); if (g > bg) { bg = g; best = a; } });
    var ch = legal.filter(function (a) { return a.t === 'challenge'; }).map(function (a) {
      var tk = st.stacks[a.target], set2 = tk[tk.length - 1 - a.depth];
      var n = st.hands[seat].filter(function (id) { return kind(st, id) === 'wild' || typ(st, id) === set2.type; }).length;
      return { a: a, v: E.setValue(st, set2), n: n };
    }).filter(function (c) { return c.n >= 2 && c.v >= 15000; }).sort(function (x, y) { return y.v - x.v; });
    if (ch.length && (!best || ch[0].v > bg)) return ch[0].a;
    if (best && bg > 0) return best;
    var adv = legal.filter(function (a) { return a.t === 'improve'; });
    if (adv.length) return adv[0];
    if (legal.some(function (a) { return a.t === 'end'; })) return { t: 'end' };
    var ds = legal.filter(function (a) { return a.t === 'discard'; }).sort(function (x, y) { return cost(x) - cost(y); });
    return ds[0] || legal[0];
  }

  function hard(st, seat, legal) { return rank(st, seat, legal)[0].a; }

  /** choose an action for the seat whose turn it is. level: easy | medium | hard */
  function choose(st, seat, level, rnd, legal) {
    rnd = rnd || Math.random;
    legal = legal || E.legal(st);
    if (st.phase === 'pick') return level === 'easy' ? legal[Math.floor(rnd() * legal.length)] : rank(st, seat, legal)[0].a;
    if (level === 'easy') return easy(st, seat, legal, rnd);
    if (level === 'medium') return medium(st, seat, legal, rnd);
    return hard(st, seat, legal);
  }

  var api = { choose: choose, rank: rank, P: P };
  if (node) module.exports = api; else root.CYAAI = api;
})(this);
