/* Lab tab: interactive odds explainers and measured facts from simulated games (js/lab-data.js). */
(function () {
  'use strict';
  var RL = window.CYARules, O = window.CYAOdds, A = window.CYAArt, APP = window.CYAApp, D = window.CYALabData || {};
  var money = APP.money, pct = APP.pct, scale = APP.scale, esc = APP.esc;
  var $ = function (id) { return document.getElementById(id); };
  var calc = { type: 'home', stage: 'mid', mine: 2, hand: 4 };

  function bars(rows, fmt, max, color) {
    max = max || Math.max.apply(null, rows.map(function (r) { return r.v; })) || 1;
    return '<div class="bars">' + rows.map(function (r) {
      return '<div class="b" title="' + esc(r.label + ': ' + fmt(r.v)) + '"><span>' + r.label + '</span><span><i style="width:' + Math.max(2, r.v / max * 100) + '%;' + (color ? 'background:' + color(r) : '') + '"></i></span><span>' + fmt(r.v) + '</span></div>';
    }).join('') + '</div>';
  }
  function seg(key, opts, cur) {
    return '<span class="seg">' + opts.map(function (o) { return '<button data-lab="' + key + '" data-v="' + o[0] + '" class="' + (String(o[0]) === String(cur) ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</span>';
  }

  // pool for the calculator: whole classic deck minus a share already face up
  function pool() {
    var deck = RL.buildDeck('classic'), total = deck.length;
    var m = deck.filter(function (c) { return c.type === calc.type || c.kind === 'wild'; }).length;
    var frac = { early: 0.9, mid: 0.6, late: 0.3 }[calc.stage];
    // the cards in your own hand are seen too
    return { U: Math.round(total * frac) - 0, m: Math.max(0, Math.round(m * frac) - calc.mine) };
  }

  function fightBox() {
    var p = pool();
    var types = RL.assetTypes('classic');
    var head = '<div class="ctrl">Set ' + '<select data-lab-sel="type" style="background-color:var(--bg-soft);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:3px 6px">' +
      types.map(function (t) { return '<option value="' + t + '"' + (t === calc.type ? ' selected' : '') + '>' + RL.TYPES[t].short + '</option>'; }).join('') + '</select>' +
      seg('stage', [['early', 'Early'], ['mid', 'Middle'], ['late', 'Late']], calc.stage) + '</div>';
    var pw = O.atMost(p.U, p.m, calc.hand, calc.mine - 1);
    var big = '<div class="big-odds" style="color:' + scale(pw) + '">' + pct(pw) + '</div><div class="sub" style="text-align:center">you win challenging with ' + calc.mine + ' matching card' + (calc.mine === 1 ? '' : 's') + ' vs a ' + calc.hand + '-card hand</div>';
    var tbl = '<table class="heat"><tr><th>You hold</th>' + [3, 4, 5, 6].map(function (h) { return '<th>' + h + ' in hand</th>'; }).join('') + '</tr>';
    for (var k = 1; k <= 4; k++) {
      var pk = pool(); var save = calc.mine; calc.mine = k; pk = pool(); calc.mine = save;
      tbl += '<tr><th>' + k + '</th>' + [3, 4, 5, 6].map(function (h) {
        var w = O.atMost(pk.U, pk.m, h, k - 1);
        return '<td data-lab="cell" data-k="' + k + '" data-h="' + h + '" style="background:' + scale(w) + ';cursor:pointer' + (k === calc.mine && h === calc.hand ? ';outline:2px solid var(--text)' : '') + '" title="' + k + ' vs ' + h + '-card hand: ' + pct(w) + '">' + pct(w) + '</td>';
      }).join('') + '</tr>';
    }
    tbl += '</table>';
    return '<div class="box"><h3>Fight odds <button class="q" data-q="labfight">?</button></h3>' + head + big + tbl + '</div>';
  }

  function strengthBox() {
    var s = D.strength; if (!s) return '';
    return '<div class="box"><h3>How strong are the computers? <button class="q" data-q="strength">?</button></h3><div class="sub">Win rate of one bot against a table of another level. Fair share is ' + pct(0.25) + ' with 4 players, ' + pct(0.5) + ' with 2.</div>' +
      bars(s.rows.map(function (r) { return { label: r.test[0].toUpperCase() + r.test.slice(1) + ' v ' + r.field + ' ' + r.players + 'p', v: r.winRate }; }), pct, 1) +
      '<div class="sub" style="margin-top:6px">' + esc(s.note) + '</div></div>';
  }

  function lengthBox() {
    if (!D.byPlayers) return '';
    return '<div class="box"><h3>Rounds to $1,000,000</h3><div class="sub">Average rounds per game with hard bots, by number of players.</div>' +
      bars(D.byPlayers.map(function (r) { return { label: r.players + ' players', v: r.rounds }; }), function (v) { return v.toFixed(1); }) +
      '<div class="sub" style="margin-top:8px">Money banked per player per round</div>' +
      bars(D.byPlayers.map(function (r) { return { label: r.players + ' players', v: r.perRound }; }), money) + '</div>';
  }

  function stealsBox() {
    if (!D.stolenByType) return '';
    return '<div class="box"><h3>Which sets get stolen?</h3><div class="sub">Share of sets of each kind that changed hands at least once (4 players, ' + D.games4 + ' games). Average stolen pile: ' + money(Math.round(D.avgStolen)) + '.</div>' +
      bars(D.stolenByType.map(function (r) { return { label: RL.TYPES[r.type].short, v: r.rate }; }), pct) + '</div>';
  }
  function timingBox() {
    if (!D.stealsByStage) return '';
    return '<div class="box"><h3>When do steals happen?</h3><div class="sub">Steals per turn as the draw pile runs down (left = fresh deck, right = last cards).</div>' +
      bars(D.stealsByStage.map(function (r) { return { label: (r.stage * 10) + '–' + (r.stage * 10 + 10) + '%', v: r.perTurn }; }), function (v) { return v.toFixed(2); }) + '</div>';
  }
  function mixBox() {
    if (!D.mix) return '';
    var names = { pair: 'Pair from hand', pairDiscard: 'Pair the discard', challenge: 'Challenge', discard: 'Discard' };
    return '<div class="box"><h3>What the hard bot does</h3><div class="sub">Share of its turns spent on each move.</div>' +
      bars(D.mix.map(function (r) { return { label: names[r.t] || r.t, v: r.share }; }), pct) + '</div>';
  }
  function seatBox() {
    var r = D.byPlayers && D.byPlayers.filter(function (x) { return x.players === 4; })[0]; if (!r) return '';
    return '<div class="box"><h3>Does going first help?</h3><div class="sub">Win rate by seat, 4 equal hard bots (' + r.games + ' games; seat 1 starts round 1).</div>' +
      bars(r.seatWin.map(function (w, i) { return { label: 'Seat ' + (i + 1), v: w }; }), pct, 0.5) + '</div>';
  }
  function nestBox() {
    if (!D.nest) return '';
    var n = D.nest;
    return '<div class="box"><h3>Fat nest egg?</h3><div class="sub">' + esc(n.note) + '</div><div class="big-odds" style="color:' + scale(n.winRate / (2 * n.fair)) + '">' + pct(n.winRate) + '</div><div class="sub" style="text-align:center">win rate (fair share ' + pct(n.fair) + ', ' + n.games + ' games)</div></div>';
  }
  function deckBox() {
    var rows = RL.EDITIONS.classic.cards.map(function (r) { return { label: RL.TYPES[r[0]].short, v: r[1] * r[2], n: r[2], val: r[1] }; }).sort(function (a, b) { return b.v - a.v; });
    return '<div class="box"><h3>Where the money is</h3><div class="sub">Total value of each kind in the classic deck ($1,360,000 in all). The 12 wilds hold 29% of it.</div>' +
      bars(rows, money) + '</div>';
  }

  function render() {
    $('lab').innerHTML = fightBox() + strengthBox() + nestBox() + stealsBox() + timingBox() + mixBox() + lengthBox() + seatBox() + deckBox();
  }
  Object.assign(APP.TIPS, {
    labfight: 'A challenge is won by whoever plays the last card. Playing first, you need more matching cards and wilds than the other hand holds. Their hand is a random draw from the cards you haven\'t seen, and fewer of those match late in a round.'
  });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-lab]'); if (!b) return;
    if (b.dataset.lab === 'cell') { calc.mine = +b.dataset.k; calc.hand = +b.dataset.h; }
    else calc[b.dataset.lab] = b.dataset.v;
    render();
  });
  document.addEventListener('change', function (ev) { var t = ev.target; if (t.dataset.labSel) { calc[t.dataset.labSel] = t.value; render(); } });
  document.addEventListener('cya:tab', function (e) { if (e.detail === 'lab') render(); });
  render();
})();
