/* Cover Your Assets: card lists for each edition. Facts only (names, values, counts).
   Sources and cross-checks are in docs/rules-check.md. */
(function (root) {
  'use strict';

  // key: id used everywhere; name: as printed; value in dollars; kind: asset | wild | action
  var TYPES = {
    stamps:   { name: 'Stamp Collection',        short: 'Stamps',   kind: 'asset' },
    cash:     { name: 'Cash Under the Mattress', short: 'Cash',     kind: 'asset' },
    baseball: { name: 'Baseball Cards',          short: 'Baseball', kind: 'asset' },
    piggy:    { name: 'Piggy Bank',              short: 'Piggy',    kind: 'asset' },
    stocks:   { name: 'Stocks',                  short: 'Stocks',   kind: 'asset' },
    coins:    { name: 'Coin Collection',         short: 'Coins',    kind: 'asset' },
    bank:     { name: 'Bank Account',            short: 'Bank',     kind: 'asset' },
    auto:     { name: 'Classic Auto',            short: 'Auto',     kind: 'asset' },
    jewels:   { name: 'Jewels',                  short: 'Jewels',   kind: 'asset' },
    boat:     { name: 'Speed Boat',              short: 'Boat',     kind: 'asset' },
    home:     { name: 'Home',                    short: 'Home',     kind: 'asset' },
    silver:   { name: 'Silver',                  short: 'Silver',   kind: 'wild' },
    gold:     { name: 'Gold',                    short: 'Gold',     kind: 'wild' },
    penny:    { name: 'Penny Jar',               short: 'Penny Jar',kind: 'wild' },
    swap:     { name: 'Swap',                    short: 'Swap',     kind: 'action' },
    move:     { name: 'Move',                    short: 'Move',     kind: 'action' }
  };

  // [type, value, count]
  var EDITIONS = {
    classic: {
      label: 'Classic (2011-2018)',
      cards: [
        ['stamps', 5000, 10], ['cash', 5000, 10], ['baseball', 5000, 10], ['piggy', 5000, 10],
        ['stocks', 10000, 10], ['coins', 10000, 10], ['bank', 10000, 10],
        ['auto', 15000, 10], ['jewels', 15000, 10],
        ['home', 20000, 8],
        ['silver', 25000, 8], ['gold', 50000, 4]
      ],
      advanced: []
    },
    e2021: {
      label: 'New (2021+)',
      cards: [
        ['baseball', 5000, 10], ['coins', 5000, 10], ['piggy', 5000, 10],
        ['cash', 10000, 9], ['bank', 10000, 9], ['stocks', 10000, 9],
        ['boat', 15000, 9], ['jewels', 15000, 9], ['auto', 15000, 9],
        ['home', 20000, 8],
        ['silver', 25000, 8], ['gold', 50000, 4]
      ],
      // only in the deck when Advanced rules are on
      advanced: [['swap', 0, 2], ['move', 0, 2], ['penny', 1000, 2]],
      // 2-player game removes these before dealing
      twoPlayerRemove: [['home', 8], ['silver', 2], ['gold', 1]]
    }
  };

  /** Build the list of physical cards for a setup. Returns [{id,type,value,kind}] */
  function buildDeck(edition, opts) {
    opts = opts || {};
    var ed = EDITIONS[edition];
    if (!ed) throw new Error('unknown edition ' + edition);
    var list = ed.cards.slice();
    if (opts.advanced) list = list.concat(ed.advanced);
    var remove = {};
    if (opts.players === 2 && opts.draft && ed.twoPlayerRemove) {
      ed.twoPlayerRemove.forEach(function (r) { remove[r[0]] = r[1]; });
    }
    var out = [];
    list.forEach(function (row) {
      var n = row[2] - (remove[row[0]] || 0);
      for (var i = 0; i < n; i++) {
        out.push({ id: out.length, type: row[0], value: row[1], kind: TYPES[row[0]].kind });
      }
    });
    return out;
  }

  /** Asset types (not wild/action) in an edition, highest value first. */
  function assetTypes(edition) {
    return EDITIONS[edition].cards
      .filter(function (r) { return TYPES[r[0]].kind === 'asset'; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (r) { return r[0]; });
  }

  function valueOf(edition, type) {
    var ed = EDITIONS[edition];
    var all = ed.cards.concat(ed.advanced);
    for (var i = 0; i < all.length; i++) if (all[i][0] === type) return all[i][1];
    return 0;
  }

  function countOf(edition, type, opts) {
    var d = buildDeck(edition, opts || { advanced: true });
    return d.filter(function (c) { return c.type === type; }).length;
  }

  var api = { TYPES: TYPES, EDITIONS: EDITIONS, buildDeck: buildDeck, assetTypes: assetTypes, valueOf: valueOf, countOf: countOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CYARules = api;
})(this);
