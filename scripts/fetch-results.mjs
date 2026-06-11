#!/usr/bin/env node
/**
 * Fetches FIFA World Cup 2026 results and writes data/live.json.
 *
 * Sources (in order):
 *   1. football-data.org  — used when a FOOTBALL_DATA_TOKEN env var / repo secret is set
 *   2. api.fifa.com       — keyless fallback, used by default
 *
 * Normalized output: { updatedAt, source, matches: [
 *   { id, stage: GROUP|R32|R16|QF|SF|THIRD|FINAL, group, utcDate,
 *     status: SCHEDULED|LIVE|FINISHED, home, away, homeScore, awayScore, winner } ] }
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "live.json");

const CODES = new Set([
  "MEX","RSA","KOR","CZE","CAN","SUI","QAT","BIH","BRA","MAR","SCO","HAI",
  "USA","TUR","AUS","PAR","GER","ECU","CIV","CUW","NED","JPN","SWE","TUN",
  "BEL","IRN","EGY","NZL","ESP","URU","KSA","CPV","FRA","NOR","SEN","IRQ",
  "ARG","AUT","ALG","JOR","POR","COL","UZB","COD","ENG","CRO","GHA","PAN",
]);

// name fragments → code, for APIs whose abbreviations differ from FIFA codes
const NAME_ALIASES = [
  [/czech/i, "CZE"], [/bosnia/i, "BIH"], [/ivory|c[oô]te d/i, "CIV"],
  [/korea/i, "KOR"], [/t[uü]rk/i, "TUR"], [/united states|usa/i, "USA"],
  [/cura[cç]ao/i, "CUW"], [/cape verde|cabo verde/i, "CPV"], [/congo/i, "COD"],
  [/saudi/i, "KSA"], [/south africa/i, "RSA"], [/switzerland/i, "SUI"],
  [/netherlands|holland/i, "NED"], [/germany/i, "GER"], [/croatia/i, "CRO"],
  [/scotland/i, "SCO"], [/england/i, "ENG"], [/algeria/i, "ALG"],
  [/portugal/i, "POR"], [/paraguay/i, "PAR"], [/panama/i, "PAN"],
  [/uruguay/i, "URU"], [/japan/i, "JPN"], [/jordan/i, "JOR"],
  [/new zealand/i, "NZL"], [/iraq/i, "IRQ"], [/iran/i, "IRN"],
  [/haiti/i, "HAI"], [/spain/i, "ESP"], [/denmark|sweden/i, "SWE"],
];

function toCode(abbr, name) {
  if (abbr && CODES.has(abbr.toUpperCase())) return abbr.toUpperCase();
  for (const [re, code] of NAME_ALIASES) if (name && re.test(name)) return code;
  return abbr || name || null;
}

function normalizeStage(s) {
  if (!s) return "GROUP";
  if (/group|first stage/i.test(s)) return "GROUP";
  if (/32/.test(s)) return "R32";
  if (/16/.test(s)) return "R16";
  if (/quarter/i.test(s)) return "QF";
  if (/semi/i.test(s)) return "SF";
  if (/third|3rd|bronze|play.?off/i.test(s)) return "THIRD";
  if (/final/i.test(s)) return "FINAL";
  return "GROUP";
}

function normalizeGroup(g) {
  const m = /([A-L])\s*$/.exec(g || "");
  return m ? m[1] : null;
}

async function getJSON(url, headers = {}) {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

// ── Source 1: football-data.org ──────────────────────────────────
async function fromFootballData(token) {
  const data = await getJSON("https://api.football-data.org/v4/competitions/WC/matches", {
    "X-Auth-Token": token,
  });
  return (data.matches || []).map((m) => {
    const status = ["IN_PLAY", "PAUSED"].includes(m.status) ? "LIVE"
      : m.status === "FINISHED" ? "FINISHED" : "SCHEDULED";
    const home = toCode(m.homeTeam?.tla, m.homeTeam?.name);
    const away = toCode(m.awayTeam?.tla, m.awayTeam?.name);
    let winner = null;
    if (m.score?.winner === "HOME_TEAM") winner = home;
    else if (m.score?.winner === "AWAY_TEAM") winner = away;
    return {
      id: `fd-${m.id}`,
      stage: normalizeStage(m.stage),
      group: normalizeGroup(m.group?.replace("_", " ")),
      utcDate: m.utcDate,
      status,
      home, away,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      winner,
    };
  }).filter((m) => m.home && m.away);
}

// ── Source 2: api.fifa.com (keyless) ─────────────────────────────
async function fromFifa() {
  const seasons = await getJSON("https://api.fifa.com/api/v3/seasons?idCompetition=17&count=50&language=en");
  const season = (seasons.Results || [])
    .filter((s) => /2026/.test(s.Name?.[0]?.Description || "") || /2026/.test(s.StartDate || ""))
    .sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate))[0]
    || (seasons.Results || []).sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate))[0];
  if (!season) throw new Error("No FIFA season found for competition 17");

  const cal = await getJSON(`https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=${season.IdSeason}&count=200&language=en`);
  return (cal.Results || []).map((m) => {
    const status = m.MatchStatus === 0 ? "FINISHED" : m.MatchStatus === 3 ? "LIVE" : "SCHEDULED";
    const home = toCode(m.Home?.IdCountry || m.Home?.Abbreviation, m.Home?.TeamName?.[0]?.Description);
    const away = toCode(m.Away?.IdCountry || m.Away?.Abbreviation, m.Away?.TeamName?.[0]?.Description);
    const hs = m.Home?.Score ?? null, as = m.Away?.Score ?? null;
    const hp = m.HomeTeamPenaltyScore ?? 0, ap = m.AwayTeamPenaltyScore ?? 0;
    let winner = null;
    if (status === "FINISHED" && hs != null && as != null) {
      if (hs > as) winner = home;
      else if (as > hs) winner = away;
      else if (hp !== ap) winner = hp > ap ? home : away;
    }
    return {
      id: `fifa-${m.IdMatch}`,
      stage: normalizeStage(m.StageName?.[0]?.Description),
      group: normalizeGroup(m.GroupName?.[0]?.Description),
      utcDate: m.Date,
      status,
      home, away,
      homeScore: hs, awayScore: as,
      winner,
    };
  }).filter((m) => m.home && m.away);
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  let matches, source;
  const attempts = token
    ? [["football-data.org", () => fromFootballData(token)], ["api.fifa.com", fromFifa]]
    : [["api.fifa.com", fromFifa]];

  let lastErr;
  for (const [name, fn] of attempts) {
    try {
      matches = await fn();
      source = name;
      break;
    } catch (e) {
      lastErr = e;
      console.error(`Source ${name} failed: ${e.message}`);
    }
  }
  if (!matches) {
    // keep the previous file rather than wiping good data
    if (existsSync(OUT)) {
      console.error("All sources failed — keeping existing data/live.json");
      process.exit(0);
    }
    throw lastErr;
  }

  matches.sort((a, b) => new Date(a.utcDate || 0) - new Date(b.utcDate || 0));
  const payload = { updatedAt: new Date().toISOString(), source, matches };

  // skip the write when nothing but the timestamp changed
  if (existsSync(OUT)) {
    try {
      const prev = JSON.parse(readFileSync(OUT, "utf8"));
      if (JSON.stringify(prev.matches) === JSON.stringify(matches)) {
        console.log(`No changes (${matches.length} matches from ${source}).`);
        return;
      }
    } catch { /* rewrite on parse errors */ }
  }

  writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${matches.length} matches from ${source} → data/live.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
