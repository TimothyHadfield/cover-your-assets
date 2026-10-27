/* Online rooms: wraps online.js (shared Firebase layer, loaded only when used) in the same
   host interface the Play tab already drives (viewFor / submit / onChange / seats). */
import { makeGame } from "./game.mjs";

const game = makeGame(window.CYAEngine, window.CYAAI);
const RESUME_KEY = "online." + game.id;
let room = null, host = null;

function OnlineHost(r) {
  this.online = true; this.room = r; this.snap = null; this.state = null;
  this.seats = []; this.subs = [];
}
OnlineHost.prototype.onChange = function (fn) { this.subs.push(fn); };
OnlineHost.prototype.take = function (snap) {
  this.snap = snap;
  this.seats = (snap.seats || []).map((s, i) => ({
    kind: i === snap.mySeat ? "human" : s.kind === "computer" ? "bot" : s.kind === "human" ? "online" : "empty",
    name: s.kind === "empty" ? "Open seat" : s.name || "Seat " + (i + 1), online: s.online, isHost: s.isHost,
  }));
  this.subs.forEach((f) => f(null, {}));
};
OnlineHost.prototype.viewFor = function (seat) {
  const s = this.snap;
  if (!s || !s.pub || !s.mine) return null;
  return game.seatView(s.pub, s.mine, seat);
};
OnlineHost.prototype.submit = function (seat, action) { return this.room.act(action); };
OnlineHost.prototype.schedule = function () {};
OnlineHost.prototype.stop = function () {};

async function open() {
  if (room) return room;
  const { createOnline } = await import("./online.js?v=a3d0418b");
  room = createOnline({ game, gameId: game.id, botDelayMs: 900 });
  host = new OnlineHost(room);
  room.on("change", (snap) => {
    if (snap.status === "closed" || snap.status === "left" || snap.status === "none") {
      if (window.CYAApp.host === host) window.CYAApp.endOnline(snap.status === "closed" ? "The host closed the room." : null);
      return;
    }
    host.take(snap);
    if (window.CYAApp.host !== host) window.CYAApp.useHost(host);
  });
  room.on("error", (m) => window.CYAApp.toast(m));
  return room;
}

window.CYANet = {
  async create(name, seats, options) {
    const r = await open();
    return r.createRoom({ name, seats, options });
  },
  async join(code, name) {
    const r = await open();
    return r.joinRoom(String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), name);
  },
  async start() { return room ? room.start() : { ok: false, message: "Not in a room." }; },
  async setSeat(i, kind) { return room ? room.setSeat(i, kind) : { ok: false }; },
  async leave() { if (!room) return { ok: true }; return room.leave(); },
  async close() { if (!room) return { ok: true }; return room.close(); },
  pending() { try { const v = JSON.parse(localStorage.getItem(RESUME_KEY)); return !!(v && v.code); } catch (e) { return false; } },
};

// a reload in the middle of an online game puts you back in your room
if (window.CYANet.pending()) {
  open().then((r) => r.resume()).then((back) => { if (!back) window.CYAApp.endOnline(null); }).catch(() => {});
}
