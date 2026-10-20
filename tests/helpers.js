// tiny test helpers, no framework
var passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.log('FAIL: ' + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (got ' + a + ', want ' + b + ' +/- ' + tol + ')'); }
function done(name) {
  console.log(name + ': ' + passed + ' passed, ' + failed + ' failed');
  if (failed) process.exitCode = 1;
}
// every card id appears exactly once across all zones
function conserved(E, st) {
  var all = [];
  st.hands.forEach(function (h) { all = all.concat(h); });
  st.stacks.forEach(function (k) { k.forEach(function (set) { all = all.concat(set.cards); }); });
  all = all.concat(st.discard, st.draw, st.out);
  if (st.piles) st.piles.forEach(function (p) { all = all.concat(p); });
  if (st.battle) all = all.concat(st.battle.pot);
  if (all.length !== st.cards.length) return false;
  var seen = {};
  for (var i = 0; i < all.length; i++) { if (seen[all[i]]) return false; seen[all[i]] = 1; }
  return true;
}
module.exports = { ok: ok, eq: eq, near: near, done: done, conserved: conserved };
