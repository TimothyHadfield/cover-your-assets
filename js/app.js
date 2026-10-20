/* Play tab controller: settings, game host, rendering, input, odds, hints, coach. */
(function () {
  'use strict';
  var E = window.CYAEngine, O = window.CYAOdds, AI = window.CYAAI, A = window.CYAArt, RL = window.CYARules;
  var $ = function (id) { return document.getElementById(id); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  O.enableMemo();
  var NAMES = ['You', 'Ann', 'Ben', 'Cat', 'Dan', 'Eve'];

  // ---------- settings ----------
  var DEF = { players: 4, edition: 'classic', advanced: false, draft: false, teams: false, format: 'million', level: 'medium',
    seats: null, odds: true, coach: true, speed: 'normal' };
  var S = Object.assign({}, DEF, LS.get('cya.settings', {}));
  function seatsFor(n) {
    var out = [], old = S.seats || [];
    for (var i = 0; i < n; i++) {
      var o = old[i];
      out.push(o ? o : { kind: i === 0 ? 'human' : 'bot', level: S.level, name: NAMES[i] });
    }
    return out;
  }
  S.seats = seatsFor(S.players);
  function saveSettings() { LS.set('cya.settings', S); }

  // ---------- money format ----------
  function money(v) {
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(v % 1000000 ? 2 : 0) + 'M';
    if (v >= 1000) return '$' + Math.round(v / 1000) + 'K';
    return '$' + v;
  }
  function pct(p) { return Math.round(p * 100) + '%'; }
  // red -> green scale (good = high)
  function scale(p) {
    p = Math.max(0, Math.min(1, p));
    var r = p < .5 ? 239 : Math.round(239 - (p - .5) * 2 * (239 - 76));
    var g = p < .5 ? Math.round(100 + p * 2 * (195 - 100)) : 195;
    var b = p < .5 ? 97 : Math.round(97 + (p - .5) * 2 * (138 - 97));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ---------- game host ----------
  var host = null, me = 0, sel = [], mode = null, hint = null, lastSeen = { hand: [], sets: [], discardTop: null, plays: 0 };
  var coach = LS.get('cya.coach', { lost: 0, moves: 0 });

  function delayFor(st) {
    var base = { fast: 250, slow: 1200, test: 15 }[S.speed] || 700;
    return st.phase === 'battle' || st.phase === 'offer' ? base * 1.3 : base;
  }
  function humans() { var o = []; S.seats.forEach(function (s, i) { if (s.kind === 'human') o.push(i); }); return o; }

  function newGame() {
    var cfg = { players: S.players, edition: S.edition, advanced: S.advanced, draft: S.draft, teams: S.teams, format: S.format };
    var st = E.newGame(cfg);
    startHost(st);
    coach = { lost: 0, moves: 0 }; LS.set('cya.coach', coach);
    sel = []; mode = null; hint = null; lastSeen = { hand: [], sets: [], discardTop: null, plays: 0 };
    me = humans()[0] != null ? humans()[0] : 0;
    save(); render();
    host.schedule();
  }
  function startHost(st) {
    if (host) host.stop();
    var seats = S.seats.slice(0, st.cfg.players).map(function (s) { return { kind: s.kind, level: s.level, name: s.name }; });
    host = new window.CYATransport.LocalHost(st, seats, { delay: delayFor });
    host.onChange(function (st2, info) { onChange(info); });
  }
  function save() { if (host) LS.set('cya.game', { state: host.state, seats: host.seats, me: me }); }

  function seatName(s) { return host && host.seats[s] ? host.seats[s].name : NAMES[s]; }
  function V() { return host.viewFor(me); }

  function onChange(info) {
    var st = host.state;
    // multiple people on one phone: follow whoever must act next
    var t = E.toAct(st);
    if (t >= 0 && host.seats[t].kind === 'human' && t !== me) { me = t; passCover = true; }
    sel = []; mode = null; hint = null;
    save(); render();
  }
  var passCover = false;

  // ---------- describing things ----------
  function tname(type) { return RL.TYPES[type] ? RL.TYPES[type].short : type; }
  function cardName(st, id) { return tname(st.cards[id].type); }
  function describe(st, a) {
    switch (a.t) {
      case 'pair': return 'Pair ' + a.cards.map(function (id) { return cardName(st, id); }).join(' + ');
      case 'pairDiscard': return 'Pair ' + cardName(st, a.card) + ' with the discard';
      case 'challenge': return 'Challenge ' + seatName(a.target) + (a.depth ? "'s 2nd set" : "'s top set") + ' with ' + a.cards.map(function (id) { return cardName(st, id); }).join(' + ');
      case 'discard': return 'Discard ' + cardName(st, a.card);
      case 'improve': return 'Add ' + cardName(st, a.card) + ' to your top set';
      case 'swap': return 'Swap top sets with ' + seatName(a.target);
      case 'move': return (a.dir === 'down' ? 'Move ' + who(a.target) + ' top set to the bottom' : 'Move ' + who(a.target) + ' bottom set to the top');
      case 'draft': return 'Draft with ' + cardName(st, a.card);
      case 'play': return 'Play ' + a.cards.map(function (id) { return cardName(st, id); }).join(' + ');
      case 'fold': return 'Give up';
      case 'pass': return 'Let it go';
      case 'pick': return a.dir === 'down' ? 'Their top set to the bottom' : 'Their bottom set to the top';
      case 'end': return 'End turn';
    }
    return a.t;
  }
  function who(s) { return s === me ? 'your' : seatName(s) + "'s"; }
  function logText(st, e) {
    var n = function (s) { return '<b>' + esc(seatName(s)) + '</b>'; };
    var cs = function (ids) { return (ids || []).map(function (id) { return cardName(st, id); }).join(' + '); };
    switch (e.m) {
      case 'pair': return n(e.s) + ' paired ' + cs(e.cards);
      case 'pairDiscard': return n(e.s) + ' took ' + cardName(st, e.cards[1]) + ' from the discard';
      case 'discard': return n(e.s) + ' discarded ' + cs(e.cards);
      case 'challenge': return n(e.s) + ' challenged ' + n(e.target) + "'s " + tname(e.type) + ' with ' + cs(e.cards);
      case 'answer': return n(e.s) + ' answered with ' + cs(e.cards);
      case 'fold': return n(e.s) + ' gave up';
      case 'held': return n(e.s) + ' kept the ' + tname(e.type) + ' set (' + money(e.value) + ')';
      case 'stole': return n(e.s) + ' stole ' + n(e.from) + "'s " + tname(e.type) + ' set (' + money(e.value) + ')';
      case 'improve': return n(e.s) + ' added ' + cs(e.cards) + ' to their top set';
      case 'swap': return n(e.s) + ' swapped top sets with ' + n(e.target);
      case 'move': return n(e.s) + ' moved ' + n(e.target) + "'s " + (e.dir === 'down' ? 'top set to the bottom' : 'bottom set to the top');
      case 'draft': return n(e.s) + ' drafted ' + tname(e.type) + ' (' + e.cards.length + ' cards)';
      case 'pass': return n(e.s) + ' let it go';
      case 'revealSwap': return 'A Swap flipped up: ' + n(e.seats[0]) + ' and ' + n(e.seats[1]) + ' traded top sets';
      case 'revealSwapVoid': return 'A Swap flipped up with nothing to swap; shuffled back in';
      case 'revealMove': return 'A Move flipped up';
      case 'roundEnd': return 'Round ' + e.round + ' over';
      case 'gameOver': return 'Game over';
      default: return e.m;
    }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- card html ----------
  function cardHTML(st, id, cls, extra) {
    var c = st.cards[id];
    return '<div class="card ' + (cls || '') + '" data-id="' + id + '"' + (extra || '') + '>' + A.face(c.type, c.value) + '</div>';
  }
  function backHTML(cls) { return '<div class="card ' + (cls || '') + '">' + A.back() + '</div>'; }

  // a stack drawn like the real table: sets crossed at right angles, newest on top
  function stackHTML(st, seat, w, freshTop) {
    var k = st.stacks[seat];
    if (!k.length) return '<div class="empty-stack" style="width:' + w * 1.5 + 'px;height:' + w * 1.4 + 'px">' + (seat === me ? 'Stack' : '') + '</div>';
    var h = w * 1.4, html = '', from = Math.max(0, k.length - 3);
    for (var i = from; i < k.length; i++) {
      var set = k[i], rot = i % 2 ? 90 : 0, asset = null, other = null;
      set.cards.forEach(function (id) { if (st.cards[id].kind === 'asset' && asset == null) asset = id; });
      set.cards.forEach(function (id) { if (id !== asset && other == null) other = id; });
      var top = i === k.length - 1, dx = (i - from) * 3;
      html += '<div class="set' + (top && freshTop ? ' enter' : '') + '" style="transform:translate(' + (dx - 4) + 'px,' + (-dx) + 'px) rotate(' + rot + 'deg)">';
      if (other != null) html += '<div class="card" style="left:' + (-w / 2 + w * .28) + 'px;top:' + (-h / 2 - 2) + 'px;width:' + w + 'px">' + A.face(st.cards[other].type, st.cards[other].value) + '</div>';
      html += '<div class="card" style="left:' + (-w / 2 - w * .12) + 'px;top:' + (-h / 2 + 2) + 'px;width:' + w + 'px">' + A.face(st.cards[asset].type, st.cards[asset].value) + '</div>';
      if (top && set.cards.length > 2) html += '<span class="cnt" style="transform:rotate(' + (-rot) + 'deg)">×' + set.cards.length + '</span>';
      html += '</div>';
    }
    return html;
  }

  // ---------- selection -> candidate actions ----------
  function myTurn(v) { return v.phase === 'turn' && E.toAct(v) === me && host.seats[me].kind === 'human'; }
  function typesKey(st, ids) { return ids.map(function (id) { return st.cards[id].type; }).sort().join('+'); }
  function handIds(a) { return a.cards ? a.cards : (a.card != null ? [a.card] : []); }
  function candidates(v) {
    if (!myTurn(v)) return [];
    var key = typesKey(v, sel);
    return E.legal(v).filter(function (a) {
      if (a.t === 'end') return false;
      var ids = a.t === 'pairDiscard' ? [a.card] : handIds(a);
      return ids.length === sel.length && typesKey(v, ids) === key;
    }).map(function (a) { // use the exact cards the player picked
      var b = JSON.parse(JSON.stringify(a));
      if (b.cards) b.cards = sel.slice(); else if (b.card != null) b.card = sel[0];
      return b;
    });
  }

  function act(a) {
    var v = V();
    if (S.coach && host.seats[me].kind === 'human') coachCheck(v, a);
    try { host.submit(me, a); } catch (e) { toast('Not allowed: ' + e.message); }
  }

  function sig(st, a) {
    var b = JSON.parse(JSON.stringify(a));
    if (b.cards) b.cards = b.cards.map(function (id) { return st.cards[id].type; }).sort();
    if (b.card != null) b.card = st.cards[b.card].type;
    return JSON.stringify(b, Object.keys(b).sort());
  }
  function coachCheck(v, a) {
    if (['turn', 'battle', 'offer'].indexOf(v.phase) < 0) return;
    var ranked = AI.rank(v, me), mine = sig(v, a), best = ranked[0], got = null;
    ranked.forEach(function (r) { if (got == null && sig(v, r.a) === mine) got = r; });
    if (!got) return;
    var gap = best.s - got.s;
    coach.moves++;
    if (gap > 2500) {
      coach.lost += gap;
      setTimeout(function () { toast('Coach: “' + describe(v, best.a) + '” was worth about ' + money(gap) + ' more. ' + best.why); }, 50);
    }
    LS.set('cya.coach', coach);
  }

  // ---------- render ----------
  function render() {
    if (!host) return;
    var v = V();
    renderStatus(v); renderOpps(v); renderPiles(v); renderStack(v); renderHand(v); renderBar(v); renderMsg(v); renderSide(v); renderOverlay(v);
  }

  function renderStatus(v) {
    var tot = v.cfg.teams ? E.units(v, v.totals).vals[v.team[me]] : v.totals[me];
    var target = v.cfg.format === 'million' ? ' of $1M' : '';
    $('status').innerHTML = 'Round ' + v.round + ' · <b>' + money(tot + 0) + '</b>' + target;
  }

  function oppOrder(v) { var o = []; for (var i = 1; i < v.cfg.players; i++) o.push((me + i) % v.cfg.players); return o; }

  function renderOpps(v) {
    var cands = candidates(v), html = '';
    var w = window.innerWidth >= 900 ? 36 : 22;
    oppOrder(v).forEach(function (s) {
      var tgt = cands.filter(function (a) { return (a.t === 'challenge' || a.t === 'swap' || a.t === 'move') && a.target === s; });
      var isTurn = E.toAct(v) === s && v.phase !== 'roundEnd' && v.phase !== 'gameOver';
      var mate = v.cfg.teams && v.team[s] === v.team[me];
      var chip = '';
      var ch = tgt.filter(function (a) { return a.t === 'challenge'; })[0];
      if (ch && S.odds) {
        var co = O.challengeOdds(v, me, s, ch.depth, E);
        chip = '<div class="chip" style="background:' + scale(co.pWin) + '">Steal ' + pct(co.pWin) + '</div>';
      } else if (tgt.length) chip = '<div class="chip" style="background:var(--accent)">' + (tgt[0].t === 'swap' ? 'Swap' : 'Move') + '</div>';
      var top = E.topSet(v, s);
      html += '<div class="opp' + (isTurn ? ' turn' : '') + (tgt.length ? ' target' : '') + (mate ? ' mate' : '') + '" data-seat="' + s + '">' +
        '<div class="nm"><span>' + esc(seatName(s)) + (mate ? ' ★' : '') + '</span><span class="hc"><i class="mini-back"></i>' + O.handLen(v, s) + '</span></div>' +
        '<div class="tv"><b>' + money(E.stackValue(v, s)) + '</b>' + (top ? ' · top ' + money(E.setValue(v, top)) : '') + '</div>' +
        '<div class="stk">' + stackHTML(v, s, w, false) + '</div>' + chip + '</div>';
    });
    $('opps').innerHTML = html;
  }

  function renderPiles(v) {
    var cands = candidates(v), html = '';
    if (v.piles) {
      v.piles.forEach(function (p, i) {
        var can = cands.some(function (a) { return a.t === 'draft' && a.piles.indexOf(i) >= 0; });
        var usable = E.pilesFor(v, me).indexOf(i) >= 0;
        html += '<div class="pile' + (can ? ' can' : '') + '" data-pile="' + i + '"><div class="slot">' + (p.count > 1 ? '<div class="depth"></div>' : '') +
          (p.top != null ? cardHTML(v, p.top, '') : '') + '</div><div class="lbl">' + (usable ? 'Draft ' : 'Pile ') + (i + 1) + ' · ' + p.count + '</div></div>';
      });
      html += '<div class="pile"><div class="slot">' + (v.draw ? '<div class="depth"></div>' + backHTML('') : '') + '</div><div class="lbl">Draw · ' + v.draw + '</div></div>';
    } else {
      var d = v.discard.length ? v.discard[v.discard.length - 1] : null;
      var canD = cands.some(function (a) { return a.t === 'pairDiscard'; });
      var fresh = d !== lastSeen.discardTop; lastSeen.discardTop = d;
      html += '<div class="pile"><div class="slot">' + (v.draw ? '<div class="depth"></div>' + backHTML('') : '') + '</div><div class="lbl">Draw · ' + v.draw + '</div></div>';
      html += '<div class="pile' + (canD ? ' can' : '') + '" data-pile="discard"><div class="slot">' + (d != null ? cardHTML(v, d, fresh ? 'flip' : '') : '') + '</div><div class="lbl">Discard · ' + v.discard.length + '</div></div>';
    }
    $('piles').innerHTML = html;
  }

  function renderStack(v) {
    var k = v.stacks[me], w = window.innerWidth >= 900 ? 46 : 34;
    var fresh = (lastSeen.sets[me] || 0) < k.length; lastSeen.sets = v.stacks.map(function (x) { return x.length; });
    var info = '<div class="big">' + money(E.stackValue(v, me)) + '</div><div>' + k.length + ' set' + (k.length === 1 ? '' : 's') + ' this round</div>';
    if (S.odds && k.length) {
      var r = O.topRisk(v, me, E);
      if (r.safe) info += '<div class="risk" style="background:' + scale(1) + '">Nest egg: safe <button class="q" data-q="nest">?</button></div>';
      else info += '<div class="risk" style="background:' + scale(1 - r.anyBeat) + '">' + pct(r.anyBeat) + ' risk · ' + money(r.value) + ' <button class="q" data-q="risk">?</button></div>';
    }
    var cands = candidates(v);
    var tgt = cands.some(function (a) { return a.t === 'move' && a.target === me; });
    $('mystack').innerHTML = '<div class="pilebox' + (tgt ? ' target' : '') + '" data-seat="' + me + '">' + stackHTML(v, me, w, fresh) + '</div><div class="info">' + info + '</div>';
  }

  function renderHand(v) {
    var h = v.hands[me];
    if (!Array.isArray(h)) { $('hand').innerHTML = ''; return; }
    var hintIds = hint ? handIds(hint.a).concat(hint.a.t === 'pairDiscard' ? [hint.a.card] : []) : [];
    var prev = lastSeen.hand;
    var html = '';
    h.slice().sort(function (a, b) { return v.cards[b].value - v.cards[a].value || v.cards[a].type.localeCompare(v.cards[b].type) || a - b; }).forEach(function (id) {
      var cls = (sel.indexOf(id) >= 0 ? 'sel ' : '') + (hintIds.indexOf(id) >= 0 ? 'hint ' : '') + (prev.indexOf(id) < 0 ? 'enter' : '');
      html += cardHTML(v, id, cls);
    });
    lastSeen.hand = h.slice();
    // cards as big as the row allows (phone), fixed size on laptop
    var W = $('hand').clientWidth || window.innerWidth, n = Math.max(4, h.length);
    var cw = window.innerWidth >= 900 ? 110 : Math.min(80, Math.floor((W - 4 * (n - 1)) / n));
    $('hand').style.setProperty('--cw', cw + 'px');
    $('hand').innerHTML = html;
  }

  function renderBar(v) {
    var html = '';
    if (myTurn(v)) {
      var c = candidates(v);
      html += '<button class="btn ghost" data-act="hint">Hint</button>';
      if (v.acts > 0) html += '<button class="btn ghost" data-act="end">Done</button>';
      var pair = c.filter(function (a) { return a.t === 'pair'; })[0];
      if (pair) html += '<button class="btn" data-do="' + idx(c, pair) + '">Pair ' + money(sum(v, pair.cards)) + '</button>';
      var imp = c.filter(function (a) { return a.t === 'improve'; })[0];
      if (imp) html += '<button class="btn" data-do="' + idx(c, imp) + '">Add to top</button>';
      c.filter(function (a) { return a.t === 'draft'; }).forEach(function (a) {
        var tops = a.piles.map(function (p) { return v.piles[p].top; });
        html += '<button class="btn" data-do="' + idx(c, a) + '">Draft ' + money(sum(v, [a.card].concat(tops))) + '</button>';
      });
      var dis = c.filter(function (a) { return a.t === 'discard'; })[0];
      if (dis) html += '<button class="btn ghost" data-do="' + idx(c, dis) + '">Discard</button>';
      if (!sel.length) html += '<span class="msg" style="min-height:0;color:var(--muted);font-size:13px">Tap cards</span>';
    }
    $('bar').innerHTML = html;
    $('bar')._cands = myTurn(v) ? candidates(v) : [];
  }
  function idx(arr, a) { return arr.indexOf(a); }
  function sum(v, ids) { return ids.reduce(function (x, id) { return x + v.cards[id].value; }, 0); }

  function renderMsg(v) {
    var m = '';
    var t = E.toAct(v);
    if (hint) m = '<span>Hint: <b>' + esc(describe(v, hint.a)) + '</b></span><span class="sub">' + esc(hint.why) + '</span>';
    else if (v.phase === 'turn' && t === me && host.seats[me].kind === 'human') {
      if (sel.length === 1 && S.odds) {
        var g = O.giftRisk(v, me, sel[0]);
        var c = candidates(v);
        var ch = c.filter(function (a) { return a.t === 'challenge'; }).length;
        var pd = c.some(function (a) { return a.t === 'pairDiscard'; });
        m = (pd ? 'Tap the discard to pair it. ' : '') + (ch ? 'Tap a glowing player to challenge. ' : '') +
          (v.piles ? '' : '<span class="sub">If you discard it, ' + esc(seatName((me + 1) % v.cfg.players)) + ' can pair it: ' + pct(g) + '</span>');
        if (!m) m = 'Pick a second card to pair, or discard.';
      } else if (sel.length === 2) m = candidates(v).length ? 'Pair them, or challenge a 2nd set.' : 'Those two don\'t pair.';
      else m = v.acts > 0 ? 'Second action, or Done.' : 'Your turn';
    } else if (t >= 0 && v.phase === 'turn') m = esc(seatName(t)) + ' is playing…';
    if (!m) {
      var last = v.log[v.log.length - 1];
      m = last ? logText(v, last) : '';
    }
    $('msg').innerHTML = m.indexOf('<span') === 0 ? m : '<span>' + m + '</span>';
  }

  function renderSide(v) {
    if (window.innerWidth < 900) return;
    var html = '';
    if (S.odds && v.stacks[me].length) {
      var r = O.topRisk(v, me, E);
      html += '<div class="o-row"><span>Your top set</span><span>' + money(r.value) + '</span></div>';
      if (r.safe) html += '<div class="o-row"><span>Nest egg</span><span style="color:' + scale(1) + '">safe</span></div>';
      else {
        html += '<div class="o-row"><span>Someone can challenge</span><span style="color:' + scale(1 - r.anyStart) + '">' + pct(r.anyStart) + '</span></div>';
        html += '<div class="o-row"><span>Someone can beat you</span><span style="color:' + scale(1 - r.anyBeat) + '">' + pct(r.anyBeat) + '</span></div>';
        html += '<div class="o-row"><span>Your defenders</span><span>' + r.mine + '</span></div>';
      }
    }
    if (S.odds && Array.isArray(v.hands[me])) {
      oppOrder(v).forEach(function (s) {
        if (!E.canChallengeAt(v, me, s, 0)) return;
        var co = O.challengeOdds(v, me, s, 0, E);
        if (!co.mine) return;
        html += '<div class="o-row"><span>Steal ' + esc(seatName(s)) + "'s " + tname(co.type) + ' (' + money(co.value) + ')</span><span style="color:' + scale(co.pWin) + '">' + pct(co.pWin) + '</span></div>';
      });
      var un = O.unseen(v, me);
      html += '<div class="o-row"><span>Cards you haven\'t seen</span><span>' + un.total + '</span></div>';
      html += '<div class="o-row"><span>Wilds not seen</span><span>' + ((un.byType.gold || 0) + (un.byType.silver || 0) + (un.byType.penny || 0)) + '</span></div>';
    }
    if (S.coach) html += '<div class="o-row"><span>Coach: left on table</span><span>' + money(Math.round(coach.lost)) + '</span></div>';
    $('oddsPanel').innerHTML = html || '<div class="o-row"><span>Odds show up once there are sets on the table.</span><span></span></div>';
    var lg = '';
    v.log.slice(-60).reverse().forEach(function (e) { lg += '<li>' + logText(v, e) + '</li>'; });
    $('log').innerHTML = lg;
  }

  // ---------- overlays: fight, draft offer, move pick, round end, pass ----------
  function renderOverlay(v) {
    var ov = $('overlay'), html = '';
    var t = E.toAct(v), mine = t === me && host.seats[me].kind === 'human';
    if (passCover && humans().length > 1 && v.phase !== 'roundEnd' && v.phase !== 'gameOver') {
      html = '<div class="panel" style="text-align:center"><h2>Pass to ' + esc(seatName(me)) + '</h2><div class="sub">Others look away.</div><div class="row"><button class="btn" data-ov="ready">I\'m ' + esc(seatName(me)) + '</button></div></div>';
    } else if (v.phase === 'battle') {
      var b = v.battle, set = v.stacks[b.defender][b.index], L = mine ? E.legal(v) : [];
      var att = '', def = '', n = 0;
      b.plays.forEach(function (p) {
        var cs = p.cards.map(function (id) { n++; return cardHTML(v, id, n > lastSeen.plays ? 'enter' : ''); }).join('');
        if (p.s === b.attacker) att += cs; else def += cs;
      });
      lastSeen.plays = n;
      var setCards = set.cards.map(function (id) { return cardHTML(v, id, ''); }).join('');
      html = '<div class="panel"><h2>' + esc(seatName(b.attacker)) + ' challenges ' + esc(b.defender === me ? 'you' : seatName(b.defender)) + '</h2>' +
        '<div class="sub">For the ' + tname(set.type) + ' set (' + money(E.setValue(v, set)) + '). Last card played wins it all.</div>' +
        '<div class="fight"><div class="side-r">' + setCards + '</div></div>' +
        '<div class="fight"><div class="side-l">' + att + '</div><span class="vs">' + esc(seatName(b.attacker)) + ' · ' + esc(seatName(b.defender)) + '</span><div class="side-r">' + def + '</div></div>';
      if (mine) {
        var my = O.myFighters(v, me, set.type).length, opp = b.toAct === b.attacker ? b.defender : b.attacker;
        var un = O.unseen(v, me), m = O.fighters(v, un, set.type);
        var pw = O.atMost(un.total, m, O.handLen(v, opp), my - 1);
        if (S.odds) html += '<div class="odds-line" style="color:' + scale(pw) + '">If you both play everything: you win ' + pct(pw) + ' <button class="q" data-q="fight">?</button></div>';
        html += '<div class="row">' + L.map(function (a, i) { return '<button class="btn ' + (a.t === 'fold' ? 'ghost' : '') + '" data-ov="L' + i + '">' + esc(describe(v, a)) + '</button>'; }).join('') +
          '<button class="btn ghost" data-act="hint">Hint</button></div>';
        if (hint) html += '<div class="sub" style="text-align:center;margin-top:8px">Hint: <b>' + esc(describe(v, hint.a)) + '</b> · ' + esc(hint.why) + '</div>';
        ov._legal = L;
      } else html += '<div class="sub" style="text-align:center">' + esc(seatName(t)) + ' is deciding…</div>';
      html += '</div>';
    } else if (v.phase === 'offer') {
      var o = v.offer, top = E.topSet(v, o.owner);
      html = '<div class="panel"><h2>' + esc(seatName(o.owner)) + ' drafted ' + tname(top.type) + '</h2><div class="sub">' + money(E.setValue(v, top)) + '. ' + esc(t === me ? 'You' : seatName(t)) + ' may challenge for it.</div>' +
        '<div class="fight">' + top.cards.map(function (id) { return cardHTML(v, id, ''); }).join('') + '</div>';
      if (mine) {
        var L2 = E.legal(v); ov._legal = L2;
        html += '<div class="row">' + L2.map(function (a, i) { return '<button class="btn ' + (a.t === 'pass' ? 'ghost' : '') + '" data-ov="L' + i + '">' + esc(describe(v, a)) + '</button>'; }).join('') + '</div>';
      } else html += '<div class="sub" style="text-align:center">' + esc(seatName(t)) + ' is deciding…</div>';
      html += '</div>';
    } else if (v.phase === 'pick') {
      var tg = v.pick.targets[0];
      html = '<div class="panel"><h2>A Move card flipped up</h2><div class="sub">' + esc(t === me ? 'You choose' : seatName(t) + ' chooses') + ' what happens to ' + esc(tg === me ? 'your' : seatName(tg) + "'s") + ' stack.</div>';
      if (mine) { var L3 = E.legal(v); ov._legal = L3; html += '<div class="row">' + L3.map(function (a, i) { return '<button class="btn" data-ov="L' + i + '">' + esc(describe(v, a)) + '</button>'; }).join('') + '</div>'; }
      html += '</div>';
    } else if (v.phase === 'roundEnd' || v.phase === 'gameOver') {
      html = roundPanel(v);
    } else if (mode && mode.t === 'move') {
      html = '<div class="panel"><h2>Move which way?</h2><div class="row">' + mode.opts.map(function (a, i) { return '<button class="btn" data-ov="M' + i + '">' + esc(describe(v, a)) + '</button>'; }).join('') + '<button class="btn ghost" data-ov="cancel">Cancel</button></div></div>';
    }
    if (v.phase !== 'battle') lastSeen.plays = 0;
    // the panel pops in only when it first appears; later updates don't move it
    var kind = html ? v.phase + (mode ? mode.t : '') : '';
    if (html && ov.dataset.kind !== kind) html = html.replace('<div class="panel', '<div class="panel pop');
    ov.dataset.kind = kind;
    ov.innerHTML = html; ov.hidden = !html;
  }

  function roundPanel(v) {
    var u = E.units(v, v.totals), r = E.units(v, v.roundScores), max = v.cfg.target;
    var rows = u.seats.map(function (seats, i) {
      var nm = seats.map(seatName).join(' & ');
      return '<tr><td>' + esc(nm) + '<div class="meter"><i style="width:' + Math.min(100, u.vals[i] / max * 100) + '%"></i></div></td><td>' + money(r.vals[i]) + '</td><td><b>' + money(u.vals[i]) + '</b></td>' +
        (v.cfg.format === 'bestof2' ? '<td>' + (E.units(v, v.roundWins).vals[i] / seats.length) + '</td>' : '') + '</tr>';
    }).join('');
    var title = v.phase === 'gameOver' ? (v.winner.seats.indexOf(me) >= 0 && host.seats[me].kind === 'human' ? 'You win!' : v.winner.seats.map(seatName).join(' & ') + ' wins') : 'Round ' + v.round + ' done';
    var sub = v.phase === 'gameOver' ? 'Final totals.' : (v.cfg.format === 'million' ? 'First to $1,000,000 wins.' : v.cfg.format === 'three' ? 'Highest after 3 rounds.' : v.cfg.format === 'bestof2' ? 'First to win 2 rounds.' : '');
    var c = S.coach && coach.moves ? '<div class="sub" style="margin-top:8px">Coach: you left about <b>' + money(Math.round(coach.lost)) + '</b> on the table over ' + coach.moves + ' choices.</div>' : '';
    return '<div class="panel"><h2>' + esc(title) + '</h2><div class="sub">' + sub + '</div><table class="scores"><tr><th>Player</th><th>Round</th><th>Total</th>' + (v.cfg.format === 'bestof2' ? '<th>Wins</th>' : '') + '</tr>' + rows + '</table>' + c +
      '<div class="row">' + (v.phase === 'gameOver' ? '<button class="btn" data-ov="new">New game</button>' : '<button class="btn" data-ov="next">Next round</button>') + '</div></div>';
  }

  // ---------- input ----------
  function onHandTap(id) {
    var v = V(); if (!myTurn(v)) return;
    hint = null; mode = null;
    var i = sel.indexOf(id);
    if (i >= 0) sel.splice(i, 1); else { if (sel.length >= 2) sel = []; sel.push(id); }
    render();
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-q]'); if (t) { showTip(t); ev.stopPropagation(); return; }
    hideTip();
    var c = ev.target.closest('#hand .card'); if (c) { onHandTap(+c.dataset.id); return; }
    var b = ev.target.closest('[data-do]');
    if (b) { var cands = $('bar')._cands || []; var a = cands[+b.dataset.do]; if (a) act(a); return; }
    var x = ev.target.closest('[data-act]');
    if (x) {
      if (x.dataset.act === 'hint') return showHint();
      if (x.dataset.act === 'end') return act({ t: 'end' });
    }
    var o = ev.target.closest('.opp, .pilebox');
    if (o && o.dataset.seat != null) return onSeatTap(+o.dataset.seat);
    var p = ev.target.closest('.pile[data-pile]');
    if (p) return onPileTap(p.dataset.pile);
    var ov = ev.target.closest('[data-ov]');
    if (ov) return onOverlay(ov.dataset.ov);
    var tb = ev.target.closest('#tabs button'); if (tb) return showTab(tb.dataset.tab);
  });
  function onSeatTap(s) {
    var v = V(), c = candidates(v);
    var forSeat = c.filter(function (a) { return a.target === s && (a.t === 'challenge' || a.t === 'swap' || a.t === 'move'); });
    if (!forSeat.length) return;
    var moves = forSeat.filter(function (a) { return a.t === 'move'; });
    if (forSeat[0].t === 'move' && moves.length > 1) { mode = { t: 'move', opts: moves }; render(); return; }
    var chal = forSeat.filter(function (a) { return a.t === 'challenge'; });
    act(chal.length ? chal[0] : forSeat[0]);
  }
  function onPileTap(p) {
    var v = V(), c = candidates(v);
    if (p === 'discard') { var a = c.filter(function (x) { return x.t === 'pairDiscard'; })[0]; if (a) act(a); return; }
    var d = c.filter(function (x) { return x.t === 'draft' && x.piles.indexOf(+p) >= 0; });
    if (d.length) act(d[0]);
  }
  function onOverlay(k) {
    var v = V();
    if (k === 'ready') { passCover = false; render(); return; }
    if (k === 'next') { host.submit(me, { t: 'next' }); return; }
    if (k === 'new') { newGame(); return; }
    if (k === 'cancel') { mode = null; render(); return; }
    if (k[0] === 'M') { var a = mode.opts[+k.slice(1)]; mode = null; act(a); return; }
    if (k[0] === 'L') { var L = $('overlay')._legal || []; var b = L[+k.slice(1)]; if (b) act(b); }
  }
  function showHint() {
    var v = V(), r = AI.rank(v, me);
    if (!r.length) return;
    hint = r[0];
    if (v.phase === 'turn') sel = handIds(hint.a).slice();
    render();
  }

  // ---------- tips ----------
  var TIPS = {
    odds: 'Worked out only from what you can see: your hand and every face-up card. Hidden cards are treated as equally likely to be anywhere.',
    risk: 'Chance at least one opponent holds more cards that match your top set (or wilds) than you do, so they would win a challenge if everyone plays everything. Cover it with a new pair to make it safe.',
    nest: 'Your first set sits at the bottom of your stack. It can never be stolen in the standard game.',
    fight: 'You win if you play the last card. Playing first, you need more matching cards and wilds than they hold. The rest of their hand is unknown, so this counts the cards you haven\'t seen.',
    table: 'Use this at a real table. Add each pair as it is played, and move a set when someone steals it. It totals every stack, and the steal odds come from the cards still hidden.',
    unseen: 'Cards of each kind not yet on any stack. These are in hands or the draw pile.'
  };
  function showTip(el) {
    var tip = $('tip'); tip.textContent = TIPS[el.dataset.q] || window.CYATips && window.CYATips[el.dataset.q] || '';
    tip.hidden = false;
    var r = el.getBoundingClientRect(), w = Math.min(290, window.innerWidth - 24);
    tip.style.maxWidth = w + 'px';
    var left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left - w / 2));
    tip.style.left = left + 'px';
    var top = r.bottom + 8; if (top + 120 > window.innerHeight) top = Math.max(8, r.top - 8 - tip.offsetHeight);
    tip.style.top = top + 'px';
  }
  function hideTip() { $('tip').hidden = true; }
  var toastT = null;
  function toast(m) { var t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 4200); }

  // ---------- tabs ----------
  var tabHistory = [];
  function showTab(name, noPush) {
    var cur = LS.get('cya.tab', 'play');
    document.querySelectorAll('.tab').forEach(function (s) { s.hidden = s.id !== 'tab-' + name; });
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
    LS.set('cya.tab', name);
    if (!noPush && cur !== name) { try { history.pushState({ tab: name }, '', '#' + name); } catch (e) { /* file:// */ } }
    if (name === 'play') render();
    if (name === 'settings') renderSettings();
    if (name === 'rules') renderRules();
    document.dispatchEvent(new CustomEvent('cya:tab', { detail: name }));
  }
  window.addEventListener('popstate', function (e) { var n = (e.state && e.state.tab) || (location.hash.slice(1) || 'play'); showTab(n, true); });
  document.querySelector('.hubtab').innerHTML = '<span>Play</span>';

  // ---------- settings tab ----------
  function sw(key, on, dis) { return '<button class="switch' + (on ? ' on' : '') + (dis ? ' off-dis' : '') + '" data-sw="' + key + '" aria-label="' + key + '"></button>'; }
  function renderSettings() {
    var e21 = S.edition === 'e2021';
    var html = '<div class="sidehead">New game</div>';
    html += row('Players', '<select data-set="players">' + [2, 3, 4, 5, 6].map(function (n) { return '<option' + (n === S.players ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>');
    html += '<div class="seats">' + S.seats.slice(0, S.players).map(function (s, i) {
      return '<div class="seat"><input type="text" data-name="' + i + '" value="' + esc(s.name) + '" maxlength="10"><select data-seat="' + i + '">' +
        [['human', 'Person'], ['easy', 'Computer: easy'], ['medium', 'Computer: medium'], ['hard', 'Computer: hard']].map(function (o) {
          var val = s.kind === 'human' ? 'human' : s.level;
          return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></div>';
    }).join('') + '</div>';
    html += row('Deck <button class="q" data-q="deck">?</button>', '<select data-set="edition"><option value="classic"' + (!e21 ? ' selected' : '') + '>Classic</option><option value="e2021"' + (e21 ? ' selected' : '') + '>New (2021+)</option></select>');
    html += row('Advanced rules <button class="q" data-q="adv">?</button>', sw('advanced', S.advanced, !e21));
    html += row('Draft piles (2-3 players) <button class="q" data-q="draft">?</button>', sw('draft', S.draft, !(e21 && S.players <= 3)));
    html += row('Teams (4 or 6) <button class="q" data-q="teams">?</button>', sw('teams', S.teams, !(S.players === 4 || S.players === 6) || S.draft));
    html += row('Game length', '<select data-set="format">' + [['million', 'First to $1M'], ['quick', 'One round'], ['three', 'Three rounds'], ['bestof2', 'First to 2 round wins']].map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === S.format ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>');
    html += '<div class="row" style="justify-content:flex-start"><button class="btn" data-set-act="new">Start new game</button></div>';
    html += '<div class="sidehead">While playing</div>';
    html += row('Show odds', sw('odds', S.odds));
    html += row('Coach <button class="q" data-q="coach">?</button>', sw('coach', S.coach));
    html += row('Computer speed', '<select data-set="speed">' + ['slow', 'normal', 'fast'].map(function (o) { return '<option' + (o === S.speed ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>');
    html += '<div class="sidehead">Online</div>';
    html += '<div class="setrow"><span class="lab2" id="onlineNote">Online rooms are being set up. Play computers or pass the phone for now.</span></div>';
    html += '<div class="sidehead">How strong are the computers? <button class="q" data-q="strength">?</button></div>';
    html += '<div class="setrow" style="display:block;color:var(--muted);font-size:13px" id="strengthNote"></div>';
    $('settings').innerHTML = html;
    var sd = window.CYALabData && window.CYALabData.strength;
    if (sd) $('strengthNote').innerHTML = sd.rows.map(function (r) { return esc(r.label) + ': <b style="color:var(--text)">' + pct(r.winRate) + '</b> (fair share ' + pct(r.fair) + ')'; }).join('<br>') + '<br>' + esc(sd.note);
  }
  function row(label, ctrl) { return '<div class="setrow"><span class="lab2">' + label + '</span>' + ctrl + '</div>'; }
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset.set) { S[t.dataset.set] = t.dataset.set === 'players' ? +t.value : t.value; if (t.dataset.set === 'players') S.seats = seatsFor(S.players); fixSettings(); saveSettings(); renderSettings(); }
    if (t.dataset.seat) { var s = S.seats[+t.dataset.seat]; if (t.value === 'human') s.kind = 'human'; else { s.kind = 'bot'; s.level = t.value; } saveSettings(); }
    if (t.dataset.name) { S.seats[+t.dataset.name].name = t.value.trim() || NAMES[+t.dataset.name]; saveSettings(); }
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-sw]');
    if (t) { S[t.dataset.sw] = !S[t.dataset.sw]; fixSettings(); saveSettings(); renderSettings(); if (host) render(); return; }
    var n = ev.target.closest('[data-set-act="new"]');
    if (n) { newGame(); showTab('play'); }
  });
  function fixSettings() {
    if (S.edition !== 'e2021') { S.advanced = false; S.draft = false; }
    if (S.players > 3) S.draft = false;
    if (!(S.players === 4 || S.players === 6) || S.draft) S.teams = false;
  }
  Object.assign(TIPS, {
    deck: 'Classic: the 110-card deck sold 2011-2018 (10 kinds of assets). New: the 2021+ box with Speed Boat, 9 copies of most assets, and the advanced Swap, Move and Penny Jar cards.',
    adv: 'From the 2021 box: hold 6 cards, take up to 2 actions a turn, add matching cards to your top set, challenge the 2nd set from the top with 2 cards, and use Swap, Move and Penny Jar.',
    draft: 'The 2021 rules for 2 or 3 players: three face-up draft piles you can claim sets from. The player beside the pile may challenge for the set.',
    teams: 'House rule, not in the rulebook: partners sit across, can\'t steal from each other, and add their money together.',
    coach: 'After each of your moves, the hard computer scores what you did. If its choice was clearly better, it tells you, and keeps a running total.',
    strength: 'Measured by playing thousands of full games between the computer levels on this site, with seats rotated.'
  });

  // ---------- rules tab ----------
  function renderRules() {
    var ed = S.edition;
    var cards = RL.EDITIONS[ed].cards.concat(ed === 'e2021' ? RL.EDITIONS[ed].advanced : []);
    var list = cards.map(function (r) {
      return '<div class="c"><div class="card">' + A.face(r[0], r[1]) + '</div><b>' + esc(RL.TYPES[r[0]].name) + '</b><br>' + (r[1] ? money(r[1]) : 'action') + ' · ×' + r[2] + '</div>';
    }).join('');
    var total = cards.reduce(function (a, r) { return a + r[2]; }, 0);
    $('rules').innerHTML =
      '<h2>Goal</h2><p>Be the first to bank $1,000,000 across rounds by building a stack of matching pairs, and by stealing the top set off other players\' stacks.</p>' +
      '<h2>Deal</h2><ul><li>Classic deck: 4 cards each (5 cards with 2-3 players). New deck: 5 each. Advanced: 6.</li><li>Flip one card to start the discard pile. The player left of the dealer goes first.</li></ul>' +
      '<h2>On your turn, do one thing</h2><ul><li><b>Pair</b> two matching assets from your hand, or an asset with a wild (Silver or Gold). Two wilds never pair.</li><li><b>Take the top discard</b> if it pairs with a card in your hand.</li><li><b>Challenge</b> another player\'s top set by showing a matching card or a wild.</li><li><b>Discard</b> one card.</li></ul><p>Each new pair goes on top of your stack, crossed over the last one. Then draw back up to your hand size.</p>' +
      '<h2>Challenges</h2><ul><li>You need a set of your own first. A player\'s first set (the bottom one) is always safe.</li><li>The defender answers with a matching card or wild, then you, and so on. Whoever plays the last card wins the set and every card played.</li><li>After the fight, the challenger draws first, then the defender.</li></ul>' +
      '<h2>End of a round</h2><p>When the draw pile runs out, keep playing without drawing. Everyone must still pair, challenge or discard. When every hand is empty, add up each stack. Play more rounds until someone reaches $1,000,000; if two do, the higher total wins.</p>' +
      '<h2>Cards in this deck (' + total + ')</h2><div class="cardlist">' + list + '</div>' +
      '<p style="color:var(--muted);font-size:12px;margin-top:14px">Rules written in our own words from the published rules; sources are listed in docs/rules-check.md on GitHub. All card art is original to this site.</p>';
  }

  // ---------- boot ----------
  function boot() {
    var saved = LS.get('cya.game', null);
    if (saved && saved.state && saved.state.cards) {
      try {
        S.seats = saved.seats.map(function (s, i) { return Object.assign({}, S.seats[i] || {}, s); }).concat(S.seats.slice(saved.seats.length));
        startHost(saved.state); me = saved.me || 0;
        host.schedule();
      } catch (e) { newGame(); }
    } else newGame();
    var start = location.hash.slice(1) || LS.get('cya.tab', 'play');
    if (['play', 'table', 'lab', 'rules', 'settings'].indexOf(start) < 0) start = 'play';
    try { history.replaceState({ tab: start }, '', '#' + start); } catch (e) { /* ignore */ }
    showTab(start, true);
    var rt = null;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(render, 120); });
  }
  window.CYAApp = { money: money, pct: pct, scale: scale, esc: esc, LS: LS, toast: toast, TIPS: TIPS, get host() { return host; }, get me() { return me; }, newGame: newGame, render: render };
  boot();
})();
