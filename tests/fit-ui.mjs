// Fit check (2026-11-27): can you see everything on the Play table, at phone and laptop sizes,
// with a crowded late-game table (6 players, long names, tall stacks, discard pile, full hand,
// a challenge in progress) and a normal early deal?
//   node tests/fit-ui.mjs [--port 8830] [--shots <dir>] [--engine webkit|chromium]
// Serves this folder itself. Exit 1 on any failure.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import os from 'node:os';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = +arg('port', 8830), SHOTS = arg('shots', ''), ENGINE = arg('engine', 'webkit');
const req = createRequire(import.meta.url);
const pw = createRequire(path.join(os.homedir(), '.claude', 'tools', 'package.json'))('playwright');
const FIX = req('./fit-fixture.js');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIR, p);
  if (!f.startsWith(DIR)) { r.writeHead(403); r.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); });
});
await new Promise((ok) => server.listen(PORT, '127.0.0.1', ok));

const SIZES = [['393', 393, 659, true], ['320', 320, 568, true], ['side', 659, 393, true], ['1280', 1280, 800, false], ['1440', 1440, 900, false]];
const STATES = { battle: FIX.crowded('battle'), turn: FIX.crowded('turn'), early: FIX.early() };

let fails = 0, checks = 0;
const fail = (m) => { fails++; console.log('FAIL ' + m); };

// everything measured in the page: rectangles, font sizes (CSS px as drawn), what covers what
function measure() {
  const W = innerWidth, H = innerHeight, out = { W, H, items: [] };
  const se = document.scrollingElement;
  out.scrollY = se.scrollHeight - H; out.scrollX = se.scrollWidth - W;
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const px = (el) => parseFloat(getComputedStyle(el).fontSize);
  // drawn font size of an svg <text>: its font-size times the svg's scale on screen
  const svgPx = (t) => { const m = t.getScreenCTM(); return m ? +t.getAttribute('font-size') * Math.hypot(m.a, m.b) : 0; };
  const covered = (el) => { // share of 9 sample points not showing el (or its children)
    const r = el.getBoundingClientRect(); let bad = 0;
    for (const fx of [.2, .5, .8]) for (const fy of [.2, .5, .8]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x >= W || y >= H) { bad++; continue; }
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) bad++;
    }
    return bad / 9;
  };
  const add = (kind, el, extra) => { const r = el.getBoundingClientRect(); out.items.push(Object.assign({ kind, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cov: covered(el) }, extra || {})); };
  document.querySelectorAll('#opps .opp').forEach((o, i) => {
    add('seat', o, { i });
    const plate = o.querySelector('.nm'); if (plate) add('plate', plate, { i });
    const tv = o.querySelector('.tv'); if (tv) add('oppTotal', tv, { i, px: px(tv), text: tv.textContent });
    const ot = o.querySelector('.otop'); if (ot) add('oppTop', ot, { i, px: px(ot), text: ot.textContent });
    const nm = o.querySelector('.tbl-plate');
    if (nm) add('oppName', nm, { i, px: px(nm), shown: Math.min(1, nm.clientWidth / Math.max(1, nm.scrollWidth)), chars: nm.textContent.length });
    const tower = o.querySelector('.stk'); if (tower) add('tower', tower, { i });
    const oh = o.querySelector('.ohand'); if (oh && oh.children.length) add('oppHand', oh, { i, boardTop: document.querySelector('.board').getBoundingClientRect().top });
  });
  const big = document.querySelector('#mystack .info .big'); if (big && vis(big)) add('myTotal', big, { px: px(big), text: big.textContent });
  const pb = document.querySelector('#mystack .pilebox'); if (pb && vis(pb)) add('myStack', pb);
  document.querySelectorAll('#hand .card').forEach((c, i) => {
    const vt = c.querySelector('svg text[font-size="16"]');
    add('handCard', c, { i, valuePx: vt ? svgPx(vt) : null });
  });
  const disc = document.querySelector('.pile[data-pile="discard"] .card:last-of-type');
  if (disc) { const vt = disc.querySelector('svg text[font-size="16"]'); add('discardTop', disc, { valuePx: vt ? svgPx(vt) : null }); }
  const badge = document.querySelector('.pile[data-pile="discard"] .tbl-badge'); if (badge) add('discardCount', badge, { px: px(badge) });
  document.querySelectorAll('#bar .btn, #overlay .btn').forEach((b) => { if (vis(b)) add('button', b, { text: b.textContent.trim().slice(0, 30) }); });
  const panel = document.querySelector('#overlay .panel'); if (panel && vis(panel)) add('panel', panel);
  document.querySelectorAll('#overlay .fight .card').forEach((c) => { const vt = c.querySelector('svg text[font-size="16"]'); add('fightCard', c, { valuePx: vt ? svgPx(vt) : null }); });
  const msg = document.querySelector('#msg'); if (msg && vis(msg) && msg.textContent.trim()) add('msg', msg, { px: px(msg) });
  return out;
}

