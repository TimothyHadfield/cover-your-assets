/* Cover Your Assets engine. Pure: newGame(cfg, seed) -> state; apply(state, action) -> new state;
   legal(state) -> actions for the seat to act; view(state, seat) hides other players' secrets.
   Rules and sources: docs/rules-check.md. */
(function (root) {
  'use strict';
  var R = (typeof module !== 'undefined' && module.exports) ? require('./rules.js') : root.CYARules;

  // ---------- helpers ----------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rngNext(st) { // mulberry32, state kept in st.rng
    var t = (st.rng = (st.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(st, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rngNext(st) * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function card(st, id) { return st.cards[id]; }
  function isWild(st, id) { return st.cards[id].kind === 'wild'; }
  function isAsset(st, id) { return st.cards[id].kind === 'asset'; }
  function isAction(st, id) { return st.cards[id].kind === 'action'; }
  function weight(st, id) { return st.cards[id].type === 'penny' ? 2 : 1; }
  function removeFrom(arr, id) { var i = arr.indexOf(id); if (i < 0) throw new Error('card ' + id + ' not held'); arr.splice(i, 1); }
  function sameTeam(st, a, b) { return st.cfg.teams ? st.team[a] === st.team[b] : a === b; }

  // ---------- setup ----------
  function normalizeCfg(c) {
    c = Object.assign({ players: 4, edition: 'classic', advanced: false, draft: false, teams: false, format: 'million', target: 1000000, names: null }, c || {});
    c.players = Math.max(2, Math.min(6, c.players | 0));
    if (c.edition !== 'e2021') { c.advanced = false; c.draft = false; }
    if (c.players > 3) c.draft = false;
    if (!(c.players === 4 || c.players === 6)) c.teams = false;
    if (c.draft && c.teams) c.teams = false;
    if (c.advanced) c.handSize = 6;
    else if (c.draft && c.players === 2) c.handSize = 6;
    else if (c.edition === 'classic') c.handSize = c.players <= 3 ? 5 : 4;
    else c.handSize = 5;
    c.maxActions = c.advanced ? 2 : 1;
    return c;
  }

  function newGame(cfg, seed) {
    cfg = normalizeCfg(cfg);
    var st = {
      cfg: cfg, rng: (seed == null ? (Date.now() & 0x7fffffff) : seed) | 0,
      cards: R.buildDeck(cfg.edition, { advanced: cfg.advanced, players: cfg.players, draft: cfg.draft }),
      round: 0, dealer: cfg.players - 2, totals: [], roundScores: [], roundWins: [], history: [],
      team: [], log: [], winner: null, seq: 0
    };
    for (var s = 0; s < cfg.players; s++) {
      st.totals.push(0); st.roundWins.push(0);
      st.team.push(cfg.teams ? (cfg.players === 4 ? s % 2 : s % 3) : s);
    }
    startRound(st);
    return st;
  }

  function startRound(st) {
    var cfg = st.cfg, n = cfg.players;
    st.round += 1;
    st.dealer = (st.dealer + 1) % n;
    var deck = shuffle(st, st.cards.map(function (c) { return c.id; }));
    st.hands = []; st.stacks = []; st.discard = []; st.out = []; st.piles = null;
    for (var s = 0; s < n; s++) { st.hands.push([]); st.stacks.push([]); }
    if (cfg.draft) {
      st.piles = [];
      var np = 3;
      for (var p = 0; p < np; p++) st.piles.push(deck.splice(0, 10));
      if (cfg.advanced) { // action cards revealed at setup go face down into the middle
        for (p = 0; p < np; p++) fixSetupTop(st, st.piles[p]);
      }
    }
    for (var r = 0; r < cfg.handSize; r++) for (s = 0; s < n; s++) st.hands[(st.dealer + 1 + s) % n].push(deck.shift());
    st.draw = deck;
    if (!cfg.draft) st.discard.push(st.draw.shift());
    st.turn = (st.dealer + 1) % n;
    st.phase = 'turn'; st.acts = 0; st.lockout = []; st.battle = null; st.offer = null; st.pick = null; st.used = [];
    st.log.push({ m: 'Round ' + st.round + ' dealt', s: -1 });
    if (!hasCards(st, st.turn)) advanceTurn(st);
  }
  function fixSetupTop(st, pile) {
    var guard = 0;
    while (pile.length > 1 && isAction(st, pile[pile.length - 1]) && guard++ < 20) {
      var a = pile.pop(); pile.splice(Math.floor(pile.length / 2), 0, a);
    }
  }

  // ---------- queries ----------
  function hasCards(st, s) { return st.hands[s].length > 0; }
  function topSet(st, s) { var k = st.stacks[s]; return k.length ? k[k.length - 1] : null; }
  function setValue(st, set) { return set.cards.reduce(function (a, id) { return a + st.cards[id].value; }, 0); }
  function stackValue(st, s) { return st.stacks[s].reduce(function (a, set) { return a + setValue(st, set); }, 0); }
  function matches(st, id, type) { return isWild(st, id) || st.cards[id].type === type; }
  function pairOK(st, a, b) {
    if (a === b) return false;
    var ca = st.cards[a], cb = st.cards[b];
    if (ca.kind === 'action' || cb.kind === 'action') return false;
    if (ca.kind === 'wild' && cb.kind === 'wild') return false;
    if (ca.kind === 'asset' && cb.kind === 'asset') return ca.type === cb.type;
    return true; // asset + wild
  }
  function pairType(st, a, b) { return isAsset(st, a) ? st.cards[a].type : st.cards[b].type; }
  function teamOf(st, s) { return st.team[s]; }
  function scores(st) { // per seat, this round so far
    var out = []; for (var s = 0; s < st.cfg.players; s++) out.push(stackValue(st, s)); return out;
  }
  function pilesFor(st, s) { // draft piles seat s may use
    if (!st.piles) return [];
    if (st.cfg.players === 2) return [0, 1, 2];
    return [s, (s + 2) % 3]; // pile p lies between seat p and seat p+1
  }
  function pileNeighbours(st, p) { return st.cfg.players === 2 ? [0, 1] : [p, (p + 1) % 3]; }

  // challengeable sets of target seat for attacker
  function canChallengeAt(st, att, tgt, depth) {
    if (tgt === att || sameTeam(st, att, tgt)) return false;
    if (st.stacks[att].length === 0) return false; // must own a set first
    if (depth > 0 && !st.cfg.advanced) return false;
    if (st.stacks[tgt].length < depth + 2) return false; // the bottom (first) set is safe
    if (st.lockout.indexOf(tgt) >= 0) return false;
    return true;
  }

  // ---------- legal actions ----------
  function legal(st) {
    var out = [];
    if (st.phase === 'turn') {
      var s = st.turn, h = st.hands[s], i, j;
      if (st.acts > 0) out.push({ t: 'end' });
      var seen = {};
      for (i = 0; i < h.length; i++) for (j = i + 1; j < h.length; j++) {
        if (!pairOK(st, h[i], h[j])) continue;
        var key = [st.cards[h[i]].type, st.cards[h[j]].type].sort().join('+');
        if (seen[key]) continue; seen[key] = 1;
        out.push({ t: 'pair', cards: [h[i], h[j]] });
      }
      var d = st.discard.length ? st.discard[st.discard.length - 1] : null;
      if (d != null) {
        seen = {};
        h.forEach(function (x) {
          if (pairOK(st, x, d) && !seen[st.cards[x].type]) { seen[st.cards[x].type] = 1; out.push({ t: 'pairDiscard', card: x }); }
        });
      }
      if (st.piles) draftActions(st, s).forEach(function (a) { out.push(a); });
      for (var tg = 0; tg < st.cfg.players; tg++) for (var depth = 0; depth < 2; depth++) {
        if (!canChallengeAt(st, s, tg, depth)) continue;
        var set = st.stacks[tg][st.stacks[tg].length - 1 - depth];
        openers(st, h, set.type, depth ? 2 : 1).forEach(function (cs) { out.push({ t: 'challenge', target: tg, depth: depth, cards: cs }); });
      }
      if (st.cfg.advanced) {
        var top = topSet(st, s);
        seen = {};
        h.forEach(function (x) {
          var c = st.cards[x];
          if (top && c.kind === 'asset' && c.type === top.type && !seen.imp) { seen.imp = 1; out.push({ t: 'improve', card: x }); }
          if (c.type === 'swap' && !seen.swap && top) {
            seen.swap = 1;
            for (var o = 0; o < st.cfg.players; o++) if (o !== s && st.stacks[o].length) out.push({ t: 'swap', card: x, target: o });
          }
          if (c.type === 'move' && !seen.move) {
            seen.move = 1;
            for (var o2 = 0; o2 < st.cfg.players; o2++) if (st.stacks[o2].length >= 2) {
              out.push({ t: 'move', card: x, target: o2, dir: 'down' });
              out.push({ t: 'move', card: x, target: o2, dir: 'up' });
            }
          }
        });
      }
      seen = {};
      h.forEach(function (x) { var k = st.cards[x].type; if (!seen[k]) { seen[k] = 1; out.push({ t: 'discard', card: x }); } });
    } else if (st.phase === 'battle') {
      var b = st.battle, set2 = battleSet(st);
      out.push({ t: 'fold' });
      openers(st, st.hands[b.toAct], set2.type, b.need).forEach(function (cs) { out.push({ t: 'play', cards: cs }); });
    } else if (st.phase === 'offer') {
      var of = st.offer, oset = topSet(st, of.owner);
      out.push({ t: 'pass' });
      openers(st, st.hands[of.seats[0]], oset.type, 1).forEach(function (cs) { out.push({ t: 'play', cards: cs }); });
    } else if (st.phase === 'pick') {
      out.push({ t: 'pick', dir: 'down' }, { t: 'pick', dir: 'up' });
    }
    return out;
  }

  // card combinations from hand h that answer `need` weight for a set of `type` (deduped by card type)
  function openers(st, h, type, need) {
    var ok = h.filter(function (x) { return matches(st, x, type); });
    var out = [], seen = {};
    ok.forEach(function (x) {
      var w = weight(st, x);
      if (w >= need) { var k = st.cards[x].type; if (!seen[k]) { seen[k] = 1; out.push([x]); } }
    });
    if (need === 2) {
      for (var i = 0; i < ok.length; i++) for (var j = i + 1; j < ok.length; j++) {
        if (weight(st, ok[i]) !== 1 || weight(st, ok[j]) !== 1) continue;
        var k2 = [st.cards[ok[i]].type, st.cards[ok[j]].type].sort().join('+');
        if (!seen[k2]) { seen[k2] = 1; out.push([ok[i], ok[j]]); }
      }
    }
    return out;
  }

  // top card id of draft pile p (works on full state and on views)
  function pTop(st, p) {
    var pl = st.piles[p];
    if (Array.isArray(pl)) return pl.length ? pl[pl.length - 1] : null;
    return pl ? pl.top : null;
  }

  function draftActions(st, s) {
    var out = [], h = st.hands[s], piles = pilesFor(st, s), seen = {};
    var tops = {}; piles.forEach(function (p) { tops[p] = pTop(st, p); });
    var typeAt = function (p) { return tops[p] == null ? null : st.cards[tops[p]].type; };
    var wildAt = function (p) { return tops[p] != null && isWild(st, tops[p]); };
    var types = {};
    piles.forEach(function (p) { if (tops[p] != null && isAsset(st, tops[p])) types[typeAt(p)] = 1; });
    h.forEach(function (x) {
      var cx = st.cards[x]; if (cx.kind === 'action') return;
      // pick an asset type T that is on top of at least one usable pile; collect every top of type T
      Object.keys(types).forEach(function (T) {
        if (cx.kind === 'asset' && cx.type !== T) return;
        var use = piles.filter(function (p) { return typeAt(p) === T; });
        var key = cx.type + '>' + T;
        if (!seen[key]) { seen[key] = 1; out.push({ t: 'draft', card: x, piles: use }); }
        // an asset in hand may also take one wild that is on top of a usable pile
        if (cx.kind === 'asset') piles.forEach(function (p) {
          if (!wildAt(p)) return;
          var k3 = key + '+w' + p; if (!seen[k3]) { seen[k3] = 1; out.push({ t: 'draft', card: x, piles: use.concat([p]) }); }
        });
      });
      // asset in hand + a wild on top, when no top matches the asset
      if (cx.kind === 'asset' && !types[cx.type]) piles.forEach(function (p) {
        if (!wildAt(p)) return;
        var k4 = cx.type + '>w' + p; if (!seen[k4]) { seen[k4] = 1; out.push({ t: 'draft', card: x, piles: [p] }); }
      });
    });
    return out;
  }

  function battleSet(st) { var b = st.battle; var k = st.stacks[b.defender]; return k[b.index]; }

  // whose decision is it?
  function toAct(st) {
    if (st.phase === 'turn') return st.turn;
    if (st.phase === 'battle') return st.battle.toAct;
    if (st.phase === 'offer') return st.offer.seats[0];
    if (st.phase === 'pick') return st.pick.seats[0];
    return -1;
  }

  // ---------- apply ----------
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function isLegal(st, a) {
    // id-exact check: same type of card choice is acceptable (any copy of the same card type)
    var L = legal(st);
    var sig = function (x) {
      var y = clone(x);
      if (y.cards) y.cards = y.cards.map(function (id) { return st.cards[id].type; }).sort();
      if (y.card != null) y.card = st.cards[y.card].type;
      if (y.piles) y.piles = y.piles.slice().sort();
      return JSON.stringify(y, Object.keys(y).sort());
    };
    var want = sig(a);
    return L.some(function (l) { return sig(l) === want; });
  }

  // opts.mutate: change st0 in place (simulations); opts.trust: skip the legality check (AI picked from legal())
  function apply(st0, a, opts) {
    opts = opts || {};
    var st = opts.mutate ? st0 : clone(st0);
    if (st.phase === 'gameOver') throw new Error('game over');
    if (st.phase === 'roundEnd') {
      if (a.t !== 'next') throw new Error('round over: send next');
      startRound(st); st.seq++; return st;
    }
    var seat = toAct(st);
    // the cards named must be in the acting seat's hand
    var ids = (a.cards || []).concat(a.card != null ? [a.card] : []);
    ids.forEach(function (id) { if (st.hands[seat].indexOf(id) < 0) throw new Error('card ' + id + ' not in hand of seat ' + seat); });
    if (new Set(ids).size !== ids.length) throw new Error('duplicate card');
    if (!opts.trust && !isLegal(st, a)) throw new Error('illegal action ' + JSON.stringify(a));
    st.seq++;
    if (st.phase === 'turn') doTurnAction(st, a);
    else if (st.phase === 'battle') doBattle(st, a);
    else if (st.phase === 'offer') doOffer(st, a);
    else if (st.phase === 'pick') doPick(st, a);
    return st;
  }

  function pushSet(st, s, type, cards) {
    // wilds sit under the asset (cosmetic): order assets last
    cards = cards.slice().sort(function (x, y) { return (isAsset(st, x) ? 1 : 0) - (isAsset(st, y) ? 1 : 0); });
    st.stacks[s].push({ type: type, cards: cards });
  }

  function doTurnAction(st, a) {
    var s = st.turn, h = st.hands[s];
    if (a.t === 'end') { endTurn(st); return; }
    st.acts += 1;
    if (a.t === 'pair') {
      a.cards.forEach(function (id) { removeFrom(h, id); });
      pushSet(st, s, pairType(st, a.cards[0], a.cards[1]), a.cards);
      st.log.push({ s: s, m: 'pair', type: topSet(st, s).type, cards: a.cards.slice() });
    } else if (a.t === 'pairDiscard') {
      var d = st.discard.pop(); removeFrom(h, a.card);
      pushSet(st, s, pairType(st, a.card, d), [a.card, d]);
      st.log.push({ s: s, m: 'pairDiscard', type: topSet(st, s).type, cards: [a.card, d] });
    } else if (a.t === 'discard') {
      removeFrom(h, a.card); st.discard.push(a.card);
      st.log.push({ s: s, m: 'discard', cards: [a.card] });
      if (st.cfg.advanced && st.acts === 1) refill(st, s);
    } else if (a.t === 'improve') {
      removeFrom(h, a.card); topSet(st, s).cards.push(a.card);
      st.log.push({ s: s, m: 'improve', type: topSet(st, s).type, cards: [a.card] });
    } else if (a.t === 'swap') {
      removeFrom(h, a.card); st.out.push(a.card);
      var mine = st.stacks[s].pop(), theirs = st.stacks[a.target].pop();
      st.stacks[s].push(theirs); st.stacks[a.target].push(mine);
      st.log.push({ s: s, m: 'swap', target: a.target, cards: [a.card] });
    } else if (a.t === 'move') {
      removeFrom(h, a.card); st.out.push(a.card);
      moveSet(st, a.target, a.dir);
      st.log.push({ s: s, m: 'move', target: a.target, dir: a.dir, cards: [a.card] });
    } else if (a.t === 'challenge') {
      a.cards.forEach(function (id) { removeFrom(h, id); });
      var idx = st.stacks[a.target].length - 1 - a.depth;
      st.battle = { attacker: s, defender: a.target, index: idx, pot: a.cards.slice(), last: s, toAct: a.target,
        need: needAfter(st, a.cards), plays: [{ s: s, cards: a.cards.slice() }] };
      st.used.push(a.target);
      st.phase = 'battle';
      st.log.push({ s: s, m: 'challenge', target: a.target, type: st.stacks[a.target][idx].type, cards: a.cards.slice() });
      if (!openers(st, st.hands[a.target], st.stacks[a.target][idx].type, st.battle.need).length) finishBattle(st);
      return;
    } else if (a.t === 'draft') {
      removeFrom(h, a.card);
      var got = [a.card], T = null;
      a.piles.forEach(function (p) { got.push(st.piles[p].pop()); });
      got.forEach(function (id) { if (isAsset(st, id)) T = st.cards[id].type; });
      pushSet(st, s, T, got);
      st.log.push({ s: s, m: 'draft', type: T, cards: got.slice() });
      var flipped = a.piles.slice();
      // who may challenge: the opponent(s) beside the piles used
      var seats = [];
      a.piles.forEach(function (p) { pileNeighbours(st, p).forEach(function (q) { if (q !== s && seats.indexOf(q) < 0) seats.push(q); }); });
      seats = seats.filter(function (q) { return st.hands[q].some(function (x) { return matches(st, x, T); }); });
      st.offer = { owner: s, seats: seats, piles: flipped };
      if (seats.length) { st.phase = 'offer'; return; }
      afterDraft(st);
      return;
    }
    afterAction(st);
  }

  function moveSet(st, tgt, dir) {
    var k = st.stacks[tgt]; if (k.length < 2) return;
    if (dir === 'down') k.unshift(k.pop()); else k.push(k.shift());
  }

  function needAfter(st, cards) { return (cards.length === 1 && st.cards[cards[0]].type === 'penny') ? 2 : 1; }

  function doBattle(st, a) {
    var b = st.battle, s = b.toAct;
    if (a.t === 'fold') { st.log.push({ s: s, m: 'fold' }); finishBattle(st); return; }
    a.cards.forEach(function (id) { removeFrom(st.hands[s], id); });
    b.pot = b.pot.concat(a.cards); b.last = s; b.need = needAfter(st, a.cards);
    b.plays.push({ s: s, cards: a.cards.slice() });
    st.log.push({ s: s, m: 'answer', cards: a.cards.slice() });
    b.toAct = (s === b.attacker) ? b.defender : b.attacker;
    var canGo = openers(st, st.hands[b.toAct], battleSet(st).type, b.need).length > 0;
    if (!canGo) finishBattle(st);
  }

  function finishBattle(st) {
    var b = st.battle, k = st.stacks[b.defender], set = k[b.index];
    set.cards = set.cards.concat(b.pot);
    if (b.last === b.defender) {
      st.log.push({ s: b.defender, m: 'held', type: set.type, value: setValue(st, set) });
    } else {
      k.splice(b.index, 1);
      st.stacks[b.attacker].push(set);
      st.log.push({ s: b.attacker, m: 'stole', from: b.defender, type: set.type, value: setValue(st, set) });
    }
    // advanced: losing a challenge blocks challenging that player again this turn
    if (b.last === b.defender && b.attacker === st.turn && !b.fromOffer) st.lockout.push(b.defender);
    var fromOffer = b.fromOffer;
    st.battle = null; st.phase = 'turn';
    if (fromOffer) { afterDraft(st); return; }
    afterAction(st);
  }

  function doOffer(st, a) {
    var of = st.offer, q = of.seats.shift();
    if (a.t === 'pass') {
      st.log.push({ s: q, m: 'pass' });
      if (of.seats.length) return;
      afterDraft(st); return;
    }
    a.cards.forEach(function (id) { removeFrom(st.hands[q], id); });
    var idx = st.stacks[of.owner].length - 1;
    st.used.push(q);
    st.battle = { attacker: q, defender: of.owner, index: idx, pot: a.cards.slice(), last: q, toAct: of.owner,
      need: needAfter(st, a.cards), plays: [{ s: q, cards: a.cards.slice() }], fromOffer: true };
    st.log.push({ s: q, m: 'challenge', target: of.owner, type: st.stacks[of.owner][idx].type, cards: a.cards.slice() });
    st.phase = 'battle';
    if (!openers(st, st.hands[of.owner], st.stacks[of.owner][idx].type, st.battle.need).length) finishBattle(st);
  }

  function afterDraft(st) {
    var of = st.offer; st.offer = null; st.phase = 'turn';
    // flip: the next card of each used pile is now the top; advanced: action cards take effect at once
    if (st.cfg.advanced) { if (resolveRevealed(st, of.piles.slice())) return; }
    afterAction(st);
  }

  // returns true if waiting on a pick
  function resolveRevealed(st, piles) {
    while (piles.length) {
      var p = piles[0], pl = st.piles[p];
      if (!pl.length || !isAction(st, pl[pl.length - 1])) { piles.shift(); continue; }
      var id = pl.pop(), who = pileNeighbours(st, p);
      if (st.cards[id].type === 'swap') {
        if (st.stacks[who[0]].length && st.stacks[who[1]].length) {
          var x = st.stacks[who[0]].pop(), y = st.stacks[who[1]].pop();
          st.stacks[who[0]].push(y); st.stacks[who[1]].push(x);
          st.out.push(id); st.log.push({ s: -1, m: 'revealSwap', seats: who.slice() });
        } else {
          pl.splice(Math.floor(pl.length / 2), 0, id); // back into the middle, flip another
          st.log.push({ s: -1, m: 'revealSwapVoid' });
          if (pl.length === 1) { piles.shift(); } // only card left: stop
        }
      } else { // move: each affected player decides for the opponent's stack
        st.out.push(id); st.log.push({ s: -1, m: 'revealMove', seats: who.slice() });
        var seats = [], targets = [];
        if (st.stacks[who[1]].length >= 2) { seats.push(who[0]); targets.push(who[1]); }
        if (st.stacks[who[0]].length >= 2) { seats.push(who[1]); targets.push(who[0]); }
        if (seats.length) { st.pick = { seats: seats, targets: targets, piles: piles }; st.phase = 'pick'; return true; }
      }
    }
    return false;
  }

  function doPick(st, a) {
    var pk = st.pick, s = pk.seats.shift(), tgt = pk.targets.shift();
    moveSet(st, tgt, a.dir); st.log.push({ s: s, m: 'move', target: tgt, dir: a.dir });
    if (pk.seats.length) return;
    st.pick = null; st.phase = 'turn';
    if (resolveRevealed(st, pk.piles)) return;
    afterAction(st);
  }

  function anyLegalTurnAction(st) { return legal(st).some(function (x) { return x.t !== 'end'; }); }

  function afterAction(st) {
    if (st.acts < st.cfg.maxActions && hasCards(st, st.turn) && anyLegalTurnAction(st)) return; // advanced: may take a 2nd action
    endTurn(st);
  }

  function refill(st, s) {
    while (st.hands[s].length < st.cfg.handSize && st.draw.length) st.hands[s].push(st.draw.shift());
  }

  function endTurn(st) {
    var s = st.turn, n = st.cfg.players;
    refill(st, s);
    for (var i = 1; i < n; i++) { var q = (s + i) % n; if (st.used.indexOf(q) >= 0) refill(st, q); }
    st.used = []; st.lockout = []; st.acts = 0;
    advanceTurn(st);
  }

  function advanceTurn(st) {
    var n = st.cfg.players;
    for (var i = 1; i <= n; i++) {
      var q = (st.turn + i) % n;
      if (hasCards(st, q)) { st.turn = q; st.phase = 'turn'; return; }
    }
    endRound(st);
  }

  function endRound(st) {
    var sc = scores(st), n = st.cfg.players, i;
    st.roundScores = sc;
    for (i = 0; i < n; i++) st.totals[i] += sc[i];
    var unit = units(st, sc), best = Math.max.apply(null, unit.vals);
    unit.vals.forEach(function (v, u) { if (v === best) unit.seats[u].forEach(function (q) { st.roundWins[q] += 1; }); });
    st.history.push({ round: st.round, scores: sc.slice() });
    st.log.push({ s: -1, m: 'roundEnd', round: st.round });
    st.phase = 'roundEnd';
    var w = checkWinner(st);
    if (w) { st.winner = w; st.phase = 'gameOver'; st.log.push({ s: -1, m: 'gameOver' }); }
  }

  // group seats by team (or each seat alone)
  function units(st, perSeat) {
    var map = {}, seats = [], vals = [];
    for (var s = 0; s < st.cfg.players; s++) {
      var t = st.team[s];
      if (!(t in map)) { map[t] = seats.length; seats.push([]); vals.push(0); }
      seats[map[t]].push(s); vals[map[t]] += perSeat[s];
    }
    return { seats: seats, vals: vals };
  }

  function checkWinner(st) {
    var f = st.cfg.format, u = units(st, st.totals), best = Math.max.apply(null, u.vals);
    var leaders = []; u.vals.forEach(function (v, i) { if (v === best) leaders.push(i); });
    var done = false;
    if (f === 'quick') done = true;
    else if (f === 'three') done = st.round >= 3;
    else if (f === 'bestof2') {
      var w = units(st, st.roundWins), bw = Math.max.apply(null, w.vals);
      var teamDiv = st.cfg.teams ? (st.cfg.players === 4 ? 2 : 2) : 1;
      if (bw / teamDiv >= 2) {
        var top = []; w.vals.forEach(function (v, i) { if (v === bw) top.push(i); });
        if (top.length === 1) return { seats: w.seats[top[0]], unit: top[0] };
      }
      return null;
    } else done = best >= st.cfg.target;
    if (!done) return null;
    if (leaders.length > 1) return null; // exact tie: play another round
    return { seats: u.seats[leaders[0]], unit: leaders[0] };
  }

  // ---------- views ----------
  function view(st, seat) {
    var v = clone(st);
    delete v.rng;
    v.draw = v.draw.length; v.me = seat;
    v.hands = st.hands.map(function (h, s) { return s === seat ? h.slice() : h.length; });
    if (st.piles) v.piles = st.piles.map(function (pl) { return { count: pl.length, top: pl.length ? pl[pl.length - 1] : null }; });
    return v;
  }

  var api = {
    newGame: newGame, apply: apply, legal: legal, view: view, toAct: toAct, normalizeCfg: normalizeCfg,
    scores: scores, stackValue: stackValue, setValue: setValue, topSet: topSet, pairOK: pairOK, matches: matches,
    canChallengeAt: canChallengeAt, openers: openers, pilesFor: pilesFor, units: units, clone: clone, isLegal: isLegal
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CYAEngine = api;
})(this);
