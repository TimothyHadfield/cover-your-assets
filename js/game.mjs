/* Cover Your Assets as an online.js game: thin wrapper around the pure engine.
   makeGame(E, AI) so the same file runs in the browser (window.CYAEngine) and in node tests. */
export function makeGame(E, AI) {
  const LEVELS = ["easy", "medium", "hard"];
  // round-end screen: the lowest person seat taps "Next round" (computers do it if no person is left)
  function nextSeat(s) { const h = (s.people || []).indexOf(true); return h >= 0 ? h : 0; }
  // the seat's own table view, rebuilt from the public view + its hand (same as E.view(state, seat))
  function seatView(pub, mine, seat) {
    const v = JSON.parse(JSON.stringify(pub));
    v.me = seat; v.hands = v.hands.slice(); v.hands[seat] = mine.hand.slice();
    return v;
  }
  const game = {
    id: "cover-your-assets",
    minSeats: 2, maxSeats: 6,
    setup(n, options = {}, rng = Math.random, seats = []) {
      const cfg = Object.assign({}, options, { players: n });
      delete cfg.levels;
      const st = E.newGame(cfg, Math.floor(rng() * 2147483647));
      st.people = Array.from({ length: n }, (_, i) => !!(seats[i] && seats[i].kind === "human"));
      st.levels = Array.from({ length: n }, (_, i) => {
        const l = options.levels && options.levels[i];
        return LEVELS.includes(l) ? l : "medium";
      });
      return st;
    },
    toAct(s) {
      if (s.phase === "gameOver") return [];
      if (s.phase === "roundEnd") return [nextSeat(s)];
      const t = E.toAct(s);
      return t >= 0 ? [t] : [];
    },
    apply(s, seat, action) {
      if (!action || typeof action.t !== "string") throw new Error("bad move");
      if (!game.toAct(s).includes(seat)) throw new Error("not your turn");
      if (s.phase === "roundEnd" && action.t !== "next") throw new Error("round over");
      return E.apply(s, action);
    },
    publicView(s) {
      const v = E.view(s, -1);
      delete v.me;
      return v;
    },
    privateView(s, seat) { return { hand: (s.hands[seat] || []).slice().sort((a, b) => a - b) }; },
    bot(ctx, seat, rng = Math.random) {
      const pub = ctx.pub;
      if (pub.phase === "roundEnd") return { t: "next" };
      const v = seatView(pub, ctx.mine, seat);
      return AI.choose(v, seat, (pub.levels && pub.levels[seat]) || "medium", rng, E.legal(v));
    },
    isOver(s) { return s.phase === "gameOver"; },
    seatView,
  };
  return game;
}
