/* Seats are interchangeable: a seat is 'human' (this device), 'bot' (computer, run by the host)
   or 'online' (a remote player). The host owns the full state and is the only place apply() runs.
   LocalHost runs everything on this device. An online host/guest pair can wrap the same
   interface: submit(seat, action), viewFor(seat), onChange(fn). */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var E = node ? require('./engine.js') : root.CYAEngine;
  var AI = node ? require('./ai.js') : root.CYAAI;

  function LocalHost(state, seats, opts) {
    this.state = state; this.seats = seats; this.opts = opts || {};
    this.subs = []; this.timer = null; this.paused = false;
  }
  LocalHost.prototype.onChange = function (fn) { this.subs.push(fn); };
  LocalHost.prototype.emit = function (info) { var self = this; this.subs.forEach(function (f) { f(self.state, info || {}); }); };
  LocalHost.prototype.viewFor = function (seat) { return E.view(this.state, seat); };
  LocalHost.prototype.submit = function (seat, action) {
    var st = this.state;
    if (st.phase === 'roundEnd' || st.phase === 'gameOver') {
      if (action.t !== 'next' || st.phase === 'gameOver') throw new Error('not now');
    } else if (E.toAct(st) !== seat) throw new Error('not your turn');
    var before = st;
    this.state = E.apply(st, action);
    this.emit({ seat: seat, action: action, before: before });
    this.schedule();
  };
  // run computer seats one step at a time, with a delay so people can follow
  LocalHost.prototype.schedule = function () {
    var self = this;
    clearTimeout(this.timer);
    if (this.paused) return;
    var st = this.state, s = E.toAct(st);
    if (s < 0 || this.seats[s].kind !== 'bot') return;
    var delay = this.opts.delay ? this.opts.delay(st) : 700;
    this.timer = setTimeout(function () {
      if (self.state !== st) return;
      var view = E.view(st, s);
      var legal = E.legal(st);
      var a = AI.choose(view, s, self.seats[s].level, Math.random, legal);
      self.submit(s, a);
    }, delay);
  };
  LocalHost.prototype.stop = function () { clearTimeout(this.timer); this.paused = true; };

  var api = { LocalHost: LocalHost };
  if (node) module.exports = api; else root.CYATransport = api;
})(this);
