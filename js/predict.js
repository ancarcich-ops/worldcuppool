// ════════════════════════════════════════════════════════════════════
//  Predictions engine — Monte Carlo projection of the rest of the cup.
//
//  Pure-ish: (teams, groups, matches, scoring, pool) → expected final
//  points per team and per owner, plus championship odds.
//
//  How it works:
//    • Every already-FINISHED match is treated as fixed fact.
//    • Remaining group games are simulated with a Poisson goals model
//      driven by team strength ratings (below).
//    • The 32 qualifiers (12 winners + 12 runners-up + 8 best thirds)
//      then play a strength-weighted single-elimination bracket. Because
//      the real bracket isn't locked until the group stage ends, matchups
//      are drawn probabilistically each run.
//    • Points are tallied with the EXACT same values as the live scoring
//      engine, averaged over thousands of runs.
//
//  Strength ratings are an Elo-style scale seeded from current market
//  title odds (France favorite, then Spain / England / Argentina, the
//  South-American + European heavyweights, etc.) blended with form. They
//  are priors only — the simulation always respects real results.
// ════════════════════════════════════════════════════════════════════

const PoolPredictor = (() => {
  // Elo-ish strength rating per team (higher = stronger). Anchored to the
  // June 2026 market: FRA +370, ESP +500, ENG +600, ARG +700, POR +1000,
  // BRA +1200, GER +1300, NED +1600, then the mid/long-shot field.
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
  function poisson(lambda) {
    // Knuth's algorithm — fine for the small lambdas we use here.
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }
  // Expected goals for A given the rating gap. base ≈ avg goals/side.
  function lambdas(ra, rb) {
    const base = 1.30, G = 1000;
    const la = clamp(base * Math.pow(10, (ra - rb) / G), 0.18, 6);
    const lb = clamp(base * Math.pow(10, (rb - ra) / G), 0.18, 6);
    return [la, lb];
  }
  // Knockout win probability for A (no draws — penalties decide).
  function winProb(ra, rb) { return 1 / (1 + Math.pow(10, (rb - ra) / 400)); }
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // ── precompute fixed (finished) state once ──────────────────────
  function precompute(teams, groups, matches, scoring) {
    const baseRow = {};
    const basePts = {};
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
  function simulate(teams, groups, scoring, pre, ownedSet, pts) {
    const { baseRow, basePts, remaining } = pre;
    // fresh standings + points for this run
    const rows = {};
    for (const code of Object.keys(baseRow)) {
      const b = baseRow[code];
      rows[code] = { code, group: b.group, P: b.P, W: b.W, D: b.D, L: b.L, GF: b.GF, GA: b.GA, Pts: b.Pts };
      pts[code] = basePts[code];
    }
    // simulate remaining group games
    for (const f of remaining) {
      const [la, lb] = lambdas(ratingOf(f.home), ratingOf(f.away));
      const hs = poisson(la), as = poisson(lb);
      applyResult(rows[f.home], rows[f.away], hs, as);
      if (hs > as) pts[f.home] += scoring.groupWin;
      else if (hs < as) pts[f.away] += scoring.groupWin;
      else { pts[f.home] += scoring.groupDraw; pts[f.away] += scoring.groupDraw; }
    }
    // group bonuses + collect qualifiers
    const winners = [], thirds = [];
    for (const g of groups) {
      const table = sortRows(groups && Object.values(rows).filter((r) => r.group === g));
      if (table.length >= 1) { pts[table[0].code] += scoring.groupFirst; winners.push(table[0].code); }
      if (table.length >= 2) { pts[table[1].code] += scoring.groupSecond; winners.push(table[1].code); }
      if (table.length >= 3) thirds.push(table[2]);
    }
    // best 8 third-placed teams advance
    sortRows(thirds);
    const advancingThirds = thirds.slice(0, 8);
    for (const r of advancingThirds) pts[r.code] += scoring.groupThirdAdvance;
    const qualifiers = winners.concat(advancingThirds.map((r) => r.code));

    // wooden spoon: worst OWNED team once groups are done
    let spoon = null, worst = null;
    for (const r of Object.values(rows)) {
      if (ownedSet.size && !ownedSet.has(r.code)) continue;
      const key = [r.Pts, r.GF - r.GA, r.GF];
      if (!worst || key[0] < worst[0] || (key[0] === worst[0] && key[1] < worst[1]) ||
          (key[0] === worst[0] && key[1] === worst[1] && key[2] < worst[2])) {
        worst = key; spoon = r.code;
      }
    }
    if (spoon) pts[spoon] += scoring.woodenSpoon;

    // knockout — strength-weighted single elimination, random matchups
    const KO = [
      ["R32", scoring.r32Win], ["R16", scoring.r16Win], ["QF", scoring.qfWin], ["SF", scoring.sfWin],
    ];
    let field = shuffle(qualifiers.slice());
    let semiLosers = [];
    for (const [, reward] of KO) {
      const next = [];
      const losersThisRound = [];
      for (let i = 0; i + 1 < field.length; i += 2) {
        const a = field[i], b = field[i + 1];
        const aw = Math.random() < winProb(ratingOf(a), ratingOf(b));
        const w = aw ? a : b, l = aw ? b : a;
        pts[w] += reward;
        next.push(w); losersThisRound.push(l);
      }
      if (field.length % 2) next.push(field[field.length - 1]); // bye (shouldn't happen at 32)
      if (reward === scoring.sfWin) semiLosers = losersThisRound;
      field = shuffle(next);
    }
    // final
    let champ = null;
    if (field.length >= 2) {
      const a = field[0], b = field[1];
      const aw = Math.random() < winProb(ratingOf(a), ratingOf(b));
      champ = aw ? a : b;
      pts[champ] += scoring.finalWin;
    } else if (field.length === 1) { champ = field[0]; pts[champ] += scoring.finalWin; }
    // third-place match
    if (semiLosers.length >= 2) {
      const a = semiLosers[0], b = semiLosers[1];
      const aw = Math.random() < winProb(ratingOf(a), ratingOf(b));
      pts[aw ? a : b] += scoring.thirdPlaceWin;
    }
    return { qualifiers, champ };
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── public: run many sims and aggregate ─────────────────────────
  function project({ teams, groups, matches, scoring, pool, sims = 8000 }) {
    const ownedSet = new Set(pool.players.flatMap((p) => p.teams));
    const pre = precompute(teams, groups, matches, scoring);

    const sumPts = {}, champCount = {}, advCount = {};
    for (const code of Object.keys(teams)) { sumPts[code] = 0; champCount[code] = 0; advCount[code] = 0; }

    const pts = {}; // reused scratch per run
    for (let s = 0; s < sims; s++) {
      const { qualifiers, champ } = simulate(teams, groups, scoring, pre, ownedSet, pts);
      for (const code of Object.keys(teams)) sumPts[code] += pts[code];
      for (const code of qualifiers) advCount[code]++;
      if (champ) champCount[champ]++;
    }

    const teamExp = {}, teamChamp = {}, teamAdvance = {};
    for (const code of Object.keys(teams)) {
      teamExp[code] = sumPts[code] / sims;
      teamChamp[code] = champCount[code] / sims;
      teamAdvance[code] = advCount[code] / sims;
    }

    // aggregate to owners
    const owners = pool.players.map((p) => {
      const projected = p.teams.reduce((s, c) => s + (teamExp[c] || 0), 0);
      const champPct = p.teams.reduce((s, c) => s + (teamChamp[c] || 0), 0);
      const teamRows = p.teams.map((c) => ({
        code: c, exp: teamExp[c] || 0, champ: teamChamp[c] || 0, advance: teamAdvance[c] || 0,
      })).sort((a, b) => b.exp - a.exp);
      return { name: p.name, avatar: p.avatar || "⚽", projected, champPct, teams: teamRows };
    });
    owners.sort((a, b) => b.projected - a.projected);
    owners.forEach((o, i) => (o.projRank = i + 1));

    return { sims, teamExp, teamChamp, teamAdvance, owners, ratingOf };
  }

  return { project, ratingOf };
})();

globalThis.PoolPredictor = PoolPredictor;