// iPhone SE (320x568) has no spare height: its discard stays 50px (value ~8px, as before). The fight panel's cards on the SE and a
// sideways phone must fit above your hand, so they stay smaller there (>= 7 / 7.5px); the set's value is in the panel's text at 13px.
function judge(tag, m, stateName, zName) {
  const minCard = zName === '320' ? 7.9 : 12, minFight = zName === '320' ? 7 : zName === 'side' ? 7.5 : 12;
  const ck = (cond, msg) => { checks++; if (!cond) fail(tag + ': ' + msg); };
  const of = (k) => m.items.filter((x) => x.kind === k);
  const inView = (x) => x.l >= -1 && x.t >= -1 && x.r <= m.W + 1 && x.b <= m.H + 1;
  const battle = stateName === 'battle';
  ck(m.scrollY <= 1, 'page scrolls down ' + m.scrollY + 'px');
  ck(m.scrollX <= 1, 'page scrolls sideways ' + m.scrollX + 'px');
  const seats = of('plate');
  ck(seats.length === (stateName === 'early' ? 3 : 5), 'seats ' + seats.length);
  for (let a = 0; a < seats.length; a++) for (let b = a + 1; b < seats.length; b++) {
    const A = seats[a], B = seats[b], ox = Math.min(A.r, B.r) - Math.max(A.l, B.l), oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
    ck(!(ox > 2 && oy > 2), 'name plates ' + a + ' and ' + b + ' overlap');
  }
  // opponents' stack totals and top-set values: >= 12 px, on screen, not covered (except by the fight panel)
  for (const k of ['oppTotal', 'oppTop']) for (const x of of(k)) {
    ck(x.px >= 12, k + ' ' + x.i + ' ' + x.text + ' font ' + x.px + 'px < 12');
    ck(inView(x), k + ' ' + x.i + ' off screen');
    if (!battle) ck(x.cov <= 0.12, k + ' ' + x.i + ' covered ' + Math.round(x.cov * 100) + '%');
  }
  ck(of('oppTop').length === seats.filter((s, i) => stateName !== 'early').length || stateName === 'early', 'top value missing on some seats');
  for (const x of of('oppName')) {
    ck(x.px >= 10, 'name ' + x.i + ' font ' + x.px + 'px < 10');
    ck(Math.round(x.shown * x.chars) >= Math.min(x.chars, 6), 'name ' + x.i + ' cut to ' + Math.round(x.shown * x.chars) + ' of ' + x.chars + ' letters');
  }
  for (const x of of('tower')) ck(inView(x), 'tower ' + x.i + ' off screen');
  for (const x of of('oppHand')) ck(x.t >= x.boardTop - 1, 'cards in hand of seat ' + x.i + ' cut off at the top by ' + Math.round(x.boardTop - x.t) + 'px');
  const mt = of('myTotal')[0];
  ck(!!mt, 'your stack total missing');
  if (mt) { ck(mt.px >= 12, 'your total font ' + mt.px); ck(inView(mt), 'your total off screen'); if (!battle) ck(mt.cov <= 0.12, 'your total covered'); }
  const hand = of('handCard');
  ck(hand.length >= 4, 'hand cards ' + hand.length);
  for (const x of hand) {
    ck(inView(x), 'hand card ' + x.i + ' off screen (' + Math.round(x.t) + '..' + Math.round(x.b) + ')');
    if (x.valuePx != null) ck(x.valuePx >= 12, 'hand card ' + x.i + ' $ value drawn ' + x.valuePx.toFixed(1) + 'px < 12');
  }
  if (stateName !== 'early') {
    const d = of('discardTop')[0];
    ck(!!d && inView(d), 'discard top card not on screen');
    if (d && !battle) ck(d.cov <= 0.5, 'discard top mostly covered');
    if (d && d.valuePx != null) ck(d.valuePx >= minCard, 'discard top $ value drawn ' + d.valuePx.toFixed(1) + 'px < ' + minCard);
    const dc = of('discardCount')[0]; if (dc) ck(dc.px >= 12, 'discard count font ' + dc.px);
  }
  for (const x of of('button')) { ck(x.h >= 36, 'button "' + x.text + '" only ' + Math.round(x.h) + 'px tall'); ck(inView(x), 'button "' + x.text + '" off screen'); }
  if (battle) {
    const p = of('panel')[0];
    ck(!!p && inView(p), 'fight panel not fully on screen');
    for (const x of of('fightCard')) if (x.valuePx != null) ck(x.valuePx >= minFight, 'fight card $ value drawn ' + x.valuePx.toFixed(1) + 'px < ' + minFight);
    const handTop = Math.min(...hand.map((x) => x.t));
    if (p) ck(p.b <= handTop + 2, 'fight panel covers your hand by ' + Math.round(p.b - handTop) + 'px');
    ck(of('button').some((b) => /Give up|Play|Let/.test(b.text)), 'no fight buttons');
  }
}

