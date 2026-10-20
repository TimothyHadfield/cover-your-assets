/* Sounds and small animations for real game events. cues(before, after, me) compares two table
   views (the log, the draw pile, whose turn) and returns what to play; perform() hands them to fx.js.
   Same in every mode: vs computers, hot-seat and online (each device diffs its own view). */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var E = node ? require('./engine.js') : root.CYAEngine;
  var BIG = 100000;           // stealing or defending a set this big is a "big moment"
  var GAP = 320;              // ms between consecutive log events, so a burst plays in order
  var OTHER = 0.8;            // other players' moves: a little quieter than yours

  function money(v) {
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(v % 1000000 ? 2 : 0) + 'M';
    if (v >= 1000) return '$' + Math.round(v / 1000) + 'K';
    return '$' + v;
  }
  function sum(v, ids) { return (ids || []).reduce(function (a, id) { return a + v.cards[id].value; }, 0); }
  function myTurn(v, me) { return v.phase === 'turn' && E.toAct(v) === me; }

  // before: the view you last saw (null = first look: play nothing); after: the view now
  function cues(a, b, me, ctx) {
    ctx = ctx || {};
    var out = [];
    if (!a || !b || !a.log || !b.log || a.cards.length !== b.cards.length || b.log.length < a.log.length) return out;
    var fmt = ctx.money || money, isMine = ctx.mine || function (s) { return s === me; };
    var fresh = b.log.slice(a.log.length).slice(-8), t = 0, newRound = false;
    var c = function (o) { o.at = (o.at || 0) + t; out.push(o); };
    var snd = function (name, s, at, o) { c(Object.assign({ snd: name, at: at || 0, vol: s === me || s < 0 ? 1 : OTHER }, o || {})); };
    fresh.forEach(function (e) {
      var s = e.s;
      switch (e.m) {
        case 'pair': case 'pairDiscard': case 'improve': {
          var val = sum(b, e.cards);
          if (e.m === 'pairDiscard') snd('cardDeal', s);
          if (s === me) (e.m === 'pairDiscard' ? [e.cards[0]] : e.cards).forEach(function (id) { c({ pre: true, anim: 'fly', from: ['handCard', id], to: ['stack', me] }); });
          if (s === me && e.m === 'pairDiscard') c({ pre: true, anim: 'fly', from: ['discard'], to: ['stack', me] });
          snd('place', s, e.m === 'pairDiscard' ? 120 : 0);
          snd(e.m === 'improve' ? 'coin' : 'coins', s, 160);
          c({ anim: 'float', el: ['stack', s], text: '+' + fmt(val), color: 'var(--good)', at: 160 });
          break;
        }
        case 'discard':
          if (s === me) c({ pre: true, anim: 'fly', from: ['handCard', e.cards[0]], to: ['discard'] });
          snd('cardFlip', s);
          break;
        case 'challenge':
          snd('stamp', s);
          c({ anim: 'shake', el: ['fightSet'], at: 60 });
          break;
        case 'answer':
          snd('place', s, 0, { pitch: 0.9 });
          break;
        case 'fold':
          snd('miss', s);
          break;
        case 'held':
          snd('capture', s);
          c({ anim: 'pop', el: ['stack', s], at: 80 });
          c({ anim: 'float', el: ['stack', s], text: 'Kept ' + fmt(e.value), color: 'var(--good)', at: 80 });
          if (isMine(s) && e.value >= BIG) c({ celebrate: 'big', el: ['stack', s], at: 200 });
          break;
        case 'stole':
          c({ pre: true, anim: 'fly', from: ['fightSet'], to: ['stack', s] });
          snd('whoosh', s);
          snd('coins', s, 260);
          c({ anim: 'float', el: ['stack', s], text: '+' + fmt(e.value), color: 'var(--good)', at: 260 });
          if (e.from === me) { c({ anim: 'shake', el: ['stack', me], at: 120 }); c({ anim: 'flash', el: ['stack', me], color: 'var(--bad)', at: 120 }); }
          if (isMine(s) && e.value >= BIG) c({ celebrate: 'big', el: ['stack', s], at: 380 });
          break;
        case 'swap':
          snd('whoosh', s);
          c({ anim: 'pop', el: ['stack', s], at: 150 }); c({ anim: 'pop', el: ['stack', e.target], at: 150 });
          break;
        case 'move':
          snd('slide', s);
          c({ anim: 'pop', el: ['stack', e.target], at: 150 });
          break;
        case 'draft':
          snd('cardDeal', s); snd('coins', s, 160);
          c({ anim: 'float', el: ['stack', s], text: '+' + fmt(sum(b, e.cards)), color: 'var(--good)', at: 160 });
          break;
        case 'revealSwap': snd('cardFlip', -1); snd('whoosh', -1, 150); break;
        case 'revealSwapVoid': snd('cardFlip', -1); snd('shuffle', -1, 150); break;
        case 'revealMove': snd('cardFlip', -1); break;
        case 'roundEnd': {
          snd('coins', -1);
          var u1 = E.units(b, b.totals).vals, r1 = E.units(b, b.roundScores).vals;
          var u0 = u1.map(function (x, i) { return Math.max(0, x - (r1[i] || 0)); });
          c({ anim: 'totals', from: u0, to: u1, at: 60 });
          break;
        }
        case 'gameOver': {
          var won = b.winner && b.winner.seats.some(isMine);
          c({ celebrate: won ? 'win' : 'lose', at: 250 });
          break;
        }
        default:
          if (/^Round \d+ dealt$/.test(e.m)) { newRound = true; snd('shuffle', -1); for (var i = 0; i < 3; i++) snd('cardDeal', -1, 450 + i * 110); }
      }
      t += GAP;
    });
    // cards drawn from the deck (any player), when they land
    if (!newRound && typeof a.draw === 'number' && b.draw < a.draw && b.round === a.round) {
      var n = Math.min(3, a.draw - b.draw), last = fresh.length ? fresh[fresh.length - 1].s : -1;
      t = Math.max(0, t - GAP);
      for (var k = 0; k < n; k++) snd('cardDeal', last, 220 + k * 100, { vol: last === me ? 0.9 : 0.7 });
      t += GAP;
    }
    // your stack's money counts up (or down when a set is stolen)
    if (b.stacks && a.stacks && b.round === a.round) {
      var v0 = E.stackValue(a, me), v1 = E.stackValue(b, me);
      if (v0 !== v1) c({ anim: 'count', el: ['stackValue', me], from: v0, to: v1, at: -t + 120 });
    }
    // your-turn chime only when it BECOMES your turn
    if (ctx.human !== false && myTurn(b, me) && !myTurn(a, me)) {
      t = Math.max(0, t - GAP);
      c({ snd: 'turn', at: 250, vol: 1 });
      c({ anim: 'pulse', el: ['turnMsg'], at: 250 });
    }
    return out;
  }

  // phase 'pre' = before the table is redrawn (cards still where they were); 'post' = after
  function perform(list, FX, ui, phase, later) {
    if (!FX || !list) return;
    later = later || function (fn, ms) { setTimeout(fn, ms); };
    list.forEach(function (q) {
      if (!!q.pre !== (phase === 'pre')) return;
      var run = function () {
        try {
          if (q.snd) FX.play(q.snd, { vol: q.vol, pitch: q.pitch });
          var el = q.el ? ui.el(q.el[0], q.el[1]) : null;
          if (q.celebrate) FX.celebrate({ kind: q.celebrate, colors: ['#f0b354', '#4cc38a', '#6ea8fe', '#e8eaf0', '#ffd27a'], at: el });
          switch (q.anim) {
            case 'fly': { var f = ui.el(q.from[0], q.from[1]), to = ui.el(q.to[0], q.to[1]); if (f && to) FX.flyTo(f, to, { duration: 380 }); break; }
            case 'float': if (el) FX.floatText(el, q.text, q.color); break;
            case 'shake': if (el) FX.shake(el); break;
            case 'pop': if (el) FX.pop(el); break;
            case 'flash': if (el) FX.flash(el, q.color); break;
            case 'pulse': if (el) FX.pulse(el); break;
            case 'count': if (el) FX.countUp(el, q.from, q.to, { duration: 600, format: function (n) { return (ui.money || money)(Math.round(n / 1000) * 1000); } }); break;
            case 'totals': {
              var cells = ui.all('roundTotals') || [];
              cells.forEach(function (td, i) { if (q.to[i] != null) FX.countUp(td, q.from[i] || 0, q.to[i], { duration: 900, format: function (n) { return (ui.money || money)(Math.round(n / 1000) * 1000); } }); });
              break;
            }
          }
        } catch (e) { /* effects never break the game */ }
      };
      if (phase === 'pre') run(); else later(run, Math.max(0, q.at || 0));
    });
  }

  var api = { cues: cues, perform: perform, BIG: BIG };
  if (node) module.exports = api; else root.CYASfx = api;
})(this);
