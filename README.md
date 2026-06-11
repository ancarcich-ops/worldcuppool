# ⚽ World Cup Pool 2026

**Live dashboard:** https://ancarcich-ops.github.io/worldcuppool/

A live dashboard for a FIFA World Cup 2026 draft pool. Every player owns a few countries;
points stack as their teams win matches and climb the bracket — plus a **Wooden Spoon 🥄**
consolation bonus for whoever owns the tournament's worst team.

**Views:** Leaderboard · Group standings · Matches (live/upcoming/results) · Knockout bracket · Wooden Spoon race · Scoring rules

No build step, no backend — a static site that reads three tiny data files.

## 🚀 One-time setup

1. **Enable GitHub Pages** — repo *Settings → Pages → Source: Deploy from a branch* →
   branch `main`, folder `/ (root)`. Your dashboard goes live at
   `https://<user>.github.io/worldcuppool/`.
2. **Enable the live feed** — the workflow in `.github/workflows/update-results.yml`
   fetches scores every 20 minutes (keyless, from the public FIFA API) and commits
   `data/live.json`. Scheduled workflows only run from the **default branch**, so merge
   this to `main`. You can also trigger it manually from the *Actions* tab → "Update live
   results" → *Run workflow*.
3. *(Optional but recommended)* Get a free token from
   [football-data.org](https://www.football-data.org/client/register) and add it as a repo
   secret named `FOOTBALL_DATA_TOKEN` — the workflow then prefers that source and falls
   back to the FIFA API automatically.

## ✏️ Entering your draft

Edit **`data/pool.js`**: put each player's name, emoji avatar, and their 3 team codes
(codes are in `data/teams.js`). Then set `sampleDraft: false` to remove the
"SAMPLE DRAFT" banner. Works for any pool size that divides 48 (16×3, 12×4, …) — the
dashboard adapts automatically.

## 🎯 Scoring (tweak in `data/scoring.js`)

| Achievement | Points |
|---|---|
| Group-stage win / draw | +3 / +1 |
| Finish 1st / 2nd in group | +5 / +3 |
| 3rd place that advances to R32 | +1 |
| Win in R32 / R16 / QF / SF | +4 / +6 / +8 / +10 |
| Win third-place match | +3 |
| **Win the Final** 🏆 | **+15** |
| **Wooden Spoon** 🥄 (worst W-D-L, then goal diff, then goals scored) | **+5** |

## 🛠️ Manual corrections

`data/overrides.json` lets you enter or fix any result by hand (handy if an API hiccups),
and force official group standings if a fine-grained FIFA tiebreaker (e.g. fair play
points) ever differs from the computed one. See the `_help` notes inside the file.

## ✅ Sanity check

```bash
node scripts/smoke-test.mjs   # validates pool data + scoring engine
```

Run this after editing `data/pool.js` — it catches duplicate picks, typo'd team codes,
and unowned teams.
