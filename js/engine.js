// Pool scoring engine. Pure functions: (teams, matches, scoring, pool, overrides) → computed state.
// Runs in the browser and in Node (smoke tests / CI).

const PoolEngine = (() => {
  const STAGE_ORDER = { GROUP: 0, R32: 1, R16: 2, QF: 3, SF: 4, THIRD: 5, FINAL: 6 };
  const STAGE_LABELS = {
    GROUP: "Group Stage", R32: "Round of 32", R16: "Round of 16",
    QF: "Quarter-final", SF: "Semi-final", THIRD: "Third Place", FINAL: "Final",
  };

  const isFinished = (m) => m.status === "FINISHED";

  function applyOverrides(matches, overrides) {
    const out = matches.map((m) => ({ ...m }));
    for (const ov of overrides?.matches || []) {
      const idx = out.findIndex(
        (m) => m.stage === ov.stage &&
          ((m.home === ov.home && m.away === ov.away) || (m.home === ov.away && m.away === ov.home))
      );
      if (idx >= 0) {
        const m = out[idx];
        const flipped = m.home === ov.away;
        out[idx] = {
          ...m,
          status: ov.status ?? m.status,
          homeScore: flipped ? ov.awayScore : ov.homeScore,
          awayScore: flipped ? ov.homeScore : ov.awayScore,
          winner: ov.winner ?? m.winner,
        };
      } else {
        out.push({ id: `ov-${ov.stage}-${ov.home}-${ov.away}`, utcDate: ov.utcDate || null, ...ov });
      }
    }
    return out;
  }

  // ── Group tables ────────────────────────────────────────────────
  function groupTables(teams, groups, matches) {
    const rows = {};
    for (const [code, t] of Object.entries(teams)) {
      rows[code] = { code, group: t.group, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
    }
    const groupMatches = matches.filter((m) => m.stage === "GROUP" && isFinished(m));
    for (const m of groupMatches) {
      const h = rows[m.home], a = rows[m.away];
      if (!h || !a) continue;
      h.P++; a.P++;
      h.GF += m.homeScore; h.GA += m.awayScore;
      a.GF += m.awayScore; a.GA += m.homeScore;
      if (m.homeScore > m.awayScore) { h.W++; a.L++; h.Pts += 3; }
      else if (m.homeScore < m.awayScore) { a.W++; h.L++; a.Pts += 3; }
      else { h.D++; a.D++; h.Pts++; a.Pts++; }
    }
    for (const r of Object.values(rows)) r.GD = r.GF - r.GA;

    const tables = {};
    for (const g of groups) {
      let table = Object.values(rows).filter((r) => r.group === g);
      table.sort((x, y) =>
        y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || h2h(matches, x.code, y.code) || x.code.localeCompare(y.code)
      );
      tables[g] = table;
    }
    return tables;
  }

  // Head-to-head tiebreak: negative if a should rank above b.
  function h2h(matches, a, b) {
    const m = matches.find(
      (m) => m.stage === "GROUP" && isFinished(m) &&
        ((m.home === a && m.away === b) || (m.home === b && m.away === a))
    );
    if (!m || m.homeScore === m.awayScore) return 0;
    const winner = m.homeScore > m.awayScore ? m.home : m.away;
    return winner === a ? -1 : 1;
  }

  function applyGroupOrder(tables, overrides) {
    for (const [g, order] of Object.entries(overrides?.groupOrder || {})) {
      if (!tables[g] || !Array.isArray(order) || order.length === 0) continue;
      tables[g].sort((x, y) => {
        const ix = order.indexOf(x.code), iy = order.indexOf(y.code);
        return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
      });
    }
  }

  function groupComplete(tables, g) {
    return tables[g].every((r) => r.P >= 3);
  }

  // Best 8 third-place teams qualify for the Round of 32 (48-team format).
  function thirdPlaceQualifiers(tables, groups) {
    if (!groups.every((g) => groupComplete(tables, g))) return null; // unknown until all groups end
    const thirds = groups.map((g) => tables[g][2]);
    thirds.sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.code.localeCompare(y.code));
    return new Set(thirds.slice(0, 8).map((r) => r.code));
  }

  // ── Wooden Spoon: worst group-stage record among OWNED teams ────
  // (leftover/unowned teams can't win anyone a bonus, so they're excluded)
  function woodenSpoonRanking(tables, groups, ownedSet) {
    let all = groups.flatMap((g) => tables[g]);
    if (ownedSet && ownedSet.size) all = all.filter((r) => ownedSet.has(r.code));
    return [...all].sort(
      (x, y) => x.Pts - y.Pts || x.GD - y.GD || x.GF - y.GF || x.code.localeCompare(y.code)
    );
  }

  // ── Per-team scoring breakdown ──────────────────────────────────
  function teamScores(teams, groups, matches, scoring, tables, thirds, allGroupsDone, spoonCode) {
    const KO_POINTS = { R32: scoring.r32Win, R16: scoring.r16Win, QF: scoring.qfWin, SF: scoring.sfWin, THIRD: scoring.thirdPlaceWin, FINAL: scoring.finalWin };
    const scores = {};
    for (const code of Object.keys(teams)) {
      scores[code] = { code, total: 0, breakdown: [], status: "alive", statusLabel: "Group Stage" };
    }
    const add = (code, label, pts) => {
      if (!scores[code] || !pts) return;
      scores[code].total += pts;
      scores[code].breakdown.push({ label, pts });
    };

    // Group match points
    for (const m of matches) {
      if (m.stage !== "GROUP" || !isFinished(m)) continue;
      if (m.homeScore > m.awayScore) add(m.home, `Won vs ${teams[m.away]?.name || m.away}`, scoring.groupWin);
      else if (m.homeScore < m.awayScore) add(m.away, `Won vs ${teams[m.home]?.name || m.home}`, scoring.groupWin);
      else { add(m.home, `Drew vs ${teams[m.away]?.name || m.away}`, scoring.groupDraw); add(m.away, `Drew vs ${teams[m.home]?.name || m.home}`, scoring.groupDraw); }
    }

    // Group finish bonuses + elimination status
    for (const g of groups) {
      if (!groupComplete(tables, g)) continue;
      const [first, second, third, fourth] = tables[g];
      add(first.code, `Won Group ${g}`, scoring.groupFirst);
      add(second.code, `2nd in Group ${g}`, scoring.groupSecond);
      setStatus(scores, fourth.code, "out", "Eliminated — Groups");
      if (thirds) {
        if (thirds.has(third.code)) add(third.code, `3rd in Group ${g} — advanced`, scoring.groupThirdAdvance);
        else setStatus(scores, third.code, "out", "Eliminated — Groups");
      }
    }

    // Knockout wins + elimination
    const ko = matches.filter((m) => m.stage !== "GROUP" && isFinished(m));
    ko.sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]);
    for (const m of ko) {
      const winner = m.winner || (m.homeScore > m.awayScore ? m.home : m.homeScore < m.awayScore ? m.away : null);
      if (!winner) continue;
      const loser = winner === m.home ? m.away : m.home;
      add(winner, `Won ${STAGE_LABELS[m.stage]}`, KO_POINTS[m.stage]);
      if (m.stage === "FINAL") {
        setStatus(scores, winner, "champion", "World Champions 🏆");
        setStatus(scores, loser, "out", "Runner-up 🥈");
      } else if (m.stage === "SF") {
        setStatus(scores, loser, "alive", "Third-place match");
      } else if (m.stage === "THIRD") {
        setStatus(scores, winner, "out", "Third place 🥉");
        setStatus(scores, loser, "out", `Out — Fourth place`);
      } else {
        setStatus(scores, loser, "out", `Out — ${STAGE_LABELS[m.stage]}`);
        setStatus(scores, winner, "alive", nextStageLabel(m.stage));
      }
    }

    // Wooden Spoon
    if (allGroupsDone && spoonCode) add(spoonCode, "Wooden Spoon 🥄", scoring.woodenSpoon);

    return scores;
  }

  function nextStageLabel(stage) {
    const next = { R32: "Round of 16", R16: "Quarter-finals", QF: "Semi-finals" };
    return next[stage] ? `In the ${next[stage]}` : "Alive";
  }

  function setStatus(scores, code, status, label) {
    if (!scores[code]) return;
    // never downgrade a champion
    if (scores[code].status === "champion") return;
    scores[code].status = status;
    scores[code].statusLabel = label;
  }

  // ── Main entry point ────────────────────────────────────────────
  function compute({ teams, groups, matches, scoring, pool, overrides }) {
    const merged = applyOverrides(matches, overrides);
    const ownedSet = new Set(pool.players.flatMap((p) => p.teams));
    const tables = groupTables(teams, groups, merged);
    applyGroupOrder(tables, overrides);
    const allGroupsDone = groups.every((g) => groupComplete(tables, g));
    const thirds = thirdPlaceQualifiers(tables, groups);
    const spoonRank = woodenSpoonRanking(tables, groups, ownedSet);
    const spoonCode = allGroupsDone && spoonRank.length ? spoonRank[0].code : null;
    const scores = teamScores(teams, groups, merged, scoring, tables, thirds, allGroupsDone, spoonCode);

    const owners = {}; // team code → player name
    const players = pool.players.map((p) => {
      for (const t of p.teams) owners[t] = p.name;
      const teamDetails = p.teams.map((code) => ({ code, ...(scores[code] || { total: 0, breakdown: [], status: "alive", statusLabel: "—" }) }));
      return {
        name: p.name,
        avatar: p.avatar || "⚽",
        teams: teamDetails,
        total: teamDetails.reduce((s, t) => s + t.total, 0),
        alive: teamDetails.filter((t) => t.status !== "out").length,
      };
    });
    players.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    let rank = 0, prevTotal = null;
    players.forEach((p, i) => {
      if (p.total !== prevTotal) { rank = i + 1; prevTotal = p.total; }
      p.rank = rank;
    });

    const unowned = Object.keys(teams).filter((c) => !ownedSet.has(c));
    return { matches: merged, tables, allGroupsDone, thirds, spoonRank, spoonCode, scores, players, owners, unowned };
  }

  return { compute, STAGE_ORDER, STAGE_LABELS };
})();

globalThis.PoolEngine = PoolEngine;