const browser = await pw[ENGINE === 'chromium' ? 'chromium' : 'webkit'].launch();
try {
  for (const [sName, game] of Object.entries(STATES)) {
    for (const [zName, w, h, mobile] of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile && ENGINE === 'chromium', hasTouch: mobile, deviceScaleFactor: 1 });
      const n = game.state.cfg.players;
      const settings = { players: n, speed: 'test', coach: false, odds: true, seats: game.seats.map((s) => ({ kind: s.kind, level: s.level, name: s.name })) };
      await ctx.addInitScript(([g, s]) => {
        if (sessionStorage.getItem('fit-seeded')) return;
        sessionStorage.setItem('fit-seeded', '1');
        localStorage.clear();
        localStorage.setItem('cya.settings', JSON.stringify(s));
        localStorage.setItem('cya.game', JSON.stringify(g));
        localStorage.setItem('cya.coach.done', '1');
      }, [{ state: game.state, seats: game.seats, me: 0, meta: {} }, settings]);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (c) => { if (c.type() === 'error') errs.push(c.text()); });
      await page.goto('http://127.0.0.1:' + PORT + '/index.html');
      await page.waitForSelector('#hand .card', { timeout: 15000 });
      await page.evaluate(() => { document.querySelectorAll('.coach-offer, .coach-note').forEach((e) => e.remove()); });
      await page.waitForTimeout(900);
      const tag = sName + '@' + zName;
      const title = await page.title();
      if (!/Cover Your Assets/.test(title)) fail(tag + ': wrong page "' + title + '"');
      const m = await page.evaluate(measure);
      judge(tag, m, sName, zName);
      for (const e of errs) fail(tag + ': console ' + e.slice(0, 160));
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, sName + '-' + zName + '.png') }); }
      if (process.argv.includes('--dump')) console.log(tag, JSON.stringify(m.items.filter((x) => x.kind !== 'button').map((x) => [x.kind, Math.round(x.t), Math.round(x.b), Math.round(x.w), x.px || (x.valuePx && +x.valuePx.toFixed(1)) || '', x.cov ? +x.cov.toFixed(2) : 0, x.shown ? +x.shown.toFixed(2) : ''])) + ' scrollY ' + m.scrollY);
      await ctx.close();
    }
  }
} finally { await browser.close(); server.close(); }
console.log('fit-ui: ' + (checks - fails) + ' passed, ' + fails + ' failed');
if (fails) process.exitCode = 1;
