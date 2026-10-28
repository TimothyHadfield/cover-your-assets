/* cyacoach.js: Cover Your Assets' part of the shared coach kit (js/coach.js, never edit that one here):
 * the guided first game. Rules stay in the Rules tab.
 *   CYACoach.SEED, CYACoach.CFG   the guided game's deal (same cards every time: you start with two Jewels)
 *   CYACoach.steps(ctx)           ctx: { view() -> your view of the game or null, me() -> your seat }
 * Plain script: window.CYACoach in the browser, module.exports in node. */
(function (root) {
  'use strict';
  var SEED = 9, ID = 'cya-first-game', LEVEL = 'easy';
  var CFG = { players: 4, edition: 'classic', advanced: false, draft: false, teams: false, format: 'million' };

  function steps(ctx) {
    var v = function () { return ctx.view(); };
    var mine = function () { var x = v(); return x ? x.stacks[ctx.me()].length : 0; };
    var myTurn = function () { var x = v(); return !!x && x.phase === 'turn' && ctx.toAct() === ctx.me(); };
    var round1 = function () { var x = v(); return !!x && x.round === 1; };
    return [
      { title: 'Your first game', html: 'You against three Easy computers. Build a stack of matching pairs and steal other players\' top sets. Money is added up when the cards run out, and the first to <b>$1,000,000</b> wins.' },
      { target: ['#hand', '#bar'], title: 'Make a pair', html: 'You hold two <b>Jewels</b>. Tap both, then tap <b>Pair</b>. Two matching cards, or one card and a Silver or Gold wild, make a set.', when: function () { return myTurn() && mine() === 0; }, until: function () { return mine() >= 1; }, skipIf: function () { return mine() >= 1 || !round1(); } },
      { target: '#mystack', title: 'Your nest egg', html: 'Your first set is your <b>nest egg</b>: it can never be stolen. Every new set goes crosswise on top, and only the <b>top</b> set can be taken.', when: function () { return mine() >= 1; }, next: true },
      { target: '.pile[data-pile="discard"]', title: 'The discard pile', html: 'If the top discard matches a card in your hand, select that card and tap the pile to pair them. Otherwise you can pair from your hand or discard one card. Then you draw back up.', when: function () { return myTurn(); }, next: true },
      { target: '#opps', title: 'Steal', html: 'Hold a card that matches someone\'s <b>top set</b>, or a wild? Select it and tap their seat to <b>challenge</b>. You take turns adding matching cards; whoever plays the <b>last</b> card wins the set and every card played.', when: function () { return myTurn() && mine() >= 1; }, next: true },
      { target: '[data-act="hint"]', title: 'Stuck?', html: '<b>Hint</b> shows the move the Hard computer would make. <b>Undo</b> takes back your last move. Either one makes that game count as "with help" in My stats.', when: function () { return myTurn(); }, next: true },
      { title: 'You\'ve got it', html: 'Play on to $1,000,000. When you can steal, each target shows your chance to win the fight. Full rules are in the <b>Rules</b> tab.' }
    ];
  }

  var api = { SEED: SEED, CFG: CFG, ID: ID, LEVEL: LEVEL, steps: steps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CYACoach = api;
})(typeof window !== 'undefined' ? window : globalThis);
