// node tests/fx.test.js : sounds, animations and celebrations follow the real game events
var E = require('../js/engine.js'), AI = require('../js/ai.js');
var T = require('./helpers.js'), ok = T.ok, eq = T.eq;

// --- a fake browser just big enough for fx.js: audio nodes are counted, animations are counted ---
var animCalls = 0;
function param() { return { value: 0, setValueAtTime: function () {}, linearRampToValueAtTime: function () {}, exponentialRampToValueAtTime: function () {}, setTargetAtTime: function () {} }; }
function node(extra) { return Object.assign({ connect: function () {}, start: function () {}, stop: function () {}, gain: param(), frequency: param(), Q: param(), pan: param() }, extra || {}); }
function FakeAC() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = node(); }
FakeAC.prototype.createGain = function () { return node(); };
FakeAC.prototype.createOscillator = function () { return node(); };
FakeAC.prototype.createBiquadFilter = function () { return node(); };
FakeAC.prototype.createBufferSource = function () { return node(); };
FakeAC.prototype.createStereoPanner = function () { return node(); };
FakeAC.prototype.createDynamicsCompressor = function () { return node(); };
FakeAC.prototype.createBuffer = function (c, n) { return { getChannelData: function () { return new Float32Array(n); } }; };
FakeAC.prototype.resume = function () { return Promise.resolve(); };
function El() { this.style = { cssText: '' }; this.textContent = ''; this.children = []; }
El.prototype.getBoundingClientRect = function () { return { left: 10, top: 10, width: 40, height: 56 }; };
El.prototype.animate = function () { animCalls++; var a = {}; setTimeout(function () { if (a.onfinish) a.onfinish(); }, 0); return a; };
El.prototype.cloneNode = function () { return new El(); };
El.prototype.removeAttribute = function () {};
El.prototype.remove = function () {};
El.prototype.appendChild = function (c) { this.children.push(c); return c; };
El.prototype.getContext = function () { return null; };
El.prototype.setAttribute = function () {};
globalThis.AudioContext = FakeAC;
globalThis.document = { body: new El(), head: new El(), createElement: function () { return new El(); }, getElementById: function () { return null; }, addEventListener: function () {} };
globalThis.getComputedStyle = function () { return { borderRadius: '0' }; };
globalThis.innerWidth = 393; globalThis.innerHeight = 659;
globalThis.requestAnimationFrame = function (f) { return setTimeout(function () { f(Date.now() + 1e6); }, 0); };
globalThis.localStorage = undefined; // storage blocked: fx keeps settings in memory

require('../js/fx.js');
var FX = globalThis.FX, SFX = require('../js/sfx.js');
FX.init({ game: 'cover-your-assets', clicks: false });
FX.unlock(); // the player's first tap

// spy on FX.play / FX.celebrate (still calling through)
var played = [], celebrated = [];
var realPlay = FX.play, realCel = FX.celebrate;
FX.play = function (n, o) { played.push(n); return realPlay(n, o); };
FX.celebrate = function (o) { celebrated.push(o.kind); return realCel(o); };

var ui = { el: function () { return new El(); }, all: function () { return [new El(), new El()]; }, money: function (v) { return '$' + v; } };
var now = function (fn) { fn(); }; // run every scheduled cue at once

