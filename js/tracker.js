/* Table tab: score and stack tracker for a real game, with steal odds from the cards still hidden. */
(function () {
  'use strict';
  var RL = window.CYARules, O = window.CYAOdds, A = window.CYAArt, APP = window.CYAApp;
  var $ = function (id) { return document.getElementById(id); };
  var LS = APP.LS, money = APP.money, pct = APP.pct, scale = APP.scale, esc = APP.esc;

  var T = LS.get('cya.table', null) || fresh();
  var undo = [];
  function fresh() {
    return { edition: 'classic', round: 1, players: ['Me', 'P2', 'P3', 'P4'].map(function (n) { return { name: n, total: 0, sets: [] }; }), history: [] };
  }
  function save() { LS.set('cya.table', T); }
  function snap() { undo.push(JSON.stringify(T)); if (undo.length > 50) undo.shift(); }
  function val(type) { return RL.valueOf(T.edition, type); }
  function setVal(set) { return set.cards.reduce(function (a, t) { return a + val(t); }, 0); }
  function stackVal(p) { return p.sets.reduce(function (a, s) { return a + setVal(s); }, 0); }
  function handSize() { var n = T.players.length; return T.edition === 'classic' ? (n <= 3 ? 5 : 4) : 5; }
  function deckCounts() {
    var c = {}; RL.buildDeck(T.edition).forEach(function (x) { c[x.type] = (c[x.type] || 0) + 1; }); return c;
  }
  function unseen() {
    var c = deckCounts(), tot = 0;
    T.players.forEach(function (p) { p.sets.forEach(function (s) { s.cards.forEach(function (t) { c[t]--; }); }); });
    Object.keys(c).forEach(function (k) { tot += c[k]; });
    return { byType: c, total: tot };
  }
  // chance somebody else holds a card that can challenge player i's top set
  function stealChance(i) {
    var p = T.players[i]; if (p.sets.length < 2) return null;
    var top = p.sets[p.sets.length - 1], un = unseen();
    var m = (un.byType[top.type] || 0) + (un.byType.silver || 0) + (un.byType.gold || 0) + (un.byType.penny || 0);
    var others = T.players.filter(function (q, j) { return j !== i && q.sets.length; }).length;
    var H = Math.min(un.total, others * handSize());
    return O.atLeast(un.total, m, H, 1);
  }

  function render() {
    var html = '';
    T.players.forEach(function (p, i) {
      var sc = stealChance(i);
      html += '<div class="pl"><div class="nm"><input data-tn="' + i + '" value="' + esc(p.name) + '" maxlength="10"></div><div class="val">' + money(stackVal(p)) + '</div>' +
        '<div class="tot">Total ' + money(p.total + stackVal(p)) + ' · banked ' + money(p.total) + '</div><div></div>' +
        '<div class="sets">' + (p.sets.length ? p.sets.map(function (s, j) {
          return '<span class="tset' + (j === p.sets.length - 1 ? ' top' : '') + '">' + A.icon(s.type) + (s.cards.length > 2 ? '×' + s.cards.length : '') + ' ' + money(setVal(s)) + '</span>';
        }).join('') : '<span style="color:var(--muted);font-size:12px">No sets yet</span>') + '</div>' +
        '<div class="acts"><button class="btn sm" data-tt="add" data-i="' + i + '">+ Pair</button>' +
        (p.sets.length >= 2 ? '<button class="btn sm ghost" data-tt="fight" data-i="' + i + '">Challenged</button>' : '') +
        (sc != null ? '<span class="steal" style="background:' + scale(1 - sc) + '">' + pct(sc) + ' can steal</span>' : (p.sets.length === 1 ? '<span class="steal" style="background:' + scale(1) + '">safe</span>' : '')) +
        '</div></div>';
    });
    html += '<div class="row" style="justify-content:flex-start;margin:4px 0 8px">' +
      (T.players.length < 6 ? '<button class="btn sm ghost" data-tt="plus">+ Player</button>' : '') +
      (T.players.length > 2 ? '<button class="btn sm ghost" data-tt="minus">− Player</button>' : '') +
      '<select data-tt-ed="1" style="background:var(--bg-soft);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:4px 6px"><option value="classic"' + (T.edition === 'classic' ? ' selected' : '') + '>Classic deck</option><option value="e2021"' + (T.edition === 'e2021' ? ' selected' : '') + '>New deck</option></select>' +
      '<button class="btn sm ghost" data-tt="reset">New game</button></div>';
    $('ttPlayers').innerHTML = html;
    var un = unseen(), uh = '';
    Object.keys(un.byType).forEach(function (t) { uh += '<div class="u">' + A.icon(t) + '<b>' + un.byType[t] + '</b></div>'; });
    $('ttUnseen').innerHTML = uh;
    var hh = '<table class="scores"><tr><th>Round</th>' + T.players.map(function (p) { return '<th>' + esc(p.name) + '</th>'; }).join('') + '</tr>';
    T.history.forEach(function (r, k) { hh += '<tr><td>' + (k + 1) + '</td>' + r.map(function (x) { return '<td>' + money(x) + '</td>'; }).join('') + '</tr>'; });
    hh += '</table>';
    $('ttHistory').innerHTML = T.history.length ? hh : '<div style="color:var(--muted);font-size:13px">Round ' + T.round + ' in play.</div>';
    $('ttUndo').disabled = !undo.length;
  }

  // ---------- sheets ----------
  var sheet = null;
  function assetTypes() { return RL.assetTypes(T.edition); }
  function wilds() { return T.edition === 'e2021' ? ['silver', 'gold', 'penny'] : ['silver', 'gold']; }
  function openAdd(i) { sheet = { k: 'add', i: i, type: null, partner: null }; drawSheet(); }
  function openFight(i) { sheet = { k: 'fight', i: i, winner: null, cards: [] }; drawSheet(); }
  function drawSheet() {
    var el = $('ttSheet');
    if (!sheet) { el.hidden = true; el.innerHTML = ''; return; }
    var p = T.players[sheet.i], html = '<div class="panel">';
    if (sheet.k === 'add') {
      html += '<h2>' + esc(p.name) + ' pairs…</h2><div class="pick">' + assetTypes().map(function (t) {
        return '<button data-pk="' + t + '" class="' + (sheet.type === t ? 'on' : '') + '">' + A.icon(t) + '<span>' + RL.TYPES[t].short + '</span><b>' + money(val(t)) + '</b></button>';
      }).join('') + '</div><div class="sub" style="margin-top:10px">With</div><div class="pick">' +
        ['same'].concat(wilds()).map(function (w) {
          var on = (sheet.partner || 'same') === w;
          return '<button data-pw="' + w + '" class="' + (on ? 'on' : '') + '">' + A.icon(w === 'same' ? (sheet.type || assetTypes()[0]) : w) + '<span>' + (w === 'same' ? 'Matching' : RL.TYPES[w].short) + '</span></button>';
        }).join('') + '</div><div class="row"><button class="btn" data-tt="addok"' + (sheet.type ? '' : ' disabled') + '>Add pair</button><button class="btn ghost" data-tt="close">Cancel</button></div>';
    } else {
      var top = p.sets[p.sets.length - 1];
      html += '<h2>Fight over ' + esc(p.name) + '\'s ' + RL.TYPES[top.type].short + '</h2><div class="sub">Tap every card played in the fight, then who won.</div><div class="pick">' +
        [top.type].concat(wilds()).map(function (t) {
          var n = sheet.cards.filter(function (x) { return x === t; }).length;
          return '<button data-pc="' + t + '" class="' + (n ? 'on' : '') + '">' + A.icon(t) + '<span>' + RL.TYPES[t].short + '</span><b>' + (n ? '×' + n : '+') + '</b></button>';
        }).join('') + '<button data-pc="clear"><span style="font-size:20px;line-height:30px">↺</span><span>Clear</span></button></div>' +
        '<div class="sub" style="margin-top:10px">Winner</div><div class="row" style="justify-content:flex-start">' + T.players.map(function (q, j) {
          return '<button class="btn sm ' + (sheet.winner === j ? '' : 'ghost') + '" data-pwn="' + j + '">' + esc(q.name) + (j === sheet.i ? ' (kept it)' : '') + '</button>';
        }).join('') + '</div><div class="row"><button class="btn" data-tt="fightok"' + (sheet.winner == null ? ' disabled' : '') + '>Save</button><button class="btn ghost" data-tt="close">Cancel</button></div>';
    }
    el.innerHTML = html + '</div>'; el.hidden = false;
  }

  document.addEventListener('click', function (ev) {
    if (!ev.target.closest('#tab-table')) return;
    var b = ev.target.closest('[data-tt],[data-pk],[data-pw],[data-pc],[data-pwn]');
    if (!b) { if (ev.target.id === 'ttSheet') { sheet = null; drawSheet(); } return; }
    var d = b.dataset;
    if (d.pk) { sheet.type = d.pk; drawSheet(); return; }
    if (d.pw) { sheet.partner = d.pw; drawSheet(); return; }
    if (d.pc) { if (d.pc === 'clear') sheet.cards = []; else sheet.cards.push(d.pc); drawSheet(); return; }
    if (d.pwn != null) { sheet.winner = +d.pwn; drawSheet(); return; }
    var i = +d.i;
    switch (d.tt) {
      case 'add': openAdd(i); return;
      case 'fight': openFight(i); return;
      case 'close': sheet = null; drawSheet(); return;
      case 'addok':
        snap();
        T.players[sheet.i].sets.push({ type: sheet.type, cards: [sheet.type, !sheet.partner || sheet.partner === 'same' ? sheet.type : sheet.partner] });
        sheet = null; break;
      case 'fightok': {
        snap();
        var p = T.players[sheet.i], set = p.sets.pop();
        set.cards = set.cards.concat(sheet.cards);
        T.players[sheet.winner].sets.push(set);
        if (sheet.winner === sheet.i) { /* defender keeps it on top */ }
        sheet = null; break;
      }
      case 'plus': snap(); T.players.push({ name: 'P' + (T.players.length + 1), total: 0, sets: [] }); T.history.forEach(function (r) { r.push(0); }); break;
      case 'minus': snap(); T.players.pop(); T.history.forEach(function (r) { r.pop(); }); break;
      case 'reset': snap(); var names = T.players.map(function (p) { return p.name; }); T = fresh(); T.players = names.map(function (n) { return { name: n, total: 0, sets: [] }; }); break;
      default: return;
    }
    drawSheet(); save(); render();
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset.tn != null) { T.players[+t.dataset.tn].name = t.value.trim() || 'P' + (+t.dataset.tn + 1); save(); render(); }
    if (t.dataset.ttEd) { snap(); T.edition = t.value; save(); render(); }
  });
  $('ttEnd').addEventListener('click', function () {
    snap();
    var r = T.players.map(stackVal);
    T.players.forEach(function (p, i) { p.total += r[i]; p.sets = []; });
    T.history.push(r); T.round++;
    var best = Math.max.apply(null, T.players.map(function (p) { return p.total; }));
    save(); render();
    if (best >= 1000000) {
      var w = T.players.filter(function (p) { return p.total === best; });
      APP.toast(w.length === 1 ? w[0].name + ' reaches ' + money(best) + ' and wins!' : 'Tie at ' + money(best) + ': play another round.');
    } else APP.toast('Round banked.');
  });
  $('ttUndo').addEventListener('click', function () { if (!undo.length) return; T = JSON.parse(undo.pop()); save(); render(); });
  document.addEventListener('cya:tab', function (e) { if (e.detail === 'table') render(); });
  render();
  window.CYATracker = { stealChance: stealChance, get state() { return T; }, set state(v) { T = v; render(); } };
})();
