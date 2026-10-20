// Lab numbers: "Which sets get stolen?" must be a true share (a set stolen twice counts once).
var T = require('./helpers.js'), LS = require('../tools/lab-stats.js');
global.window = {}; require('../js/lab-data.js'); var D = window.CYALabData;

// 1. The numbers shipped to the Lab tab are shares: never above 100%.
var over = D.stolenByType.filter(function (r) { return r.rate > 1; });
T.eq(over.length, 0, 'shipped stolen shares are all <= 100% (over: ' + over.map(function (r) { return r.type + ' ' + Math.round(r.rate * 100) + '%'; }).join(', ') + ')');

// 2. The calculation itself, on 40 real 4-player games of hard bots.
var acc = LS.study(4, 40, true), rows = LS.stolenByType(acc);
var steals = rows.reduce(function (a, r) { return a + r.steals; }, 0), once = rows.reduce(function (a, r) { return a + r.stolen; }, 0);
T.eq(acc.stealMismatch || 0, 0, 'every steal is traced to the set that moved');
T.ok(rows.every(function (r) { return r.rate >= 0 && r.rate <= 1 && r.stolen <= r.made && r.stolen <= r.steals; }), 'each kind: 0 <= share <= 100%, stolen sets <= sets made and <= steals');
T.ok(steals > once, 'some sets were stolen more than once (' + steals + ' steals, ' + once + ' different sets), so counting steals would overstate the share');
T.eq(once, acc.stolenObjs.size, 'different sets stolen, counted by name, matches counting the set objects themselves');
T.ok(once > 0, 'sets do get stolen (' + once + ')');
T.done('lab');
