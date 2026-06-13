# 🔁 Duplicating the pool for a new group

Everything here — the 48 teams, scoring, live scores, animations, draft
tracker — is identical between groups. **The only thing that changes per
group is the list of people and their picks** (`data/pool.js`). So
"a new group" = a fresh copy with its own roster and its own draft.

Pick the path that fits:

---

## Path A — A separate site for the new group (recommended)

Gives the new group its own URL, its own draft tracker, its own live
broadcast, and its own scores — fully independent of this one.

1. **Copy this repo.** On GitHub: this repo → **Use this template →
   Create a new repository** (or **Fork** if the template button isn't
   shown). Name it e.g. `worldcuppool-crew2`.
   - The draft tracker auto-detects whichever repo it's served from, so
     no code edits are needed for live broadcast to work.
2. **Turn on Pages.** New repo → **Settings → Pages → Deploy from a
   branch → `main` / `/(root)` → Save.** Your new site is
   `https://<you>.github.io/worldcuppool-crew2/`.
3. **Run the draft.** Open `…/draft.html` on the new site. Tap
   **🔴 Go Live** if you want everyone to follow along, then draft. When
   it's done, hit **📤 Export picks** and copy the block.
4. **Drop in the picks.** Paste that block over `data/pool.js`, commit.
   The dashboard switches to the real rosters automatically.
5. **(Optional) New draft order.** If you want a fresh random order,
   ask me to generate one, or edit the `ORDER` array near the top of the
   `<script>` in `draft.html`.

That's it. The scores Action runs on its own every ~20 min (GitHub may
throttle to hourly); trigger it manually anytime via **Actions → Update
live results → Run workflow**.

---

## Path B — One site, multiple groups

Keep a single site and add the new group as a second roster, shared at a
different link (e.g. `?pool=crew2`). Uses one scores feed for everyone
(less API usage) but the groups live side by side. This needs a small
code change — ask me and I'll wire it up: I'll add
`data/pool.crew2.js`, make the dashboard read `?pool=`, and give you the
two links.

---

## Fastest option: let me do it

Tell me the new group's player names (and, after they draft, who has
which countries) and whether you want **Path A** (separate site) or
**Path B** (same site, second link). I'll generate the random draft
order, set up the roster, and hand you the link.
