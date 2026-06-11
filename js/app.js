/* World Cup Pool dashboard UI */
(() => {
  const REFRESH_MS = 120_000;
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let live = { updatedAt: null, source: "seed", matches: [] };
  let overrides = { matches: [], groupOrder: {} };
  let state = null;
  let firstRender = true;
  let confettiFired = false;

  // ── helpers ─────────────────────────────────────────────────────
  const flag = (code, size = "w80") => {
    const t = TEAMS[code];
    if (!t) return `<span class="flag flag-unknown">?</span>`;
    return `<img class="flag" loading="lazy" src="https://flagcdn.com/${size}/${t.iso}.png"
      srcset="https://flagcdn.com/${size === "w80" ? "w160" : "w320"}/${t.iso}.png 2x"
      alt="${esc(t.name)} flag">`;
  };
  const teamName = (code) => TEAMS[code]?.name || code;
  const grad = (code, deg = 135) => {
    const c = TEAMS[code]?.colors || ["#444", "#222"];
    return `linear-gradient(${deg}deg, ${c[0]}, ${c[1]})`;
  };
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || "th");
  const fmtDate = (iso) => {
    if (!iso) return "TBD";
    const d = new Date(iso);
    return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  function statusBadge(t) {
    if (t.status === "champion") return `<span class="badge badge-champ">🏆 Champions</span>`;
    if (t.status === "out") return `<span class="badge badge-out">${esc(t.statusLabel)}</span>`;
    return `<span class="badge badge-alive">${esc(t.statusLabel)}</span>`;
  }

  // ── data loading ────────────────────────────────────────────────
  async function loadJSON(path) {
    const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  }

  async function refresh(initial = false) {
    try {
      const [liveData, ovData] = await Promise.all([
        loadJSON("data/live.json"),
        loadJSON("data/overrides.json").catch(() => overrides),
      ]);
      live = liveData;
      overrides = ovData;
    } catch (e) {
      if (initial) console.warn("Live data unavailable (file:// mode?) — rendering with seed data.", e);
    }
    recompute();
    renderAll();
  }

  function recompute() {
    state = PoolEngine.compute({
      teams: TEAMS, groups: GROUPS, matches: live.matches || [],
      scoring: SCORING, pool: POOL, overrides,
    });
  }

  // ── validation banner ───────────────────────────────────────────
  function validatePool() {
    const seen = new Map(), problems = [];
    for (const p of POOL.players) {
      for (const code of p.teams) {
        if (!TEAMS[code]) problems.push(`Unknown team code "${code}" (${p.name})`);
        else if (seen.has(code)) problems.push(`${teamName(code)} picked by both ${seen.get(code)} and ${p.name}`);
        seen.set(code, p.name);
      }
    }
    const unowned = Object.keys(TEAMS).filter((c) => !seen.has(c));
    if (unowned.length && unowned.length < 48) problems.push(`Unowned teams: ${unowned.map(teamName).join(", ")}`);
    return problems;
  }

  // ── leaderboard ─────────────────────────────────────────────────
  function renderLeaderboard() {
    const el = $("#view-leaderboard");
    const prevPos = new Map();
    const wasOpen = new Set();
    el.querySelectorAll(".player-card").forEach((c) => {
      prevPos.set(c.dataset.player, c.getBoundingClientRect().top);
      if (c.classList.contains("open")) wasOpen.add(c.dataset.player);
    });

    const medals = ["🥇", "🥈", "🥉"];
    el.innerHTML = state.players.map((p, i) => {
      const medal = p.rank <= 3 ? medals[p.rank - 1] : "";
      const leader = p.rank === 1 ? "leader" : "";
      return `
      <div class="player-card ${leader}" data-player="${esc(p.name)}" style="animation-delay:${i * 45}ms">
        <button class="player-head" aria-expanded="false">
          <span class="rank">${medal || ordinal(p.rank)}</span>
          <span class="avatar">${p.avatar}</span>
          <span class="player-name">${esc(p.name)}</span>
          <span class="alive-dots" title="${p.alive} of ${p.teams.length} teams still alive">
            ${p.teams.map((t) => `<i class="dot ${t.status === "out" ? "dead" : t.status === "champion" ? "champ" : ""}"></i>`).join("")}
          </span>
          <span class="mini-flags">${p.teams.map((t) => `<span class="mini-flag ${t.status === "out" ? "faded" : ""}">${flag(t.code, "w40")}</span>`).join("")}</span>
          <span class="points" data-count="${p.total}">${firstRender ? 0 : p.total}</span>
          <span class="chev">▾</span>
        </button>
        <div class="player-detail">
          ${p.teams.map((t) => `
            <div class="team-row ${t.status}">
              <div class="team-stripe" style="background:${grad(t.code)}"></div>
              ${flag(t.code)}
              <div class="team-info">
                <div class="team-name">${esc(teamName(t.code))} <span class="grp">Grp ${TEAMS[t.code]?.group || "?"}</span></div>
                ${statusBadge(t)}
              </div>
              <div class="team-breakdown">
                ${t.breakdown.length ? t.breakdown.map((b) => `<span class="bd">${esc(b.label)} <b>+${b.pts}</b></span>`).join("") : `<span class="bd muted">No points yet</span>`}
              </div>
              <div class="team-pts">${t.total}</div>
            </div>`).join("")}
        </div>
      </div>`;
    }).join("");

    // restore cards that were expanded before the refresh
    el.querySelectorAll(".player-card").forEach((c) => {
      if (wasOpen.has(c.dataset.player)) c.classList.add("open");
    });

    // expand/collapse
    el.querySelectorAll(".player-head").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".player-card");
        const open = card.classList.toggle("open");
        btn.setAttribute("aria-expanded", open);
      });
    });

    // FLIP slide animation on rank change
    if (!firstRender) {
      el.querySelectorAll(".player-card").forEach((c) => {
        const prev = prevPos.get(c.dataset.player);
        if (prev == null) return;
        const delta = prev - c.getBoundingClientRect().top;
        if (Math.abs(delta) > 2) {
          c.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], { duration: 500, easing: "cubic-bezier(.2,.8,.2,1)" });
        }
      });
    }
    if (firstRender) countUpAll(el);
  }

  function countUpAll(scope) {
    scope.querySelectorAll(".points[data-count]").forEach((el) => {
      const target = +el.dataset.count;
      if (!target) { el.textContent = "0"; return; }
      const t0 = performance.now(), dur = 900;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // ── groups ──────────────────────────────────────────────────────
  function renderGroups() {
    $("#view-groups").innerHTML = GROUPS.map((g) => {
      const rows = state.tables[g];
      const started = rows.some((r) => r.P > 0);
      return `
      <div class="group-card">
        <div class="group-title">Group ${g}</div>
        <table class="group-table">
          <thead><tr><th></th><th class="tl">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>
          ${rows.map((r, i) => {
            const owner = state.owners[r.code];
            const qualClass = started && i < 2 ? "q-auto" : started && i === 2 ? "q-maybe" : "";
            return `<tr class="${qualClass}">
              <td class="pos">${i + 1}</td>
              <td class="tl team-cell">${flag(r.code, "w40")} <span>${esc(teamName(r.code))}</span>
                ${owner ? `<span class="owner-tag">${esc(owner)}</span>` : ""}</td>
              <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td>
              <td class="${r.GD > 0 ? "pos-gd" : r.GD < 0 ? "neg-gd" : ""}">${r.GD > 0 ? "+" : ""}${r.GD}</td>
              <td class="pts-cell">${r.Pts}</td></tr>`;
          }).join("")}
          </tbody>
        </table>
      </div>`;
    }).join("");
  }

  // ── matches ─────────────────────────────────────────────────────
  function matchCard(m) {
    const ownerH = state.owners[m.home], ownerA = state.owners[m.away];
    const liveNow = m.status === "LIVE" || m.status === "IN_PLAY" || m.status === "PAUSED";
    const done = m.status === "FINISHED";
    const score = done || liveNow ? `${m.homeScore ?? "–"} : ${m.awayScore ?? "–"}` : fmtDate(m.utcDate).split(",").pop().trim();
    const pens = done && m.winner && m.homeScore === m.awayScore ? `<div class="pens">${esc(teamName(m.winner))} win on penalties</div>` : "";
    return `
    <div class="match-card ${liveNow ? "live" : ""} ${done ? "done" : ""}">
      <div class="match-stage">${PoolEngine.STAGE_LABELS[m.stage] || m.stage}${m.group ? ` · Group ${m.group}` : ""}
        ${liveNow ? `<span class="live-pip">● LIVE</span>` : `<span class="match-date">${fmtDate(m.utcDate)}</span>`}</div>
      <div class="match-teams">
        <div class="mt home ${done && m.winner === m.home ? "won" : ""}">${flag(m.home, "w40")}<span>${esc(teamName(m.home))}</span>${ownerH ? `<span class="owner-tag">${esc(ownerH)}</span>` : ""}</div>
        <div class="score">${score}</div>
        <div class="mt away ${done && m.winner === m.away ? "won" : ""}">${ownerA ? `<span class="owner-tag">${esc(ownerA)}</span>` : ""}<span>${esc(teamName(m.away))}</span>${flag(m.away, "w40")}</div>
      </div>
      ${pens}
    </div>`;
  }

  function renderMatches() {
    const el = $("#view-matches");
    const ms = [...state.matches].sort((a, b) => new Date(a.utcDate || 0) - new Date(b.utcDate || 0));
    if (!ms.length) {
      el.innerHTML = `<div class="empty">⚽ No match data yet — the live feed will populate this automatically once the sync runs.</div>`;
      return;
    }
    const today = new Date().toDateString();
    const sections = [
      { title: "🔴 Live & Today", items: ms.filter((m) => m.status === "LIVE" || m.status === "IN_PLAY" || m.status === "PAUSED" || new Date(m.utcDate).toDateString() === today) },
      { title: "📅 Upcoming", items: ms.filter((m) => m.status !== "FINISHED" && new Date(m.utcDate).toDateString() !== today).slice(0, 12) },
      { title: "✅ Results", items: ms.filter((m) => m.status === "FINISHED" && new Date(m.utcDate).toDateString() !== today).reverse() },
    ];
    el.innerHTML = sections.filter((s) => s.items.length).map((s) =>
      `<h3 class="section-title">${s.title}</h3><div class="match-grid">${s.items.map(matchCard).join("")}</div>`
    ).join("");
  }

  // ── bracket ─────────────────────────────────────────────────────
  function renderBracket() {
    const el = $("#view-bracket");
    const ko = state.matches.filter((m) => m.stage !== "GROUP");
    if (!ko.length) {
      el.innerHTML = `<div class="empty">🔒 The knockout bracket unlocks when the group stage wraps up (32 teams advance: 12 group winners, 12 runners-up, 8 best third-place teams).</div>`;
      return;
    }
    const cols = ["R32", "R16", "QF", "SF", "FINAL", "THIRD"];
    el.innerHTML = `<div class="bracket">` + cols.map((stage) => {
      const items = ko.filter((m) => m.stage === stage).sort((a, b) => new Date(a.utcDate || 0) - new Date(b.utcDate || 0));
      if (!items.length) return "";
      return `<div class="bracket-col"><h3 class="section-title">${PoolEngine.STAGE_LABELS[stage]}</h3>${items.map(matchCard).join("")}</div>`;
    }).join("") + `</div>`;
  }

  // ── wooden spoon ────────────────────────────────────────────────
  function renderSpoon() {
    const el = $("#view-spoon");
    const ranking = state.spoonRank.slice(0, 6);
    const locked = state.allGroupsDone;
    el.innerHTML = `
      <div class="spoon-hero">
        <div class="spoon-emoji">🥄</div>
        <h2>The Wooden Spoon</h2>
        <p>The owner of the tournament's <b>worst team</b> bags a <b>+${SCORING.woodenSpoon} point</b> consolation bonus.<br>
        Ranked by fewest group points → worst goal differential → fewest goals scored.</p>
        <div class="spoon-status ${locked ? "locked" : ""}">${locked
          ? `🏅 Awarded to <b>${esc(state.owners[state.spoonCode] || "—")}</b> for ${esc(teamName(state.spoonCode))}`
          : "⏳ Live projection — locks in when the group stage ends"}</div>
      </div>
      <div class="spoon-list">
        ${ranking.map((r, i) => `
          <div class="spoon-row ${i === 0 ? "spoon-leader" : ""}">
            <span class="spoon-rank">${i === 0 ? "🥄" : "#" + (i + 1)}</span>
            ${flag(r.code, "w40")}
            <span class="spoon-team">${esc(teamName(r.code))}</span>
            ${state.owners[r.code] ? `<span class="owner-tag">${esc(state.owners[r.code])}</span>` : ""}
            <span class="spoon-stats">${r.W}W-${r.D}D-${r.L}L · GD ${r.GD > 0 ? "+" : ""}${r.GD} · ${r.Pts} pts</span>
          </div>`).join("")}
      </div>`;
  }

  // ── scoring reference ───────────────────────────────────────────
  function renderRules() {
    const rows = [
      ["Group-stage win", SCORING.groupWin], ["Group-stage draw", SCORING.groupDraw],
      ["Finish 1st in group", SCORING.groupFirst], ["Finish 2nd in group", SCORING.groupSecond],
      ["3rd place that advances", SCORING.groupThirdAdvance],
      ["Win Round of 32 game", SCORING.r32Win], ["Win Round of 16 game", SCORING.r16Win],
      ["Win Quarter-final", SCORING.qfWin], ["Win Semi-final", SCORING.sfWin],
      ["Win Third-place match", SCORING.thirdPlaceWin], ["Win the Final 🏆", SCORING.finalWin],
      ["Wooden Spoon (worst team) 🥄", SCORING.woodenSpoon],
    ];
    $("#rules-table").innerHTML = rows.map(([l, p]) => `<div class="rule"><span>${l}</span><b>+${p}</b></div>`).join("");
  }

  // ── header / hero ───────────────────────────────────────────────
  function renderHero() {
    $("#pool-name").textContent = POOL.settings.poolName;
    const finished = state.matches.filter((m) => m.status === "FINISHED").length;
    const total = state.matches.length || 104;
    const liveCount = state.matches.filter((m) => ["LIVE", "IN_PLAY", "PAUSED"].includes(m.status)).length;
    $("#hero-stats").innerHTML = `
      <div class="stat"><b>${finished}</b><span>matches played</span></div>
      <div class="stat"><b>${state.players.length}</b><span>players</span></div>
      <div class="stat"><b>${Object.values(state.scores).filter((s) => s.status !== "out").length}</b><span>teams alive</span></div>
      ${liveCount ? `<div class="stat stat-live"><b>${liveCount}</b><span>LIVE now</span></div>` : ""}`;
    $("#updated-at").textContent = live.updatedAt
      ? `Live feed updated ${new Date(live.updatedAt).toLocaleString()}`
      : "Waiting for first live sync…";

    const banners = [];
    if (POOL.settings.sampleDraft) banners.push(`🎲 <b>SAMPLE DRAFT</b> — these team assignments are placeholders until the real draft is entered.`);
    validatePool().forEach((p) => banners.push(`⚠️ ${esc(p)}`));
    $("#banners").innerHTML = banners.map((b) => `<div class="banner">${b}</div>`).join("");

    // champion celebration
    const champ = Object.values(state.scores).find((s) => s.status === "champion");
    if (champ && !confettiFired) { confettiFired = true; confetti(); }
  }

  // ── confetti (tiny, dependency-free) ────────────────────────────
  function confetti() {
    const cv = document.createElement("canvas");
    cv.className = "confetti";
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    cv.width = innerWidth; cv.height = innerHeight;
    const colors = ["#FFD700", "#FF4D6D", "#4DCCFF", "#7CFC00", "#FF9F1C", "#C77DFF"];
    const parts = Array.from({ length: 180 }, () => ({
      x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5,
      r: 4 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0],
      vy: 2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3, rot: Math.random() * Math.PI, vr: -0.1 + Math.random() * 0.2,
    }));
    const t0 = performance.now();
    (function tick(t) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      }
      if (t - t0 < 6000) requestAnimationFrame(tick); else cv.remove();
    })(t0);
  }

  // ── tabs & boot ─────────────────────────────────────────────────
  function renderAll() {
    renderHero(); renderLeaderboard(); renderGroups(); renderMatches(); renderBracket(); renderSpoon(); renderRules();
    firstRender = false;
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${tab.dataset.view}` || (tab.dataset.view === "leaderboard" && v.id === "view-leaderboard")));
    });
  });

  refresh(true);
  setInterval(refresh, REFRESH_MS);
})();
