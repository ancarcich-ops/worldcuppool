// ════════════════════════════════════════════════════════════════════
//  Predictions engine — Opta-anchored projection of the rest of the cup.
//
//  Two sources, combined:
//    1. KNOCKOUT odds come straight from Opta Analyst's official tournament
//       prediction (snapshot: 28 June 2026) — per-round survival
//       probabilities for the 16 leading contenders. Teams outside Opta's
//       top 16 get the residual probability mass, split by a Monte-Carlo
//       strength model so the field still adds up (16 reach the R16, 8 the
//       QF, … 1 lifts the trophy).
//    2. GROUP-STAGE points (wins, draws, finish bonuses, Wooden Spoon) are
//       simulated from the CURRENT real results — already-played games are
//       locked, the rest is simulated.
//
//  Everything is scored with the exact same values as the live engine and
//  averaged/derived analytically, then aggregated to each player.
// ════════════════════════════════════════════════════════════════════

const PoolPredictor = (() => {
  // ── Opta Analyst tournament prediction, 28 Jun 2026 ─────────────
  //   r16 = reach Round of 16 (win the R32 game)   → drives r32Win pts
  //   qf  = reach Quarter-finals                    → drives r16Win pts
  //   sf  = reach Semi-finals                       → drives qfWin  pts
  //   fin = reach the Final                         → drives sfWin  pts
  //   win = win the tournament                      → drives finalWin pts
  const OPTA = {
    FRA: { r16: 0.815, qf: 0.583, sf: 0.427, fin: 0.284, win: 0.187 },
    ARG: { r16: 0.892, qf: 0.705, sf: 0.496, fin: 0.300, win: 0.163 },
    ESP: { r16: 0.852, qf: 0.544, sf: 0.396, fin: 0.227, win: 0.135 },
    ENG: { r16: 0.840, qf: 0.537, sf: 0.319, fin: 0.186, win: 0.097 },
    BRA: { r16: 0.689, qf: 0.438, sf: 0.247, fin: 0.137, win: 0.065 },
    NED: { r16: 0.612, qf: 0.434, sf: 0.193, fin: 0.101, win: 0.051 },
    POR: { r16: 0.674, qf: 0.308, sf: 0.199, fin: 0.095, win: 0.047 },
    GER: { r16: 0.786, qf: 0.306, sf: 0.179, fin: 0.087, win: 0.044 },
    COL: { r16: 0.719, qf: 0.418, sf: 0.179, fin: 0.080, win: 0.032 },
    NOR: { r16: 0.678, qf: 0.313, sf: 0.151, fin: 0.072, win: 0.030 },
    USA: { r16: 0.785, qf: 0.425, sf: 0.154, fin: 0.057, win: 0.025 },
    SUI: { r16: 0.652, qf: 0.338, sf: 0.140, fin: 0.058, win: 0.022 },
    MEX: { r16: 0.614, qf: 0.283, sf: 0.120, fin: 0.050, win: 0.018 },
    MAR: { r16: 0.388, qf: 0.243, sf: 0.087, fin: 0.038, win: 0.016 },
    BEL: { r16: 0.569, qf: 0.301, sf: 0.109, fin: 0.040, win: 0.016 },
    JPN: { r16: 0.311, qf: 0.154, sf: 0.068, fin: 0.029, win: 0.010 },
  };
  const ROUND_TARGET = { r16: 16, qf: 8, sf: 4, fin: 2, win: 1 }; // teams reaching each stage

  // Elo-style strength used to (a) simulate group games and (b) split the
  // knockout residual among teams Opta doesn't list. Seeded from the market.
  const RATING = {
    FRA: 2060, ESP: 2020, ENG: 1995, ARG: 1985,
    POR: 1925, BRA: 1915, GER: 1895, NED: 1865,
    BEL: 1820, MAR: 1815, URU: 1800, NOR: 1800, USA: 1795, CRO: 1790,
    COL: 1780, SEN: 1770, JPN: 1770, MEX: 1745, SUI: 1745,
    TUR: 1730, ECU: 1730, AUT: 1720, KOR: 1710, SWE: 1705,
    CZE: 1700, SCO: 1700, CIV: 1700, EGY: 1700, CAN: 1695,
    IRN: 1690, ALG: 1690, BIH: 1680, AUS: 1675, GHA: 1675,
    PAR: 1665, TUN: 1665, RSA: 1645, COD: 1645, PAN: 1625,
    UZB: 1615, QAT: 1605, KSA: 1600, IRQ: 1600, NZL: 1585,
    JOR: 1580, CPV: 1545, HAI: 1525, CUW: 1485,
  };
  const DEFAULT_RATING = 1650;
  const ratingOf = (code) => RATING[code] ?? DEFAULT_RATING;

  // ── randomness ──────────────────────────────────────────────────
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  function poisson(lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }
  function lambdas(ra, rb) {
    const base = 1.30, G = 1000;
    return [clamp(base * Math.pow(10, (ra - rb) / G), 0.18, 6),
            clamp(base * Math.pow(10, (rb - ra) / G), 0.18, 6)];
  }
  const winProb = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── fixed (finished) state, computed once ───────────────────────
  function precompute(teams, groups, matches, scoring) {
    const baseRow = {}, basePts = {};
    for (const code of Object.keys(teams)) {
      baseRow[code] = { code, group: teams[code].group, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 };
      basePts[code] = 0;
    }
    const remaining = [];
    for (const m of matches) {
      if (m.stage !== "GROUP") continue;
      if (m.status === "FINISHED") {
        const h = baseRow[m.home], a = baseRow[m.away];
        if (!h || !a) continue;
        applyResult(h, a, m.homeScore, m.awayScore);
        if (m.homeScore > m.awayScore) basePts[m.home] += scoring.groupWin;
        else if (m.homeScore < m.awayScore) basePts[m.away] += scoring.groupWin;
        else { basePts[m.home] += scoring.groupDraw; basePts[m.away] += scoring.groupDraw; }
      } else {
        remaining.push({ home: m.home, away: m.away, group: m.group || teams[m.home]?.group });
      }
    }
    return { baseRow, basePts, remaining };
  }
  function applyResult(h, a, hs, as) {
    h.P++; a.P++;
    h.GF += hs; h.GA += as; a.GF += as; a.GA += hs;
    if (hs > as) { h.W++; a.L++; h.Pts += 3; }
    else if (hs < as) { a.W++; h.L++; a.Pts += 3; }
    else { h.D++; a.D++; h.Pts++; a.Pts++; }
  }
  const sortRows = (rows) =>
    rows.sort((x, y) =>
      y.Pts - x.Pts || (y.GF - y.GA) - (x.GF - x.GA) || y.GF - x.GF || (Math.random() < 0.5 ? -1 : 1));

  // ── one simulated tournament ────────────────────────────────────
  // pts[] accumulates GROUP-stage points + Wooden Spoon only.
  // C tallies how far each team gets in the bracket (for the residual split).
  function simulate(groups, scoring, pre, ownedSet, pts, C) {
    const { baseRow, basePts, remaining } = pre;
    const rows = {};
    for (const code of Object.keys(baseRow)) {
      const b = baseRow[code];
      rows[code] = { code, group: b.group, P: b.P, W: b.W, D: b.D, L: b.L, GF: b.GF, GA: b.GA, Pts: b.Pts };
      pts[code] = basePts[code];
    }
    for (const f of remaining) {
      const [la, lb] = lambdas(ratingOf(f.home), ratingOf(f.away));
      const hs = poisson(la), as = poisson(lb);
      applyResult(rows[f.home], rows[f.away], hs, as);
      if (hs > as) pts[f.home] += scoring.groupWin;
      else if (hs < as) pts[f.away] += scoring.groupWin;
      else { pts[f.home] += scoring.groupDraw; pts[f.away] += scoring.groupDraw; }
    }
    const winners = [], thirds = [];
    for (const g of groups) {
      const table = sortRows(Object.values(rows).filter((r) => r.group === g));
      if (table[0]) { pts[table[0].code] += scoring.groupFirst; winners.push(table[0].code); }
      if (table[1]) { pts[table[1].code] += scoring.groupSecond; winners.push(table[1].code); }
      if (table[2]) thirds.push(table[2]);
    }
    sortRows(thirds);
    const advancingThirds = thirds.slice(0, 8);
    for (const r of advancingThirds) pts[r.code] += scoring.groupThirdAdvance;
    const qualifiers = winners.concat(advancingThirds.map((r) => r.code));

    // Wooden Spoon: worst OWNED team
    let spoon = null, worst = null;
    for (const r of Object.values(rows)) {
      if (ownedSet.size && !ownedSet.has(r.code)) continue;
      const k = [r.Pts, r.GF - r.GA, r.GF];
      if (!worst || k[0] < worst[0] || (k[0] === worst[0] && k[1] < worst[1]) ||
          (k[0] === worst[0] && k[1] === worst[1] && k[2] < worst[2])) { worst = k; spoon = r.code; }
    }
    if (spoon) pts[spoon] += scoring.woodenSpoon;

    // Bracket — strength-weighted single elimination (for residual split)
    for (const c of qualifiers) C.qual[c]++;
    let field = shuffle(qualifiers.slice());
    const playRound = (f) => {
      const next = [];
      for (let i = 0; i + 1 < f.length; i += 2)
        next.push(Math.random() < winProb(ratingOf(f[i]), ratingOf(f[i + 1])) ? f[i] : f[i + 1]);
      if (f.length % 2) next.push(f[f.length - 1]);
      return shuffle(next);
    };
    field = playRound(field); for (const c of field) C.r16[c]++; // won R32 → in Last 16
    field = playRound(field); for (const c of field) C.qf[c]++;
    field = playRound(field); for (const c of field) C.sf[c]++;
    field = playRound(field); for (const c of field) C.fin[c]++;
    let champ = null;
    if (field.length >= 2) champ = Math.random() < winProb(ratingOf(field[0]), ratingOf(field[1])) ? field[0] : field[1];
    else if (field.length === 1) champ = field[0];
    if (champ) C.win[champ]++;
  }

  // ── public: project ─────────────────────────────────────────────
  function project({ teams, groups, matches, scoring, pool, sims = 8000 }) {
    const codes = Object.keys(teams);
    const ownedSet = new Set(pool.players.flatMap((p) => p.teams));
    const pre = precompute(teams, groups, matches, scoring);

    const sumGroup = {};
    const C = { qual: {}, r16: {}, qf: {}, sf: {}, fin: {}, win: {} };
    for (const c of codes) { sumGroup[c] = 0; for (const k of Object.keys(C)) C[k][c] = 0; }

    const pts = {};
    for (let s = 0; s < sims; s++) {
      simulate(groups, scoring, pre, ownedSet, pts, C);
      for (const c of codes) sumGroup[c] += pts[c];
    }

    // raw Monte-Carlo per-round reach probabilities
    const raw = {};
    for (const c of codes) raw[c] = { r16: C.r16[c] / sims, qf: C.qf[c] / sims, sf: C.sf[c] / sims, fin: C.fin[c] / sims, win: C.win[c] / sims };

    // Blend: Opta teams use Opta exactly; everyone else shares the residual
    // for each round, weighted by their raw MC probability.
    const optaCodes = Object.keys(OPTA).filter((c) => teams[c]);
    const blend = {};
    for (const c of codes) blend[c] = {};
    for (const round of Object.keys(ROUND_TARGET)) {
      let optaSum = 0;
      for (const c of optaCodes) optaSum += OPTA[c][round];
      let rawNonOpta = 0;
      for (const c of codes) if (!OPTA[c]) rawNonOpta += raw[c][round];
      const residual = Math.max(0, ROUND_TARGET[round] - optaSum);
      const scale = rawNonOpta > 1e-9 ? residual / rawNonOpta : 0;
      for (const c of codes) blend[c][round] = OPTA[c] ? OPTA[c][round] : raw[c][round] * scale;
    }

    // Expected points = simulated group/spoon + Opta-anchored knockout
    const teamExp = {}, teamChamp = {}, teamAdvance = {}, teamReach = {};
    for (const c of codes) {
      const b = blend[c];
      const ko = scoring.r32Win * b.r16 + scoring.r16Win * b.qf + scoring.qfWin * b.sf +
                 scoring.sfWin * b.fin + scoring.finalWin * b.win +
                 scoring.thirdPlaceWin * 0.5 * Math.max(0, b.sf - b.fin);
      teamExp[c] = sumGroup[c] / sims + ko;
      teamChamp[c] = b.win;
      teamAdvance[c] = C.qual[c] / sims;     // P(make the knockouts / Round of 32)
      teamReach[c] = b;                        // full per-round odds
    }

    const owners = pool.players.map((p) => {
      const projected = p.teams.reduce((s, c) => s + (teamExp[c] || 0), 0);
      const champPct = p.teams.reduce((s, c) => s + (teamChamp[c] || 0), 0);
      const teamRows = p.teams.map((c) => ({
        code: c, exp: teamExp[c] || 0, champ: teamChamp[c] || 0,
        advance: teamAdvance[c] || 0, sf: teamReach[c]?.sf || 0,
      })).sort((a, b) => b.exp - a.exp);
      return { name: p.name, avatar: p.avatar || "⚽", projected, champPct, teams: teamRows };
    });
    owners.sort((a, b) => b.projected - a.projected);
    owners.forEach((o, i) => (o.projRank = i + 1));

    return { sims, source: "Opta Analyst · 28 Jun 2026", teamExp, teamChamp, teamAdvance, teamReach, owners, ratingOf };
  }

  return { project, ratingOf, OPTA };
})();

globalThis.PoolPredictor = PoolPredictor;
