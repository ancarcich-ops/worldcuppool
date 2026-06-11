#!/usr/bin/env node
// Sanity checks: pool data integrity + scoring engine simulation.
// Run with: node scripts/smoke-test.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await import(join(root, "data/teams.js"));
await import(join(root, "data/pool.js"));
await import(join(root, "data/scoring.js"));
await import(join(root, "js/engine.js"));

const { TEAMS, GROUPS, POOL, SCORING, PoolEngine } = globalThis;
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "✓" : "✗"} ${msg}`); if (!ok) failures++; };

// ── data integrity ────────────────────────────────────────────────
check(Object.keys(TEAMS).length === 48, `48 teams defined (${Object.keys(TEAMS).length})`);
for (const g of GROUPS) {
  const n = Object.values(TEAMS).filter((t) => t.group === g).length;
  if (n !== 4) check(false, `Group ${g} has ${n} teams (expected 4)`);
}
check(GROUPS.every((g) => Object.values(TEAMS).filter((t) => t.group === g).length === 4), "Every group has exactly 4 teams");

const picked = POOL.players.flatMap((p) => p.teams);
check(new Set(picked).size === picked.length, "No team picked twice");
check(picked.every((c) => TEAMS[c]), "All picked team codes exist");
check(new Set(picked).size === Object.keys(TEAMS).length, `All 48 teams are owned (${new Set(picked).size}/48)`);

// ── engine simulation: full Group A + a knockout run ─────────────
const F = "FINISHED";
const matches = [
  // Group A: MEX beats everyone, KOR 2nd, RSA 3rd, CZE last with terrible GD
  { id: 1, stage: "GROUP", group: "A", status: F, home: "MEX", away: "RSA", homeScore: 2, awayScore: 0 },
  { id: 2, stage: "GROUP", group: "A", status: F, home: "KOR", away: "CZE", homeScore: 3, awayScore: 0 },
  { id: 3, stage: "GROUP", group: "A", status: F, home: "MEX", away: "CZE", homeScore: 4, awayScore: 0 },
  { id: 4, stage: "GROUP", group: "A", status: F, home: "RSA", away: "KOR", homeScore: 1, awayScore: 1 },
  { id: 5, stage: "GROUP", group: "A", status: F, home: "MEX", away: "KOR", homeScore: 1, awayScore: 0 },
  { id: 6, stage: "GROUP", group: "A", status: F, home: "CZE", away: "RSA", homeScore: 0, awayScore: 1 },
  // a knockout match with penalties
  { id: 7, stage: "R32", status: F, home: "MEX", away: "ENG", homeScore: 1, awayScore: 1, winner: "MEX" },
];

const state = PoolEngine.compute({ teams: TEAMS, groups: GROUPS, matches, scoring: SCORING, pool: POOL, overrides: {} });

const a = state.tables.A.map((r) => r.code);
check(a.join(",") === "MEX,KOR,RSA,CZE", `Group A order MEX,KOR,RSA,CZE (got ${a.join(",")})`);

const mex = state.scores.MEX;
const expectedMex = 3 * SCORING.groupWin + SCORING.groupFirst + SCORING.r32Win;
check(mex.total === expectedMex, `Mexico total ${mex.total} (3 wins + group 1st + R32 pens win = ${expectedMex})`);

const kor = state.scores.KOR;
const expectedKor = SCORING.groupWin + SCORING.groupDraw + SCORING.groupSecond;
check(kor.total === expectedKor, `Korea total ${kor.total} (1W 1D + 2nd = ${expectedKor})`);

check(state.scores.CZE.status === "out", "Czechia marked eliminated (4th in group)");
check(state.scores.ENG.status === "out", "England eliminated after R32 penalty loss");
check(state.spoonCode === null, "Wooden Spoon not awarded while groups incomplete");
check(state.spoonRank[0].code === "CZE", `Spoon projection leader is CZE (got ${state.spoonRank[0].code})`);

// leaderboard: MEX owner should lead
const mexOwner = state.owners.MEX;
check(state.players[0].name === mexOwner, `Leader is ${mexOwner} (owns Mexico)`);

// overrides path: flip match 5 so KOR wins the group
const state2 = PoolEngine.compute({
  teams: TEAMS, groups: GROUPS, matches, scoring: SCORING, pool: POOL,
  overrides: { matches: [{ stage: "GROUP", home: "MEX", away: "KOR", homeScore: 0, awayScore: 2, status: F }], groupOrder: {} },
});
check(state2.tables.A[0].code === "KOR", `Override flips group winner to KOR (got ${state2.tables.A[0].code})`);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nAll checks passed ✔");
process.exit(failures ? 1 : 0);
