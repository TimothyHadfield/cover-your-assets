/* Cover Your Assets: original card art (SVG strings). No dependencies.
 *
 *   CYAArt.face(type, value) -> full card face, viewBox 0 0 100 140
 *   CYAArt.icon(type)        -> illustration only, viewBox 0 0 40 40
 *   CYAArt.back()            -> card back, viewBox 0 0 100 140
 *
 * Every SVG scales to its container width (no width/height attributes);
 * size it with CSS, e.g. `.card svg { width: 100%; height: auto; display: block }`.
 *
 * Gradient/pattern ids: every call gets its own unique id suffix (cya1, cya2, ...),
 * so any number of cards can sit on one page without id collisions. No shared defs needed.
 *
 * All drawings are original simple shapes made for this site.
 */
(function (root) {
  'use strict';

  var n = 0;
  function uid() { return 'cya' + (++n); }

  var O = '#232838';
  var S = ' stroke="' + O + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
  var SVG = '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" ';

  var SHORT = {
    stamps: 'Stamps', cash: 'Cash', baseball: 'Baseball', piggy: 'Piggy Bank', stocks: 'Stocks',
    coins: 'Coins', bank: 'Bank Acct', auto: 'Classic Auto', jewels: 'Jewels', boat: 'Speed Boat',
    home: 'Home', silver: 'Silver', gold: 'Gold', penny: 'Penny Jar', swap: 'Swap', move: 'Move'
  };

  // Metallic gradients (vertical), used by wild cards and the silver/gold bar drawings.
  var METAL = {
    silver: ['#ffffff', '#c9cfd9', '#9aa3b3', '#e4e8ef'],
    gold:   ['#fff4b8', '#f2c94c', '#c8930f', '#f6d66b'],
    copper: ['#f7c49a', '#d98a52', '#a4552a', '#e7a26f']
  };
  function grad(id, stops, horiz) {
    var s = '';
    for (var i = 0; i < stops.length; i++) {
      s += '<stop offset="' + Math.round(i * 100 / (stops.length - 1)) + '%" stop-color="' + stops[i] + '"/>';
    }
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (horiz ? 1 : 0.35) + '" y2="' + (horiz ? 0 : 1) + '">' + s + '</linearGradient>';
  }

  // Colour per value tier: c = band colour, d = dark (text), t = pale tint, k = text on band
  function tier(value, type) {
    if (type === 'swap' || type === 'move' || value === 0) return { c: '#7048c8', d: '#452a85', t: '#ece4fa', k: '#fff', tag: 'ACTION' };
    if (type === 'penny' || value === 1000) return { metal: 'copper', d: '#6e3515', t: '#f8e6d8', k: '#4a1f08', tag: 'WILD ×2' };
    if (type === 'gold' || value >= 50000) return { metal: 'gold', d: '#6b4e00', t: '#fbf1cf', k: '#4a3500', tag: 'WILD' };
    if (type === 'silver' || value >= 25000) return { metal: 'silver', d: '#3f4757', t: '#eceff4', k: '#2a303c', tag: 'WILD' };
    if (value >= 20000) return { c: '#c23246', d: '#7f1f2d', t: '#f9e1e4', k: '#fff' };
    if (value >= 15000) return { c: '#d9731f', d: '#8a4410', t: '#fbeadb', k: '#fff' };
    if (value >= 10000) return { c: '#2f6bc4', d: '#1d4482', t: '#e2ebf8', k: '#fff' };
    return { c: '#2e8b57', d: '#1b5a37', t: '#e1f2e7', k: '#fff' };
  }

  function money(v) {
    if (!v) return '';
    return '$' + (v >= 1000 ? (v / 1000) + 'K' : v);
  }

  // Perforated edge: rectangle with round bites cut along every side.
  function scallop(x, y, w, h, s) {
    var r = s / 2, d = 'M' + x + ',' + y, i;
    var a = ' a' + r + ',' + r + ' 0 0 0 ';
    for (i = 0; i < w / s; i++) d += a + s + ',0';
    for (i = 0; i < h / s; i++) d += a + '0,' + s;
    for (i = 0; i < w / s; i++) d += a + (-s) + ',0';
    for (i = 0; i < h / s; i++) d += a + '0,' + (-s);
    return d + 'Z';
  }

  // Illustrations in a 40x40 box. u = unique id suffix for any gradients.
  var ART = {
    stamps: function () {
      return '<path d="' + scallop(8, 6, 24, 28, 4) + '" fill="#fffdf6"' + S + '/>' +
        '<rect x="12" y="10" width="16" height="20" fill="#8fc9ef" stroke="' + O + '" stroke-width="1"/>' +
        '<circle cx="23" cy="15" r="2.6" fill="#ffd25a"/>' +
        '<path d="M12,30 L17.5,20 L21,25 L24,21.5 L28,30 Z" fill="#3d9a5d"/>' +
        '<rect x="12" y="10" width="16" height="20" fill="none" stroke="' + O + '" stroke-width="1"/>';
    },
    cash: function () {
      return '<rect x="5" y="14" width="30" height="11" rx="1.5" fill="#7fc28e"' + S + '/>' +
        '<rect x="7" y="19" width="30" height="14" rx="1.5" fill="#a5dbad"' + S + '/>' +
        '<circle cx="25" cy="27" r="3.6" fill="none" stroke="#2e6b3d" stroke-width="1.3"/>' +
        '<text x="25" y="29.2" font-size="6" font-weight="900" text-anchor="middle" fill="#2e6b3d" font-family="system-ui,sans-serif">$</text>' +
        '<rect x="10" y="29" width="8" height="1.4" fill="#2e6b3d" opacity=".5"/>' +
        '<rect x="2" y="3" width="34" height="18" rx="4" fill="#dfe6f5"' + S + '/>' +
        '<path d="M5,15 H33" stroke="#9fb0d3" stroke-width="1" stroke-dasharray="2 2"/>' +
        '<circle cx="11" cy="10" r="1.1" fill="' + O + '"/><circle cx="19" cy="10" r="1.1" fill="' + O + '"/><circle cx="27" cy="10" r="1.1" fill="' + O + '"/>';
    },
    baseball: function () {
      return '<g transform="rotate(-9 18 20)"><rect x="6" y="4" width="22" height="30" rx="2" fill="#fff"' + S + '/>' +
        '<rect x="9" y="7" width="16" height="16" fill="#a9d3f2"/>' +
        '<circle cx="17" cy="12.5" r="3" fill="#e9b48c" stroke="' + O + '" stroke-width="1"/>' +
        '<path d="M11,23 Q11,16.5 17,16.5 Q23,16.5 23,23 Z" fill="#2f6bc4" stroke="' + O + '" stroke-width="1"/>' +
        '<rect x="9" y="25.5" width="16" height="5" fill="#e04a4a"/></g>' +
        '<circle cx="29" cy="29" r="8" fill="#fff"' + S + '/>' +
        '<path d="M24.2,23 Q27.6,29 24.2,35 M33.8,23 Q30.4,29 33.8,35" fill="none" stroke="#d33b3b" stroke-width="1.3" stroke-dasharray="1.6 .9"/>';
    },
    piggy: function () {
      return '<rect x="10" y="27" width="4.5" height="7" rx="1" fill="#ee8aaa"' + S + '/>' +
        '<rect x="22" y="27" width="4.5" height="7" rx="1" fill="#ee8aaa"' + S + '/>' +
        '<path d="M6.5,21 q-4,-1 -2.5,-4.5" fill="none" stroke="' + O + '" stroke-width="1.4" stroke-linecap="round"/>' +
        '<circle cx="18" cy="8" r="3.4" fill="#f5c542"' + S + '/>' +
        '<ellipse cx="19" cy="22" rx="13" ry="9.5" fill="#f6a5be"' + S + '/>' +
        '<path d="M10.5,15 L12,7 L17.5,13" fill="#ee8aaa"' + S + '/>' +
        '<ellipse cx="32" cy="22" rx="3.6" ry="4.2" fill="#ee8aaa"' + S + '/>' +
        '<circle cx="31" cy="21" r=".8" fill="' + O + '"/><circle cx="33.2" cy="23" r=".8" fill="' + O + '"/>' +
        '<circle cx="25" cy="18" r="1.4" fill="' + O + '"/>' +
        '<path d="M14.5,13.4 H21.5" stroke="' + O + '" stroke-width="2" stroke-linecap="round"/>';
    },
    stocks: function () {
      return '<rect x="10" y="26" width="4" height="8" fill="#cfe1f7"/><rect x="16" y="22" width="4" height="12" fill="#cfe1f7"/>' +
        '<rect x="22" y="19" width="4" height="15" fill="#cfe1f7"/><rect x="28" y="14" width="4" height="20" fill="#cfe1f7"/>' +
        '<path d="M6,5 V34 H36" fill="none" stroke="' + O + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M8,30 L15,23 L20.5,26 L31,12.5" fill="none" stroke="#1f9d55" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<polygon points="34.5,8 33.6,15.6 27.2,11" fill="#1f9d55" stroke="#1f9d55" stroke-width="1" stroke-linejoin="round"/>';
    },
    coins: function () {
      var s = '', ys = [29, 24, 19, 14];
      for (var i = 0; i < ys.length; i++) {
        var y = ys[i], x = i % 2 ? 9 : 7;
        s += '<ellipse cx="' + (x + 12) + '" cy="' + (y + 4) + '" rx="12" ry="4" fill="#c48d10"' + S + '/>' +
          '<rect x="' + x + '" y="' + y + '" width="24" height="4" fill="#c48d10"/>' +
          '<path d="M' + x + ',' + y + ' v4 M' + (x + 24) + ',' + y + ' v4" stroke="' + O + '" stroke-width="1.6"/>' +
          '<ellipse cx="' + (x + 12) + '" cy="' + y + '" rx="12" ry="4" fill="#f5c84c"' + S + '/>';
      }
      return s + '<text x="21" y="16.2" font-size="5.5" font-weight="900" text-anchor="middle" fill="#9a6a00" font-family="system-ui,sans-serif">$</text>';
    },
    bank: function () {
      var s = '<rect x="4" y="31" width="32" height="5" fill="#dfe4ee"' + S + '/>' +
        '<polygon points="3,14 20,4 37,14" fill="#eef1f7"' + S + '/>' +
        '<rect x="5" y="14" width="30" height="3.5" fill="#dfe4ee"' + S + '/>';
      for (var x = 8; x <= 29; x += 7) s += '<rect x="' + x + '" y="17.5" width="3.6" height="13.5" fill="#fff"' + S + '/>';
      return s + '<text x="20" y="12.6" font-size="6.5" font-weight="900" text-anchor="middle" fill="#2f6bc4" font-family="system-ui,sans-serif">$</text>';
    },
    auto: function () {
      return '<path d="M2.5,28 V22.5 Q2.5,19 6.5,19 H10.5 L15,11.5 H26 L30.5,19 H34.5 Q38,19 38,23 V28 Z" fill="#d63a3a"' + S + '/>' +
        '<path d="M16.3,13.6 H19.6 V19 H13.2 Z M21.6,13.6 H25 L28,19 H21.6 Z" fill="#bfe3f5" stroke="' + O + '" stroke-width="1"/>' +
        '<path d="M5,23.5 H35" stroke="#8f1f1f" stroke-width="1"/>' +
        '<circle cx="36" cy="21.5" r="1.4" fill="#ffd25a"/>' +
        '<circle cx="11" cy="28.5" r="5.5" fill="' + O + '"/><circle cx="11" cy="28.5" r="2.3" fill="#d8dce5"/>' +
        '<circle cx="30" cy="28.5" r="5.5" fill="' + O + '"/><circle cx="30" cy="28.5" r="2.3" fill="#d8dce5"/>';
    },
    jewels: function () {
      return '<polygon points="7,14 13.5,6 26.5,6 33,14 20,35" fill="#7fd7ea"' + S + '/>' +
        '<polygon points="7,14 13.5,6 26.5,6 33,14" fill="#c4f1fa"' + S + '/>' +
        '<path d="M13.5,6 L16.5,14 L20,35 M26.5,6 L23.5,14 L20,35 M16.5,14 L20,6 L23.5,14" fill="none" stroke="' + O + '" stroke-width="1.1" stroke-linejoin="round"/>' +
        '<path d="M34,2.5 v5 M31.5,5 h5" stroke="#d9a514" stroke-width="1.4" stroke-linecap="round"/>';
    },
    boat: function () {
      return '<path d="M2,17 h6 M0.5,21 h5" stroke="#2f80d0" stroke-width="1.4" stroke-linecap="round"/>' +
        '<path d="M19,21.5 L23.5,14.5 H27 L29,21.5" fill="#bfe3f5"' + S + '/>' +
        '<path d="M4,21.5 H38 Q34,29.5 27,30 H7 Z" fill="#fff"' + S + '/>' +
        '<path d="M6,25.5 H34.5" stroke="#d63a3a" stroke-width="2.2"/>' +
        '<path d="M1,34 q3,-3 6,0 t6,0 t6,0 t6,0 t6,0 t6,0" fill="none" stroke="#2f80d0" stroke-width="2.4" stroke-linecap="round"/>';
    },
    home: function () {
      return '<rect x="26" y="6" width="4.5" height="9" fill="#b5533c"' + S + '/>' +
        '<rect x="8" y="18" width="24" height="17" fill="#f6e7c8"' + S + '/>' +
        '<polygon points="3.5,19.5 20,5.5 36.5,19.5" fill="#c8463c"' + S + '/>' +
        '<rect x="17" y="24" width="6" height="11" fill="#8a5a33"' + S + '/>' +
        '<rect x="10.5" y="22.5" width="4.5" height="4.5" fill="#bfe3f5"' + S + '/>' +
        '<rect x="25" y="22.5" width="4.5" height="4.5" fill="#bfe3f5"' + S + '/>';
    },
    silver: function (u) { return bars(u, METAL.silver, '#5d6576'); },
    gold: function (u) { return bars(u, METAL.gold, '#8a6200'); },
    penny: function () {
      var s = '<path d="M10,11 H30 Q34.5,15 34.5,21 V31 Q34.5,36 29.5,36 H10.5 Q5.5,36 5.5,31 V21 Q5.5,15 10,11 Z" fill="#e3f2f8"' + S + '/>';
      var c = [[13, 31], [20, 32], [27, 31], [16.5, 25.5], [23.5, 25.8], [20, 19.8], [12.5, 21]];
      for (var i = 0; i < c.length; i++) s += '<circle cx="' + c[i][0] + '" cy="' + c[i][1] + '" r="3.3" fill="#c87533" stroke="#6e3515" stroke-width="1"/>';
      return s + '<path d="M9,17 V28" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>' +
        '<rect x="10.5" y="4.5" width="19" height="6.5" rx="1.6" fill="#9aa3b5"' + S + '/>';
    },
    swap: function () {
      return '<path d="M5,29 C15,29 19,11 30,11" fill="none" stroke="#452a85" stroke-width="3.4" stroke-linecap="round"/>' +
        '<polygon points="36,11 29,6 29,16" fill="#452a85" stroke="#452a85" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path d="M5,11 C15,11 19,29 30,29" fill="none" stroke="#e0832f" stroke-width="3.4" stroke-linecap="round"/>' +
        '<polygon points="36,29 29,24 29,34" fill="#e0832f" stroke="#e0832f" stroke-width="1.2" stroke-linejoin="round"/>';
    },
    move: function () {
      return '<rect x="7" y="6" width="14" height="20" rx="2" fill="#f3eefc"' + S + '/>' +
        '<rect x="5" y="10" width="14" height="20" rx="2" fill="#f8f5fd"' + S + '/>' +
        '<rect x="3" y="14" width="14" height="20" rx="2" fill="#fff"' + S + '/>' +
        '<path d="M27,32 V10" stroke="#452a85" stroke-width="3" stroke-linecap="round"/>' +
        '<polygon points="22.5,12.5 27,5.5 31.5,12.5" fill="#452a85" stroke="#452a85" stroke-width="1" stroke-linejoin="round"/>' +
        '<path d="M34.5,8 V30" stroke="#e0832f" stroke-width="3" stroke-linecap="round"/>' +
        '<polygon points="30,27.5 34.5,34.5 39,27.5" fill="#e0832f" stroke="#e0832f" stroke-width="1" stroke-linejoin="round"/>';
    }
  };

  // Three stacked ingots with a metal gradient.
  function bars(u, stops, mark) {
    var id = 'm' + u, s = '<defs>' + grad(id, stops) + '</defs>';
    var pos = [[2, 25], [20, 25], [11, 15]];
    for (var i = 0; i < pos.length; i++) {
      var x = pos[i][0], y = pos[i][1];
      s += '<polygon points="' + (x + 3.5) + ',' + y + ' ' + (x + 14.5) + ',' + y + ' ' + (x + 18) + ',' + (y + 10) + ' ' + x + ',' + (y + 10) + '" fill="url(#' + id + ')"' + S + '/>' +
        '<path d="M' + (x + 5) + ',' + (y + 3) + ' H' + (x + 13) + '" stroke="' + mark + '" stroke-width="1" opacity=".7"/>';
    }
    return s;
  }

  function face(type, value) {
    var u = uid(), T = tier(value, type), name = SHORT[type] || type;
    var draw = ART[type] || ART.coins;
    var band = T.c, defs = '';
    if (T.metal) { defs += grad('b' + u, METAL[T.metal], true); band = 'url(#b' + u + ')'; }
    var edge = T.metal ? T.d : T.c;
    var label = (name + ' ' + money(value)).trim();
    return SVG + 'viewBox="0 0 100 140" role="img" aria-label="' + label + '">' +
      (defs ? '<defs>' + defs + '</defs>' : '') +
      '<rect x="1" y="1" width="98" height="138" rx="8" fill="#fbf7ee" stroke="#d6ccb4" stroke-width="1"/>' +
      '<rect x="5" y="5" width="90" height="130" rx="5" fill="none" stroke="' + edge + '" stroke-width="1.6"/>' +
      '<path d="M5,10 a5,5 0 0 1 5,-5 h80 a5,5 0 0 1 5,5 v17 h-90 Z" fill="' + band + '"/>' +
      (value ? '<text x="10" y="22" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="16" font-weight="900" fill="' + T.k + '">' + money(value) + '</text>' : '') +
      (T.tag ? '<text x="' + (value ? 90 : 50) + '" y="' + (value ? 19.5 : 20.5) + '" text-anchor="' + (value ? 'end' : 'middle') + '" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="' + (value ? 7.5 : 10) + '" font-weight="800" letter-spacing=".6" fill="' + T.k + '">' + T.tag + '</text>' : '') +
      '<circle cx="50" cy="70" r="34" fill="' + T.t + '"/>' +
      '<g transform="translate(20 40) scale(1.5)">' + draw(u) + '</g>' +
      '<path d="M5,113 h90 v17 a5,5 0 0 1 -5,5 h-80 a5,5 0 0 1 -5,-5 Z" fill="' + T.t + '"/>' +
      '<path d="M5,113 h90" stroke="' + edge + '" stroke-width="1"/>' +
      '<text x="50" y="128.5" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="11" font-weight="800" fill="' + T.d + '">' + name + '</text>' +
      '</svg>';
  }

  function icon(type) {
    var draw = ART[type] || ART.coins;
    return SVG + 'viewBox="0 0 40 40" role="img" aria-label="' + (SHORT[type] || type) + '">' + draw(uid()) + '</svg>';
  }

  // Card back: navy with an original gold guilloche rosette and a "$" medallion.
  function back() {
    var u = uid(), p = 'p' + u, rings = '';
    for (var i = 0; i < 18; i++) {
      rings += '<ellipse cx="50" cy="70" rx="30" ry="11" transform="rotate(' + (i * 10) + ' 50 70)"/>';
    }
    for (var j = 0; j < 12; j++) {
      rings += '<ellipse cx="50" cy="70" rx="40" ry="20" transform="rotate(' + (j * 15) + ' 50 70)"/>';
    }
    return SVG + 'viewBox="0 0 100 140" role="img" aria-label="Card back">' +
      '<defs><pattern id="' + p + '" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<path d="M0,4 H8 M4,0 V8" stroke="#f0b354" stroke-width=".35" opacity=".28"/></pattern>' +
      '<clipPath id="c' + u + '"><rect x="7" y="7" width="86" height="126" rx="4"/></clipPath></defs>' +
      '<rect x="1" y="1" width="98" height="138" rx="8" fill="#1b2a4e" stroke="#0c1530" stroke-width="1"/>' +
      '<rect x="7" y="7" width="86" height="126" rx="4" fill="url(#' + p + ')"/>' +
      '<g clip-path="url(#c' + u + ')" fill="none" stroke="#f0b354" stroke-width=".45" opacity=".55">' + rings + '</g>' +
      '<rect x="4" y="4" width="92" height="132" rx="6" fill="none" stroke="#f0b354" stroke-width="1.2"/>' +
      '<rect x="7" y="7" width="86" height="126" rx="4" fill="none" stroke="#f0b354" stroke-width=".5" opacity=".7"/>' +
      '<circle cx="50" cy="70" r="15" fill="#1b2a4e" stroke="#f0b354" stroke-width="1.6"/>' +
      '<circle cx="50" cy="70" r="12" fill="none" stroke="#f0b354" stroke-width=".6" stroke-dasharray="1.2 1.2"/>' +
      '<text x="50" y="77.5" text-anchor="middle" font-family="Georgia,serif" font-size="21" font-weight="700" fill="#f0b354">$</text>' +
      '</svg>';
  }

  // Speed: build each drawing once, then hand out copies with a fresh id suffix.
  var cache = {};
  function cached(key, make) {
    var c = cache[key];
    if (!c) { var before = n; var s = make(); c = cache[key] = { s: s, id: 'cya' + (before + 1) }; return s; }
    return c.s.split(c.id).join(uid());
  }
  var api = {
    face: function (type, value) { return cached('f' + type + value, function () { return face(type, value); }); },
    icon: function (type) { return cached('i' + type, function () { return icon(type); }); },
    back: function () { return cached('b', back); },
    SHORT: SHORT
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CYAArt = api;
})(this);