// --- (a) a scripted game: every event plays its sound ---
function playGame(seed, cfg) {
  var st = E.newGame(cfg, seed), rnd = (function (s) { return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })(seed);
  var prev = E.view(st, 0), steps = [];
  for (var i = 0; i < 3000 && st.phase !== 'gameOver'; i++) {
    var s = E.toAct(st), a;
    if (st.phase === 'roundEnd') a = { t: 'next' };
    else a = AI.choose(E.view(st, s), s, 'medium', rnd, E.legal(st));
    st = E.apply(st, a);
    var v = E.view(st, 0), cues = SFX.cues(prev, v, 0, { mine: function (x) { return x === 0; } });
    steps.push({ before: prev, after: v, cues: cues });
    prev = v;
  }
  return { st: st, steps: steps };
}
var names = function (cs) { return cs.filter(function (c) { return c.snd; }).map(function (c) { return c.snd; }); };
var found = null;
for (var seed = 1; seed < 60 && !found; seed++) {
  var g = playGame(seed, { players: 3, format: 'quick' });
  var ms = g.st.log.map(function (e) { return e.m; });
  if (ms.indexOf('stole') >= 0 && ms.indexOf('held') >= 0 && ms.indexOf('discard') >= 0) found = g;
}
ok(found, 'found a short game with a steal, a defend and a discard');
var counts = {}, sounds = {}, turns = 0, turnSounds = 0, draws = 0, drawSounds = 0;
found.steps.forEach(function (x) {
  x.after.log.slice(x.before.log.length).forEach(function (e) { counts[e.m] = (counts[e.m] || 0) + 1; });
  names(x.cues).forEach(function (n) { sounds[n] = (sounds[n] || 0) + 1; });
  var mine = function (v) { return v.phase === 'turn' && E.toAct(v) === 0; };
  if (mine(x.after) && !mine(x.before)) turns++;
  if (x.after.draw < x.before.draw && x.after.round === x.before.round) draws++;
  if (x.after.draw < x.before.draw && x.after.round === x.before.round && names(x.cues).indexOf('cardDeal') >= 0) drawSounds++;
  turnSounds += names(x.cues).filter(function (n) { return n === 'turn'; }).length;
});
eq(sounds.stamp, counts.challenge, 'every challenge slaps down (stamp)');
eq(sounds.whoosh, counts.stole, 'every steal whooshes the stack away');
eq(sounds.capture, counts.held, 'every defended set plays capture');
eq(sounds.cardFlip, counts.discard, 'every discard flips a card face up');
eq(sounds.place, (counts.pair || 0) + (counts.pairDiscard || 0) + (counts.answer || 0) + (counts.improve || 0), 'pairs and answers are set down (place)');
ok(sounds.coins >= (counts.pair || 0) + (counts.stole || 0), 'money changes hands with coins');
eq(drawSounds, draws, 'every draw from the deck plays cardDeal');
eq(turnSounds, turns, 'your-turn chime only when it becomes your turn');
ok(turns > 0 && turns < found.steps.length / 2, 'chime is not every step');
eq(SFX.cues(null, found.steps[0].after, 0, {}).length, 0, 'first look at a game (load, rejoin) plays nothing');
var last = found.steps[found.steps.length - 1];
var meWon = found.st.winner.seats.indexOf(0) >= 0;
eq(last.cues.filter(function (c) { return c.celebrate; }).map(function (c) { return c.celebrate; }), [meWon ? 'win' : 'lose'], 'game over celebrates the right kind for seat 0');
var other = SFX.cues(last.before, last.after, found.st.winner.seats[0], { mine: function (x) { return x === found.st.winner.seats[0]; } });
eq(other.filter(function (c) { return c.celebrate; }).map(function (c) { return c.celebrate; }), ['win'], 'the winner sees win');
var loser = [0, 1, 2].filter(function (s) { return found.st.winner.seats.indexOf(s) < 0; })[0];
var lc = SFX.cues(last.before, last.after, loser, { mine: function (x) { return x === loser; } });
eq(lc.filter(function (c) { return c.celebrate; }).map(function (c) { return c.celebrate; }), ['lose'], 'a loser sees lose');

// computers are never louder than you
var vols = []; found.steps.forEach(function (x) { x.cues.forEach(function (c) { if (c.snd && c.vol != null) vols.push(c.vol); }); });
ok(vols.every(function (v) { return v <= 1; }), 'no cue is louder than normal');

// --- performing cues: FX.play gets the mapped names; settings gate everything ---
function performAll() {
  found.steps.forEach(function (x) { SFX.perform(x.cues, FX, ui, 'pre', now); SFX.perform(x.cues, FX, ui, 'post', now); });
}
played = []; celebrated = []; FX.stats.plays = 0; animCalls = 0;
performAll();
var expect = []; found.steps.forEach(function (x) { expect = expect.concat(names(x.cues)); });
eq(played.filter(function (n) { return n !== 'win' && n !== 'lose' && n !== 'cheer' && n !== 'ding'; }), expect.filter(function (n) { return n !== 'ding'; }), 'FX.play receives exactly the mapped sound names in order');
ok(FX.stats.plays > 0, 'sound on: audio actually plays (' + FX.stats.plays + ')');
ok(animCalls > 0, 'animations on: elements animate (' + animCalls + ')');
eq(celebrated.filter(function (k) { return k !== 'big'; }), [meWon ? 'win' : 'lose'], 'celebrate called once at game end with the right kind');
var bigs = 0; found.steps.forEach(function (x) { bigs += x.cues.filter(function (c) { return c.celebrate === 'big'; }).length; });
eq(celebrated.filter(function (k) { return k === 'big'; }).length, bigs, 'big moments celebrated as mapped');

FX.set('sound', false);
FX.stats.plays = 0; performAll();
eq(FX.stats.plays, 0, 'Sound off: nothing plays');
FX.set('sound', true); FX.set('moves', false); FX.set('alerts', false); FX.set('celebrations', false);
FX.stats.plays = 0; performAll();
eq(FX.stats.plays, 0, 'Game sounds + Alerts + Celebrations off: nothing plays');
FX.reset();
FX.set('animations', false); animCalls = 0; performAll();
eq(animCalls, 0, 'Animations off: nothing animates');
FX.reset();

// --- big moment: stealing a $100K+ set ---
var bigSteal = { log: [{ s: 0, m: 'stole', from: 1, type: 'gold', value: 150000 }] };
var a0 = found.steps[5].before, b0 = JSON.parse(JSON.stringify(a0)); b0.log = a0.log.concat(bigSteal.log);
eq(SFX.cues(a0, b0, 0, { mine: function (x) { return x === 0; } }).filter(function (c) { return c.celebrate; }).map(function (c) { return c.celebrate; }), ['big'], 'stealing $150K is a big moment');
eq(SFX.cues(a0, b0, 1, { mine: function (x) { return x === 1; } }).filter(function (c) { return c.celebrate; }).length, 0, 'losing it is not');

setTimeout(function () { T.done('fx'); }, 50);
